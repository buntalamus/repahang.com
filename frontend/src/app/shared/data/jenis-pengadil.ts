/** The referee types the system recognises, in the order shown in forms. */
export const JENIS_PENGADIL = [
  'Pengadil Baharu',
  'Kelas III FAM',
  'Kelas I FAM',
  'Pengadil Negeri',
  'Pengadil Kebangsaan',
  'Penilai Pengadil',
  'Pegawai Pembangunan',
] as const;

/** Options for a referee-type dropdown, keeping an existing value that is not in the list. */
export function jenisPengadilOptions(current: unknown): string[] {
  const value = typeof current === 'string' ? current.trim() : '';
  return value && !JENIS_PENGADIL.some((item) => item === value) ? [...JENIS_PENGADIL, value] : [...JENIS_PENGADIL];
}
