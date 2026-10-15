import { currentUser } from './auth';
import type { Env } from './types';

type Application = {
  nama_penuh: string | null;
  no_kp: string | null;
  no_telefon: string | null;
  nama_waris: string | null;
  hubungan_waris: string | null;
  telefon_waris: string | null;
  tahun_permohonan: number | null;
};

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  });
}

function error(message: string, status: number): Response {
  return html(`<!doctype html><html lang="ms"><meta charset="utf-8"><title>Borang Ujian Kecergasan</title><p style="font-family:Arial,sans-serif;padding:20px">${esc(message)}</p></html>`, status);
}

function field(label: string, value: unknown): string {
  return `<div class="form-row"><div class="form-label">${esc(label)}</div><div class="form-value">${esc(value)}</div></div>`;
}

function declaration(label: string, text: string): string {
  return `<div class="declaration-item"><span class="checkbox" aria-hidden="true"></span><strong>${esc(label)}:</strong> ${esc(text)}</div>`;
}

function signature(label: string): string {
  return `<div class="signature"><div class="signature-box"></div><p>${esc(label)}</p><p>Tarikh: ________________</p></div>`;
}

export function renderFitnessForm(application: Application): string {
  const year = Number(application.tahun_permohonan) || new Date().getFullYear();
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Borang Ujian Kecergasan R4 - ${esc(application.nama_penuh)}</title>
    <style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:20px;color:#111;line-height:1.45}
      .header{text-align:center;margin-bottom:30px}.header h1{font-size:20px;margin-bottom:6px}.header h2{font-size:17px;margin-top:0}
      .form-section{margin-bottom:20px;break-inside:avoid}.form-row{display:flex;margin-bottom:10px;align-items:flex-start;gap:10px}
      .form-label{width:200px;flex:none;font-weight:bold}.form-value{flex:1;min-width:0;border-bottom:1px solid #000;padding:5px;overflow-wrap:anywhere}
      .declaration{margin-top:30px;font-size:12px}.declaration-item{margin-bottom:15px;break-inside:avoid}
      .checkbox{display:inline-block;width:20px;height:20px;border:1px solid #000;margin-right:10px;vertical-align:middle}
      .signature-section{margin-top:50px;break-inside:avoid}.signature-grid{display:flex;justify-content:space-between;gap:18px;margin-top:50px}
      .signature{flex:1;min-width:0}.signature-box{border:1px solid #000;min-height:100px;margin-top:20px}.signature p{margin:10px 0}
      .print-button{position:fixed;top:20px;right:20px;padding:15px 30px;background:#2563eb;color:#fff;border:0;border-radius:8px;cursor:pointer;font-weight:bold}
      @media print{@page{size:A4;margin:1cm}body{margin:0}.no-print{display:none}.signature-section{break-inside:avoid}}
    </style><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500))</script></head><body>
    <button type="button" class="print-button no-print" onclick="window.print()">Cetak / Simpan PDF</button>
    <div class="header"><h1>PERSATUAN BOLASEPAK NEGERI PAHANG</h1>
      <h2>BORANG PERMOHONAN UJIAN KECERGASAN (R4)</h2><p>Tahun: ${esc(year)}</p></div>
    <section class="form-section"><h3>Maklumat Peribadi</h3>
      ${field('Nama Penuh:', application.nama_penuh)}
      ${field('No. Kad Pengenalan:', application.no_kp)}
      ${field('No. Telefon:', application.no_telefon)}
    </section>
    <section class="form-section"><h3>Waris Terdekat</h3>
      ${field('Nama Waris:', application.nama_waris)}
      ${field('Hubungan:', application.hubungan_waris)}
      ${field('No. Telefon Waris:', application.telefon_waris)}
    </section>
    <section class="declaration"><h3>DEKLARASI KESIHATAN DAN PELEPASAN TANGGUNGAN (INDEMNITI) PENGADIL</h3>
      <p>Saya seperti nama di atas, dengan ini secara sukarela bersetuju untuk mengambil bahagian dalam Ujian Kecergasan Fizikal anjuran Persatuan Bolasepak Negeri Pahang (PBNP). Keputusan lulus ujian ini menentukan kelayakan saya untuk menerima patch dan lesen Pengadil Negeri bagi musim ${esc(year)}.</p>
      ${declaration('Status Kesihatan', 'Saya berada dalam keadaan kesihatan fizikal dan mental yang baik. Saya tidak menghidap sebarang penyakit kronik, kecederaan, atau masalah perubatan yang boleh memudaratkan diri saya jika melakukan aktiviti fizikal berintensiti tinggi.')}
      ${declaration('Pemeriksaan Perubatan', 'Saya telah menjalani pemeriksaan kesihatan/perubatan dan disahkan "Lulus" atau "Fit to Participate" oleh Pegawai Perubatan bertauliah untuk menyertai ujian ini.')}
      ${declaration('Risiko', 'Saya sedar dan memahami bahawa ujian kecergasan ini melibatkan aktiviti fizikal yang berat dan mempunyai risiko kecederaan atau kejadian yang tidak diingini.')}
      ${declaration('Pelepasan Tanggungan', 'Saya dan waris/keluarga saya bersetuju untuk TIDAK AKAN mengambil sebarang tindakan undang-undang atau membuat sebarang tuntutan terhadap Persatuan Bolasepak Negeri Pahang (PBNP), pegawai bertugas, atau wakil mereka sekiranya berlaku sebarang kecederaan, kemalangan, kehilangan upaya, atau kematian ke atas diri saya semasa atau selepas ujian ini dijalankan, yang berpunca daripada penyertaan saya.')}
      ${declaration('Kebenaran Rawatan', 'Saya membenarkan pihak penganjur untuk memberikan bantuan kecemasan awal sekiranya perlu.')}
    </section>
    <section class="signature-section"><h3>Tandatangan</h3><div class="signature-grid">
      ${signature('Tandatangan Pemohon')}${signature('Tandatangan Saksi')}${signature('Tandatangan Doktor')}
    </div></section>
    <p style="margin-top:50px;text-align:center;font-size:12px;color:#666">Nota: Sila bawa borang ini yang telah ditandatangani ke ujian kecergasan</p>
    </body></html>`;
}

export async function fitnessForm(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return error('Kaedah tidak dibenarkan.', 405);
  const user = await currentUser(request, env);
  if (!user || user.role !== 'Pengadil') return error('Akses ditolak - hanya Pengadil sahaja', 403);
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return error('ID permohonan diperlukan', 400);
  }
  const application = await env.DB.prepare(`
    SELECT nama_penuh,no_kp,no_telefon,nama_waris,hubungan_waris,telefon_waris,tahun_permohonan
    FROM permohonan WHERE id=? AND user_id=? AND jenis_borang='ujian_kecergasan' LIMIT 1
  `).bind(Number(id), user.id).first<Application>();
  if (!application) return error('Permohonan tidak dijumpai', 404);
  return html(renderFitnessForm(application));
}
