<?php

// Bootstrap HTTP response: start session, set JSON headers, handle CORS for Angular dev server.

declare(strict_types=1);

// Set timezone to GMT+8 (Malaysia)
date_default_timezone_set('Asia/Kuala_Lumpur');

// ============================================================
// PHASE 1: Error logging & handlers FIRST (before anything else)
// ============================================================

$logDirectory = __DIR__ . '/../storage/logs';
if (!is_dir($logDirectory)) {
    @mkdir($logDirectory, 0775, true);
}

// Log rotation: jika app.log melebihi 2MB, rename ke app.log.old
$logFile = $logDirectory . '/app.log';
if (file_exists($logFile) && filesize($logFile) > 2 * 1024 * 1024) {
    @rename($logFile, $logDirectory . '/app.log.old');
}

ini_set('log_errors', '1');
ini_set('error_log', $logFile);

// ============================================================
// PHASE 2: Load config
// ============================================================

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/db.php';

// Define APP_DEBUG from .env (defaults to false for production safety)
if (!defined('APP_DEBUG')) {
    define('APP_DEBUG', env('APP_DEBUG', 'false') === 'true');
}

// Define BASE_URL for redirects
define('BASE_URL', env('BASE_URL', 'https://refpahang.com'));

if (APP_DEBUG) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
}

// ============================================================
// PHASE 3: Error handlers
// ============================================================

set_error_handler(static function ($severity, $message, $file, $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(static function (Throwable $e): void {
    $message = sprintf('Uncaught %s [%s:%d]: %s', get_class($e), $e->getFile(), $e->getLine(), $e->getMessage());
    error_log($message);

    if (!headers_sent()) {
        jsonResponse([
            'error' => true,
            'message' => APP_DEBUG ? $message : 'Ralat pelayan dalaman.',
        ], 500);
    }
});

register_shutdown_function(static function () {
    $error = error_get_last();
    if ($error === null) {
        return;
    }

    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($error['type'], $fatalTypes, true)) {
        return;
    }

    $message = sprintf('Fatal error [%s:%d]: %s', $error['file'], $error['line'], $error['message']);
    error_log($message);

    if (!headers_sent()) {
        jsonResponse([
            'error' => true,
            'message' => APP_DEBUG ? $message : 'Ralat pelayan dalaman.',
        ], 500);
    }
});

// ============================================================
// PHASE 4: Database connection (now with proper logging above)
// ============================================================

try {
    $pdo = getDbConnection();
} catch (PDOException $e) {
    // Log detailed diagnostic info when DB fails
    $diagMsg = sprintf(
        "[CRITICAL] Database connection failed: %s | DB_HOST=%s | DB_NAME=%s | DB_USER=%s | config_readable=%s",
        $e->getMessage(),
        defined('DB_HOST') ? DB_HOST : '(undefined)',
        defined('DB_NAME') ? DB_NAME : '(undefined)',
        defined('DB_USER') ? DB_USER : '(undefined)',
        is_readable(__DIR__ . '/../.env') ? '.env' : (is_readable(__DIR__ . '/../config.ini') ? 'config.ini' : 'NONE')
    );
    error_log($diagMsg);

    jsonResponse([
        'error' => true,
        'message' => 'Gagal menyambung ke pangkalan data',
        'detail' => APP_DEBUG ? $e->getMessage() : null
    ], 500);
}

// ============================================================
// PHASE 5: Auto-migration (uses SEPARATE connection to avoid corrupting main $pdo)
// ============================================================

$migrationLock = __DIR__ . '/../storage/.migration_done';
if (!file_exists($migrationLock)) {
    try {
        $migrationDir = __DIR__ . '/../docs';
        $migrationFiles = glob($migrationDir . '/migration_*.sql');
        if ($migrationFiles) {
            // Use SEPARATE connection for migration to avoid unbuffered query issues
            $migrationPdo = getDbConnection();
            foreach ($migrationFiles as $sqlFile) {
                $sql = file_get_contents($sqlFile);
                if ($sql) {
                    $statements = array_filter(array_map('trim', explode(';', $sql)));
                    foreach ($statements as $stmt) {
                        if ($stmt && !str_starts_with($stmt, '--')) {
                            try {
                                $migrationPdo->exec($stmt);
                            } catch (PDOException $migEx) {
                                // Ignore duplicate table/column errors (expected on re-run)
                                $code = $migEx->getCode();
                                if (!in_array($code, ['42S01', '42S21', '42000'])) {
                                    error_log('[bootstrap] Migration statement error: ' . $migEx->getMessage());
                                }
                            }
                        }
                    }
                }
            }
            unset($migrationPdo); // Close migration connection
            @file_put_contents($migrationLock, date('Y-m-d H:i:s') . "\n");
            error_log('[bootstrap] Auto-migration completed');
        }
    } catch (Throwable $e) {
        error_log('[bootstrap] Auto-migration error: ' . $e->getMessage());
    }
}

// ============================================================
// PHASE 6: Session
// ============================================================

// Public endpoints boleh define('SKIP_SESSION', true) sebelum require bootstrap
if (!defined('SKIP_SESSION') || !SKIP_SESSION) {
    if (session_status() === PHP_SESSION_NONE) {
        try {
            session_start([
                'cookie_httponly' => true,
                'cookie_secure' => !APP_DEBUG,
                'cookie_samesite' => 'Lax',
                'use_strict_mode' => true,
                'gc_maxlifetime' => 7200,
            ]);
        } catch (Throwable $e) {
            error_log('Session start failed: ' . $e->getMessage());
            jsonResponse([
                'error' => true,
                'message' => APP_DEBUG ? 'Session error: ' . $e->getMessage() : 'Ralat pelayan dalaman.',
            ], 500);
        }
    }
}

// ============================================================
// PHASE 7: CORS headers
// ============================================================

$allowedOrigins = [
    'https://refpahang.com',
];

if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
} elseif (!isset($_SERVER['HTTP_ORIGIN'])) {
    // Same-origin requests don't send Origin header
    // Allow them by default
    header('Access-Control-Allow-Credentials: true');
}

header('Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ============================================================
// Helper functions
// ============================================================

function jsonResponse(array $payload, int $statusCode = 200): void
{
    header('Content-Type: application/json');
    http_response_code($statusCode);

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($json === false) {
        $errorMessage = json_last_error_msg();
        error_log(sprintf('[bootstrap.php] jsonResponse encode failure: %s', $errorMessage));

        $fallback = json_encode([
            'error' => true,
            'message' => APP_DEBUG ? 'JSON encoding error: ' . $errorMessage : 'Ralat pelayan dalaman.',
        ]);

        echo $fallback !== false ? $fallback : '{"error":true,"message":"Ralat pelayan dalaman."}';
        exit;
    }

    echo $json;
    exit;
}

function requireAdmin(): int
{
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['error' => true, 'message' => 'Sesi tidak sah. Sila log masuk semula.'], 401);
    }

    // Check if user is Admin role
    if ($_SESSION['user_role'] !== 'Admin') {
        jsonResponse(['error' => true, 'message' => 'Akses ditolak. Hanya pentadbir dibenarkan.'], 403);
    }

    return (int) $_SESSION['user_id'];
}

function requireAuth(): array
{
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['error' => true, 'message' => 'Sesi tidak sah. Sila log masuk semula.'], 401);
    }

    return [
        'id' => (int) $_SESSION['user_id'],
        'email' => $_SESSION['user_email'] ?? '',
        'role' => $_SESSION['user_role'] ?? '',
        'persatuan_id' => $_SESSION['persatuan_id'] ?? null,
    ];
}

function requireRole(array $allowedRoles): array
{
    $user = requireAuth();
    
    if (!in_array($user['role'], $allowedRoles, true)) {
        jsonResponse([
            'error' => true, 
            'message' => 'Akses ditolak. Peranan anda tidak dibenarkan untuk aksi ini.'
        ], 403);
    }

    return $user;
}

function getJsonInput(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        return [];
    }

    return $data;
}
