<?php
/**
 * Padang (Venue) API — CRUD per kejohanan
 * GET    /api/padang.php?kejohanan_id=X  - list padangs for a tournament
 * POST   /api/padang.php                 - create
 * PUT    /api/padang.php                 - update
 * DELETE /api/padang.php?id=X            - delete
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Admin']);

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $kejohanan_id = (int) ($_GET['kejohanan_id'] ?? 0);
        if (!$kejohanan_id) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
        }
        $stmt = $pdo->prepare("SELECT * FROM padang WHERE kejohanan_id = :kid ORDER BY nama ASC");
        $stmt->execute([':kid' => $kejohanan_id]);
        jsonResponse(['error' => false, 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $kejohanan_id = (int) ($input['kejohanan_id'] ?? 0);
        $nama = trim($input['nama'] ?? '');

        if (!$kejohanan_id || !$nama) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id dan nama diperlukan.'], 400);
        }

        $stmt = $pdo->prepare("INSERT INTO padang (kejohanan_id, nama, alamat) VALUES (:kid, :nama, :alamat)");
        $stmt->execute([
            ':kid'    => $kejohanan_id,
            ':nama'   => $nama,
            ':alamat' => trim($input['alamat'] ?? ''),
        ]);
        $id = (int) $pdo->lastInsertId();
        jsonResponse(['error' => false, 'message' => 'Padang berjaya ditambah.', 'id' => $id]);
    }

    if ($method === 'PUT') {
        $input = getJsonInput();
        $id = (int) ($input['id'] ?? 0);
        $nama = trim($input['nama'] ?? '');
        if (!$id || !$nama) {
            jsonResponse(['error' => true, 'message' => 'ID dan nama diperlukan.'], 400);
        }
        $stmt = $pdo->prepare("UPDATE padang SET nama = :nama, alamat = :alamat WHERE id = :id");
        $stmt->execute([
            ':nama'   => $nama,
            ':alamat' => trim($input['alamat'] ?? ''),
            ':id'     => $id,
        ]);
        jsonResponse(['error' => false, 'message' => 'Padang berjaya dikemaskini.']);
    }

    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }
        $pdo->prepare("DELETE FROM padang WHERE id = :id")->execute([':id' => $id]);
        jsonResponse(['error' => false, 'message' => 'Padang berjaya dipadam.']);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    error_log('[padang.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
