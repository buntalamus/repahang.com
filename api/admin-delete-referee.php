<?php

/**
 * Admin Delete Referee API
 * DELETE: Delete approved referee application
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json');

try {
    // Require Admin role
    requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && 
    !($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']) && $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] === 'DELETE')) {
    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
}
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true) ?: [];
    $userId = $input['user_id'] ?? $_GET['id'] ?? 0;

    if (!$userId) {
        jsonResponse(['error' => true, 'message' => 'ID pengguna diperlukan.'], 422);
    }

    $pdo = getDbConnection();

    // Get user details and their approved application
    $stmt = $pdo->prepare("
        SELECT p.id as permohonan_id, p.*, u.email as user_email, u.nama_penuh as user_nama
        FROM users u
        LEFT JOIN permohonan p ON p.user_id = u.id AND p.status = 'Approved'
        WHERE u.id = :id AND u.role = 'Pengadil'
        LIMIT 1
    ");
    $stmt->execute(['id' => $userId]);
    $application = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$application) {
        jsonResponse(['error' => true, 'message' => 'Pengadil tidak dijumpai.'], 404);
    }

    $pdo->beginTransaction();

    // Delete from perlawanan table first (foreign key constraint)
    if ($application['permohonan_id']) {
        $deleteMatchesStmt = $pdo->prepare("DELETE FROM perlawanan WHERE permohonan_id = :id");
        $deleteMatchesStmt->execute(['id' => $application['permohonan_id']]);

        // Delete from permohonan table
        $deleteStmt = $pdo->prepare("DELETE FROM permohonan WHERE id = :id");
        $deleteStmt->execute(['id' => $application['permohonan_id']]);
    }

    // Also delete matches linked directly to user
    $deleteUserMatchesStmt = $pdo->prepare("DELETE FROM perlawanan WHERE user_id = :id");
    $deleteUserMatchesStmt->execute(['id' => $userId]);

    // Delete user account
    $deleteUserStmt = $pdo->prepare("DELETE FROM users WHERE id = :id");
    $deleteUserStmt->execute(['id' => $userId]);

    // Log activity
    logActivity($pdo, $_SESSION['user_id'], 'delete_referee', 'users', (int) $userId,
        "Pengadil {$application['user_nama']} (User ID: {$userId}) dipadam oleh admin");

    $pdo->commit();

    jsonResponse([
        'error' => false,
        'message' => 'Pengadil berdaftar berjaya dipadam.',
        'referee_name' => $application['user_nama']
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[admin-delete-referee.php] Error: ' . $e->getMessage());
    $message = APP_DEBUG ? 'Ralat semasa memadam pengadil: ' . $e->getMessage() : 'Ralat semasa memadam pengadil.';
    jsonResponse(['error' => true, 'message' => $message], 500);
}

/**
 * Log activity to activity_log table
 */
function logActivity(PDO $pdo, int $userId, string $action, ?string $tableName, ?int $recordId, string $description): void
{
    try {
        $ipAddress = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        $stmt = $pdo->prepare("
            INSERT INTO activity_log (user_id, action, table_name, record_id, description, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ");

        $stmt->execute([$userId, $action, $tableName, $recordId, $description, $ipAddress, $userAgent]);
    } catch (Throwable $e) {
        // Log the error but don't fail the main operation
        error_log('[logActivity] Failed to log activity: ' . $e->getMessage());
    }
}