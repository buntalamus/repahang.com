<?php

/**
 * PP Daerah Applications API
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['PP Daerah']);

try {

    $pdo = getDbConnection();

    if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {
        jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);
    }

    $persatuanId = $currentUser['persatuan_id'];
    $type = $_GET['type'] ?? 'pengesahan';

    // Map type to jenis_borang filter
    $jenisBorangMap = [
        'pengadil' => 'pengadil_berdaftar',
        'berdaftar' => 'penilai_berdaftar',
        'kelas3'   => 'kelas3_fam',
        'kelas1'   => 'ujian_kelas1_fam',
    ];

    $allStatuses = "('Menunggu PP Daerah', 'PP Daerah Disahkan', 'Menunggu Admin', 'Admin Diluluskan', 'Lengkap', 'Ditolak')";

    if ($type === 'pengesahan') {
        // Pengesahan: semua jenis_borang, pending sahaja
        $sql = "
            SELECT p.*, pb.nama_persatuan as district_name
            FROM permohonan p
            LEFT JOIN persatuan_bolasepak_daerah pb ON p.persatuan_id = pb.id
            WHERE p.persatuan_id = :persatuan_id
              AND p.status_workflow = 'Menunggu PP Daerah'
            ORDER BY p.tarikh_hantar DESC
        ";
        $params = [':persatuan_id' => $persatuanId];

    } elseif (isset($jenisBorangMap[$type])) {
        // Permohonan ikut jenis: semua statuses
        $jenisBorang = $jenisBorangMap[$type];
        $sql = "
            SELECT p.*, pb.nama_persatuan as district_name
            FROM permohonan p
            LEFT JOIN persatuan_bolasepak_daerah pb ON p.persatuan_id = pb.id
            WHERE p.persatuan_id = :persatuan_id
              AND p.jenis_borang = :jenis_borang
              AND p.status_workflow IN {$allStatuses}
            ORDER BY p.status_workflow = 'Menunggu PP Daerah' DESC, p.tarikh_hantar DESC
        ";
        $params = [':persatuan_id' => $persatuanId, ':jenis_borang' => $jenisBorang];

    } else {
        jsonResponse(['error' => true, 'message' => 'Jenis tidak sah.'], 400);
    }

    $appsStmt = $pdo->prepare($sql);
    $appsStmt->execute($params);
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

    // Stats
    $stats = [];
    $stats['pending'] = count(array_filter($applications, fn($a) => $a['status_workflow'] === 'Menunggu PP Daerah'));

    $approvedStmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM permohonan
        WHERE persatuan_id = :persatuan_id
          AND status_workflow IN ('PP Daerah Disahkan', 'Menunggu Admin', 'Admin Diluluskan', 'Lengkap')
          AND pp_verified_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
    ");
    $approvedStmt->execute([':persatuan_id' => $persatuanId]);
    $stats['approved_this_month'] = (int) ($approvedStmt->fetch()['count'] ?? 0);

    $totalStmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM users
        WHERE persatuan_id = :persatuan_id AND role = 'Pengadil' AND aktif = 1
    ");
    $totalStmt->execute([':persatuan_id' => $persatuanId]);
    $stats['total_referees'] = (int) ($totalStmt->fetch()['count'] ?? 0);

    jsonResponse([
        'error'        => false,
        'applications' => $applications,
        'statistics'   => $stats,
        'persatuan_id' => $persatuanId,
    ]);

} catch (Throwable $e) {
    error_log('[pp-applications.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());
    $message = APP_DEBUG ? 'Error: ' . $e->getMessage() : 'Failed to load applications.';
    jsonResponse(['error' => true, 'message' => $message], 500);
}
