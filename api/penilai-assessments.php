<?php

require_once 'bootstrap.php';



// Check if user is authenticated and is a penilai

if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'Penilai') {

    http_response_code(403);

    echo json_encode(['error' => true, 'message' => 'Akses ditolak']);

    exit;

}



$penilai_id = $_SESSION['user_id'];

$persatuan_id = $_SESSION['persatuan_id']; // Get penilai's district/association



try {

    $pdo = getDbConnection();

    // Get completed assessments - filter by penilai's district/association

    $assessmentsQuery = "

        SELECT

            p.id,

            p.perlawanan_id,

            p.pengadil_id,

            p.skor_pengetahuan,

            p.skor_kedudukan,

            p.skor_keputusan,

            p.skor_kerjasama,

            p.skor_penampilan,

            p.jumlah_skor,

            p.score_teknikal,

            p.score_fizikal,

            p.score_mental,

            p.score_disiplin,

            p.komen_penilai,

            p.catatan,

            p.tarikh_penilaian,

            p.status_penilaian,

            pl.jenis as nama_perlawanan,

            pl.home_team,

            pl.away_team,

            pl.tarikh,

            pl.tempat,

            u.nama_penuh as nama_pengadil

        FROM penilaian p

        JOIN perlawanan pl ON p.perlawanan_id = pl.id

        JOIN users u ON p.pengadil_id = u.id

        WHERE p.penilai_id = ?

        AND u.persatuan_id = ?

        ORDER BY p.tarikh_penilaian DESC

    ";



    $stmt = $pdo->prepare($assessmentsQuery);

    $stmt->execute([$penilai_id, $persatuan_id]);

    $assessments = $stmt->fetchAll(PDO::FETCH_ASSOC);



    echo json_encode([

        'error' => false,

        'assessments' => $assessments

    ]);



} catch (Exception $e) {

    error_log('Penilai assessments error: ' . $e->getMessage());

    http_response_code(500);

    echo json_encode(['error' => true, 'message' => 'Ralat dalaman server']);

}

?>