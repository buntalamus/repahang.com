<?php

/**
 * Pengadil Kelas 1 FAM Test Application API
 * POST: Submit Kelas 1 FAM test application for current user
 */

require_once 'bootstrap.php';

header('Content-Type: application/json');

try {
    requireAuth();

    if ($_SESSION['user_role'] !== 'Pengadil') {
        http_response_code(403);
        echo json_encode(['error' => 'Akses ditolak. Hanya pengadil boleh mengakses.']);
        exit;
    }

    $pdo = getDbConnection();
    $userId = $_SESSION['user_id'];

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $tahun_permohonan = date('Y') + 1;
    $checkStmt = $pdo->prepare("
        SELECT id FROM permohonan
        WHERE user_id = :user_id
        AND jenis_permohonan = 'ujian_kelas1_fam'
        AND tahun_permohonan = :tahun_permohonan
    ");
    $checkStmt->execute([
        'user_id' => $userId,
        'tahun_permohonan' => $tahun_permohonan
    ]);

    if ($checkStmt->fetch()) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Anda sudah mempunyai permohonan Ujian Kelas 1 FAM untuk tahun ini.'
        ]);
        exit;
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON data']);
        exit;
    }

    $required = ['declare1', 'declare2'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Field '$field' diperlukan."]);
            exit;
        }
    }

    $userStmt = $pdo->prepare("
        SELECT persatuan_id, nama_penuh, no_ic, email, no_telefon
        FROM users WHERE id = :user_id
    ");
    $userStmt->execute(['user_id' => $userId]);
    $userData = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$userData || !$userData['persatuan_id']) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Maklumat persatuan bolasepak daerah tidak dijumpai. Sila hubungi admin.'
        ]);
        exit;
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO permohonan (
            user_id, persatuan_id, tahun_permohonan,
            jenis_borang, jenis_permohonan,
            nama_penuh, no_kp, emel, no_telefon,
            nama_waris, hubungan_waris, telefon_waris,
            declare1, declare2,
            status, workflow_status, status_workflow,
            tarikh_hantar, status_kemaskini
        ) VALUES (
            :user_id, :persatuan_id, :tahun_permohonan,
            'ujian_kelas1_fam', 'ujian_kelas1_fam',
            :nama_penuh, :no_kp, :emel, :no_telefon,
            :nama_waris, :hubungan_waris, :telefon_waris,
            :declare1, :declare2,
            'Pending', 'Pending', 'Menunggu Admin',
            NOW(), NOW()
        )
    ");

    $insertStmt->execute([
        'user_id' => $userId,
        'persatuan_id' => $userData['persatuan_id'],
        'tahun_permohonan' => $tahun_permohonan,
        'nama_penuh' => strtoupper($userData['nama_penuh']),
        'no_kp' => $userData['no_ic'],
        'emel' => $userData['email'],
        'no_telefon' => $userData['no_telefon'],
        'nama_waris' => strtoupper($data['nama_waris'] ?? ''),
        'hubungan_waris' => $data['hubungan_waris'] ?? '',
        'telefon_waris' => $data['telefon_waris'] ?? '',
        'declare1' => $data['declare1'] ? 1 : 0,
        'declare2' => $data['declare2'] ? 1 : 0,
    ]);

    $applicationId = $pdo->lastInsertId();

    $notifStmt = $pdo->prepare("
        INSERT INTO notifications (user_id, type, subject, message, created_at)
        SELECT u.id,
            'Permohonan Ujian Kelas 1 FAM',
            'Permohonan Ujian Kelas 1 FAM Baru',
            CONCAT('Permohonan Ujian Kelas 1 FAM daripada ', :nama_penuh, ' telah dihantar. Sila semak dan sahkan.'),
            NOW()
        FROM users u WHERE u.role = 'Admin'
    ");
    $notifStmt->execute(['nama_penuh' => $userData['nama_penuh']]);

    echo json_encode([
        'error' => false,
        'message' => 'Permohonan Ujian Kelas 1 FAM berjaya dihantar!',
        'application_id' => $applicationId
    ]);

} catch (Exception $e) {
    error_log('Kelas 1 FAM test application submission error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
