import {currentUser,json} from './auth';
import {appointmentWritesEnabled,lantikanWrite} from './lantikan-write';
import {autoTolakLantikanTertunggak,retryPendingKupCrewNotifications} from './php/lantikan-helper';
import {auditMetaFrom} from './php/lantikan-audit';
import type {Env} from './types';

type Tournament = {kejohanan_id:number;peringkat_kejohanan:string};
type PoolOfficial = Record<string,unknown> & {daerah:string|null;negeri:string|null};

/** Admin match assignment view and the write actions of api/lantikan.php. */
export async function adminAppointments(request:Request,env:Env):Promise<Response> {
  const user=await currentUser(request,env);
  if (!user) return json({error:true,message:'Sila log masuk.'},401);
  if (user.role!=='Admin') return json({error:true,message:'Akses ditolak.'},403);
  if (request.method!=='GET') return lantikanWrite(request,env,user);
  const raw=new URL(request.url).searchParams.get('jadual_id');
  const jadualId=Number(raw);
  if (!raw || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(jadualId)) {
    return json({error:true,message:'jadual_id diperlukan.'},400);
  }
  // PHP expires overdue answers and retries a queued crew notice on every view.
  if (appointmentWritesEnabled(env)) {
    await autoTolakLantikanTertunggak(env,{jadual_id:jadualId},auditMetaFrom(request));
    try {await retryPendingKupCrewNotifications(env,jadualId);}
    catch (error) {console.error('[lantikan.php GET] KUP crew retry error',
      error instanceof Error ? error.message : error);}
  }
  const tournament=await env.DB.prepare(`
    SELECT jp.kejohanan_id,COALESCE(k.peringkat_kejohanan,'Daerah') AS peringkat_kejohanan
    FROM jadual_perlawanan jp LEFT JOIN kejohanan k ON k.id=jp.kejohanan_id
    WHERE jp.id=? LIMIT 1
  `).bind(jadualId).first<Tournament>();
  if (!tournament) return json({error:true,message:'Perlawanan tidak dijumpai.'},404);
  const [assignments,pool]=await Promise.all([
    env.DB.prepare(`
      SELECT lp.id,lp.jawatan,lp.status,lp.komen,lp.tarikh_jawab,lp.notif_hantar,
        lp.tg_notif_hantar,lp.tarikh_notif,lp.created_at,
        CASE WHEN lp.status='Ditolak' AND lp.komen='Ditolak automatik - tiada jawapan dalam tempoh'
          THEN 1 ELSE 0 END AS is_auto_tolak,
        lp.pengadil_id,lp.pengadil_luar_id,
        CASE WHEN COALESCE(u.email,pl.emel,'')<>'' THEN 1 ELSE 0 END AS email_available,
        CASE WHEN COALESCE(u.telegram_chat_id,pl.telegram_chat_id) IS NOT NULL
          AND COALESCE(u.telegram_chat_id,pl.telegram_chat_id)<>'' THEN 1 ELSE 0 END AS telegram_linked,
        CASE WHEN lp.pengadil_id IS NOT NULL THEN u.nama_penuh ELSE pl.nama END AS nama_penuh,
        CASE WHEN lp.pengadil_id IS NOT NULL THEN u.no_telefon ELSE pl.no_tel END AS no_telefon,
        CASE WHEN lp.pengadil_id IS NOT NULL THEN u.email ELSE pl.emel END AS email,
        CASE WHEN lp.pengadil_id IS NOT NULL THEN u.jenis_pengadil ELSE pl.jenis_pengadil END AS jenis_pengadil,
        CASE WHEN lp.pengadil_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber
      FROM lantikan_pengadil lp
      LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
      WHERE lp.jadual_id=?
      ORDER BY CASE lp.jawatan WHEN 'Pengadil' THEN 1 WHEN 'Penolong Pengadil 1' THEN 2
        WHEN 'Penolong Pengadil 2' THEN 3 WHEN 'Pegawai ke4' THEN 4
        WHEN 'Penilai Pengadil' THEN 5 ELSE 6 END,lp.id
    `).bind(jadualId).all(),
    env.DB.prepare(`
      SELECT pp.id AS pool_id,pp.pengadil_id,pp.pengadil_luar_id,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.nama_penuh ELSE pl.nama END AS nama_penuh,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.no_telefon ELSE pl.no_tel END AS no_telefon,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.email ELSE pl.emel END AS email,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.jenis_pengadil ELSE pl.jenis_pengadil END AS jenis_pengadil,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.daerah ELSE pl.daerah END AS daerah,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.negeri ELSE pl.negeri END AS negeri,
        (SELECT COUNT(*) FROM lantikan_pengadil lp2
          JOIN jadual_perlawanan jp2 ON jp2.id=lp2.jadual_id
          WHERE jp2.kejohanan_id=pp.kejohanan_id
            AND ((pp.pengadil_id IS NOT NULL AND lp2.pengadil_id=pp.pengadil_id)
              OR (pp.pengadil_luar_id IS NOT NULL AND lp2.pengadil_luar_id=pp.pengadil_luar_id)))
          AS jumlah_lantikan_kejohanan
      FROM pool_pengadil pp
      LEFT JOIN users u ON u.id=pp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=pp.pengadil_luar_id
      WHERE pp.kejohanan_id=? ORDER BY nama_penuh ASC
    `).bind(tournament.kejohanan_id).all<PoolOfficial>(),
  ]);
  const state=tournament.peringkat_kejohanan==='Negeri';
  return json({error:false,data:assignments.results,
    referees:pool.results.map((official)=>({...official,
      wilayah:(state ? official.daerah : official.negeri) || '-'})),
    region_label:state ? 'Daerah' : 'Negeri'});
}
