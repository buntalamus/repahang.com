-- Audit dan pulihkan sejarah semua lantikan KUP berdaftar yang telah Diterima.
--
-- Peraturan jawatan:
--   KUP = Pengadil, Penolong Pengadil 1, Penolong Pengadil 2, Pegawai ke4.
--   RA (Penilai Pengadil) ialah slot lantikan kelima tetapi bukan sejarah KUP.
--
-- Skrip ini selamat diulang dan PREVIEW secara lalai. Ia:
--   1. memadam sejarah terpaut yang bukan lagi lantikan KUP Diterima;
--   2. menyelaras metadata dan crew semua sejarah terpaut yang sah;
--   3. memaut rekod manual yang sepadan secara unik;
--   4. mencipta rekod bagi KUP Diterima yang masih tiada sejarah;
--   5. melangkau padanan manual yang ambigu.
--
-- KESELAMATAN: ambil backup production dan semak semua senarai PREVIEW.
-- Tukar @sahkan_pemulihan kepada 1 hanya selepas keputusan disahkan.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @sahkan_pemulihan = 0;

DROP TEMPORARY TABLE IF EXISTS tmp_kup_crew;
CREATE TEMPORARY TABLE tmp_kup_crew AS
SELECT
    jp.id AS jadual_id,
    MAX(CASE WHEN lp.status = 'Diterima' AND lp.jawatan = 'Pengadil'
             THEN lp.pengadil_id END) AS head_referee_id,
    MAX(CASE WHEN lp.status = 'Diterima' AND lp.jawatan = 'Penolong Pengadil 1'
             THEN lp.pengadil_id END) AS assistant_referee_1_id,
    MAX(CASE WHEN lp.status = 'Diterima' AND lp.jawatan = 'Penolong Pengadil 2'
             THEN lp.pengadil_id END) AS assistant_referee_2_id,
    MAX(CASE WHEN lp.status = 'Diterima' AND lp.jawatan = 'Pegawai ke4'
             THEN lp.pengadil_id END) AS fourth_official_id
FROM jadual_perlawanan jp
LEFT JOIN lantikan_pengadil lp ON lp.jadual_id = jp.id
GROUP BY jp.id;

DROP TEMPORARY TABLE IF EXISTS tmp_kup_history_recovery;
CREATE TEMPORARY TABLE tmp_kup_history_recovery AS
SELECT
    lp.id AS lantikan_id,
    lp.jadual_id,
    lp.pengadil_id AS user_id,
    lp.jawatan,
    lp.tarikh_jawab,
    jp.no_perlawanan,
    jp.tarikh,
    jp.masa,
    LEFT(
        CONCAT_WS(
            ' - ',
            NULLIF(kj.nama, ''),
            NULLIF(jp.kategori, ''),
            NULLIF(jp.peringkat, '')
        ),
        60
    ) AS jenis,
    kj.nama AS nama_kejohanan,
    jp.tempat,
    jp.pasukan_home AS home_team,
    jp.pasukan_away AS away_team,
    COUNT(p_manual.id) AS manual_match_count,
    MIN(p_manual.id) AS manual_perlawanan_id
FROM lantikan_pengadil lp
JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
JOIN kejohanan kj ON kj.id = jp.kejohanan_id
LEFT JOIN perlawanan p_linked ON p_linked.lantikan_id = lp.id
LEFT JOIN perlawanan p_manual
       ON p_manual.lantikan_id IS NULL
      AND p_manual.user_id = lp.pengadil_id
      AND p_manual.tarikh = jp.tarikh
      AND p_manual.home_team = jp.pasukan_home
      AND p_manual.away_team = jp.pasukan_away
      AND p_manual.jawatan = lp.jawatan
WHERE lp.status = 'Diterima'
  AND lp.jawatan IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
  AND lp.pengadil_id IS NOT NULL
  AND p_linked.id IS NULL
GROUP BY
    lp.id, lp.jadual_id, lp.pengadil_id, lp.jawatan, lp.tarikh_jawab,
    jp.no_perlawanan, jp.tarikh, jp.masa, jp.kategori, jp.peringkat,
    kj.nama, jp.tempat, jp.pasukan_home, jp.pasukan_away;

DROP TEMPORARY TABLE IF EXISTS tmp_kup_manual_usage;
CREATE TEMPORARY TABLE tmp_kup_manual_usage AS
SELECT manual_perlawanan_id, COUNT(*) AS candidate_count
FROM tmp_kup_history_recovery
WHERE manual_match_count = 1
  AND manual_perlawanan_id IS NOT NULL
GROUP BY manual_perlawanan_id;

DROP TEMPORARY TABLE IF EXISTS tmp_invalid_linked_history;
CREATE TEMPORARY TABLE tmp_invalid_linked_history AS
SELECT
    p.id AS perlawanan_id,
    p.lantikan_id,
    CASE
        WHEN lp.id IS NULL THEN 'LANTIKAN TIADA'
        WHEN lp.status <> 'Diterima' THEN CONCAT('STATUS ', lp.status)
        WHEN lp.pengadil_id IS NULL THEN 'PEGAWAI LUAR'
        WHEN lp.jawatan = 'Penilai Pengadil' THEN 'RA BUKAN KUP'
        WHEN lp.jawatan NOT IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
            THEN CONCAT('JAWATAN TIDAK SAH: ', lp.jawatan)
        ELSE 'IDENTITI TIDAK SEPADAN'
    END AS sebab
FROM perlawanan p
LEFT JOIN lantikan_pengadil lp ON lp.id = p.lantikan_id
WHERE p.lantikan_id IS NOT NULL
  AND (
       lp.id IS NULL
       OR lp.status <> 'Diterima'
       OR lp.pengadil_id IS NULL
       OR lp.jawatan NOT IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
       OR p.user_id <> lp.pengadil_id
  );

-- Ringkasan jangkaan untuk dump production 14 Ogos 2026:
-- jumlah_calon=115, paut_rekod_manual=7, cipta_rekod_baharu=108,
-- ambigu=0, sejarah_terpaut_tidak_sah=77.
SELECT
    COUNT(*) AS jumlah_calon,
    SUM(CASE WHEN r.manual_match_count = 1 AND u.candidate_count = 1 THEN 1 ELSE 0 END)
        AS paut_rekod_manual,
    SUM(CASE WHEN r.manual_match_count = 0 THEN 1 ELSE 0 END)
        AS cipta_rekod_baharu,
    SUM(CASE WHEN r.manual_match_count > 1 OR COALESCE(u.candidate_count, 1) > 1 THEN 1 ELSE 0 END)
        AS ambigu_dilangkau,
    (SELECT COUNT(*) FROM tmp_invalid_linked_history) AS sejarah_terpaut_tidak_sah
FROM tmp_kup_history_recovery r
LEFT JOIN tmp_kup_manual_usage u
       ON u.manual_perlawanan_id = r.manual_perlawanan_id;

-- Senarai calon pemulihan. Baris ambigu tidak akan disentuh.
SELECT
    r.lantikan_id,
    r.manual_perlawanan_id,
    r.manual_match_count,
    COALESCE(u.candidate_count, 0) AS manual_candidate_count,
    r.no_perlawanan,
    r.nama_kejohanan,
    r.tarikh,
    r.masa,
    r.jawatan,
    usr.nama_penuh AS nama_pegawai,
    CASE
        WHEN r.manual_match_count = 0 THEN 'CIPTA REKOD'
        WHEN r.manual_match_count = 1 AND u.candidate_count = 1 THEN 'PAUT REKOD MANUAL'
        ELSE 'AMBIGU - LANGKAU'
    END AS tindakan
FROM tmp_kup_history_recovery r
JOIN users usr ON usr.id = r.user_id
LEFT JOIN tmp_kup_manual_usage u
       ON u.manual_perlawanan_id = r.manual_perlawanan_id
ORDER BY r.tarikh, r.masa, r.no_perlawanan, r.jawatan, r.lantikan_id;

-- Rekod ini akan dipadam apabila APPLY kerana ia terpaut kepada lantikan yang
-- bukan KUP Diterima. Rekod manual dengan lantikan_id NULL tidak termasuk.
SELECT *
FROM tmp_invalid_linked_history
ORDER BY perlawanan_id;

START TRANSACTION;

DELETE p
FROM perlawanan p
JOIN tmp_invalid_linked_history bad ON bad.perlawanan_id = p.id
WHERE @sahkan_pemulihan = 1;
SET @jumlah_tidak_sah_dipadam = ROW_COUNT();

-- Selaraskan semua sejarah KUP Diterima yang sudah terpaut.
UPDATE perlawanan p
JOIN lantikan_pengadil lp
  ON lp.id = p.lantikan_id
 AND lp.status = 'Diterima'
 AND lp.pengadil_id IS NOT NULL
 AND lp.jawatan IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
JOIN kejohanan kj ON kj.id = jp.kejohanan_id
JOIN tmp_kup_crew c ON c.jadual_id = lp.jadual_id
SET p.user_id = lp.pengadil_id,
    p.status_pp = 'Disahkan',
    p.tarikh = jp.tarikh,
    p.masa = jp.masa,
    p.jenis = LEFT(CONCAT_WS(' - ', NULLIF(kj.nama, ''), NULLIF(jp.kategori, ''), NULLIF(jp.peringkat, '')), 60),
    p.nama_kejohanan = kj.nama,
    p.tempat = jp.tempat,
    p.home_team = jp.pasukan_home,
    p.away_team = jp.pasukan_away,
    p.jawatan = lp.jawatan,
    p.head_referee_id = c.head_referee_id,
    p.assistant_referee_1_id = c.assistant_referee_1_id,
    p.assistant_referee_2_id = c.assistant_referee_2_id,
    p.fourth_official_id = c.fourth_official_id
WHERE @sahkan_pemulihan = 1;
SET @jumlah_sedia_ada_diselaras = ROW_COUNT();

UPDATE perlawanan p
JOIN tmp_kup_history_recovery r
  ON r.manual_perlawanan_id = p.id
 AND r.manual_match_count = 1
JOIN tmp_kup_manual_usage u
  ON u.manual_perlawanan_id = p.id
 AND u.candidate_count = 1
JOIN tmp_kup_crew c ON c.jadual_id = r.jadual_id
SET p.user_id = r.user_id,
    p.lantikan_id = r.lantikan_id,
    p.status_pp = 'Disahkan',
    p.tarikh = r.tarikh,
    p.masa = r.masa,
    p.jenis = r.jenis,
    p.nama_kejohanan = r.nama_kejohanan,
    p.tempat = r.tempat,
    p.home_team = r.home_team,
    p.away_team = r.away_team,
    p.jawatan = r.jawatan,
    p.head_referee_id = c.head_referee_id,
    p.assistant_referee_1_id = c.assistant_referee_1_id,
    p.assistant_referee_2_id = c.assistant_referee_2_id,
    p.fourth_official_id = c.fourth_official_id
WHERE @sahkan_pemulihan = 1;
SET @jumlah_dipaut = ROW_COUNT();

INSERT INTO perlawanan
    (user_id, lantikan_id, status_pp, tarikh, masa, jenis, nama_kejohanan,
     tempat, home_team, away_team, jawatan,
     head_referee_id, assistant_referee_1_id, assistant_referee_2_id,
     fourth_official_id, created_at)
SELECT
    r.user_id,
    r.lantikan_id,
    'Disahkan',
    r.tarikh,
    r.masa,
    r.jenis,
    r.nama_kejohanan,
    r.tempat,
    r.home_team,
    r.away_team,
    r.jawatan,
    c.head_referee_id,
    c.assistant_referee_1_id,
    c.assistant_referee_2_id,
    c.fourth_official_id,
    COALESCE(r.tarikh_jawab, CURRENT_TIMESTAMP)
FROM tmp_kup_history_recovery r
JOIN tmp_kup_crew c ON c.jadual_id = r.jadual_id
WHERE @sahkan_pemulihan = 1
  AND r.manual_match_count = 0
  AND NOT EXISTS (
      SELECT 1 FROM perlawanan existing WHERE existing.lantikan_id = r.lantikan_id
  );
SET @jumlah_dicipta = ROW_COUNT();

COMMIT;

SELECT
    @sahkan_pemulihan AS pemulihan_disahkan,
    @jumlah_tidak_sah_dipadam AS jumlah_tidak_sah_dipadam,
    @jumlah_sedia_ada_diselaras AS jumlah_sedia_ada_diselaras,
    @jumlah_dipaut AS jumlah_rekod_manual_dipaut,
    @jumlah_dicipta AS jumlah_rekod_baharu_dicipta;

SELECT COUNT(*) AS kup_diterima_berdaftar_masih_tiada_sejarah
FROM lantikan_pengadil lp
LEFT JOIN perlawanan p ON p.lantikan_id = lp.id
WHERE lp.status = 'Diterima'
  AND lp.jawatan IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
  AND lp.pengadil_id IS NOT NULL
  AND p.id IS NULL;

SELECT COUNT(*) AS sejarah_terpaut_tidak_sah_masih_ada
FROM perlawanan p
LEFT JOIN lantikan_pengadil lp ON lp.id = p.lantikan_id
WHERE p.lantikan_id IS NOT NULL
  AND (
       lp.id IS NULL
       OR lp.status <> 'Diterima'
       OR lp.pengadil_id IS NULL
       OR lp.jawatan NOT IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
       OR p.user_id <> lp.pengadil_id
  );

DROP TEMPORARY TABLE IF EXISTS tmp_invalid_linked_history;
DROP TEMPORARY TABLE IF EXISTS tmp_kup_manual_usage;
DROP TEMPORARY TABLE IF EXISTS tmp_kup_history_recovery;
DROP TEMPORARY TABLE IF EXISTS tmp_kup_crew;
