/**
 * Which session year each application form belongs to.
 *
 * - Pendaftaran Tahunan (Pengadil / Penilai) registers for the coming season:
 *   it opens in the December before it, so the session comes from the
 *   'application_year' Admin setting (e.g. applied in 2026 for the 2027 licence).
 * - Kelas III FAM and Ujian Kelas I FAM are examinations held in the year they
 *   are applied for, so they always use the current Malaysian calendar year
 *   (applied in 2026 for 2026), whatever 'application_year' is set to.
 */
export function klYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(now));
}

/** Forms whose session is the calendar year they are submitted in. */
export const EXAM_FORMS = ['kelas3_fam', 'ujian_kelas1_fam'] as const;

export function isExamForm(type: string | null | undefined): boolean {
  return (EXAM_FORMS as readonly string[]).includes(String(type ?? ''));
}

/** The annual-registration session from Admin Settings; the current year when unset. */
export function annualSessionYear(settings: Record<string, string | undefined>, now = new Date()): number {
  return Number(settings.application_year) || klYear(now);
}

/** Kelas III / Kelas I FAM: the calendar year of submission. */
export function examYear(now = new Date()): number {
  return klYear(now);
}

/** The session year a form submitted today is recorded under. */
export function formSessionYear(type: string, settings: Record<string, string | undefined>, now = new Date()): number {
  return isExamForm(type) ? examYear(now) : annualSessionYear(settings, now);
}

export interface SessionYears { annual: number; exam: number }

export function sessionYears(settings: Record<string, string | undefined>, now = new Date()): SessionYears {
  return { annual: annualSessionYear(settings, now), exam: examYear(now) };
}

/** Session years keyed by the form windows the portal uses. */
export function windowYears(years: SessionYears): Record<'berdaftar' | 'penilai' | 'bertulis' | 'kelas1', number> {
  return { berdaftar: years.annual, penilai: years.annual, bertulis: years.exam, kelas1: years.exam };
}

/**
 * True when the row (alias p, categorised by APPLICATION_CATEGORY_SQL) belongs
 * to the active session of its own form. Bind the exam year, then the annual year.
 */
export const ACTIVE_SESSION_SQL = (categorySql: string): string =>
  `p.tahun_permohonan=(CASE WHEN (${categorySql}) IN ('kelas3_fam','ujian_kelas1_fam') THEN ? ELSE ? END)`;

/** Session years from the stored application_year setting. */
export async function loadSessionYears(db: { prepare(sql: string): { first<T>(): Promise<T | null> } },
  now = new Date()): Promise<SessionYears> {
  const row = await db.prepare("SELECT setting_value FROM application_settings WHERE setting_key='application_year' LIMIT 1")
    .first<{ setting_value: string | null }>();
  return sessionYears({ application_year: row?.setting_value ?? undefined }, now);
}
