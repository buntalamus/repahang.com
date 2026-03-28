<?php
require_once 'bootstrap.php';
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

    // 1. Total pending applications
    $stmt1 = $pdo->query("SELECT COUNT(*) FROM permohonan WHERE status_workflow IN ('Menunggu Admin', 'Menunggu PP Daerah')");
    $pending_applications = $stmt1->fetchColumn();

    // 2. Total pending penilaian reports (awaiting admin verification)
    $stmt2 = $pdo->query("SELECT COUNT(*) FROM laporan_penilaian WHERE status = 'Dihantar'");
    $pending_reports = $stmt2->fetchColumn();

    $tasks = [
        'pending_applications' => (int)$pending_applications,
        'pending_reports' => (int)$pending_reports
    ];

    echo json_encode([
        'error' => false,
        'tasks' => $tasks
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => $e->getMessage()]);
}
