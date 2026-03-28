<?php
/**
 * Tugasan Lantikan API (Pengadil / Penilai)
 * GET /api/tugasan.php  - list all assignments for current user from lantikan_pengadil
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Pengadil', 'Penilai']);

try {
    $pdo = getDbConnection();
    $uid = (int) $currentUser['id'];

    $stmt = $pdo->prepare("
        SELECT
            lp.id, lp.jawatan, lp.status, lp.komen, lp.tarikh_jawab, lp.notif_hantar, lp.created_at,
            jp.id AS jadual_id, jp.no_perlawanan, jp.tarikh, jp.masa, jp.hari,
            jp.kumpulan_tahap, jp.pasukan_home, jp.pasukan_away, jp.tempat,
            k.id AS kejohanan_id, k.nama AS nama_kejohanan, k.anjuran,
            pu.id AS pengadil_utama_lantikan_id, pu.pengadil_id AS pengadil_utama_id,
            u_pu.nama_penuh AS nama_pengadil_utama
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        JOIN kejohanan k ON jp.kejohanan_id = k.id
        LEFT JOIN lantikan_pengadil pu ON pu.jadual_id = jp.id AND pu.jawatan = 'Pengadil Utama'
        LEFT JOIN users u_pu ON pu.pengadil_id = u_pu.id
        WHERE lp.pengadil_id = :uid
        ORDER BY jp.tarikh ASC, jp.masa ASC
    ");
    $stmt->execute([':uid' => $uid]);
    $assignments = $stmt->fetchAll();

    $stats = [
        'total'       => count($assignments),
        'belum_jawab' => count(array_filter($assignments, fn($a) => $a['status'] === 'Belum Jawab')),
        'diterima'    => count(array_filter($assignments, fn($a) => $a['status'] === 'Diterima')),
        'ditolak'     => count(array_filter($assignments, fn($a) => $a['status'] === 'Ditolak')),
    ];

    jsonResponse(['error' => false, 'data' => $assignments, 'stats' => $stats]);

} catch (Throwable $e) {
    error_log('[tugasan.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
