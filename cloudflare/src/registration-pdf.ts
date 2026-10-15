import { currentUser, json } from './auth';
import type { SessionUser } from './auth';
import type { Env } from './types';

type Row = Record<string, string | number | null>;
type FormType = 'pengadil_berdaftar' | 'penilai_berdaftar' | 'kelas3_fam'
  | 'pengadil_futsal' | 'ujian_kecergasan' | 'ujian_bertulis' | 'ujian_kelas1';
type Match = { tarikh: string | null; jenis: string | null; tempat: string | null; jawatan: string | null };

const types: FormType[] = ['pengadil_berdaftar', 'penilai_berdaftar', 'kelas3_fam',
  'pengadil_futsal', 'ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1'];

function value(row: Row, key: string, fallback = ''): string {
  const raw = row[key];
  return raw === null || raw === undefined || raw === '' ? fallback : String(raw);
}

function esc(raw: unknown): string {
  return String(raw ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function upper(raw: unknown): string { return String(raw ?? '').toLocaleUpperCase('ms'); }

function address(row: Row, employer = false): string {
  const prefix = employer ? '_majikan' : '';
  return [value(row, employer ? 'alamat_majikan1' : 'alamat1'),
    value(row, employer ? 'alamat_majikan2' : 'alamat2'),
    [value(row, `poskod${prefix}`), value(row, `daerah${prefix}`)].filter(Boolean).join(' '),
    value(row, `negeri${prefix}`)].map(part => part.trim()).filter(Boolean).join(', ').toLocaleUpperCase('ms') || '-';
}

function section(title: string): string { return `<h3 class="section">${esc(title)}</h3>`; }

function row(...cells: Array<[string, unknown, number?]>): string {
  return `<div class="data-row">${cells.map(([label, data, width]) =>
    `<div class="data-cell" style="flex:${width ?? 1}"><strong>${esc(label)}</strong><span>${esc(data)}</span></div>`).join('')}</div>`;
}

function today(): string {
  return new Intl.DateTimeFormat('en-GB', {day:'2-digit',month:'2-digit',year:'numeric',
    timeZone:'Asia/Kuala_Lumpur'}).format(new Date());
}

function header(rowData: Row, code: string, title: string, logo: string, photo = ''): string {
  const year = value(rowData, 'tahun_permohonan', String(new Date().getFullYear()));
  const ref = `PBNP/${code}/${year}/${value(rowData, 'id', '0').padStart(4, '0')}`;
  const label = code === 'R1/RA' ? 'R1' : code;
  const rightMeta = code === 'R1/RA' || code === 'R1' ? `Sesi: ${year}` : `Tarikh: ${today()}`;
  return `<div class="form-code">${esc(code.startsWith('R11') ? 'Borang R11' : `Borang ${label}`)}</div>
    <div class="masthead"><div class="logo">${logo ? `<img src="${logo}" alt="">` : ''}</div>
      <div class="masthead-title"><strong>PERSATUAN BOLASEPAK NEGERI PAHANG</strong>
        <span>${title}</span></div>
      ${photo ? `<div class="photo"><img src="${photo}" alt=""></div>` : `<div class="photo">Gambar Pemohon</div>`}</div>
    <div class="meta"><span>No. Rujukan: ${esc(ref)}</span><span>${esc(rightMeta)}</span></div>`;
}

function r1(rowData: Row, logo: string, photo: string): string {
  const name = upper(value(rowData, 'nama_penuh'));
  const year = value(rowData, 'tahun_permohonan');
  const ic = value(rowData, 'no_kp').replaceAll('-', '');
  const phone = value(rowData, 'no_telefon').replace(/\s+/g, '').replace(/^\+60/, '0');
  const boxes = (digits: string, count: number) => Array.from({length: count}, (_, i) =>
    `<span class="digit">${esc(digits[i] ?? '')}</span>`).join('');
  return `<section class="form-page r1">${header(rowData, 'R1',
    'PERMOHONAN PENDAFTARAN TAHUNAN<br>PENGADIL NEGERI', logo, photo)}
    <p>Setiausaha Kehormat/Agung/Eksekutif<br>Persatuan Bolasepak Daerah <u>${esc(upper(value(rowData, 'district_nama')))}</u></p>
    ${section('PERIBADI')}
    <p>1. Saya memohon untuk menjadi Pengadil Berdaftar untuk Tahun <strong>${esc(year)}</strong></p>
    ${row(['2. Nama Penuh:', name])}
    <div class="digit-row">3. No Kad Pengenalan Baru: ${boxes(ic, 6)} – ${boxes(ic.slice(6), 2)} – ${boxes(ic.slice(8), 4)}</div>
    ${row(['4. Tahun Lulus Ujian Praktikal Pengadil Negeri:', value(rowData, 'tahun_lulus_kelas3')])}
    ${section('ALAMAT & TELEFON')}
    ${row(['Alamat Surat-Menyurat:', address(rowData)])}
    <div class="digit-row">Telefon Rumah ${boxes('', 9)}</div>
    <div class="digit-row">Pejabat ${boxes('', 9)}</div>
    <div class="digit-row">Bimbit ${boxes(phone.replace(/\D/g, ''), Math.max(10, phone.replace(/\D/g, '').length))}</div>
    ${section('LAIN-LAIN')}
    ${row(['1. Mula aktif sebagai Pengadil, Tahun:', value(rowData, 'tahun_mula_aktif')])}
    <p>2. Butir-butir perlawanan, saya sebagai pengadil pada tahun semasa seperti disenaraikan di Lampiran R2.</p>
    <div class="signatures"><div><div class="sign-line"></div>Nama pemohon: ${esc(name)}<br>Tarikh: ____________________</div>
      <div><div class="sign-line"></div>Nama PP Daerah: ${esc(upper(value(rowData, 'pp_daerah_nama')))}<br>Tarikh: ${today()}</div></div>
    <div class="approval"><strong>PERMOHONAN PENDAFTARAN TAHUNAN PENGADIL NEGERI</strong>
      <p>Saya akui Pengadil di atas aktif dalam pengadilan di peringkat negeri sepanjang tahun ${esc(year)} dan butir-butir perlawanan yang dinyatakan di Lampiran R2 adalah benar.</p>
      <p>Tarikh: ____________________ &nbsp;&nbsp;&nbsp; Tandatangan: ____________________</p>
      <small>Setiausaha Kehormat/Agung/Eksekutif Persatuan Bolasepak Negeri<br>Cop Rasmi PB Negeri</small></div>
    <small>* Sila potong yang tidak berkenaan</small></section>`;
}

function r1Penilai(rowData: Row, logo: string, photo: string): string {
  const year = value(rowData, 'tahun_permohonan');
  return `<section class="form-page">${header(rowData, 'R1/RA', 'PENDAFTARAN TAHUNAN<br>PENILAI PENGADIL', logo, photo)}
    ${section('MAKLUMAT PEMOHON')}
    ${row(['Nama Penuh:', upper(value(rowData, 'nama_penuh'))])}
    ${row(['No. KP:', value(rowData, 'no_kp')], ['No. Telefon:', value(rowData, 'no_telefon')])}
    ${row(['Alamat Emel:', value(rowData, 'emel')])}
    ${row(['Daerah:', upper(value(rowData, 'district_nama', value(rowData, 'daerah')))], ['Jenis:', 'PENILAI PENGADIL'])}
    ${row(['Alamat:', address(rowData)])}
    ${section('MAKLUMAT PEKERJAAN')}
    ${row(['Status Kerja:', upper(value(rowData, 'status_kerja', '-'))], ['Jawatan:', upper(value(rowData, 'jawatan', '-'))])}
    ${row(['Majikan:', upper(value(rowData, 'nama_majikan', '-'))])}
    ${row(['Alamat Majikan:', address(rowData, true)])}
    ${section('MAKLUMAT WARIS')}
    ${row(['Nama Waris:', upper(value(rowData, 'nama_waris', '-'))], ['Hubungan:', upper(value(rowData, 'hubungan_waris', '-'))])}
    ${row(['Telefon Waris:', value(rowData, 'telefon_waris', '-')])}
    <div class="keep-together">${section('PERAKUAN PEMOHON')}
      <div class="declaration">Saya memohon pendaftaran tahunan sebagai Penilai Pengadil bagi sesi ${esc(year)}. Saya mengesahkan maklumat yang diberikan adalah benar dan bersetuju mematuhi peraturan serta etika pengadilan PBNP.</div>
      <div class="signatures"><div>Tandatangan Pemohon: ______________________<p>Pengesahan PP Daerah: _____________________</p></div>
        <div>Tarikh: ____________________<p>Tarikh: ____________________</p></div></div>
      ${value(rowData, 'pp_daerah_nama') ? `<p>Nama PP Daerah: ${esc(upper(value(rowData, 'pp_daerah_nama')))}</p>` : ''}
    </div></section>`;
}

function r2(rowData: Row, matches: Match[], logo: string): string {
  const year = value(rowData, 'tahun_permohonan');
  const maxJob = matches.reduce((longest, match) => Math.max(longest, (match.jawatan ?? '').length), 0);
  const jobWidth = Math.min(27, Math.max(19, Math.ceil(maxJob * 1.25) + 3));
  const tableRows = matches.map(match => {
    const parts = (match.tarikh ?? '').slice(0, 10).split('-');
    const when = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : '-';
    return `<tr><td>${esc(when)}</td><td>${esc(upper(match.jenis || '-'))}</td><td>${esc(upper(match.tempat || '-'))}</td><td>${esc(upper(match.jawatan || '-'))}</td></tr>`;
  }).join('');
  return `<section class="form-page r2">${header(rowData, 'R2', 'SENARAI PERLAWANAN PENGADIL', logo)}
    ${section('MAKLUMAT PENGADIL')}
    ${row(['Nama Penuh:', upper(value(rowData, 'nama_penuh'))], ['No. KP:', value(rowData, 'no_kp')])}
    ${row(['Jenis Pengadil:', upper(value(rowData, 'jenis_pengadil', 'Pengadil'))], ['Tahun Mula Aktif:', value(rowData, 'tahun_mula_aktif')])}
    ${section('SENARAI PERLAWANAN')}
    ${matches.length ? `<table class="matches"><colgroup><col style="width:15%"><col><col style="width:18%"><col style="width:${jobWidth}%"></colgroup>
      <thead><tr><th>Tarikh</th><th>Jenis Perlawanan</th><th>Tempat</th><th>Jawatan</th></tr></thead>
      <tbody>${tableRows}</tbody></table><p><strong>Jumlah Perlawanan: ${matches.length}</strong></p>`
      : '<p>Tiada rekod perlawanan dijumpai.</p>'}</section>
    <section class="form-page r2-confirm">${section('PENGESAHAN')}
      <p>Saya akui Pengadil di atas aktif dalam pengadilan di peringkat negeri sepanjang tahun ${esc(year)} dan butir-butir perlawanan yang dinyatakan di atas adalah benar.</p>
      <div class="signature-box">Tandatangan Pengerusi Pembangunan Pengadil: Daerah ${esc(upper(value(rowData, 'district_nama')))}</div>
      <div class="signature-name">Nama: ${esc(upper(value(rowData, 'pp_daerah_nama', '...........................................')))}</div>
      <small>Borang ini adalah untuk kegunaan rasmi Unit Pengadil Persatuan Bolasepak Negeri Pahang sahaja.</small>
    </section>`;
}

const healthDeclarations = [
  (year: string) => `Saya seperti nama di atas, dengan ini secara sukarela bersetuju untuk mengambil bahagian dalam Ujian Kecergasan Fizikal anjuran Persatuan Bolasepak Negeri Pahang (PBNP) bagi melayakkan saya berdaftar dan bergiat aktif sebagai Pengadil Bolasepak untuk musim ${year}.`,
  () => 'Saya berada dalam keadaan kesihatan fizikal dan mental yang baik. Saya tidak menghidap sebarang penyakit kronik, kecederaan, atau masalah perubatan yang boleh memudaratkan diri saya jika melakukan aktiviti fizikal berintensiti tinggi.',
  () => 'Saya telah menjalani pemeriksaan kesihatan/perubatan dan disahkan "Lulus" atau "Fit to Participate" oleh Pegawai Perubatan bertauliah untuk menyertai ujian ini.',
  () => 'Saya sedar dan memahami bahawa ujian kecergasan ini melibatkan aktiviti fizikal yang berat dan mempunyai risiko kecederaan atau kejadian yang tidak diingini.',
  () => 'Saya dan waris/keluarga saya bersetuju untuk TIDAK AKAN mengambil sebarang tindakan undang-undang atau membuat sebarang tuntutan terhadap Persatuan Bolasepak Negeri Pahang (PBNP), pegawai bertugas, atau wakil mereka sekiranya berlaku sebarang kecederaan, kemalangan, kehilangan upaya, atau kematian ke atas diri saya semasa atau selepas ujian ini dijalankan, yang berpunca daripada penyertaan saya.',
  () => 'Saya membenarkan pihak penganjur untuk memberikan bantuan kecemasan awal sekiranya perlu.',
];

function r4(rowData: Row, logo: string): string {
  const year = value(rowData, 'tahun_permohonan', String(new Date().getFullYear()));
  return `<section class="form-page r4">${header(rowData, 'R4', 'BORANG UJIAN KECERGASAN PENGADIL', logo)}
    ${section('MAKLUMAT PERIBADI')}
    ${row(['Nama Penuh:', upper(value(rowData, 'nama_penuh'))], ['No. KP:', value(rowData, 'no_kp')])}
    ${row(['Alamat Emel:', upper(value(rowData, 'emel', value(rowData, 'user_email')))], ['No. Telefon:', value(rowData, 'no_telefon')])}
    ${row(['Jantina:', upper(value(rowData, 'jantina', '-'))], ['Jenis Pengadil:', upper(value(rowData, 'jenis_pengadil', 'Pengadil'))])}
    ${row(['Alamat:', address(rowData)])}
    ${section('MAKLUMAT TEMPAT KERJA')}
    ${row(['Status Kerja:', upper(value(rowData, 'status_kerja', 'TIADA'))], ['Jawatan:', upper(value(rowData, 'jawatan', 'TIADA'))])}
    ${row(['Nama Majikan:', upper(value(rowData, 'nama_majikan', 'TIADA'))])}
    ${row(['Alamat Majikan:', address(rowData, true)])}
    ${section('MAKLUMAT WARIS TERDEKAT')}
    ${row(['Nama Waris:', upper(value(rowData, 'nama_waris'))], ['Hubungan:', upper(value(rowData, 'hubungan_waris'))])}
    ${row(['No. Telefon Waris:', value(rowData, 'telefon_waris')])}
    <div class="keep-together">${section('PERAKUAN KESIHATAN DAN PELEPASAN TANGGUNGAN (INDEMNITI)')}
      ${healthDeclarations.map(declaration => `<div class="declaration">☐ ${esc(declaration(year))}</div>`).join('')}
      <div class="signatures"><div>Tandatangan Pemohon<div class="sign-line"></div>Nama: ${esc(upper(value(rowData, 'nama_penuh')))}<br>Mykad: ${esc(value(rowData, 'no_kp'))}</div>
        <div>Tarikh: ____________________</div></div>
      <small>Borang ini adalah untuk kegunaan rasmi Unit Pengadil Persatuan Bolasepak Negeri Pahang sahaja.</small>
    </div></section>`;
}

function r11(rowData: Row, logo: string, kelas: string): string {
  const year=value(rowData,'tahun_permohonan',String(new Date().getFullYear()));
  const reference=`PBNP/KELAS ${kelas}/${year}/${value(rowData,'id','0').padStart(4,'0')}`;
  const date=value(rowData,'tarikh_hantar').slice(0,10).split('-');
  const submitted=date.length===3 ? `${date[2]}/${date[1]}/${date[0]}` : today();
  const ic=value(rowData,'no_kp',value(rowData,'no_ic'));
  return `<section class="form-page r11"><div class="form-code">Borang R11</div>
    <div class="r11-org"><div class="logo">${logo ? `<img src="${logo}" alt="">` : ''}</div>
      <div><strong>PERSATUAN BOLASEPAK NEGERI PAHANG</strong><span>PAHANG FOOTBALL ASSOCIATION</span>
      <small>(Ahli gabungan Persatuan Bolasepak Malaysia dan berdaftar dengan Pesuruhjaya Sukan Malaysia 0077/98)</small></div></div>
    <div class="r11-title"><strong>R-11</strong><span>PERMOHONAN MENGIKUTI KURSUS<br>PENGADIL BOLASEPAK<br>PENGADIL FUTSAL</span></div>
    <div class="meta"><span>No. Rujukan: ${esc(reference)}</span><span>Tarikh: ${esc(submitted)}</span></div>
    ${section('MAKLUMAT PEMOHON')}
    ${row(['Nama Penuh:', upper(value(rowData, 'nama_penuh'))], ['No. KP:', ic])}
    ${row(['Alamat Emel:', value(rowData, 'emel',value(rowData,'email',value(rowData,'user_email')))], ['No. Telefon:', value(rowData, 'no_telefon')])}
    ${row(['Jantina:', upper(value(rowData, 'jantina'))], ['Jenis Peperiksaan:', `BOLA SEPAK KELAS ${kelas} FAM`])}
    ${row(['Alamat:', address(rowData)])}
    ${section('MAKLUMAT TEMPAT KERJA')}
    ${row(['Status Kerja:', upper(value(rowData, 'status_kerja'))], ['Jawatan:', upper(value(rowData, 'jawatan'))])}
    ${row(['Nama Majikan:', upper(value(rowData, 'nama_majikan'))])}
    ${row(['Alamat:', [value(rowData,'alamat_majikan1'),value(rowData,'alamat_majikan2')].filter(Boolean).join(', ').toLocaleUpperCase('ms') || '-'])}
    ${section('MAKLUMAT WARIS TERDEKAT')}
    ${row(['Nama Waris:', upper(value(rowData, 'nama_waris'))])}
    ${row(['No. Telefon Waris:', value(rowData, 'telefon_waris')], ['Hubungan:', upper(value(rowData, 'hubungan_waris'))])}
    ${section(`MAKLUMAT PERSATUAN BOLA SEPAK DAERAH ${upper(value(rowData,'district_nama'))}`)}
    ${row(['Nama Pegawai Pembangunan:', upper(value(rowData, 'pp_daerah_nama'))])}
    ${row(['No. Telefon:', value(rowData, 'pp_telefon')], ['Alamat Emel:', value(rowData, 'pp_emel')])}
    ${section('PENGAKUAN')}
    <div class="declaration">Saya mengaku bahawa saya tidak akan menuntut sebarang ganti rugi daripada PBNP / Pengelola jika berlaku apa-apa kemalangan pada saya, sebelum, semasa, selepas penyertaan di dalam kursus ini.</div>
    <p>Terima kasih</p><p>Saya yang benar</p>
    <div class="signatures"><div><div class="sign-line"></div>Tandatangan pemohon<br>Nama: ${esc(value(rowData, 'nama_penuh'))}<br>MYKad: ${esc(value(rowData, 'no_kp', value(rowData, 'no_ic')))}</div>
      <div><div class="sign-line"></div>Tarikh</div></div>
    ${section('UNTUK KEGUNAAN PERSATUAN BOLASEPAK NEGERI PAHANG')}
    <p>Permohonan dilulus / ditolak<br>No. Pendaftaran: ____________________</p></section>`;
}

const css = `@page{size:A4;margin:15mm}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#111;font:9pt/1.35 Arial,sans-serif}
  .form-page{break-before:page}.form-page:first-child{break-before:auto}.form-code{text-align:right;font-size:7pt;font-style:italic;margin-bottom:2mm}
  .masthead{display:flex;align-items:flex-start;min-height:33mm;gap:3mm}.logo{width:21mm;flex:none}.logo img{max-width:20mm;max-height:20mm}
  .masthead-title{flex:1;text-align:center;padding-top:3mm}.masthead-title strong{display:block;font-size:12pt;line-height:1.2}
  .masthead-title span{display:block;font-size:10pt;font-weight:bold;margin-top:2mm}.photo{width:29mm;height:31mm;flex:none;border:1px solid #555;display:flex;align-items:end;justify-content:center;text-align:center;font-size:6pt;padding:1mm}
  .r11-org{display:flex;align-items:center;border-bottom:1px solid #111;padding:1mm 0 4mm;text-align:center;gap:3mm}.r11-org>div:last-child{flex:1}.r11-org strong,.r11-org span,.r11-org small{display:block}.r11-org strong{font-size:12pt}.r11-org span{font-size:10pt;font-weight:bold}.r11-org small{font-size:7pt;font-style:italic}
  .r11-title{display:flex;align-items:center;gap:7mm;margin:4mm 0 2mm}.r11-title strong{font-size:30pt;font-style:italic}.r11-title span{font-size:11pt;font-style:italic;line-height:1.2}
  .r11{font-size:8pt;line-height:1.2}.r11 .r11-org{padding-bottom:2mm}.r11 .r11-title{margin:2mm 0 1mm}
  .r11 .section{font-size:8pt;margin:2.5mm 0 1mm;padding:1.2mm 2mm}.r11 .data-cell{min-height:6mm;padding:1mm}
  .r11 .signatures{margin:4mm 0 2mm}.r11 .sign-line{height:8mm}.r11 p{margin:1.5mm 0}
  .photo img{width:100%;height:100%;object-fit:contain}.meta{display:flex;justify-content:space-between;margin:1mm 0 5mm;font-size:8pt}
  p{margin:2.5mm 0}.section{font-size:9pt;background:#111;color:#fff;padding:2mm 3mm;margin:4mm 0 2mm;break-after:avoid}
  .r1 .section{background:#fff;color:#111;border:1px solid #111;text-align:center}.data-row{display:flex;width:100%;break-inside:avoid}
  .data-cell{display:flex;min-width:0;border:1px solid #222;margin-right:-1px;margin-bottom:-1px;min-height:7mm;padding:1.4mm;gap:2mm;align-items:flex-start}
  .data-cell strong{flex:none;font-weight:normal}.data-cell span{min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}
  .digit-row{display:flex;align-items:center;gap:1mm;margin:2mm 0;break-inside:avoid}.digit{display:inline-flex;width:5mm;height:6mm;border:1px solid #111;align-items:center;justify-content:center}
  .signatures{display:flex;gap:10mm;justify-content:space-between;margin:9mm 0 4mm;break-inside:avoid}.signatures>div{flex:1}.sign-line{height:14mm;border-bottom:1px solid #111;margin-bottom:2mm}
  .approval{border-top:3px double #111;margin-top:5mm;padding-top:3mm}.approval small{display:block;text-align:right}.keep-together{break-inside:avoid}
  .declaration{border:1px solid #111;padding:1.5mm 2mm;margin-bottom:-1px;font-size:8pt;break-inside:avoid}
  table.matches{border-collapse:collapse;width:100%;font-size:8pt;table-layout:fixed}table.matches thead{display:table-header-group}
  table.matches tr{break-inside:avoid}table.matches th,table.matches td{border:1px solid #111;padding:1.5mm;overflow-wrap:anywhere;vertical-align:middle}
  table.matches th{background:#eee;text-align:center}table.matches td:first-child{text-align:center}
  .signature-box{height:35mm;border:1px solid #111;padding:2mm}.signature-name{border:1px solid #111;text-align:center;padding:2mm}
  small{font-size:7pt}.r4 .keep-together{margin-top:3mm}`;

export function renderRegistrationHtml(rowData: Row, type: FormType, form: string | null,
  matches: Match[], logo = '', photo = ''): string {
  let content: string;
  if (type === 'penilai_berdaftar') content = r1Penilai(rowData, logo, photo);
  else if (type === 'pengadil_berdaftar') {
    content = (form === null || form === 'r1' ? r1(rowData, logo, photo) : '')
      + (form === null || form === 'r2' ? r2(rowData, matches, logo) : '')
      + (form === null || form === 'r4' ? r4(rowData, logo) : '');
  } else if (type === 'kelas3_fam' || type === 'ujian_kecergasan') content = r4(rowData, logo);
  else content = r11(rowData, logo, type === 'ujian_kelas1' ? 'I' : 'III');
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8"><title>Borang Pendaftaran</title><style>${css}</style></head><body>${content}</body></html>`;
}

async function imageData(env: Env, request: Request, profilePath?: string): Promise<string> {
  try {
    let bytes: Uint8Array;
    let mime: string | null | undefined;
    if (profilePath) {
      const object = await env.MEDIA.get(new URL(profilePath, request.url).pathname.replace(/^\/uploads\//, ''));
      if (!object) return '';
      mime = object.httpMetadata?.contentType;
      bytes = new Uint8Array(await object.arrayBuffer());
    } else {
      const response = await env.ASSETS.fetch(new URL('/assets/Pahang_FA_logo.png', request.url));
      if (!response.ok) return '';
      mime = response.headers.get('Content-Type');
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    if (!mime || !/^image\/(png|jpeg)$/i.test(mime)) return '';
    if (bytes.length > 2_000_000) return '';
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return `data:${mime};base64,${btoa(binary)}`;
  } catch { return ''; }
}

async function application(env: Env, user: SessionUser, type: FormType, id: number | null): Promise<Row | null> {
  const scope = user.role === 'PP Daerah' ? user.persatuan_id : null;
  const isWritten = type === 'ujian_bertulis' || type === 'ujian_kelas1';
  if (type === 'ujian_kelas1') {
    // The imported legacy snapshot has no jenis_permohonan column on this
    // table. PHP's class-I branch also cannot query that schema. Avoid a D1
    // 500 until a source-compatible column and records arrive at cutover.
    const columns = await env.DB.prepare('PRAGMA table_info(permohonan_ujian_bertulis)')
      .all<{name:string}>();
    if (!columns.results.some(column => column.name === 'jenis_permohonan')) return null;
  }
  const table = isWritten ? 'permohonan_ujian_bertulis' : 'permohonan';
  const typeCondition = isWritten ? (type === 'ujian_kelas1' ? "p.jenis_permohonan='kelas1'" : '1=1')
    : type === 'ujian_kecergasan' ? "p.jenis_permohonan='ujian_kecergasan' AND p.workflow_status='Approved'"
    : `p.jenis_borang='${type}'`;
  const approved = isWritten || type === 'pengadil_futsal' ? "AND lower(p.status)='approved'" : '';
  const districtField = isWritten ? 'p.persatuan_id' : 'p.district_id';
  const districtAccess = type === 'kelas3_fam' ? '' : ` OR (${districtField}=?${type === 'pengadil_berdaftar' || type === 'penilai_berdaftar' ? " AND lower(p.status)='approved'" : ''})`;
  const params = id ? [id, user.id, ...(districtAccess ? [scope] : [])]
    : [user.id, ...(districtAccess ? [scope] : [])];
  const sql = `SELECT p.*,u.tahun_mula_aktif AS user_tahun_mula_aktif,
    u.tahun_lulus_kelas3,u.url_gambar_profil AS user_gambar_profil,
    u.persatuan_id AS user_persatuan_id,u.nama_penuh AS user_nama_penuh,
    u.no_ic AS user_no_ic,u.email AS user_email,u.no_telefon AS user_no_telefon,
    u.alamat1 AS user_alamat1,u.alamat2 AS user_alamat2,u.poskod AS user_poskod,
    u.daerah AS user_daerah,u.negeri AS user_negeri,u.jantina AS user_jantina,
    u.status_kerja AS user_status_kerja,u.jawatan AS user_jawatan,
    u.nama_majikan AS user_nama_majikan,u.nama_waris AS user_nama_waris,
    u.hubungan_waris AS user_hubungan_waris,u.telefon_waris AS user_telefon_waris
    FROM ${table} p JOIN users u ON u.id=p.user_id
    WHERE ${id ? 'p.id=? AND ' : ''}(p.user_id=?${districtAccess}) AND ${typeCondition} ${approved}
    ${id ? '' : `ORDER BY ${isWritten ? 'p.id' : 'p.tarikh_hantar'} DESC LIMIT 1`}`;
  const raw = await env.DB.prepare(sql).bind(...params).first<Row>();
  if (!raw) return null;
  if (isWritten) {
    for (const key of ['nama_penuh','no_telefon','alamat1','alamat2','poskod','daerah','negeri',
      'jantina','status_kerja','jawatan','nama_majikan','nama_waris','hubungan_waris','telefon_waris']) {
      raw[key] = raw[`user_${key}`] ?? raw[key];
    }
    raw.no_kp = raw.user_no_ic;
    raw.emel = raw.user_email;
  }
  raw.tahun_mula_aktif = raw.tahun_mula_aktif || raw.user_tahun_mula_aktif;
  raw.url_gambar_profil = raw.url_gambar_profil || raw.user_gambar_profil;
  const districtId = Number(raw.district_id || raw.persatuan_id || raw.user_persatuan_id || 0);
  if (districtId) {
    const district = await env.DB.prepare('SELECT nama_persatuan FROM persatuan_bolasepak_daerah WHERE id=?')
      .bind(districtId).first<{nama_persatuan:string}>();
    raw.district_nama = district?.nama_persatuan ?? '';
    const pp = await env.DB.prepare("SELECT nama_penuh,no_telefon,email FROM users WHERE role='PP Daerah' AND persatuan_id=? LIMIT 1")
      .bind(districtId).first<{nama_penuh:string;no_telefon:string;email:string}>();
    raw.pp_daerah_nama = pp?.nama_penuh ?? '';
    raw.pp_telefon = pp?.no_telefon ?? '';
    raw.pp_emel = pp?.email ?? '';
  }
  return raw;
}

export async function registrationPdf(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({error:true,message:'Kaedah tidak dibenarkan.'},405);
  const user = await currentUser(request,env);
  if (!user) return json({error:true,message:'Sesi tidak sah. Sila log masuk semula.'},401);
  const params = new URL(request.url).searchParams;
  const type = params.get('type') || 'pengadil_berdaftar';
  if (!types.includes(type as FormType)) return json({error:true,message:'Jenis borang tidak sah'},400);
  const form = params.get('form');
  if (type === 'penilai_berdaftar' && form !== null && form !== 'r1') {
    return json({error:true,message:'Pendaftaran RA hanya mempunyai borang R1.'},400);
  }
  if (type === 'pengadil_berdaftar' && form !== null && !['r1','r2','r4'].includes(form)) {
    return json({error:true,message:'Jenis borang tidak sah.'},400);
  }
  const idText = params.get('application_id') || params.get('id');
  const id = idText && /^\d+$/.test(idText) && Number.isSafeInteger(Number(idText)) && Number(idText)>0
    ? Number(idText) : null;
  if (type === 'kelas3_fam' && !id) return json({error:true,message:'ID permohonan diperlukan.'},400);
  const rowData = await application(env,user,type as FormType,id);
  if (!rowData) return json({error:true,message:'Permohonan belum diluluskan atau tidak wujud'},403);
  const matches = type === 'pengadil_berdaftar' && (form === null || form === 'r2')
    ? (await env.DB.prepare('SELECT tarikh,jenis,tempat,jawatan FROM perlawanan WHERE permohonan_id=? ORDER BY tarikh ASC')
      .bind(Number(rowData.id)).all<Match>()).results : [];
  const logo = await imageData(env,request);
  const photoPath = value(rowData,'url_gambar_profil');
  const photo = photoPath.startsWith('/uploads/') ? await imageData(env,request,photoPath) : '';
  const html = renderRegistrationHtml(rowData,type as FormType,form,matches,logo,photo);
  let rendered: Response;
  try {
    rendered = await env.BROWSER.quickAction('pdf',{
      html,cacheTTL:0,pdfOptions:{format:'a4',printBackground:true,preferCSSPageSize:true},
    });
  } catch {
    return json({error:true,message:'PDF belum dapat dijana. Sila cuba semula.'},503);
  }
  if (!rendered.ok || !rendered.headers.get('content-type')?.includes('application/pdf')) {
    return json({error:true,message:'PDF belum dapat dijana. Sila cuba semula.'},503);
  }
  const name = type === 'penilai_berdaftar' ? `Borang_Pendaftaran_RA_R1_${rowData.id}.pdf`
    : type === 'pengadil_berdaftar' ? `Borang_Pendaftaran_Pengadil_${form ? form.toUpperCase() : 'R1_R2_R4'}_${rowData.id}.pdf`
    : type === 'kelas3_fam' ? `Borang_Perakuan_Kesihatan_R4_${rowData.id}.pdf`
    : `Borang_${type}_${rowData.id}.pdf`;
  return new Response(rendered.body,{status:200,headers:{
    'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${name}"`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  }});
}
