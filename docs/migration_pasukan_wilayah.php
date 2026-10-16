<?php
/** PHP/MySQL counterpart of D1 migration 0020. Run: php docs/migration_pasukan_wilayah.php */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Skrip ini hanya boleh dijalankan dari CLI.\n");
}
require_once __DIR__ . '/../config/db.php';
$pdo = getDbConnection();
foreach (['pasukan_home_daerah', 'pasukan_home_negeri', 'pasukan_away_daerah', 'pasukan_away_negeri'] as $column) {
    $check = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
    $check->execute(['jadual_perlawanan', $column]);
    if (!$check->fetchColumn()) {
        $pdo->exec("ALTER TABLE jadual_perlawanan ADD COLUMN {$column} VARCHAR(255) NOT NULL DEFAULT ''");
    }
}
echo "Medan daerah/negeri pasukan tersedia. Data lama kekal kosong sehingga diisi Admin.\n";
