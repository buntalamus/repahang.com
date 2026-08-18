<?php
/**
 * Jadual Perlawanan API
 * GET    /api/jadual-perlawanan.php?kejohanan_id=X   - list by tournament
 * GET    /api/jadual-perlawanan.php?id=X             - single match
 * POST   /api/jadual-perlawanan.php                  - create
 * POST   /api/jadual-perlawanan.php?action=logo      - upload logo (multipart)
 * PUT    /api/jadual-perlawanan.php                  - update
 * DELETE /api/jadual-perlawanan.php?id=X             - delete
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/lantikan-helper.php';
require_once __DIR__ . '/../config/pasukan-logo-helper.php';

$currentUser = requireRole(['Admin']);

$JAWATAN_LIST = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4', 'Penilai Pengadil'];

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    /* ── Logo upload (multipart POST) ── */
    if ($method === 'POST' && ($_GET['action'] ?? '') === 'logo') {
        $id   = (int) ($_GET['id'] ?? 0);
        $side = ($_GET['side'] ?? '');  // "home" or "away"
        if (!$id || !in_array($side, ['home', 'away'], true)) {
            jsonResponse(['error' => true, 'message' => 'id dan side (home/away) diperlukan.'], 400);
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

        $col = $side === 'home' ? 'logo_home' : 'logo_away';
        $namaCol = $side === 'home' ? 'pasukan_home' : 'pasukan_away';

        // Dapatkan nama pasukan & logo lama untuk perlawanan ini
        $rowStmt = $pdo->prepare("SELECT {$namaCol} AS nama, {$col} AS logo_lama FROM jadual_perlawanan WHERE id = :id");
        $rowStmt->execute([':id' => $id]);
        $row = $rowStmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai.'], 404);
        }
        $namaPasukan = trim((string) ($row['nama'] ?? ''));
        $logoLama    = (string) ($row['logo_lama'] ?? '');

        $ext = match ($mime) {
            'image/jpeg' => 'jpeg', 'image/png' => 'png', 'image/webp' => 'webp',
            'image/gif' => 'gif', 'image/svg+xml' => 'svg', default => 'png',
        };
        $dir = __DIR__ . '/../uploads/logos';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        $slug = $namaPasukan !== ''
            ? substr(preg_replace('/[^a-z0-9]+/', '-', strtolower($namaPasukan)), 0, 60)
            : "jadual_{$id}_{$side}";
        $filename = "pasukan_{$slug}_" . time() . ".{$ext}";
        $dest = $dir . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            jsonResponse(['error' => true, 'message' => 'Gagal menyimpan fail.'], 500);
        }

        $logoPath = '/uploads/logos/' . $filename;

        if ($namaPasukan !== '') {
            // Simpan dalam registri + padankan ke SEMUA perlawanan pasukan sama
            $count = simpanDanPadanLogoPasukan($pdo, $namaPasukan, $logoPath);
            $message = "Logo {$namaPasukan} dipadankan ke {$count} perlawanan.";
        } else {
            // Tiada nama pasukan — kemaskini perlawanan ini sahaja
            $pdo->prepare("UPDATE jadual_perlawanan SET {$col} = :path WHERE id = :id")
                ->execute([':path' => $logoPath, ':id' => $id]);
            $message = 'Logo berjaya dimuat naik.';
        }

        // Padam fail lama hanya jika tiada lagi rujukan (perlawanan lain / registri)
        if ($logoLama && $logoLama !== $logoPath) {
            $refStmt = $pdo->prepare("
                SELECT (SELECT COUNT(*) FROM jadual_perlawanan WHERE logo_home = :p1 OR logo_away = :p2)
                     + (SELECT COUNT(*) FROM pasukan_logo WHERE logo_path = :p3)
            ");
            $refStmt->execute([':p1' => $logoLama, ':p2' => $logoLama, ':p3' => $logoLama]);
            if ((int) $refStmt->fetchColumn() === 0 && file_exists(__DIR__ . '/..' . $logoLama)) {
                @unlink(__DIR__ . '/..' . $logoLama);
            }
        }

        jsonResponse(['error' => false, 'message' => $message, 'logo_path' => $logoPath]);
    }

    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $id = (int) $_GET['id'];

            // Auto-tolak lantikan yang tempoh jawapannya sudah tamat
            autoTolakLantikanTertunggak($pdo, ['jadual_id' => $id]);

            $stmt = $pdo->prepare("
                SELECT jp.*,
                    k.nama AS nama_kejohanan
                FROM jadual_perlawanan jp
                JOIN kejohanan k ON jp.kejohanan_id = k.id
                WHERE jp.id = :id
            ");
            $stmt->execute([':id' => $id]);
            $match = $stmt->fetch();
            if (!$match) {
                jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai.'], 404);
            }
            $match['is_started'] = hasMatchStarted((string) $match['tarikh'], (string) $match['masa']);

            // Get assignments for this match (both registered and luar)
            $assignStmt = $pdo->prepare("
                SELECT lp.id, lp.jawatan, lp.status, lp.komen, lp.tarikh_jawab, lp.notif_hantar,
                    lp.pengadil_id, lp.pengadil_luar_id,
                    COALESCE(u.nama_penuh, pl.nama) AS nama_penuh,
                    COALESCE(u.no_telefon, pl.no_tel) AS no_telefon,
                    COALESCE(u.email, pl.emel) AS email,
                    u.url_gambar_profil
                FROM lantikan_pengadil lp
                LEFT JOIN users u ON lp.pengadil_id = u.id
                LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
                WHERE lp.jadual_id = :jadual_id
                ORDER BY FIELD(lp.jawatan, 'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4','Penilai Pengadil')
            ");
            $assignStmt->execute([':jadual_id' => $id]);
            $match['lantikan'] = $assignStmt->fetchAll();

            jsonResponse(['error' => false, 'perlawanan' => $match]);
        } elseif (isset($_GET['kejohanan_id'])) {
            $kid = (int) $_GET['kejohanan_id'];

            // Auto-tolak supaya kiraan jumlah_terima sentiasa tepat
            autoTolakLantikanTertunggak($pdo, ['kejohanan_id' => $kid]);

            $stmt = $pdo->prepare("
                SELECT jp.*,
                    (SELECT COUNT(*) FROM lantikan_pengadil lp
                     WHERE lp.jadual_id = jp.id AND lp.status IN ('Belum Jawab', 'Diterima')) AS jumlah_lantikan,
                    (SELECT COUNT(*) FROM lantikan_pengadil lp WHERE lp.jadual_id = jp.id AND lp.status = 'Diterima') AS jumlah_terima
                FROM jadual_perlawanan jp
                WHERE jp.kejohanan_id = :kid
                ORDER BY jp.kategori ASC, jp.tarikh ASC, jp.masa ASC,
                         CAST(SUBSTRING_INDEX(jp.no_perlawanan, '-', -1) AS UNSIGNED) ASC,
                         jp.no_perlawanan ASC
            ");
            $stmt->execute([':kid' => $kid]);
            $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($matches as &$match) {
                $match['is_started'] = hasMatchStarted((string) $match['tarikh'], (string) $match['masa']);
            }
            unset($match);
            jsonResponse(['error' => false, 'data' => $matches]);
        } else {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
        }
    }

    if ($method === 'POST' && ($_GET['action'] ?? '') === 'bulk_delete') {
        $input = getJsonInput();
        $ids = $input['ids'] ?? [];
        if (!is_array($ids) || empty($ids)) {
            jsonResponse(['error' => true, 'message' => 'Senarai ID diperlukan.'], 400);
        }
        $ids = array_map('intval', $ids);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        // Check for any with existing lantikan
        $checkStmt = $pdo->prepare("SELECT jp.id, jp.no_perlawanan FROM jadual_perlawanan jp WHERE jp.id IN ($placeholders) AND (SELECT COUNT(*) FROM lantikan_pengadil lp WHERE lp.jadual_id = jp.id) > 0");
        $checkStmt->execute($ids);
        $blocked = $checkStmt->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($blocked)) {
            $nos = implode(', ', array_column($blocked, 'no_perlawanan'));
            jsonResponse(['error' => true, 'message' => "Perlawanan berikut masih mempunyai lantikan: $nos. Sila batalkan lantikan terlebih dahulu."], 400);
        }

        $delStmt = $pdo->prepare("DELETE FROM jadual_perlawanan WHERE id IN ($placeholders)");
        $delStmt->execute($ids);
        $count = $delStmt->rowCount();
        jsonResponse(['error' => false, 'message' => "$count perlawanan berjaya dipadam."]);
    }

    /* ── Renumber no_perlawanan per kategori (ikut masa) ── */
    if ($method === 'POST' && ($_GET['action'] ?? '') === 'renumber') {
        $input = getJsonInput();
        $kejohanan_id = (int) ($input['kejohanan_id'] ?? 0);
        if (!$kejohanan_id) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
        }
        $count = renumberNoPerlawanan($pdo, $kejohanan_id);
        jsonResponse(['error' => false, 'message' => "$count perlawanan dinomborkan semula ikut kategori & masa."]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $kejohanan_id = (int) ($input['kejohanan_id'] ?? 0);
        $tarikh       = trim($input['tarikh'] ?? '');
        $masa         = trim($input['masa'] ?? '');

        if (!$kejohanan_id || !$tarikh || !$masa) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id, tarikh dan masa diperlukan.'], 400);
        }

        // Auto set hari from tarikh
        $hariList = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
        $hari = $hariList[(int) date('w', strtotime($tarikh))];

        // Auto generate no_perlawanan (per kategori, berprefiks: cth B12-01) if not provided
        $no_perlawanan = trim($input['no_perlawanan'] ?? '');
        if (!$no_perlawanan) {
            $no_perlawanan = nextNoPerlawanan($pdo, $kejohanan_id, trim($input['kategori'] ?? ''));
        }

        $stmt = $pdo->prepare("
            INSERT INTO jadual_perlawanan (kejohanan_id, no_perlawanan, tarikh, masa, hari, kategori, peringkat, kumpulan, pasukan_home, pasukan_away, tempat)
            VALUES (:kejohanan_id, :no_perlawanan, :tarikh, :masa, :hari, :kategori, :peringkat, :kumpulan, :pasukan_home, :pasukan_away, :tempat)
        ");
        $stmt->execute([
            ':kejohanan_id'   => $kejohanan_id,
            ':no_perlawanan'  => $no_perlawanan,
            ':tarikh'         => $tarikh,
            ':masa'           => $masa,
            ':hari'           => $hari,
            ':kategori'       => trim($input['kategori'] ?? ''),
            ':peringkat'      => trim($input['peringkat'] ?? ''),
            ':kumpulan'       => trim($input['kumpulan'] ?? ''),
            ':pasukan_home'   => trim($input['pasukan_home'] ?? ''),
            ':pasukan_away'   => trim($input['pasukan_away'] ?? ''),
            ':tempat'         => trim($input['tempat'] ?? ''),
        ]);
        $id = (int) $pdo->lastInsertId();

        // Auto-isi logo dari registri pasukan (ikut nama)
        isiLogoDariRegistri($pdo, null, $id);

        jsonResponse(['error' => false, 'message' => 'Perlawanan berjaya ditambah.', 'id' => $id, 'no_perlawanan' => $no_perlawanan]);
    }

    if ($method === 'PUT') {
        $input = getJsonInput();
        $id = (int) ($input['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }

        $tarikh = trim($input['tarikh'] ?? '');
        $hariList = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
        $hari = $tarikh ? $hariList[(int) date('w', strtotime($tarikh))] : trim($input['hari'] ?? '');

        $pdo->beginTransaction();
        try {
            lockMatchForAppointmentResponse($pdo, $id);

            $reportStmt = $pdo->prepare("SELECT id FROM laporan_penilaian WHERE jadual_id = :jid LIMIT 1 FOR UPDATE");
            $reportStmt->execute([':jid' => $id]);
            if ($reportStmt->fetchColumn()) {
                $pdo->rollBack();
                jsonResponse([
                    'error' => true,
                    'message' => 'Perlawanan tidak boleh diubah kerana laporan RA telah diwujudkan.',
                ], 409);
            }

            $stmt = $pdo->prepare("
                UPDATE jadual_perlawanan
                SET no_perlawanan = :no_perlawanan, tarikh = :tarikh, masa = :masa, hari = :hari,
                    kategori = :kategori, peringkat = :peringkat, kumpulan = :kumpulan,
                    pasukan_home = :pasukan_home, pasukan_away = :pasukan_away, tempat = :tempat
                WHERE id = :id
            ");
            $stmt->execute([
                ':no_perlawanan'  => trim($input['no_perlawanan'] ?? ''),
                ':tarikh'         => $tarikh,
                ':masa'           => trim($input['masa'] ?? ''),
                ':hari'           => $hari,
                ':kategori'       => trim($input['kategori'] ?? ''),
                ':peringkat'      => trim($input['peringkat'] ?? ''),
                ':kumpulan'       => trim($input['kumpulan'] ?? ''),
                ':pasukan_home'   => trim($input['pasukan_home'] ?? ''),
                ':pasukan_away'   => trim($input['pasukan_away'] ?? ''),
                ':tempat'         => trim($input['tempat'] ?? ''),
                ':id'             => $id,
            ]);

            syncPerlawananHistoryForJadual($pdo, $id);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        // Auto-isi logo dari registri jika nama pasukan berubah
        isiLogoDariRegistri($pdo, null, $id);

        jsonResponse(['error' => false, 'message' => 'Perlawanan berjaya dikemaskini.']);
    }

    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }

        // Prevent deleting match that still has assignments
        $childStmt = $pdo->prepare("SELECT COUNT(*) FROM lantikan_pengadil WHERE jadual_id = :id");
        $childStmt->execute([':id' => $id]);
        if ((int) $childStmt->fetchColumn() > 0) {
            jsonResponse(['error' => true, 'message' => 'Tidak boleh memadam perlawanan yang masih mempunyai lantikan pengadil. Sila batalkan lantikan terlebih dahulu.'], 400);
        }

        $pdo->prepare("DELETE FROM jadual_perlawanan WHERE id = :id")->execute([':id' => $id]);
        jsonResponse(['error' => false, 'message' => 'Perlawanan berjaya dipadam.']);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    error_log('[jadual-perlawanan.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
