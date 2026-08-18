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

// This runner removes the configured webhook before starting long polling.
// Never allow it to execute through the public web server or in production.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/telegram.php';
require_once __DIR__ . '/../config/lantikan-helper.php';

if (env('APP_ENV', 'production') !== 'development') {
    fwrite(STDERR, "ERROR: telegram-poll.php hanya dibenarkan dalam APP_ENV=development.\n");
    exit(1);
}

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
                        echo "  → Sudah terhubung: {$linkedNama}\n";
                    } else {
                        tgSend($chatId,
                            "<b>Sistem Pengurusan Pengadil Pahang FA</b>\n\n" .
                            "Bot ini digunakan untuk menerima notifikasi lantikan perlawanan.\n\n" .
                            "Sila minta pentadbir untuk menghantar pautan pendaftaran Telegram kepada anda."
                        );
                        echo "  → Balas: Arahan tiada token\n";
                    }
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
                        // Token sudah digunakan / digantikan — bukan "tamat tempoh"
                        if ($linkedNama) {
                            tgSend($chatId,
                                "✅ <b>Akaun anda sudah dihubungkan</b>\n\n" .
                                "Selamat kembali, <b>" . htmlspecialchars((string) $linkedNama) . "</b>. " .
                                "Pautan pendaftaran itu sudah digunakan, jadi tiada tindakan lanjut diperlukan.\n\n" .
                                "Anda akan menerima notifikasi Telegram apabila dilantik untuk bertugas."
                            );
                            echo "  → Token lapuk tetapi chat sudah terhubung: {$linkedNama}\n";
                        } else {
                            tgSend($chatId,
                                "⚠️ <b>Pautan Pendaftaran Tidak Aktif</b>\n\n" .
                                "Pautan ini sudah tidak aktif — kemungkinan ia telah digunakan sebelum ini " .
                                "atau digantikan dengan pautan baharu.\n\n" .
                                "Sila minta pentadbir menghantar pautan pendaftaran Telegram yang terbaharu kepada anda."
                            );
                            echo "  → Token lapuk / tiada padanan: {$linkToken}\n";
                        }
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
                SELECT lp.id, lp.status, lp.komen, lp.tarikh_notif, lp.jawatan,
                       jp.tarikh, jp.pasukan_home, jp.pasukan_away, jp.tempat, jp.masa, lp.jadual_id,
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
                echo "  → Token lapuk / tiada padanan: {$tgToken}\n";
                return;
            }

            if ((int) $row['owner_chat_id'] !== $chatId) {
                tgAnswerCallback($cbqId, 'Anda tidak dibenarkan untuk tugasan ini.', true);
                echo "  → Chat ID tidak sepadan\n";
                return;
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
                echo "  → Tempoh tamat, auto-tolak\n";
                return;
            }

            if ($row['status'] !== 'Belum Jawab') {
                $already = $row['status'] === 'Diterima' ? 'sudah diterima' : 'sudah ditolak';
                tgAnswerCallback($cbqId, "Tugasan ini {$already}.", true);
                echo "  → Status sudah: {$row['status']}\n";
                return;
            }

            $newStatus = $action === 'accept' ? 'Diterima' : 'Ditolak';
            $shouldNotifyCompleteKup = false;
            $pdo->beginTransaction();
            try {
                lockMatchForAppointmentResponse($pdo, (int) $row['jadual_id']);

                $updStmt = $pdo->prepare(
                    "UPDATE lantikan_pengadil
                     SET status = :s, tarikh_jawab = NOW(), tg_token = NULL, email_token = NULL
                     WHERE id = :id AND status = 'Belum Jawab'"
                );
                $updStmt->execute([':s' => $newStatus, ':id' => $row['id']]);
                if ($updStmt->rowCount() === 0) {
                    $pdo->rollBack();
                    tgAnswerCallback($cbqId, 'Tugasan ini sudah dijawab.', true);
                    return;
                }

                $jid = (int) $row['jadual_id'];
                syncPerlawananHistoryForJadual($pdo, $jid);
                $shouldNotifyCompleteKup = isKupPosition((string) $row['jawatan'])
                    && isAcceptedKupCrewComplete($pdo, $jid);

                $pdo->commit();
            } catch (Throwable $txErr) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $txErr;
            }

            if ($newStatus === 'Diterima') {
                generatePenilaianToken($pdo, (int) $row['id']);
            }

            if ($shouldNotifyCompleteKup) {
                notifyCompleteKupCrew($pdo, (int) $row['jadual_id']);
            }

            $tarikhFmt = date('d M Y', strtotime($row['tarikh']));
            $pasukan   = htmlspecialchars($row['pasukan_home'] . ' lwn ' . $row['pasukan_away']);
            $jwtn      = htmlspecialchars($row['jawatan']);
            $kupRoster = getMatchKupOfficials($pdo, (int) $row['jadual_id']);
            $kupSection = tgKupOfficialsSection($kupRoster['officials'], $kupRoster['region_label']);

            if ($action === 'accept') {
                $reply = "✅ <b>Tugasan Diterima</b>\n\n" .
                         "Anda telah <b>menerima</b> tugasan sebagai <b>{$jwtn}</b>.\n" .
                         "{$pasukan}\n{$tarikhFmt}" . $kupSection . "\n\n" .
                         "Terima kasih. Sila hadir pada waktu yang ditetapkan.";
                tgAnswerCallback($cbqId, 'Tugasan diterima. Terima kasih!');
                echo "  → Diterima: {$jwtn}\n";
            } else {
                $reply = "❌ <b>Tugasan Ditolak</b>\n\n" .
                         "Anda telah <b>menolak</b> tugasan sebagai <b>{$jwtn}</b>.\n" .
                         "{$pasukan}\n{$tarikhFmt}" . $kupSection . "\n\n" .
                         "Pentadbir akan dimaklumkan. Terima kasih.";
                tgAnswerCallback($cbqId, 'Tugasan ditolak.');
                echo "  → Ditolak: {$jwtn}\n";
            }

            tgEditMessage($chatId, $msgId, $reply);
            return;
        }

    } catch (Throwable $e) {
        if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo "[ERROR] " . $e->getMessage() . "\n";
    }
}
