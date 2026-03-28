<?php
/**
 * Telegram Webhook Handler
 *
 * Receives updates from Telegram:
 *   1. /start <LINK_TOKEN>  → link this chat_id to the referee account
 *   2. callback_query act:accept:token:<TG_TOKEN>  → accept assignment
 *   3. callback_query act:reject:token:<TG_TOKEN>  → decline assignment
 *
 * Register this URL as Telegram webhook:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://refpahang.com/api/telegram-webhook.php
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/telegram.php';

// Telegram sends JSON POST
$raw    = file_get_contents('php://input');
$update = json_decode((string) $raw, true);

if (!is_array($update)) {
    http_response_code(200); // Always 200 to Telegram
    exit;
}

try {
    $pdo = getDbConnection();

    // ── 1. Handle /start <LINK_TOKEN> ────────────────────────────────────────
    if (isset($update['message'])) {
        $msg    = $update['message'];
        $chatId = (int) $msg['chat']['id'];
        $text   = trim($msg['text'] ?? '');
        $from   = $msg['from'];
        $tgName = trim(($from['first_name'] ?? '') . ' ' . ($from['last_name'] ?? ''));

        if (str_starts_with($text, '/start')) {
            $parts     = explode(' ', $text, 2);
            $linkToken = isset($parts[1]) ? trim($parts[1]) : '';

            if ($linkToken === '') {
                tgSend($chatId,
                    "<b>Sistem Pengurusan Pengadil Pahang FA</b>\n\n" .
                    "Bot ini digunakan untuk menerima notifikasi lantikan perlawanan.\n\n" .
                    "Sila minta pentadbir untuk menghantar pautan pendaftaran Telegram kepada anda."
                );
            } else {
                // Look up the link token
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
                } else {
                    $table = $row['tbl'] === 'user' ? 'users' : 'pengadil_luar';
                    $idCol = 'id';
                    // Save chat_id and clear token
                    $pdo->prepare(
                        "UPDATE {$table} SET telegram_chat_id = :cid, tg_link_token = NULL WHERE {$idCol} = :id"
                    )->execute([':cid' => $chatId, ':id' => $row['id']]);

                    tgSend($chatId,
                        "✅ <b>Akaun berjaya dihubungkan!</b>\n\n" .
                        "Selamat datang, <b>" . htmlspecialchars($row['nama_penuh']) . "</b>.\n\n" .
                        "Anda akan menerima notifikasi Telegram apabila dilantik untuk bertugas dalam sesuatu perlawanan."
                    );
                }
            }
        }
        http_response_code(200);
        exit;
    }

    // ── 2. Handle inline button callbacks ─────────────────────────────────────
    if (isset($update['callback_query'])) {
        $cbq     = $update['callback_query'];
        $cbqId   = $cbq['id'];
        $chatId  = (int) $cbq['from']['id'];
        $msgId   = (int) ($cbq['message']['id'] ?? 0);
        $data    = $cbq['data'] ?? '';

        // Parse: act:{accept|reject}:token:{TOKEN}
        if (!preg_match('/^act:(accept|reject):token:([A-Za-z0-9]+)$/', $data, $m)) {
            tgAnswerCallback($cbqId, 'Format tidak sah.', true);
            http_response_code(200);
            exit;
        }

        $action   = $m[1]; // accept | reject
        $tgToken  = $m[2];

        // Look up the assignment
        $stmt = $pdo->prepare("
            SELECT lp.id, lp.status, lp.jawatan,
                   jp.tarikh, jp.pasukan_home, jp.pasukan_away, jp.tempat, jp.masa,
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
            http_response_code(200);
            exit;
        }

        // Security: make sure this chat_id owns the token
        if ((int) $row['owner_chat_id'] !== $chatId) {
            tgAnswerCallback($cbqId, 'Anda tidak dibenarkan untuk tugasan ini.', true);
            http_response_code(200);
            exit;
        }

        if ($row['status'] !== 'Belum Jawab') {
            $already = $row['status'] === 'Diterima' ? 'sudah diterima' : 'sudah ditolak';
            tgAnswerCallback($cbqId, "Tugasan ini {$already}.", true);
            http_response_code(200);
            exit;
        }

        $newStatus = $action === 'accept' ? 'Diterima' : 'Ditolak';
        $pdo->prepare(
            "UPDATE lantikan_pengadil SET status = :s, tarikh_jawab = NOW(), tg_token = NULL WHERE id = :id"
        )->execute([':s' => $newStatus, ':id' => $row['id']]);

        // Auto-update jadual status to 'Disahkan' if ALL assignments are accepted
        if ($newStatus === 'Diterima') {
            // Create perlawanan record for this pengadil
            require_once __DIR__ . '/../config/lantikan-helper.php';
            createPerlawananFromLantikan($pdo, (int) $row['id']);

            // Need jadual_id — get from a join
            $jStmt = $pdo->prepare("SELECT jadual_id FROM lantikan_pengadil WHERE id = :id");
            $jStmt->execute([':id' => $row['id']]);
            $jRow = $jStmt->fetch(PDO::FETCH_ASSOC);
            if ($jRow) {
                $chkStmt = $pdo->prepare("
                    SELECT COUNT(*) AS total,
                           SUM(CASE WHEN status = 'Diterima' THEN 1 ELSE 0 END) AS diterima
                    FROM lantikan_pengadil WHERE jadual_id = :jid
                ");
                $chkStmt->execute([':jid' => $jRow['jadual_id']]);
                $counts = $chkStmt->fetch(PDO::FETCH_ASSOC);
                if ((int)$counts['total'] > 0 && (int)$counts['total'] === (int)$counts['diterima']) {
                    $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Disahkan' WHERE id = :id AND status = 'Menunggu Pengesahan'")
                        ->execute([':id' => $jRow['jadual_id']]);
                }
            }
        }

        // Notify user via edited message
        $tarikhFmt  = date('d M Y', strtotime($row['tarikh']));
        $pasukan    = htmlspecialchars($row['pasukan_home'] . ' lwn ' . $row['pasukan_away']);
        $jawatan    = htmlspecialchars($row['jawatan']);

        if ($action === 'accept') {
            $reply = "✅ <b>Tugasan Diterima</b>\n\n" .
                     "Anda telah <b>menerima</b> tugasan sebagai <b>{$jawatan}</b>.\n" .
                     "{$pasukan}\n{$tarikhFmt}\n\n" .
                     "Terima kasih. Sila hadir pada waktu yang ditetapkan.";
            tgAnswerCallback($cbqId, 'Tugasan diterima. Terima kasih!');
        } else {
            $reply = "❌ <b>Tugasan Ditolak</b>\n\n" .
                     "Anda telah <b>menolak</b> tugasan sebagai <b>{$jawatan}</b>.\n" .
                     "{$pasukan}\n{$tarikhFmt}\n\n" .
                     "Pentadbir akan dimaklumkan. Terima kasih.";
            tgAnswerCallback($cbqId, 'Tugasan ditolak.');
        }

        tgEditMessage($chatId, $msgId, $reply);
        http_response_code(200);
        exit;
    }

} catch (Throwable $e) {
    error_log('[telegram-webhook] ' . $e->getMessage());
}

http_response_code(200);
exit;
