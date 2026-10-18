import {currentUser} from './auth';
import {originalHtml} from './original-templates';
import type {Env} from './types';

type Row=Record<string,unknown>;
const JSON_COLUMNS=['kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan',
  'fizikal_kelemahan','kerjasama_kekuatan','kerjasama_kelemahan'] as const;

function esc(value:unknown):string {
  return String(value ?? '').replace(/[&<>"']/g,(character)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[character] ?? character);
}
function html(content:string,status=200):Response {
  return new Response(content,{status,headers:{
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; img-src data: 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  }});
}
function error(message:string,status:number):Response {
  return html(`<!doctype html><html lang="ms"><meta charset="utf-8"><title>Laporan Penilai Pengadil</title><p style="font-family:Arial,sans-serif;padding:20px">${esc(message)}</p></html>`,status);
}
function positiveId(raw:string|null):number|null {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id=Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}
async function verifyViewToken(reportId:number,secret:string,signature:string):Promise<boolean> {
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=new Uint8Array(signature.match(/../g)!.map((part)=>parseInt(part,16)));
  return crypto.subtle.verify('HMAC',key,bytes,
    new TextEncoder().encode(`laporan-penilaian:view:${reportId}`));
}

async function reportLogo(env:Env,raw:unknown):Promise<string> {
  const path=String(raw ?? '');
  if (!/^\/uploads\/[A-Za-z0-9_./-]+$/.test(path) || path.includes('..')) return '';
  const object=await env.MEDIA.get(path.slice('/uploads/'.length));
  if (!object) return '';
  const mime=object.httpMetadata?.contentType;
  if (mime!=='image/png' && mime!=='image/jpeg') return '';
  const bytes=new Uint8Array(await object.arrayBuffer());
  if (bytes.length===0 || bytes.length>1_000_000) return '';
  let binary='';
  for (let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Read-only, printable RA report with the same three access modes as PHP. */
export async function printAssessment(request:Request,env:Env):Promise<Response> {
  if (request.method!=='GET') return error('Kaedah tidak disokong.',405);
  if (env.STAGING_AUTH_ENABLED!=='1') return error('Laporan RA belum tersedia di staging.',503);
  const params=new URL(request.url).searchParams;
  const id=positiveId(params.get('id'));
  if (!id) return error('ID laporan diperlukan.',400);
  const approval=params.get('approval_token');
  const view=params.get('view_token');
  if ((approval && view) || params.getAll('approval_token').length>1 || params.getAll('view_token').length>1) {
    return error('Pautan laporan tidak sah.',400);
  }
  let actor:Awaited<ReturnType<typeof currentUser>>=null;
  if (approval) {
    if (!/^[a-fA-F0-9]{64}$/.test(approval)) return error('Pautan semakan laporan tidak sah.',404);
    const permission=await env.DB.prepare(`SELECT 1 FROM laporan_pengesahan_pengerusi a
      JOIN laporan_penilaian r ON r.id=a.laporan_id
      WHERE a.laporan_id=? AND a.approval_token=?
        AND r.status IN ('Dihantar','Disahkan') LIMIT 1`).bind(id,approval).first();
    if (!permission) return error('Pautan semakan laporan tidak sah.',404);
  } else if (!view) {
    actor=await currentUser(request,env);
    if (!actor) return error('Sila log masuk terlebih dahulu.',403);
    if (!['Admin','Penilai','PP Daerah','Pengadil'].includes(actor.role)) {
      return error('Akses tidak dibenarkan untuk peranan anda.',403);
    }
  }
  const report=await env.DB.prepare(`SELECT r.*,jp.no_perlawanan,jp.tarikh,jp.masa,
    jp.pasukan_home,jp.pasukan_away,jp.tempat,jp.logo_home,jp.logo_away,
    k.nama AS nama_kejohanan,k.logo_kiri,k.logo_kanan,
    COALESCE(u.nama_penuh,pl.nama) AS nama_penilai,
    COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),'-') AS penilai_negeri,
    a.status AS pengesahan_status,a.pengesah_nama,a.pengesah_jawatan,
    a.catatan_pengerusi,a.alasan_override,la.penilaian_token,la.status AS ra_status,
    la.jawatan AS ra_jawatan
    FROM laporan_penilaian r
    JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=r.penilai_id
    LEFT JOIN lantikan_pengadil la ON la.id=r.lantikan_id
    LEFT JOIN pengadil_luar pl ON pl.id=la.pengadil_luar_id
    LEFT JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=r.id
    WHERE r.id=? AND (r.status='Disahkan' OR (?=1 AND r.status='Dihantar')) LIMIT 1`)
    .bind(id,approval ? 1 : 0).first<Row>();
  if (!report) return error('Laporan tidak dijumpai atau belum disahkan.',404);
  if (view) {
    if (report.status!=='Disahkan' || report.ra_status!=='Diterima'
      || report.ra_jawatan!=='Penilai Pengadil'
      || !await verifyViewToken(id,String(report.penilaian_token ?? ''),view)) {
      return error('Laporan tidak dijumpai atau belum disahkan.',404);
    }
  } else if (actor?.role==='Penilai' && Number(report.penilai_id)!==actor.id) {
    return error('Anda tidak mempunyai akses kepada laporan ini.',403);
  } else if (actor?.role==='Pengadil') {
    const allowed=await env.DB.prepare(`SELECT 1 FROM laporan_penilaian_pegawai p
      JOIN lantikan_pengadil la ON la.id=p.lantikan_pengadil_id
      WHERE p.laporan_id=? AND la.pengadil_id=? LIMIT 1`).bind(id,actor.id).first();
    if (!allowed) return error('Anda tidak mempunyai akses kepada laporan ini.',403);
  } else if (actor?.role==='PP Daerah') {
    const allowed=await env.DB.prepare(`SELECT 1 FROM users pp WHERE pp.id=? AND
      (?=pp.id OR EXISTS (SELECT 1 FROM laporan_penilaian_pegawai p
        JOIN lantikan_pengadil la ON la.id=p.lantikan_pengadil_id
        JOIN users kup ON kup.id=la.pengadil_id
        WHERE p.laporan_id=? AND kup.persatuan_id=pp.persatuan_id)) LIMIT 1`)
      .bind(actor.id,report.penilai_id,id).first();
    if (!allowed) return error('Anda tidak mempunyai akses kepada laporan ini.',403);
  }
  const officials=await env.DB.prepare(`SELECT p.*,
    COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),'-') AS negeri
    FROM laporan_penilaian_pegawai p
    LEFT JOIN lantikan_pengadil la ON la.id=p.lantikan_pengadil_id
    LEFT JOIN users u ON u.id=la.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=la.pengadil_luar_id
    WHERE p.laporan_id=? ORDER BY CASE p.jawatan WHEN 'Pengadil' THEN 1
      WHEN 'Penolong Pengadil 1' THEN 2 WHEN 'Penolong Pengadil 2' THEN 3
      WHEN 'Pegawai ke4' THEN 4 ELSE 5 END,p.id`).bind(id).all<Row>();
  const {penilaian_token:_token,...safeReport}=report;
  for (const official of officials.results) {
    for (const field of JSON_COLUMNS) if (official[field]===undefined) official[field]=null;
  }
  const [logoKiri,logoKanan,logoHome,logoAway]=await Promise.all([
    reportLogo(env,report.logo_kiri),reportLogo(env,report.logo_kanan),
    reportLogo(env,report.logo_home),reportLogo(env,report.logo_away),
  ]);
  try {return html(await originalHtml(env,{kind:'assessment',report:{...safeReport,
    logo_kiri_data:logoKiri,logo_kanan_data:logoKanan,
    logo_home_data:logoHome,logo_away_data:logoAway,
  },officials:officials.results,autoprint:params.has('print')}));}
  catch {return error('Laporan belum dapat dijana. Sila cuba semula.',503);}
}
