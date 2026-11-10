/** Match-year registration uses the same inactive classification as the user list:
 * a previously approved referee with no referee application in that year.
 * Pending applications are a separate status; RA registration is separate too.
 * Arguments are trusted SQL expressions, never request text.
 */
export const annualInactiveSql = (user: string, year: string): string => `(
  COALESCE(${user}.jenis_pengadil,'')<>'Penilai Pengadil'
  AND EXISTS(SELECT 1 FROM permohonan p WHERE p.user_id=${user}.id
    AND p.jenis_borang='pengadil_berdaftar' AND p.status='Approved' AND p.tahun_permohonan<${year}
    AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN'))
  AND NOT EXISTS(SELECT 1 FROM permohonan p WHERE p.user_id=${user}.id
    AND p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan=${year}
    AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')))`;

export const activeOfficialSql = (user: string, year: string): string =>
  `(COALESCE(${user}.aktif,0)=1 AND NOT ${annualInactiveSql(user, year)})`;

export const MATCH_YEAR_SQL = "CAST(substr(jp.tarikh,1,4) AS INTEGER)";
