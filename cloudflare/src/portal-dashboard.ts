import { currentUser, json, type SessionUser } from './auth';
import { publishedAppointmentSql } from './appointment-publication';
import { APPLICATION_CATEGORY_SQL, countApplicationRows } from './application-category';
import type { Env } from './types';

type Row = Record<string, string | number | null>;
const dateNow = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kuala_Lumpur',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  second: '2-digit', hour12: false }).format(new Date());
const num = (value: unknown) => Number(value) || 0;
const monthRows = () => Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, verified: 0 }));
const pending = (value: unknown) => value == null || value === '' || value === 'Belum Disahkan';

/** Read-only dashboards: portal role scopes district data; capabilities scope personal work. */
export async function portalDashboard(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah.' }, 401);
  const params = new URL(request.url).searchParams;
  const view = params.get('view') ?? (user.role === 'PP Daerah' ? 'pp' : user.role === 'Penilai' ? 'ra' : 'pengadil');
  if (!['pp', 'ra', 'pengadil'].includes(view)) return json({ error: true, message: 'Paparan tidak sah.' }, 422);
  if ((view === 'pp' && (user.role !== 'PP Daerah' || !user.persatuan_id)) ||
      (view === 'ra' && user.can_ra !== 1) || (view === 'pengadil' && user.can_referee !== 1)) {
    return json({ error: true, message: 'Akses ditolak.' }, 403);
  }
  const currentYear = Number(dateNow().slice(0, 4));
  const rawYear = params.get('year') ?? String(currentYear);
  if (!/^\d{4}$/.test(rawYear) || Number(rawYear) < 2000 || Number(rawYear) > 2100) {
    return json({ error: true, message: 'Tahun tidak sah.' }, 422);
  }
  const year = Number(rawYear);
  const data = view === 'pp' ? await districtData(env, user, year) : await personalData(env, user, year, view === 'ra');
  return json({ error: false, data: { ...data, view, year, updated_at: dateNow(),
    name: user.nama_penuh, district: user.persatuan_nama,
    can_ra: user.can_ra === 1, can_referee: user.can_referee === 1 } });
}

async function districtData(env: Env, user: SessionUser, year: number) {
  const pid = user.persatuan_id!;
  const district = await env.DB.prepare(`SELECT d.id FROM districts d JOIN persatuan_bolasepak_daerah b
    ON b.daerah=d.nama WHERE b.id=?`).bind(pid).first<{ id: number }>();
  const [records, applications, referees, review, upcoming, announcements] = await Promise.all([
    env.DB.prepare(`SELECT p.id,p.match_group_id,p.lantikan_id,a.jadual_id,p.tarikh,p.status_pp,
      u.id AS user_id,u.nama_penuh,u.role AS user_role FROM perlawanan p JOIN users u ON u.id=p.user_id
      LEFT JOIN lantikan_pengadil a ON a.id=p.lantikan_id
      WHERE substr(p.tarikh,1,4)=? AND ((p.match_group_id IS NOT NULL AND p.daerah_perlawanan_id=?)
        OR (p.match_group_id IS NULL AND u.persatuan_id=? AND u.role IN ('Pengadil','PP Daerah')))`)
      .bind(String(year), district?.id ?? 0, pid).all<Row>(),
    env.DB.prepare(`SELECT ${APPLICATION_CATEGORY_SQL} AS application_category,p.status,p.status_workflow,p.workflow_status
      FROM permohonan p JOIN users u ON u.id=p.user_id WHERE u.persatuan_id=? AND p.tahun_permohonan=?`)
      .bind(pid, year).all<Row>(),
    env.DB.prepare(`SELECT COUNT(DISTINCT u.id) AS registered,
      COUNT(DISTINCT CASE WHEN (p.tahun_permohonan>=2027 AND p.status_ujian='Lulus') OR
        (p.tahun_permohonan<2027 AND (SELECT f.status_ujian FROM permohonan f
          WHERE f.user_id=u.id AND f.tahun_permohonan=p.tahun_permohonan AND f.jenis_borang='ujian_kecergasan'
          ORDER BY f.id DESC LIMIT 1)='Lulus') THEN u.id END) AS licensed
      FROM users u JOIN permohonan p ON p.user_id=u.id WHERE u.persatuan_id=? AND u.aktif=1
        AND p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan=? AND p.status='Approved'
        AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')`)
      .bind(pid, year).first<Row>(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM permohonan WHERE persatuan_id=?
      AND status_workflow='Menunggu PP Daerah' AND (user_id IS NULL OR user_id<>?)`)
      .bind(pid, user.id).first<Row>(),
    env.DB.prepare(`SELECT j.id,j.tarikh AS date,j.masa AS time,j.tempat AS subtitle,
      j.pasukan_home||' lwn '||j.pasukan_away AS title,k.nama AS tournament,
      GROUP_CONCAT(COALESCE(u.nama_penuh,pl.nama)||' ('||a.jawatan||')', ', ') AS officials
      FROM jadual_perlawanan j JOIN kejohanan k ON k.id=j.kejohanan_id
      JOIN lantikan_pengadil a ON a.jadual_id=j.id
      LEFT JOIN users u ON u.id=a.pengadil_id LEFT JOIN pengadil_luar pl ON pl.id=a.pengadil_luar_id
      WHERE a.status IN ('Diterima','Belum Jawab') AND j.status NOT IN ('Dibatalkan','Ditangguhkan')
        AND ${publishedAppointmentSql('a')}
        AND (j.tarikh>? OR (j.tarikh=? AND COALESCE(NULLIF(j.masa,''),'23:59:59')>=?))
        AND (k.lantikan_persatuan_id=? OR u.persatuan_id=?)
      GROUP BY j.id ORDER BY j.tarikh,j.masa,j.id LIMIT 6`)
      .bind(dateNow().slice(0, 10), dateNow().slice(0, 10), dateNow().slice(11), pid, pid).all<Row>(),
    env.DB.prepare('SELECT id,title,content,created_at FROM announcements ORDER BY created_at DESC,id DESC LIMIT 3').all<Row>(),
  ]);
  const groups = new Map<string, Row[]>();
  const top = new Map<number, { name: string; total: number; verified: number }>();
  let legacy = 0;
  for (const record of records.results) {
    // Never infer an official match identity from similar team names or dates.
    const key = record.match_group_id ? `group:${record.match_group_id}` : record.jadual_id
      ? `schedule:${record.jadual_id}` : `legacy:${record.id}`;
    if (key.startsWith('legacy:')) legacy++;
    const group = groups.get(key) ?? []; group.push(record); groups.set(key, group);
    const official = top.get(num(record.user_id)) ?? { name: String(record.nama_penuh), total: 0, verified: 0 };
    official.total++; if (record.status_pp === 'Disahkan') official.verified++;
    top.set(num(record.user_id), official);
  }
  const monthly = monthRows();
  for (const group of groups.values()) {
    const month = num(String(group[0].tarikh).slice(5, 7));
    if (month >= 1 && month <= 12) {
      monthly[month - 1].total++;
      if (group.every(row => row.status_pp === 'Disahkan')) monthly[month - 1].verified++;
    }
  }
  const totals = { registered: num(referees?.registered), licensed: num(referees?.licensed),
    records: records.results.length, verified: records.results.filter(r => r.status_pp === 'Disahkan').length,
    pending: records.results.filter(r => pending(r.status_pp)).length,
    rejected: records.results.filter(r => r.status_pp === 'Tidak Disahkan').length,
    pending_units: new Set(records.results.filter(r => pending(r.status_pp) && (r.match_group_id || r.user_role === 'Pengadil')).map(r => r.match_group_id ? `group:${r.match_group_id}` : `row:${r.id}`)).size,
    match_units: groups.size, identified_matches: groups.size - legacy, legacy_records: legacy,
    review_applications: num(review?.total) };
  return { totals, monthly, applications: countApplicationRows(applications.results),
    upcoming: upcoming.results, recent: [], registrations: [], announcements: announcements.results,
    ranking: [...top.values()].filter(r => r.verified > 0).sort((a, b) => b.verified - a.verified || a.name.localeCompare(b.name)).slice(0, 5),
    unit_note: 'Satu perlawanan boleh mempunyai beberapa rekod pegawai. Rekod lama yang belum dipadankan kekal berasingan dan bukan jumlah perlawanan unik.' };
}

async function personalData(env: Env, user: SessionUser, year: number, ra: boolean) {
  const [assignments, reports, records, registrations, settings, announcements] = await Promise.all([
    env.DB.prepare(`SELECT a.id,a.jawatan,a.status,a.notif_hantar,a.tarikh_notif,j.id AS jadual_id,
      j.tarikh AS date,j.masa AS time,j.tempat AS subtitle,k.nama AS tournament,k.jenis_kejohanan,
      j.pasukan_home||' lwn '||j.pasukan_away AS title,j.status AS match_status
      FROM lantikan_pengadil a JOIN jadual_perlawanan j ON j.id=a.jadual_id JOIN kejohanan k ON k.id=j.kejohanan_id
      WHERE a.pengadil_id=? AND ${publishedAppointmentSql('a')}
        AND (?=0 OR a.jawatan='Penilai Pengadil') ORDER BY j.tarikh,j.masa,a.id`)
      .bind(user.id, ra ? 1 : 0).all<Row>(),
    ra ? env.DB.prepare(`SELECT r.id,r.lantikan_id,r.status,j.tarikh AS date,j.masa AS time,
      j.pasukan_home||' lwn '||j.pasukan_away AS title,k.nama AS tournament,r.tarikh_hantar,r.tarikh_sahkan
      FROM laporan_penilaian r JOIN jadual_perlawanan j ON j.id=r.jadual_id JOIN kejohanan k ON k.id=j.kejohanan_id
      WHERE r.penilai_id=? AND substr(j.tarikh,1,4)=? ORDER BY j.tarikh DESC,r.id DESC`)
      .bind(user.id, String(year)).all<Row>() : Promise.resolve({ results: [] as Row[] }),
    ra ? env.DB.prepare(`SELECT DISTINCT a.pengadil_id,a.pengadil_luar_id,p.id AS row_id
      FROM laporan_penilaian_pegawai p JOIN laporan_penilaian r ON r.id=p.laporan_id
      JOIN jadual_perlawanan j ON j.id=r.jadual_id LEFT JOIN lantikan_pengadil a ON a.id=p.lantikan_pengadil_id
      WHERE r.penilai_id=? AND r.status='Disahkan' AND substr(j.tarikh,1,4)=?`)
      .bind(user.id, String(year)).all<Row>() : env.DB.prepare(`SELECT id,tarikh AS date,status_pp AS status,jawatan
      FROM perlawanan WHERE user_id=? AND substr(tarikh,1,4)=? ORDER BY tarikh DESC,id DESC`)
      .bind(user.id, String(year)).all<Row>(),
    env.DB.prepare(`SELECT p.id,p.jenis_borang,p.tahun_permohonan,p.status,p.status_workflow,p.status_seminar,
      CASE WHEN p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan<2027 THEN
        (SELECT f.status_ujian FROM permohonan f WHERE f.user_id=p.user_id AND f.tahun_permohonan=p.tahun_permohonan
          AND f.jenis_borang='ujian_kecergasan' ORDER BY f.id DESC LIMIT 1) ELSE p.status_ujian END AS status_ujian
      FROM permohonan p WHERE p.user_id=? AND p.tahun_permohonan=?
      ORDER BY p.id DESC LIMIT 20`).bind(user.id, year).all<Row>(),
    env.DB.prepare("SELECT setting_key,setting_value FROM application_settings WHERE setting_key IN ('min_verified_matches','application_year')").all<Row>(),
    env.DB.prepare('SELECT id,title,content,created_at FROM announcements ORDER BY created_at DESC,id DESC LIMIT 3').all<Row>(),
  ]);
  const today = dateNow().slice(0, 10), time = dateNow().slice(11);
  const active = assignments.results.filter(a => ['Diterima', 'Belum Jawab'].includes(String(a.status)) &&
    !['Dibatalkan', 'Ditangguhkan'].includes(String(a.match_status)));
  const response = active.filter(a => a.status === 'Belum Jawab');
  const upcoming = active.filter(a => String(a.date) > today || (a.date === today && String(a.time || '23:59:59') >= time));
  const selected = assignments.results.filter(a => String(a.date).startsWith(String(year)));
  const reportByAssignment = new Map(reports.results.map(r => [num(r.lantikan_id), r]));
  const monthly = monthRows();
  let totals: Record<string, number>;
  if (ra) {
    const accepted = selected.filter(a => a.status === 'Diterima');
    const identities = new Set(records.results.flatMap(r => r.pengadil_id ? [`user:${r.pengadil_id}`]
      : r.pengadil_luar_id ? [`external:${r.pengadil_luar_id}`] : []));
    totals = { assignments: selected.length, accepted: accepted.length,
      response: response.length, drafts: reports.results.filter(r => r.status === 'Draf').length,
      submitted: reports.results.filter(r => r.status === 'Dihantar').length,
      confirmed: reports.results.filter(r => r.status === 'Disahkan').length,
      no_report: accepted.filter(a => !reportByAssignment.has(num(a.id))).length,
      needs_report: accepted.filter(a => !reportByAssignment.has(num(a.id)) || reportByAssignment.get(num(a.id))?.status === 'Draf').length,
      assessed: identities.size, unlinked: records.results.filter(r => !r.pengadil_id && !r.pengadil_luar_id).length,
      rejected: selected.filter(a => a.status === 'Ditolak').length };
    for (const r of reports.results) { const month = num(String(r.date).slice(5, 7));
      if (month >= 1 && month <= 12) { monthly[month - 1].total++; if (r.status === 'Disahkan') monthly[month - 1].verified++; } }
  } else {
    totals = { records: records.results.length, verified: records.results.filter(r => r.status === 'Disahkan').length,
      pending: records.results.filter(r => pending(r.status)).length,
      rejected: records.results.filter(r => r.status === 'Tidak Disahkan').length, response: response.length };
    for (const r of records.results) { const month = num(String(r.date).slice(5, 7));
      if (month >= 1 && month <= 12) { monthly[month - 1].total++; if (r.status === 'Disahkan') monthly[month - 1].verified++; } }
  }
  const rules = Object.fromEntries(settings.results.map(r => [String(r.setting_key), num(r.setting_value)]));
  return { totals, monthly, upcoming: upcoming.slice(0, 6), responses: response.slice(0, 6),
    recent: reports.results.slice(0, 5), registrations: registrations.results, ranking: [],
    announcements: announcements.results, applications: {}, minimum_matches: rules.min_verified_matches || 20,
    application_year: rules.application_year || year + 1,
    positions: Object.entries(selected.reduce<Record<string, number>>((all, row) => {
      all[String(row.jawatan)] = (all[String(row.jawatan)] || 0) + 1; return all;
    }, {})).map(([label, total]) => ({ label, total })),
    unit_note: ra ? 'Pengadil unik merujuk individu dalam laporan yang disahkan. Rekod lama tanpa padanan individu dikira berasingan.'
      : 'Rekod peribadi diasingkan kepada disahkan, menunggu semakan dan tidak disahkan.' };
}
