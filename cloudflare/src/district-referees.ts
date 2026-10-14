import { currentUser, json } from './auth';
import type { Env } from './types';

const APPROVED = `p.status='Approved' AND
  (p.jenis_borang<>'pengadil_berdaftar' OR p.tahun_permohonan<2027
   OR p.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan')
   OR p.status_ujian='Lulus')`;
const COMPLETE = `p.status_workflow='Lengkap' AND
  (p.jenis_borang<>'pengadil_berdaftar' OR p.tahun_permohonan<2027
   OR p.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan')
   OR p.status_ujian='Lulus')`;

function roleFilter(role: string): string {
  return role === 'Penilai' ? "u.role IN ('Penilai','PP Daerah')" : "u.role='Pengadil'";
}

function positiveId(raw: string | null): number | null {
  if (!raw || !/^[1-9][0-9]*$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) ? number : null;
}

/** Read-only PP Daerah referee/RA directory, including the legacy 2026 counts. */
export async function districtReferees(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'PP Daerah') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (!user.persatuan_id) {
    return json({ error: true, message: 'Persatuan not assigned to your account.' }, 403);
  }

  const params = new URL(request.url).searchParams;
  const role = params.get('role') === 'Penilai' ? 'Penilai' : 'Pengadil';
  const filter = roleFilter(role);
  if (params.has('single')) {
    const id = positiveId(params.get('single'));
    if (id === null) return json({ error: true, message: 'Pengadil tidak dijumpai.' }, 404);
    // The PHP endpoint selected u.*, including password and Telegram link token.
    // Only return the profile fields needed by PP Daerah.
    const referee = await env.DB.prepare(`
      SELECT u.id, u.email, u.role, u.district_id, u.persatuan_id,
             u.nama_penuh, u.no_ic, u.no_telefon, u.alamat1, u.alamat2,
             u.poskod, u.daerah, u.negeri, u.status_kerja, u.jawatan,
             u.nama_majikan, u.alamat_majikan1, u.alamat_majikan2,
             u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
             u.nama_waris, u.hubungan_waris, u.telefon_waris,
             u.url_gambar_profil, u.jantina, u.jenis_pengadil, u.jenis_penilai,
             u.tahun_mula_aktif, u.saiz_baju, u.aktif, u.last_login,
             u.created_at, u.updated_at, u.umur, u.tahun_mohon_kelas3,
             u.tahun_lulus_kelas3, u.pengadil_kebangsaan, u.pengadil_negeri,
             u.pengadil_daerah, pb.nama_persatuan AS persatuan_nama,
             COUNT(p.id) AS total_permohonan,
             COUNT(CASE WHEN ${APPROVED} THEN 1 END) AS permohonan_lulus,
             COUNT(CASE WHEN p.tahun_permohonan=2026 AND p.status='Approved'
               THEN 1 END) AS permohonan_2026_lulus
      FROM users u
      LEFT JOIN persatuan_bolasepak_daerah pb ON pb.id=u.persatuan_id
      LEFT JOIN permohonan p ON p.user_id=u.id
      WHERE u.id=? AND u.persatuan_id=? AND ${filter}
      GROUP BY u.id
    `).bind(id, user.persatuan_id).first<Record<string, unknown>>();
    if (!referee) return json({ error: true, message: 'Pengadil tidak dijumpai.' }, 404);
    const matches = await env.DB.prepare(`
      SELECT * FROM perlawanan WHERE user_id=? ORDER BY tarikh DESC
    `).bind(id).all();
    return json({ error: false, referees: [{ ...referee, perlawanan: matches.results }] });
  }

  const referees = await env.DB.prepare(`
    SELECT u.id, u.email, u.nama_penuh, u.no_ic, u.no_telefon,
           u.jenis_pengadil, u.aktif, u.created_at, u.last_login,
           COUNT(p.id) AS total_permohonan,
           COUNT(CASE WHEN ${APPROVED} THEN 1 END) AS permohonan_lulus,
           COUNT(CASE WHEN ${COMPLETE} THEN 1 END) AS permohonan_lengkap,
           MAX(p.tarikh_hantar) AS permohonan_terakhir,
           COUNT(CASE WHEN p.tahun_permohonan=2026 AND p.status='Approved'
             THEN 1 END) AS permohonan_2026_lulus
    FROM users u
    LEFT JOIN permohonan p ON p.user_id=u.id
    WHERE ${filter} AND u.persatuan_id=?
    GROUP BY u.id ORDER BY u.nama_penuh ASC
  `).bind(user.persatuan_id).all();

  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit',
  }).format(new Date());
  const year = month.slice(0, 4);
  const stats = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users u WHERE ${filter} AND u.persatuan_id=?) AS total,
      (SELECT COUNT(DISTINCT u.id) FROM users u
       LEFT JOIN permohonan p ON p.user_id=u.id
       WHERE ${filter} AND u.persatuan_id=? AND u.aktif=1
         AND (u.role='PP Daerah' OR
              (p.tahun_permohonan=2026 AND p.status='Approved'))) AS active,
      (SELECT COUNT(*) FROM permohonan WHERE persatuan_id=?
         AND substr(tarikh_hantar,1,7)=?) AS applications_this_month,
      (SELECT COUNT(*) FROM permohonan WHERE persatuan_id=?
         AND status='Approved' AND substr(status_kemaskini,1,4)=?) AS approved_this_year
  `).bind(user.persatuan_id, user.persatuan_id, user.persatuan_id,
    month, user.persatuan_id, year)
    .first<{ total: number; active: number; applications_this_month: number; approved_this_year: number }>();
  const total = Number(stats?.total ?? 0);
  const active = Number(stats?.active ?? 0);
  return json({
    error: false,
    referees: referees.results,
    statistics: {
      total, active, inactive: total - active,
      applications_this_month: Number(stats?.applications_this_month ?? 0),
      approved_this_year: Number(stats?.approved_this_year ?? 0),
    },
    persatuan_id: user.persatuan_id,
  });
}
