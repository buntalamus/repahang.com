<?php

/**
 * Connection Pool Diagnostic
 * Access: https://refpahang.com/api/connection-debug.php
 * Shows MySQL connections, PHP-FPM status, potential leaks
 */

declare(strict_types=1);

// Don't start session, just connect directly
define('SKIP_SESSION', true);
require_once __DIR__ . '/bootstrap.php';

$output = [
    'timestamp' => date('Y-m-d H:i:s'),
    'mysql_info' => [],
    'connection_info' => [],
    'php_info' => [],
];

try {
    // Get MySQL variables
    $vars = $pdo->query("SHOW VARIABLES LIKE 'max_connections'")->fetchAll();
    $output['mysql_info']['max_connections'] = $vars[0]['Value'] ?? 'unknown';

    $vars = $pdo->query("SHOW VARIABLES LIKE 'interactive_timeout'")->fetchAll();
    $output['mysql_info']['interactive_timeout'] = $vars[0]['Value'] ?? 'unknown';

    $vars = $pdo->query("SHOW VARIABLES LIKE 'wait_timeout'")->fetchAll();
    $output['mysql_info']['wait_timeout'] = $vars[0]['Value'] ?? 'unknown';

    // Get current connection count
    $result = $pdo->query("SHOW PROCESSLIST")->fetchAll();
    $output['connection_info']['total_connections'] = count($result);
    $output['connection_info']['connections_by_state'] = [];

    foreach ($result as $conn) {
        $state = $conn['Command'] ?? 'unknown';
        $output['connection_info']['connections_by_state'][$state] =
            ($output['connection_info']['connections_by_state'][$state] ?? 0) + 1;
    }

    // Get status
    $status = $pdo->query("SHOW STATUS LIKE 'Threads%'")->fetchAll();
    foreach ($status as $row) {
        $output['mysql_info'][$row['Variable_name']] = $row['Value'];
    }

    // PHP info
    $output['php_info']['version'] = phpversion();
    $output['php_info']['pdo_loaded'] = extension_loaded('pdo') ? 'YES' : 'NO';
    $output['php_info']['pdo_mysql'] = extension_loaded('pdo_mysql') ? 'YES' : 'NO';
    $output['php_info']['memory_limit'] = ini_get('memory_limit');
    $output['php_info']['max_execution_time'] = ini_get('max_execution_time');

    // Check migration lock
    $lockFile = __DIR__ . '/../storage/.migration_done';
    $output['system']['migration_lock_exists'] = file_exists($lockFile) ? 'YES' : 'NO';
    if (file_exists($lockFile)) {
        $output['system']['migration_lock_content'] = file_get_contents($lockFile);
    }

    // Check storage directory
    $storageDir = __DIR__ . '/../storage';
    $output['system']['storage_dir_writable'] = is_writable($storageDir) ? 'YES' : 'NO';

    jsonResponse(['error' => false, 'data' => $output], 200);

} catch (Throwable $e) {
    jsonResponse([
        'error' => true,
        'message' => $e->getMessage(),
        'partial_data' => $output
    ], 500);
}
