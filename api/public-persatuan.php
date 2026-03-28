<?php
/**
 * Public Persatuan List API — no authentication required
 * Returns list of active persatuan for registration form
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
        SELECT id, nama_persatuan, kod_persatuan, daerah
        FROM persatuan_bolasepak_daerah
        WHERE aktif = 1
        ORDER BY nama_persatuan ASC
    ");
    $stmt->execute();
    $list = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'error' => false,
        'data' => $list
    ]);

} catch (Throwable $e) {
    error_log('[public-persatuan.php] Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => 'Gagal memuatkan senarai persatuan.']);
}
