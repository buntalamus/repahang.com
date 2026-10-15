/** Keep legacy application rows in the same category as their current form. */
export const APPLICATION_CATEGORY_SQL = `CASE
  WHEN p.jenis_borang='pengadil_berdaftar'
    AND UPPER(TRIM(COALESCE(p.jenis_pengadil,'')))='PENILAI PENGADIL'
    THEN 'penilai_berdaftar'
  WHEN p.jenis_borang='pengadil_berdaftar'
    AND UPPER(TRIM(COALESCE(p.jenis_pengadil,'')))='PEGAWAI PEMBANGUNAN'
    THEN 'pegawai_pembangunan'
  WHEN p.jenis_borang IN ('kelas3_fam','ujian_bertulis') THEN 'kelas3_fam'
  WHEN p.jenis_borang='pengadil_berdaftar' THEN 'pengadil_berdaftar'
  WHEN p.jenis_borang='penilai_berdaftar' THEN 'penilai_berdaftar'
  WHEN p.jenis_borang='ujian_kelas1_fam' THEN 'ujian_kelas1_fam'
  WHEN p.jenis_borang='ujian_kecergasan' THEN 'ujian_kecergasan'
  WHEN p.jenis_borang='pengadil_futsal' THEN 'pengadil_futsal'
  WHEN p.jenis_borang='pp_berdaftar' THEN 'pp_berdaftar'
  ELSE 'lain_lain' END`;

export const MAIN_APPLICATION_CATEGORIES = [
  'pengadil_berdaftar', 'penilai_berdaftar', 'kelas3_fam', 'ujian_kelas1_fam',
] as const;

export type ApplicationCount = { total: number; pending: number; approved: number; rejected: number };

export function emptyApplicationCounts(): Record<string, ApplicationCount> {
  return Object.fromEntries(MAIN_APPLICATION_CATEGORIES.map((key) =>
    [key, { total: 0, pending: 0, approved: 0, rejected: 0 }]));
}

export function applicationStatus(row: Record<string, unknown>): 'pending' | 'approved' | 'rejected' {
  const workflow = String(row.status_workflow ?? '');
  const examWorkflow = String(row.workflow_status ?? '');
  const status = String(row.status ?? '');
  if (workflow === 'Ditolak' || examWorkflow === 'Rejected' || status === 'Rejected') return 'rejected';
  if (workflow === 'Lengkap' || examWorkflow === 'Approved' || status === 'Approved') return 'approved';
  return 'pending';
}

export function countApplicationRows(rows: Record<string, unknown>[]): Record<string, ApplicationCount> {
  const counts = emptyApplicationCounts();
  for (const row of rows) {
    const key = String(row.application_category ?? 'lain_lain');
    const item = counts[key] ??= { total: 0, pending: 0, approved: 0, rejected: 0 };
    item.total++;
    item[applicationStatus(row)]++;
  }
  return counts;
}
