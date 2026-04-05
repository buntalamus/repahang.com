-- Migration: Make penilai_id and pengadil_id nullable in laporan_penilaian
-- Required for external penilai (pengadil_luar) who don't have a users record
-- FK constraints allow NULL values (NULL = no reference), so no need to drop them

ALTER TABLE laporan_penilaian MODIFY penilai_id INT NULL;
ALTER TABLE laporan_penilaian MODIFY pengadil_id INT NULL;

SELECT 'penilai_nullable migration complete' AS status;
