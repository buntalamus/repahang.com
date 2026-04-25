-- Migration: Add keputusan perlawanan (match scores) + cuaca to laporan_penilaian
-- Date: 2026-04-05

ALTER TABLE `laporan_penilaian`
  ADD COLUMN IF NOT EXISTS `skor_ht_home` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor separuh masa pertama - home' AFTER `tahap_kesukaran`,
  ADD COLUMN IF NOT EXISTS `skor_ht_away` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor separuh masa pertama - away' AFTER `skor_ht_home`,
  ADD COLUMN IF NOT EXISTS `skor_ft_home` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor separuh masa kedua - home' AFTER `skor_ht_away`,
  ADD COLUMN IF NOT EXISTS `skor_ft_away` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor separuh masa kedua - away' AFTER `skor_ft_home`,
  ADD COLUMN IF NOT EXISTS `skor_et_home` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor extra time - home' AFTER `skor_ft_away`,
  ADD COLUMN IF NOT EXISTS `skor_et_away` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor extra time - away' AFTER `skor_et_home`,
  ADD COLUMN IF NOT EXISTS `skor_ps_home` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor penalty shootout - home' AFTER `skor_et_away`,
  ADD COLUMN IF NOT EXISTS `skor_ps_away` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor penalty shootout - away' AFTER `skor_ps_home`,
  ADD COLUMN IF NOT EXISTS `cuaca` VARCHAR(30) DEFAULT NULL COMMENT 'Keadaan cuaca semasa perlawanan' AFTER `skor_ps_away`;
