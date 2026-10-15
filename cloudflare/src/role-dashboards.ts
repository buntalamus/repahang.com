import { currentUser, json } from './auth';
import type { Env } from './types';

export async function assessorDashboard(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (Number(user.can_ra) !== 1 && !(user.role === 'Admin' && user.jenis_pengadil === 'Penilai Pengadil')) {
    return json({ error: true, message: 'Akses ditolak.' }, 403);
  }
  const [assignments, completed, assessed, recent] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total FROM lantikan_pengadil
      WHERE pengadil_id=? AND jawatan='Penilai Pengadil' AND status='Diterima'
    `).bind(user.id).first<{ total: number }>(),
    env.DB.prepare(`
      SELECT COUNT(*) AS total FROM laporan_penilaian
      WHERE penilai_id=? AND status IN ('Dihantar','Disahkan')
    `).bind(user.id).first<{ total: number }>(),
    env.DB.prepare(`
      SELECT COUNT(DISTINCT peg.nama_pengadil) AS total
      FROM laporan_penilaian lp
      JOIN laporan_penilaian_pegawai peg ON peg.laporan_id=lp.id
      WHERE lp.penilai_id=? AND lp.status IN ('Dihantar','Disahkan')
    `).bind(user.id).first<{ total: number }>(),
    env.DB.prepare(`
      SELECT lp.id, lp.status, jp.tarikh,
             COALESCE(jp.pasukan_home,'') || ' lwn ' || COALESCE(jp.pasukan_away,'')
               AS pertandingan,
             k.nama AS kejohanan
      FROM laporan_penilaian lp
      JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id
      WHERE lp.penilai_id=?
      ORDER BY lp.tarikh_hantar DESC, lp.created_at DESC, lp.id DESC LIMIT 5
    `).bind(user.id).all(),
  ]);
  const total = Number(assignments?.total ?? 0);
  const selesai = Number(completed?.total ?? 0);
  return json({
    error: false,
    data: {
      stats: {
        total_tugasan: total,
        selesai,
        belum_selesai: total - selesai,
        pengadil_dinilai: Number(assessed?.total ?? 0),
      },
      recent: recent.results,
    },
  });
}

export async function districtAnnouncements(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'PP Daerah') return json({ error: true, message: 'Akses ditolak.' }, 403);
  const rows = await env.DB.prepare(`
    SELECT id,title,content,created_at FROM announcements
    ORDER BY created_at DESC,id DESC LIMIT 10
  `).all();
  return json({ error: false, announcements: rows.results });
}

const DISTRICT_MATCH_SCOPE = `(
  (p.match_group_id IS NOT NULL AND p.daerah_perlawanan_id=?)
  OR (p.match_group_id IS NULL AND u.persatuan_id=? AND u.role IN ('Pengadil','PP Daerah'))
)`;

export async function districtOverview(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'PP Daerah') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (!user.persatuan_id) {
    return json({ error: true, message: 'Persatuan not assigned to your account.' }, 403);
  }
  const persatuanId = user.persatuan_id;
  const district = await env.DB.prepare(`
    SELECT d.id FROM persatuan_bolasepak_daerah p
    JOIN districts d ON d.nama=p.daerah WHERE p.id=? LIMIT 1
  `).bind(persatuanId).first<{ id: number }>();
  const districtId = district?.id ?? 0;
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const month = dateParts.slice(0, 7);
  const year = Number(dateParts.slice(0, 4));

  const [referees, applications, matches, topReferees, currentAssignments] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total FROM users u WHERE u.aktif=1 AND u.persatuan_id=?
        AND EXISTS (SELECT 1 FROM permohonan p WHERE p.user_id=u.id
          AND p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan=?
          AND p.status='Approved'
          AND COALESCE(p.jenis_pengadil,'') NOT IN ('Penilai Pengadil','Pegawai Pembangunan')
          AND (p.tahun_permohonan<2027 OR p.status_ujian='Lulus'))
    `).bind(persatuanId,year).first<{ total: number }>(),
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN p.status_workflow='Menunggu PP Daerah' THEN 1 ELSE 0 END)
          AS pending,
        SUM(CASE WHEN p.status='Approved' THEN 1 ELSE 0 END)
          AS approved
      FROM permohonan p JOIN users u ON u.id=p.user_id
      WHERE u.persatuan_id=? AND p.tahun_permohonan=?
    `).bind(persatuanId,year).first<{ pending: number | null; approved: number | null }>(),
    env.DB.prepare(`
      SELECT
        COUNT(DISTINCT COALESCE(p.match_group_id,CAST(p.id AS TEXT))) AS total,
        COUNT(DISTINCT CASE WHEN substr(p.tarikh,1,7)=?
          THEN COALESCE(p.match_group_id,CAST(p.id AS TEXT)) END) AS this_month,
        COUNT(DISTINCT CASE WHEN p.status_pp='Disahkan'
          THEN COALESCE(p.match_group_id,CAST(p.id AS TEXT)) END) AS verified,
        COUNT(DISTINCT CASE WHEN p.status_pp IS NULL OR p.status_pp=''
          OR p.status_pp='Belum Disahkan'
          THEN COALESCE(p.match_group_id,CAST(p.id AS TEXT)) END) AS pending
      FROM perlawanan p JOIN users u ON u.id=p.user_id
      WHERE ${DISTRICT_MATCH_SCOPE}
    `).bind(month, districtId, persatuanId).first<{
      total: number; this_month: number; verified: number; pending: number;
    }>(),
    env.DB.prepare(`
      SELECT u.id,u.nama_penuh,u.jenis_pengadil,
        COUNT(DISTINCT COALESCE(p.match_group_id,CAST(p.id AS TEXT)))
          AS total_matches,
        COUNT(DISTINCT CASE WHEN p.status_pp='Disahkan'
          THEN COALESCE(p.match_group_id,CAST(p.id AS TEXT)) END)
          AS verified_matches
      FROM users u JOIN perlawanan p ON p.user_id=u.id
      WHERE u.role IN ('Pengadil','PP Daerah') AND (
        (p.match_group_id IS NOT NULL AND p.daerah_perlawanan_id=?)
        OR (p.match_group_id IS NULL AND u.persatuan_id=?))
      GROUP BY u.id,u.nama_penuh,u.jenis_pengadil
      ORDER BY total_matches DESC,verified_matches DESC,u.id LIMIT 5
    `).bind(districtId, persatuanId).all(),
    env.DB.prepare(`
      SELECT DISTINCT p.match_group_id,p.jenis,p.tempat,p.tarikh,
        p.home_team,p.away_team,u.nama_penuh,p.jawatan,p.status_pp AS status
      FROM perlawanan p JOIN users u ON u.id=p.user_id
      WHERE ${DISTRICT_MATCH_SCOPE} AND p.tarikh>=?
      ORDER BY p.tarikh ASC LIMIT 10
    `).bind(districtId, persatuanId, dateParts).all(),
  ]);
  const total = Number(matches?.total ?? 0);
  const verified = Number(matches?.verified ?? 0);
  return json({
    error: false,
    overview: {
      total_referees: Number(referees?.total ?? 0),
      pending_applications: Number(applications?.pending ?? 0),
      approved_applications: Number(applications?.approved ?? 0),
      total_matches: total,
      matches_this_month: Number(matches?.this_month ?? 0),
      verified_matches: verified,
      verification_rate: total ? Math.round(verified / total * 1000) / 10 : 0,
      pending_matches: Number(matches?.pending ?? 0),
    },
    top_referees: topReferees.results,
    current_assignments: currentAssignments.results,
  });
}
