<?php
/**
 * Migration: Create pasukan table for team management per kejohanan
 * Run: php docs/db-migrate-pasukan.php
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/bootstrap.php';

$pdo = getDbConnection();

$steps = [];

// 1. Create pasukan table
$tables = $pdo->query("SHOW TABLES LIKE 'pasukan'")->fetchAll();
if (empty($tables)) {
    $pdo->exec("
        CREATE TABLE pasukan (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            kejohanan_id INT NOT NULL,
            nama        VARCHAR(255) NOT NULL,
            kod         VARCHAR(20)  NULL COMMENT 'Kod pendek pasukan, cth: PAH, KL, SEL',
            kumpulan    VARCHAR(20)  NULL COMMENT 'Kumpulan, cth: A, B, C atau kosong',
            logo_path   VARCHAR(255) NULL,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_pasukan_kejohanan
                FOREIGN KEY (kejohanan_id) REFERENCES kejohanan(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $steps[] = "✓ Jadual 'pasukan' dicipta.";
} else {
    $steps[] = "- Jadual 'pasukan' sudah wujud, langkau.";
}

// 2. Create logo uploads folder
$logoDir = __DIR__ . '/../uploads/logos';
if (!is_dir($logoDir)) {
    mkdir($logoDir, 0755, true);
    $steps[] = "✓ Folder uploads/logos/ dicipta.";
} else {
    $steps[] = "- Folder uploads/logos/ sudah wujud, langkau.";
}

echo implode("\n", $steps) . "\n";
echo "\nSelesai.\n";
