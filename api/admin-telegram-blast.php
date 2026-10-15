<?php
/**
 * Admin Telegram Blast API
 * Sends Telegram linking emails to all users who haven't linked Telegram yet.
 *
 * GET  → preview counts (total eligible, already linked)
 * POST → send blast emails with Telegram link
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/email.php';

requireAdmin();

if (!function_exists('env')) {
    require_once __DIR__ . '/../config/env.php';
}

$botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');
$baseUrl     = env('BASE_URL', 'https://refpahang.com');

try {
    $pdo = getDbConnection();

    // ── GET: Preview counts ──────────────────────────────────────────
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $total = $pdo->query(
            "SELECT COUNT(*) FROM users WHERE email IS NOT NULL AND TRIM(email) != ''"
        )->fetchColumn();

        $linked = $pdo->query(
            "SELECT COUNT(*) FROM users WHERE email IS NOT NULL AND TRIM(email) != '' AND telegram_chat_id IS NOT NULL AND TRIM(telegram_chat_id) != ''"
        )->fetchColumn();

        $notLinked = $total - $linked;
        $activeNotLinked = $pdo->query(
            "SELECT COUNT(*) FROM users WHERE aktif = 1 AND email IS NOT NULL AND TRIM(email) != '' AND (telegram_chat_id IS NULL OR TRIM(telegram_chat_id) = '')"
        )->fetchColumn();
        $inactiveNotLinked = $notLinked - $activeNotLinked;

        jsonResponse([
            'error'      => false,
            'total'      => (int) $total,
            'linked'     => (int) $linked,
            'not_linked' => (int) $notLinked,
            'active_not_linked' => (int) $activeNotLinked,
            'inactive_not_linked' => (int) $inactiveNotLinked,
        ]);
    }

    // ── POST: Send blast ─────────────────────────────────────────────
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['error' => true, 'message' => 'Method not allowed.'], 405);
    }

    set_time_limit(300); // Allow up to 5 minutes for large batches

    // Include inactive users; linking Telegram does not change account status.
    $stmt = $pdo->query(
        "SELECT id, nama_penuh, email, tg_link_token
         FROM users
         WHERE email IS NOT NULL AND TRIM(email) != ''
           AND (telegram_chat_id IS NULL OR TRIM(telegram_chat_id) = '')"
    );
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $sent   = 0;
    $failed = 0;
    $errors = [];

    $updateStmt = $pdo->prepare("UPDATE users SET tg_link_token = ? WHERE id = ?");

    foreach ($users as $user) {
        // Generate token if not existing
        $token = $user['tg_link_token'];
        if (empty($token)) {
            $token = bin2hex(random_bytes(16));
            $updateStmt->execute([$token, $user['id']]);
        }

        $linkUrl = "https://t.me/{$botUsername}?start={$token}";

        // Build email
        $body  = emailGreeting($user['nama_penuh'] ?: 'Pengadil');
        $body .= emailPara('Kami ingin memaklumkan bahawa sistem <strong>Pengurusan Pengadil PBNP</strong> kini menggunakan <strong>Telegram</strong> untuk menghantar notifikasi lantikan perlawanan secara pantas.');
        $body .= emailAlert('#0088CC', '#EBF5FB', 'KENAPA TELEGRAM?', implode('<br>', [
            '✅ Terima notifikasi lantikan terus ke telefon anda.',
            '✅ Terima/tolak lantikan dengan satu klik.',
            '✅ Tidak terlepas sebarang perlawanan penting.',
        ]));
        $body .= emailPara('Sila klik butang di bawah untuk menghubungkan akaun anda dengan Telegram:');
        $body .= emailButton($linkUrl, 'Aktifkan Telegram Sekarang');
        $body .= emailPara('<strong>Langkah mudah:</strong>');
        $body .= emailOrderedList([
            'Klik butang di atas — anda akan dibawa ke Telegram.',
            'Klik <strong>START</strong> pada bot <strong>@' . htmlspecialchars($botUsername) . '</strong>.',
            'Siap! Anda akan menerima notifikasi lantikan secara automatik.',
        ]);
        $body .= emailAlert('#F59E0B', '#FFFBEB', 'NOTA', 'Jika anda sudah mempunyai Telegram, pastikan aplikasi Telegram dipasang di telefon anda sebelum mengklik butang di atas.');

        $html    = buildEmailTemplate('Aktifkan Notifikasi Telegram', '#0088CC', '', $body);
        $subject = 'Aktifkan Telegram — Sistem Pengurusan Pengadil PBNP';

        $ok = sendEmail($user['email'], $subject, $html, $user['nama_penuh'], 'admin');

        if ($ok) {
            $sent++;
        } else {
            $failed++;
            $errors[] = $user['email'];
        }

        // Small delay to avoid overwhelming SMTP
        usleep(200_000); // 200ms
    }

    jsonResponse([
        'error'   => false,
        'message' => "Blast selesai. {$sent} emel berjaya dihantar" . ($failed > 0 ? ", {$failed} gagal." : '.'),
        'sent'    => $sent,
        'failed'  => $failed,
        'errors'  => $failed > 0 ? $errors : [],
    ]);

} catch (Exception $e) {
    error_log('Telegram blast error: ' . $e->getMessage());
    jsonResponse([
        'error'   => true,
        'message' => APP_DEBUG ? $e->getMessage() : 'Ralat dalaman server.',
    ], 500);
}
