-- Migration: Add keputusan perlawanan (scores) + cuaca to perlawanan table
-- Date: 2026-04-05
-- V3: semua perlawanan kini guna model grouped - seorang pengadil isi untuk semua pegawai

ALTER TABLE `perlawanan`
  ADD COLUMN `skor_ht_home` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor separuh masa pertama - home' AFTER `away_team`,
  ADD COLUMN `skor_ht_away` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor separuh masa pertama - away' AFTER `skor_ht_home`,
  ADD COLUMN `skor_ft_home` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor penuh masa - home' AFTER `skor_ht_away`,
  ADD COLUMN `skor_ft_away` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor penuh masa - away' AFTER `skor_ft_home`,
  ADD COLUMN `skor_et_home` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor extra time - home' AFTER `skor_ft_away`,
  ADD COLUMN `skor_et_away` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor extra time - away' AFTER `skor_et_home`,
  ADD COLUMN `skor_ps_home` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor penalty shootout - home' AFTER `skor_et_away`,
  ADD COLUMN `skor_ps_away` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor penalty shootout - away' AFTER `skor_ps_home`,
  ADD COLUMN `cuaca` VARCHAR(30) DEFAULT NULL COMMENT 'Keadaan cuaca semasa perlawanan' AFTER `skor_ps_away`;
