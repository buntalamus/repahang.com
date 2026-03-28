<?php
/**
 * RefPahang API Version
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

// Version Control
$version = [
    'version' => '1.1.0', // Major.Minor.Patch
    'build_date' => date('Y-m-d H:i:s'), // Current build date
    'environment' => APP_DEBUG ? 'development' : 'production',
    'api_status' => 'stable'
];

jsonResponse([
    'error' => false,
    'data' => $version
]);
