<?php
// Quick debug - DELETE after troubleshooting!
require_once __DIR__ . '/bootstrap.php';
requireAdmin();

error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "<h3>PHP Info</h3>";
echo "PHP Version: " . phpversion() . "<br>";
echo "Server: " . ($_SERVER['SERVER_SOFTWARE'] ?? 'unknown') . "<br>";
echo "Loaded php.ini: " . php_ini_loaded_file() . "<br>";
echo "Additional ini: " . php_ini_scanned_files() . "<br>";
echo "PDO loaded: " . (extension_loaded('pdo') ? 'YES' : 'NO') . "<br>";
echo "PDO_MySQL loaded: " . (extension_loaded('pdo_mysql') ? 'YES' : 'NO') . "<br>";
echo "MySQLi loaded: " . (extension_loaded('mysqli') ? 'YES' : 'NO') . "<br>";
echo "All extensions: " . implode(', ', get_loaded_extensions()) . "<br>";

echo "<h3>Local ini files</h3>";
$iniFiles = [
    __DIR__ . '/php.ini', __DIR__ . '/.user.ini',
    __DIR__ . '/../php.ini', __DIR__ . '/../.user.ini',
];
foreach ($iniFiles as $ini) {
    echo basename(dirname($ini)) . '/' . basename($ini) . ': ' . (file_exists($ini) ? 'EXISTS' : 'no') . "<br>";
}

echo "<h3>File Permissions</h3>";
$files = [
    __DIR__ . '/.htaccess',
    __DIR__ . '/bootstrap.php',
    __DIR__ . '/session.php',
    __DIR__ . '/../.env',
    __DIR__ . '/../config/env.php',
    __DIR__ . '/../config/db.php',
];
foreach ($files as $f) {
    $exists = file_exists($f) ? 'YES' : 'NO';
    $perms = file_exists($f) ? substr(sprintf('%o', fileperms($f)), -4) : 'N/A';
    $readable = is_readable($f) ? 'YES' : 'NO';
    echo basename($f) . " — exists: $exists, perms: $perms, readable: $readable<br>";
}

echo "<h3>Directory Permissions</h3>";
$dirs = [__DIR__, __DIR__ . '/../config', __DIR__ . '/../includes', __DIR__ . '/../storage'];
foreach ($dirs as $d) {
    $perms = is_dir($d) ? substr(sprintf('%o', fileperms($d)), -4) : 'N/A';
    echo basename($d) . "/ — perms: $perms<br>";
}

echo "<h3>Extension Path Info</h3>";
echo "extension_dir: " . ini_get('extension_dir') . "<br>";
$extDir = ini_get('extension_dir');
$soFiles = ['pdo.so', 'pdo_mysql.so', 'mysqli.so', 'mysqlnd.so', 'nd_pdo_mysql.so'];
foreach ($soFiles as $so) {
    $path = $extDir . '/' . $so;
    echo "$so: " . (file_exists($path) ? 'EXISTS' : 'NOT FOUND') . "<br>";
}

echo "<h3>PHP ini_get checks</h3>";
$iniKeys = ['extension_dir', 'extension', 'scan_this_dir_for_additional_ini_files'];
// Check if scan dir is configured
echo "PHP_INI_SCAN_DIR: " . (getenv('PHP_INI_SCAN_DIR') ?: '(not set)') . "<br>";
echo "open_basedir: " . (ini_get('open_basedir') ?: '(none)') . "<br>";

// Check CloudLinux/alt-php paths
$altIniDirs = [
    '/opt/alt/php83/etc/php.d',
    '/opt/alt/php83/etc/php.d.all',
    '/opt/cpanel/ea-php83/root/etc/php.d',
];
echo "<h3>Alt PHP ini directories</h3>";
foreach ($altIniDirs as $d) {
    if (is_dir($d)) {
        echo "$d: EXISTS<br>";
        $iniFiles = glob($d . '/*.ini');
        if ($iniFiles) {
            foreach ($iniFiles as $f) {
                $content = @file_get_contents($f);
                if ($content && (stripos($content, 'pdo') !== false || stripos($content, 'mysql') !== false)) {
                    echo "  " . basename($f) . ": " . trim($content) . "<br>";
                }
            }
        } else {
            echo "  (no ini files)<br>";
        }
    } else {
        echo "$d: NOT FOUND<br>";
    }
}

// Try manual load
echo "<h3>Manual dl() test</h3>";
if (function_exists('dl')) {
    echo "dl() available: YES<br>";
} else {
    echo "dl() available: NO (disabled)<br>";
}

echo "<h3>DB Test</h3>";
try {
    require_once __DIR__ . '/../config/env.php';
    require_once __DIR__ . '/../config/db.php';
    $pdo = getDbConnection();
    echo "DB connection: OK<br>";
} catch (Throwable $e) {
    echo "DB error: " . $e->getMessage() . "<br>";
}
