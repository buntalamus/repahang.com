export type ProfileRecord = Record<string, unknown>;
export const profileYearLabels = {
  tahun_mula_aktif: "Tahun Mula Aktif",
  tahun_mohon_kelas3: "Tahun Mohon Kelas III FAM",
  tahun_lulus_kelas3: "Tahun Lulus Kelas III FAM",
  tahun_mohon_kelas1: "Tahun Mohon Kelas I FAM",
  tahun_lulus_kelas1: "Tahun Lulus Kelas I FAM",
} as const;
export const profileYearKeys = Object.keys(
  profileYearLabels,
) as (keyof typeof profileYearLabels)[];
/** Validate only submitted years; missing properties never clear stored history. */
export function normalizeProfileYears(
  input: ProfileRecord,
  stored: ProfileRecord = {},
): { values: Record<string, string | null>; error?: string } {
  const values: Record<string, string | null> = {};
  for (const key of profileYearKeys) {
    if (!Object.hasOwn(input, key)) continue;
    const raw = input[key];
    if (
      raw === null ||
      raw === "" ||
      raw === "0000" ||
      raw === 0 ||
      (typeof raw === "string" && !raw.trim())
    ) {
      values[key] = null;
      continue;
    }
    if (
      !["number", "string"].includes(typeof raw) ||
      !/^\d{4}$/.test(String(raw).trim())
    )
      return {
        values,
        error: `${profileYearLabels[key]} mesti tahun empat digit atau dikosongkan.`,
      };
    const year = Number(raw);
    const currentYear = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
      }).format(new Date()),
    );
    const maximum = key.includes("mohon") ? currentYear + 1 : currentYear;
    if (!Number.isInteger(year) || year < 1900 || year > maximum)
      return {
        values,
        error: `${profileYearLabels[key]} mesti antara 1900 dan ${maximum}.`,
      };
    values[key] = String(year);
  }
  const merged = { ...stored, ...values };
  for (const grade of ["3", "1"]) {
    const applied = `tahun_mohon_kelas${grade}`,
      passed = `tahun_lulus_kelas${grade}`;
    if (
      (Object.hasOwn(values, applied) || Object.hasOwn(values, passed)) &&
      Number(merged[applied]) > 0 &&
      Number(merged[passed]) > 0 &&
      Number(merged[passed]) < Number(merged[applied])
    )
      return {
        values,
        error: `Tahun lulus Kelas ${grade === "3" ? "III" : "I"} tidak boleh sebelum tahun mohon.`,
      };
  }
  if (
    Object.keys(values).some((key) => key.includes("lulus")) &&
    Number(merged["tahun_lulus_kelas3"]) > 0 &&
    Number(merged["tahun_lulus_kelas1"]) > 0 &&
    Number(merged["tahun_lulus_kelas1"]) < Number(merged["tahun_lulus_kelas3"])
  )
    return {
      values,
      error: "Tahun lulus Kelas I tidak boleh sebelum tahun lulus Kelas III.",
    };
  return { values };
}
