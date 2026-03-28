<?php

/**

 * API: Update PP Profile

 * Allows PP Daerah users to update their profile information

 */



require_once __DIR__ . '/bootstrap.php';



header('Content-Type: application/json');



if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    http_response_code(405);

    echo json_encode(['error' => true, 'message' => 'Method not allowed']);

    exit;

}



// Check if user is authenticated and is a PP Daerah

if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'PP Daerah') {

    http_response_code(403);

    echo json_encode(['error' => true, 'message' => 'Akses ditolak']);

    exit;

}



// Get database connection

$pdo = getDbConnection();



try {

    $userId = $_SESSION['user_id'];

    

    // Handle both JSON and multipart form data

    $input = [];

    $profileImageUrl = null;

    

    if (isset($_FILES['profile_image'])) {

        // Handle file upload

        $file = $_FILES['profile_image'];

        

        if ($file['error'] !== UPLOAD_ERR_OK) {

            throw new Exception('Gagal memuat naik gambar profil. Kod: ' . $file['error']);

        }

        

        $allowedMime = ['image/jpeg', 'image/png', 'image/jpg'];

        $finfo = new finfo(FILEINFO_MIME_TYPE);

        $mime = $finfo->file($file['tmp_name']);

        

        if (!in_array($mime, $allowedMime, true)) {

            throw new Exception('Format gambar tidak dibenarkan. Gunakan JPG atau PNG.');

        }

        

        if ($file['size'] > 5 * 1024 * 1024) {

            throw new Exception('Saiz gambar melebihi 5MB.');

        }

        

        $uploadsDir = __DIR__ . '/../uploads';

        if (!is_dir($uploadsDir)) {

            mkdir($uploadsDir, 0775, true);

        }

        

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';

        $filename = uniqid('profile_', true) . '.' . strtolower($ext);

        $destination = $uploadsDir . '/' . $filename;

        

        if (!move_uploaded_file($file['tmp_name'], $destination)) {

            throw new Exception('Tidak dapat menyimpan gambar profil.');

        }

        

        $profileImageUrl = '/uploads/' . $filename;

    }



    // Get form data from POST (works for both multipart and JSON requests)

    $input = $_POST;

    

    // If no POST data and Content-Type is JSON, try parsing JSON

    if (empty($input) && isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) {

        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input) {

            throw new Exception('Invalid JSON input');

        }

    }

    

    // Allow optional profile image URL to be saved

    if (!$profileImageUrl) {

        $profileImageUrl = $input['url_gambar_profil'] ?? null;

    }



    // Validate required fields for profile completion

    $required = ['alamat1', 'poskod', 'daerah', 'negeri', 'status_kerja', 'nama_waris', 'hubungan_waris', 'telefon_waris'];

    foreach ($required as $field) {

        if (!isset($input[$field]) || trim($input[$field]) === '') {

            throw new Exception("Medan '$field' diperlukan!");

        }

    }



    // Convert persatuan_bolasepak_daerah (nama_persatuan) to persatuan_id

    $persatuanId = null;

    if (!empty($input['persatuan_bolasepak_daerah'])) {

        $namaPersatuan = $input['persatuan_bolasepak_daerah'];

        $stmtPersatuan = $pdo->prepare("SELECT id FROM persatuan_bolasepak_daerah WHERE nama_persatuan = ?");

        $stmtPersatuan->execute([$namaPersatuan]);

        $persatuanResult = $stmtPersatuan->fetch();

        if ($persatuanResult) {

            $persatuanId = $persatuanResult['id'];

        }

    }



    // Prepare update query (including url_gambar_profil)

    $stmt = $pdo->prepare("

        UPDATE users SET

            nama_penuh = ?,

            no_ic = ?,

            umur = ?,

            email = ?,

            no_telefon = ?,

            jantina = ?,

            alamat1 = ?,

            alamat2 = ?,

            poskod = ?,

            daerah = ?,

            negeri = ?,

            status_kerja = ?,

            jawatan = ?,

            nama_majikan = ?,

            alamat_majikan1 = ?,

            alamat_majikan2 = ?,

            poskod_majikan = ?,

            daerah_majikan = ?,

            negeri_majikan = ?,

            nama_waris = ?,

            hubungan_waris = ?,

            telefon_waris = ?,

            url_gambar_profil = ?,

            jenis_pengadil = ?,

            tahun_mula_aktif = ?,

            saiz_baju = ?,

            persatuan_id = ?,

            updated_at = NOW()

        WHERE id = ? AND role = 'PP Daerah'

    ");



    $stmt->execute([

        strtoupper($input['nama_penuh']),

        $input['no_ic'],

        $input['umur'],

        $input['email'],

        $input['no_telefon'],

        strtoupper($input['jantina']),

        strtoupper($input['alamat1']),

        strtoupper($input['alamat2'] ?? null),

        $input['poskod'],

        strtoupper($input['daerah']),

        strtoupper($input['negeri']),

        strtoupper($input['status_kerja']),

        strtoupper($input['jawatan'] ?? null),

        strtoupper($input['nama_majikan'] ?? null),

        strtoupper($input['alamat_majikan1'] ?? null),

        strtoupper($input['alamat_majikan2'] ?? null),

        $input['poskod_majikan'] ?? null,

        strtoupper($input['daerah_majikan'] ?? null),

        strtoupper($input['negeri_majikan'] ?? null),

        strtoupper($input['nama_waris']),

        strtoupper($input['hubungan_waris']),

        $input['telefon_waris'],

        $profileImageUrl,

        strtoupper($input['jenis_pengadil'] ?? null),

        $input['tahun_mula_aktif'] ?? null,

        strtoupper($input['saiz_baju'] ?? null),

        $persatuanId,

        $userId

    ]);



    // Create notification

    $stmt = $pdo->prepare("

        INSERT INTO notifications (user_id, type, message, created_at)

        VALUES (?, 'Profil Dikemaskini', 'Profil PP anda telah berjaya dikemaskini.', NOW())

    ");

    $stmt->execute([$userId]);



    echo json_encode([

        'error' => false,

        'message' => 'Profil PP berjaya dikemaskini!'

    ]);



} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([

        'error' => true,

        'message' => 'Database error: ' . $e->getMessage()

    ]);

} catch (Exception $e) {

    http_response_code(400);

    echo json_encode([

        'error' => true,

        'message' => $e->getMessage()

    ]);

}

?>