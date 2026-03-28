<?php
require_once __DIR__ . '/bootstrap.php';

if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'PP Daerah') {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized access']);
    exit;
}

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Kaedah tidak dibenarkan.']);
    exit;
}

try {
    $pp_id = $_SESSION['user_id'];
    $stmt = $pdo->prepare("SELECT persatuan_id FROM users WHERE id = ?");
    $stmt->execute([$pp_id]);
    $pp_data = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$pp_data) {
        throw new Exception('PP Daerah data not found');
    }

    $persatuan_id = $pp_data['persatuan_id'];

    $required_fields = ['user_id', 'nama_penuh', 'no_kp', 'no_telefon', 'nama_waris', 'hubungan_waris', 'telefon_waris', 'tahun_permohonan'];
    foreach ($required_fields as $field) {
        if (!isset($_POST[$field]) || empty(trim($_POST[$field]))) {
            throw new Exception("Field '$field' is required");
        }
    }

    $user_id = (int)$_POST['user_id'];
    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND persatuan_id = ?");
    $stmt->execute([$user_id, $persatuan_id]);
    if (!$stmt->fetch()) {
        throw new Exception('Referee not found in your district');
    }

    $tahun_permohonan = (int)$_POST['tahun_permohonan'];
    $stmt = $pdo->prepare("SELECT id FROM permohonan WHERE user_id = ? AND tahun_permohonan = ? AND jenis_permohonan = 'ujian_kelas1_fam'");
    $stmt->execute([$user_id, $tahun_permohonan]);
    if ($stmt->fetch()) {
        throw new Exception('Pengadil sudah mempunyai permohonan Ujian Kelas 1 FAM untuk tahun ini');
    }

    $data = [
        'user_id' => $user_id,
        'persatuan_id' => $persatuan_id,
        'jenis_borang' => 'ujian_kelas1_fam',
        'jenis_permohonan' => 'ujian_kelas1_fam',
        'nama_penuh' => trim($_POST['nama_penuh']),
        'no_kp' => trim($_POST['no_kp']),
        'no_telefon' => trim($_POST['no_telefon']),
        'nama_waris' => trim($_POST['nama_waris']),
        'hubungan_waris' => trim($_POST['hubungan_waris']),
        'telefon_waris' => trim($_POST['telefon_waris']),
        'tahun_permohonan' => $tahun_permohonan,
        'status' => 'Pending',
        'workflow_status' => 'Pending',
        'status_workflow' => 'Menunggu Admin',
        'tarikh_hantar' => date('Y-m-d H:i:s'),
        'status_kemaskini' => date('Y-m-d H:i:s')
    ];

    $declaration_fields = ['declare1', 'declare2', 'declare3'];
    foreach ($declaration_fields as $field) {
        $data[$field] = isset($_POST[$field]) && $_POST[$field] === '1' ? 1 : 0;
    }

    $columns = implode(', ', array_keys($data));
    $placeholders = implode(', ', array_fill(0, count($data), '?'));
    $stmt = $pdo->prepare("INSERT INTO permohonan ($columns) VALUES ($placeholders)");
    $stmt->execute(array_values($data));

    $application_id = $pdo->lastInsertId();

    echo json_encode([
        'error' => false,
        'message' => 'Permohonan Ujian Kelas 1 FAM berjaya dihantar',
        'application_id' => $application_id
    ]);

} catch (Exception $e) {
    error_log('Kelas 1 FAM test application submission error: ' . $e->getMessage());
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
