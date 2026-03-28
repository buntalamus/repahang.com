<?php
/**
 * API: Update Penilai Profile
 * Allows penilai users to update their profile information
 */

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => true, 'message' => 'Method not allowed']);
    exit;
}

// Check if user is authenticated and is a penilai
if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'Penilai') {
    http_response_code(403);
    echo json_encode(['error' => true, 'message' => 'Akses ditolak']);
    exit;
}

// Get database connection
$pdo = getDbConnection();

try {
    $userId = $_SESSION['user_id'];

    // Handle profile image upload
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

    // Get form data from POST
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

    // Prepare update query for penilai (only update relevant fields)
    $stmt = $pdo->prepare("
        UPDATE users SET
            nama_penuh = ?,
            email = ?,
            no_telefon = ?,
            jenis_penilai = ?,
            url_gambar_profil = ?,
            updated_at = NOW()
        WHERE id = ? AND role = 'Penilai'
    ");

    $stmt->execute([
        $input['nama_penuh'],
        $input['email'],
        $input['no_telefon'],
        $input['jenis_penilai'],
        $profileImageUrl,
        $userId
    ]);

    // Check if any rows were affected
    if ($stmt->rowCount() === 0) {
        throw new Exception('Tiada perubahan dibuat atau profil tidak dijumpai');
    }

    // Create notification
    $stmt = $pdo->prepare("
        INSERT INTO notifications (user_id, type, message, created_at)
        VALUES (?, 'Profil Dikemaskini', 'Profil penilai anda telah berjaya dikemaskini.', NOW())
    ");
    $stmt->execute([$userId]);

    echo json_encode([
        'error' => false,
        'message' => 'Profil penilai berjaya dikemaskini!'
    ]);

} catch (PDOException $e) {
    error_log('Penilai profile update error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log('Penilai profile update error: ' . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage()
    ]);
}
?>