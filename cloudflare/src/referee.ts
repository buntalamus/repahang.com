import { currentUser, json } from './auth';
import type { Env } from './types';

function pageNumber(value: string | null, fallback: number): number {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

/** The appointment picker and referee search use the same active-user list. */
export async function activeReferees(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (!['Pengadil', 'Penilai', 'PP Daerah', 'Admin'].includes(user.role)) {
    return json({ error: true, message: 'Akses ditolak.' }, 403);
  }

  const referees = await env.DB.prepare(`
    SELECT u.id, u.nama_penuh, u.role, u.no_ic AS no_kp, u.jenis_pengadil,
           u.no_telefon, u.saiz_baju, u.email, u.url_gambar_profil,
           u.daerah, u.negeri, p.nama_persatuan AS persatuan_nama
    FROM users u
    LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id
    WHERE (u.role IN ('Pengadil','PP Daerah','Penilai')
           OR u.jenis_pengadil='Penilai Pengadil')
      AND u.aktif=1
    ORDER BY u.nama_penuh ASC
  `).all();
  return json({ error: false, data: referees.results });
}

/** The legacy referee dashboard and match list share this owner-scoped feed. */
export async function refereeMatches(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Pengadil') return json({ error: true, message: 'Akses ditolak.' }, 403);

  const params = new URL(request.url).searchParams;
  const page = Math.min(pageNumber(params.get('page'), 1), 1000000);
  const perPage = Math.min(pageNumber(params.get('per_page'), 10), 100);
  const offset = (page - 1) * perPage;
  const year = Number(new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date()));

  const [count, matches, yearStats] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS total FROM perlawanan WHERE user_id=?')
      .bind(user.id).first<{ total: number }>(),
    env.DB.prepare(`
      SELECT p.id, p.match_group_id, p.tarikh, p.masa, p.jenis,
             p.nama_kejohanan, p.tempat, p.jawatan, p.status_pp,
             p.catatan_pp, p.verified_at, p.created_at, p.home_team,
             p.away_team, p.lantikan_id, p.submitted_by,
             p.daerah_perlawanan_id, p.skor_ht_home, p.skor_ht_away,
             p.skor_ft_home, p.skor_ft_away, p.skor_et_home,
             p.skor_et_away, p.skor_ps_home, p.skor_ps_away, p.cuaca,
             d.nama AS daerah_perlawanan_nama,
             u_reporter.nama_penuh AS reporter_name,
             u_submitter.nama_penuh AS submitter_name,
             u1.nama_penuh AS head_referee_name,
             u2.nama_penuh AS assistant_referee_1_name,
             u3.nama_penuh AS assistant_referee_2_name,
             u4.nama_penuh AS fourth_official_name
      FROM perlawanan p
      LEFT JOIN users u_reporter ON p.user_id=u_reporter.id
      LEFT JOIN users u_submitter ON p.submitted_by=u_submitter.id
      LEFT JOIN users u1 ON p.head_referee_id=u1.id
      LEFT JOIN users u2 ON p.assistant_referee_1_id=u2.id
      LEFT JOIN users u3 ON p.assistant_referee_2_id=u3.id
      LEFT JOIN users u4 ON p.fourth_official_id=u4.id
      LEFT JOIN districts d ON p.daerah_perlawanan_id=d.id
      WHERE p.user_id=? ORDER BY p.tarikh DESC, p.id DESC LIMIT ? OFFSET ?
    `).bind(user.id, perPage, offset).all(),
    env.DB.prepare(`
      SELECT COUNT(*) AS current_year,
             SUM(CASE WHEN status_pp='Disahkan' THEN 1 ELSE 0 END) AS verified_year
      FROM perlawanan WHERE user_id=? AND substr(tarikh,1,4)=?
    `).bind(user.id, String(year)).first<{ current_year: number; verified_year: number | null }>(),
  ]);
  const total = Number(count?.total ?? 0);
  const verified = Number(yearStats?.verified_year ?? 0);
  return json({
    error: false,
    matches: matches.results,
    statistics: {
      total,
      current_year: Number(yearStats?.current_year ?? 0),
      verified_year: verified,
      year,
      minimum_required: 20,
      eligible: verified >= 20,
    },
    pagination: {
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
      total_items: total,
    },
  });
}

export async function ownApplications(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  const allowed = ['Pengadil', 'Penilai', 'PP Daerah'].includes(user.role)
    || (user.role === 'Admin' && user.jenis_pengadil === 'Penilai Pengadil');
  if (!allowed) return json({ error: true, message: 'Akses ditolak.' }, 403);

  const type = new URL(request.url).searchParams.get('jenis_borang');
  if (type && type.length > 80) return json({ error: true, message: 'Jenis borang tidak sah.' }, 400);
  const applications = await env.DB.prepare(`
    SELECT id, jenis_borang, nama_penuh, no_kp, emel, no_telefon,
           jantina, jenis_pengadil, status_workflow AS status,
           payment_amount, tarikh_hantar,
           CASE WHEN tarikh_hantar IS NULL THEN NULL
             ELSE strftime('%d/%m/%Y',tarikh_hantar) END AS tarikh_mohon,
           pp_verified_at, pp_notes, admin_approved_at,
           admin_notes AS catatan, tahun_permohonan, status_ujian
    FROM permohonan WHERE user_id=? AND (? IS NULL OR jenis_borang=?)
    ORDER BY tarikh_hantar DESC, id DESC
  `).bind(user.id, type, type).all();
  return json({
    error: false,
    applications: applications.results,
    message: applications.results.length ? '' : 'Tiada permohonan dijumpai.',
  });
}
