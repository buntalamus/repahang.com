-- Migration: Tambah jenis notifikasi untuk modul perlawanan
-- Tarikh: 2026-04-18
-- Sebab: ENUM 'type' dalam table notifications tidak termasuk nilai perlawanan

ALTER TABLE `notifications`
  MODIFY COLUMN `type` ENUM(
    'Permohonan Diterima',
    'PP Perlu Verify',
    'PP Disahkan',
    'Admin Perlu Approve',
    'Admin Diluluskan',
    'Bayaran Diperlukan',
    'Bayaran Disahkan',
    'Borang Akhir',
    'Ditolak',
    'Perlawanan Baru',
    'Rekod Perlawanan',
    'Pengesahan Perlawanan'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
