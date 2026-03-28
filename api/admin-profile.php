<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'bootstrap.php';

try {
    // Check if user is logged in and is admin
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
        http_response_code(401);
        echo json_encode([
            'error' => true,
            'message' => 'Akses tidak dibenarkan'
        ]);
        exit;
    }

    $userId = $_SESSION['user_id'];

    // Get admin profile data
    $stmt = $pdo->prepare("
        SELECT
            u.nama_penuh,
            u.email,
            u.last_login,
            u.created_at,
            (SELECT MAX(created_at) FROM activity_log WHERE user_id = u.id) as last_activity
        FROM users u
        WHERE u.id = ? AND u.role = 'Admin'
    ");

    $stmt->execute([$userId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        http_response_code(404);
        echo json_encode([
            'error' => true,
            'message' => 'Profil admin tidak ditemui'
        ]);
        exit;
    }

    // Format dates
    $lastLogin = $profile['last_login'] ? new DateTime($profile['last_login']) : null;
    $lastActivity = $profile['last_activity'] ? new DateTime($profile['last_activity']) : null;

    echo json_encode([
        'error' => false,
        'profile' => [
            'nama_penuh' => $profile['nama_penuh'],
            'email' => $profile['email'],
            'last_login_formatted' => $lastLogin ? $lastLogin->format('d/m/Y H:i') : '-',
            'last_activity' => $lastActivity ? $lastActivity->format('d/m/Y H:i') : '-',
            'created_at' => $profile['created_at']
        ]
    ]);

} catch (Exception $e) {
    error_log('Admin profile API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Ralat dalaman server'
    ]);
}
?>