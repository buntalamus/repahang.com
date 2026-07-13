<?php
/**
 * Lantikan Jawab API (Pengadil accept/reject assignment)
 * POST /api/lantikan-jawab.php
 *   action: accept | reject
 *   lantikan_id: int
 *   komen: string (required for reject)
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Pengadil', 'Penilai', 'PP Daerah']);

try {
    $pdo = getDbConnection();
    $input = getJsonInput();

    $action      = trim($input['action'] ?? '');
    $lantikan_id = (int) ($input['lantikan_id'] ?? 0);
    $komen       = trim($input['komen'] ?? '');

    if (!$lantikan_id || !in_array($action, ['accept', 'reject'], true)) {
        jsonResponse(['error' => true, 'message' => 'lantikan_id dan action (accept/reject) diperlukan.'], 400);
    }
    if ($action === 'reject' && empty($komen)) {
        jsonResponse(['error' => true, 'message' => 'Sila berikan sebab penolakan.'], 400);
    }

    // Kuatkuasa tempoh jawapan — auto-tolak jika sudah tamat
    require_once __DIR__ . '/../config/lantikan-helper.php';
    if (autoTolakLantikanTertunggak($pdo, ['id' => $lantikan_id]) > 0) {
        jsonResponse(['error' => true, 'message' => 'Tempoh menjawab telah tamat. Lantikan ini telah ditolak secara automatik.'], 400);
    }

    // Verify this assignment belongs to current user
    $stmt = $pdo->prepare("
        SELECT lp.id, lp.status, lp.komen,
               lp.jawatan,
               jp.tarikh, jp.masa, jp.tempat, jp.pasukan_home, jp.pasukan_away, jp.no_perlawanan,
               COALESCE(kj.nama, '') AS kejohanan
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
        WHERE lp.id = :id AND lp.pengadil_id = :uid
    ");
    $stmt->execute([':id' => $lantikan_id, ':uid' => (int) $currentUser['id']]);
    $assignment = $stmt->fetch();

    if (!$assignment) {
        jsonResponse(['error' => true, 'message' => 'Lantikan tidak dijumpai atau bukan milik anda.'], 404);
    }
    if ($assignment['status'] !== 'Belum Jawab') {
        $msg = ($assignment['status'] === 'Ditolak' && ($assignment['komen'] ?? '') === LANTIKAN_AUTO_TOLAK_KOMEN)
            ? 'Tempoh menjawab telah tamat. Lantikan ini telah ditolak secara automatik.'
            : 'Lantikan ini sudah dijawab.';
        jsonResponse(['error' => true, 'message' => $msg], 400);
    }

    $newStatus = $action === 'accept' ? 'Diterima' : 'Ditolak';

    // Wrap in transaction for atomicity (status update + perlawanan creation)
    $pdo->beginTransaction();
    try {
        // Atomic update — only succeeds if status is still 'Belum Jawab' (prevents race)
        $updStmt = $pdo->prepare("
            UPDATE lantikan_pengadil SET status = :status, komen = :komen, tarikh_jawab = NOW()
            WHERE id = :id AND status = 'Belum Jawab'
        ");
        $updStmt->execute([':status' => $newStatus, ':komen' => $komen, ':id' => $lantikan_id]);

        if ($updStmt->rowCount() === 0) {
            $pdo->rollBack();
            jsonResponse(['error' => true, 'message' => 'Lantikan ini sudah dijawab.'], 400);
        }

        // Create perlawanan record if accepted; generate penilaian token for RA
        if ($newStatus === 'Diterima') {
            createPerlawananFromLantikan($pdo, $lantikan_id);
            generatePenilaianToken($pdo, $lantikan_id);
        }

        $pdo->commit();
    } catch (Throwable $txErr) {
        $pdo->rollBack();
        throw $txErr;
    }

    // ── Portal notification for the pengadil ──────────────────────────
    $statusLabel = $action === 'accept' ? 'diterima' : 'ditolak';
    createPortalNotification($pdo, (int) $currentUser['id'], 'Lantikan ' . ucfirst($statusLabel),
        "Lantikan {$assignment['pasukan_home']} lwn {$assignment['pasukan_away']}",
        "Anda telah {$statusLabel} lantikan sebagai {$assignment['jawatan']} untuk {$assignment['pasukan_home']} lwn {$assignment['pasukan_away']} ({$assignment['kejohanan']})."
    );

    // ── Notify admin(s) ───────────────────────────────────────────────
    notifyAdminLantikanResponse($pdo, $action, $currentUser['nama_penuh'],
        $assignment['jawatan'], $assignment['kejohanan'], $assignment['tarikh'],
        $assignment['pasukan_home'], $assignment['pasukan_away'], $komen);

    // ── Notify PP Daerah ──────────────────────────────────────────────
    $persatuanId = (int)($currentUser['persatuan_id'] ?? 0);
    if ($persatuanId) {
        notifyPPDaerahResponse($pdo, $action, $persatuanId, $currentUser['nama_penuh'],
            $assignment['jawatan'], $assignment['kejohanan'], $assignment['tarikh'],
            $assignment['pasukan_home'], $assignment['pasukan_away'], $komen);
    }

    $msg = $action === 'accept' ? 'Tugasan berjaya diterima. Sila bawa kelengkapan penuh pengadil.' : 'Tugasan berjaya ditolak.';
    jsonResponse(['error' => false, 'message' => $msg, 'status' => $newStatus]);

} catch (Throwable $e) {
    error_log('[lantikan-jawab.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
