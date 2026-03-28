<?php
/**
 * Pengadil Assignments API
 * Get assignments for logged-in pengadil
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

// Require Pengadil role
$currentUser = requireRole(['Pengadil']);

try {
    $pdo = getDbConnection();
    $userId = (int) $currentUser['id'];

    // Get assignments for this pengadil
    $assignmentsStmt = $pdo->prepare("
        SELECT
            pp.id,
            pp.perlawanan_id,
            pp.pengadil_id,
            pp.status_pp,
            pp.status_pengadil,
            pp.komen_pengadil,
            pp.tarikh_jawab,
            pp.created_at,
            p.tarikh,
            p.jenis,
            p.tempat,
            p.jawatan,
            p.user_id as created_by_user_id
        FROM perlawanan_pengadil pp
        JOIN perlawanan p ON pp.perlawanan_id = p.id
        WHERE pp.pengadil_id = :pengadil_id
        ORDER BY p.tarikh DESC, pp.created_at DESC
    ");

    $assignmentsStmt->execute([':pengadil_id' => $userId]);
    $assignments = $assignmentsStmt->fetchAll();

    // Count assignments by status
    $statsStmt = $pdo->prepare("
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status_pengadil = 'Belum Jawab' THEN 1 ELSE 0 END) as belum_jawab,
            SUM(CASE WHEN status_pengadil = 'Diterima' THEN 1 ELSE 0 END) as diterima,
            SUM(CASE WHEN status_pengadil = 'Ditolak' THEN 1 ELSE 0 END) as ditolak,
            SUM(CASE WHEN status_pengadil = 'Belum Jawab' AND p.tarikh >= CURDATE() THEN 1 ELSE 0 END) as upcoming
        FROM perlawanan_pengadil pp
        JOIN perlawanan p ON pp.perlawanan_id = p.id
        WHERE pp.pengadil_id = :pengadil_id
    ");

    $statsStmt->execute([':pengadil_id' => $userId]);
    $stats = $statsStmt->fetch();

    // Get next upcoming assignment
    $nextAssignmentStmt = $pdo->prepare("
        SELECT
            pp.id,
            p.tarikh,
            p.jenis,
            p.tempat,
            p.jawatan
        FROM perlawanan_pengadil pp
        JOIN perlawanan p ON pp.perlawanan_id = p.id
        WHERE pp.pengadil_id = :pengadil_id
        AND pp.status_pengadil = 'Belum Jawab'
        AND p.tarikh >= CURDATE()
        ORDER BY p.tarikh ASC
        LIMIT 1
    ");

    $nextAssignmentStmt->execute([':pengadil_id' => $userId]);
    $nextAssignment = $nextAssignmentStmt->fetch();

    jsonResponse([
        'error' => false,
        'assignments' => $assignments,
        'statistics' => [
            'total' => (int) $stats['total'],
            'belum_jawab' => (int) $stats['belum_jawab'],
            'diterima' => (int) $stats['diterima'],
            'ditolak' => (int) $stats['ditolak'],
            'upcoming' => (int) $stats['upcoming']
        ],
        'next_assignment' => $nextAssignment ?: null
    ]);

} catch (Throwable $e) {
    error_log('[pengadil-assignments.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());
    error_log('[pengadil-assignments.php] Stack trace: ' . $e->getTraceAsString());
    $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to load assignments.';
    jsonResponse(['error' => true, 'message' => $message], 500);
}