import { currentUser } from './auth';
import { scheduleReport } from './schedule-report';
import type { Env } from './types';

type Row = Record<string, unknown>;

interface ScheduleDocument {
  error: false;
  kejohanan: Row;
  region_label: string;
  pengesahan: Row | null;
  jadual: Array<Row & { assignments: Record<string, Row | null> }>;
  stats: Row;
  source_label?: string;
}

const positions = [
  ['Pengadil', 'R'],
  ['Penolong Pengadil 1', 'AR1'],
  ['Penolong Pengadil 2', 'AR2'],
  ['Pegawai ke4', 'P4'],
  ['Penilai Pengadil', 'RA'],
] as const;

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function date(value: unknown): string {
  const text = String(value ?? '');
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
}

function dateTime(value: unknown): string {
  const text = String(value ?? '');
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : '-';
}

function localLogo(value: unknown): string {
  const path = String(value ?? '');
  return /^\/uploads\/[A-Za-z0-9_./-]+$/.test(path) && !path.split('/').includes('..') ? path : '';
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  });
}

function errorPage(message: string, status: number): Response {
  return htmlResponse(`<!doctype html><html lang="ms"><meta charset="utf-8"><title>Jadual Lantikan</title><p style="font-family:Arial,sans-serif;padding:20px">${esc(message)}</p></html>`, status);
}

function appointmentCell(assignment: Row | null | undefined, regionLabel: string): string {
  if (!assignment) return '<td class="empty">—</td>';
  const status = String(assignment.status_lantikan ?? '');
  const statusClass = status === 'Diterima' ? 'accepted' : status === 'Ditolak' ? 'rejected' : 'pending';
  return `<td class="official"><strong>${esc(assignment.nama_penuh)}</strong><br>
    <span class="chip ${statusClass}">${esc(status)}</span>${assignment.jenis_sumber === 'Luar' ? ' <span class="chip outside">Luar</span>' : ''}
    <small>${esc(assignment.jenis_pengadil)}<br>${esc(regionLabel)}: ${esc(assignment.wilayah)}</small></td>`;
}

export function renderScheduleDocument(document: ScheduleDocument, printedBy: string): string {
  const tournament = document.kejohanan;
  const confirmation = document.pengesahan;
  const stats = document.stats;
  const generated = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());
  const logoLeft = localLogo(tournament.logo_kiri);
  const logoRight = localLogo(tournament.logo_kanan);
  let currentCategory = '';
  const rows: string[] = [];
  for (const match of document.jadual) {
    const category = String(match.kategori ?? '').trim();
    if (category.toUpperCase() !== currentCategory) {
      currentCategory = category.toUpperCase();
      rows.push(`<tr class="category"><td colspan="11">Kategori ${esc(category || 'Lain-lain')}</td></tr>`);
    }
    const assignments = match.assignments ?? {};
    rows.push(`<tr>
      <td class="center"><strong>${esc(match.no_perlawanan)}</strong></td>
      <td class="center">${esc(date(match.tarikh))}<small>${esc(match.hari)}</small></td>
      <td class="center">${esc(String(match.masa ?? '').slice(0, 5))}</td>
      <td class="center">${esc(category)}<small>${esc(match.peringkat)} ${esc(match.kumpulan)}</small></td>
      <td><strong>${esc(match.pasukan_home)}</strong> <span class="muted">vs</span> <strong>${esc(match.pasukan_away)}</strong></td>
      <td class="center">${esc(match.tempat)}</td>
      ${positions.map(([position]) => appointmentCell(assignments[position], document.region_label)).join('')}
    </tr>`);
  }
  if (rows.length === 0) rows.push('<tr><td colspan="11" class="center empty">Tiada perlawanan dalam jadual.</td></tr>');
  const verification = confirmation
    ? `<div class="approval-grid"><div><label>NAMA KETUA PENGADIL / PEGAWAI BERTANGGUNGJAWAB</label>
         <strong>${esc(confirmation.nama_penyahkan)}</strong><div class="signature">Tandatangan / Signature</div></div>
       <div><label>JAWATAN</label><strong>${esc(confirmation.jawatan_penyahkan)}</strong>
         <label>TARIKH PENGESAHAN</label>${esc(dateTime(confirmation.tarikh_sahkan))}</div>
       <div>${confirmation.nota ? `<label>NOTA</label>${esc(confirmation.nota)}` : ''}</div></div>
       <div class="verify"><strong>KOD VERIFIKASI DOKUMEN</strong><br><b class="code">${esc(confirmation.kod_verifikasi)}</b><br>
       Dokumen ini dijana secara digital oleh Sistem Pengurusan Pengadil Pahang (SPPP) pada ${esc(generated)}.
       Kod verifikasi adalah unik kepada kejohanan dan tarikh pengesahan.</div>`
    : `<div class="approval-grid"><div><label>NAMA KETUA PENGADIL / PEGAWAI BERTANGGUNGJAWAB</label>
         <div class="signature">Tandatangan / Signature</div></div>
       <div><label>TARIKH / Date</label><div class="signature">&nbsp;</div></div>
       <div><label>COP RASMI / Official Stamp</label><div class="stamp"></div></div></div>
       <div class="verify muted">Jadual ini belum disahkan secara digital. Sahkan jadual lantikan untuk mendapatkan kod verifikasi.</div>`;
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Jadual Lantikan – ${esc(tournament.nama)}</title>
    <style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#111;margin:0;padding:20px}
      .toolbar{display:flex;align-items:center;gap:10px;background:#1a1a1a;color:#ffd700;padding:10px 16px;border-radius:8px;margin-bottom:20px}
      .toolbar h2{font-size:13pt;flex:1;margin:0}.toolbar button{border:0;border-radius:5px;padding:7px 16px;font-weight:bold;cursor:pointer}
      .toolbar .print{background:#ffd700;color:#111}.toolbar .close{background:#555;color:#fff}
      header{display:flex;align-items:center;justify-content:center;gap:12px;border-bottom:2.5px solid #111;padding-bottom:10px;margin-bottom:14px;text-align:center}
      header img{width:60px;height:60px;object-fit:contain}header h1{font-size:15pt;text-transform:uppercase;letter-spacing:1px;margin:2px 0}header p{margin:2px 0}
      .stats{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}.stat{flex:1;min-width:100px;border:1px solid #ccc;border-radius:5px;padding:6px 10px;text-align:center}
      .stat b{font-size:16pt;display:block}.stat small{font-size:7.5pt;color:#555}.green b{color:#15803d}.amber b{color:#b45309}.blue b{color:#1d4ed8}
      table{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:14px;table-layout:fixed}th{background:#1a1a1a;color:#ffd700;border:1px solid #333;padding:5px 4px}
      td{border:1px solid #ccc;padding:4px;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f9f9f9}
      .category td{background:#1a1a1a;color:#ffd700;font-weight:bold;padding:5px 8px;text-transform:uppercase}.center{text-align:center}.muted{color:#777}
      .official{font-size:7.5pt}.official small,td small{display:block;font-size:6.5pt;color:#555;margin-top:2px}.empty{color:#aaa;text-align:center}
      .chip{display:inline-block;padding:1px 4px;border-radius:3px;font-size:6.5pt;font-weight:bold}.accepted{background:#dcfce7;color:#15803d}
      .rejected{background:#fee2e2;color:#dc2626}.pending{background:#fef9c3;color:#854d0e}.outside{background:#fef3c7;color:#92400e}
      .approval{border:1.5px solid #111;border-radius:6px;padding:14px 18px;margin-bottom:14px;break-inside:avoid}.approval h3{font-size:10pt;border-bottom:1px solid #ccc;padding-bottom:6px;margin:0 0 10px}
      .approval-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:12px}.approval-grid label{display:block;font-size:7.5pt;color:#555;margin:0 0 3px}
      .approval-grid strong{display:block;margin-bottom:6px}.signature{border-top:1.5px solid #111;margin-top:30px;padding-top:4px;font-size:7.5pt;color:#444}
      .stamp{border:1.5px dashed #bbb;height:55px;margin-top:8px}.verify{border:1px dashed #aaa;border-radius:4px;padding:8px 12px;font-size:7.5pt;color:#555}
      .code{font-family:monospace;font-size:11pt;letter-spacing:2px;color:#111}footer{text-align:right;border-top:1px solid #ddd;padding-top:6px;font-size:7pt;color:#888}
      @media print{@page{size:A4 landscape;margin:1.5cm 1.2cm}body{padding:0;font-size:8pt}.toolbar{display:none}tr{break-inside:avoid}table{font-size:7.5pt}}
    </style></head><body>
    <div class="toolbar"><h2>Jadual Lantikan Pengadil</h2><button class="print" onclick="window.print()">Cetak / Simpan PDF</button><button class="close" onclick="window.close()">Tutup</button></div>
    <header>${logoLeft ? `<img src="${esc(logoLeft)}" alt="Logo kiri">` : ''}<div><p>JAWATANKUASA PENGADIL</p>
      <h1>Jadual Lantikan Pengadil Kejohanan</h1><strong>${esc(tournament.nama)}</strong>
      <p>${esc(date(tournament.tarikh_mula))} – ${esc(date(tournament.tarikh_akhir))}${tournament.tempat ? ` · ${esc(tournament.tempat)}` : ''}</p></div>
      ${logoRight ? `<img src="${esc(logoRight)}" alt="Logo kanan">` : ''}</header>
    ${document.source_label ? `<p><strong>Paparan: ${esc(document.source_label)}</strong></p>` : ''}
    <div class="stats">
      ${[['Jumlah Perlawanan', stats.total_perlawanan, ''], ['Lantikan Lengkap', stats.lantikan_lengkap, 'green'],
        ['Belum / Separa', Number(stats.total_perlawanan) - Number(stats.lantikan_lengkap), 'amber'],
        ['Jumlah Lantikan', stats.jumlah_lantikan, 'blue'], ['Diterima', stats.jumlah_terima, 'green'],
        ['Kadar Terima', `${stats.kadar_terima}%`, '']]
        .map(([label, value, style]) => `<div class="stat ${style}"><b>${esc(value)}</b><small>${esc(label)}</small></div>`).join('')}
    </div>
    <table><colgroup><col style="width:5%"><col style="width:8%"><col style="width:5%"><col style="width:8%"><col style="width:16%"><col style="width:6%">
      ${positions.map(() => '<col style="width:10.4%">').join('')}</colgroup>
      <thead><tr><th>No. Perl.</th><th>Tarikh</th><th>Masa</th><th>Kategori</th><th>Pasukan</th><th>Tempat</th>
      ${positions.map(([, short]) => `<th>${short}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>
    <section class="approval"><h3>Pengesahan &amp; Tandatangan</h3>${verification}</section>
    <footer>Dicetak oleh: ${esc(printedBy)} · Tarikh cetak: ${esc(generated)} · Sistem Pengurusan Pengadil Pahang (SPPP)</footer>
    </body></html>`;
}

export async function printSchedule(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return errorPage('Kaedah tidak dibenarkan.', 405);
  const user = await currentUser(request, env);
  if (!user || !['Admin','PP Daerah'].includes(user.role)) return errorPage('Akses tidak dibenarkan. Sila log masuk sebagai Admin terlebih dahulu.', 403);
  const result = await scheduleReport(request, env);
  if (!result.ok) {
    const failure = await result.json() as { message?: string };
    return errorPage(failure.message ?? 'Ralat memuat jadual lantikan.', result.status);
  }
  return htmlResponse(renderScheduleDocument(await result.json() as ScheduleDocument, user.nama_penuh || user.email));
}
