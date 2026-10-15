<?php

/**
 * Admin Delete Referee API
 * DELETE: Deactivate a referee account while retaining all history.
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

    if (!filter_var($userId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) {
        jsonResponse(['error' => true, 'message' => 'ID pengguna diperlukan.'], 422);
    }

    $pdo = getDbConnection();

    // This endpoint acts on an account. Annual application deletion uses
    // admin-applications.php and must never delete match history.
    $stmt = $pdo->prepare("
        SELECT nama_penuh, aktif FROM users
        WHERE id = :id AND role = 'Pengadil'
        LIMIT 1
    ");
    $stmt->execute(['id' => $userId]);
    $referee = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$referee) {
        jsonResponse(['error' => true, 'message' => 'Pengadil tidak dijumpai.'], 404);
    }

    $pdo->beginTransaction();

    $pdo->prepare("UPDATE users SET aktif = 0 WHERE id = :id AND role = 'Pengadil'")
        ->execute(['id' => $userId]);

    // Log activity
    logActivity($pdo, $_SESSION['user_id'], 'deactivate_referee', 'users', (int) $userId,
        "Akaun pengadil {$referee['nama_penuh']} (User ID: {$userId}) dinyahaktifkan; sejarah dikekalkan.");

    $pdo->commit();

    jsonResponse([
        'error' => false,
        'message' => 'Akaun pengadil dinyahaktifkan. Semua sejarah perlawanan dikekalkan.',
        'referee_name' => $referee['nama_penuh']
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
