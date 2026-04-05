<?php
/**
 * Fix Pengadil Label Script
 * Normalizes jenis_pengadil values in users and pengadil_luar tables
 * to proper Title Case format.
 *
 * Usage: php api/fix-pengadil-labels.php [--dry-run]
 *
 * Run with --dry-run first to see what would change without modifying data.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';

$dryRun = in_array('--dry-run', $argv ?? []);

// Canonical label mapping (all known variants → correct form)
$labelMap = [
    // Pengadil Negeri variants
    'PENGADIL NEGERI'     => 'Pengadil Negeri',
    'pengadil negeri'     => 'Pengadil Negeri',
    'Pengadil negeri'     => 'Pengadil Negeri',
    'pengadil Negeri'     => 'Pengadil Negeri',
    'PENGADIL  NEGERI'    => 'Pengadil Negeri',

    // Pengadil Kebangsaan variants
    'PENGADIL KEBANGSAAN'  => 'Pengadil Kebangsaan',
    'pengadil kebangsaan'  => 'Pengadil Kebangsaan',
    'Pengadil kebangsaan'  => 'Pengadil Kebangsaan',

    // Kelas variants
    'KELAS 1'     => 'Kelas 1',
    'kelas 1'     => 'Kelas 1',
    'KELAS 2'     => 'Kelas 2',
    'kelas 2'     => 'Kelas 2',
    'KELAS 3'     => 'Kelas 3',
    'kelas 3'     => 'Kelas 3',

    // Pegawai Pembangunan variants
    'PEGAWAI PEMBANGUNAN'  => 'Pegawai Pembangunan',
    'pegawai pembangunan'  => 'Pegawai Pembangunan',

    // Penilai variants
    'PENILAI PENGADIL'     => 'Penilai Pengadil',
    'penilai pengadil'     => 'Penilai Pengadil',
];

// Build case-insensitive lookup
$ciMap = [];
foreach ($labelMap as $variant => $canonical) {
    $ciMap[mb_strtolower(trim($variant))] = $canonical;
}

try {
    $pdo = getDbConnection();
} catch (Exception $e) {
    echo "ERROR: Gagal bersambung ke pangkalan data: " . $e->getMessage() . "\n";
    exit(1);
}

echo $dryRun ? "=== DRY RUN MODE (tiada perubahan akan dibuat) ===\n\n" : "=== LIVE MODE ===\n\n";

$totalFixed = 0;

// Fix users table
echo "--- Jadual: users ---\n";
$stmt = $pdo->query("SELECT id, nama_penuh, jenis_pengadil FROM users WHERE jenis_pengadil IS NOT NULL AND jenis_pengadil != ''");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($users as $u) {
    $current = trim($u['jenis_pengadil']);
    $key = mb_strtolower($current);

    if (isset($ciMap[$key])) {
        $canonical = $ciMap[$key];
    } else {
        // Auto-fix: convert to Title Case if not in map
        $canonical = mb_convert_case($current, MB_CASE_TITLE, 'UTF-8');
    }

    if ($current !== $canonical) {
        echo "  [users #{$u['id']}] {$u['nama_penuh']}: \"{$current}\" → \"{$canonical}\"\n";
        if (!$dryRun) {
            $upd = $pdo->prepare("UPDATE users SET jenis_pengadil = ? WHERE id = ?");
            $upd->execute([$canonical, $u['id']]);
        }
        $totalFixed++;
    }
}

// Fix pengadil_luar table
echo "\n--- Jadual: pengadil_luar ---\n";
$stmt = $pdo->query("SELECT id, nama, jenis_pengadil FROM pengadil_luar WHERE jenis_pengadil IS NOT NULL AND jenis_pengadil != ''");
$luarList = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($luarList as $pl) {
    $current = trim($pl['jenis_pengadil']);
    $key = mb_strtolower($current);

    if (isset($ciMap[$key])) {
        $canonical = $ciMap[$key];
    } else {
        $canonical = mb_convert_case($current, MB_CASE_TITLE, 'UTF-8');
    }

    if ($current !== $canonical) {
        echo "  [pengadil_luar #{$pl['id']}] {$pl['nama']}: \"{$current}\" → \"{$canonical}\"\n";
        if (!$dryRun) {
            $upd = $pdo->prepare("UPDATE pengadil_luar SET jenis_pengadil = ? WHERE id = ?");
            $upd->execute([$canonical, $pl['id']]);
        }
        $totalFixed++;
    }
}

// Fix pool_pengadil table if it has jenis_pengadil
try {
    $stmt = $pdo->query("SELECT id, jenis_pengadil FROM pool_pengadil WHERE jenis_pengadil IS NOT NULL AND jenis_pengadil != ''");
    $poolList = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($poolList)) {
        echo "\n--- Jadual: pool_pengadil ---\n";
        foreach ($poolList as $pp) {
            $current = trim($pp['jenis_pengadil']);
            $key = mb_strtolower($current);

            if (isset($ciMap[$key])) {
                $canonical = $ciMap[$key];
            } else {
                $canonical = mb_convert_case($current, MB_CASE_TITLE, 'UTF-8');
            }

            if ($current !== $canonical) {
                echo "  [pool_pengadil #{$pp['id']}]: \"{$current}\" → \"{$canonical}\"\n";
                if (!$dryRun) {
                    $upd = $pdo->prepare("UPDATE pool_pengadil SET jenis_pengadil = ? WHERE id = ?");
                    $upd->execute([$canonical, $pp['id']]);
                }
                $totalFixed++;
            }
        }
    }
} catch (Exception $e) {
    // pool_pengadil may not have jenis_pengadil column
}

echo "\n=== Selesai. $totalFixed label" . ($dryRun ? ' akan' : '') . " diperbetulkan. ===\n";
