-- Migration: Add jenis_kejohanan and peringkat_kejohanan to kejohanan table
-- Date: 2026-04-06

ALTER TABLE `kejohanan`
  ADD COLUMN IF NOT EXISTS `jenis_kejohanan` ENUM('Karnival','Liga','Persahabatan') NOT NULL DEFAULT 'Persahabatan' AFTER `nama`,
  ADD COLUMN IF NOT EXISTS `peringkat_kejohanan` ENUM('Daerah','Negeri','Kebangsaan','Asia') NOT NULL DEFAULT 'Daerah' AFTER `jenis_kejohanan`;
