export type ExamKind = 'annual' | 'class3' | 'class1';
export type ExamResult = 'Lulus' | 'Tidak Lulus' | 'Tidak Hadir' | 'Belum direkodkan' | 'Tiada rekod';
export interface RefereeFilterRow {
  nama_penuh?: string | null; no_kp?: string | null; persatuan?: string | null;
  jenis_pengadil?: string | null; jantina?: string | null; fitness_status?: string | null;
  tahun_lulus_kelas1?: string | number | null;
  tahun_lulus_kelas3?: string | number | null;
  approved_applications?: { id?: number; jenis_borang?: string; tahun_permohonan?: string | number;
    status_ujian?: string | null }[];
}
export interface RefereeFilters {
  q: string; gender: string; qualification: string; annual: string; class3: string; class1: string;
}
export const examKinds: { key: ExamKind; label: string }[] = [
  { key: 'annual', label: 'Ujian kecergasan tahunan' },
  { key: 'class3', label: 'Ujian Kelas III FAM' },
  { key: 'class1', label: 'Ujian Kelas I FAM' },
];
export const examResults: ExamResult[] = ['Lulus', 'Tidak Lulus', 'Tidak Hadir', 'Belum direkodkan', 'Tiada rekod'];
const examTypes = { annual: ['ujian_kecergasan'], class3: ['kelas3_fam', 'ujian_bertulis'], class1: ['ujian_kelas1_fam'] };

export function refereeExamResult(row: RefereeFilterRow, kind: ExamKind, year: number): ExamResult {
  // Annual fitness is embedded in the registration from 2027; older years use a separate form.
  if (kind === 'annual') return normalizeResult(row.fitness_status, year >= 2027 ||
    (row.approved_applications ?? []).some(app => Number(app.tahun_permohonan) === year && app.jenis_borang === 'ujian_kecergasan'));
  const latest = (row.approved_applications ?? [])
    .filter(app => Number(app.tahun_permohonan) === year && examTypes[kind].includes(app.jenis_borang ?? ''))
    .reduce<(NonNullable<RefereeFilterRow['approved_applications']>)[number] | undefined>(
      (found, app) => !found || Number(app.id) > Number(found.id) ? app : found, undefined);
  return normalizeResult(latest?.status_ujian, Boolean(latest));
}

function normalizeResult(value: string | null | undefined, exists: boolean): ExamResult {
  return examResults.slice(0, 3).includes(value as ExamResult) ? value as ExamResult
    : exists ? 'Belum direkodkan' : 'Tiada rekod';
}

export function refereeQualification(row: RefereeFilterRow, year: number): 'class1' | 'class3' | 'unrecorded' {
  const passed = (kind: 'class1' | 'class3') => (row.approved_applications ?? []).some(app =>
    Number(app.tahun_permohonan) <= year && examTypes[kind].includes(app.jenis_borang ?? '') && app.status_ujian === 'Lulus');
  const seniorYear = Number(row.tahun_lulus_kelas1);
  if (passed('class1') || (seniorYear >= 1900 && seniorYear <= year)) return 'class1';
  const legacyYear = Number(row.tahun_lulus_kelas3);
  if (passed('class3') || (legacyYear >= 1900 && legacyYear <= year)) return 'class3';
  return 'unrecorded';
}

export function refereeQualificationLabel(row: RefereeFilterRow, year: number): string {
  return { class1: 'Kelas I FAM', class3: 'Kelas III FAM', unrecorded: 'Belum ada rekod kelulusan kelas' }[refereeQualification(row, year)];
}

export function filterReferees<T extends RefereeFilterRow>(rows: T[], filters: RefereeFilters, year: number): T[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter(row =>
    (filters.gender === 'all' || (row.jantina ?? '').toUpperCase() === filters.gender.toUpperCase()) &&
    (!q || [row.nama_penuh, row.no_kp, row.persatuan, row.jenis_pengadil].some(value => (value ?? '').toLowerCase().includes(q))) &&
    (filters.qualification === 'all' || refereeQualification(row, year) === filters.qualification) &&
    examKinds.every(({ key }) => filters[key] === 'all' || refereeExamResult(row, key, year) === filters[key]));
}

export function refereeFiltersFromParams(params: URLSearchParams): RefereeFilters {
  return { q: params.get('q') ?? '', gender: params.get('gender') ?? 'all',
    qualification: params.get('qualification') ?? 'all', annual: params.get('annual') ?? 'all',
    class3: params.get('class3') ?? 'all', class1: params.get('class1') ?? 'all' };
}
