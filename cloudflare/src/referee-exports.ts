import { currentUser, json } from './auth';
import type { Env } from './types';

type ExportRow = Record<string, string | number | null>;

function safeCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Spreadsheet applications can execute formulas embedded in CSV fields.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) && !/^-?\d+(?:\.\d+)?$/.test(text.trim())) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(headers: string[], rows: unknown[][], filename: string): Response {
  const content = `\uFEFF${[headers, ...rows].map((row) => row.map(safeCell).join(',')).join('\r\n')}\r\n`;
  return new Response(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function malaysiaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function shortDate(raw: unknown): string {
  const date = String(raw ?? '');
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function dateTime(raw: unknown): string {
  const date = shortDate(raw);
  return date ? `${date} ${String(raw).slice(11, 16)}`.trim() : '';
}

function ageFromIc(raw: unknown, today: string): number | '' {
  const ic = String(raw ?? '').replace(/\D/g, '');
  if (ic.length < 6) return '';
  const yy = Number(ic.slice(0, 2));
  const mm = Number(ic.slice(2, 4));
  const dd = Number(ic.slice(4, 6));
  const currentYear = Number(today.slice(0, 4));
  const birthYear = yy > currentYear % 100 ? 1900 + yy : 2000 + yy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
  const age = currentYear - birthYear - (today.slice(5) < `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}` ? 1 : 0);
  return age >= 0 && age < 150 ? age : '';
}

/** Admin export of annual registered referees or RA, matching the PHP columns. */
export async function adminRefereeExport(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  const params = new URL(request.url).searchParams;
  const today = malaysiaToday();
  const currentYear = Number(today.slice(0, 4));
  const rawYear = params.get('year');
  const year = rawYear == null ? currentYear : Number(rawYear);
  if (rawYear != null && !/^\d{4}$/.test(rawYear) || !Number.isInteger(year)
      || year < currentYear - 3 || year > currentYear + 3) {
    return json({ error: true, message: 'Tahun tidak sah.' }, 422);
  }
  const ra = params.get('type') === 'penilai_berdaftar';
  const filter = ra
    ? "(u.role='PP Daerah' OR u.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan') OR a.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan'))"
    : "a.id IS NOT NULL AND (a.jenis_pengadil NOT IN ('Penilai Pengadil','Pegawai Pembangunan') OR a.jenis_pengadil IS NULL)";
  const result = await env.DB.prepare(`
    SELECT DISTINCT u.id AS user_id, u.nama_penuh, u.no_ic AS no_kp, u.jantina,
      u.email AS emel, u.no_telefon, u.saiz_baju,
      CASE WHEN u.role='PP Daerah' THEN 'Penilai Pengadil'
           WHEN u.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan') THEN u.jenis_pengadil
           ELSE a.jenis_pengadil END AS jenis_pengadil,
      COALESCE(a.alamat1,u.alamat1) AS alamat1, COALESCE(a.alamat2,u.alamat2) AS alamat2,
      COALESCE(a.poskod,u.poskod) AS poskod, COALESCE(a.daerah,u.daerah) AS daerah,
      COALESCE(a.negeri,u.negeri) AS negeri, COALESCE(a.status_kerja,u.status_kerja) AS status_kerja,
      COALESCE(a.jawatan,u.jawatan) AS jawatan, COALESCE(a.nama_majikan,u.nama_majikan) AS nama_majikan,
      COALESCE(a.nama_waris,u.nama_waris) AS nama_waris,
      COALESCE(a.hubungan_waris,u.hubungan_waris) AS hubungan_waris,
      COALESCE(a.telefon_waris,u.telefon_waris) AS telefon_waris,
      p.nama_persatuan AS persatuan
    FROM users u
    LEFT JOIN permohonan a ON a.user_id=u.id
      AND a.jenis_borang IN ('pengadil_berdaftar','penilai_berdaftar')
      AND a.status='Approved'
      AND (a.jenis_borang<>'pengadil_berdaftar' OR a.tahun_permohonan<2027
           OR a.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan') OR a.status_ujian='Lulus')
      AND a.tahun_permohonan=?
    LEFT JOIN persatuan_bolasepak_daerah p ON p.id=COALESCE(a.persatuan_id,u.persatuan_id)
    WHERE ${filter} ORDER BY u.nama_penuh ASC
  `).bind(year).all<ExportRow>();
  const headers = ['Bil','Nama Penuh','No. K/P','Jantina','Umur','Jenis Pengadil',
    'Persatuan Bola Sepak Daerah','Emel','No. Telefon','Alamat 1','Alamat 2','Poskod',
    'Daerah','Negeri','Saiz Baju','Status Kerja','Jawatan','Nama Majikan',
    'Nama Waris','Hubungan Waris','Telefon Waris'];
  const rows = result.results.map((r, i) => [i + 1, r.nama_penuh, r.no_kp,
    String(r.jantina ?? '').toUpperCase() === 'LELAKI' ? 'Lelaki'
      : String(r.jantina ?? '').toUpperCase() === 'PEREMPUAN' ? 'Perempuan' : r.jantina,
    ageFromIc(r.no_kp, today), r.jenis_pengadil, r.persatuan, r.emel, r.no_telefon,
    r.alamat1, r.alamat2, r.poskod, r.daerah, r.negeri, r.saiz_baju,
    r.status_kerja, r.jawatan, r.nama_majikan, r.nama_waris, r.hubungan_waris,
    r.telefon_waris]);
  return csv(headers, rows, `senarai-${ra ? 'RA' : 'pengadil'}-${year}.csv`);
}

/** PP Daerah export, scoped to their own association. */
export async function districtRefereeExport(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'PP Daerah') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (!user.persatuan_id) return json({ error: true, message: 'Persatuan not assigned to your account.' }, 403);
  const typeMap: Record<string, string> = {
    berdaftar: 'pengadil_berdaftar', futsal: 'pengadil_futsal',
    kecergasan: 'ujian_kecergasan', bertulis: 'ujian_bertulis', kelas1: 'ujian_kelas1_fam',
  };
  const jenisBorang = typeMap[new URL(request.url).searchParams.get('type') ?? ''] ?? '';
  const result = await env.DB.prepare(`
    SELECT u.id, u.email, u.nama_penuh, u.no_ic, u.no_telefon, u.jenis_pengadil,
      u.aktif, u.created_at, u.last_login, COUNT(p.id) AS total_permohonan,
      COUNT(CASE WHEN (p.status='Approved' OR p.status_workflow='Lengkap')
        AND (p.jenis_borang<>'pengadil_berdaftar' OR p.tahun_permohonan<2027
             OR p.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan') OR p.status_ujian='Lulus')
        THEN 1 END) AS permohonan_lulus,
      COUNT(CASE WHEN p.status_workflow='Lengkap'
        AND (p.jenis_borang<>'pengadil_berdaftar' OR p.tahun_permohonan<2027
             OR p.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan') OR p.status_ujian='Lulus')
        THEN 1 END) AS permohonan_lengkap
    FROM users u
    LEFT JOIN permohonan p ON p.user_id=u.id AND (?='' OR p.jenis_borang=?)
    WHERE u.role='Pengadil' AND u.persatuan_id=?
    GROUP BY u.id ORDER BY u.nama_penuh ASC
  `).bind(jenisBorang, jenisBorang, user.persatuan_id).all<ExportRow>();
  const headers = ['Bil','Nama Penuh','Email','No. IC','No. Telefon','Jenis Pengadil',
    'Status','Tarikh Daftar','Log Masuk Terakhir','Jumlah Permohonan',
    'Permohonan Lulus','Permohonan Lengkap'];
  const rows = result.results.map((r, i) => [i + 1, r.nama_penuh, r.email, r.no_ic,
    r.no_telefon, r.jenis_pengadil, Number(r.aktif) === 1 ? 'Aktif' : 'Tidak Aktif',
    shortDate(r.created_at), dateTime(r.last_login), r.total_permohonan,
    r.permohonan_lulus, r.permohonan_lengkap]);
  return csv(headers, rows, `pengadil-daerah-${malaysiaToday()}.csv`);
}
