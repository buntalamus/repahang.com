import { currentUser, json } from './auth';
import { usersOverviewStatement } from './admin-users';
import {
  ANNUAL_COLUMNS,
  MASTER_DATASETS,
  USER_COLUMNS,
  type MasterCell,
  type MasterDataset,
} from './user-master-data-schema';
import type { Env } from './types';

type Row = Record<string, MasterCell>;
const MAX_ROWS = 60_000;
const MAX_JSON_BYTES = 40 * 1024 * 1024;
const owner: Record<string, string> = {
  assessor_applications: 'a.user_id',
  appointments: 'x.pengadil_id',
  pool: 'x.pengadil_id',
  reports: 'x.penilai_id',
  report_officials: 'l.pengadil_id',
  report_approvals: 'x.pengesah_user_id',
  tournament_approvers: 'x.pengesah_user_id',
  penilaian: 'x.pengadil_id',
  penilaian_pengadil: 'x.pengadil_id',
  legacy_match_officials: 'x.pengadil_id',
};

function datasetSql(dataset: MasterDataset, count = false): string {
  const context: Record<string, string> = {
    nama_kejohanan: 'k.nama',
    no_perlawanan: 'j.no_perlawanan',
    tarikh_perlawanan: 'j.tarikh',
    masa_perlawanan: 'j.masa',
    pasukan_home: 'j.pasukan_home',
    pasukan_away: 'j.pasukan_away',
    tempat_perlawanan: 'j.tempat',
  };
  const select = count
    ? 'COUNT(*) AS total'
    : dataset.columns
        .map((column) => {
          let expression = `${dataset.alias}.${column.key}`;
          if (column.key === 'user_id') expression = owner[dataset.key] || 'x.user_id';
          else if (column.key === 'nama_pengguna') expression = 'u.nama_penuh';
          else if (column.key === 'emel_pengguna') expression = 'u.email';
          else if (['appointments', 'reports'].includes(dataset.key) && context[column.key])
            expression = context[column.key];
          else if (
            ['pool', 'tournament_approvers'].includes(dataset.key) &&
            column.key === 'nama_kejohanan'
          )
            expression = 'k.nama';
          else if (dataset.key === 'report_officials' && column.key === 'penilai_id')
            expression = 'r.penilai_id';
          else if (dataset.key === 'report_officials' && column.key === 'nama_penilai')
            expression = 'ra.nama_penuh';
          return `${expression} AS ${column.key}`;
        })
        .join(',');
  return (
    `SELECT ${select} FROM ${dataset.from}${dataset.where ? ` WHERE ${dataset.where}` : ''}` +
    (count ? '' : ` ORDER BY x.id LIMIT ${MAX_ROWS + 1}`)
  );
}

function roleLabel(value: MasterCell): MasterCell {
  return value === 'PP Daerah'
    ? 'Pegawai Pembangunan Daerah'
    : value === 'Penilai'
      ? 'Penilai Pengadil'
      : value;
}

/** Admin only, complete business data, independent of screen filters/pagination. */
export async function adminUserMasterData(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET')
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  const params = new URL(request.url).searchParams;
  const yearText =
    params.get('year') ||
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric' }).format(
      new Date(),
    );
  if (!/^\d{4}$/.test(yearText) || Number(yearText) < 2000 || Number(yearText) > 2100) {
    return json({ error: true, message: 'Tahun rujukan tidak sah.' }, 422);
  }
  const year = Number(yearText);
  // Count first to avoid buffering an unexpectedly large dataset. Never silently truncate.
  const counts = await env.DB.batch<{ total: number }>([
    env.DB.prepare('SELECT COUNT(*) AS total FROM users'),
    ...MASTER_DATASETS.map((dataset) => env.DB.prepare(datasetSql(dataset, true))),
  ]);
  if (counts.reduce((sum, result) => sum + (result.results[0]?.total || 0), 0) > MAX_ROWS) {
    return json(
      {
        error: true,
        message:
          'Jumlah rekod terlalu besar untuk satu fail Excel. Hubungi pentadbir sistem untuk eksport penuh.',
      },
      413,
    );
  }
  const baseColumns = USER_COLUMNS.map((column) => {
    const expression =
      column.key === 'nama_daerah_pentadbiran'
        ? 'd.nama'
        : column.key === 'nama_persatuan'
          ? 'p.nama_persatuan'
          : column.key === 'kod_persatuan'
            ? 'p.kod_persatuan'
            : column.key === 'daerah_persatuan'
              ? 'p.daerah'
              : `u.${column.key}`;
    return `${expression} AS ${column.key}`;
  }).join(',');
  // D1 batch is transactional: the master rows, classifications and child records
  // are read together. No per-user query loop and no write or export cache.
  const results = await env.DB.batch<Row>([
    env.DB.prepare(`SELECT ${baseColumns} FROM users u
      LEFT JOIN districts d ON d.id=u.district_id
      LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id
      ORDER BY u.nama_penuh COLLATE NOCASE,u.id LIMIT ${MAX_ROWS + 1}`),
    usersOverviewStatement(env, year),
    ...MASTER_DATASETS.map((dataset) => env.DB.prepare(datasetSql(dataset))),
  ]);
  const annual = new Map(results[1].results.map((row) => [row.id, row]));
  const master = results[0].results.map((row) => {
    const status = annual.get(row.id);
    const label =
      Number(status?.is_referee) !== 1
        ? null
        : Number(status?.current_approved) === 1
          ? 'Pengadil Berdaftar'
          : Number(status?.current_applied) === 1
            ? 'Permohonan Belum Diluluskan'
            : Number(status?.prior_approved) === 1
              ? 'Pengadil Tidak Aktif'
              : 'Pengadil Baharu';
    const values: Row = {
      ...row,
      role: roleLabel(row.role),
      tahun_rujukan: year,
      status_pendaftaran: label,
    };
    for (const column of ANNUAL_COLUMNS) {
      if (!['tahun_rujukan', 'status_pendaftaran'].includes(column.key))
        values[column.key] = status?.[column.key] ?? null;
    }
    return values;
  });
  const sheets = [
    {
      key: 'users',
      name: 'Master Pengguna',
      description:
        'Satu baris setiap akaun pengguna, termasuk akaun tidak aktif. Profil terkini dan status bagi tahun rujukan.',
      columns: [...USER_COLUMNS, ...ANNUAL_COLUMNS],
      rows: master,
    },
    ...MASTER_DATASETS.map((dataset, index) => ({
      key: dataset.key,
      name: dataset.name,
      description: dataset.description,
      columns: dataset.columns,
      rows: results[index + 2].results,
    })),
  ];
  if (sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0) > MAX_ROWS) {
    return json(
      {
        error: true,
        message:
          'Jumlah rekod berubah dan melebihi had satu fail. Eksport dibatalkan supaya data tidak terpotong.',
      },
      413,
    );
  }
  const content = JSON.stringify({
    error: false,
    data: {
      schema_version: 1,
      year,
      exported_at: new Date().toISOString(),
      time_zone: 'Asia/Kuala_Lumpur',
      source: 'Portal RefPahang',
      sheets,
    },
  });
  if (content.length > MAX_JSON_BYTES || new Blob([content]).size > MAX_JSON_BYTES) {
    return json(
      {
        error: true,
        message: 'Saiz eksport terlalu besar. Eksport dibatalkan supaya data tidak terpotong.',
      },
      413,
    );
  }
  return new Response(content, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
