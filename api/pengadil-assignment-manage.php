<?php
/**
 * Pengadil Assignment Management API
 * Handle accept/reject actions for assignments
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

// Require Pengadil role
$currentUser = requireRole(['Pengadil']);

try {
    $pdo = getDbConnection();
    $userId = (int) $currentUser['id'];

    // Get action from POST data
    $action = $_POST['action'] ?? '';
    $assignmentId = (int) ($_POST['assignment_id'] ?? 0);
    $comment = trim($_POST['comment'] ?? '');

    if (!$assignmentId) {
        jsonResponse(['error' => true, 'message' => 'ID tugasan diperlukan.'], 400);
    }

    // Verify assignment belongs to current user
    $verifyStmt = $pdo->prepare("
        SELECT pp.id, pp.status_pengadil, p.tarikh, p.jenis, p.tempat
        FROM perlawanan_pengadil pp
        JOIN perlawanan p ON pp.perlawanan_id = p.id
        WHERE pp.id = :assignment_id AND pp.pengadil_id = :pengadil_id
    ");

    $verifyStmt->execute([
        ':assignment_id' => $assignmentId,
        ':pengadil_id' => $userId
    ]);

    $assignment = $verifyStmt->fetch();

    if (!$assignment) {
        jsonResponse(['error' => true, 'message' => 'Tugasan tidak dijumpai atau tidak dibenarkan.'], 404);
    }

    // Check if assignment is already responded to
    if ($assignment['status_pengadil'] !== 'Belum Jawab') {
        jsonResponse(['error' => true, 'message' => 'Tugasan ini sudah dijawab sebelumnya.'], 400);
    }

    // Handle different actions
    switch ($action) {
        case 'accept':
            $updateStmt = $pdo->prepare("
                UPDATE perlawanan_pengadil
                SET status_pengadil = 'Diterima',
                    komen_pengadil = :comment,
                    tarikh_jawab = NOW()
                WHERE id = :assignment_id
            ");

            $updateStmt->execute([
                ':assignment_id' => $assignmentId,
                ':comment' => $comment
            ]);

            jsonResponse([
                'error' => false,
                'message' => 'Tugasan berjaya diterima.',
                'action' => 'accepted'
            ]);
            break;

        case 'reject':
            if (empty($comment)) {
                jsonResponse(['error' => true, 'message' => 'Sila berikan sebab penolakan.'], 400);
            }

            $updateStmt = $pdo->prepare("
                UPDATE perlawanan_pengadil
                SET status_pengadil = 'Ditolak',
                    komen_pengadil = :comment,
                    tarikh_jawab = NOW()
                WHERE id = :assignment_id
            ");

            $updateStmt->execute([
                ':assignment_id' => $assignmentId,
                ':comment' => $comment
            ]);

            jsonResponse([
                'error' => false,
                'message' => 'Tugasan berjaya ditolak.',
                'action' => 'rejected'
            ]);
            break;

        default:
            jsonResponse(['error' => true, 'message' => 'Tindakan tidak sah.'], 400);
    }

} catch (Throwable $e) {
    error_log('[pengadil-assignment-manage.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());
    error_log('[pengadil-assignment-manage.php] Stack trace: ' . $e->getTraceAsString());
    $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to process assignment action.';
    jsonResponse(['error' => true, 'message' => $message], 500);
}