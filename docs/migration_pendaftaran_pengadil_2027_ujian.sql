-- Sesi 2027 dan seterusnya: kelulusan dokumen bukan kelulusan pendaftaran.
-- Semak senarai terlebih dahulu. Tukar @apply kepada 1 hanya ketika migrasi
-- pangkalan data production yang telah disandarkan.
SET @apply = 0;

SELECT id, user_id, tahun_permohonan, jenis_borang, jenis_pengadil,
       status, status_workflow, status_ujian, admin_approved_at, final_approved_at
FROM permohonan
WHERE jenis_borang = 'pengadil_berdaftar'
  AND tahun_permohonan >= 2027
  AND (jenis_pengadil IS NULL OR jenis_pengadil NOT IN ('Penilai Pengadil', 'Pegawai Pembangunan'))
  AND status = 'Approved'
  AND status_workflow = 'Lengkap'
  AND admin_approved_at IS NOT NULL
  AND (status_ujian IS NULL OR status_ujian <> 'Lulus');

START TRANSACTION;
UPDATE permohonan
SET status = 'Pending',
    status_workflow = 'Admin Diluluskan',
    final_approved_at = NULL,
    status_kemaskini = NOW()
WHERE @apply = 1
  AND jenis_borang = 'pengadil_berdaftar'
  AND tahun_permohonan >= 2027
  AND (jenis_pengadil IS NULL OR jenis_pengadil NOT IN ('Penilai Pengadil', 'Pegawai Pembangunan'))
  AND status = 'Approved'
  AND status_workflow = 'Lengkap'
  AND admin_approved_at IS NOT NULL
  AND (status_ujian IS NULL OR status_ujian <> 'Lulus');
SELECT ROW_COUNT() AS bilangan_dikemaskini;
COMMIT;

-- Rekod 2026 tidak diubah. Keputusan Lulus sedia ada juga dikekalkan.
