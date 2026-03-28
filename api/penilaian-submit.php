<?php

require_once 'bootstrap.php';

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
    $stmt = $pdo->prepare("SELECT id FROM penilaian WHERE perlawanan_id = ? AND pengadil_id = ? AND penilai_id = ?");
    $stmt->execute([$input['perlawanan_id'], $input['pengadil_id'], $penilai_id]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => true, 'message' => 'Penilaian untuk perlawanan ini sudah wujud']);
        exit;
    }

    $stmt = $pdo->prepare("
        INSERT INTO penilaian (
            perlawanan_id, pengadil_id, penilai_id,
            skor_pengetahuan, skor_kedudukan, skor_keputusan, skor_kerjasama, skor_penampilan,
            score_teknikal, score_fizikal, score_mental, score_disiplin,
            catatan, komen_penilai, tarikh_penilaian, status_penilaian
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'completed')
    ");
    $stmt->execute([
        $input['perlawanan_id'],
        $input['pengadil_id'],
        $penilai_id,
        $input['skor_pengetahuan'] ?? null,
        $input['skor_kedudukan'] ?? null,
        $input['skor_keputusan'] ?? null,
        $input['skor_kerjasama'] ?? null,
        $input['skor_penampilan'] ?? null,
        $input['score_teknikal'] ?? null,
        $input['score_fizikal'] ?? null,
        $input['score_mental'] ?? null,
        $input['score_disiplin'] ?? null,
        $input['catatan'] ?? '',
        $input['komen_penilai'] ?? ''
    ]);

    echo json_encode([
        'error' => false,
        'message' => 'Penilaian berjaya dihantar',
        'assessment_id' => $pdo->lastInsertId()
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => 'Ralat semasa menghantar penilaian']);
}
