<?php

require_once __DIR__ . '/bootstrap.php';



// Check if user is authenticated and is a penilai

if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'Penilai') {

    http_response_code(403);

    echo json_encode(['error' => true, 'message' => 'Akses ditolak']);

    exit;

}



$penilai_id = $_SESSION['user_id'];



try {

    $pdo = getDbConnection();

    // Count total assignments as Penilai Pengadil
    $stmtTotal = $pdo->prepare("
        SELECT COUNT(*) FROM lantikan_pengadil
        WHERE pengadil_id = ? AND jawatan = 'Penilai Pengadil' AND status = 'Diterima'
    ");
    $stmtTotal->execute([$penilai_id]);
    $totalTugasan = (int)$stmtTotal->fetchColumn();

    // Count completed reports (Dihantar or Disahkan)
    $stmtSelesai = $pdo->prepare("
        SELECT COUNT(*) FROM laporan_penilaian
        WHERE penilai_id = ? AND status IN ('Dihantar','Disahkan')
    ");
    $stmtSelesai->execute([$penilai_id]);
    $selesai = (int)$stmtSelesai->fetchColumn();

    // Count distinct pengadil assessed
    $stmtDinilai = $pdo->prepare("
        SELECT COUNT(DISTINCT lpp.nama_pengadil) FROM laporan_penilaian lp
        JOIN laporan_penilaian_pegawai lpp ON lp.id = lpp.laporan_id
        WHERE lp.penilai_id = ? AND lp.status IN ('Dihantar','Disahkan')
    ");
    $stmtDinilai->execute([$penilai_id]);
    $pengadilDinilai = (int)$stmtDinilai->fetchColumn();

    $stats = [
        'total_tugasan' => $totalTugasan,
        'selesai' => $selesai,
        'belum_selesai' => $totalTugasan - $selesai,
        'pengadil_dinilai' => $pengadilDinilai
    ];

    // Recent reports
    $recentQuery = "
        SELECT lp.id, lp.status,
               jp.tarikh, CONCAT(jp.pasukan_home, ' lwn ', jp.pasukan_away) as pertandingan,
               k.nama as kejohanan
        FROM laporan_penilaian lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        JOIN kejohanan k ON jp.kejohanan_id = k.id
        WHERE lp.penilai_id = ?
        ORDER BY lp.tarikh_hantar DESC, lp.created_at DESC
        LIMIT 5
    ";
    $stmt = $pdo->prepare($recentQuery);
    $stmt->execute([$penilai_id]);
    $recent = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([

        'error' => false,

        'data' => [
            'stats' => $stats,
            'recent' => $recent
        ]

    ]);



} catch (Exception $e) {

    error_log('Penilai dashboard error: ' . $e->getMessage());

    http_response_code(500);

    echo json_encode(['error' => true, 'message' => 'Ralat dalaman server']);

}

?>

