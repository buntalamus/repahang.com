<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
}

// Check if user is logged in and is PP Daerah
$user = requireAuth();
if ($user['role'] !== 'PP Daerah') {
    jsonResponse(['error' => true, 'message' => 'Akses ditolak. Hanya PP Daerah dibenarkan.'], 403);
}

try {
    // Get form data
    $user_id = $_POST['user_id'] ?? null;
    $tahun_permohonan = $_POST['tahun_permohonan'] ?? null;

    if (!$user_id || !$tahun_permohonan) {
        throw new Exception('Medan wajib tidak lengkap: user_id=' . ($user_id ? 'ok' : 'missing') . ', tahun_permohonan=' . ($tahun_permohonan ? 'ok' : 'missing'));
    }

    // IDOR protection: verify the user belongs to PP's district
    $verifyStmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND persatuan_id = ?");
    $verifyStmt->execute([$user_id, $user['persatuan_id']]);
    if (!$verifyStmt->fetch()) {
        jsonResponse(['error' => true, 'message' => 'Pengadil ini bukan di bawah daerah anda.'], 403);
    }

    // Check if application already exists for this user and year
    $stmt = $pdo->prepare("SELECT id FROM permohonan WHERE user_id = ? AND tahun_permohonan = ? AND jenis_borang = 'pengadil_berdaftar'");
    $stmt->execute([$user_id, $tahun_permohonan]);
    if ($stmt->fetch()) {
        throw new Exception('Permohonan pengadil berdaftar sudah wujud untuk tahun ini');
    }

    // Prepare data for insertion
    $data = [
        'user_id' => $user_id,
        'tahun_permohonan' => $tahun_permohonan,
        'jenis_borang' => 'pengadil_berdaftar',
        'nama_penuh' => $_POST['nama_penuh'] ?? '',
        'no_kp' => $_POST['no_kp'] ?? '',
        'jantina' => $_POST['jantina'] ?? '',
        'emel' => $_POST['emel'] ?? '',
        'no_telefon' => $_POST['no_telefon'] ?? '',
        'jenis_pengadil' => $_POST['jenis_pengadil_referee'] ?? '', // Map from jenis_pengadil_referee
        'tahun_mula_aktif' => $_POST['tahun_mula_aktif'] ?? '',
        'persatuan_daerah' => $_POST['persatuan_daerah'] ?? '',
        'alamat1' => $_POST['alamat1'] ?? '',
        'alamat2' => $_POST['alamat2'] ?? '',
        'poskod' => $_POST['poskod'] ?? '',
        'daerah' => $_POST['daerah'] ?? '',
        'negeri' => $_POST['negeri'] ?? '',
        'status_kerja' => $_POST['status_kerja'] ?? '',
        'jawatan' => $_POST['jawatan'] ?? '',
        'nama_majikan' => $_POST['nama_majikan'] ?? '',
        'alamat_majikan1' => $_POST['alamat_majikan1'] ?? '',
        'alamat_majikan2' => $_POST['alamat_majikan2'] ?? '',
        'poskod_majikan' => $_POST['poskod_majikan'] ?? '',
        'daerah_majikan' => $_POST['daerah_majikan'] ?? '',
        'negeri_majikan' => $_POST['negeri_majikan'] ?? '',
        'nama_waris' => $_POST['nama_waris'] ?? '',
        'hubungan_waris' => $_POST['hubungan_waris'] ?? '',
        'telefon_waris' => $_POST['telefon_waris'] ?? '',
        'saiz_baju' => $_POST['saiz_baju'] ?? '',
        'declare1' => $_POST['declare1'] ?? '0',
        'declare2' => $_POST['declare2'] ?? '0',
        'declare3' => $_POST['declare3'] ?? '0',
        'status' => 'Pending',
        'status_workflow' => 'Menunggu Admin',
        'tarikh_hantar' => date('Y-m-d H:i:s'),
        'status_kemaskini' => date('Y-m-d H:i:s')
    ];

    // Handle file uploads
    $upload_dir = '../uploads/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    // Handle resit bayaran upload
    if (isset($_FILES['resit_bayaran']) && $_FILES['resit_bayaran']['error'] === UPLOAD_ERR_OK) {
        $resit_file = $_FILES['resit_bayaran'];
        $resit_filename = uniqid('resit_') . '_' . $user_id . '_' . $tahun_permohonan . '.' . pathinfo($resit_file['name'], PATHINFO_EXTENSION);
        $resit_path = $upload_dir . $resit_filename;

        if (move_uploaded_file($resit_file['tmp_name'], $resit_path)) {
            $data['url_resit'] = $resit_filename;
        }
    }

    // Insert into database
    $columns = implode(', ', array_keys($data));
    $placeholders = implode(', ', array_fill(0, count($data), '?'));
    $values = array_values($data);

    try {
        $stmt = $pdo->prepare("INSERT INTO permohonan ($columns) VALUES ($placeholders)");
        $stmt->execute($values);
    } catch (PDOException $dbError) {
        throw new Exception('Ralat pangkalan data: ' . $dbError->getMessage());
    }

    $application_id = $pdo->lastInsertId();

    jsonResponse([
        'error' => false,
        'message' => 'Permohonan pengadil berdaftar berjaya dihantar',
        'application_id' => $application_id
    ]);

} catch (Exception $e) {
    jsonResponse(['error' => true, 'message' => $e->getMessage()], 400);
}
?>