<?php

require_once 'bootstrap.php';



// Check if user is authenticated and is a penilai

if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'Penilai') {

    http_response_code(403);

    echo json_encode(['error' => true, 'message' => 'Akses ditolak']);

    exit;

}



$penilai_id = $_SESSION['user_id'];

$input = getJsonInput();

try {

    $pdo = getDbConnection();

    // Check if assessment already exists

    $checkQuery = "

        SELECT id FROM penilaian

        WHERE perlawanan_id = ? AND pengadil_id = ? AND penilai_id = ?

    ";



    $stmt = $pdo->prepare($checkQuery);

    $stmt->execute([$input['perlawanan_id'], $input['pengadil_id'], $penilai_id]);

    $existing = $stmt->fetch(PDO::FETCH_ASSOC);



    if ($existing) {

        http_response_code(409);

        echo json_encode(['error' => true, 'message' => 'Penilaian untuk perlawanan ini sudah wujud']);

        exit;

    }



    // Insert new assessment

    $insertQuery = "

        INSERT INTO penilaian (

            perlawanan_id,

            pengadil_id,

            penilai_id,

            score_teknikal,

            score_fizikal,

            score_mental,

            score_disiplin,

            komen_penilai,

            tarikh_penilaian,

            status_penilaian

        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'completed')

    ";



    $stmt = $pdo->prepare($insertQuery);

    $stmt->execute([

        $input['perlawanan_id'],

        $input['pengadil_id'],

        $penilai_id,

        $input['score_teknikal'],

        $input['score_fizikal'],

        $input['score_mental'],

        $input['score_disiplin'],

        $input['komen_penilai'] ?? ''

    ]);



    echo json_encode([

        'error' => false,

        'message' => 'Penilaian berjaya dihantar',

        'assessment_id' => $pdo->lastInsertId()

    ]);



} catch (Exception $e) {

    error_log('Submit assessment error: ' . $e->getMessage());

    http_response_code(500);

    echo json_encode(['error' => true, 'message' => 'Ralat dalaman server']);

}

?>