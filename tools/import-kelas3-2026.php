<?php

/**
 * Import Kelas III FAM 2026 - Permohonan Offline
 *
 * Script ini mengimport senarai pemohon ujian Kelas III FAM 2026 yang
 * mendaftar secara offline (Google Form) ke dalam sistem.
 *
 * Setiap pemohon akan:
 *  - Dibuat akaun pengguna baru (role: Pengadil)
 *  - Dibuat rekod permohonan (status: Menunggu Admin / keputusan ujian)
 *  - Dihantar emel dengan ID dan kata laluan
 *
 * Cara guna (jalankan dari root projek):
 *   php tools/import-kelas3-2026.php
 *   php tools/import-kelas3-2026.php --dry-run   (simulasi, tiada insert/emel)
 *   php tools/import-kelas3-2026.php --no-email   (import tanpa hantar emel)
 *
 * Fail CSV: tools/kelas3_import.csv
 */

declare(strict_types=1);

// ── Bootstrap ────────────────────────────────────────────────────────────────
chdir(__DIR__ . '/..');
require_once 'config/env.php';
require_once 'config/db.php';
require_once 'config/email.php';

date_default_timezone_set('Asia/Kuala_Lumpur');

// ── Argumen ──────────────────────────────────────────────────────────────────
$dryRun   = in_array('--dry-run',  $argv ?? [], true);
$noEmail  = in_array('--no-email', $argv ?? [], true);

if ($dryRun) {
    echo "[DRY-RUN] Simulasi sahaja — tiada data akan disimpan atau emel dihantar.\n\n";
}

// ── Mapping daerah → district_id & persatuan_id ───────────────────────────────
$daerahMap = [
    'BENTONG'        => ['district_id' => 1,  'persatuan_id' => 1,  'persatuan_nama' => 'Persatuan Bolasepak Daerah Bentong'],
    'BERA'           => ['district_id' => 2,  'persatuan_id' => 2,  'persatuan_nama' => 'Persatuan Bolasepak Daerah Bera'],
    'CAMERON HIGHLANDS' => ['district_id' => 3, 'persatuan_id' => 3, 'persatuan_nama' => 'Persatuan Bolasepak Daerah Cameron Highlands'],
    'JERANTUT'       => ['district_id' => 4,  'persatuan_id' => 4,  'persatuan_nama' => 'Persatuan Bolasepak Daerah Jerantut'],
    'KUANTAN'        => ['district_id' => 5,  'persatuan_id' => 5,  'persatuan_nama' => 'Persatuan Bolasepak Daerah Kuantan'],
    'LIPIS'          => ['district_id' => 6,  'persatuan_id' => 6,  'persatuan_nama' => 'Persatuan Bolasepak Daerah Lipis'],
    'MARAN'          => ['district_id' => 7,  'persatuan_id' => 7,  'persatuan_nama' => 'Persatuan Bolasepak Daerah Maran'],
    'PEKAN'          => ['district_id' => 8,  'persatuan_id' => 8,  'persatuan_nama' => 'Persatuan Bolasepak Daerah Pekan'],
    'RAUB'           => ['district_id' => 9,  'persatuan_id' => 9,  'persatuan_nama' => 'Persatuan Bolasepak Daerah Raub'],
    'ROMPIN'         => ['district_id' => 10, 'persatuan_id' => 10, 'persatuan_nama' => 'Persatuan Bolasepak Daerah Rompin'],
    'TEMERLOH'       => ['district_id' => 11, 'persatuan_id' => 11, 'persatuan_nama' => 'Persatuan Bolasepak Daerah Temerloh'],
    'MUADZAM SHAH'   => ['district_id' => 12, 'persatuan_id' => 12, 'persatuan_nama' => 'Persatuan Bolasepak Daerah Muadzam Shah'],
];

// ── Baca CSV ─────────────────────────────────────────────────────────────────
$csvFile = __DIR__ . '/kelas3_import.csv';
if (!file_exists($csvFile)) {
    die("RALAT: Fail CSV tidak dijumpai: {$csvFile}\n");
}

$handle = fopen($csvFile, 'r');
$headers = fgetcsv($handle); // skip header row

$rows = [];
while (($row = fgetcsv($handle)) !== false) {
    if (count($row) < 17) continue;
    $rows[] = array_combine($headers, $row);
}
fclose($handle);

echo "Jumlah rekod dalam CSV: " . count($rows) . "\n\n";

// ── Sambung DB ───────────────────────────────────────────────────────────────
try {
    $pdo = getDbConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    die("RALAT DB: " . $e->getMessage() . "\n");
}

// ── Proses setiap baris ───────────────────────────────────────────────────────
$stats = ['berjaya' => 0, 'langkau_ic' => 0, 'langkau_emel' => 0, 'gagal' => 0];
$log   = [];

foreach ($rows as $i => $r) {
    $baris = $i + 2; // baris dalam CSV (bermula dari 2)

    $nama       = trim(strtoupper($r['nama_penuh']));
    $noIc       = preg_replace('/\D/', '', trim($r['no_ic']));
    $emel       = strtolower(trim($r['emel']));
    $noTel      = preg_replace('/[\s\-()]/', '', trim($r['no_telefon']));
    $jantina    = strtoupper(trim($r['jantina'])) ?: 'LELAKI';
    $umur       = (int)($r['umur'] ?: 0) ?: null;
    $daerahKey  = strtoupper(trim($r['daerah']));
    $alamat     = trim($r['alamat']);
    $statusKerja = trim($r['status_kerja']);
    $jawatan    = trim($r['jawatan']);
    $namaMajikan = trim($r['nama_majikan']);
    $alamatMajikan = trim($r['alamat_majikan']);
    $namaWaris  = trim($r['nama_waris']);
    $hubungan   = trim($r['hubungan_waris']);
    $telWaris   = preg_replace('/[\s\-()]/', '', trim($r['tel_waris']));
    $peperiksaan = trim($r['peperiksaan']);
    $urlResit   = trim($r['url_resit']);

    // Map daerah
    $daerahInfo = $daerahMap[$daerahKey] ?? null;
    $districtId  = $daerahInfo['district_id'] ?? null;
    $persatuanId = $daerahInfo['persatuan_id'] ?? null;
    $persatuanNama = $daerahInfo['persatuan_nama'] ?? $daerahKey;

    echo "Baris {$baris}: {$nama} ({$emel}) ... ";

    // ── Semak duplikasi IC ──────────────────────────────────────────────────
    $st = $pdo->prepare("SELECT id, nama_penuh FROM users WHERE no_ic = ?");
    $st->execute([$noIc]);
    if ($existing = $st->fetch(PDO::FETCH_ASSOC)) {
        echo "LANGKAU — IC sudah wujud (user_id: {$existing['id']}, {$existing['nama_penuh']})\n";
        $stats['langkau_ic']++;
        $log[] = "LANGKAU IC | {$nama} | {$emel} | IC: {$noIc} | Wujud sebagai user #{$existing['id']}";
        continue;
    }

    // ── Semak duplikasi emel ────────────────────────────────────────────────
    $st = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $st->execute([$emel]);
    if ($existing = $st->fetch(PDO::FETCH_ASSOC)) {
        echo "LANGKAU — Emel sudah wujud (user_id: {$existing['id']})\n";
        $stats['langkau_emel']++;
        $log[] = "LANGKAU EMEL | {$nama} | {$emel} | Wujud sebagai user #{$existing['id']}";
        continue;
    }

    // ── Jana kata laluan rawak ──────────────────────────────────────────────
    $chars    = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $password = '';
    $max      = strlen($chars) - 1;
    for ($k = 0; $k < 10; $k++) {
        $password .= $chars[random_int(0, $max)];
    }
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    if ($dryRun) {
        echo "OK (dry-run) — Kata laluan: {$password}\n";
        $stats['berjaya']++;
        $log[] = "DRY-RUN | {$nama} | {$emel} | PW: {$password}";
        continue;
    }

    try {
        $pdo->beginTransaction();

        // ── Insert users ────────────────────────────────────────────────────
        $tgToken = bin2hex(random_bytes(16));
        $st = $pdo->prepare("
            INSERT INTO users (
                email, password, role, district_id, persatuan_id,
                nama_penuh, no_ic, no_telefon, jantina,
                jenis_pengadil, alamat1, daerah, negeri,
                status_kerja, jawatan, nama_majikan, alamat_majikan1,
                nama_waris, hubungan_waris, telefon_waris,
                umur, aktif, password_changed, tg_link_token, created_at
            ) VALUES (
                ?, ?, 'Pengadil', ?, ?,
                ?, ?, ?, ?,
                'Kelas III FAM', ?, ?, 'Pahang',
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, 1, 0, ?, NOW()
            )
        ");
        $st->execute([
            $emel, $hashedPassword, $districtId, $persatuanId,
            $nama, $noIc, $noTel, $jantina,
            $alamat, ucfirst(strtolower($daerahKey)),
            $statusKerja, $jawatan, $namaMajikan, $alamatMajikan,
            $namaWaris, $hubungan, $telWaris,
            $umur, $tgToken,
        ]);
        $userId = (int) $pdo->lastInsertId();

        // ── Insert permohonan ───────────────────────────────────────────────
        // jenis_permohonan  = 'kelas3_fam'
        // jenis_borang      = 'kelas3_fam'
        // status_workflow   = 'Menunggu Admin'  ← admin tunggu keputusan ujian
        // status            = 'Pending'
        // status_ujian      = NULL              ← belum ada keputusan
        $st = $pdo->prepare("
            INSERT INTO permohonan (
                user_id, district_id, persatuan_id, tahun_permohonan,
                jenis_permohonan, jenis_borang,
                nama_penuh, no_kp, emel, no_telefon, jantina,
                jenis_pengadil, persatuan_daerah,
                alamat1, daerah, negeri,
                status_kerja, jawatan, nama_majikan, alamat_majikan1,
                nama_waris, hubungan_waris, telefon_waris,
                url_resit,
                status, status_workflow,
                mohon_ujian_bertulis,
                payment_amount,
                umur, declare1, declare2, declare3,
                tarikh_hantar
            ) VALUES (
                ?, ?, ?, 2026,
                'kelas3_fam', 'kelas3_fam',
                ?, ?, ?, ?, ?,
                'Kelas III FAM', ?,
                ?, ?, 'Pahang',
                ?, ?, ?, ?,
                ?, ?, ?,
                ?,
                'Pending', 'Menunggu Admin',
                1,
                80.00,
                ?, 1, 1, 1,
                NOW()
            )
        ");
        $st->execute([
            $userId, $districtId, $persatuanId,
            $nama, $noIc, $emel, $noTel, $jantina,
            $persatuanNama,
            $alamat, ucfirst(strtolower($daerahKey)),
            $statusKerja, $jawatan, $namaMajikan, $alamatMajikan,
            $namaWaris, $hubungan, $telWaris,
            $urlResit,
            $umur,
        ]);

        // ── Insert notifikasi ───────────────────────────────────────────────
        $pdo->prepare("
            INSERT INTO notifications (user_id, type, subject, message, created_at)
            VALUES (?, 'Permohonan Diterima', 'Akaun Didaftarkan',
                    'Akaun anda telah didaftarkan untuk Peperiksaan Kelas III FAM 2026. Keputusan ujian akan dimaklumkan melalui sistem ini.', NOW())
        ")->execute([$userId]);

        $pdo->commit();

        // ── Hantar emel kelayakan ───────────────────────────────────────────
        $emailSent = false;
        if (!$noEmail) {
            $emailSent = sendKelas3WelcomeEmail($emel, $nama, $emel, $password, $peperiksaan, $daerahKey);
        }

        $sentLabel = $noEmail ? 'emel-skip' : ($emailSent ? 'emel-OK' : 'emel-GAGAL');
        echo "OK (user_id: {$userId}, {$sentLabel})\n";
        $stats['berjaya']++;
        $log[] = "BERJAYA | {$nama} | {$emel} | user_id: {$userId} | PW: {$password} | {$sentLabel}";

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo "GAGAL — " . $e->getMessage() . "\n";
        $stats['gagal']++;
        $log[] = "GAGAL | {$nama} | {$emel} | " . $e->getMessage();
    }
}

// ── Ringkasan ─────────────────────────────────────────────────────────────────
echo "\n";
echo "════════════════════════════════════════\n";
echo "RINGKASAN IMPORT KELAS III FAM 2026\n";
echo "════════════════════════════════════════\n";
echo "Berjaya    : {$stats['berjaya']}\n";
echo "Langkau IC : {$stats['langkau_ic']}\n";
echo "Langkau Emel: {$stats['langkau_emel']}\n";
echo "Gagal      : {$stats['gagal']}\n";
echo "════════════════════════════════════════\n\n";

// Simpan log
$logFile = __DIR__ . '/import-kelas3-' . date('Ymd-His') . '.log';
file_put_contents($logFile, implode("\n", $log) . "\n");
echo "Log disimpan: {$logFile}\n";


// ── Fungsi emel ───────────────────────────────────────────────────────────────

function sendKelas3WelcomeEmail(
    string $to,
    string $nama,
    string $username,
    string $password,
    string $peperiksaan,
    string $daerah
): bool {
    $subject = "Akaun Sistem RefPahang — Peperiksaan Kelas III FAM 2026";
    $loginUrl = env('BASE_URL', 'https://refpahang.com') . '/login';

    $credHtml = '
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="padding:16px 20px;background:#f0f4ff;border-radius:8px;border-left:4px solid #3b5bdb;">
          <p style="margin:0 0 8px;font-size:13px;color:#666;">Alamat Emel (untuk log masuk)</p>
          <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1a1a2e;font-family:monospace;">' . htmlspecialchars($username) . '</p>
          <p style="margin:0 0 8px;font-size:13px;color:#666;">Kata Laluan Sementara</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#3b5bdb;font-family:monospace;letter-spacing:3px;">' . htmlspecialchars($password) . '</p>
        </td>
      </tr>
    </table>';

    $body  = emailGreeting($nama);
    $body .= emailPara('Terima kasih kerana mendaftar untuk <strong>' . htmlspecialchars($peperiksaan) . '</strong> Tahun 2026. Akaun anda dalam Sistem Pengurusan Pengadil Persatuan Bola Sepak Negeri Pahang telah <strong>berjaya didaftarkan</strong>.');
    $body .= emailPara('Berikut adalah maklumat log masuk anda:');
    $body .= $credHtml;
    $body .= emailAlert('#f59f00', '#fff9db', 'Keputusan Ujian Belum Keluar',
        'Permohonan anda sedang dalam semakan. Keputusan peperiksaan akan dikemas kini dalam sistem setelah diumumkan. Anda akan menerima notifikasi melalui emel ini.');
    $body .= emailPara('Langkah seterusnya:');
    $body .= emailOrderedList([
        'Log masuk di <a href="' . $loginUrl . '" style="color:#3b5bdb;">' . $loginUrl . '</a>',
        'Tukar kata laluan sementara kepada kata laluan anda sendiri.',
        'Lengkapkan maklumat profil anda.',
        'Semak status keputusan ujian di bahagian <strong>Permohonan</strong>.',
    ]);
    $body .= emailButton($loginUrl, 'Log Masuk Sekarang');
    $body .= emailPara('<small>Daerah: ' . htmlspecialchars(ucwords(strtolower($daerah))) . ' &nbsp;|&nbsp; Jika ada pertanyaan, hubungi admin di <a href="mailto:admin@refpahang.com">admin@refpahang.com</a></small>');

    $html = buildEmailTemplate(
        'Akaun Berjaya Didaftarkan',
        '#3b5bdb',
        '🎉',
        $body
    );

    return sendEmail($to, $subject, $html, $nama, 'daftar');
}
