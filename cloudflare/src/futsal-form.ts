import { currentUser } from './auth';
import type { Env } from './types';

interface FutsalApplication {
  tahun_permohonan: number | null;
  nama_penuh: string | null;
  no_ic: string | null;
  email: string | null;
  no_telefon: string | null;
  jantina: string | null;
  jenis_pengadil: string | null;
  tahun_mula_aktif: number | null;
  alamat1: string | null;
  alamat2: string | null;
  poskod: string | null;
  daerah: string | null;
  negeri: string | null;
  status_kerja: string | null;
  jawatan: string | null;
  nama_majikan: string | null;
  nama_waris: string | null;
  hubungan_waris: string | null;
  telefon_waris: string | null;
  saiz_baju: string | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g,(character)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[character] ?? character);
}

function html(body: string,status=200): Response {
  return new Response(body,{status,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  }});
}

function error(message: string,status: number): Response {
  return html(`<!doctype html><html lang="ms"><meta charset="utf-8"><title>Borang Futsal R3</title><p>${escapeHtml(message)}</p></html>`,status);
}

function field(label: string,value: unknown): string {
  return `<div class="row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`;
}

function signature(label: string): string {
  return `<div class="signature"><div class="signature-box"></div><p>${escapeHtml(label)}</p><p>Tarikh: ________________</p></div>`;
}

/** The PHP R3 route returned HTML under a PDF header. Render the form as a real PDF. */
export function renderFutsalForm(row: FutsalApplication, forPdf = false): string {
  const year = Number(row.tahun_permohonan) || new Date().getFullYear();
  const work = row.status_kerja !== 'Tidak Bekerja' && row.status_kerja !== 'Pelajar'
    ? field('Jawatan:',row.jawatan)+field('Nama Majikan:',row.nama_majikan) : '';
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Borang Pendaftaran Pengadil Futsal R3 · ${escapeHtml(year)}</title>
  <style>*{box-sizing:border-box}body{max-width:900px;margin:24px auto;padding:0 18px;font:14px/1.45 Arial,sans-serif;color:#111}
  header{text-align:center;margin:20px 0 28px}h1{font-size:20px;margin:0}h2{font-size:17px;margin:6px 0}h3{font-size:15px;border-bottom:2px solid #111;padding-bottom:5px}
  section{margin:20px 0;break-inside:avoid}.row{display:flex;gap:12px;margin:8px 0;align-items:flex-start}.row strong{width:190px;flex:none}.row span{flex:1;min-width:0;border-bottom:1px solid #111;padding:3px 0;overflow-wrap:anywhere}
  .signatures{display:flex;gap:28px}.signature{flex:1}.signature-box{border:1px solid #111;min-height:92px;margin-top:20px}.declaration{font-size:12px}.declaration li{margin:7px 0}
  button{position:fixed;right:20px;top:20px;border:0;border-radius:6px;background:#1d4ed8;color:#fff;padding:12px 18px;cursor:pointer}
  @media print{@page{size:A4;margin:15mm}body{margin:0;padding:0}button{display:none}section{break-inside:avoid}}</style>
  ${forPdf ? '' : "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500))</script>"}</head><body>
  ${forPdf ? '' : '<button type="button" onclick="window.print()">Cetak / Simpan PDF</button>'}
  <header><h1>PERSATUAN BOLASEPAK NEGERI PAHANG</h1><h2>BORANG PENDAFTARAN PENGADIL FUTSAL (R3)</h2><p>Tahun: ${escapeHtml(year)}</p></header>
  <section><h3>Maklumat Peribadi</h3>
    ${field('Nama Penuh:',row.nama_penuh)}${field('No. Kad Pengenalan:',row.no_ic)}
    ${field('Emel:',row.email)}${field('No. Telefon:',row.no_telefon)}
    ${field('Jantina:',row.jantina)}${field('Jenis Pengadil:',row.jenis_pengadil || 'Pengadil Futsal')}
    ${field('Tahun Mula Aktif:',row.tahun_mula_aktif)}</section>
  <section><h3>Alamat Kediaman</h3>${field('Alamat 1:',row.alamat1)}${field('Alamat 2:',row.alamat2)}
    ${field('Poskod:',row.poskod)}${field('Daerah:',row.daerah)}${field('Negeri:',row.negeri)}</section>
  <section><h3>Maklumat Pekerjaan</h3>${field('Status Pekerjaan:',row.status_kerja)}${work}</section>
  <section><h3>Waris Terdekat</h3>${field('Nama Waris:',row.nama_waris)}
    ${field('Hubungan:',row.hubungan_waris)}${field('No. Telefon Waris:',row.telefon_waris)}</section>
  <section><h3>Maklumat Pengadil Futsal</h3>${field('Saiz Baju Rasmi:',row.saiz_baju)}</section>
  <section><h3>Tandatangan</h3><p>Saya mengesahkan bahawa semua maklumat di atas adalah benar dan tepat.</p>
    <div class="signatures">${signature('Tandatangan Pemohon')}${signature('Tandatangan Pegawai Pembangunan Daerah')}</div></section>
  <section class="declaration"><h3>Perakuan</h3><ol>
    <li>Saya mengesahkan bahawa semua maklumat pengadil futsal adalah benar dan tepat.</li>
    <li>Saya faham bahawa sebarang maklumat palsu boleh menyebabkan permohonan pengadil futsal dibatalkan.</li>
    <li>Pengadil telah membuat bayaran sebanyak RM80.00 dan resit telah dimuat naik.</li>
  </ol></section></body></html>`;
}

export async function futsalForm(request: Request,env: Env): Promise<Response> {
  if (request.method !== 'GET') return error('Kaedah tidak dibenarkan.',405);
  const user = await currentUser(request,env);
  if (!user || !['Pengadil','PP Daerah','Admin'].includes(user.role)) {
    return error('Akses ditolak',403);
  }
  const application = await env.DB.prepare(`
    SELECT p.tahun_permohonan,u.nama_penuh,u.no_ic,u.email,u.no_telefon,u.jantina,
      u.jenis_pengadil,u.tahun_mula_aktif,u.alamat1,u.alamat2,u.poskod,u.daerah,
      u.negeri,u.status_kerja,u.jawatan,u.nama_majikan,u.nama_waris,
      u.hubungan_waris,u.telefon_waris,u.saiz_baju
    FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.user_id=? AND p.jenis_borang='pengadil_futsal'
      AND lower(p.status)='approved'
    ORDER BY p.tarikh_hantar DESC,p.id DESC LIMIT 1
  `).bind(user.id).first<FutsalApplication>();
  if (!application) return error('Permohonan pengadil futsal belum diluluskan atau tidak wujud',403);
  let rendered: Response;
  try {
    rendered = await env.BROWSER.quickAction('pdf',{
      html: renderFutsalForm(application,true),cacheTTL:0,
      pdfOptions:{format:'a4',printBackground:true,preferCSSPageSize:true},
    });
  } catch {
    return error('PDF belum dapat dijana. Sila cuba semula.',503);
  }
  if (!rendered.ok || !rendered.headers.get('Content-Type')?.includes('application/pdf')) {
    return error('PDF belum dapat dijana. Sila cuba semula.',503);
  }
  const date = new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',
  }).format(new Date());
  return new Response(rendered.body,{status:200,headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':`attachment; filename="Borang_Pendaftaran_Pengadil_Futsal_R3_${date}.pdf"`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  }});
}
