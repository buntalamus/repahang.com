<?php
require __DIR__ . '/../api/bootstrap.php';
$pdo = getDbConnection();
$rows = $pdo->query('SELECT id, nama, logo_path FROM pasukan')->fetchAll();
foreach ($rows as $r) {
    echo $r['id'] . ' | ' . $r['nama'] . ' | ' . ($r['logo_path'] ?? 'NULL') . PHP_EOL;
}
