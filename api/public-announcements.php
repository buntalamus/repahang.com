<?php
/**
 * Public Announcements API — no authentication required
 * Returns active announcements for the login page
 */

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => true, 'message' => 'Method not allowed']);
    exit;
}

try {
    $pdo = getDbConnection();

    $stmt = $pdo->prepare("
        SELECT id, title, content, created_at
        FROM announcements
        ORDER BY created_at DESC
        LIMIT 5
    ");
    $stmt->execute();
    $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($announcements as &$a) {
        $a['created_at_formatted'] = date('d/m/Y', strtotime($a['created_at']));
    }

    echo json_encode([
        'error' => false,
        'data' => $announcements
    ]);

} catch (Throwable $e) {
    error_log('[public-announcements.php] Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => 'Gagal memuatkan pengumuman.']);
}
