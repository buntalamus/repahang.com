<?php

/**
 * Sambungan pangkalan data MySQL untuk Sistem Pendaftaran Pengadil Pahang.
 * Gunakan semula fungsi getDbConnection() di setiap endpoint PHP.
 * Kelayakan dimuatkan daripada fail .env.
 */

declare(strict_types=1);

require_once __DIR__ . '/env.php';

if (!defined('DB_HOST')) {
    define('DB_HOST', env('DB_HOST', 'localhost'));
    define('DB_USER', env('DB_USER', 'root'));
    define('DB_PASS', env('DB_PASS', ''));
    define('DB_NAME', env('DB_NAME', 'refpahang'));
    define('DB_PORT', (int) env('DB_PORT', '3306'));
}

/**
 * @return PDO
 * @throws PDOException apabila sambungan gagal.
 */
function getDbConnection(): PDO
{
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_PERSISTENT => false,
    ];

    return new PDO($dsn, DB_USER, DB_PASS, $options);
}

