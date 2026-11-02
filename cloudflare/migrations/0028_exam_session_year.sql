-- Kelas III FAM and Ujian Kelas I FAM belong to the year they are applied in
-- (applied 2026 -> session 2026). They were recorded under the annual
-- 'application_year' setting (e.g. 2027) instead. Move each to the year of its
-- tarikh_hantar, unless that would duplicate an application already there.
-- Pendaftaran Tahunan rows are untouched (applied 2026 -> session 2027).
-- Safe to run more than once.
UPDATE permohonan
SET tahun_permohonan = CAST(substr(tarikh_hantar, 1, 4) AS INTEGER)
WHERE jenis_borang IN ('kelas3_fam', 'ujian_kelas1_fam')
  AND tarikh_hantar GLOB '20[0-9][0-9]-*'
  AND tahun_permohonan IS NOT CAST(substr(tarikh_hantar, 1, 4) AS INTEGER)
  AND NOT EXISTS (
    SELECT 1 FROM permohonan other
    WHERE other.user_id = permohonan.user_id
      AND other.jenis_borang = permohonan.jenis_borang
      AND other.tahun_permohonan = CAST(substr(permohonan.tarikh_hantar, 1, 4) AS INTEGER)
      AND other.id <> permohonan.id
  );

-- A Kelas I application awaiting Admin with no status_workflow could not be
-- approved (approval requires status_workflow='Menunggu Admin').
UPDATE permohonan
SET status_workflow = 'Menunggu Admin'
WHERE jenis_borang = 'ujian_kelas1_fam'
  AND status_workflow IS NULL
  AND workflow_status = 'Pending';
