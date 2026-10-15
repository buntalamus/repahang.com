import { currentUser, json } from './auth';
import type { Env } from './types';

type Row = Record<string, unknown>;

const OFFICIAL_ORDER = `CASE lpp.jawatan
  WHEN 'Pengadil' THEN 1
  WHEN 'Penolong Pengadil 1' THEN 2
  WHEN 'Penolong Pengadil 2' THEN 3
  WHEN 'Pegawai ke4' THEN 4 ELSE 5 END`;
const JSON_COLUMNS = [
  'kawalan_kekuatan', 'kawalan_kelemahan',
  'fizikal_kekuatan', 'fizikal_kelemahan',
  'kerjasama_kekuatan', 'kerjasama_kelemahan',
] as const;

function reportId(request: Request): number | null {
  const raw = new URL(request.url).searchParams.get('id');
  if (raw === null) return null;
  const id = Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function decodeOfficial(row: Row): Row {
  const result = { ...row };
  for (const column of JSON_COLUMNS) {
    if (typeof result[column] !== 'string') continue;
    try {
      const parsed: unknown = JSON.parse(result[column]);
      result[column] = Array.isArray(parsed) ? parsed : [];
    } catch {
      result[column] = [];
    }
  }
  return result;
}

/** Confirmed RA reports visible to a KUP official appointed to that report. */
export async function refereeAssessments(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Pengadil') return json({ error: true, message: 'Akses ditolak.' }, 403);

  const id = reportId(request);
  if (id !== null) {
    const report = await env.DB.prepare(`
      SELECT lp.id, lp.jadual_id, lp.tahap_kesukaran, lp.ulasan_keseluruhan,
             lp.status, lp.tarikh_hantar, lp.catatan_admin, lp.tarikh_sahkan,
             lp.created_at, jp.no_perlawanan, jp.tarikh, jp.masa,
             jp.pasukan_home, jp.pasukan_away, jp.tempat,
             k.nama AS nama_kejohanan,
             COALESCE(u_pen.nama_penuh,pl_pen.nama) AS nama_penilai
      FROM laporan_penilaian lp
      JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id
      LEFT JOIN users u_pen ON u_pen.id=lp.penilai_id
      LEFT JOIN lantikan_pengadil lp2 ON lp2.id=lp.lantikan_id
      LEFT JOIN pengadil_luar pl_pen ON pl_pen.id=lp2.pengadil_luar_id
      WHERE lp.id=? AND lp.status='Disahkan'
    `).bind(id).first<Row>();
    if (!report) return json({ error: true, message: 'Laporan tidak dijumpai.' }, 404);

    const officials = await env.DB.prepare(`
      SELECT lpp.*, la.pengadil_id
      FROM laporan_penilaian_pegawai lpp
      LEFT JOIN lantikan_pengadil la ON la.id=lpp.lantikan_pengadil_id
      WHERE lpp.laporan_id=? ORDER BY ${OFFICIAL_ORDER}
    `).bind(id).all<Row>();
    const pegawai = officials.results.map(decodeOfficial);
    const myEntry = pegawai.find((row) => Number(row.pengadil_id) === user.id);
    if (!myEntry) {
      return json({ error: true, message: 'Anda tidak mempunyai akses kepada laporan ini.' }, 403);
    }
    return json({ error: false, data: { ...report, pegawai, my_entry: myEntry } });
  }

  const reports = await env.DB.prepare(`
    SELECT lp.id, lp.jadual_id, lp.tahap_kesukaran, lp.ulasan_keseluruhan,
           lp.status, lp.tarikh_sahkan, lp.created_at,
           jp.no_perlawanan, jp.tarikh, jp.masa, jp.pasukan_home,
           jp.pasukan_away, k.nama AS nama_kejohanan,
           COALESCE(u_pen.nama_penuh,pl_pen.nama) AS nama_penilai,
           lpp.jawatan AS my_jawatan, lpp.markah AS my_markah,
           lpp.prestasi AS my_prestasi
    FROM laporan_penilaian_pegawai lpp
    JOIN lantikan_pengadil la ON la.id=lpp.lantikan_pengadil_id
    JOIN laporan_penilaian lp ON lp.id=lpp.laporan_id
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    LEFT JOIN users u_pen ON u_pen.id=lp.penilai_id
    LEFT JOIN lantikan_pengadil lp2 ON lp2.id=lp.lantikan_id
    LEFT JOIN pengadil_luar pl_pen ON pl_pen.id=lp2.pengadil_luar_id
    WHERE la.pengadil_id=? AND lp.status='Disahkan'
    ORDER BY jp.tarikh DESC
  `).bind(user.id).all<Row>();
  return json({ error: false, data: reports.results });
}

/** Confirmed reports involving at least one official in the PP's persatuan. */
export async function districtAssessments(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'PP Daerah') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (!user.persatuan_id) return json({ error: true, message: 'Persatuan ID tidak ditemui.' }, 400);

  const id = reportId(request);
  if (id !== null) {
    const report = await env.DB.prepare(`
      SELECT lp.*, jp.no_perlawanan, jp.tarikh, jp.masa,
             jp.pasukan_home, jp.pasukan_away, jp.tempat,
             k.nama AS nama_kejohanan,
             COALESCE(u_pen.nama_penuh,pl_pen.nama) AS nama_penilai
      FROM laporan_penilaian lp
      JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id
      LEFT JOIN users u_pen ON u_pen.id=lp.penilai_id
      LEFT JOIN lantikan_pengadil lp2 ON lp2.id=lp.lantikan_id
      LEFT JOIN pengadil_luar pl_pen ON pl_pen.id=lp2.pengadil_luar_id
      WHERE lp.id=? AND lp.status='Disahkan'
    `).bind(id).first<Row>();
    if (!report) return json({ error: true, message: 'Laporan tidak dijumpai.' }, 404);

    const officials = await env.DB.prepare(`
      SELECT lpp.*, la.pengadil_id, u.persatuan_id, u.role
      FROM laporan_penilaian_pegawai lpp
      LEFT JOIN lantikan_pengadil la ON la.id=lpp.lantikan_pengadil_id
      LEFT JOIN users u ON u.id=la.pengadil_id
      WHERE lpp.laporan_id=? ORDER BY ${OFFICIAL_ORDER}
    `).bind(id).all<Row>();
    const canRead = officials.results.some((row) =>
      Number(row.persatuan_id) === user.persatuan_id
      && ['Pengadil', 'Penilai'].includes(String(row.role)));
    if (!canRead) {
      return json({ error: true, message: 'Laporan ini tiada pengadil dalam daerah anda.' }, 403);
    }
    const pegawai = officials.results.map((row) => {
      const { persatuan_id: _persatuanId, role: _role, ...rest } = row;
      return decodeOfficial(rest);
    });
    return json({ error: false, laporan: { ...report, pegawai } });
  }

  const reports = await env.DB.prepare(`
    SELECT DISTINCT lp.id, lp.jadual_id, lp.tahap_kesukaran, lp.status,
           lp.tarikh_hantar, lp.tarikh_sahkan,
           lp.skor_ht_home, lp.skor_ht_away, lp.skor_ft_home,
           lp.skor_ft_away, jp.no_perlawanan, jp.tarikh, jp.masa,
           jp.pasukan_home, jp.pasukan_away, jp.tempat,
           k.nama AS nama_kejohanan,
           COALESCE(u_pen.nama_penuh,pl_pen.nama) AS nama_penilai
    FROM laporan_penilaian lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    LEFT JOIN users u_pen ON u_pen.id=lp.penilai_id
    LEFT JOIN lantikan_pengadil lp2 ON lp2.id=lp.lantikan_id
    LEFT JOIN pengadil_luar pl_pen ON pl_pen.id=lp2.pengadil_luar_id
    WHERE lp.status='Disahkan' AND EXISTS (
      SELECT 1 FROM laporan_penilaian_pegawai lpp
      JOIN lantikan_pengadil la ON la.id=lpp.lantikan_pengadil_id
      JOIN users u ON u.id=la.pengadil_id
      WHERE lpp.laporan_id=lp.id AND u.persatuan_id=?
        AND u.role IN ('Pengadil','Penilai')
    )
    ORDER BY jp.tarikh DESC
  `).bind(user.persatuan_id).all<Row>();

  const summaries = await env.DB.prepare(`
    SELECT lpp.laporan_id, lpp.jawatan, lpp.nama_pengadil,
           lpp.markah, lpp.prestasi
    FROM laporan_penilaian_pegawai lpp
    JOIN laporan_penilaian lp ON lp.id=lpp.laporan_id
    WHERE lp.status='Disahkan' AND EXISTS (
      SELECT 1 FROM laporan_penilaian_pegawai mine
      JOIN lantikan_pengadil la ON la.id=mine.lantikan_pengadil_id
      JOIN users u ON u.id=la.pengadil_id
      WHERE mine.laporan_id=lp.id AND u.persatuan_id=?
        AND u.role IN ('Pengadil','Penilai')
    )
    ORDER BY lpp.laporan_id, ${OFFICIAL_ORDER}
  `).bind(user.persatuan_id).all<Row>();
  const byReport = new Map<number, Row[]>();
  for (const summary of summaries.results) {
    const reportId = Number(summary.laporan_id);
    const list = byReport.get(reportId) ?? [];
    const { laporan_id: _laporanId, ...rest } = summary;
    list.push(rest);
    byReport.set(reportId, list);
  }
  return json({ error: false, data: reports.results.map((report) => ({
    ...report, pegawai: byReport.get(Number(report.id)) ?? [],
  })) });
}
