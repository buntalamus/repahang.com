-- ============================================================================
-- Migrasi: Tahun Kelas 3 FAM + Taraf Pengadil + Registri Logo Pasukan
-- Sasaran DB: refpahan_refpahang
--
-- Versi SQL untuk phpMyAdmin — setara dengan:
--   php docs/migration_profil_taraf_pasukan_logo.php
-- PILIH SATU sahaja (SQL ini ATAU skrip PHP), jangan kedua-duanya.
--
-- Jalankan SEKALI sahaja. Jika dijalankan semula, statement ALTER TABLE
-- akan ralat "Duplicate column name" — abaikan dan teruskan ke statement
-- seterusnya (backfill & CREATE TABLE selamat diulang).
-- ============================================================================

-- ── 1. Kolum tahun Kelas 3 FAM ──────────────────────────────────────────────
ALTER TABLE users ADD COLUMN tahun_mohon_kelas3 YEAR NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN tahun_lulus_kelas3 YEAR NULL DEFAULT NULL;

-- Backfill tahun mohon: tahun permohonan Kelas 3 terawal (apa-apa status)
UPDATE users u
JOIN (
    SELECT user_id, MIN(tahun_permohonan) AS tahun
    FROM permohonan
    WHERE jenis_borang IN ('kelas3_fam', 'ujian_bertulis')
    GROUP BY user_id
) t ON t.user_id = u.id
SET u.tahun_mohon_kelas3 = t.tahun
WHERE u.tahun_mohon_kelas3 IS NULL;

-- Backfill tahun lulus: keputusan ujian 'Lulus', atau workflow lengkap (legacy)
UPDATE users u
JOIN (
    SELECT user_id, MAX(tahun_permohonan) AS tahun
    FROM permohonan
    WHERE jenis_borang IN ('kelas3_fam', 'ujian_bertulis')
      AND (status_ujian = 'Lulus'
           OR (jenis_borang = 'ujian_bertulis'
               AND status_workflow IN ('Lengkap', 'Admin Diluluskan', 'Bayaran Diterima')))
    GROUP BY user_id
) t ON t.user_id = u.id
SET u.tahun_lulus_kelas3 = t.tahun
WHERE u.tahun_lulus_kelas3 IS NULL;

-- ── 2. Kolum taraf pengadil (boleh lebih dari satu serentak) ────────────────
ALTER TABLE users ADD COLUMN pengadil_kebangsaan TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pengadil_negeri TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pengadil_daerah TINYINT(1) NOT NULL DEFAULT 0;

-- Backfill dari label jenis_pengadil sedia ada
UPDATE users SET pengadil_kebangsaan = 1
WHERE jenis_pengadil = 'Pengadil Kebangsaan' AND pengadil_kebangsaan = 0;

UPDATE users SET pengadil_negeri = 1
WHERE jenis_pengadil = 'Pengadil Negeri' AND pengadil_negeri = 0;

-- ── 3. Registri logo pasukan (global, ikut nama pasukan) ────────────────────
CREATE TABLE IF NOT EXISTS pasukan_logo (
    id INT NOT NULL AUTO_INCREMENT,
    nama VARCHAR(255) NOT NULL,
    logo_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill registri dari logo sedia ada (ambil yang terkini per nama pasukan)
INSERT INTO pasukan_logo (nama, logo_path)
SELECT t.nama, t.logo_path FROM (
    SELECT pasukan_home AS nama,
           SUBSTRING_INDEX(GROUP_CONCAT(logo_home ORDER BY id DESC SEPARATOR '||'), '||', 1) AS logo_path
    FROM jadual_perlawanan
    WHERE pasukan_home IS NOT NULL AND pasukan_home <> ''
      AND logo_home IS NOT NULL AND logo_home <> ''
    GROUP BY pasukan_home
    UNION ALL
    SELECT pasukan_away,
           SUBSTRING_INDEX(GROUP_CONCAT(logo_away ORDER BY id DESC SEPARATOR '||'), '||', 1)
    FROM jadual_perlawanan
    WHERE pasukan_away IS NOT NULL AND pasukan_away <> ''
      AND logo_away IS NOT NULL AND logo_away <> ''
    GROUP BY pasukan_away
) t
ON DUPLICATE KEY UPDATE logo_path = pasukan_logo.logo_path;

-- Isi logo yang masih kosong pada perlawanan sedia ada (padanan ikut nama)
UPDATE jadual_perlawanan jp
JOIN pasukan_logo plg ON plg.nama = jp.pasukan_home
SET jp.logo_home = plg.logo_path
WHERE (jp.logo_home IS NULL OR jp.logo_home = '' OR jp.logo_home <> plg.logo_path);

UPDATE jadual_perlawanan jp
JOIN pasukan_logo plg ON plg.nama = jp.pasukan_away
SET jp.logo_away = plg.logo_path
WHERE (jp.logo_away IS NULL OR jp.logo_away = '' OR jp.logo_away <> plg.logo_path);

-- ── Semakan selepas migrasi (pilihan) ───────────────────────────────────────
-- SELECT COUNT(*) AS ada_tahun_lulus FROM users WHERE tahun_lulus_kelas3 IS NOT NULL;
-- SELECT COUNT(*) AS kebangsaan FROM users WHERE pengadil_kebangsaan = 1;
-- SELECT * FROM pasukan_logo;
