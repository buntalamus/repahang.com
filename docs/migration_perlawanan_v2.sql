-- Migration: Revisi Perlawanan Persahabatan
-- Tarikh: 3 April 2026
-- 
-- Perubahan:
-- 1. Tambah match_group_id untuk link semua pegawai dalam satu perlawanan
-- 2. Tambah masa, nama_kejohanan, daerah_perlawanan_id, submitted_by
-- 3. Ubah PP verification scope: ikut daerah perlawanan, bukan daerah pengadil

-- Tambah kolom baru ke table perlawanan
ALTER TABLE `perlawanan`
  ADD COLUMN `match_group_id` CHAR(36) DEFAULT NULL COMMENT 'UUID untuk group semua pegawai dalam satu perlawanan persahabatan' AFTER `id`,
  ADD COLUMN `masa` TIME DEFAULT NULL COMMENT 'Masa perlawanan' AFTER `tarikh`,
  ADD COLUMN `nama_kejohanan` VARCHAR(255) DEFAULT NULL COMMENT 'Nama kejohanan/liga' AFTER `jenis`,
  ADD COLUMN `daerah_perlawanan_id` INT DEFAULT NULL COMMENT 'Daerah tempat perlawanan berlangsung (untuk PP verification)' AFTER `persatuan_id`,
  ADD COLUMN `submitted_by` INT DEFAULT NULL COMMENT 'Pengadil yang isi borang untuk kumpulan ini' AFTER `user_id`;

-- Index untuk match_group_id (carian grouped)
ALTER TABLE `perlawanan`
  ADD INDEX `idx_match_group` (`match_group_id`),
  ADD INDEX `idx_daerah_perlawanan` (`daerah_perlawanan_id`),
  ADD INDEX `idx_submitted_by` (`submitted_by`);

-- FK untuk daerah_perlawanan_id
ALTER TABLE `perlawanan`
  ADD CONSTRAINT `fk_perlawanan_daerah` FOREIGN KEY (`daerah_perlawanan_id`) REFERENCES `districts` (`id`) ON DELETE SET NULL;
