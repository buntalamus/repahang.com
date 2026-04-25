<?php
/**
 * Database-focused diagnostic - v2
 * DELETE after use!
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');
set_time_limit(15);
header('Content-Type: text/plain; charset=utf-8');

echo "=== DB Diagnostic v2 ===\n";
echo "Time: " . date('Y-m-d H:i:s') . " | PHP: " . PHP_VERSION . "\n\n";

// Check PDO extension
echo "PDO extension loaded: " . (extension_loaded('pdo') ? 'YES' : 'NO') . "\n";
echo "PDO MySQL driver: " . (extension_loaded('pdo_mysql') ? 'YES' : 'NO') . "\n";
echo "MySQLi extension: " . (extension_loaded('mysqli') ? 'YES' : 'NO') . "\n\n";

// Load config manually
$root = dirname(__DIR__);
$configData = [];
foreach (['.env', 'config.ini'] as $cf) {
    $cfPath = $root . '/' . $cf;
    if (is_readable($cfPath)) {
        $lines = @file($cfPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines) {
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') continue;
                if (strpos($line, '=') !== false) {
                    [$key, $val] = explode('=', $line, 2);
                    $configData[trim($key)] = trim($val);
                }
            }
            echo "Config: $cf (loaded " . count($configData) . " keys)\n";
            break;
        }
    }
}

$host = $configData['DB_HOST'] ?? 'localhost';
$name = $configData['DB_NAME'] ?? '';
$user = $configData['DB_USER'] ?? '';
$pass = $configData['DB_PASS'] ?? '';
$port = $configData['DB_PORT'] ?? '3306';

echo "DB_HOST=$host | DB_NAME=$name | DB_USER=$user | DB_PORT=$port\n";
echo "DB_PASS length=" . strlen($pass) . " chars\n\n";

// Test 1: MySQLi (simpler, less likely to hang)
echo "--- TEST 1: MySQLi connect ---\n";
if (extension_loaded('mysqli')) {
    $start = microtime(true);
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    try {
        $mysqli = new mysqli($host, $user, $pass, $name, (int)$port);
        $elapsed = round((microtime(true) - $start) * 1000);
        echo "RESULT: SUCCESS ({$elapsed}ms)\n";
        echo "Server: " . $mysqli->server_info . "\n";
        echo "Host info: " . $mysqli->host_info . "\n";
        
        // Check processlist to see connection count
        $result = $mysqli->query("SHOW STATUS LIKE 'Threads_connected'");
        if ($row = $result->fetch_assoc()) {
            echo "Active connections: " . $row['Value'] . "\n";
        }
        
        $result = $mysqli->query("SHOW VARIABLES LIKE 'max_connections'");
        if ($row = $result->fetch_assoc()) {
            echo "Max connections: " . $row['Value'] . "\n";
        }

        // Check wait_timeout
        $result = $mysqli->query("SHOW VARIABLES LIKE 'wait_timeout'");
        if ($row = $result->fetch_assoc()) {
            echo "Wait timeout: " . $row['Value'] . "s\n";
        }
        
        $mysqli->close();
    } catch (Throwable $e) {
        $elapsed = round((microtime(true) - $start) * 1000);
        echo "RESULT: FAILED ({$elapsed}ms)\n";
        echo "Error: [" . $e->getCode() . "] " . $e->getMessage() . "\n";
    }
} else {
    echo "MySQLi not available\n";
}

// Test 2: PDO
echo "\n--- TEST 2: PDO connect ---\n";
if (extension_loaded('pdo_mysql')) {
    $start = microtime(true);
    try {
        $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
        echo "DSN: $dsn\n";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        $elapsed = round((microtime(true) - $start) * 1000);
        echo "RESULT: SUCCESS ({$elapsed}ms)\n";
        $ver = $pdo->query('SELECT VERSION()')->fetchColumn();
        echo "MySQL version: $ver\n";
        $pdo = null;
    } catch (PDOException $e) {
        $elapsed = round((microtime(true) - $start) * 1000);
        echo "RESULT: FAILED ({$elapsed}ms)\n";
        echo "Error: [" . $e->getCode() . "] " . $e->getMessage() . "\n";
    }
} else {
    echo "PDO MySQL not available\n";
}

// Test 3: Check app error log
echo "\n--- RECENT APP LOG (last 30 lines) ---\n";
$logPath = $root . '/storage/logs/app.log';
if (is_readable($logPath)) {
    $size = filesize($logPath);
    echo "Log size: " . round($size/1024, 1) . " KB\n";
    $lines = file($logPath);
    $recent = array_slice($lines, -30);
    foreach ($recent as $line) {
        echo rtrim($line) . "\n";
    }
} else {
    echo "(not readable)\n";
}

// Test 4: Check PHP error log
echo "\n--- PHP ERROR LOG (last 15 lines) ---\n";
$phpLog = ini_get('error_log');
echo "Path: " . ($phpLog ?: 'default') . "\n";
if ($phpLog && is_readable($phpLog)) {
    $lines = file($phpLog);
    $recent = array_slice($lines, -15);
    foreach ($recent as $line) {
        echo rtrim($line) . "\n";
    }
} elseif (!$phpLog) {
    // Try common locations
    $commonLogs = [
        $root . '/error_log',
        $root . '/../error_log',
        '/tmp/php_errors.log',
    ];
    foreach ($commonLogs as $cl) {
        if (is_readable($cl)) {
            echo "Found at: $cl\n";
            $lines = file($cl);
            $recent = array_slice($lines, -15);
            foreach ($recent as $line) {
                echo rtrim($line) . "\n";
            }
            break;
        }
    }
}

// Test 5: Try to include bootstrap and see what happens
echo "\n--- BOOTSTRAP INCLUDE TEST ---\n";
echo "Attempting to include config/env.php... ";
try {
    // Don't re-include if already loaded
    if (!function_exists('env')) {
        require_once $root . '/config/env.php';
    }
    echo "OK\n";
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}

echo "Attempting to include config/db.php... ";
try {
    if (!function_exists('getDbConnection')) {
        require_once $root . '/config/db.php';
    }
    echo "OK\n";
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}

echo "\n=== END v2 ===\n";
