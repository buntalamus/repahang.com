<?php
/**
 * Blast Telegram Linking Email
 *
 * Sends a one-time Telegram linking invitation email to ALL active Pengadil
 * (and optionally pengadil_luar) who have not yet linked their Telegram account.
 *
 * Run:
 *   php docs/blast-telegram-link.php          ← dry run (no emails sent)
 *   php docs/blast-telegram-link.php --send   ← send for real
 *   php docs/blast-telegram-link.php --send --luar  ← include pengadil luar too
 *
 * Progress is printed to console. Safe to re-run — skips already-linked accounts
 * and skips accounts that already have an unused tg_link_token (no duplicate emails).
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/bootstrap.php';
require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../config/telegram.php';

if (!function_exists('env')) {
    require_once __DIR__ . '/../config/env.php';
}

$dryRun     = !in_array('--send', $argv ?? [], true);
$includeLuar = in_array('--luar', $argv ?? [], true);
$botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');
$baseUrl     = env('BASE_URL', 'https://refpahang.com');

echo "=============================================================\n";
echo "  Blast Emel Link Telegram — Sistem Lantikan Pengadil\n";
echo "=============================================================\n";
if ($dryRun) {
    echo "  *** DRY RUN — tiada emel dihantar. Guna --send untuk hantar. ***\n\n";
} else {
    echo "  *** LIVE — emel akan dihantar sekarang! ***\n\n";
}

$pdo = getDbConnection();

// ── Collect recipients ───────────────────────────────────────────────────────
$recipients = [];

// Registered Pengadil (users table)
$stmt = $pdo->query("
    SELECT id, email, nama_penuh, tg_link_token, 'user' AS tbl
    FROM users
    WHERE role = 'Pengadil'
      AND aktif = 1
      AND telegram_chat_id IS NULL
      AND email IS NOT NULL AND email != ''
    ORDER BY nama_penuh
");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $recipients[] = $r;
}

// Pengadil Luar (optional)
if ($includeLuar) {
    $stmt = $pdo->query("
        SELECT id, emel AS email, nama AS nama_penuh, tg_link_token, 'luar' AS tbl
        FROM pengadil_luar
        WHERE telegram_chat_id IS NULL
          AND emel IS NOT NULL AND emel != ''
        ORDER BY nama
    ");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $recipients[] = $r;
    }
}

$total   = count($recipients);
$sent    = 0;
$skipped = 0;
$failed  = 0;

echo "  Sasaran: {$total} pengadil";
echo $includeLuar ? " (termasuk pengadil luar)\n" : " (pengadil berdaftar sahaja)\n";
echo "-------------------------------------------------------------\n";

foreach ($recipients as $i => $ref) {
    $num  = $i + 1;
    $name = $ref['nama_penuh'];
    $to   = $ref['email'];

    // Generate or reuse existing tg_link_token
    $token = $ref['tg_link_token'] ?? '';
    if (empty($token)) {
        $token = bin2hex(random_bytes(16));
        if (!$dryRun) {
            $table = $ref['tbl'] === 'user' ? 'users' : 'pengadil_luar';
            $pdo->prepare("UPDATE {$table} SET tg_link_token = :tok WHERE id = :id")
                ->execute([':tok' => $token, ':id' => $ref['id']]);
        }
    }

    $linkUrl = "https://t.me/{$botUsername}?start={$token}";

    if ($dryRun) {
        echo "[{$num}/{$total}] DRY  {$name} <{$to}> → {$linkUrl}\n";
        $sent++;
        continue;
    }

    // Build and send the invitation email
    $html = buildTelegramInviteEmail($name, $linkUrl, $baseUrl);
    $ok   = sendEmail($to, 'Daftar Akaun Telegram — Sistem Lantikan Pengadil', $html, $name, 'lantikan');

    if ($ok) {
        echo "[{$num}/{$total}] OK   {$name} <{$to}>\n";
        $sent++;
    } else {
        echo "[{$num}/{$total}] FAIL {$name} <{$to}>\n";
        $failed++;
    }

    // Throttle: avoid hitting SMTP rate limits (1 email per 0.3s)
    usleep(300_000);
}

echo "-------------------------------------------------------------\n";
echo "  Selesai. Berjaya: {$sent} | Gagal: {$failed}\n";
if ($dryRun) {
    echo "  Jalankan semula dengan --send untuk hantar emel sebenar.\n";
}
echo "=============================================================\n";

// ── Email template ───────────────────────────────────────────────────────────
function buildTelegramInviteEmail(string $nama, string $linkUrl, string $baseUrl): string
{
    $safeLink = htmlspecialchars($linkUrl);
    $body =
        emailGreeting($nama) .
        emailPara(
            "Persatuan Bola Sepak Negeri Pahang kini menggunakan sistem lantikan pengadil baharu " .
            "yang menghantar notifikasi terus ke <strong>akaun Telegram</strong> anda."
        ) .
        emailPara(
            "Mulai saat ini, apabila anda dilantik untuk bertugas dalam sesuatu perlawanan, " .
            "anda akan menerima mesej Telegram dan boleh <strong>terima atau tolak tugasan dengan satu ketukan</strong> — " .
            "tanpa perlu log masuk ke sistem."
        ) .
        "<div style=\"background:#EFF6FF;border:1px solid #BFDBFE;border-left:3px solid #3B82F6;
                      padding:22px 24px;margin:24px 0;text-align:center;\">
           <div style=\"font-weight:700;font-size:13px;color:#1E40AF;text-transform:uppercase;
                        letter-spacing:.8px;margin-bottom:10px;\">
             Langkah Pendaftaran
           </div>
           <p style=\"color:#374151;font-size:14px;line-height:1.8;margin:0 0 20px 0;\">
             Tekan butang di bawah untuk buka bot Telegram kami.<br>
             Tekan <strong>START</strong> dalam Telegram — selesai!
           </p>
           <a href=\"{$safeLink}\"
              style=\"display:inline-block;background:#2563EB;color:#ffffff;
                      padding:13px 32px;text-decoration:none;font-weight:700;
                      font-size:14px;letter-spacing:.5px;\">
             Daftar Telegram Sekarang
           </a>
           <p style=\"color:#9CA3AF;font-size:11px;margin:16px 0 0;\">
             Atau salin pautan ini ke pelayar anda:<br>
             <span style=\"font-family:'Courier New',monospace;font-size:11px;
                           color:#374151;word-break:break-all;\">{$safeLink}</span>
           </p>
         </div>" .
        emailAlert('#FADA00', '#FFFBEB', 'Perlu Dilakukan Sekali Sahaja',
            'Pendaftaran ini hanya perlu dilakukan <strong>sekali sahaja</strong>. ' .
            'Selepas itu, semua notifikasi lantikan akan dihantar terus ke Telegram anda.'
        ) .
        emailPara(
            "Sekiranya anda mempunyai sebarang masalah, sila hubungi Unit Pengadil di " .
            "<a href=\"mailto:admin@refpahang.com\" style=\"color:#111827;font-weight:600;\">admin@refpahang.com</a>."
        );

    return buildEmailTemplate('Aktifkan Notifikasi Telegram', '#3B82F6', '', $body);
}
