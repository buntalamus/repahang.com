<?php
require_once 'bootstrap.php';

// Check if user is authenticated and is a penilai
if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'Penilai') {
    http_response_code(403);
    echo json_encode(['error' => true, 'message' => 'Akses ditolak']);
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    $pdo = getDbConnection();
    // Get penilai profile
    $profileQuery = "
        SELECT
            id,
            nama_penuh,
            email as emel,
            no_telefon,
            url_gambar_profil,
            jenis_penilai,
            created_at,
            updated_at
        FROM users
        WHERE id = ? AND role = 'Penilai'
    ";

    $stmt = $pdo->prepare($profileQuery);
    $stmt->execute([$user_id]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        http_response_code(404);
        echo json_encode(['error' => true, 'message' => 'Profil tidak dijumpai']);
        exit;
    }

    echo json_encode([
        'error' => false,
        'profile' => $profile
    ]);

} catch (Exception $e) {
    error_log('Penilai profile error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => 'Ralat dalaman server']);
}
?>