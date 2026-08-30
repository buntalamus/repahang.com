<?php



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



$method = $_SERVER['REQUEST_METHOD'];



if ($method !== 'GET') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



handleList();



function handleList(): void

{

    requireAdmin();



    $year = isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y');

    $currentYear = (int) date('Y');



    // Validate year range (3 years back, 3 years forward)

    if ($year < ($currentYear - 3) || $year > ($currentYear + 3)) {

        jsonResponse(['error' => true, 'message' => 'Tahun tidak sah.'], 422);

    }



    // Support type param: pengadil_berdaftar (default) or penilai_berdaftar (RA)

    $allowedTypes = ['pengadil_berdaftar', 'penilai_berdaftar'];

    $type = isset($_GET['type']) && in_array($_GET['type'], $allowedTypes, true) ? $_GET['type'] : 'pengadil_berdaftar';



    // RA jenis_pengadil values (Penilai Pengadil & Pegawai Pembangunan)

    // All registrations historically use jenis_borang=pengadil_berdaftar,

    // so we filter by jenis_pengadil to correctly categorize

    if ($type === 'penilai_berdaftar') {
        // Semua PP Daerah ialah RA secara automatik, walaupun tiada
        // permohonan tahunan Penilai Pengadil. Akaun yang memegang peranan
        // sistem lain (contohnya Admin) juga boleh menjadi RA melalui
        // klasifikasi jenis_pengadil tanpa menukar peranan akses mereka.
        $roleCondition = "AND (
            u.role = 'PP Daerah'
            OR u.jenis_pengadil IN ('Penilai Pengadil', 'Pegawai Pembangunan')
            OR a.jenis_pengadil IN ('Penilai Pengadil', 'Pegawai Pembangunan')
        )";
    } else {
        // PP automatik RA tidak dipaparkan sebagai pengadil biasa.
        $roleCondition = "AND a.id IS NOT NULL
            AND (a.jenis_pengadil NOT IN ('Penilai Pengadil', 'Pegawai Pembangunan') OR a.jenis_pengadil IS NULL)";
    }



    try {

        $pdo = getDbConnection();



        $sql = <<<SQL

            SELECT DISTINCT

                u.id as user_id,

                u.role as user_role,

                u.nama_penuh,

                u.no_ic as no_kp,

                u.jantina,

                u.email as emel,

                u.no_telefon,

                u.saiz_baju,

                COALESCE(NULLIF(a.url_gambar_profil, ''), u.url_gambar_profil) as url_gambar_profil,

                a.id,

                COALESCE(a.persatuan_id, u.persatuan_id) as persatuan_id,

                COALESCE(a.umur, u.umur) as umur,

                CASE
                    WHEN u.role = 'PP Daerah' THEN 'Penilai Pengadil'
                    WHEN u.jenis_pengadil IN ('Penilai Pengadil', 'Pegawai Pembangunan')
                        THEN u.jenis_pengadil
                    ELSE a.jenis_pengadil
                END as jenis_pengadil,

                COALESCE(a.alamat1, u.alamat1) as alamat1,

                COALESCE(a.alamat2, u.alamat2) as alamat2,

                COALESCE(a.poskod, u.poskod) as poskod,

                COALESCE(a.daerah, u.daerah) as daerah,

                COALESCE(a.negeri, u.negeri) as negeri,

                COALESCE(a.status_kerja, u.status_kerja) as status_kerja,

                COALESCE(a.jawatan, u.jawatan) as jawatan,

                COALESCE(a.nama_majikan, u.nama_majikan) as nama_majikan,

                COALESCE(a.alamat_majikan1, u.alamat_majikan1) as alamat_majikan1,

                COALESCE(a.alamat_majikan2, u.alamat_majikan2) as alamat_majikan2,

                COALESCE(a.poskod_majikan, u.poskod_majikan) as poskod_majikan,

                COALESCE(a.daerah_majikan, u.daerah_majikan) as daerah_majikan,

                COALESCE(a.negeri_majikan, u.negeri_majikan) as negeri_majikan,

                COALESCE(a.nama_waris, u.nama_waris) as nama_waris,

                COALESCE(a.hubungan_waris, u.hubungan_waris) as hubungan_waris,

                COALESCE(a.telefon_waris, u.telefon_waris) as telefon_waris,

                a.url_resit,

                a.status_kemaskini,

                a.tarikh_hantar,

                u.tahun_mohon_kelas3,

                u.tahun_lulus_kelas3,

                u.pengadil_kebangsaan,

                u.pengadil_negeri,

                u.pengadil_daerah,

                p.nama_persatuan as persatuan,

                CASE
                    WHEN u.role = 'PP Daerah' THEN 'PP Daerah (RA automatik)'
                    WHEN a.id IS NULL THEN CONCAT('Peranan RA pada akaun ', u.role)
                    ELSE 'Permohonan RA'
                END AS sumber_ra

            FROM users u

            LEFT JOIN permohonan a ON u.id = a.user_id
                AND a.jenis_borang IN ('pengadil_berdaftar', 'penilai_berdaftar')
                AND a.status = 'Approved'
                AND (
                    (a.status_kemaskini IS NOT NULL AND YEAR(a.status_kemaskini) = :year)
                    OR (a.status_kemaskini IS NULL AND YEAR(a.tarikh_hantar) = :year)
                )

            LEFT JOIN persatuan_bolasepak_daerah p
                ON p.id = COALESCE(a.persatuan_id, u.persatuan_id)

            WHERE 1 = 1
            {$roleCondition}

            ORDER BY u.nama_penuh ASC

        SQL;



        $stmt = $pdo->prepare($sql);

        $stmt->execute([':year' => $year]);

        $records = $stmt->fetchAll();



        // For each user, fetch all their approved applications (not just referee registration)

        foreach ($records as &$record) {

            $record['approved_applications'] = fetchUserApprovedApplications($pdo, (int) $record['user_id'], $year);

            $record['perlawanan'] = fetchMatches($pdo, (int) $record['user_id']);

        }



        jsonResponse(['error' => false, 'data' => $records]);

    } catch (Throwable $e) {

        error_log('[referees.php] handleList: ' . $e->getMessage());

        $message = APP_DEBUG ? 'Ralat semasa memuatkan pengadil: ' . $e->getMessage() : 'Ralat semasa memuatkan pengadil.';

        jsonResponse(['error' => true, 'message' => $message], 500);

    }

}



function fetchUserApprovedApplications(PDO $pdo, int $userId, int $year): array

{

    $sql = <<<'SQL'

        SELECT

            id,

            jenis_borang,

            jenis_permohonan,

            jenis_pengadil,

            status,

            status_ujian,

            url_resit,

            admin_notes,

            tahun_permohonan,

            status_kemaskini,

            tarikh_hantar

        FROM permohonan

        WHERE user_id = :user_id

        ORDER BY tarikh_hantar DESC

    SQL;



    $stmt = $pdo->prepare($sql);

    $stmt->execute([':user_id' => $userId]);

    return $stmt->fetchAll();

}



function fetchMatches(PDO $pdo, int $userId): array

{

    $stmt = $pdo->prepare('SELECT id, tarikh, jenis, tempat, jawatan, home_team, away_team FROM perlawanan WHERE user_id = :uid ORDER BY tarikh DESC');

    $stmt->execute([':uid' => $userId]);

    return $stmt->fetchAll();

}

