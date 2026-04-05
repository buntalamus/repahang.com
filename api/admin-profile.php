<?php
require_once __DIR__ . '/bootstrap.php';

try {
    // Check if user is logged in and is admin
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
        jsonResponse([
            'error' => true,
            'message' => 'Akses tidak dibenarkan'
        ], 401);
    }

    $userId = $_SESSION['user_id'];

    // Get admin profile data
    $stmt = $pdo->prepare("
        SELECT
            u.nama_penuh,
            u.email,
            u.last_login,
            u.created_at
        FROM users u
        WHERE u.id = ? AND u.role = 'Admin'
    ");

    $stmt->execute([$userId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        jsonResponse([
            'error' => true,
            'message' => 'Profil admin tidak ditemui'
        ], 404);
    }

    // Get last activity safely (table might not exist)
    $lastActivityStr = null;
    try {
        $actStmt = $pdo->prepare("SELECT MAX(created_at) FROM activity_log WHERE user_id = ?");
        $actStmt->execute([$userId]);
        $lastActivityStr = $actStmt->fetchColumn() ?: null;
    } catch (Throwable $e) {
        // activity_log table may not exist
    }

    // Format dates
    $lastLogin = $profile['last_login'] ? new DateTime($profile['last_login']) : null;
    $lastActivity = $lastActivityStr ? new DateTime($lastActivityStr) : null;

    jsonResponse([
        'error' => false,
        'profile' => [
            'nama_penuh' => $profile['nama_penuh'],
            'email' => $profile['email'],
            'last_login_formatted' => $lastLogin ? $lastLogin->format('d/m/Y H:i') : '-',
            'last_activity' => $lastActivity ? $lastActivity->format('d/m/Y H:i') : '-',
            'created_at' => $profile['created_at']
        ]
    ]);

} catch (Throwable $e) {
    error_log('Admin profile API error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    jsonResponse([
        'error' => true,
        'message' => APP_DEBUG ? $e->getMessage() : 'Ralat dalaman server'
    ], 500);
}