import type {Env} from './types';
import {confirmChairReport} from './chair-confirm-core';

type State=Record<string,unknown> & {
  laporan_id:number;status:string;laporan_status:string;
};

function esc(value:unknown):string {
  return String(value ?? '').replace(/[&<>"']/g,(character)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[character] ?? character);
}
function page(title:string,content:string,status=200,form=false):Response {
  return new Response(`<!doctype html><html lang="ms"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
    <style>*{box-sizing:border-box}body{margin:0;background:#e8eaed;color:#111827;font-family:Arial,sans-serif;padding:24px}
    .card{max-width:620px;margin:20px auto;background:#fff;box-shadow:0 2px 12px #0f172a24}
    .bar{height:7px;background:#f59e0b}.head{background:#111827;color:#fff;text-align:center;padding:27px 24px}
    .head strong{display:block;font-size:15px}.head span{display:block;margin-top:5px;color:#9ca3af;font-size:11px;letter-spacing:2px}
    .body{padding:30px}.body h1{font-size:22px;margin:0 0 8px}.muted{color:#6b7280;font-size:13px;line-height:1.6}
    .info{width:100%;border-collapse:collapse;margin:22px 0;font-size:13px}.info td{padding:9px;border-bottom:1px solid #e5e7eb;vertical-align:top;overflow-wrap:anywhere}
    .info td:first-child{width:34%;color:#64748b;font-weight:600}.button{display:inline-block;border-radius:5px;background:#e2e8f0;color:#0f172a;padding:12px 18px;font-weight:700;text-decoration:none;font-size:13px}
    .notice{border-left:4px solid #f59e0b;background:#fffbeb;padding:12px 14px;margin:18px 0;color:#854d0e;font-size:13px;line-height:1.55}
    textarea{width:100%;min-height:110px;border:1px solid #cbd5e1;border-radius:5px;padding:10px;font:inherit;resize:vertical}
    label{display:block;font-size:13px;font-weight:700;margin:18px 0 7px}
    button{background:#059669;color:white;border:0;border-radius:5px;padding:12px 18px;font-weight:700;cursor:pointer;margin-top:16px}
    .error{border-color:#ef4444;background:#fef2f2;color:#991b1b}.foot{background:#111827;color:#9ca3af;text-align:center;padding:16px;font-size:11px}
    </style></head><body><main class="card"><div class="bar"></div>
    <header class="head"><strong>PERSATUAN BOLA SEPAK NEGERI PAHANG</strong><span>SISTEM PENGURUSAN PENGADIL</span></header>
    <section class="body">${content}</section><footer class="foot">Persatuan Bola Sepak Negeri Pahang</footer>
    </main></body></html>`,{status,headers:{
      'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'Content-Security-Policy':`default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action '${form?'self':'none'}'`,
    }});
}
function date(raw:unknown):string {
  const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw ?? ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
}

async function formFields(request:Request):Promise<URLSearchParams|null> {
  if (request.headers.get('Content-Type')?.split(';')[0]!=='application/x-www-form-urlencoded') return null;
  const reader=request.body?.getReader();
  if (!reader) return null;
  const chunks:Uint8Array[]=[];
  let length=0;
  while (true) {
    const part=await reader.read();
    if (part.done) break;
    length+=part.value.byteLength;
    if (length>24*1024) {await reader.cancel();return null;}
    chunks.push(part.value);
  }
  const bytes=new Uint8Array(length);let offset=0;
  for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try {return new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch {return null;}
}

/** Purpose-bound chair review and explicit, guarded confirmation. */
export async function chairApprovalLink(request:Request,env:Env):Promise<Response> {
  if (request.method!=='GET' && request.method!=='POST') return page('Kaedah Tidak Sah',
    '<h1>Kaedah Tidak Sah</h1><div class="notice error">Gunakan pautan asal.</div>',405);
  if (env.STAGING_AUTH_ENABLED!=='1') return page('Belum Tersedia',
    '<h1>Semakan belum tersedia</h1><div class="notice">Borang masih dalam proses migrasi.</div>',503);
  const canConfirm=env.STAGING_WRITES_ENABLED==='1' && env.REPORT_DELIVERY_ENABLED==='1';
  if (request.method==='POST' && !canConfirm) return page('Belum Tersedia',
    '<h1>Pengesahan belum tersedia</h1><div class="notice">Pengesahan laporan belum tersedia di staging.</div>',503);
  const params=request.method==='POST' ? await formFields(request) : new URL(request.url).searchParams;
  if (!params) return page('Permintaan Tidak Sah',
    '<h1>Permintaan Tidak Sah</h1><div class="notice error">Borang tidak sah atau terlalu besar.</div>',400);
  const token=params.get('token') ?? '';
  if (params.getAll('token').length!==1 || !/^[a-fA-F0-9]{64}$/.test(token)) {
    return page('Pautan Tidak Sah',
      '<h1>Pautan Tidak Sah</h1><div class="notice error">Pautan pengesahan ini tidak dapat dikenal pasti.</div>',404);
  }
  const state=await env.DB.prepare(`SELECT a.laporan_id,a.status,a.pengesah_nama,
    a.pengesah_jawatan,r.status AS laporan_status,jp.no_perlawanan,jp.tarikh,
    jp.masa,jp.tempat,jp.pasukan_home,jp.pasukan_away,k.nama AS nama_kejohanan,
    COALESCE(u.nama_penuh,pl.nama,'Penilai Pengadil') AS nama_penilai
    FROM laporan_pengesahan_pengerusi a
    JOIN laporan_penilaian r ON r.id=a.laporan_id
    JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id
    LEFT JOIN users u ON u.id=ra.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=ra.pengadil_luar_id
    WHERE a.approval_token=? LIMIT 1`).bind(token).first<State>();
  if (!state) return page('Pautan Tidak Sah',
    '<h1>Pautan Tidak Sah</h1><div class="notice error">Pautan pengesahan ini tidak dapat dikenal pasti.</div>',404);
  if (request.method==='POST') {
    if (params.getAll('catatan_pengerusi').length>1) return page('Komen Tidak Sah',
      '<h1>Komen Tidak Sah</h1><div class="notice error">Hantar satu komen sahaja.</div>',400);
    const comment=(params.get('catatan_pengerusi')??'').trim();
    if (Array.from(comment).length>5000) return page('Komen Terlalu Panjang',
      '<h1>Komen Terlalu Panjang</h1><div class="notice error">Komen mestilah tidak melebihi 5,000 aksara.</div>',422);
    if (state.status!=='Menunggu' || state.laporan_status!=='Dihantar') return page(
      'Laporan Telah Diproses','<h1>Laporan Telah Diproses</h1><div class="notice">Laporan ini telah diproses.</div>',409);
    const result=await confirmChairReport(env,token,comment,request);
    if (result!=='confirmed') return page('Laporan Telah Diproses',
      '<h1>Laporan Telah Diproses</h1><div class="notice">Laporan ini telah diproses atau tidak lengkap.</div>',409);
    return page('Laporan Disahkan',`<h1>Laporan Berjaya Disahkan</h1>
      <div class="notice">Pengesahan anda direkodkan. Pemakluman kepada KUP telah dijadualkan.</div>
      ${comment ? `<p class="muted"><strong>Komen direkodkan:</strong><br>${esc(comment).replaceAll('\n','<br>')}</p>` :
        '<p class="muted">Tiada komen tambahan direkodkan.</p>'}`);
  }
  if (state.status!=='Menunggu' || state.laporan_status!=='Dihantar') {
    const message=state.status==='Override Admin'
      ? 'Laporan ini telah disahkan melalui override Admin.'
      : 'Laporan ini telah disahkan sebelum ini.';
    return page('Laporan Telah Diproses',`<h1>Laporan Telah Diproses</h1><div class="notice">${esc(message)}</div>`);
  }
  const preview=`/api/download-laporan-penilaian.php?id=${Number(state.laporan_id)}&amp;approval_token=${esc(token)}`;
  const content=`<h1>Semak Laporan RA</h1>
    <p class="muted">Tuan/Puan ditetapkan sebagai <strong>${esc(state.pengesah_jawatan)}</strong>
    bagi kejohanan ini. Semak laporan penuh sebelum mengesahkan.</p>
    <table class="info"><tr><td>Pengerusi</td><td><strong>${esc(state.pengesah_nama)}</strong></td></tr>
    <tr><td>Kejohanan</td><td>${esc(state.nama_kejohanan)}</td></tr>
    <tr><td>Perlawanan</td><td><strong>${esc(state.pasukan_home)} lwn ${esc(state.pasukan_away)}</strong></td></tr>
    <tr><td>Tarikh / Masa</td><td>${esc(date(state.tarikh))} · ${esc(String(state.masa ?? '').slice(0,5))}</td></tr>
    <tr><td>Tempat</td><td>${esc(state.tempat || '-')}</td></tr>
    <tr><td>Penilai</td><td>${esc(state.nama_penilai)}</td></tr></table>
    <div class="notice">Membuka pautan ini tidak mengesahkan laporan. Semak semua markah dan ulasan dahulu.</div>
    <a class="button" href="${preview}" target="_blank" rel="noopener noreferrer">Lihat Laporan Penuh</a>
    ${canConfirm ? `<form method="post"><input type="hidden" name="token" value="${esc(token)}">
      <label for="catatan">Komen Pengerusi Pengadil (pilihan)</label>
      <textarea id="catatan" name="catatan_pengerusi" maxlength="5000"></textarea>
      <button type="submit">Sahkan Laporan</button></form>` :
      '<div class="notice">Fungsi pengesahan masih ditutup di staging.</div>'}`;
  return page('Pengesahan Laporan RA',content,200,canConfirm);
}
