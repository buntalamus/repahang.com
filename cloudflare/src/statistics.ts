import { currentUser, json } from './auth';
import type { Env } from './types';

type Row = Record<string, unknown>;
type Counts = Record<string, number>;

function count(map: Counts, key: unknown): void {
  // PHP's ?? substitutes only NULL; an empty string is a distinct key.
  const name = typeof key === 'string' ? key : 'Tidak Dinyatakan';
  map[name] = (map[name] ?? 0) + 1;
}

function sorted(map: Counts): Counts {
  return Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1]));
}

function months(): Counts {
  return Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(index + 1), 0]));
}

function monthCount(map: Counts, value: unknown): void {
  if (typeof value !== 'string') return;
  const month = Number(value.slice(5, 7));
  if (Number.isInteger(month) && month >= 1 && month <= 12) map[String(month)]++;
}

function number(value: unknown): number {
  return Number(value) || 0;
}

function byDistrict(rows: Row[], withVerified: boolean): Row[] {
  const districts = new Map<string, Row>();
  for (const row of rows) {
    const name = String(row.daerah ?? 'Tanpa Daerah');
    let district = districts.get(name);
    if (!district) {
      district = { daerah: name, total: 0, ...(withVerified
        ? { disahkan: 0 } : { diterima: 0, ditolak: 0, belum: 0 }), pengadil: [] as Row[] };
      districts.set(name, district);
    }
    district.total = number(district.total) + number(row.total);
    if (withVerified) district.disahkan = number(district.disahkan) + number(row.disahkan);
    else {
      for (const field of ['diterima', 'ditolak', 'belum']) {
        district[field] = number(district[field]) + number(row[field]);
      }
    }
    (district.pengadil as Row[]).push({ id: row.pengadil_id ?? null,
      nama: row.nama_penuh, total: number(row.total), ...(withVerified
        ? { disahkan: number(row.disahkan) }
        : { diterima: number(row.diterima), ditolak: number(row.ditolak), belum: number(row.belum) }) });
  }
  return [...districts.values()].sort((a, b) => number(b.total) - number(a.total));
}

export async function statistics(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (actor.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  const requested = new URL(request.url).searchParams.get('year');
  const year = requested === null ? Number(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric',
  }).format(new Date())) : Number(requested);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return json({ error: true, message: 'Tahun tidak sah.' }, 400);
  }
  const yearText = String(year);
  const [referees, applications, matches, exams, ratings, telegram, appointmentStatus,
    districtAppointments, externalAppointments, districtMatches, tournaments] = await Promise.all([
    env.DB.prepare(`SELECT a.jantina,a.daerah AS alamat_daerah,p.nama_persatuan AS persatuan,
      a.status_kerja,COALESCE(a.status_kemaskini,a.tarikh_hantar) AS approval_date
      FROM permohonan a LEFT JOIN persatuan_bolasepak_daerah p ON p.id=a.persatuan_id
      WHERE a.status='Approved' AND a.tahun_permohonan=?
      AND (a.jenis_borang<>'pengadil_berdaftar' OR a.tahun_permohonan<2027
        OR a.jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan') OR a.status_ujian='Lulus')`)
      .bind(year).all<Row>(),
    env.DB.prepare(`SELECT status,status_workflow,tarikh_hantar,jenis_borang
      FROM permohonan WHERE substr(tarikh_hantar,1,4)=?`).bind(yearText).all<Row>(),
    env.DB.prepare(`SELECT p.user_id,p.jawatan,p.tarikh,p.tempat,p.jenis,u.nama_penuh
      FROM perlawanan p JOIN users u ON u.id=p.user_id
      WHERE substr(p.tarikh,1,4)=? AND p.lantikan_id IS NULL
        AND lower(u.role)='pengadil' ORDER BY p.id`).bind(yearText).all<Row>(),
    env.DB.prepare(`SELECT p.jenis_borang,p.jenis_permohonan,p.status_ujian,p.workflow_status,
      p.tarikh_hantar,p.daerah,pb.nama_persatuan
      FROM permohonan p LEFT JOIN persatuan_bolasepak_daerah pb ON pb.id=p.persatuan_id
      WHERE (p.jenis_borang IN ('ujian_kecergasan','ujian_bertulis','kelas3_fam','ujian_kelas1_fam')
        OR p.jenis_permohonan IN ('ujian_kecergasan','ujian_bertulis','kelas3_fam','ujian_kelas1_fam'))
        AND (substr(p.tarikh_hantar,1,4)=? OR p.tahun_permohonan=?)`)
      .bind(yearText, year).all<Row>(),
    env.DB.prepare(`SELECT lpp.lantikan_pengadil_id,lpp.markah,lpp.nama_pengadil,
      COALESCE(u.nama_penuh,lpp.nama_pengadil) AS nama,lp.pengadil_id AS ref_user_id
      FROM laporan_penilaian_pegawai lpp
      JOIN laporan_penilaian laporan ON laporan.id=lpp.laporan_id
      JOIN jadual_perlawanan jp ON jp.id=laporan.jadual_id
      LEFT JOIN lantikan_pengadil lp ON lp.id=lpp.lantikan_pengadil_id
      LEFT JOIN users u ON u.id=lp.pengadil_id
      WHERE lpp.markah IS NOT NULL AND laporan.status IN ('Dihantar','Disahkan')
        AND substr(jp.tarikh,1,4)=?`).bind(yearText).all<Row>(),
    env.DB.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN telegram_chat_id IS NOT NULL AND telegram_chat_id<>'' THEN 1 ELSE 0 END) AS linked
      FROM users WHERE aktif=1 AND email IS NOT NULL AND email<>''`).first<Row>(),
    env.DB.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN jp.status='Selesai' THEN 1 ELSE 0 END) AS selesai,
      SUM(CASE WHEN jp.status='Disahkan' THEN 1 ELSE 0 END) AS disahkan,
      SUM(CASE WHEN jp.status IN ('Belum Lantik','Menunggu Pengesahan') THEN 1 ELSE 0 END) AS belum
      FROM jadual_perlawanan jp JOIN kejohanan k ON k.id=jp.kejohanan_id
      WHERE substr(jp.tarikh,1,4)=?`).bind(yearText).first<Row>(),
    env.DB.prepare(`SELECT COALESCE(pb.daerah,'Tanpa Daerah') AS daerah,
      u.id AS pengadil_id,u.nama_penuh,COUNT(*) AS total,
      SUM(CASE WHEN lp.status='Diterima' THEN 1 ELSE 0 END) AS diterima,
      SUM(CASE WHEN lp.status='Ditolak' THEN 1 ELSE 0 END) AS ditolak,
      SUM(CASE WHEN lp.status='Belum Jawab' THEN 1 ELSE 0 END) AS belum
      FROM lantikan_pengadil lp JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN persatuan_bolasepak_daerah pb ON pb.id=u.persatuan_id
      WHERE substr(jp.tarikh,1,4)=?
      GROUP BY pb.daerah,u.id,u.nama_penuh ORDER BY daerah,total DESC`)
      .bind(yearText).all<Row>(),
    env.DB.prepare(`SELECT 'Pengadil Luar' AS daerah,NULL AS pengadil_id,pl.nama AS nama_penuh,
      COUNT(*) AS total,
      SUM(CASE WHEN lp.status='Diterima' THEN 1 ELSE 0 END) AS diterima,
      SUM(CASE WHEN lp.status='Ditolak' THEN 1 ELSE 0 END) AS ditolak,
      SUM(CASE WHEN lp.status='Belum Jawab' THEN 1 ELSE 0 END) AS belum
      FROM lantikan_pengadil lp JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
      WHERE substr(jp.tarikh,1,4)=? GROUP BY pl.id,pl.nama ORDER BY total DESC`)
      .bind(yearText).all<Row>(),
    env.DB.prepare(`SELECT COALESCE(pb.daerah,'Tanpa Daerah') AS daerah,
      u.id AS pengadil_id,u.nama_penuh,COUNT(*) AS total,
      SUM(CASE WHEN pr.status_pp='Disahkan' THEN 1 ELSE 0 END) AS disahkan
      FROM perlawanan pr JOIN users u ON u.id=pr.user_id
      LEFT JOIN persatuan_bolasepak_daerah pb ON pb.id=u.persatuan_id
      WHERE substr(pr.tarikh,1,4)=?
      GROUP BY pb.daerah,u.id,u.nama_penuh ORDER BY daerah,total DESC`)
      .bind(yearText).all<Row>(),
    env.DB.prepare(`SELECT k.nama,k.status,k.anjuran,COUNT(jp.id) AS jum_perlawanan,
      k.tarikh_mula,k.tarikh_akhir
      FROM kejohanan k LEFT JOIN jadual_perlawanan jp ON jp.kejohanan_id=k.id
        AND substr(jp.tarikh,1,4)=?
      WHERE substr(k.tarikh_mula,1,4)=? OR substr(k.tarikh_akhir,1,4)=?
      GROUP BY k.id ORDER BY k.tarikh_mula DESC`).bind(yearText, yearText, yearText).all<Row>(),
  ]);

  const genderBreakdown: Counts = { Lelaki: 0, Perempuan: 0 };
  const districtBreakdown: Counts = {};
  const districtAddressBreakdown: Counts = {};
  const employmentBreakdown: Counts = {};
  const monthlyTrend = months();
  for (const referee of referees.results) {
    const gender = String(referee.jantina ?? '').toLowerCase();
    const normalized = gender.charAt(0).toUpperCase() + gender.slice(1);
    if (normalized in genderBreakdown) genderBreakdown[normalized]++;
    count(districtBreakdown, referee.persatuan);
    count(districtAddressBreakdown, referee.alamat_daerah);
    count(employmentBreakdown, referee.status_kerja);
    monthCount(monthlyTrend, referee.approval_date);
  }

  const applicationStats = {
    total: applications.results.length, approved: 0,
    types: { pengadil_berdaftar: 0, penilai_berdaftar: 0, ujian_bertulis: 0, ujian_kelas1_fam: 0 } as Counts,
    statusBreakdown: { Menunggu: 0, Lengkap: 0, Ditolak: 0 } as Counts,
    monthlyTrend: months(),
  };
  for (const application of applications.results) {
    const workflow = application.status_workflow;
    const state = application.status;
    if (workflow === 'Lengkap' || state === 'Approved') applicationStats.statusBreakdown.Lengkap++;
    else if (workflow === 'Ditolak' || state === 'Rejected') applicationStats.statusBreakdown.Ditolak++;
    else applicationStats.statusBreakdown.Menunggu++;
    const type = String(application.jenis_borang ?? '').toLowerCase();
    if (type in applicationStats.types) applicationStats.types[type]++;
    monthCount(applicationStats.monthlyTrend, application.tarikh_hantar);
  }
  applicationStats.approved = applicationStats.statusBreakdown.Lengkap;

  const uniqueMatches = new Set<string>();
  const leadMatchCount = new Map<number, { name: string; count: number }>();
  for (const match of matches.results) {
    // MySQL COUNT(DISTINCT CONCAT(...)) ignores NULL and uses a case-insensitive collation.
    if (match.tarikh != null && match.tempat != null && match.jenis != null) {
      uniqueMatches.add(`${match.tarikh}${match.tempat}${match.jenis}`.toLowerCase());
    }
    const id = number(match.user_id);
    const name = String(match.nama_penuh ?? 'Tidak Dinyatakan');
    if (match.jawatan === 'Pengadil') {
      const lead = leadMatchCount.get(id) ?? { name, count: 0 };
      lead.count++; leadMatchCount.set(id, lead);
    }
  }
  const topPengadil = [...leadMatchCount.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  const mostActive = topPengadil[0] ?? { name: null, count: 0 };
  const matchStats = {
    uniqueMatches: uniqueMatches.size, total: matches.results.length,
    pengadilTotal: [...leadMatchCount.values()].reduce((sum, row) => sum + row.count, 0),
    pengadilUniqueCount: leadMatchCount.size, mostActivePengadil: mostActive,
    topPengadil, officiated: matches.results.length, mostActive, topReferees: topPengadil,
  };

  const examStats: Record<string, Row> = {};
  for (const type of ['ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam']) {
    examStats[type] = { total: 0, lulus: 0, tidak_lulus: 0, tidak_hadir: 0,
      belum_diproses: 0, monthly: months(), by_district: {} as Counts };
  }
  for (const exam of exams.results) {
    let type = String(exam.jenis_borang ?? exam.jenis_permohonan ?? '');
    if (type === 'kelas3_fam') type = 'ujian_bertulis';
    const stats = examStats[type];
    if (!stats) continue;
    stats.total = number(stats.total) + 1;
    const decision = exam.status_ujian ?? (
      exam.workflow_status === 'Approved' ? 'Lulus'
        : exam.workflow_status === 'Rejected' ? 'Tidak Lulus'
          : exam.workflow_status === 'Absent' ? 'Tidak Hadir' : null);
    const key = decision === 'Lulus' ? 'lulus' : decision === 'Tidak Lulus' ? 'tidak_lulus'
      : decision === 'Tidak Hadir' ? 'tidak_hadir' : 'belum_diproses';
    stats[key] = number(stats[key]) + 1;
    monthCount(stats.monthly as Counts, exam.tarikh_hantar);
    count(stats.by_district as Counts, exam.daerah ?? exam.nama_persatuan);
  }
  for (const stats of Object.values(examStats)) {
    const districts = stats.by_district as Counts;
    stats.by_district = Object.keys(districts).length ? sorted(districts) : [];
  }

  const perReferee = new Map<string, { nama: string; total: number; count: number; best: number }>();
  const distribution: Counts = { '1-3': 0, '4-5': 0, '6-7': 0, '8-9': 0, '10': 0 };
  let scoreTotal = 0;
  for (const row of ratings.results) {
    const value = number(row.markah);
    scoreTotal += value;
    const key = row.ref_user_id == null ? `luar_${row.lantikan_pengadil_id ?? 0}` : `user_${row.ref_user_id}`;
    const prior = perReferee.get(key) ?? { nama: String(row.nama ?? row.nama_pengadil ?? ''),
      total: 0, count: 0, best: 0 };
    prior.total += value; prior.count++; prior.best = Math.max(prior.best, value);
    perReferee.set(key, prior);
    const bucket = value >= 10 ? '10' : value >= 8 ? '8-9' : value >= 6 ? '6-7'
      : value >= 4 ? '4-5' : '1-3';
    distribution[bucket]++;
  }
  const rankings = [...perReferee.values()].map((row) => ({ nama: row.nama,
    avg: Math.round(row.total / row.count * 10) / 10, count: row.count, best: row.best }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 20);
  const ratingStats = { average: ratings.results.length
    ? Math.round(scoreTotal / ratings.results.length * 10) / 10 : 0,
  total: ratings.results.length, distribution, rankings };

  const data = {
    year, total: referees.results.length, genderBreakdown,
    districtBreakdown: sorted(districtBreakdown),
    districtAddressBreakdown: sorted(districtAddressBreakdown),
    employmentBreakdown: sorted(employmentBreakdown), monthlyTrend,
    applications: applicationStats, matches: matchStats, exams: examStats, ratings: ratingStats,
    telegram: { total: number(telegram?.total), linked: number(telegram?.linked) },
    lantikan: { total: number(appointmentStatus?.total), selesai: number(appointmentStatus?.selesai),
      disahkan: number(appointmentStatus?.disahkan), belum: number(appointmentStatus?.belum) },
    lantikanDaerah: byDistrict([...districtAppointments.results, ...externalAppointments.results], false),
    perlawananDaerah: byDistrict(districtMatches.results, true),
    kejohanan: tournaments.results.map((row) => ({ ...row, jum_perlawanan: number(row.jum_perlawanan) })),
  };
  return json({ error: false, data });
}
