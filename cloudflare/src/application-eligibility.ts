/**
 * The eligibility rules shared by the application submission and the
 * Statistik eligibility lists, so both always agree.
 */
import { applicationSettingDefaults } from './applications';
import { missingRefereeProfile } from './referee-profile';
import type { Env } from './types';

export function klYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(now));
}

/** Age in the session year from the first two digits of the IC; null when unknown. */
export function ageInYear(ic: unknown, year: number, now = new Date()): number | null {
  const digits = String(ic ?? '').replace(/\D/g, '');
  if (digits.length < 6) return null;
  const yy = Number(digits.slice(0, 2));
  return year - (yy <= klYear(now) % 100 ? 2000 + yy : 1900 + yy);
}

/** The season whose verified matches count towards a session's annual registration. */
export const qualifyingMatchYear = (year: number): number => year - 1;
/** Kelas III FAM must be held at least two years before Ujian Kelas I FAM. */
export const classThreeDeadline = (year: number): number => year - 2;

/** Earliest year the user passed Kelas III FAM, from the profile or a passed application; 9999 if never. */
export const CLASS_THREE_YEAR_SQL = (alias: string): string => `MIN(
  COALESCE(CASE WHEN ${alias}.tahun_lulus_kelas3 GLOB '20[0-9][0-9]'
    THEN CAST(${alias}.tahun_lulus_kelas3 AS INTEGER) END, 9999),
  COALESCE((SELECT MIN(k.tahun_permohonan) FROM permohonan k WHERE k.user_id=${alias}.id
    AND k.jenis_borang IN ('kelas3_fam','ujian_bertulis') AND k.status_ujian='Lulus'), 9999))`;

type Candidate = Record<string, unknown> & {
  id: number; nama_penuh: string; role: string; jenis_pengadil: string | null; daerah: string;
  no_ic: string | null; can_referee: number; matches: number; kelas3_year: number;
};
export interface EligibleReferee {
  id: number; nama: string; daerah: string; jenis: string; umur: number | null;
  perlawanan?: number; tahun_lulus_kelas3?: number | null;
  permohonan: string | null; profil_lengkap: boolean;
}

const settingNumber = (value: string | undefined): number =>
  value === undefined || value.trim() === '' ? NaN : Number(value);

/** Referees eligible to apply, per form, for the session in the application_year setting. */
export async function eligibilityLists(env: Env) {
  const rows = await env.DB.prepare('SELECT setting_key,setting_value FROM application_settings')
    .all<{ setting_key: string; setting_value: string }>();
  const settings: Record<string, string> = { ...applicationSettingDefaults(),
    ...Object.fromEntries(rows.results.map((row) => [row.setting_key, row.setting_value])) };
  const year = Number(settings.application_year) || klYear();
  const matchYear = qualifyingMatchYear(year);
  const deadline = classThreeDeadline(year);
  const minimum = settingNumber(settings.min_verified_matches) || 20;
  const minAge = settingNumber(settings.bertulis_min_age);
  const maxAge = settingNumber(settings.bertulis_max_age);
  const classOneMax = settingNumber(settings.kelas1_max_age);
  // Users who may submit these forms: referees, and PP Daerah who are referees.
  const candidates = await env.DB.prepare(`SELECT u.id,u.nama_penuh,u.role,u.jenis_pengadil,u.no_ic,
      u.email,u.no_telefon,u.jantina,u.persatuan_id,u.alamat1,u.poskod,u.daerah AS alamat_daerah,u.negeri,
      u.status_kerja,u.jawatan,u.nama_majikan,u.alamat_majikan1,u.poskod_majikan,u.daerah_majikan,
      u.negeri_majikan,u.nama_waris,u.hubungan_waris,u.telefon_waris,u.url_gambar_profil,u.saiz_baju,
      u.tahun_mula_aktif,COALESCE(pb.daerah,'Tanpa Daerah') AS daerah,
      CASE WHEN u.role='Pengadil' OR (u.role='PP Daerah' AND
        (u.jenis_pengadil IN ('Pengadil Negeri','Pengadil Kebangsaan','Kelas III FAM','Kelas I FAM')
         OR EXISTS (SELECT 1 FROM permohonan ref WHERE ref.user_id=u.id
           AND ref.jenis_borang='pengadil_berdaftar' AND ref.status='Approved'
           AND COALESCE(ref.jenis_pengadil,'') NOT IN ('Penilai Pengadil','Pegawai Pembangunan'))))
        THEN 1 ELSE 0 END AS can_referee,
      (SELECT COUNT(*) FROM perlawanan m WHERE m.user_id=u.id AND m.status_pp='Disahkan'
        AND substr(m.tarikh,1,4)=?) AS matches,
      ${CLASS_THREE_YEAR_SQL('u')} AS kelas3_year
    FROM users u LEFT JOIN persatuan_bolasepak_daerah pb ON pb.id=u.persatuan_id
    WHERE u.aktif=1 AND u.role IN ('Pengadil','PP Daerah')
    ORDER BY u.nama_penuh`).bind(String(matchYear)).all<Candidate>();
  const applications = await env.DB.prepare(`SELECT user_id,jenis_borang,status_workflow FROM permohonan
    WHERE tahun_permohonan=? AND jenis_borang IN ('pengadil_berdaftar','kelas3_fam','ujian_kelas1_fam')`)
    .bind(year).all<{ user_id: number; jenis_borang: string; status_workflow: string | null }>();
  const applied = new Map(applications.results.map((row) =>
    [`${row.user_id}:${row.jenis_borang}`, row.status_workflow || 'Dihantar']));
  const notRa = (row: Candidate) => !['Penilai Pengadil', 'Pegawai Pembangunan']
    .includes((row.jenis_pengadil ?? '').trim());
  const entry = (row: Candidate, form: string, extra: Partial<EligibleReferee>): EligibleReferee => ({
    id: row.id, nama: row.nama_penuh, daerah: row.daerah, jenis: row.jenis_pengadil ?? '',
    umur: ageInYear(row.no_ic, year), permohonan: applied.get(`${row.id}:${form}`) ?? null,
    profil_lengkap: missingRefereeProfile({ ...row, daerah: row.alamat_daerah }).length === 0, ...extra,
  });
  const referees = candidates.results.filter((row) => Number(row.can_referee) === 1 && notRa(row));
  const classThree = (row: Candidate) => Number(row.kelas3_year) < 9999 ? Number(row.kelas3_year) : null;

  // Annual registration: the minimum verified matches of the previous season (PP Daerah are exempt).
  const berdaftar = referees.filter((row) => row.role === 'PP Daerah' || Number(row.matches) >= minimum)
    .map((row) => entry(row, 'pengadil_berdaftar', { perlawanan: Number(row.matches) }));
  // Kelas III FAM: age range in the session year, not already holding Kelas III or Kelas I.
  const kelas3 = referees.filter((row) => {
    const age = ageInYear(row.no_ic, year);
    return age !== null && age >= minAge && age <= maxAge && classThree(row) === null
      && !['Kelas III FAM', 'Kelas I FAM'].includes(row.jenis_pengadil ?? '');
  }).map((row) => entry(row, 'kelas3_fam', {}));
  // Ujian Kelas I FAM: age limit and Kelas III held by the deadline year.
  const ageOk = (row: Candidate) => { const age = ageInYear(row.no_ic, year); return age !== null && age <= classOneMax; };
  const kelas1 = referees.filter((row) => ageOk(row) && (classThree(row) ?? 9999) <= deadline
    && row.jenis_pengadil !== 'Kelas I FAM')
    .map((row) => entry(row, 'ujian_kelas1_fam', { tahun_lulus_kelas3: classThree(row) }));
  const kelas1MissingYear = referees.filter((row) => ageOk(row) && classThree(row) === null
    && ['Pengadil Negeri', 'Pengadil Kebangsaan'].includes(row.jenis_pengadil ?? '')).length;

  return {
    year, rules: { match_year: matchYear, min_matches: minimum, kelas3_min_age: minAge,
      kelas3_max_age: maxAge, kelas1_max_age: classOneMax, kelas3_deadline: deadline },
    berdaftar, kelas3, kelas1, kelas1_missing_kelas3_year: kelas1MissingYear,
  };
}
