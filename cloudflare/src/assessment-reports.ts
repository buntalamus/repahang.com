import { currentUser, json } from './auth';
import criteria from './kriteria-penilaian.json';
import type { Env } from './types';

type Row = Record<string, unknown>;
const ORDER = `CASE lpp.jawatan WHEN 'Pengadil' THEN 1
  WHEN 'Penolong Pengadil 1' THEN 2 WHEN 'Penolong Pengadil 2' THEN 3
  WHEN 'Pegawai ke4' THEN 4 ELSE 5 END`;
const JSON_COLUMNS = ['kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan',
  'fizikal_kelemahan','kerjasama_kekuatan','kerjasama_kelemahan'] as const;

function positiveId(raw: string | null): number | null {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function decodeOfficial(row: Row): Row {
  const decoded = {...row};
  for (const field of JSON_COLUMNS) {
    try {
      const value: unknown = JSON.parse(String(decoded[field] ?? ''));
      decoded[field] = Array.isArray(value) ? value : [];
    } catch { decoded[field] = []; }
  }
  return decoded;
}

function sectionsFor(role: string): Array<{key:string;label:string;items:readonly string[]}> {
  const kind = role.includes('Penolong') || role.includes('Pembantu')
    ? 'Penolong Pengadil'
    : role.includes('ke4') || role.includes('Keempat') || role.includes('Ke 4') || role.includes('Ke-4')
      ? 'Pegawai ke4' : 'Pengadil';
  return Object.entries(criteria[kind]).map(([key,section]) => ({key,...section}));
}

function parseDetails(raw: unknown): unknown {
  try { return JSON.parse(String(raw ?? '')) || []; } catch { return []; }
}

/** Fetch related rows in batches to keep the Admin list within D1 query limits. */
async function attachDetails(env: Env, reports: Row[], admin: boolean): Promise<Row[]> {
  if (!reports.length) return reports;
  const officials = new Map<number,Row[]>();
  const approvals = new Map<number,Row>();
  const audits = new Map<number,Row[]>();
  for (let offset=0; offset<reports.length; offset+=100) {
    const ids = reports.slice(offset,offset+100).map((report) => Number(report.id));
    const placeholders = ids.map(() => '?').join(',');
    const children = await env.DB.prepare(`
      SELECT lpp.*,lp.pengadil_id FROM laporan_penilaian_pegawai lpp
      LEFT JOIN lantikan_pengadil lp ON lp.id=lpp.lantikan_pengadil_id
      WHERE lpp.laporan_id IN (${placeholders})
      ORDER BY lpp.laporan_id,${ORDER},lpp.id
    `).bind(...ids).all<Row>();
    for (const child of children.results) {
      const id = Number(child.laporan_id);
      if (!officials.has(id)) officials.set(id,[]);
      officials.get(id)!.push(decodeOfficial(child));
    }
    const states = await env.DB.prepare(`
      SELECT laporan_id,id AS pengesahan_id,status AS pengesahan_status,
        pengesah_nama,pengesah_jawatan,pengesah_negeri,email_sent_at,telegram_sent_at,
        approval_token,
        CASE WHEN NULLIF(trim(email_recipient),'') IS NULL THEN 0 ELSE 1 END AS email_applicable,
        CASE WHEN telegram_chat_id IS NULL THEN 0 ELSE 1 END AS telegram_applicable,
        catatan_pengerusi,tarikh_sahkan AS tarikh_sahkan_pengerusi,
        alasan_override,admin_override_user_id
      FROM laporan_pengesahan_pengerusi WHERE laporan_id IN (${placeholders})
    `).bind(...ids).all<Row>();
    for (const state of states.results) approvals.set(Number(state.laporan_id),state);
    if (admin) {
      const events = await env.DB.prepare(`
        SELECT id,laporan_id,event_type,channel,event_status,actor_type,
          actor_user_id,actor_luar_id,link_url,details_json,created_at
        FROM (
          SELECT *,row_number() OVER (PARTITION BY laporan_id ORDER BY id DESC) AS rn
          FROM laporan_pengesahan_audit WHERE laporan_id IN (${placeholders})
        ) WHERE rn<=100 ORDER BY laporan_id,id DESC
      `).bind(...ids).all<Row>();
      for (const event of events.results) {
        const id = Number(event.laporan_id);
        const {laporan_id:_reportId,details_json,...rest} = event;
        if (!audits.has(id)) audits.set(id,[]);
        audits.get(id)!.push({...rest,details:parseDetails(details_json)});
      }
    }
  }
  return reports.map((report) => {
    const id = Number(report.id);
    const state = approvals.get(id);
    let pengesahan: Row | null = null;
    if (state) {
      const {laporan_id:_reportId,approval_token:approvalToken,...rest} = state;
      pengesahan = {...rest};
      if (admin) {
        pengesahan.approval_url = state.pengesahan_status==='Menunggu' &&
          typeof approvalToken==='string' && /^[a-fA-F0-9]{64}$/.test(approvalToken)
          ? `${env.BASE_URL.replace(/\/$/,'')}/api/laporan-pengesahan-token.php?token=${approvalToken}`
          : null;
        pengesahan.audit = audits.get(id) ?? [];
      }
    }
    return {...report,pegawai:officials.get(id) ?? [],pengesahan};
  });
}

/** Read-only signed-in RA/Admin reports; writes require chair notification parity. */
export async function assessmentReports(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return json({error:true,message:'Penulisan laporan belum tersedia di staging.'},503);
  }
  const user = await currentUser(request,env);
  if (!user) return json({error:true,message: 'Sesi tidak sah. Sila log masuk semula.'},401);
  if (!['Admin','Penilai','PP Daerah'].includes(user.role)) {
    return json({error:true,message:'Akses ditolak.'},403);
  }
  const params = new URL(request.url).searchParams;
  const admin = user.role === 'Admin';
  if (params.has('officials')) {
    const jadualId = positiveId(params.get('officials'));
    if (!jadualId) return json({error:true,message:'ID perlawanan tidak sah.'},400);
    if (!admin) {
      const ra = await env.DB.prepare(`
        SELECT 1 FROM lantikan_pengadil WHERE jadual_id=? AND pengadil_id=?
          AND jawatan='Penilai Pengadil' AND status='Diterima' LIMIT 1
      `).bind(jadualId,user.id).first();
      if (!ra) return json({error:true,message:'Anda bukan RA yang diterima untuk perlawanan ini.'},403);
    }
    const officials = await env.DB.prepare(`
      SELECT lp.id AS lantikan_pengadil_id,lp.jawatan,
        COALESCE(NULLIF(trim(u.nama_penuh),''),NULLIF(trim(pl.nama),''),'Nama tidak direkodkan')
          AS nama_pengadil
      FROM lantikan_pengadil lp
      LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
      WHERE lp.jadual_id=? AND lp.status='Diterima'
        AND lp.jawatan IN ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')
      ORDER BY CASE lp.jawatan WHEN 'Pengadil' THEN 1 WHEN 'Penolong Pengadil 1' THEN 2
        WHEN 'Penolong Pengadil 2' THEN 3 ELSE 4 END,lp.id
    `).bind(jadualId).all<{lantikan_pengadil_id:number;jawatan:string;nama_pengadil:string}>();
    return json({error:false,data:officials.results.map((official) => ({
      ...official,lantikan_id:official.lantikan_pengadil_id,
      sections:sectionsFor(official.jawatan),
    }))});
  }
  if (params.has('kriteria')) return json({error:false,data:criteria});
  if (params.has('penilai')) {
    const result = await env.DB.prepare(`
      SELECT lp.id,lp.jadual_id,lp.lantikan_id,lp.tahap_kesukaran,lp.ulasan_keseluruhan,
        lp.status,lp.tarikh_hantar,lp.catatan_admin,lp.created_at,
        jp.no_perlawanan,jp.tarikh,jp.masa,jp.pasukan_home,jp.pasukan_away,jp.tempat,
        k.nama AS nama_kejohanan
      FROM laporan_penilaian lp JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id WHERE lp.penilai_id=?
      ORDER BY jp.tarikh DESC
    `).bind(user.id).all<Row>();
    return json({error:false,data:await attachDetails(env,result.results,admin)});
  }
  if (params.has('id')) {
    const id = positiveId(params.get('id'));
    if (!id) return json({error:true,message:'ID laporan tidak sah.'},400);
    const row = await env.DB.prepare(`
      SELECT lp.*,jp.no_perlawanan,jp.tarikh,jp.masa,jp.pasukan_home,jp.pasukan_away,jp.tempat,
        k.nama AS nama_kejohanan,k.id AS kejohanan_id,
        COALESCE(u_pen.nama_penuh,pl_pen.nama) AS nama_penilai
      FROM laporan_penilaian lp JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id
      LEFT JOIN users u_pen ON u_pen.id=lp.penilai_id
      LEFT JOIN lantikan_pengadil la ON la.id=lp.lantikan_id
      LEFT JOIN pengadil_luar pl_pen ON pl_pen.id=la.pengadil_luar_id
      WHERE lp.id=? AND (?=1 OR lp.penilai_id=?) LIMIT 1
    `).bind(id,admin ? 1 : 0,user.id).first<Row>();
    if (!row) return json({error:true,message:'Laporan tidak dijumpai.'},404);
    const report = (await attachDetails(env,[row],admin))[0];
    // worker_revision is an internal concurrency marker, absent from PHP JSON.
    const {worker_revision:_revision,...publicReport} = report;
    return json({error:false,laporan:publicReport});
  }
  if (params.has('jadual_id')) {
    const jadualId = positiveId(params.get('jadual_id'));
    if (!jadualId) return json({error:true,message:'ID perlawanan tidak sah.'},400);
    const result = await env.DB.prepare(`
      SELECT lp.id,lp.jadual_id,lp.status,lp.tahap_kesukaran,lp.ulasan_keseluruhan,
        lp.tarikh_hantar,lp.catatan_admin,
        COALESCE(u_pen.nama_penuh,pl_pen.nama) AS nama_penilai
      FROM laporan_penilaian lp
      LEFT JOIN users u_pen ON u_pen.id=lp.penilai_id
      LEFT JOIN lantikan_pengadil la ON la.id=lp.lantikan_id
      LEFT JOIN pengadil_luar pl_pen ON pl_pen.id=la.pengadil_luar_id
      WHERE lp.jadual_id=? AND (?=1 OR lp.penilai_id=?) ORDER BY lp.created_at,lp.id
    `).bind(jadualId,admin ? 1 : 0,user.id).all<Row>();
    return json({error:false,data:await attachDetails(env,result.results,admin)});
  }
  if (!admin) return json({error:true,message:'Parameter tidak sah.'},400);
  const status = params.get('status')?.trim() ?? '';
  const result = await env.DB.prepare(`
    SELECT lp.id,lp.jadual_id,lp.status,lp.tahap_kesukaran,lp.tarikh_hantar,
      jp.no_perlawanan,jp.tarikh,jp.pasukan_home,jp.pasukan_away,
      k.id AS kejohanan_id,k.nama AS nama_kejohanan,
      COALESCE(u_pen.nama_penuh,pl_pen.nama) AS nama_penilai
    FROM laporan_penilaian lp JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    LEFT JOIN users u_pen ON u_pen.id=lp.penilai_id
    LEFT JOIN lantikan_pengadil la ON la.id=lp.lantikan_id
    LEFT JOIN pengadil_luar pl_pen ON pl_pen.id=la.pengadil_luar_id
    WHERE (?='' OR lp.status=?) ORDER BY jp.tarikh DESC
  `).bind(status,status).all<Row>();
  return json({error:false,data:await attachDetails(env,result.results,true)});
}
