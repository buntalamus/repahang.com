<?php

/**

 * PP Daerah Applications API

 * Get applications for PP's district that need verification

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



// Require PP Daerah role

$currentUser = requireRole(['PP Daerah']);



try {

    $pdo = getDbConnection();

    

    // Check if PP has persatuan assigned

    if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {

        jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);

    }

    

    $persatuanId = $currentUser['persatuan_id'];

    

    // Get applications waiting for PP verification

    $appsStmt = $pdo->prepare("

        SELECT 

            p.*,

            pb.nama_persatuan as district_name

        FROM permohonan p

        LEFT JOIN persatuan_bolasepak_daerah pb ON p.persatuan_id = pb.id

        WHERE p.persatuan_id = :persatuan_id

        AND p.status_workflow = 'Menunggu PP Daerah'

        ORDER BY p.tarikh_hantar DESC

    ");

    

    $appsStmt->execute([':persatuan_id' => $persatuanId]);

    $applications = $appsStmt->fetchAll();

    

    // Get match records for each application

    foreach ($applications as &$app) {

        $matchStmt = $pdo->prepare('

            SELECT tarikh, jenis, tempat, jawatan 

            FROM perlawanan 

            WHERE permohonan_id = :id 

            ORDER BY tarikh DESC

        ');

        $matchStmt->execute([':id' => $app['id']]);

        $app['perlawanan'] = $matchStmt->fetchAll();

    }

    

    // Get statistics

    $stats = [];

    

    // Pending count

    $stats['pending'] = count($applications);

    

    // Approved this month

    $approvedStmt = $pdo->prepare("

        SELECT COUNT(*) as count 

        FROM permohonan 

        WHERE persatuan_id = :persatuan_id

        AND status_workflow IN ('PP Daerah Disahkan', 'Menunggu Admin', 'Admin Diluluskan', 'Lengkap')

        AND pp_verified_at >= DATE_FORMAT(NOW(), '%Y-%m-01')

    ");

    $approvedStmt->execute([':persatuan_id' => $persatuanId]);

    $approvedRow = $approvedStmt->fetch();

    $stats['approved_this_month'] = (int) ($approvedRow['count'] ?? 0);

    

    // Total referees in district

    $totalStmt = $pdo->prepare("

        SELECT COUNT(*) as count 

        FROM users 

        WHERE persatuan_id = :persatuan_id 

        AND role = 'Pengadil'

        AND aktif = 1

    ");

    $totalStmt->execute([':persatuan_id' => $persatuanId]);

    $totalRow = $totalStmt->fetch();

    $stats['total_referees'] = (int) ($totalRow['count'] ?? 0);

    

    jsonResponse([

        'error' => false,

        'applications' => $applications,

        'statistics' => $stats,

        'persatuan_id' => $persatuanId,

    ]);

    

} catch (Throwable $e) {

    error_log('[pp-applications.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

    error_log('[pp-applications.php] Stack trace: ' . $e->getTraceAsString());

    $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to load applications.';

    jsonResponse(['error' => true, 'message' => $message], 500);

}

