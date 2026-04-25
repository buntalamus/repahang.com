<?php
/**
 * Kejohanan (Tournament) API
 * GET    /api/kejohanan.php              - list all
 * GET    /api/kejohanan.php?id=X         - single
 * POST   /api/kejohanan.php              - create
 * POST   /api/kejohanan.php?action=logo  - upload logo (multipart)
 * PUT    /api/kejohanan.php              - update
 * DELETE /api/kejohanan.php?id=X         - delete
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Admin']);

$VALID_STATUS = ['Draf', 'Aktif', 'Selesai', 'Dibatalkan'];
$VALID_JENIS = ['Karnival', 'Liga', 'Persahabatan'];
$VALID_PERINGKAT = ['Daerah', 'Negeri', 'Kebangsaan', 'Asia'];

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    /* ── Logo upload (multipart POST) ── */
    if ($method === 'POST' && ($_GET['action'] ?? '') === 'logo') {
        $id   = (int) ($_GET['id'] ?? 0);
        $side = ($_GET['side'] ?? '');  // "kiri" or "kanan"
        if (!$id || !in_array($side, ['kiri', 'kanan'], true)) {
            jsonResponse(['error' => true, 'message' => 'id dan side (kiri/kanan) diperlukan.'], 400);
        }

        if (empty($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
            jsonResponse(['error' => true, 'message' => 'Fail logo diperlukan.'], 400);
        }

        $file = $_FILES['logo'];
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        if (!in_array($mime, $allowed, true)) {
            jsonResponse(['error' => true, 'message' => 'Format fail tidak disokong.'], 400);
        }
        if ($file['size'] > 2 * 1024 * 1024) {
            jsonResponse(['error' => true, 'message' => 'Saiz fail melebihi 2MB.'], 400);
        }

        $ext = match ($mime) {
            'image/jpeg' => 'jpeg', 'image/png' => 'png', 'image/webp' => 'webp',
            'image/gif' => 'gif', 'image/svg+xml' => 'svg', default => 'png',
        };
        $dir = __DIR__ . '/../uploads/logos';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        $filename = "kejohanan_{$id}_{$side}_" . time() . ".{$ext}";
        $dest = $dir . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            jsonResponse(['error' => true, 'message' => 'Gagal menyimpan fail.'], 500);
        }

        $col = "logo_{$side}";
        $logoPath = '/uploads/logos/' . $filename;

        // Delete old file
        $oldStmt = $pdo->prepare("SELECT {$col} FROM kejohanan WHERE id = :id");
        $oldStmt->execute([':id' => $id]);
        $old = $oldStmt->fetchColumn();
        if ($old && file_exists(__DIR__ . '/..' . $old)) {
            @unlink(__DIR__ . '/..' . $old);
        }

        $pdo->prepare("UPDATE kejohanan SET {$col} = :path WHERE id = :id")
            ->execute([':path' => $logoPath, ':id' => $id]);

        jsonResponse(['error' => false, 'message' => 'Logo berjaya dimuat naik.', 'logo_path' => $logoPath]);
    }

    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $id = (int) $_GET['id'];
            $stmt = $pdo->prepare("
                SELECT k.*, u.nama_penuh AS created_by_nama,
                    (SELECT COUNT(*) FROM jadual_perlawanan jp WHERE jp.kejohanan_id = k.id) AS jumlah_perlawanan
                FROM kejohanan k
                LEFT JOIN users u ON k.created_by = u.id
                WHERE k.id = :id
            ");
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch();
            if (!$row) {
                jsonResponse(['error' => true, 'message' => 'Kejohanan tidak dijumpai.'], 404);
            }
            jsonResponse(['error' => false, 'kejohanan' => $row]);
        } else {
            $stmt = $pdo->query("
                SELECT k.*, u.nama_penuh AS created_by_nama,
                    (SELECT COUNT(*) FROM jadual_perlawanan jp WHERE jp.kejohanan_id = k.id) AS jumlah_perlawanan
                FROM kejohanan k
                LEFT JOIN users u ON k.created_by = u.id
                ORDER BY k.tarikh_mula DESC
            ");
            jsonResponse(['error' => false, 'data' => $stmt->fetchAll()]);
        }
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $nama = trim($input['nama'] ?? '');
        $tarikh_mula = trim($input['tarikh_mula'] ?? '');
        $tarikh_akhir = trim($input['tarikh_akhir'] ?? '');

        if (!$nama || !$tarikh_mula || !$tarikh_akhir) {
            jsonResponse(['error' => true, 'message' => 'Nama, tarikh mula dan tarikh akhir diperlukan.'], 400);
        }

        $status = $input['status'] ?? 'Draf';
        if (!in_array($status, $VALID_STATUS, true)) {
            jsonResponse(['error' => true, 'message' => 'Status tidak sah.'], 400);
        }

        $jenis = $input['jenis_kejohanan'] ?? 'Persahabatan';
        if (!in_array($jenis, $VALID_JENIS, true)) $jenis = 'Persahabatan';
        $peringkat = $input['peringkat_kejohanan'] ?? 'Daerah';
        if (!in_array($peringkat, $VALID_PERINGKAT, true)) $peringkat = 'Daerah';

        $stmt = $pdo->prepare("
            INSERT INTO kejohanan (nama, jenis_kejohanan, peringkat_kejohanan, tarikh_mula, tarikh_akhir, tempat, anjuran, status, created_by)
            VALUES (:nama, :jenis, :peringkat, :tarikh_mula, :tarikh_akhir, :tempat, :anjuran, :status, :created_by)
        ");
        $stmt->execute([
            ':nama'       => $nama,
            ':jenis'      => $jenis,
            ':peringkat'  => $peringkat,
            ':tarikh_mula'  => $tarikh_mula,
            ':tarikh_akhir' => $tarikh_akhir,
            ':tempat'     => trim($input['tempat'] ?? ''),
            ':anjuran'    => trim($input['anjuran'] ?? ''),
            ':status'     => $status,
            ':created_by' => (int) $currentUser['id'],
        ]);
        $id = (int) $pdo->lastInsertId();
        jsonResponse(['error' => false, 'message' => 'Kejohanan berjaya dicipta.', 'id' => $id]);
    }

    if ($method === 'PUT') {
        $input = getJsonInput();
        $id = (int) ($input['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }

        $status = $input['status'] ?? 'Draf';
        if (!in_array($status, $VALID_STATUS, true)) {
            jsonResponse(['error' => true, 'message' => 'Status tidak sah.'], 400);
        }

        $jenis = $input['jenis_kejohanan'] ?? 'Persahabatan';
        if (!in_array($jenis, $VALID_JENIS, true)) $jenis = 'Persahabatan';
        $peringkat = $input['peringkat_kejohanan'] ?? 'Daerah';
        if (!in_array($peringkat, $VALID_PERINGKAT, true)) $peringkat = 'Daerah';

        $stmt = $pdo->prepare("
            UPDATE kejohanan
            SET nama = :nama, jenis_kejohanan = :jenis, peringkat_kejohanan = :peringkat,
                tarikh_mula = :tarikh_mula, tarikh_akhir = :tarikh_akhir,
                tempat = :tempat, anjuran = :anjuran, status = :status
            WHERE id = :id
        ");
        $stmt->execute([
            ':nama'       => trim($input['nama'] ?? ''),
            ':jenis'      => $jenis,
            ':peringkat'  => $peringkat,
            ':tarikh_mula'  => trim($input['tarikh_mula'] ?? ''),
            ':tarikh_akhir' => trim($input['tarikh_akhir'] ?? ''),
            ':tempat'     => trim($input['tempat'] ?? ''),
            ':anjuran'    => trim($input['anjuran'] ?? ''),
            ':status'     => $status,
            ':id'         => $id,
        ]);
        jsonResponse(['error' => false, 'message' => 'Kejohanan berjaya dikemaskini.']);
    }

    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }

        // Prevent deleting kejohanan that still has matches
        $childStmt = $pdo->prepare("SELECT COUNT(*) FROM jadual_perlawanan WHERE kejohanan_id = :id");
        $childStmt->execute([':id' => $id]);
        if ((int) $childStmt->fetchColumn() > 0) {
            jsonResponse(['error' => true, 'message' => 'Tidak boleh memadam kejohanan yang masih mempunyai jadual perlawanan.'], 400);
        }

        // Also clean up pool_pengadil and pengesahan
        $pdo->prepare("DELETE FROM pool_pengadil WHERE kejohanan_id = :id")->execute([':id' => $id]);
        $pdo->prepare("DELETE FROM jadual_lantikan_pengesahan WHERE kejohanan_id = :id")->execute([':id' => $id]);

        $pdo->prepare("DELETE FROM kejohanan WHERE id = :id")->execute([':id' => $id]);
        jsonResponse(['error' => false, 'message' => 'Kejohanan berjaya dipadam.']);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    error_log('[kejohanan.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
