<?php
/**
 * One-time migration: renumber jadual_perlawanan.no_perlawanan to the
 * per-kategori, prefixed scheme (e.g. B12-01) for ALL kejohanan.
 *
 * Existing data was numbered continuously (P001, P002, ...). This script
 * regroups by kategori and renumbers 01..N within each kategori, ordered by
 * (tarikh, masa, id), via renumberNoPerlawanan().
 *
 * Run once from CLI:
 *   php docs/migration_renumber_no_perlawanan.php
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Skrip ini hanya boleh dijalankan dari CLI.\n");
}

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/lantikan-helper.php';

try {
    $pdo = getDbConnection();
    $kejohanan = $pdo->query("SELECT id, nama FROM kejohanan ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);

    $totalKej = 0;
    $totalRows = 0;
    foreach ($kejohanan as $k) {
        $n = renumberNoPerlawanan($pdo, (int) $k['id']);
        $totalKej++;
        $totalRows += $n;
        echo sprintf("[#%d] %s — %d perlawanan dinomborkan semula.\n", $k['id'], $k['nama'], $n);
    }

    echo sprintf("\nSiap. %d kejohanan, %d perlawanan dikemas kini.\n", $totalKej, $totalRows);
} catch (Throwable $e) {
    fwrite(STDERR, "Ralat: " . $e->getMessage() . "\n");
    exit(1);
}
