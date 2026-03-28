<?php
/**
 * Pasukan (Team) API
 * GET    ?kejohanan_id=X         - list teams for tournament
 * GET    ?id=X                   - single team
 * POST   JSON                    - create team
 * PUT    JSON {id,...}           - update team
 * POST   ?action=logo&id=X      - upload logo (multipart)
 * DELETE ?id=X                  - delete team
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Admin']);

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // ── Logo upload (separate multipart POST action) ──────────────────────────
    if ($method === 'POST' && ($_GET['action'] ?? '') === 'logo') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID pasukan diperlukan.'], 400);
        }

        // Verify team exists
        $stmt = $pdo->prepare("SELECT id, logo_path FROM pasukan WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $pasukan = $stmt->fetch();
        if (!$pasukan) {
            jsonResponse(['error' => true, 'message' => 'Pasukan tidak dijumpai.'], 404);
        }

        if (!isset($_FILES['logo']) || $_FILES['logo']['error'] === UPLOAD_ERR_NO_FILE) {
            jsonResponse(['error' => true, 'message' => 'Tiada fail logo dimuat naik.'], 422);
        }

        $file = $_FILES['logo'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            jsonResponse(['error' => true, 'message' => 'Ralat muat naik fail.'], 400);
        }

        // Validate type
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime  = $finfo->file($file['tmp_name']);
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (!in_array($mime, $allowed, true)) {
            jsonResponse(['error' => true, 'message' => 'Format fail tidak disokong. Gunakan JPG, PNG, WEBP atau SVG.'], 422);
        }

        // Validate size (2 MB)
        if ($file['size'] > 2 * 1024 * 1024) {
            jsonResponse(['error' => true, 'message' => 'Saiz fail melebihi had 2MB.'], 422);
        }

        $ext      = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'png';
        $filename = 'logo_' . $id . '_' . time() . '.' . strtolower($ext);
        $dir      = __DIR__ . '/../uploads/logos';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $targetPath = $dir . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            throw new RuntimeException('Gagal menyimpan fail logo.');
        }
        chmod($targetPath, 0644);

        // Delete old logo if exists
        if ($pasukan['logo_path']) {
            $old = __DIR__ . '/..' . $pasukan['logo_path'];
            if (file_exists($old)) {
                @unlink($old);
            }
        }

        $logoUrl = '/uploads/logos/' . $filename;
        $pdo->prepare("UPDATE pasukan SET logo_path = :lp WHERE id = :id")
            ->execute([':lp' => $logoUrl, ':id' => $id]);

        jsonResponse(['error' => false, 'message' => 'Logo berjaya dimuat naik.', 'logo_path' => $logoUrl]);
    }

    // ── GET ───────────────────────────────────────────────────────────────────
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM pasukan WHERE id = :id");
            $stmt->execute([':id' => (int) $_GET['id']]);
            $row = $stmt->fetch();
            if (!$row) {
                jsonResponse(['error' => true, 'message' => 'Pasukan tidak dijumpai.'], 404);
            }
            jsonResponse(['error' => false, 'pasukan' => $row]);
        }

        $kejohanan_id = (int) ($_GET['kejohanan_id'] ?? 0);
        if (!$kejohanan_id) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
        }
        $stmt = $pdo->prepare("
            SELECT * FROM pasukan
            WHERE kejohanan_id = :kid
            ORDER BY kumpulan ASC, nama ASC
        ");
        $stmt->execute([':kid' => $kejohanan_id]);
        jsonResponse(['error' => false, 'data' => $stmt->fetchAll()]);
    }

    // ── POST (create) ─────────────────────────────────────────────────────────
    if ($method === 'POST') {
        $input = getJsonInput();
        $kejohanan_id = (int) ($input['kejohanan_id'] ?? 0);
        $nama = trim($input['nama'] ?? '');
        if (!$kejohanan_id || !$nama) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id dan nama diperlukan.'], 400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO pasukan (kejohanan_id, nama, kod, kumpulan)
            VALUES (:kid, :nama, :kod, :kumpulan)
        ");
        $stmt->execute([
            ':kid'      => $kejohanan_id,
            ':nama'     => $nama,
            ':kod'      => trim($input['kod'] ?? '') ?: null,
            ':kumpulan' => trim($input['kumpulan'] ?? '') ?: null,
        ]);
        $id = (int) $pdo->lastInsertId();

        $newRow = $pdo->prepare("SELECT * FROM pasukan WHERE id = :id");
        $newRow->execute([':id' => $id]);

        jsonResponse(['error' => false, 'message' => 'Pasukan berjaya didaftarkan.', 'pasukan' => $newRow->fetch()]);
    }

    // ── PUT (update) ──────────────────────────────────────────────────────────
    if ($method === 'PUT') {
        $input = getJsonInput();
        $id = (int) ($input['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }
        $nama = trim($input['nama'] ?? '');
        if (!$nama) {
            jsonResponse(['error' => true, 'message' => 'Nama pasukan diperlukan.'], 400);
        }

        $stmt = $pdo->prepare("
            UPDATE pasukan
            SET nama = :nama, kod = :kod, kumpulan = :kumpulan
            WHERE id = :id
        ");
        $stmt->execute([
            ':nama'     => $nama,
            ':kod'      => trim($input['kod'] ?? '') ?: null,
            ':kumpulan' => trim($input['kumpulan'] ?? '') ?: null,
            ':id'       => $id,
        ]);

        jsonResponse(['error' => false, 'message' => 'Pasukan berjaya dikemaskini.']);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }

        // Get logo path before deleting
        $stmt = $pdo->prepare("SELECT logo_path FROM pasukan WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();

        if ($row && $row['logo_path']) {
            $old = __DIR__ . '/..' . $row['logo_path'];
            if (file_exists($old)) {
                @unlink($old);
            }
        }

        $pdo->prepare("DELETE FROM pasukan WHERE id = :id")->execute([':id' => $id]);
        jsonResponse(['error' => false, 'message' => 'Pasukan berjaya dipadam.']);
    }

} catch (Throwable $e) {
    error_log('[pasukan.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
