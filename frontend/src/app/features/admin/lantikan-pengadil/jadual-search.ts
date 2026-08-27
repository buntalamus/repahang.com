export interface JadualSearchItem {
  no_perlawanan?: unknown;
  pasukan_home?: unknown;
  pasukan_away?: unknown;
  peringkat?: unknown;
  kumpulan?: unknown;
  kategori?: unknown;
  tempat?: unknown;
}

/**
 * Angka sahaja merujuk kepada nombor perlawanan tepat, termasuk nombor
 * berprefiks seperti B12-05. Carian lain kekal sebagai carian kata kunci.
 */
export function matchesJadualSearch(
  jadual: JadualSearchItem,
  rawSearch: string,
  includeTempat = false,
): boolean {
  const search = rawSearch.trim().toLowerCase();
  if (!search) return true;

  if (/^[0-9]+$/.test(search)) {
    const noPerlawanan = String(jadual.no_perlawanan ?? '').trim();
    const trailingNumber = noPerlawanan.match(/([0-9]+)\s*$/);
    return trailingNumber !== null
      && Number.parseInt(trailingNumber[1], 10) === Number.parseInt(search, 10);
  }

  const values = [
    jadual.no_perlawanan,
    jadual.pasukan_home,
    jadual.pasukan_away,
    jadual.peringkat,
    jadual.kumpulan,
    jadual.kategori,
  ];
  if (includeTempat) values.push(jadual.tempat);

  return values.some((value) => String(value ?? '').toLowerCase().includes(search));
}
