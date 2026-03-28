<?php

/**

 * PP Daerah Statistics API

 * Get comprehensive statistics for PP's district

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



// Require PP Daerah role

$currentUser = requireRole(['PP Daerah']);



$method = $_SERVER['REQUEST_METHOD'];



if ($method !== 'GET') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



handleGetStatistics();



function handleGetStatistics(): void

{

    global $currentUser;



    try {

        $pdo = getDbConnection();



        // Check if PP has persatuan assigned

        if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {

            jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);

        }



        $persatuanId = (int) $currentUser['persatuan_id'];



        // Get comprehensive statistics

        $statistics = [

            'overview' => getOverviewStats($pdo, $persatuanId),

            'applications' => getApplicationStats($pdo, $persatuanId),

            'matches' => getMatchStats($pdo, $persatuanId),

            'referees' => getRefereeStats($pdo, $persatuanId),

            'trends' => getTrendStats($pdo, $persatuanId),

            'persatuan_id' => $persatuanId

        ];



        jsonResponse([

            'error' => false,

            'statistics' => $statistics,

        ]);



    } catch (Throwable $e) {

        error_log('[pp-statistics.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

        error_log('[pp-statistics.php] Stack trace: ' . $e->getTraceAsString());

        $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to load statistics.';

        jsonResponse(['error' => true, 'message' => $message], 500);

    }

}



function getOverviewStats(PDO $pdo, int $persatuanId): array

{

    $stats = [];



    // Current month applications

    $stmt = $pdo->prepare("

        SELECT COUNT(*) as count

        FROM permohonan

        WHERE persatuan_id = :persatuan_id

        AND YEAR(tarikh_hantar) = YEAR(CURRENT_DATE)

        AND MONTH(tarikh_hantar) = MONTH(CURRENT_DATE)

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    $stats['applications_this_month'] = $result ? (int) $result['count'] : 0;



    // Previous month applications

    $stmt = $pdo->prepare("

        SELECT COUNT(*) as count

        FROM permohonan

        WHERE persatuan_id = :persatuan_id

        AND YEAR(tarikh_hantar) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH)

        AND MONTH(tarikh_hantar) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    $stats['applications_last_month'] = $result ? (int) $result['count'] : 0;



    // Applications growth percentage

    $current = $stats['applications_this_month'];

    $previous = $stats['applications_last_month'];

    $stats['applications_growth'] = $previous > 0 ? round((($current - $previous) / $previous) * 100, 1) : 0;



    // Total referees in district

    $stmt = $pdo->prepare("

        SELECT COUNT(*) as count FROM users

        WHERE role = 'Pengadil' AND persatuan_id = :persatuan_id

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    $stats['total_referees'] = $result ? (int) $result['count'] : 0;



    // Active referees (those with approved 2026 applications)

    $stmt = $pdo->prepare("

        SELECT COUNT(DISTINCT u.id) as count FROM users u

        INNER JOIN permohonan p ON u.id = p.user_id

        WHERE u.role = 'Pengadil' AND u.persatuan_id = :persatuan_id

        AND p.tahun_permohonan = 2026 AND p.status = 'Approved'

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    $stats['active_referees'] = $result ? (int) $result['count'] : 0;



    // Matches verified this month

    $stmt = $pdo->prepare("

        SELECT COUNT(*) as count

        FROM perlawanan_pengadil pp

        JOIN perlawanan p ON pp.perlawanan_id = p.id

        JOIN permohonan pm ON p.permohonan_id = pm.id

        WHERE pm.persatuan_id = :persatuan_id

        AND pp.status_pp IS NOT NULL

        AND YEAR(pp.updated_at) = YEAR(CURRENT_DATE)

        AND MONTH(pp.updated_at) = MONTH(CURRENT_DATE)

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    $stats['matches_verified_this_month'] = $result ? (int) $result['count'] : 0;



    return $stats;

}



function getApplicationStats(PDO $pdo, int $persatuanId): array

{

    $stats = [];



    // Applications by status

    $stmt = $pdo->prepare("

        SELECT

            CASE

                WHEN status_workflow = 'Menunggu PP Daerah' THEN 'Menunggu Pengesahan'

                WHEN status_workflow IN ('PP Daerah Disahkan', 'Menunggu Admin') THEN 'Disahkan PP'

                WHEN status_workflow IN ('Admin Diluluskan', 'Menunggu Bayaran', 'Bayaran Diterima', 'Lengkap') THEN 'Diluluskan'

                WHEN status_workflow = 'Ditolak' THEN 'Ditolak'

                ELSE 'Lain-lain'

            END as status_group,

            COUNT(*) as count

        FROM permohonan

        WHERE persatuan_id = :persatuan_id

        GROUP BY status_group

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $statusData = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $stats['by_status'] = array_column($statusData, 'count', 'status_group');



    // Applications by month (last 6 months)

    $stmt = $pdo->prepare("

        SELECT

            DATE_FORMAT(tarikh_hantar, '%Y-%m') as month,

            COUNT(*) as count

        FROM permohonan

        WHERE persatuan_id = :persatuan_id

        AND tarikh_hantar >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)

        GROUP BY DATE_FORMAT(tarikh_hantar, '%Y-%m')

        ORDER BY month

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $monthlyData = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $stats['monthly_trend'] = [];

    foreach ($monthlyData as $row) {

        $stats['monthly_trend'][] = [

            'month' => date('M Y', strtotime($row['month'] . '-01')),

            'count' => (int) $row['count']

        ];

    }



    return $stats;

}



function getMatchStats(PDO $pdo, int $persatuanId): array

{

    $stats = [];



    // Matches verification status

    $stmt = $pdo->prepare("

        SELECT

            CASE

                WHEN pp.status_pp IS NULL THEN 'Belum Disahkan'

                WHEN pp.status_pp = 'Disahkan' THEN 'Disahkan'

                WHEN pp.status_pp = 'Tidak Disahkan' THEN 'Tidak Disahkan'

                ELSE 'Lain-lain'

            END as status,

            COUNT(*) as count

        FROM perlawanan_pengadil pp

        JOIN perlawanan p ON pp.perlawanan_id = p.id

        JOIN permohonan pm ON p.permohonan_id = pm.id

        WHERE pm.persatuan_id = :persatuan_id

        GROUP BY status

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $verificationData = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $stats['verification_status'] = array_column($verificationData, 'count', 'status');



    // Matches by type

    $stmt = $pdo->prepare("

        SELECT

            COALESCE(p.jenis, 'Tidak Dinyatakan') as jenis,

            COUNT(*) as count

        FROM perlawanan p

        JOIN permohonan pm ON p.permohonan_id = pm.id

        WHERE pm.persatuan_id = :persatuan_id

        GROUP BY p.jenis

        ORDER BY count DESC

        LIMIT 10

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $typeData = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $stats['by_type'] = $typeData;



    // Monthly verification trend

    $stmt = $pdo->prepare("

        SELECT

            DATE_FORMAT(pp.updated_at, '%Y-%m') as month,

            COUNT(*) as count

        FROM perlawanan_pengadil pp

        JOIN perlawanan p ON pp.perlawanan_id = p.id

        JOIN permohonan pm ON p.permohonan_id = pm.id

        WHERE pm.persatuan_id = :persatuan_id

        AND pp.status_pp IS NOT NULL

        AND pp.updated_at >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)

        GROUP BY DATE_FORMAT(pp.updated_at, '%Y-%m')

        ORDER BY month

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $monthlyVerification = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $stats['verification_trend'] = [];

    foreach ($monthlyVerification as $row) {

        $stats['verification_trend'][] = [

            'month' => date('M Y', strtotime($row['month'] . '-01')),

            'count' => (int) $row['count']

        ];

    }



    return $stats;

}



function getRefereeStats(PDO $pdo, int $persatuanId): array

{

    $stats = [];



    // Referee status distribution (based on 2026 application approval)

    $stmt = $pdo->prepare("

        SELECT

            CASE

                WHEN EXISTS (

                    SELECT 1 FROM permohonan p

                    WHERE p.user_id = u.id

                    AND p.tahun_permohonan = 2026

                    AND p.status = 'Approved'

                ) THEN 'Aktif'

                ELSE 'Tidak Aktif'

            END as status,

            COUNT(*) as count

        FROM users u

        WHERE role = 'Pengadil' AND persatuan_id = :persatuan_id

        GROUP BY status

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $statusData = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $stats['status_distribution'] = array_column($statusData, 'count', 'status');



    // Referees by type

    $stmt = $pdo->prepare("

        SELECT

            COALESCE(jenis_pengadil, 'Tidak Dinyatakan') as jenis,

            COUNT(*) as count

        FROM users

        WHERE role = 'Pengadil' AND persatuan_id = :persatuan_id

        GROUP BY jenis_pengadil

        ORDER BY count DESC

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $typeData = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $stats['by_type'] = $typeData;



    // Referee registration trend

    $stmt = $pdo->prepare("

        SELECT

            DATE_FORMAT(created_at, '%Y-%m') as month,

            COUNT(*) as count

        FROM users

        WHERE role = 'Pengadil' AND persatuan_id = :persatuan_id

        AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)

        GROUP BY DATE_FORMAT(created_at, '%Y-%m')

        ORDER BY month

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $registrationData = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $stats['registration_trend'] = [];

    foreach ($registrationData as $row) {

        $stats['registration_trend'][] = [

            'month' => date('M Y', strtotime($row['month'] . '-01')),

            'count' => (int) $row['count']

        ];

    }



    return $stats;

}



function getTrendStats(PDO $pdo, int $persatuanId): array

{

    $stats = [];



    // Combined monthly statistics for the last 6 months

    $stmt = $pdo->prepare("

        SELECT

            DATE_FORMAT(tarikh_hantar, '%Y-%m') as month,

            COUNT(*) as applications,

            SUM(CASE WHEN status_workflow = 'Admin Diluluskan' THEN 1 ELSE 0 END) as approved

        FROM permohonan

        WHERE persatuan_id = :persatuan_id

        AND tarikh_hantar >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)

        GROUP BY DATE_FORMAT(tarikh_hantar, '%Y-%m')

        ORDER BY month

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $trendData = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $stats['monthly_combined'] = [];

    foreach ($trendData as $row) {

        $stats['monthly_combined'][] = [

            'month' => date('M Y', strtotime($row['month'] . '-01')),

            'applications' => (int) $row['applications'],

            'approved' => (int) $row['approved']

        ];

    }



    // Performance metrics

    $stmt = $pdo->prepare("

        SELECT

            AVG(CASE WHEN status_workflow = 'Admin Diluluskan' THEN 1 ELSE 0 END) * 100 as approval_rate,

            COUNT(*) as total_applications

        FROM permohonan

        WHERE persatuan_id = :persatuan_id

        AND tarikh_hantar >= DATE_SUB(CURRENT_DATE, INTERVAL 3 MONTH)

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $performance = $stmt->fetch();



    $stats['performance'] = [

        'approval_rate' => $performance ? round((float) $performance['approval_rate'], 1) : 0,

        'total_applications_last_3_months' => $performance ? (int) $performance['total_applications'] : 0

    ];



    return $stats;

}