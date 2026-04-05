<?php
/**
 * Telegram Long-Polling Runner (Development Only)
 *
 * Polls Telegram getUpdates API and processes messages locally.
 * Use this instead of a webhook when developing on localhost.
 *
 * Usage:
 *   php api/telegram-poll.php
 *
 * Stop with Ctrl+C.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/telegram.php';
require_once __DIR__ . '/../config/lantikan-helper.php';

$botToken = env('TELEGRAM_BOT_TOKEN', '');
if (!$botToken) {
    fwrite(STDERR, "ERROR: TELEGRAM_BOT_TOKEN tidak dikonfigurasi dalam .env\n");
    exit(1);
}

$apiBase = "https://api.telegram.org/bot{$botToken}";

/**
 * Make HTTPS request to Telegram API using cURL.
 */
function tgApi(string $url): ?array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 35,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $resp = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($resp === false) {
        echo "[ERROR] cURL: {$err}\n";
        return null;
    }
    return json_decode($resp, true) ?: null;
}

// ── Remove any registered webhook so Telegram routes to getUpdates ────────
echo "Memadam webhook yang sedia ada...\n";
$del = tgApi("{$apiBase}/deleteWebhook?drop_pending_updates=false");
echo "deleteWebhook: " . ($del['ok'] ? 'OK' : 'GAGAL') . "\n";

echo "Polling bermula. Tekan Ctrl+C untuk berhenti.\n\n";

$offset = 0; // Process pending updates first (offset=0)

while (true) {
    $url  = "{$apiBase}/getUpdates?timeout=30&offset={$offset}";
    $data = tgApi($url);

    if (!($data['ok'] ?? false) || empty($data['result'])) {
        continue; // No updates or long-poll timeout — retry immediately
    }

    $pdo = getDbConnection();

    foreach ($data['result'] as $update) {
        $updateId = (int) $update['update_id'];
        $offset   = $updateId + 1; // Advance offset to ack this update

        processUpdate($pdo, $update, $apiBase);
    }
}

// ─────────────────────────────────────────────────────────────────────────────

function processUpdate(PDO $pdo, array $update, string $apiBase): void
{
    try {
        // ── /start <LINK_TOKEN> ───────────────────────────────────────────────
        if (isset($update['message'])) {
            $msg    = $update['message'];
            $chatId = (int) $msg['chat']['id'];
            $text   = trim($msg['text'] ?? '');
            $from   = $msg['from'];
            $tgName = trim(($from['first_name'] ?? '') . ' ' . ($from['last_name'] ?? ''));

            echo "[" . date('H:i:s') . "] Mesej dari {$tgName} ({$chatId}): " . mb_substr($text, 0, 60) . "\n";

            if (str_starts_with($text, '/start')) {
                $parts     = explode(' ', $text, 2);
                $linkToken = isset($parts[1]) ? trim($parts[1]) : '';

                if ($linkToken === '') {
                    tgSend($chatId,
                        "<b>Sistem Pengurusan Pengadil Pahang FA</b>\n\n" .
                        "Bot ini digunakan untuk menerima notifikasi lantikan perlawanan.\n\n" .
                        "Sila minta pentadbir untuk menghantar pautan pendaftaran Telegram kepada anda."
                    );
                    echo "  → Balas: Arahan tiada token\n";
                } else {
                    $stmt = $pdo->prepare(
                        "SELECT id, 'user' AS tbl, nama_penuh FROM users WHERE tg_link_token = :tok
                         UNION
                         SELECT id, 'luar' AS tbl, nama AS nama_penuh FROM pengadil_luar WHERE tg_link_token = :tok
                         LIMIT 1"
                    );
                    $stmt->execute([':tok' => $linkToken]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);

                    if (!$row) {
                        tgSend($chatId, "⚠️ Pautan tidak sah atau sudah tamat tempoh. Sila hubungi pentadbir.");
                        echo "  → Token tidak sah: {$linkToken}\n";
                    } else {
                        $table = $row['tbl'] === 'user' ? 'users' : 'pengadil_luar';
                        $pdo->prepare(
                            "UPDATE {$table} SET telegram_chat_id = :cid, tg_link_token = NULL WHERE id = :id"
                        )->execute([':cid' => $chatId, ':id' => $row['id']]);

                        tgSend($chatId,
                            "✅ <b>Akaun berjaya dihubungkan!</b>\n\n" .
                            "Selamat datang, <b>" . htmlspecialchars($row['nama_penuh']) . "</b>.\n\n" .
                            "Anda akan menerima notifikasi Telegram apabila dilantik untuk bertugas dalam sesuatu perlawanan."
                        );
                        echo "  → Akaun dihubungkan: {$row['nama_penuh']} (chat_id={$chatId})\n";
                    }
                }
            }
            return;
        }

        // ── Inline button callbacks (Terima/Tolak) ───────────────────────────
        if (isset($update['callback_query'])) {
            $cbq    = $update['callback_query'];
            $cbqId  = $cbq['id'];
            $chatId = (int) $cbq['from']['id'];
            $msgId  = (int) ($cbq['message']['id'] ?? 0);
            $data   = $cbq['data'] ?? '';
            $from   = $cbq['from'];
            $tgName = trim(($from['first_name'] ?? '') . ' ' . ($from['last_name'] ?? ''));

            echo "[" . date('H:i:s') . "] Callback dari {$tgName} ({$chatId}): {$data}\n";

            if (!preg_match('/^act:(accept|reject):token:([A-Za-z0-9]+)$/', $data, $m)) {
                tgAnswerCallback($cbqId, 'Format tidak sah.', true);
                echo "  → Format tidak sah\n";
                return;
            }

            $action  = $m[1];
            $tgToken = $m[2];

            $stmt = $pdo->prepare("
                SELECT lp.id, lp.status, lp.jawatan,
                       jp.tarikh, jp.pasukan_home, jp.pasukan_away, jp.tempat, jp.masa, jp.jadual_id,
                       kj.nama AS kejohanan,
                       COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS owner_chat_id
                FROM lantikan_pengadil lp
                JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
                LEFT JOIN users u ON lp.pengadil_id = u.id
                LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
                WHERE lp.tg_token = :tok
                LIMIT 1
            ");
            $stmt->execute([':tok' => $tgToken]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                tgAnswerCallback($cbqId, 'Lantikan tidak ditemui.', true);
                echo "  → Lantikan tidak ditemui untuk token: {$tgToken}\n";
                return;
            }

            if ((int) $row['owner_chat_id'] !== $chatId) {
                tgAnswerCallback($cbqId, 'Anda tidak dibenarkan untuk tugasan ini.', true);
                echo "  → Chat ID tidak sepadan\n";
                return;
            }

            if ($row['status'] !== 'Belum Jawab') {
                $already = $row['status'] === 'Diterima' ? 'sudah diterima' : 'sudah ditolak';
                tgAnswerCallback($cbqId, "Tugasan ini {$already}.", true);
                echo "  → Status sudah: {$row['status']}\n";
                return;
            }

            $newStatus = $action === 'accept' ? 'Diterima' : 'Ditolak';
            $pdo->prepare(
                "UPDATE lantikan_pengadil SET status = :s, tarikh_jawab = NOW(), tg_token = NULL WHERE id = :id"
            )->execute([':s' => $newStatus, ':id' => $row['id']]);

            if ($newStatus === 'Diterima') {
                createPerlawananFromLantikan($pdo, (int) $row['id']);
                generatePenilaianToken($pdo, (int) $row['id']);

                $jid = (int) $row['jadual_id'];
                $chkStmt = $pdo->prepare("
                    SELECT COUNT(*) AS total,
                           SUM(CASE WHEN status = 'Diterima' THEN 1 ELSE 0 END) AS diterima
                    FROM lantikan_pengadil WHERE jadual_id = :jid
                ");
                $chkStmt->execute([':jid' => $jid]);
                $counts = $chkStmt->fetch(PDO::FETCH_ASSOC);
                if ((int)$counts['total'] > 0 && (int)$counts['total'] === (int)$counts['diterima']) {
                    $pdo->prepare(
                        "UPDATE jadual_perlawanan SET status = 'Disahkan' WHERE id = :id AND status = 'Menunggu Pengesahan'"
                    )->execute([':id' => $jid]);
                    echo "  → Semua pengadil terima. Jadual status → Disahkan\n";
                }
            }

            $tarikhFmt = date('d M Y', strtotime($row['tarikh']));
            $pasukan   = htmlspecialchars($row['pasukan_home'] . ' lwn ' . $row['pasukan_away']);
            $jwtn      = htmlspecialchars($row['jawatan']);

            if ($action === 'accept') {
                $reply = "✅ <b>Tugasan Diterima</b>\n\n" .
                         "Anda telah <b>menerima</b> tugasan sebagai <b>{$jwtn}</b>.\n" .
                         "{$pasukan}\n{$tarikhFmt}\n\n" .
                         "Terima kasih. Sila hadir pada waktu yang ditetapkan.";
                tgAnswerCallback($cbqId, 'Tugasan diterima. Terima kasih!');
                echo "  → Diterima: {$jwtn}\n";
            } else {
                $reply = "❌ <b>Tugasan Ditolak</b>\n\n" .
                         "Anda telah <b>menolak</b> tugasan sebagai <b>{$jwtn}</b>.\n" .
                         "{$pasukan}\n{$tarikhFmt}\n\n" .
                         "Pentadbir akan dimaklumkan. Terima kasih.";
                tgAnswerCallback($cbqId, 'Tugasan ditolak.');
                echo "  → Ditolak: {$jwtn}\n";
            }

            tgEditMessage($chatId, $msgId, $reply);
            return;
        }

    } catch (Throwable $e) {
        echo "[ERROR] " . $e->getMessage() . "\n";
    }
}
