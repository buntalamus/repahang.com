<?php
require_once __DIR__ . '/bootstrap.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'Admin') {
        http_response_code(401);
        echo json_encode(['error' => true, 'message' => 'Unauthorised']);
        exit;
    }

    $pdo = getDbConnection();

    // Total Pengadil
    $stmtUsers = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'Pengadil' AND aktif = 1");
    $totalPengadil = $stmtUsers->fetchColumn();

    // Permohonan Baru
    $stmtApps = $pdo->query("SELECT COUNT(*) FROM permohonan WHERE status IN ('Menunggu Admin', 'Menunggu PP Daerah')");
    $pendingApps = $stmtApps->fetchColumn();

    // Laporan Penilaian Menunggu Pengesahan
    $stmtVer = $pdo->query("SELECT COUNT(*) FROM laporan_penilaian WHERE status = 'Dihantar'");
    $pendingReports = $stmtVer->fetchColumn();

    // Jumlah Perlawanan Bulan Ini
    $stmtMatches = $pdo->query("SELECT COUNT(*) FROM perlawanan WHERE MONTH(tarikh) = MONTH(CURRENT_DATE()) AND YEAR(tarikh) = YEAR(CURRENT_DATE())");
    $matchesThisMonth = $stmtMatches->fetchColumn();

    echo json_encode([
        'error' => false,
        'stats' => [
            'total_pengadil' => (int)$totalPengadil,
            'pending_applications' => (int)$pendingApps,
            'pending_reports' => (int)$pendingReports,
            'matches_this_month' => (int)$matchesThisMonth
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => $e->getMessage()]);
}
