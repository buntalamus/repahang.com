-- Migrasi identiti: Fairuz bin Nordin kekal Admin dan turut menjadi RA
-- berdaftar menggunakan akaun users sedia ada.
--
-- Punca: orang yang sama wujud sebagai users (Admin, Telegram sudah dipaut)
-- dan pengadil_luar (Penilai Pengadil). Telegram hanya boleh dipaut kepada
-- satu identiti. Migrasi ini menjadikan rekod users identiti kanonik,
-- memindahkan pool/lantikan/pengesahan, dan membuang rekod luar pendua.
--
-- Prasyarat:
--   1. Sandarkan pangkalan data production.
--   2. Jalankan docs/migration_lantikan_audit.sql.
--   3. Jalankan docs/migration_laporan_pengesahan_pengerusi.sql.
--
-- FAIL APPLY SEBENAR: jalankan keseluruhan fail ini sekali. Migrasi hanya
-- diteruskan apabila terdapat tepat satu akaun users, paling banyak satu
-- rekod luar, dan konflik_lantikan = 0.
SET @sahkan_migrasi_fairuz = 1;

-- Tetapkan collation yang sama dengan jadual legacy supaya skrip turut serasi
-- dengan klien MySQL 8/9 yang menggunakan utf8mb4_0900_ai_ci secara lalai.
SET @fairuz_email = CONVERT('phgref@gmail.com' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @fairuz_no_ic = CONVERT('780211065569' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @fairuz_phone = CONVERT('0169238505' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @fairuz_registration_year = 2026;

SET @fairuz_user_count = (
    SELECT COUNT(*)
    FROM users
    WHERE LOWER(TRIM(email)) = @fairuz_email
      AND no_ic = @fairuz_no_ic
);

SET @fairuz_user_id = IF(
    @fairuz_user_count = 1,
    (
        SELECT id
        FROM users
        WHERE LOWER(TRIM(email)) = @fairuz_email
          AND no_ic = @fairuz_no_ic
        LIMIT 1
    ),
    NULL
);

-- Nombor telefon dibandingkan selepas tanda -, ruang dan awalan +60 dibuang.
SET @fairuz_luar_count = (
    SELECT COUNT(*)
    FROM pengadil_luar
    WHERE LOWER(TRIM(emel)) = @fairuz_email
      AND REPLACE(REPLACE(REPLACE(TRIM(no_tel), '-', ''), ' ', ''), '+60', '0') = @fairuz_phone
);

SET @fairuz_luar_id = IF(
    @fairuz_luar_count = 1,
    (
        SELECT id
        FROM pengadil_luar
        WHERE LOWER(TRIM(emel)) = @fairuz_email
          AND REPLACE(REPLACE(REPLACE(TRIM(no_tel), '-', ''), ' ', ''), '+60', '0') = @fairuz_phone
        LIMIT 1
    ),
    NULL
);

-- Blok seluruh APPLY jika akaun users itu telah memegang slot lain dalam
-- perlawanan yang sama dengan lantikan luar Fairuz.
SET @fairuz_lantikan_conflicts = IF(
    @fairuz_user_id IS NULL OR @fairuz_luar_id IS NULL,
    0,
    (
        SELECT COUNT(*)
        FROM lantikan_pengadil lp_luar
        JOIN lantikan_pengadil lp_user
          ON lp_user.jadual_id = lp_luar.jadual_id
         AND lp_user.pengadil_id = @fairuz_user_id
         AND lp_user.id <> lp_luar.id
        WHERE lp_luar.pengadil_luar_id = @fairuz_luar_id
    )
);

SET @fairuz_boleh_apply = (
    @sahkan_migrasi_fairuz = 1
    AND @fairuz_user_count = 1
    AND @fairuz_luar_count <= 1
    AND @fairuz_lantikan_conflicts = 0
);

-- PREVIEW identiti. telegram_chat_id mesti kekal pada baris users.
SELECT
    'IDENTITI USERS' AS semakan,
    id, email, role, nama_penuh, no_ic, no_telefon,
    telegram_chat_id, jenis_pengadil, aktif
FROM users
WHERE id = @fairuz_user_id;

SELECT
    'IDENTITI LUAR PENDUA' AS semakan,
    id, nama, daerah, negeri, no_tel, emel,
    telegram_chat_id, jenis_pengadil
FROM pengadil_luar
WHERE id = @fairuz_luar_id;

SELECT
    'RINGKASAN PREVIEW' AS semakan,
    @sahkan_migrasi_fairuz AS mod_apply,
    @fairuz_user_count AS bil_users,
    @fairuz_luar_count AS bil_luar,
    @fairuz_lantikan_conflicts AS konflik_lantikan,
    (SELECT COUNT(*)
     FROM permohonan
     WHERE user_id = @fairuz_user_id
       AND tahun_permohonan = @fairuz_registration_year
       AND status = 'Approved'
       AND jenis_pengadil = 'Penilai Pengadil') AS rekod_ra_2026_sedia_ada,
    (SELECT COUNT(*) FROM pool_pengadil WHERE pengadil_luar_id = @fairuz_luar_id) AS pool_akan_dipindah,
    (SELECT COUNT(*) FROM lantikan_pengadil WHERE pengadil_luar_id = @fairuz_luar_id) AS lantikan_akan_dipindah,
    (SELECT COUNT(*) FROM kejohanan_pengesah_laporan WHERE pengesah_luar_id = @fairuz_luar_id) AS pengerusi_akan_dipindah,
    (SELECT COUNT(*) FROM laporan_pengesahan_pengerusi WHERE pengesah_luar_id = @fairuz_luar_id) AS rekod_pengesahan_akan_dipindah,
    @fairuz_boleh_apply AS boleh_apply;

SELECT
    'KONFLIK LANTIKAN - MESTI KOSONG' AS semakan,
    lp_luar.id AS lantikan_luar_id,
    lp_user.id AS lantikan_users_id,
    lp_luar.jadual_id,
    lp_luar.jawatan AS jawatan_luar,
    lp_user.jawatan AS jawatan_users
FROM lantikan_pengadil lp_luar
JOIN lantikan_pengadil lp_user
  ON lp_user.jadual_id = lp_luar.jadual_id
 AND lp_user.pengadil_id = @fairuz_user_id
 AND lp_user.id <> lp_luar.id
WHERE lp_luar.pengadil_luar_id = @fairuz_luar_id;

START TRANSACTION;

-- role kekal Admin. Hanya klasifikasi tugas ditetapkan sebagai RA.
UPDATE users
SET jenis_pengadil = 'Penilai Pengadil'
WHERE id = @fairuz_user_id
  AND @fairuz_boleh_apply = 1;

-- API production RA Berdaftar membaca pendaftaran tahunan yang diluluskan.
-- Wujudkan rekod RA 2026 daripada profil users tanpa menduplikasi rekod jika
-- skrip ini dijalankan semula.
INSERT INTO permohonan (
    user_id, district_id, persatuan_id, tahun_permohonan, jenis_borang,
    nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil,
    alamat1, alamat2, poskod, daerah, negeri,
    status_kerja, jawatan, nama_majikan,
    alamat_majikan1, alamat_majikan2, poskod_majikan,
    daerah_majikan, negeri_majikan,
    nama_waris, hubungan_waris, telefon_waris,
    url_resit, url_gambar_profil, saiz_baju,
    payment_amount, status, status_workflow,
    admin_approved_at, admin_notes, final_approved_at,
    tarikh_hantar, status_kemaskini, updated_at
)
SELECT
    u.id, u.district_id, u.persatuan_id, @fairuz_registration_year,
    'penilai_berdaftar',
    u.nama_penuh, COALESCE(u.no_ic, ''), u.email,
    COALESCE(u.no_telefon, ''), COALESCE(u.jantina, ''),
    'Penilai Pengadil',
    COALESCE(u.alamat1, ''), u.alamat2, COALESCE(u.poskod, ''),
    COALESCE(NULLIF(TRIM(u.daerah), ''), 'Bera'),
    COALESCE(NULLIF(TRIM(u.negeri), ''), 'Pahang'),
    COALESCE(u.status_kerja, ''), u.jawatan, u.nama_majikan,
    u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan,
    u.daerah_majikan, u.negeri_majikan,
    COALESCE(u.nama_waris, ''), COALESCE(u.hubungan_waris, ''),
    COALESCE(u.telefon_waris, ''),
    NULL, u.url_gambar_profil, u.saiz_baju,
    NULL, 'Approved', 'Lengkap',
    CURRENT_TIMESTAMP,
    'Migrasi identiti Fairuz bin Nordin sebagai RA Berdaftar 2026; role Admin dan Telegram dikekalkan.',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users u
WHERE u.id = @fairuz_user_id
  AND @fairuz_boleh_apply = 1
  AND NOT EXISTS (
      SELECT 1
      FROM permohonan p
      WHERE p.user_id = u.id
        AND p.tahun_permohonan = @fairuz_registration_year
        AND p.status = 'Approved'
        AND p.jenis_pengadil = 'Penilai Pengadil'
  );

-- Jika kedua-dua identiti sudah berada dalam pool kejohanan yang sama,
-- kekalkan baris users dan buang baris pool luar sebelum kemas kini selebihnya.
DELETE pp_luar
FROM pool_pengadil pp_luar
JOIN pool_pengadil pp_user
  ON pp_user.kejohanan_id = pp_luar.kejohanan_id
 AND pp_user.pengadil_id = @fairuz_user_id
WHERE pp_luar.pengadil_luar_id = @fairuz_luar_id
  AND @fairuz_boleh_apply = 1;

UPDATE pool_pengadil
SET pengadil_id = @fairuz_user_id,
    pengadil_luar_id = NULL
WHERE pengadil_luar_id = @fairuz_luar_id
  AND @fairuz_boleh_apply = 1;

-- Catat pertukaran identiti sebelum foreign key lantikan ditukar.
INSERT IGNORE INTO lantikan_audit_log (
    event_key, lantikan_id, jadual_id, kejohanan_id,
    pengadil_id, pengadil_luar_id, jawatan,
    nama_pegawai, emel_pegawai, no_telefon_pegawai,
    event_type, channel, event_status, details_json,
    actor_type, created_at
)
SELECT
    CONCAT('identity-merge-fairuz-', lp.id),
    lp.id, lp.jadual_id, jp.kejohanan_id,
    @fairuz_user_id, @fairuz_luar_id, lp.jawatan,
    u.nama_penuh, u.email, u.no_telefon,
    'identity_merged_to_registered', 'migration', 'success',
    JSON_OBJECT(
        'old_source', 'pengadil_luar',
        'old_id', @fairuz_luar_id,
        'new_source', 'users',
        'new_id', @fairuz_user_id,
        'role_preserved', u.role,
        'telegram_preserved', IF(u.telegram_chat_id IS NULL, 0, 1)
    ),
    'migration', CURRENT_TIMESTAMP
FROM lantikan_pengadil lp
JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
JOIN users u ON u.id = @fairuz_user_id
WHERE lp.pengadil_luar_id = @fairuz_luar_id
  AND @fairuz_boleh_apply = 1;

UPDATE lantikan_pengadil
SET pengadil_id = @fairuz_user_id,
    pengadil_luar_id = NULL
WHERE pengadil_luar_id = @fairuz_luar_id
  AND @fairuz_boleh_apply = 1;

-- Selaraskan identiti Pengerusi Pengadil jika rekod luar Fairuz pernah dipilih.
UPDATE kejohanan_pengesah_laporan
SET pengesah_user_id = @fairuz_user_id,
    pengesah_luar_id = NULL
WHERE pengesah_luar_id = @fairuz_luar_id
  AND @fairuz_boleh_apply = 1;

UPDATE laporan_pengesahan_pengerusi
SET pengesah_user_id = @fairuz_user_id,
    pengesah_luar_id = NULL
WHERE pengesah_luar_id = @fairuz_luar_id
  AND @fairuz_boleh_apply = 1;

-- Rekod audit lama masih merujuk manusia yang sama; tukar hanya foreign key
-- pelaku kepada identiti users kanonik tanpa mengubah masa atau kandungan audit.
UPDATE laporan_pengesahan_audit
SET actor_user_id = COALESCE(actor_user_id, @fairuz_user_id),
    actor_luar_id = NULL
WHERE actor_luar_id = @fairuz_luar_id
  AND @fairuz_boleh_apply = 1;

-- Log lantikan/onboarding menyimpan snapshot nama dan sengaja tiada FK. Rekod
-- itu kekal sebagai bukti sejarah walaupun profil luar pendua dibuang.
DELETE FROM pengadil_luar
WHERE id = @fairuz_luar_id
  AND @fairuz_boleh_apply = 1
  AND NOT EXISTS (
      SELECT 1 FROM pool_pengadil WHERE pengadil_luar_id = @fairuz_luar_id
  )
  AND NOT EXISTS (
      SELECT 1 FROM lantikan_pengadil WHERE pengadil_luar_id = @fairuz_luar_id
  )
  AND NOT EXISTS (
      SELECT 1 FROM kejohanan_pengesah_laporan WHERE pengesah_luar_id = @fairuz_luar_id
  )
  AND NOT EXISTS (
      SELECT 1 FROM laporan_pengesahan_pengerusi WHERE pengesah_luar_id = @fairuz_luar_id
  )
  AND NOT EXISTS (
      SELECT 1 FROM laporan_pengesahan_audit WHERE actor_luar_id = @fairuz_luar_id
  );

COMMIT;

-- VERIFIKASI: selepas APPLY, role mesti Admin, jenis_pengadil mesti
-- Penilai Pengadil, Telegram mesti kekal, dan semua kiraan *_luar mesti 0.
SELECT
    'KEPUTUSAN AKHIR' AS semakan,
    u.id AS user_id,
    u.nama_penuh,
    u.role,
    u.jenis_pengadil,
    CASE WHEN u.telegram_chat_id IS NULL THEN 0 ELSE 1 END AS telegram_linked,
    (SELECT COUNT(*)
     FROM permohonan
     WHERE user_id = u.id
       AND tahun_permohonan = @fairuz_registration_year
       AND status = 'Approved'
       AND jenis_pengadil = 'Penilai Pengadil') AS rekod_ra_2026,
    (SELECT COUNT(*) FROM pool_pengadil WHERE pengadil_id = u.id) AS jumlah_pool_users,
    (SELECT COUNT(*) FROM lantikan_pengadil WHERE pengadil_id = u.id) AS jumlah_lantikan_users,
    (SELECT COUNT(*) FROM pool_pengadil WHERE pengadil_luar_id = @fairuz_luar_id) AS baki_pool_luar,
    (SELECT COUNT(*) FROM lantikan_pengadil WHERE pengadil_luar_id = @fairuz_luar_id) AS baki_lantikan_luar,
    (SELECT COUNT(*) FROM pengadil_luar WHERE id = @fairuz_luar_id) AS baki_profil_luar
FROM users u
WHERE u.id = @fairuz_user_id;

SELECT CASE
    WHEN @sahkan_migrasi_fairuz = 0 THEN 'PREVIEW SAHAJA - TIADA DATA DIUBAH'
    WHEN @fairuz_user_count <> 1 THEN 'TIDAK DIUBAH - PADANAN USERS BUKAN TEPAT SATU'
    WHEN @fairuz_luar_count > 1 THEN 'TIDAK DIUBAH - PADANAN PENGADIL LUAR LEBIH DARIPADA SATU'
    WHEN @fairuz_lantikan_conflicts > 0 THEN 'TIDAK DIUBAH - ADA KONFLIK LANTIKAN'
    ELSE 'APPLY SELESAI - SEMAK KEPUTUSAN AKHIR'
END AS status_migrasi;
