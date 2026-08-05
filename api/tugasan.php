<?php
/**
 * Tugasan Lantikan API (Pengadil / Penilai)
 * GET /api/tugasan.php  - list all assignments for current user from lantikan_pengadil
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/lantikan-helper.php';

$currentUser = requireRole(['Pengadil', 'Penilai', 'PP Daerah']);

try {
    $pdo = getDbConnection();
    $uid = (int) $currentUser['id'];

    // Auto-tolak lantikan yang tempoh jawapannya sudah tamat
    autoTolakLantikanTertunggak($pdo, ['pengadil_id' => $uid]);

    $stmt = $pdo->prepare("
        SELECT
            lp.id, lp.jawatan, lp.status, lp.komen, lp.sebab_status, lp.status_dikemaskini_at, lp.tarikh_jawab, lp.notif_hantar, lp.tarikh_notif, lp.created_at,
            jp.id AS jadual_id, jp.no_perlawanan, jp.tarikh, jp.masa, jp.hari,
            jp.kumpulan_tahap, jp.pasukan_home, jp.pasukan_away, jp.tempat,
            k.id AS kejohanan_id, k.nama AS nama_kejohanan, k.anjuran,
            k.jenis_kejohanan, k.peringkat_kejohanan,
            pu.id AS pengadil_utama_lantikan_id, pu.pengadil_id AS pengadil_utama_id,
            u_pu.nama_penuh AS nama_pengadil_utama
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        JOIN kejohanan k ON jp.kejohanan_id = k.id
        LEFT JOIN lantikan_pengadil pu ON pu.jadual_id = jp.id AND pu.jawatan = 'Pengadil'
        LEFT JOIN users u_pu ON pu.pengadil_id = u_pu.id
        WHERE lp.pengadil_id = :uid
        ORDER BY jp.tarikh ASC, jp.masa ASC
    ");
    $stmt->execute([':uid' => $uid]);
    $assignments = $stmt->fetchAll();

    // Expose only name and role for fellow officials assigned to the same match.
    $officialsStmt = $pdo->prepare("
        SELECT lp.jadual_id, lp.id, lp.jawatan, lp.status,
               COALESCE(u.nama_penuh, pl.nama) AS nama
        FROM lantikan_pengadil lp
        LEFT JOIN users u ON lp.pengadil_id = u.id
        LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
        WHERE lp.jadual_id = :jadual_id AND lp.id <> :lantikan_id
        ORDER BY FIELD(lp.jawatan, 'Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4', 'Penilai Pengadil')
    ");
    foreach ($assignments as &$assignment) {
        $officialsStmt->execute([':jadual_id' => $assignment['jadual_id'], ':lantikan_id' => $assignment['id']]);
        $assignment['rakan_tugasan'] = $officialsStmt->fetchAll(PDO::FETCH_ASSOC);
    }
    unset($assignment);

    $stats = [
        'total'       => count($assignments),
        'belum_jawab' => count(array_filter($assignments, fn($a) => $a['status'] === 'Belum Jawab')),
        'diterima'    => count(array_filter($assignments, fn($a) => $a['status'] === 'Diterima')),
        'ditolak'     => count(array_filter($assignments, fn($a) => $a['status'] === 'Ditolak')),
        'dibatalkan'  => count(array_filter($assignments, fn($a) => $a['status'] === 'Dibatalkan')),
        'ditangguhkan'=> count(array_filter($assignments, fn($a) => $a['status'] === 'Ditangguhkan')),
    ];

    jsonResponse(['error' => false, 'data' => $assignments, 'stats' => $stats]);

} catch (Throwable $e) {
    error_log('[tugasan.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
