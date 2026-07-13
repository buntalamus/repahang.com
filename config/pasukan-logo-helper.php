<?php
/**
 * Shared helper: registri logo pasukan.
 *
 * Logo dipadankan mengikut NAMA pasukan (case-insensitive, collation DB).
 * Muat naik sekali → logo digunakan untuk semua perlawanan (sedia ada dan
 * akan datang) yang mempunyai nama pasukan yang sama.
 *
 * Called from:
 *   - api/jadual-perlawanan.php  (upload logo, create/update perlawanan)
 *   - api/jadual-upload.php      (import Excel pukal)
 */

declare(strict_types=1);

/**
 * Simpan/kemaskini logo untuk satu nama pasukan dalam registri, kemudian
 * padankan ke SEMUA perlawanan (kolum home dan away) dengan nama sama.
 *
 * @return int Bilangan baris jadual_perlawanan yang dikemaskini
 */
function simpanDanPadanLogoPasukan(PDO $pdo, string $namaPasukan, string $logoPath): int
{
    $nama = trim($namaPasukan);
    if ($nama === '' || $logoPath === '') {
        return 0;
    }

    $pdo->prepare("
        INSERT INTO pasukan_logo (nama, logo_path)
        VALUES (:nama, :path)
        ON DUPLICATE KEY UPDATE logo_path = VALUES(logo_path)
    ")->execute([':nama' => $nama, ':path' => $logoPath]);

    $updHome = $pdo->prepare("UPDATE jadual_perlawanan SET logo_home = :path WHERE pasukan_home = :nama");
    $updHome->execute([':path' => $logoPath, ':nama' => $nama]);
    $count = $updHome->rowCount();

    $updAway = $pdo->prepare("UPDATE jadual_perlawanan SET logo_away = :path WHERE pasukan_away = :nama");
    $updAway->execute([':path' => $logoPath, ':nama' => $nama]);
    $count += $updAway->rowCount();

    return $count;
}

/**
 * Isi logo yang masih kosong dari registri pasukan_logo, dipadankan
 * mengikut nama pasukan. Skop pilihan: satu kejohanan atau satu perlawanan.
 *
 * @return int Bilangan baris yang dikemaskini
 */
function isiLogoDariRegistri(PDO $pdo, ?int $kejohananId = null, ?int $jadualId = null): int
{
    $scope  = '';
    $params = [];
    if ($jadualId !== null) {
        $scope = ' AND jp.id = :jid';
        $params[':jid'] = $jadualId;
    } elseif ($kejohananId !== null) {
        $scope = ' AND jp.kejohanan_id = :kid';
        $params[':kid'] = $kejohananId;
    }

    $updHome = $pdo->prepare("
        UPDATE jadual_perlawanan jp
        JOIN pasukan_logo plg ON plg.nama = jp.pasukan_home
        SET jp.logo_home = plg.logo_path
        WHERE (jp.logo_home IS NULL OR jp.logo_home = '' OR jp.logo_home <> plg.logo_path)
        {$scope}
    ");
    $updHome->execute($params);
    $count = $updHome->rowCount();

    $updAway = $pdo->prepare("
        UPDATE jadual_perlawanan jp
        JOIN pasukan_logo plg ON plg.nama = jp.pasukan_away
        SET jp.logo_away = plg.logo_path
        WHERE (jp.logo_away IS NULL OR jp.logo_away = '' OR jp.logo_away <> plg.logo_path)
        {$scope}
    ");
    $updAway->execute($params);
    $count += $updAway->rowCount();

    return $count;
}
