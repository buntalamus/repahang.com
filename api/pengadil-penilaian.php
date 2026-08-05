<?php
/**
 * Pengadil Penilaian API — returns assessment reports for the logged-in pengadil
 *
 * GET /api/pengadil-penilaian.php            — list all penilaian for current user
 * GET /api/pengadil-penilaian.php?id=X       — single report detail
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Pengadil']);
$userId = (int) $currentUser['id'];

try {
    $pdo = getDbConnection();
} catch (Exception $e) {
    jsonResponse(['error' => true, 'message' => 'DB error'], 500);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    jsonResponse(['error' => true, 'message' => 'Method not allowed'], 405);
}

// Single report detail
if (isset($_GET['id'])) {
    $id = (int) $_GET['id'];

    $stmt = $pdo->prepare("
        SELECT lp.id, lp.jadual_id, lp.tahap_kesukaran, lp.ulasan_keseluruhan,
               lp.status, lp.tarikh_hantar, lp.catatan_admin, lp.tarikh_sahkan, lp.created_at,
               jp.no_perlawanan, jp.tarikh, jp.masa, jp.pasukan_home, jp.pasukan_away, jp.tempat,
               k.nama AS nama_kejohanan,
               COALESCE(u_pen.nama_penuh, pl_pen.nama) AS nama_penilai
        FROM laporan_penilaian lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        JOIN kejohanan k ON jp.kejohanan_id = k.id
        LEFT JOIN users u_pen ON lp.penilai_id = u_pen.id
        LEFT JOIN lantikan_pengadil lp2 ON lp.lantikan_id = lp2.id
        LEFT JOIN pengadil_luar pl_pen ON lp2.pengadil_luar_id = pl_pen.id
        WHERE lp.id = :id AND lp.status = 'Disahkan'
    ");
    $stmt->execute([':id' => $id]);
    $report = $stmt->fetch();

    if (!$report) {
        jsonResponse(['error' => true, 'message' => 'Laporan tidak dijumpai.'], 404);
    }

    // Fetch all KUP officials in this report. Each KUP member for the same
    // appointment may read the complete RA assessment for the whole team.
    $pegStmt = $pdo->prepare("
        SELECT lpp.*, la.pengadil_id
        FROM laporan_penilaian_pegawai lpp
        LEFT JOIN lantikan_pengadil la ON lpp.lantikan_pengadil_id = la.id
        WHERE lpp.laporan_id = :lid
        ORDER BY FIELD(lpp.jawatan, 'Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
    ");
    $pegStmt->execute([':lid' => $id]);
    $allPegawai = $pegStmt->fetchAll();

    // Find the current user's entry
    $myEntry = null;
    foreach ($allPegawai as &$p) {
        foreach (['kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan','fizikal_kelemahan','kerjasama_kekuatan','kerjasama_kelemahan'] as $col) {
            if (isset($p[$col]) && is_string($p[$col])) {
                $p[$col] = json_decode($p[$col], true) ?: [];
            }
        }
        if ((int) ($p['pengadil_id'] ?? 0) === $userId) {
            $myEntry = $p;
        }
    }
    unset($p);

    // Security check: user must be one of the four KUP officials recorded in
    // this report. Officials from another appointment cannot read it.
    if (!$myEntry) {
        jsonResponse(['error' => true, 'message' => 'Anda tidak mempunyai akses kepada laporan ini.'], 403);
    }

    $report['pegawai'] = $allPegawai;
    $report['my_entry'] = $myEntry;
    jsonResponse(['error' => false, 'data' => $report]);
}

// List all penilaian reports for current pengadil
$stmt = $pdo->prepare("
    SELECT lp.id, lp.jadual_id, lp.tahap_kesukaran, lp.ulasan_keseluruhan,
           lp.status, lp.tarikh_sahkan, lp.created_at,
           jp.no_perlawanan, jp.tarikh, jp.masa, jp.pasukan_home, jp.pasukan_away,
           k.nama AS nama_kejohanan,
           COALESCE(u_pen.nama_penuh, pl_pen.nama) AS nama_penilai,
           lpp.jawatan AS my_jawatan,
           lpp.markah AS my_markah,
           lpp.prestasi AS my_prestasi
    FROM laporan_penilaian_pegawai lpp
    JOIN lantikan_pengadil la ON lpp.lantikan_pengadil_id = la.id
    JOIN laporan_penilaian lp ON lpp.laporan_id = lp.id
    JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
    JOIN kejohanan k ON jp.kejohanan_id = k.id
    LEFT JOIN users u_pen ON lp.penilai_id = u_pen.id
    LEFT JOIN lantikan_pengadil lp2 ON lp.lantikan_id = lp2.id
    LEFT JOIN pengadil_luar pl_pen ON lp2.pengadil_luar_id = pl_pen.id
    WHERE la.pengadil_id = :uid AND lp.status = 'Disahkan'
    ORDER BY jp.tarikh DESC
");
$stmt->execute([':uid' => $userId]);
$reports = $stmt->fetchAll();

jsonResponse(['error' => false, 'data' => $reports]);
