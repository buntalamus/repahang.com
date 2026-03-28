<?php
/**
 * API: Change Password
 * Allows users to change their password
 * Sets password_changed flag to 1 on first password change
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
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }

    // Validate required fields
    if (empty($input['current_password']) || empty($input['new_password'])) {
        throw new Exception('Kata laluan semasa dan kata laluan baru diperlukan!');
    }

    // Validate new password
    if (strlen($input['new_password']) < 8) {
        throw new Exception('Kata laluan baru mesti sekurang-kurangnya 8 aksara!');
    }

    // Validate confirm password
    if ($input['new_password'] !== $input['confirm_password']) {
        throw new Exception('Kata laluan baru dan pengesahan tidak sepadan!');
    }

    $userId = $_SESSION['user_id'];

    // Get current password from database
    $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        throw new Exception('Pengguna tidak dijumpai!');
    }

    // Verify current password
    if (!password_verify($input['current_password'], $user['password'])) {
        throw new Exception('Kata laluan semasa tidak tepat!');
    }

    // Hash new password
    $hashedPassword = password_hash($input['new_password'], PASSWORD_DEFAULT);

    // Update password and set password_changed flag
    $stmt = $pdo->prepare("
        UPDATE users 
        SET password = ?, 
            password_changed = 1,
            updated_at = NOW()
        WHERE id = ?
    ");
    
    $stmt->execute([$hashedPassword, $userId]);

    // Update session so password_changed is reflected immediately
    $_SESSION['password_changed'] = 1;

    echo json_encode([
        'error' => false,
        'message' => 'Kata laluan berjaya dikemaskini!'
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
