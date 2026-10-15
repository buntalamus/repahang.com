import {currentUser} from './auth';
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
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  }});
}
function error(message:string,status:number):Response {
  return html(`<!doctype html><html lang="ms"><meta charset="utf-8"><title>Laporan RA</title><p style="font-family:Arial,sans-serif;padding:20px">${esc(message)}</p></html>`,status);
}
function positiveId(raw:string|null):number|null {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id=Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}
function date(raw:unknown):string {
  const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw ?? ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
}
function score(raw:unknown):string {return raw===null || raw===undefined ? '-' : String(raw);}
function points(raw:unknown):string[] {
  try {const value:unknown=JSON.parse(String(raw ?? ''));return Array.isArray(value)
    ? value.filter((item):item is string=>typeof item==='string') : [];
  } catch {return [];}
}
function list(items:string[]):string {
  return `<ol>${(items.length ? items : ['-']).map((item)=>`<li>${esc(item)}</li>`).join('')}</ol>`;
}
function paragraph(value:unknown):string {return esc(value ?? '').replaceAll('\n','<br>');}
function markah(raw:unknown):string {
  const value=Number(raw);
  return raw===null || raw===undefined || !Number.isFinite(value) ? '-' : value.toFixed(1);
}
function performance(raw:unknown):string {
  return raw==='Sangat Baik' ? 'Cemerlang' : String(raw ?? '-');
}
function role(raw:unknown):string {
  return raw==='Pegawai ke4' ? 'Pegawai ke-4' : String(raw ?? '-');
}
function difficulty(raw:unknown):string {
  return raw==='Susah' ? 'Sukar' : raw==='Sangat Susah' ? 'Sangat Sukar' : 'Normal';
}
function logo(raw:unknown):string {
  const url=String(raw ?? '');
  return /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(url)
    ? `<img class="logo" src="${url}" alt="">` : '<span class="logo-spacer"></span>';
}
function officialSection(official:Row):string {
  const position=String(official.jawatan ?? '');
  const sections=position==='Pengadil'
    ? [['kawalan','Kawalan Perlawanan'],['fizikal','Kecergasan Fizikal dan Kedudukan'],
      ['kerjasama','Kerjasama Berpasukan']]
    : [['kawalan',position.includes('Penolong') ? 'Ketepatan isyarat, kedudukan dan teknik bendera'
      : 'Kerjasama dengan pengadil, penolong pengadil dan kawalan kawasan teknikal']];
  const details=sections.map(([key,title])=>{
    const strengths=points(official[`${key}_kekuatan`]);
    const weaknesses=points(official[`${key}_kelemahan`]);
    const advice=official[`${key}_nasihat`];
    return `<section class="section"><h3>${esc(title)}</h3>
      <h4>Kekuatan</h4>${list(strengths)}
      <h4>Aspek Penambahbaikan</h4>${list(weaknesses)}
      ${advice ? `<p class="advice"><strong>Nasihat:</strong> ${paragraph(advice)}</p>` : ''}</section>`;
  }).join('');
  return `<section class="official"><h2>${esc(role(position))}: ${esc(String(official.nama_pengadil ?? '-').toUpperCase())}</h2>
    <p>Negeri: ${esc(official.negeri || '-')} &nbsp; Prestasi: <strong>${esc(performance(official.prestasi))}</strong>
    &nbsp; Markah: <strong>${esc(markah(official.markah))}</strong></p>${details}</section>`;
}

export function renderAssessmentReport(report:Row,officials:Row[],autoprint=false):string {
  const halfHome=report.skor_ht_home,halfAway=report.skor_ht_away;
  const secondHome=report.skor_ft_home,secondAway=report.skor_ft_away;
  const extraHome=report.skor_et_home,extraAway=report.skor_et_away;
  const finalHome=halfHome==null || secondHome==null ? '-'
    : Number(halfHome)+Number(secondHome)+Number(extraHome ?? 0);
  const finalAway=halfAway==null || secondAway==null ? '-'
    : Number(halfAway)+Number(secondAway)+Number(extraAway ?? 0);
  const comment=report.catatan_pengerusi ?? report.catatan_admin ?? '';
  const commentLabel=report.pengesahan_status==='Override Admin' ? 'Catatan Override Admin'
    : report.pengesahan_status==='Disahkan' ? 'Catatan Pengerusi Pengadil' : 'Catatan Admin';
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Laporan Penilai Pengadil — ${esc(report.pasukan_home)} vs ${esc(report.pasukan_away)}</title>
    <style>
      *{box-sizing:border-box}body{font:10pt Arial,sans-serif;color:#111827;background:#eef1f5;margin:0;padding:60px 0 20px}
      .toolbar{position:fixed;top:0;left:0;right:0;background:#111827;color:#fff;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
      button{background:#fada00;border:0;border-radius:4px;padding:8px 16px;font-weight:700;cursor:pointer}
      main{width:210mm;min-height:280mm;background:#fff;margin:auto;padding:12mm;box-shadow:0 2px 12px #0002}
      h1{text-align:center;font-size:18pt;margin:0}header{text-align:center;border-bottom:3px solid #003366;padding-bottom:10px;margin-bottom:14px}
      .report-header{display:flex;align-items:center;justify-content:space-between;gap:6mm}
      .report-header .logo,.report-header .logo-spacer{width:17mm;height:17mm;object-fit:contain;flex:none}
      .report-header .heading{flex:1}.team-logo{width:13mm;height:13mm;object-fit:contain;display:block;margin:0 auto 2mm}
      h2{background:#003366;color:#fff;font-size:11pt;padding:7px 9px;margin:16px 0 7px}
      h3{font-size:10pt;margin:9px 0 5px}h4{font-size:9pt;margin:8px 0 3px}
      table{width:100%;border-collapse:collapse;margin:7px 0 12px;table-layout:fixed}
      td,th{border:1px solid #9ca3af;padding:5px 7px;vertical-align:top;overflow-wrap:anywhere}
      th,.label{background:#eef2f7;font-weight:700}.center{text-align:center}
      .section{break-inside:avoid}.official{break-inside:avoid}.official ~ .official{break-before:page}
      ol{margin:3px 0 8px;padding-left:26px}li{padding:2px 0;overflow-wrap:anywhere}
      .advice{border-left:4px solid #ef4444;background:#fef2f2;padding:7px 10px;overflow-wrap:anywhere}
      .remarks{border:1px solid #9ca3af;padding:8px;white-space:normal;overflow-wrap:anywhere}
      footer{border-top:1px solid #9ca3af;margin-top:18px;padding-top:8px;color:#475569;font-size:9pt}
      @page{size:A4 portrait;margin:12mm 15mm}
      @media print{body{background:#fff;padding:0}main{width:auto;min-height:0;padding:0;box-shadow:none}.toolbar{display:none}}
    </style></head><body>
    <div class="toolbar"><strong>Laporan Penilai Pengadil</strong><button onclick="window.print()">Cetak / Simpan PDF</button></div>
    <main><header class="report-header">${logo(report.logo_kiri_data)}<div class="heading"><h1>LAPORAN PENILAI PENGADIL</h1><strong>PERSATUAN BOLA SEPAK NEGERI PAHANG (PBNP)</strong></div>${logo(report.logo_kanan_data)}</header>
    <table><tr><td class="label">Kejohanan</td><td colspan="3">${esc(report.nama_kejohanan)}</td></tr>
      <tr><td class="label">Penilai Pengadil</td><td>${esc(report.nama_penilai || '-')}</td><td class="label">Negeri</td><td>${esc(report.penilai_negeri || '-')}</td></tr></table>
    <h2>MAKLUMAT PERLAWANAN</h2><table>
      <tr><td class="label">No. Perlawanan</td><td>${esc(report.no_perlawanan)}</td><td class="label">Tarikh</td><td>${esc(date(report.tarikh))}</td></tr>
      <tr><td class="label">Cuaca</td><td>${esc(report.cuaca || '-')}</td><td class="label">Masa</td><td>${esc(String(report.masa ?? '').slice(0,5))}</td></tr>
      <tr><td class="label">Tempat</td><td colspan="3">${esc(report.tempat || '-')}</td></tr></table>
    <table><colgroup><col style="width:40%"><col style="width:20%"><col style="width:40%"></colgroup>
      <tr><th>${report.logo_home_data ? logo(report.logo_home_data) : ''}${esc(report.pasukan_home)}</th><th>lwn</th><th>${report.logo_away_data ? logo(report.logo_away_data) : ''}${esc(report.pasukan_away)}</th></tr>
      <tr class="center"><td>${esc(score(halfHome))}</td><td>Separuh Masa Pertama</td><td>${esc(score(halfAway))}</td></tr>
      <tr class="center"><td>${esc(score(secondHome))}</td><td>Separuh Masa Kedua</td><td>${esc(score(secondAway))}</td></tr>
      <tr class="center"><td>${esc(score(extraHome))}</td><td>Masa Tambahan</td><td>${esc(score(extraAway))}</td></tr>
      <tr class="center"><td>${esc(score(report.skor_ps_home))}</td><td>Penentuan Penalti</td><td>${esc(score(report.skor_ps_away))}</td></tr>
      <tr class="center"><th>${esc(finalHome)}</th><th>Keputusan Akhir</th><th>${esc(finalAway)}</th></tr></table>
    <h2>PEGAWAI PERLAWANAN</h2><table><colgroup><col style="width:19%"><col style="width:36%"><col style="width:15%"><col style="width:20%"><col style="width:10%"></colgroup>
      <tr><th>Jawatan</th><th>Nama</th><th>Negeri</th><th>Tahap Kesukaran</th><th>Markah</th></tr>
      ${officials.map((official)=>`<tr><td>${esc(role(official.jawatan))}</td><td>${esc(official.nama_pengadil)}</td>
        <td>${esc(official.negeri || '-')}</td><td>${esc(difficulty(report.tahap_kesukaran))}</td><td>${esc(markah(official.markah))}</td></tr>`).join('')}
      <tr><td>Penilai Pengadil</td><td>${esc(report.nama_penilai || '-')}</td><td>${esc(report.penilai_negeri || '-')}</td><td colspan="2"></td></tr></table>
    <p><strong>Skala markah:</strong> 9.0–10 Cemerlang · 8.5–8.9 Sangat Baik · 8.3–8.4 Baik · 8.0–8.2 Memuaskan · 7.5–7.9 Perlu penambahbaikan · 6.0–7.4 Di bawah jangkaan</p>
    ${officials.map(officialSection).join('')}
    ${report.ulasan_keseluruhan ? `<h2>ULASAN KESELURUHAN TAMBAHAN</h2><div class="remarks">${paragraph(report.ulasan_keseluruhan)}</div>` : ''}
    ${comment ? `<h2>${esc(commentLabel)}</h2><div class="remarks">${paragraph(comment)}</div>` : ''}
    <footer>Tarikh sahkan: ${esc(date(report.tarikh_sahkan))}
      ${report.pengesah_nama ? `<br>Pengesah: ${esc(report.pengesah_nama)} (${esc(report.pengesah_jawatan || 'Pengerusi Pengadil')})` : ''}</footer>
    </main>${autoprint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),500))</script>' : ''}
    </body></html>`;
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
  return html(renderAssessmentReport({...safeReport,
    logo_kiri_data:logoKiri,logo_kanan_data:logoKanan,
    logo_home_data:logoHome,logo_away_data:logoAway,
  },officials.results,params.has('print')));
}
