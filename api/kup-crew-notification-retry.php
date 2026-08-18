<?php
/**
 * Retry queued KUP crew-complete notifications.
 *
 * Suggested cron (every five minutes):
 *   php /path/to/public_html/api/kup-crew-notification-retry.php 100
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => true,
        'message' => 'Skrip retry notifikasi KUP hanya boleh dijalankan melalui CLI.',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit(1);
}

define('SKIP_SESSION', true);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/lantikan-helper.php';

$limit = isset($argv[1]) ? (int) $argv[1] : 100;

try {
    $result = processQueuedKupCrewNotifications($pdo, $limit);
    echo json_encode([
        'error' => false,
        'data' => $result,
        'processed_at' => date(DATE_ATOM),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
    exit($result['errors'] > 0 ? 2 : 0);
} catch (Throwable $error) {
    error_log('[kup-crew-notification-retry.php] ' . $error->getMessage());
    echo json_encode([
        'error' => true,
        'message' => APP_DEBUG ? $error->getMessage() : 'Retry notifikasi KUP gagal.',
        'processed_at' => date(DATE_ATOM),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
    exit(1);
}
