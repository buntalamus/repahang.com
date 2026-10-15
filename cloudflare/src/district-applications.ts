import { currentUser, json } from './auth';
import type { Env } from './types';
import { APPLICATION_CATEGORY_SQL } from './application-category';

type Row = Record<string, unknown>;

const TYPES: Record<string, string> = {
  pengadil: 'pengadil_berdaftar',
  berdaftar: 'penilai_berdaftar',
  kelas3: 'kelas3_fam',
  kelas1: 'ujian_kelas1_fam',
};

/** Read-only PP Daerah application queue, scoped to the PP's persatuan. */
export async function districtApplications(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'PP Daerah') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (!user.persatuan_id) {
    return json({ error: true, message: 'Persatuan not assigned to your account.' }, 403);
  }

  const type = new URL(request.url).searchParams.get('type') ?? 'pengesahan';
  if (type !== 'pengesahan' && !Object.hasOwn(TYPES, type)) {
    return json({ error: true, message: 'Jenis tidak sah.' }, 400);
  }
  const category = type === 'pengesahan' ? null : TYPES[type];
  const filter = category === null
    ? "p.status_workflow='Menunggu PP Daerah'"
    : `${APPLICATION_CATEGORY_SQL}=? AND p.status_workflow IN
       ('Menunggu PP Daerah','PP Daerah Disahkan','Menunggu Admin',
        'Admin Diluluskan','Lengkap','Ditolak')`;
  const bindings = category === null ? [user.persatuan_id] : [user.persatuan_id, category];

  const rows = await env.DB.prepare(`
    SELECT p.*, ${APPLICATION_CATEGORY_SQL} AS application_category,
      pb.nama_persatuan AS district_name
    FROM permohonan p
    LEFT JOIN persatuan_bolasepak_daerah pb ON pb.id=p.persatuan_id
    WHERE p.persatuan_id=? AND ${filter}
    ORDER BY ${category === null ? '' : "(p.status_workflow='Menunggu PP Daerah') DESC,"}
             p.tarikh_hantar DESC
  `).bind(...bindings).all<Row>();

  // Fetch match history in one district-scoped query instead of one query per application.
  const matches = rows.results.length === 0 ? [] : (await env.DB.prepare(`
    SELECT pl.permohonan_id, pl.tarikh, pl.jenis, pl.tempat, pl.jawatan
    FROM perlawanan pl
    JOIN permohonan p ON p.id=pl.permohonan_id
    WHERE p.persatuan_id=? AND ${filter}
    ORDER BY pl.tarikh DESC
  `).bind(...bindings).all<Row>()).results;
  const byApplication = new Map<number, Row[]>();
  for (const match of matches) {
    const id = Number(match.permohonan_id);
    const list = byApplication.get(id) ?? [];
    const { permohonan_id: _id, ...entry } = match;
    list.push(entry);
    byApplication.set(id, list);
  }

  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit',
  }).format(new Date());
  const stats = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM permohonan
       WHERE persatuan_id=? AND status_workflow IN
         ('PP Daerah Disahkan','Menunggu Admin','Admin Diluluskan','Lengkap')
         AND pp_verified_at >= ?) AS approved_this_month,
      (SELECT COUNT(*) FROM users u WHERE u.persatuan_id=? AND u.aktif=1
        AND EXISTS (SELECT 1 FROM permohonan p WHERE p.user_id=u.id
          AND p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan=?
          AND p.status='Approved'
          AND COALESCE(p.jenis_pengadil,'') NOT IN ('Penilai Pengadil','Pegawai Pembangunan'))) AS total_referees
  `).bind(user.persatuan_id, `${month}-01`, user.persatuan_id,
    Number(month.slice(0, 4)))
    .first<{ approved_this_month: number; total_referees: number }>();

  return json({
    error: false,
    applications: rows.results.map((row) => ({
      ...row, perlawanan: byApplication.get(Number(row.id)) ?? [],
    })),
    statistics: {
      pending: rows.results.filter((row) => row.status_workflow === 'Menunggu PP Daerah').length,
      approved_this_month: Number(stats?.approved_this_month ?? 0),
      total_referees: Number(stats?.total_referees ?? 0),
    },
    persatuan_id: user.persatuan_id,
  });
}
