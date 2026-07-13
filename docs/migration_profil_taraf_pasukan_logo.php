<?php
/**
 * One-time migration:
 *   1. users: tambah kolum tahun_mohon_kelas3, tahun_lulus_kelas3 (auto-isi
 *      dari permohonan Kelas 3 FAM dalam sistem)
 *   2. users: tambah kolum taraf pengadil_kebangsaan / pengadil_negeri /
 *      pengadil_daerah (toggle admin, boleh lebih dari satu)
 *   3. Cipta jadual pasukan_logo (registri logo global ikut nama pasukan)
 *      + backfill dari logo sedia ada dalam jadual_perlawanan
 *      + isi logo yang masih kosong dari registri
 *
 * Run once from CLI:
 *   php docs/migration_profil_taraf_pasukan_logo.php
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Skrip ini hanya boleh dijalankan dari CLI.\n");
}

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/pasukan-logo-helper.php';

function columnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c
    ");
    $stmt->execute([':t' => $table, ':c' => $column]);
    return (bool) $stmt->fetchColumn();
}

try {
    $pdo = getDbConnection();

    // ── 1. Kolum tahun Kelas 3 FAM ─────────────────────────────────────────
    foreach (['tahun_mohon_kelas3', 'tahun_lulus_kelas3'] as $col) {
        if (!columnExists($pdo, 'users', $col)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN {$col} YEAR NULL DEFAULT NULL");
            echo "Kolum users.{$col} ditambah.\n";
        } else {
            echo "Kolum users.{$col} sudah wujud — langkau.\n";
        }
    }

    // Backfill tahun mohon: tahun permohonan Kelas 3 terawal (apa-apa status)
    $n = $pdo->exec("
        UPDATE users u
        JOIN (
            SELECT user_id, MIN(tahun_permohonan) AS tahun
            FROM permohonan
            WHERE jenis_borang IN ('kelas3_fam', 'ujian_bertulis')
            GROUP BY user_id
        ) t ON t.user_id = u.id
        SET u.tahun_mohon_kelas3 = t.tahun
        WHERE u.tahun_mohon_kelas3 IS NULL
    ");
    echo "Backfill tahun_mohon_kelas3: {$n} pengguna.\n";

    // Backfill tahun lulus: keputusan ujian 'Lulus', atau workflow lengkap (legacy)
    $n = $pdo->exec("
        UPDATE users u
        JOIN (
            SELECT user_id, MAX(tahun_permohonan) AS tahun
            FROM permohonan
            WHERE jenis_borang IN ('kelas3_fam', 'ujian_bertulis')
              AND (status_ujian = 'Lulus'
                   OR (jenis_borang = 'ujian_bertulis'
                       AND status_workflow IN ('Lengkap', 'Admin Diluluskan', 'Bayaran Diterima')))
            GROUP BY user_id
        ) t ON t.user_id = u.id
        SET u.tahun_lulus_kelas3 = t.tahun
        WHERE u.tahun_lulus_kelas3 IS NULL
    ");
    echo "Backfill tahun_lulus_kelas3: {$n} pengguna.\n";

    // ── 2. Kolum taraf pengadil ────────────────────────────────────────────
    foreach (['pengadil_kebangsaan', 'pengadil_negeri', 'pengadil_daerah'] as $col) {
        if (!columnExists($pdo, 'users', $col)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN {$col} TINYINT(1) NOT NULL DEFAULT 0");
            echo "Kolum users.{$col} ditambah.\n";
        } else {
            echo "Kolum users.{$col} sudah wujud — langkau.\n";
        }
    }

    // Backfill dari label jenis_pengadil sedia ada
    $n = $pdo->exec("UPDATE users SET pengadil_kebangsaan = 1 WHERE jenis_pengadil = 'Pengadil Kebangsaan' AND pengadil_kebangsaan = 0");
    echo "Backfill pengadil_kebangsaan: {$n} pengguna.\n";
    $n = $pdo->exec("UPDATE users SET pengadil_negeri = 1 WHERE jenis_pengadil = 'Pengadil Negeri' AND pengadil_negeri = 0");
    echo "Backfill pengadil_negeri: {$n} pengguna.\n";

    // ── 3. Registri logo pasukan ───────────────────────────────────────────
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pasukan_logo (
            id INT NOT NULL AUTO_INCREMENT,
            nama VARCHAR(255) NOT NULL,
            logo_path VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_nama (nama)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "Jadual pasukan_logo sedia.\n";

    // Backfill registri dari logo sedia ada (ambil yang terkini per nama pasukan)
    $n = $pdo->exec("
        INSERT INTO pasukan_logo (nama, logo_path)
        SELECT t.nama, t.logo_path FROM (
            SELECT pasukan_home AS nama,
                   SUBSTRING_INDEX(GROUP_CONCAT(logo_home ORDER BY id DESC SEPARATOR '||'), '||', 1) AS logo_path
            FROM jadual_perlawanan
            WHERE pasukan_home IS NOT NULL AND pasukan_home <> ''
              AND logo_home IS NOT NULL AND logo_home <> ''
            GROUP BY pasukan_home
            UNION ALL
            SELECT pasukan_away,
                   SUBSTRING_INDEX(GROUP_CONCAT(logo_away ORDER BY id DESC SEPARATOR '||'), '||', 1)
            FROM jadual_perlawanan
            WHERE pasukan_away IS NOT NULL AND pasukan_away <> ''
              AND logo_away IS NOT NULL AND logo_away <> ''
            GROUP BY pasukan_away
        ) t
        ON DUPLICATE KEY UPDATE logo_path = pasukan_logo.logo_path
    ");
    echo "Backfill registri pasukan_logo: {$n} baris.\n";

    // Isi logo yang masih kosong pada perlawanan sedia ada
    $n = isiLogoDariRegistri($pdo);
    echo "Isi logo perlawanan dari registri: {$n} baris dikemaskini.\n";

    echo "\nSiap.\n";
} catch (Throwable $e) {
    fwrite(STDERR, "Ralat: " . $e->getMessage() . "\n");
    exit(1);
}
