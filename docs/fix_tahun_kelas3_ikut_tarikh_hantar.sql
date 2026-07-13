-- ============================================================================
-- Pembetulan: tahun Kelas 3 FAM dalam profil ikut TARIKH HANTAR sebenar
-- Sasaran DB: refpahan_refpahang
--
-- Masalah:
--   users.tahun_mohon_kelas3 / tahun_lulus_kelas3 diisi dari
--   permohonan.tahun_permohonan. Kolum itu = tahun KITARAN dari tetapan
--   'application_year' (kini ditetapkan 2027), BUKAN tahun permohonan
--   sebenar dihantar. Akibatnya profil boleh papar tahun hadapan (cth 2027)
--   untuk permohonan yang sebenarnya dihantar pada 2026.
--
-- Pembetulan: kira semula kedua-dua kolum guna YEAR(tarikh_hantar).
-- Selamat dijalankan berulang kali (idempotent).
--
-- NOTA: Sila juga semak tetapan 'application_year' di menu Admin > Tetapan.
--   SELECT * FROM settings WHERE setting_key = 'application_year';
-- ============================================================================

-- Tahun mohon = tahun TERAWAL permohonan Kelas 3 dihantar
UPDATE users u
JOIN (
    SELECT user_id, MIN(COALESCE(YEAR(tarikh_hantar), tahun_permohonan)) AS tahun
    FROM permohonan
    WHERE jenis_borang IN ('kelas3_fam', 'ujian_bertulis')
    GROUP BY user_id
) t ON t.user_id = u.id
SET u.tahun_mohon_kelas3 = t.tahun
WHERE u.tahun_mohon_kelas3 IS NULL OR u.tahun_mohon_kelas3 <> t.tahun;

-- Tahun lulus = tahun TERKINI permohonan Kelas 3 yang LULUS
UPDATE users u
JOIN (
    SELECT user_id, MAX(COALESCE(YEAR(tarikh_hantar), tahun_permohonan)) AS tahun
    FROM permohonan
    WHERE jenis_borang IN ('kelas3_fam', 'ujian_bertulis')
      AND (status_ujian = 'Lulus'
           OR (jenis_borang = 'ujian_bertulis'
               AND status_workflow IN ('Lengkap', 'Admin Diluluskan', 'Bayaran Diterima')))
    GROUP BY user_id
) t ON t.user_id = u.id
SET u.tahun_lulus_kelas3 = t.tahun
WHERE u.tahun_lulus_kelas3 IS NULL OR u.tahun_lulus_kelas3 <> t.tahun;

-- Kosongkan tahun lulus bagi yang tiada permohonan Kelas 3 yang lulus
UPDATE users u
SET u.tahun_lulus_kelas3 = NULL
WHERE u.tahun_lulus_kelas3 IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM permohonan p
      WHERE p.user_id = u.id
        AND p.jenis_borang IN ('kelas3_fam', 'ujian_bertulis')
        AND (p.status_ujian = 'Lulus'
             OR (p.jenis_borang = 'ujian_bertulis'
                 AND p.status_workflow IN ('Lengkap', 'Admin Diluluskan', 'Bayaran Diterima')))
  );

-- ── Semakan selepas pembetulan (pilihan) ────────────────────────────────────
-- SELECT id, nama_penuh, tahun_mohon_kelas3, tahun_lulus_kelas3
-- FROM users WHERE tahun_mohon_kelas3 IS NOT NULL OR tahun_lulus_kelas3 IS NOT NULL;
