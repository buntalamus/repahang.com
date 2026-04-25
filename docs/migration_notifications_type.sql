-- Migration: Change notifications.type from ENUM to VARCHAR(60)
-- Date: 2026-04-25
-- Reason: The ENUM was missing many type values used in code (14 distinct values total),
--         causing silent truncation to empty string for thousands of rows.
--         VARCHAR avoids needing ALTER TABLE every time a new notification type is added.
--
-- Known type values used in code:
--   'Lantikan', 'Lantikan Diterima', 'Lantikan Ditolak', 'Lantikan PP Daerah',
--   'Perlawanan Baru', 'Pendaftaran Lengkap', 'Pengadil Terima Lantikan',
--   'Pengadil Tolak Lantikan', 'Pengesahan Perlawanan', 'Permohonan Baru',
--   'Permohonan Diterima', 'Permohonan Ditolak', 'Profil Dikemaskini', 'Rekod Perlawanan'

-- Step 1: Tukar type column dari ENUM ke VARCHAR
ALTER TABLE `notifications`
  MODIFY COLUMN `type` VARCHAR(60)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '';

-- Step 2: Betulkan rows yang truncated (empty string) akibat ENUM sebelum ini
UPDATE `notifications` SET `type` = 'Sistem' WHERE `type` = '';
