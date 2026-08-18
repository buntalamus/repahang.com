-- Pulihkan sejarah perlawanan bagi lantikan MSSP yang sudah Diterima tetapi
-- gagal mencipta rekod perlawanan.
--
-- Punca insiden: jawapan Telegram menyimpan status Diterima sebelum cubaan
-- INSERT sejarah. Nilai `jenis` MSSP sepanjang 69-77 aksara melebihi had
-- perlawanan.jenis VARCHAR(60), lalu INSERT lama gagal selepas status disimpan.
--
-- Skrip ini selamat diulang:
--   1. hanya menyasar kejohanan MSSP dengan nama tepat di bawah;
--   2. hanya menyasar lantikan KUP Diterima untuk pengguna RefPahang berdaftar;
--   3. hanya menyasar lantikan yang belum mempunyai perlawanan.lantikan_id;
--   4. memaut dan menyelaraskan rekod manual yang sepadan secara unik;
--   5. mencipta rekod baharu hanya apabila tiada rekod manual yang sepadan;
--   6. tidak menyentuh Belum Jawab, Ditolak, atau pegawai luar.
--
-- KESELAMATAN: nilai lalai 0 ialah PREVIEW sahaja. Ambil backup production,
-- semak semua kiraan/senarai, kemudian tukar @sahkan_pemulihan kepada 1.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @kejohanan_mssp = _utf8mb4'KEJOHANAN BOLA SEPAK MAJLIS SUKAN SEKOLAH PAHANG (MSSP)'
    COLLATE utf8mb4_unicode_ci;
SET @sahkan_pemulihan = 0;

SET @jumlah_kejohanan = (
    SELECT COUNT(*)
    FROM kejohanan
    WHERE nama = @kejohanan_mssp
);

SELECT
    @kejohanan_mssp AS kejohanan,
    @jumlah_kejohanan AS padanan_kejohanan,
    @sahkan_pemulihan AS pemulihan_disahkan,
    CASE
        WHEN @jumlah_kejohanan = 1 THEN 'OK'
        ELSE 'HENTI: nama kejohanan mesti mempunyai tepat satu padanan'
    END AS semakan_awal;

DROP TEMPORARY TABLE IF EXISTS tmp_mssp_crew;
CREATE TEMPORARY TABLE tmp_mssp_crew AS
SELECT
    lp.jadual_id,
    MAX(CASE WHEN lp.status = 'Diterima' AND lp.jawatan = 'Pengadil'
             THEN lp.pengadil_id END) AS head_referee_id,
    MAX(CASE WHEN lp.status = 'Diterima' AND lp.jawatan = 'Penolong Pengadil 1'
             THEN lp.pengadil_id END) AS assistant_referee_1_id,
    MAX(CASE WHEN lp.status = 'Diterima' AND lp.jawatan = 'Penolong Pengadil 2'
             THEN lp.pengadil_id END) AS assistant_referee_2_id,
    MAX(CASE WHEN lp.status = 'Diterima' AND lp.jawatan = 'Pegawai ke4'
             THEN lp.pengadil_id END) AS fourth_official_id
FROM lantikan_pengadil lp
JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
JOIN kejohanan kj ON kj.id = jp.kejohanan_id
WHERE kj.nama = @kejohanan_mssp
  AND @jumlah_kejohanan = 1
GROUP BY lp.jadual_id;

DROP TEMPORARY TABLE IF EXISTS tmp_mssp_history_recovery;
CREATE TEMPORARY TABLE tmp_mssp_history_recovery AS
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
WHERE kj.nama = @kejohanan_mssp
  AND @jumlah_kejohanan = 1
  AND lp.status = 'Diterima'
  AND lp.jawatan IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
  AND lp.pengadil_id IS NOT NULL
  AND p_linked.id IS NULL
GROUP BY
    lp.id, lp.jadual_id, lp.pengadil_id, lp.jawatan, lp.tarikh_jawab,
    jp.no_perlawanan, jp.tarikh, jp.masa, jp.kategori, jp.peringkat,
    kj.nama, jp.tempat, jp.pasukan_home, jp.pasukan_away;

DROP TEMPORARY TABLE IF EXISTS tmp_mssp_manual_usage;
CREATE TEMPORARY TABLE tmp_mssp_manual_usage AS
SELECT manual_perlawanan_id, COUNT(*) AS candidate_count
FROM tmp_mssp_history_recovery
WHERE manual_match_count = 1
  AND manual_perlawanan_id IS NOT NULL
GROUP BY manual_perlawanan_id;

-- Ringkasan jangkaan untuk dump production 14 Ogos 2026 selepas RA dikecualikan:
-- jumlah_calon=76, paut_rekod_manual=4, cipta_rekod_baharu=72, ambigu=0.
SELECT
    COUNT(*) AS jumlah_calon,
    SUM(CASE WHEN r.manual_match_count = 1 AND u.candidate_count = 1 THEN 1 ELSE 0 END)
        AS paut_rekod_manual,
    SUM(CASE WHEN r.manual_match_count = 0 THEN 1 ELSE 0 END)
        AS cipta_rekod_baharu,
    SUM(CASE WHEN r.manual_match_count > 1 OR COALESCE(u.candidate_count, 1) > 1 THEN 1 ELSE 0 END)
        AS ambigu_dilangkau
FROM tmp_mssp_history_recovery r
LEFT JOIN tmp_mssp_manual_usage u
       ON u.manual_perlawanan_id = r.manual_perlawanan_id;

-- Senarai audit. Baris ambigu mesti diselesaikan secara manual dan tidak akan
-- disentuh oleh skrip ini.
SELECT
    r.lantikan_id,
    r.manual_perlawanan_id,
    r.manual_match_count,
    COALESCE(u.candidate_count, 0) AS manual_candidate_count,
    r.no_perlawanan,
    r.tarikh,
    r.masa,
    r.jawatan,
    usr.nama_penuh AS nama_pegawai,
    CASE
        WHEN r.manual_match_count = 0 THEN 'CIPTA REKOD'
        WHEN r.manual_match_count = 1 AND u.candidate_count = 1 THEN 'PAUT REKOD MANUAL'
        ELSE 'AMBIGU - LANGKAU'
    END AS tindakan
FROM tmp_mssp_history_recovery r
JOIN users usr ON usr.id = r.user_id
LEFT JOIN tmp_mssp_manual_usage u
       ON u.manual_perlawanan_id = r.manual_perlawanan_id
ORDER BY r.tarikh, r.masa, r.no_perlawanan, r.jawatan, r.lantikan_id;

START TRANSACTION;

-- Kekalkan ID, skor, pengesahan, dan data lain pada rekod manual; pautkan
-- kepada lantikan rasmi serta selaraskan metadata/crew daripada jadual rasmi.
UPDATE perlawanan p
JOIN tmp_mssp_history_recovery r
  ON r.manual_perlawanan_id = p.id
 AND r.manual_match_count = 1
JOIN tmp_mssp_manual_usage u
  ON u.manual_perlawanan_id = p.id
 AND u.candidate_count = 1
JOIN tmp_mssp_crew c ON c.jadual_id = r.jadual_id
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

-- Hanya calon tanpa sebarang rekod manual sepadan akan mendapat rekod baharu.
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
FROM tmp_mssp_history_recovery r
JOIN tmp_mssp_crew c ON c.jadual_id = r.jadual_id
WHERE @sahkan_pemulihan = 1
  AND r.manual_match_count = 0
  AND NOT EXISTS (
      SELECT 1
      FROM perlawanan existing
      WHERE existing.lantikan_id = r.lantikan_id
  );

SET @jumlah_dicipta = ROW_COUNT();

COMMIT;

SELECT
    @sahkan_pemulihan AS pemulihan_disahkan,
    @jumlah_dipaut AS jumlah_rekod_manual_dipaut,
    @jumlah_dicipta AS jumlah_rekod_baharu_dicipta;

-- Selepas APPLY berjaya, nilai ini mesti 0. Dalam mod PREVIEW, ia kekal 76
-- untuk dump rujukan 14 Ogos 2026.
SELECT COUNT(*) AS kup_diterima_berdaftar_masih_tiada_sejarah
FROM lantikan_pengadil lp
JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
JOIN kejohanan kj ON kj.id = jp.kejohanan_id
LEFT JOIN perlawanan p ON p.lantikan_id = lp.id
WHERE kj.nama = @kejohanan_mssp
  AND lp.status = 'Diterima'
  AND lp.jawatan IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
  AND lp.pengadil_id IS NOT NULL
  AND p.id IS NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_mssp_manual_usage;
DROP TEMPORARY TABLE IF EXISTS tmp_mssp_history_recovery;
DROP TEMPORARY TABLE IF EXISTS tmp_mssp_crew;
