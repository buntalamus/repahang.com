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
 *
 * NOTE: This file intentionally does NOT use bootstrap.php.
 *       bootstrap.php converts PHP warnings to ErrorException which kills
 *       the webhook before it can answer callback queries.
 *       We only load the bare minimum: env, db, telegram helpers.
 */

declare(strict_types=1);

// ── Minimal setup — NO bootstrap.php, NO session, NO error-to-exception ──
date_default_timezone_set('Asia/Kuala_Lumpur');

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/telegram.php';
require_once __DIR__ . '/../config/lantikan-helper.php';

// Logging only — do NOT throw on warnings
$logDir = __DIR__ . '/../storage/logs';
if (!is_dir($logDir)) { @mkdir($logDir, 0775, true); }
ini_set('log_errors', '1');
ini_set('error_log', $logDir . '/app.log');
ini_set('display_errors', '0');

// Always 200 to Telegram no matter what happens
http_response_code(200);

// Read incoming update
$raw    = file_get_contents('php://input');
$update = json_decode((string) $raw, true);

if (!is_array($update)) {
    exit;
}

// Track callback query ID globally for emergency answer in catch block
$cbqId = null;

try {
    $pdo = getDbConnection();
} catch (Throwable $e) {
    error_log('[telegram-webhook] DB connection failed: ' . $e->getMessage());
    exit;
}

try {

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

            // Adakah chat ini sudah terhubung dengan mana-mana akaun?
            $linkedStmt = $pdo->prepare(
                "SELECT nama_penuh FROM users WHERE telegram_chat_id = :cid
                 UNION
                 SELECT nama AS nama_penuh FROM pengadil_luar WHERE telegram_chat_id = :cid
                 LIMIT 1"
            );
            $linkedStmt->execute([':cid' => $chatId]);
            $linkedNama = $linkedStmt->fetchColumn();

            if ($linkToken === '') {
                if ($linkedNama) {
                    tgSend($chatId,
                        "✅ <b>Akaun anda sudah dihubungkan</b>\n\n" .
                        "Selamat kembali, <b>" . htmlspecialchars((string) $linkedNama) . "</b>.\n\n" .
                        "Anda akan menerima notifikasi Telegram apabila dilantik untuk bertugas."
                    );
                } else {
                    tgSend($chatId,
                        "<b>Sistem Pengurusan Pengadil Pahang FA</b>\n\n" .
                        "Bot ini digunakan untuk menerima notifikasi lantikan perlawanan.\n\n" .
                        "Sila minta pentadbir untuk menghantar pautan pendaftaran Telegram kepada anda."
                    );
                }
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
                    // Token sudah digunakan / digantikan — bukan "tamat tempoh".
                    // Jika chat ini sememangnya sudah terhubung, tiada masalah.
                    if ($linkedNama) {
                        tgSend($chatId,
                            "✅ <b>Akaun anda sudah dihubungkan</b>\n\n" .
                            "Selamat kembali, <b>" . htmlspecialchars((string) $linkedNama) . "</b>. " .
                            "Pautan pendaftaran itu sudah digunakan, jadi tiada tindakan lanjut diperlukan.\n\n" .
                            "Anda akan menerima notifikasi Telegram apabila dilantik untuk bertugas."
                        );
                    } else {
                        tgSend($chatId,
                            "⚠️ <b>Pautan Pendaftaran Tidak Aktif</b>\n\n" .
                            "Pautan ini sudah tidak aktif — kemungkinan ia telah digunakan sebelum ini " .
                            "atau digantikan dengan pautan baharu.\n\n" .
                            "Sila minta pentadbir menghantar pautan pendaftaran Telegram yang terbaharu kepada anda."
                        );
                    }
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
            SELECT lp.id, lp.status, lp.komen, lp.tarikh_notif, lp.jawatan, lp.pengadil_id,
                   jp.tarikh, jp.pasukan_home, jp.pasukan_away, jp.tempat, jp.masa,
                   kj.nama AS kejohanan,
                   COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS owner_chat_id,
                   u.nama_penuh, u.persatuan_id
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
            // Token tidak wujud: tugasan telah dijawab melalui saluran lain,
            // notifikasi ini sudah lapuk, atau lantikan dikemaskini pentadbir.
            tgAnswerCallback($cbqId,
                "\u{26A0}\u{FE0F} Butang ini sudah tidak aktif.\n\n"
                . "Tugasan mungkin telah dijawab melalui saluran lain, atau lantikan telah dikemaskini oleh pentadbir. "
                . "Sila semak dashboard atau notifikasi terbaru anda.", true);
            if ($msgId) {
                tgEditMessage($chatId, $msgId,
                    "\u{26A0}\u{FE0F} <b>Notifikasi Lapuk</b>\n\n"
                    . "Butang pada notifikasi ini sudah tidak aktif. Tugasan mungkin telah dijawab "
                    . "melalui saluran lain, atau lantikan telah dikemaskini oleh pentadbir.\n\n"
                    . "Sila semak dashboard atau notifikasi terbaru anda.");
            }
            http_response_code(200);
            exit;
        }

        // Security: make sure this chat_id owns the token
        if ((int) $row['owner_chat_id'] !== $chatId) {
            tgAnswerCallback($cbqId, 'Anda tidak dibenarkan untuk tugasan ini.', true);
            http_response_code(200);
            exit;
        }

        // Kuatkuasa tempoh jawapan — auto-tolak jika sudah tamat
        if (autoTolakLantikanTertunggak($pdo, ['id' => (int) $row['id']]) > 0
            || ($row['status'] === 'Ditolak' && ($row['komen'] ?? '') === LANTIKAN_AUTO_TOLAK_KOMEN)) {
            tgAnswerCallback($cbqId, '⏰ Tempoh menjawab telah tamat. Lantikan telah ditolak secara automatik.', true);
            if ($msgId) {
                tgEditMessage($chatId, $msgId,
                    "⏰ <b>Tempoh Menjawab Tamat</b>\n\n" .
                    "Lantikan ini telah <b>ditolak secara automatik</b> kerana tiada jawapan dalam tempoh ditetapkan.\n" .
                    "Sila hubungi pentadbir jika anda masih boleh bertugas.");
            }
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
        $lantikanId = (int) $row['id'];

        $updStmt = $pdo->prepare(
            "UPDATE lantikan_pengadil SET status = :s, tarikh_jawab = NOW(), tg_token = NULL WHERE id = :id AND status = 'Belum Jawab'"
        );
        $updStmt->execute([':s' => $newStatus, ':id' => $lantikanId]);

        if ($updStmt->rowCount() === 0) {
            $already = $action === 'accept' ? 'sudah diterima' : 'sudah ditolak';
            tgAnswerCallback($cbqId, "Tugasan ini {$already}.", true);
            http_response_code(200);
            exit;
        }

        // ── RESPOND TO USER FIRST — before any helpers ──
        // This MUST happen immediately so the Telegram "loading" spinner stops.
        $tarikhFmt  = date('d M Y', strtotime((string) ($row['tarikh'] ?? '')));
        $pasukan    = htmlspecialchars(($row['pasukan_home'] ?? '') . ' lwn ' . ($row['pasukan_away'] ?? ''));
        $jawatan    = htmlspecialchars((string) ($row['jawatan'] ?? ''));
        $kejohanan  = htmlspecialchars((string) ($row['kejohanan'] ?? ''));
        $tempat     = htmlspecialchars((string) ($row['tempat'] ?? ''));
        $masaFmt    = !empty($row['masa']) ? date('H:i', strtotime($row['masa'])) : '-';
        $baseUrl    = defined('BASE_URL') ? BASE_URL : env('BASE_URL', 'https://refpahang.com');
        $dashUrl    = rtrim($baseUrl, '/') . '/pengadil-dashboard';

        if ($action === 'accept') {
            // Alert modal — plain text only, max ~200 chars
            $alertText = "✅ Tugasan Diterima!\n\n"
                       . "{$row['jawatan']}\n"
                       . "{$row['pasukan_home']} lwn {$row['pasukan_away']}\n"
                       . "{$tarikhFmt}, {$masaFmt} WIB";
            tgAnswerCallback($cbqId, $alertText, true);

            // Rich edited message replaces buttons
            $reply = "✅ <b>Tugasan Diterima</b>\n\n" .
                     "Anda telah <b>menerima</b> tugasan sebagai <b>{$jawatan}</b> " .
                     "untuk perlawanan berikut:\n\n" .
                     "<b>Kejohanan:</b> {$kejohanan}\n" .
                     "<b>Perlawanan:</b> {$pasukan}\n" .
                     "<b>Tarikh:</b> {$tarikhFmt}\n" .
                     "<b>Masa:</b> {$masaFmt} WIB\n" .
                     "<b>Tempat:</b> {$tempat}\n\n" .
                     "Terima kasih. Sila hadir pada waktu yang ditetapkan.\n\n" .
                     "⚠️ <b>Sila bawa kelengkapan penuh pengadil.</b> ⚽\n\n" .
                     "🔗 <a href=\"{$dashUrl}\">Lihat Dashboard Pengadil</a>";
        } else {
            $alertText = "❌ Tugasan Ditolak\n\n"
                       . "{$row['jawatan']}\n"
                       . "{$row['pasukan_home']} lwn {$row['pasukan_away']}\n"
                       . "{$tarikhFmt}";
            tgAnswerCallback($cbqId, $alertText, true);

            $reply = "❌ <b>Tugasan Ditolak</b>\n\n" .
                     "Anda telah <b>menolak</b> tugasan sebagai <b>{$jawatan}</b> " .
                     "untuk perlawanan berikut:\n\n" .
                     "<b>Kejohanan:</b> {$kejohanan}\n" .
                     "<b>Perlawanan:</b> {$pasukan}\n" .
                     "<b>Tarikh:</b> {$tarikhFmt}\n" .
                     "<b>Masa:</b> {$masaFmt} WIB\n" .
                     "<b>Tempat:</b> {$tempat}\n\n" .
                     "Pentadbir akan dimaklumkan. Terima kasih.\n\n" .
                     "🔗 <a href=\"{$dashUrl}\">Lihat Dashboard Pengadil</a>";
        }

        tgEditMessage($chatId, $msgId, $reply);

        // ── HELPER OPERATIONS — run AFTER user has been responded to ──
        require_once __DIR__ . '/../config/lantikan-helper.php';

        if ($newStatus === 'Diterima') {
            try {
                createPerlawananFromLantikan($pdo, $lantikanId);
            } catch (Throwable $helperErr) {
                error_log('[telegram-webhook] createPerlawanan error: ' . $helperErr->getMessage());
            }

            try {
                generatePenilaianToken($pdo, $lantikanId);
            } catch (Throwable $helperErr) {
                error_log('[telegram-webhook] generatePenilaianToken error: ' . $helperErr->getMessage());
            }

            try {
                $jStmt = $pdo->prepare("SELECT jadual_id FROM lantikan_pengadil WHERE id = :id");
                $jStmt->execute([':id' => $lantikanId]);
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
            } catch (Throwable $helperErr) {
                error_log('[telegram-webhook] jadual status update error: ' . $helperErr->getMessage());
            }
        }

        // ── Notify admin(s) & PP Daerah about accept/reject ──────────
        try {
            $namaPengadil = $row['nama_penuh'] ?? 'Pengadil';
            notifyAdminLantikanResponse($pdo, $action, $namaPengadil,
                $row['jawatan'], $row['kejohanan'] ?? '', $row['tarikh'],
                $row['pasukan_home'], $row['pasukan_away']);

            if (!empty($row['pengadil_id'])) {
                // Portal notification for the pengadil
                $statusLabel = $action === 'accept' ? 'diterima' : 'ditolak';
                createPortalNotification($pdo, (int) $row['pengadil_id'], 'Lantikan ' . ucfirst($statusLabel),
                    "Lantikan {$row['pasukan_home']} lwn {$row['pasukan_away']}",
                    "Anda telah {$statusLabel} lantikan sebagai {$row['jawatan']} untuk {$row['pasukan_home']} lwn {$row['pasukan_away']} ({$row['kejohanan']})."
                );

                // PP Daerah notification
                $persatuanId = (int)($row['persatuan_id'] ?? 0);
                if ($persatuanId) {
                    notifyPPDaerahResponse($pdo, $action, $persatuanId, $namaPengadil,
                        $row['jawatan'], $row['kejohanan'] ?? '', $row['tarikh'],
                        $row['pasukan_home'], $row['pasukan_away']);
                }
            }
        } catch (Throwable $nErr) {
            error_log('[telegram-webhook] notification error: ' . $nErr->getMessage());
        }

        http_response_code(200);
        exit;
    }

} catch (Throwable $e) {
    error_log('[telegram-webhook] FATAL: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    // Even on fatal error, try to stop the loading spinner
    if (isset($cbqId)) {
        try {
            tgAnswerCallback($cbqId, 'Ralat sistem. Sila hubungi admin.', true);
        } catch (Throwable $ignore) {
            // nothing more we can do
        }
    }
}

http_response_code(200);
exit;
