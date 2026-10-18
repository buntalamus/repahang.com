import {
  normalizeProfileYears,
  profileYearKeys,
} from "../../shared/profile-fields";
export const profileEditableFields = [
  "nama_penuh",
  "no_ic",
  "umur",
  "email",
  "no_telefon",
  "jantina",
  "persatuan_id",
  "alamat1",
  "alamat2",
  "poskod",
  "daerah",
  "negeri",
  "status_kerja",
  "jawatan",
  "nama_majikan",
  "alamat_majikan1",
  "alamat_majikan2",
  "poskod_majikan",
  "daerah_majikan",
  "negeri_majikan",
  "nama_waris",
  "hubungan_waris",
  "telefon_waris",
  "jenis_pengadil",
  "jenis_penilai",
  "saiz_baju",
  ...profileYearKeys,
] as const;
export function normalizeProfileInput(
  input: Record<string, unknown>,
  stored: Record<string, unknown>,
): { values: Record<string, string | number | null>; error?: string } {
  const years = normalizeProfileYears(input, stored);
  const values: Record<string, string | number | null> = { ...years.values };
  if (years.error) return { values, error: years.error };
  for (const field of profileEditableFields) {
    if (
      !Object.hasOwn(input, field) ||
      profileYearKeys.some((key) => key === field)
    )
      continue;
    const raw = input[field];
    if (field === "umur" || field === "persatuan_id") {
      const value = raw === null || raw === "" ? null : Number(raw);
      if (
        (raw !== null &&
          raw !== "" &&
          !["string", "number"].includes(typeof raw)) ||
        (value !== null &&
          (!Number.isSafeInteger(value) ||
            value < (field === "umur" ? 0 : 1) ||
            (field === "umur" && value > 120)))
      )
        return {
          values,
          error: field === "umur" ? "Umur tidak sah." : "Persatuan tidak sah.",
        };
      values[field] = value;
      continue;
    }
    if (raw !== null && typeof raw !== "string")
      return { values, error: `Medan '${field}' tidak sah.` };
    const value = typeof raw === "string" ? raw.trim() : null;
    if (value && value.length > (field.startsWith("alamat") ? 500 : 255))
      return { values, error: `Medan '${field}' terlalu panjang.` };
    if (field === "nama_penuh" && !value)
      return { values, error: "Nama penuh diperlukan." };
    if (
      field === "email" &&
      (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    )
      return { values, error: "Emel tidak sah." };
    values[field] = field === "email" ? value!.toLowerCase() : value;
  }
  return { values };
}
