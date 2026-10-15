import { currentUser, json } from './auth';
import type { Env } from './types';
import { wroteRow } from './d1-changes';

function positiveId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

type RefereeRow = Record<string, unknown> & { user_id: number };

export async function registeredReferees(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  const query = new URL(request.url).searchParams;
  const currentYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric' }).format(new Date()));
  const year = query.has('year') ? Number(query.get('year')) : currentYear;
  if (!Number.isInteger(year) || year < currentYear - 3 || year > currentYear + 3) {
    return json({ error: true, message: 'Tahun tidak sah.' }, 422);
  }
  const ra = query.get('type') === 'penilai_berdaftar';
  const roleCondition = ra
    ? "(u.role='Penilai' OR u.jenis_pengadil='Penilai Pengadil' OR a.id IS NOT NULL)"
    : 'a.id IS NOT NULL';
  const rows = await env.DB.prepare(`SELECT DISTINCT u.id AS user_id,u.role AS user_role,
    u.nama_penuh,u.no_ic AS no_kp,u.jantina,u.email AS emel,u.no_telefon,u.saiz_baju,
    COALESCE(NULLIF(a.url_gambar_profil,''),u.url_gambar_profil) AS url_gambar_profil,
    a.id,COALESCE(a.persatuan_id,u.persatuan_id) AS persatuan_id,
    COALESCE(a.umur,u.umur) AS umur,
    CASE WHEN u.role='Penilai' OR u.jenis_pengadil='Penilai Pengadil' THEN 'Penilai Pengadil'
      ELSE a.jenis_pengadil END AS jenis_pengadil,
    COALESCE(a.alamat1,u.alamat1) AS alamat1,COALESCE(a.alamat2,u.alamat2) AS alamat2,
    COALESCE(a.poskod,u.poskod) AS poskod,COALESCE(a.daerah,u.daerah) AS daerah,
    COALESCE(a.negeri,u.negeri) AS negeri,COALESCE(a.status_kerja,u.status_kerja) AS status_kerja,
    COALESCE(a.jawatan,u.jawatan) AS jawatan,COALESCE(a.nama_majikan,u.nama_majikan) AS nama_majikan,
    COALESCE(a.alamat_majikan1,u.alamat_majikan1) AS alamat_majikan1,
    COALESCE(a.alamat_majikan2,u.alamat_majikan2) AS alamat_majikan2,
    COALESCE(a.poskod_majikan,u.poskod_majikan) AS poskod_majikan,
    COALESCE(a.daerah_majikan,u.daerah_majikan) AS daerah_majikan,
    COALESCE(a.negeri_majikan,u.negeri_majikan) AS negeri_majikan,
    COALESCE(a.nama_waris,u.nama_waris) AS nama_waris,
    COALESCE(a.hubungan_waris,u.hubungan_waris) AS hubungan_waris,
    COALESCE(a.telefon_waris,u.telefon_waris) AS telefon_waris,
    a.url_resit,a.status_kemaskini,a.tarikh_hantar,
    u.tahun_mohon_kelas3,u.tahun_lulus_kelas3,
    u.pengadil_kebangsaan,u.pengadil_negeri,u.pengadil_daerah,
    p.nama_persatuan AS persatuan,
    CASE WHEN a.id IS NOT NULL THEN 'Permohonan RA'
      WHEN u.role='Penilai' OR u.jenis_pengadil='Penilai Pengadil' THEN 'Peranan RA pada akaun'
      ELSE NULL END AS sumber_ra
    FROM users u LEFT JOIN permohonan a ON a.user_id=u.id
      AND a.jenis_borang=${ra ? "'penilai_berdaftar'" : "'pengadil_berdaftar'"}
      ${ra ? '' : "AND COALESCE(a.jenis_pengadil,'') NOT IN ('Penilai Pengadil','Pegawai Pembangunan')"}
      AND a.status='Approved'
      AND (a.jenis_borang<>'pengadil_berdaftar' OR a.tahun_permohonan<2027
        OR a.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan') OR a.status_ujian='Lulus')
      AND a.tahun_permohonan=?
    LEFT JOIN persatuan_bolasepak_daerah p ON p.id=COALESCE(a.persatuan_id,u.persatuan_id)
    WHERE u.aktif=1 AND ${roleCondition} ORDER BY u.nama_penuh`)
    .bind(year).all<RefereeRow>();
  if (!rows.results.length) return json({ error: false, data: [] });
  // The current UI opens an inline detail view, so retain its application and
  // match arrays while fetching each table once rather than once per referee.
  const byUser = new Map<number, RefereeRow[]>();
  for (const row of rows.results) {
    row.approved_applications = [];
    row.perlawanan = [];
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
  }
  const ids = [...byUser.keys()];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100);
    const placeholders = chunk.map(() => '?').join(',');
    const applications = await env.DB.prepare(`SELECT id,user_id,jenis_borang,jenis_permohonan,
      jenis_pengadil,status,status_ujian,url_resit,admin_notes,tahun_permohonan,
      status_kemaskini,tarikh_hantar FROM permohonan
      WHERE user_id IN (${placeholders}) ORDER BY tarikh_hantar DESC`).bind(...chunk).all<Record<string, unknown>>();
    for (const application of applications.results) {
      for (const row of byUser.get(Number(application.user_id)) ?? []) {
        const {user_id:_userId,...publicApplication} = application;
        (row.approved_applications as Record<string, unknown>[]).push(publicApplication);
      }
    }
    const matches = await env.DB.prepare(`SELECT id,user_id,tarikh,jenis,tempat,jawatan,home_team,away_team
      FROM perlawanan WHERE user_id IN (${placeholders}) ORDER BY tarikh DESC`).bind(...chunk).all<Record<string, unknown>>();
    for (const match of matches.results) {
      for (const row of byUser.get(Number(match.user_id)) ?? []) {
        const {user_id:_userId,...publicMatch} = match;
        (row.perlawanan as Record<string, unknown>[]).push(publicMatch);
      }
    }
  }
  return json({ error: false, data: rows.results });
}

export async function deactivateReferee(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const id = positiveId(new URL(request.url).searchParams.get('id'));
  if (!id) return json({ error: true, message: 'ID pengguna diperlukan.' }, 422);
  const referee = await env.DB.prepare("SELECT nama_penuh FROM users WHERE id=? AND role='Pengadil' AND aktif=1")
    .bind(id).first<{ nama_penuh: string }>();
  if (!referee) return json({ error: true, message: 'Pengadil tidak dijumpai.' }, 404);
  // Do not hard-delete a user: cascades would destroy match history, reports,
  // applications and audit relationships (the original PHP endpoint did so).
  const results = await env.DB.batch([
    env.DB.prepare("UPDATE users SET aktif=0,updated_at=datetime('now','+8 hours') WHERE id=? AND role='Pengadil' AND aktif=1")
      .bind(id),
    env.DB.prepare('DELETE FROM worker_sessions WHERE user_id=?').bind(id),
    env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
      VALUES(?,'deactivate_referee','users',?,?,datetime('now','+8 hours'))`)
      .bind(user.id, id, `Akaun pengadil ${referee.nama_penuh} dinyahaktifkan oleh Admin; sejarah dikekalkan.`),
  ]);
  if (!wroteRow(results[0])) return json({ error: true, message: 'Pengadil tidak dijumpai.' }, 404);
  return json({ error: false, message: 'Akaun pengadil dinyahaktifkan. Semua sejarah perlawanan dikekalkan.',
    referee_name: referee.nama_penuh });
}
