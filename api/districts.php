<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

requireRole(['Pengadil', 'Penilai', 'PP Daerah', 'Admin']);

try {
    $pdo = getDbConnection();
    $stmt = $pdo->query("SELECT id, nama FROM districts ORDER BY nama ASC");
    $districts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(['error' => false, 'data' => $districts]);
} catch (Throwable $e) {
    error_log('[districts.php] Error: ' . $e->getMessage());
    jsonResponse(['error' => true, 'message' => 'Gagal memuatkan senarai daerah.'], 500);
}
