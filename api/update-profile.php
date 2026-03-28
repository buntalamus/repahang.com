<?php
/**
 * API: Update Profile
 * Allows users to update their profile information
 * Required for completing profile after registration
 */

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => true, 'message' => 'Method not allowed']);
    exit;
}

// Require authentication
requireAuth();

// Get database connection
$pdo = getDbConnection();

try {
    $userId = $_SESSION['user_id'];

    // Fetch fresh user role from database to ensure accuracy
    $stmtRole = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmtRole->execute([$userId]);
    $userRole = $stmtRole->fetchColumn();
    
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
    // Only enforce for non-admin users (Pengadil/Penilai/PP Daerah)
    // Check case-insensitive for 'admin'
    if (strcasecmp($userRole, 'Admin') !== 0) {
        $required = ['alamat1', 'poskod', 'daerah', 'negeri', 'status_kerja', 'nama_waris', 'hubungan_waris', 'telefon_waris'];
        foreach ($required as $field) {
            if (!isset($input[$field]) || trim($input[$field]) === '') {
                // Debugging: Show the role if validation fails
                throw new Exception("Medan '$field' diperlukan! (Role anda dikesan sebagai: '$userRole')");
            }
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
            updated_at = NOW()
        WHERE id = ?
    ");

    $stmt->execute([
        $input['nama_penuh'],
        $input['no_ic'] ?? null,
        $input['umur'] ?? null,
        $input['email'],
        $input['no_telefon'] ?? null,
        $input['jantina'] ?? null,
        $input['alamat1'] ?? null,
        $input['alamat2'] ?? null,
        $input['poskod'] ?? null,
        $input['daerah'] ?? null,
        $input['negeri'] ?? null,
        $input['status_kerja'] ?? null,
        $input['jawatan'] ?? null,
        $input['nama_majikan'] ?? null,
        $input['alamat_majikan1'] ?? null,
        $input['alamat_majikan2'] ?? null,
        $input['poskod_majikan'] ?? null,
        $input['daerah_majikan'] ?? null,
        $input['negeri_majikan'] ?? null,
        $input['nama_waris'] ?? null,
        $input['hubungan_waris'] ?? null,
        $input['telefon_waris'] ?? null,
        $profileImageUrl,
        $input['jenis_pengadil'] ?? null,
        $input['tahun_mula_aktif'] ?? null,
        $input['saiz_baju'] ?? null,
        $userId
    ]);

    // Create notification
    $stmt = $pdo->prepare("
        INSERT INTO notifications (user_id, type, subject, message, created_at)
        VALUES (?, 'Profil Dikemaskini', 'Profil Dikemaskini', 'Profil anda telah berjaya dikemaskini.', NOW())
    ");
    $stmt->execute([$userId]);

    echo json_encode([
        'error' => false,
        'message' => 'Profil berjaya dikemaskini!'
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
