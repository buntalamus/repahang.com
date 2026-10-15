import {currentUser,json} from './auth';
import {boundedJson} from './request';
import type {Env} from './types';

type Body = Record<string,unknown>;
type Match = {id:number;tarikh:string;masa:string;status:string};
type Candidate = {jenis_pengadil:string|null};

const ROLES=new Set(['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2',
  'Pegawai ke4','Penilai Pengadil']);

function positiveId(value:unknown):number|null {
  if (typeof value!=='string' && typeof value!=='number') return null;
  const raw=String(value);
  const id=Number(raw);
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(id) ? id : null;
}

function kickoffTimestamp(match:Match):number|null {
  const value=`${match.tarikh.slice(0,10)}T${match.masa.slice(0,8)}+08:00`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(value)) return null;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Create one pre-kickoff appointment and its audit in a single D1 batch. */
export async function adminAppointmentCreate(request:Request,env:Env):Promise<Response> {
  const actor=await currentUser(request,env);
  if (!actor) return json({error:true,message:'Sila log masuk.'},401);
  if (actor.role!=='Admin') return json({error:true,message:'Akses ditolak.'},403);
  if (env.STAGING_AUTH_ENABLED!=='1' || env.STAGING_WRITES_ENABLED!=='1') {
    return json({error:true,message:'Lantikan baharu belum tersedia di staging.'},503);
  }
  const input=await boundedJson(request);
  if (input instanceof Response) return input;
  if (!input || typeof input!=='object' || Array.isArray(input)) {
    return json({error:true,message:'Data lantikan tidak sah.'},400);
  }
  const body=input as Body;
  if (body.action!==undefined && body.action!=='assign') {
    return json({error:true,message:'Tindakan lantikan ini belum tersedia di staging.'},503);
  }
  const jadualId=positiveId(body.jadual_id);
  const userId=body.pengadil_id == null ? null : positiveId(body.pengadil_id);
  const externalId=body.pengadil_luar_id == null ? null : positiveId(body.pengadil_luar_id);
  const role=typeof body.jawatan==='string' ? body.jawatan.trim() : '';
  if (!jadualId || (!userId && !externalId) || !role) {
    return json({error:true,message:'jadual_id, pengadil dan jawatan diperlukan.'},400);
  }
  if (Boolean(userId)===Boolean(externalId)) {
    return json({error:true,message:'Pilih tepat satu pegawai berdaftar atau pegawai luar.'},400);
  }
  if (!ROLES.has(role)) return json({error:true,message:'Jawatan tidak sah.'},400);
  const match=await env.DB.prepare(`SELECT id,tarikh,masa,status FROM jadual_perlawanan
    WHERE id=? LIMIT 1`).bind(jadualId).first<Match>();
  if (!match) return json({error:true,message:'Perlawanan tidak dijumpai.'},404);
  if (['Dibatalkan','Ditangguhkan'].includes(match.status)) {
    return json({error:true,
      message:'Lantikan tidak boleh diubah untuk perlawanan yang dibatalkan atau ditangguhkan.'},409);
  }
  const kickoff=kickoffTimestamp(match);
  if (kickoff===null || kickoff<=Date.now()) {
    return json({error:true,
      message:'Lantikan selepas perlawanan bermula belum tersedia di staging.'},503);
  }
  const candidate=await env.DB.prepare(`
    SELECT COALESCE(u.jenis_pengadil,pl.jenis_pengadil,'') AS jenis_pengadil
    FROM jadual_perlawanan jp
    JOIN pool_pengadil pp ON pp.kejohanan_id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=pp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=pp.pengadil_luar_id
    WHERE jp.id=? AND ((? IS NOT NULL AND pp.pengadil_id=?)
      OR (? IS NOT NULL AND pp.pengadil_luar_id=?)) LIMIT 1
  `).bind(jadualId,userId,userId,externalId,externalId).first<Candidate>();
  if (!candidate) return json({error:true,
    message:'Pegawai yang dipilih tiada dalam pool kejohanan ini.'},409);
  const isRa=candidate.jenis_pengadil?.trim()==='Penilai Pengadil';
  if (role==='Penilai Pengadil' && !isRa) return json({error:true,
    message:'Slot RA hanya boleh diberikan kepada pegawai berjenis Penilai Pengadil.'},409);
  if (role!=='Penilai Pengadil' && isRa) return json({error:true,
    message:'Penilai Pengadil tidak boleh ditempatkan dalam slot KUP.'},409);
  const existing=await env.DB.prepare(`SELECT id FROM lantikan_pengadil
    WHERE jadual_id=? AND jawatan=? LIMIT 1`).bind(jadualId,role).first();
  if (existing) return json({error:true,
    message:'Penggantian lantikan belum tersedia di staging.'},503);

  const key=crypto.randomUUID();
  const eventKey=`worker-admin-assignment-${key}`;
  const auditDetails=JSON.stringify({previous_pengadil_id:null,
    previous_pengadil_luar_id:null,previous_status:null,match_started:false,
    notification_sent:false});
  const ip=request.headers.get('CF-Connecting-IP');
  const agent=request.headers.get('User-Agent')?.slice(0,255) ?? null;
  let results:D1Result[];
  try {
    results=await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO lantikan_pengadil
          (jadual_id,pengadil_id,pengadil_luar_id,jawatan,status,created_by,
            worker_assignment_key,created_at,updated_at)
        SELECT jp.id,?,?,?,'Belum Jawab',?,?,datetime('now','+8 hours'),datetime('now','+8 hours')
        FROM jadual_perlawanan jp WHERE jp.id=?
          AND jp.status NOT IN ('Dibatalkan','Ditangguhkan')
          AND datetime(jp.tarikh||' '||jp.masa)>datetime('now','+8 hours')
          AND NOT EXISTS (SELECT 1 FROM lantikan_pengadil slot
            WHERE slot.jadual_id=jp.id AND slot.jawatan=?)
          AND EXISTS (SELECT 1 FROM pool_pengadil pp
            LEFT JOIN users u ON u.id=pp.pengadil_id
            LEFT JOIN pengadil_luar pl ON pl.id=pp.pengadil_luar_id
            WHERE pp.kejohanan_id=jp.kejohanan_id
              AND ((? IS NOT NULL AND pp.pengadil_id=?)
                OR (? IS NOT NULL AND pp.pengadil_luar_id=?))
              AND ((?='Penilai Pengadil' AND COALESCE(u.jenis_pengadil,pl.jenis_pengadil,'')='Penilai Pengadil')
                OR (?<>'Penilai Pengadil' AND COALESCE(u.jenis_pengadil,pl.jenis_pengadil,'')<>'Penilai Pengadil')))
          AND NOT EXISTS (SELECT 1 FROM lantikan_pengadil active
            JOIN jadual_perlawanan other ON other.id=active.jadual_id
            WHERE active.status IN ('Belum Jawab','Diterima')
              AND other.tarikh=jp.tarikh AND other.masa=jp.masa
              AND ((? IS NOT NULL AND active.pengadil_id=?)
                OR (? IS NOT NULL AND active.pengadil_luar_id=?)))
          AND NOT EXISTS (SELECT 1 FROM laporan_penilaian report WHERE report.jadual_id=jp.id)
          AND NOT EXISTS (SELECT 1 FROM penilaian_pengadil assessment
            JOIN perlawanan p ON p.id=assessment.perlawanan_id
            JOIN lantikan_pengadil old ON old.id=p.lantikan_id
            WHERE old.jadual_id=jp.id)
      `).bind(userId,externalId,role,actor.id,key,jadualId,role,
        userId,userId,externalId,externalId,role,role,
        userId,userId,externalId,externalId),
      env.DB.prepare(`
        INSERT INTO lantikan_audit_log
          (event_key,lantikan_id,jadual_id,kejohanan_id,pengadil_id,pengadil_luar_id,
            jawatan,nama_pegawai,emel_pegawai,no_telefon_pegawai,event_type,channel,
            event_status,details_json,actor_type,actor_user_id,ip_address,user_agent,created_at)
        SELECT ?,lp.id,lp.jadual_id,jp.kejohanan_id,lp.pengadil_id,lp.pengadil_luar_id,
          lp.jawatan,COALESCE(u.nama_penuh,pl.nama,''),COALESCE(u.email,pl.emel,''),
          COALESCE(u.no_telefon,pl.no_tel,''),'appointment_created','admin','success',?,
          'admin',?,?,?,datetime('now','+8 hours')
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
        LEFT JOIN users u ON u.id=lp.pengadil_id
        LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
        WHERE lp.worker_assignment_key=?
      `).bind(eventKey,auditDetails,actor.id,ip,agent,key),
      env.DB.prepare(`UPDATE jadual_perlawanan SET status='Menunggu Pengesahan',
        updated_at=datetime('now','+8 hours') WHERE id=?
        AND EXISTS (SELECT 1 FROM lantikan_pengadil WHERE worker_assignment_key=?)`)
        .bind(jadualId,key),
    ]);
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) {
      return json({error:true,message:'Slot lantikan telah berubah. Muat semula dan cuba lagi.'},409);
    }
    throw error;
  }
  if (results.some((result)=>Number(result.meta?.changes)!==1)) {
    return json({error:true,
      message:'Lantikan tidak dapat dibuat kerana slot, pool atau masa telah berubah.'},409);
  }
  return json({error:false,message:'Pengadil berjaya dilantik.'});
}
