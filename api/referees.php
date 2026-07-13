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

        $roleCondition = "AND a.jenis_pengadil IN ('Penilai Pengadil', 'Pegawai Pembangunan')";

    } else {

        $roleCondition = "AND (a.jenis_pengadil NOT IN ('Penilai Pengadil', 'Pegawai Pembangunan') OR a.jenis_pengadil IS NULL)";

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

                a.persatuan_id,

                a.umur,

                a.jenis_pengadil,

                a.alamat1,

                a.alamat2,

                a.poskod,

                a.daerah,

                a.negeri,

                a.status_kerja,

                a.jawatan,

                a.nama_majikan,

                a.alamat_majikan1,

                a.alamat_majikan2,

                a.poskod_majikan,

                a.daerah_majikan,

                a.negeri_majikan,

                a.nama_waris,

                a.hubungan_waris,

                a.telefon_waris,

                a.url_resit,

                a.status_kemaskini,

                a.tarikh_hantar,

                u.tahun_mohon_kelas3,

                u.tahun_lulus_kelas3,

                u.pengadil_kebangsaan,

                u.pengadil_negeri,

                u.pengadil_daerah,

                p.nama_persatuan as persatuan

            FROM users u

            INNER JOIN permohonan a ON u.id = a.user_id

            LEFT JOIN persatuan_bolasepak_daerah p ON a.persatuan_id = p.id

            WHERE a.jenis_borang IN ('pengadil_berdaftar', 'penilai_berdaftar')
            {$roleCondition}

            AND a.status = 'Approved'

            AND (

                (a.status_kemaskini IS NOT NULL AND YEAR(a.status_kemaskini) = :year)

                OR (a.status_kemaskini IS NULL AND YEAR(a.tarikh_hantar) = :year)

            )

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

