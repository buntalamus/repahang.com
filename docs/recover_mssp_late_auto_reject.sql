-- Pulihkan lantikan MSSP yang ditolak automatik walaupun tempoh jawapan
-- tiga jam berakhir selepas waktu sepak mula.
--
-- Jalankan selepas deploy kod baharu. Skrip ini:
--   1. hanya menyasar kejohanan MSSP yang dinamakan di bawah;
--   2. hanya menyasar penolakan dengan penanda auto-tolak sistem;
--   3. tidak menukar sesiapa kepada "Diterima";
--   4. mengekalkan token/notifikasi supaya pegawai masih boleh menjawab.
--
-- KESELAMATAN: nilai lalai 0 hanya menjalankan PREVIEW. Selepas senarai
-- disahkan betul, tukar @sahkan_pemulihan kepada 1 dan jalankan semula.

SET @old_time_zone = @@SESSION.time_zone;
SET time_zone = '+00:00';

SET @kejohanan_mssp = 'KEJOHANAN BOLA SEPAK MAJLIS SUKAN SEKOLAH PAHANG (MSSP)';
SET @komen_auto_tolak = 'Ditolak automatik - tiada jawapan dalam tempoh';
SET @sahkan_pemulihan = 0;

-- PREVIEW WAJIB: semak semua baris yang akan dibuka semula.
SELECT
    lp.id AS lantikan_id,
    jp.no_perlawanan,
    jp.kategori,
    jp.pasukan_home,
    jp.pasukan_away,
    jp.tarikh,
    jp.masa,
    lp.jawatan,
    COALESCE(u.nama_penuh, pl.nama) AS nama_pegawai,
    lp.tarikh_notif,
    lp.tarikh_jawab AS deadline_lama
FROM lantikan_pengadil lp
JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
JOIN kejohanan kj ON kj.id = jp.kejohanan_id
LEFT JOIN users u ON u.id = lp.pengadil_id
LEFT JOIN pengadil_luar pl ON pl.id = lp.pengadil_luar_id
WHERE kj.nama = @kejohanan_mssp
  AND lp.status = 'Ditolak'
  AND lp.komen = @komen_auto_tolak
  AND lp.notif_hantar = 1
  AND lp.tarikh_notif IS NOT NULL
  AND CASE
        WHEN LOWER(COALESCE(kj.jenis_kejohanan, '')) = 'liga'
          THEN DATE_ADD(lp.tarikh_notif, INTERVAL 48 HOUR)
        ELSE DATE_ADD(lp.tarikh_notif, INTERVAL 3 HOUR)
      END >= TIMESTAMP(jp.tarikh, jp.masa) - INTERVAL 8 HOUR
ORDER BY jp.tarikh, jp.masa, jp.kategori, jp.no_perlawanan, lp.jawatan;

START TRANSACTION;

UPDATE lantikan_pengadil lp
JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
JOIN kejohanan kj ON kj.id = jp.kejohanan_id
SET lp.status = 'Belum Jawab',
    lp.komen = NULL,
    lp.tarikh_jawab = NULL
WHERE kj.nama = @kejohanan_mssp
  AND @sahkan_pemulihan = 1
  AND lp.status = 'Ditolak'
  AND lp.komen = @komen_auto_tolak
  AND lp.notif_hantar = 1
  AND lp.tarikh_notif IS NOT NULL
  AND CASE
        WHEN LOWER(COALESCE(kj.jenis_kejohanan, '')) = 'liga'
          THEN DATE_ADD(lp.tarikh_notif, INTERVAL 48 HOUR)
        ELSE DATE_ADD(lp.tarikh_notif, INTERVAL 3 HOUR)
      END >= TIMESTAMP(jp.tarikh, jp.masa) - INTERVAL 8 HOUR;

SELECT
    ROW_COUNT() AS jumlah_lantikan_dipulihkan,
    @sahkan_pemulihan AS pemulihan_disahkan;

COMMIT;

SET time_zone = @old_time_zone;
