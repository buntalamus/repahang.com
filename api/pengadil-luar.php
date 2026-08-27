<?php
/**
 * Pengadil Luar (External/Unregistered Referees) API
 * GET    /api/pengadil-luar.php           - list all (with optional search)
 * GET    /api/pengadil-luar.php?id=X      - single
 * POST   /api/pengadil-luar.php           - create
 * PUT    /api/pengadil-luar.php           - update
 * DELETE /api/pengadil-luar.php?id=X      - delete
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/pengadil-luar-helper.php';

$currentUser = requireRole(['Admin']);

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM pengadil_luar WHERE id = :id");
            $stmt->execute([':id' => (int) $_GET['id']]);
            $row = $stmt->fetch();
            if (!$row) {
                jsonResponse(['error' => true, 'message' => 'Tidak dijumpai.'], 404);
            }
            jsonResponse(['error' => false, 'pengadil' => $row]);
        }

        // List all with optional search
        $search = trim($_GET['search'] ?? '');
        $daerah = trim($_GET['daerah'] ?? '');
        $negeri = trim($_GET['negeri'] ?? '');

        $sql = "SELECT * FROM pengadil_luar WHERE 1=1";
        $params = [];

        if ($search) {
            $sql .= " AND (nama LIKE :s OR daerah LIKE :s2 OR negeri LIKE :s3 OR emel LIKE :s4 OR no_tel LIKE :s5)";
            $params[':s'] = "%$search%";
            $params[':s2'] = "%$search%";
            $params[':s3'] = "%$search%";
            $params[':s4'] = "%$search%";
            $params[':s5'] = "%$search%";
        }
        if ($daerah) {
            $sql .= " AND daerah = :daerah";
            $params[':daerah'] = $daerah;
        }
        if ($negeri) {
            $sql .= " AND negeri = :negeri";
            $params[':negeri'] = $negeri;
        }

        $sql .= " ORDER BY nama ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse(['error' => false, 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $nama = trim($input['nama'] ?? '');
        $daerah = trim($input['daerah'] ?? '');
        $negeriInput = trim($input['negeri'] ?? '');
        $negeri = normalizePengadilLuarNegeri($negeriInput);
        $jenis = normalizePengadilLuarJenis((string) ($input['jenis_pengadil'] ?? ''));
        $emel = trim($input['emel'] ?? '');

        if ($nama === '' || $daerah === '' || $negeriInput === '') {
            jsonResponse(['error' => true, 'message' => 'Nama, daerah dan negeri diperlukan.'], 400);
        }
        if ($negeri === null) {
            jsonResponse(['error' => true, 'message' => 'Negeri tidak sah.'], 400);
        }
        if ($jenis === null) {
            jsonResponse(['error' => true, 'message' => 'Jenis pengadil tidak sah.'], 400);
        }
        if ($emel !== '' && !filter_var($emel, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => true, 'message' => 'Format emel tidak sah.'], 400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO pengadil_luar (nama, daerah, negeri, no_tel, emel, jenis_pengadil)
            VALUES (:nama, :daerah, :negeri, :no_tel, :emel, :jenis)
        ");
        $stmt->execute([
            ':nama'   => $nama,
            ':daerah' => $daerah,
            ':negeri' => $negeri,
            ':no_tel' => trim($input['no_tel'] ?? ''),
            ':emel'   => $emel,
            ':jenis'  => $jenis,
        ]);
        jsonResponse(['error' => false, 'message' => 'Pengadil luar berjaya ditambah.', 'id' => (int) $pdo->lastInsertId()]);
    }

    if ($method === 'PUT') {
        $input = getJsonInput();
        $id = (int) ($input['id'] ?? 0);
        $nama = trim($input['nama'] ?? '');
        $daerah = trim($input['daerah'] ?? '');
        $negeriInput = trim($input['negeri'] ?? '');
        $negeri = normalizePengadilLuarNegeri($negeriInput);
        $jenis = normalizePengadilLuarJenis((string) ($input['jenis_pengadil'] ?? ''));
        $emel = trim($input['emel'] ?? '');

        if (!$id || $nama === '' || $daerah === '' || $negeriInput === '') {
            jsonResponse(['error' => true, 'message' => 'ID, nama, daerah dan negeri diperlukan.'], 400);
        }
        if ($negeri === null) {
            jsonResponse(['error' => true, 'message' => 'Negeri tidak sah.'], 400);
        }
        if ($jenis === null) {
            jsonResponse(['error' => true, 'message' => 'Jenis pengadil tidak sah.'], 400);
        }
        if ($emel !== '' && !filter_var($emel, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => true, 'message' => 'Format emel tidak sah.'], 400);
        }

        $stmt = $pdo->prepare("
            UPDATE pengadil_luar
            SET nama = :nama, daerah = :daerah, negeri = :negeri,
                no_tel = :no_tel, emel = :emel, jenis_pengadil = :jenis
            WHERE id = :id
        ");
        $stmt->execute([
            ':nama'   => $nama,
            ':daerah' => $daerah,
            ':negeri' => $negeri,
            ':no_tel' => trim($input['no_tel'] ?? ''),
            ':emel'   => $emel,
            ':jenis'  => $jenis,
            ':id'     => $id,
        ]);
        jsonResponse(['error' => false, 'message' => 'Pengadil luar berjaya dikemaskini.']);
    }

    if ($method === 'DELETE') {
        // Bulk delete: ?ids=1,2,3
        if (!empty($_GET['ids'])) {
            $rawIds = explode(',', $_GET['ids']);
            $ids = array_filter(array_map('intval', $rawIds), fn($v) => $v > 0);
            if (empty($ids)) {
                jsonResponse(['error' => true, 'message' => 'ID tidak sah.'], 400);
            }
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $usageStmt = $pdo->prepare("
                SELECT pl.id, pl.nama, COUNT(lp.id) AS jumlah_lantikan
                FROM pengadil_luar pl
                JOIN lantikan_pengadil lp ON lp.pengadil_luar_id = pl.id
                WHERE pl.id IN ($placeholders)
                GROUP BY pl.id, pl.nama
            ");
            $usageStmt->execute(array_values($ids));
            $used = $usageStmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($used)) {
                $names = array_map(
                    static fn(array $row): string => $row['nama'] . ' (' . $row['jumlah_lantikan'] . ' lantikan)',
                    $used
                );
                jsonResponse([
                    'error' => true,
                    'message' => 'Tidak boleh dipadam kerana mempunyai rekod lantikan: ' . implode(', ', $names) . '.',
                ], 409);
            }
            // Remove from pools first
            $pdo->prepare("DELETE FROM pool_pengadil WHERE pengadil_luar_id IN ($placeholders)")->execute(array_values($ids));
            $stmt = $pdo->prepare("DELETE FROM pengadil_luar WHERE id IN ($placeholders)");
            $stmt->execute(array_values($ids));
            $count = $stmt->rowCount();
            jsonResponse(['error' => false, 'message' => "$count pengadil luar berjaya dipadam."]);
        }

        // Single delete: ?id=1
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }
        $usageStmt = $pdo->prepare('SELECT COUNT(*) FROM lantikan_pengadil WHERE pengadil_luar_id = :id');
        $usageStmt->execute([':id' => $id]);
        $usageCount = (int) $usageStmt->fetchColumn();
        if ($usageCount > 0) {
            jsonResponse([
                'error' => true,
                'message' => "Pengadil luar tidak boleh dipadam kerana mempunyai {$usageCount} rekod lantikan. Buang atau batalkan lantikan melalui modul lantikan terlebih dahulu.",
            ], 409);
        }
        $pdo->prepare("DELETE FROM pengadil_luar WHERE id = :id")->execute([':id' => $id]);
        jsonResponse(['error' => false, 'message' => 'Pengadil luar berjaya dipadam.']);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    error_log('[pengadil-luar.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
