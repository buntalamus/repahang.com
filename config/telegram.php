<?php
/**
 * Telegram Bot Helper
 * Manages sending messages and handling inline keyboard callbacks.
 *
 * Setup:
 *   1. Create a bot via @BotFather → copy token into .env TELEGRAM_BOT_TOKEN
 *   2. Register webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://refpahang.com/api/telegram-webhook.php
 */

declare(strict_types=1);

if (!function_exists('env')) {
    require_once __DIR__ . '/env.php';
}

/**
 * Send a Telegram message to a single chat_id.
 *
 * @param int|string $chatId
 * @param string     $text       MarkdownV2-formatted text
 * @param array|null $replyMarkup  Telegram InlineKeyboardMarkup array, or null
 * @return bool
 */
function tgSend(int|string $chatId, string $text, ?array $replyMarkup = null): bool
{
    $token = env('TELEGRAM_BOT_TOKEN', '');
    if ($token === '' || $token === 'your_bot_token_here') {
        error_log('[Telegram] Bot token not configured.');
        return false;
    }

    $payload = [
        'chat_id'    => $chatId,
        'text'       => $text,
        'parse_mode' => 'HTML',
    ];
    if ($replyMarkup !== null) {
        $payload['reply_markup'] = json_encode($replyMarkup, JSON_UNESCAPED_UNICODE);
    }

    $ch = curl_init("https://api.telegram.org/bot{$token}/sendMessage");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $resp = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($resp === false) {
        error_log("[Telegram] curl error: {$err}");
        return false;
    }

    $data = json_decode((string) $resp, true);
    if (!($data['ok'] ?? false)) {
        error_log('[Telegram] API error: ' . ($data['description'] ?? $resp));
        return false;
    }

    return true;
}

/**
 * Answer a Telegram callback query (removes the "loading" spinner on button).
 */
function tgAnswerCallback(string $callbackQueryId, string $text = '', bool $showAlert = false): void
{
    $token = env('TELEGRAM_BOT_TOKEN', '');
    if ($token === '' || $token === 'your_bot_token_here') {
        return;
    }

    $payload = [
        'callback_query_id' => $callbackQueryId,
        'text'              => $text,
        'show_alert'        => $showAlert,
    ];

    $ch = curl_init("https://api.telegram.org/bot{$token}/answerCallbackQuery");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

/**
 * Edit the text of an existing message (to replace buttons after answer).
 */
function tgEditMessage(int|string $chatId, int $messageId, string $text): void
{
    $token = env('TELEGRAM_BOT_TOKEN', '');
    if ($token === '' || $token === 'your_bot_token_here') {
        return;
    }

    $payload = [
        'chat_id'    => $chatId,
        'message_id' => $messageId,
        'text'       => $text,
        'parse_mode' => 'HTML',
    ];

    $ch = curl_init("https://api.telegram.org/bot{$token}/editMessageText");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

/**
 * Build an inline keyboard with Terima / Tolak buttons.
 *
 * Callback data format:  "act:{accept|reject}:token:{TOKEN}"
 */
/**
 * Format a cancellation notification message (HTML).
 */
function tgBatalMessage(
    string $nama,
    string $jawatan,
    string $kejohanan,
    string $tarikh,
    string $masa,
    string $tempat,
    string $pasukanHome,
    string $pasukanAway,
    string $noMatch = ''
): string {
    $tarikhFmt  = date('d M Y', strtotime($tarikh));
    $masaFmt    = $masa ? date('H:i', strtotime($masa)) : '-';
    $noMatchFmt = $noMatch ? 'P' . ltrim($noMatch, '0Pp') : '';
    $matchLine  = htmlspecialchars($pasukanHome) . ' lwn ' . htmlspecialchars($pasukanAway);
    $noLine     = $noMatchFmt ? "<b>No. Perlawanan:</b> {$noMatchFmt}\n" : '';

    return "<b>\u{26D4} Pembatalan Lantikan</b>\n\n" .
           "Assalamualaikum <b>" . htmlspecialchars($nama) . "</b>,\n\n" .
           "Lantikan anda sebagai <b>" . htmlspecialchars($jawatan) . "</b> " .
           "untuk perlawanan berikut telah <b>dibatalkan</b>:\n\n" .
           "<b>Kejohanan:</b> " . htmlspecialchars($kejohanan) . "\n" .
           $noLine .
           "<b>Perlawanan:</b> {$matchLine}\n" .
           "<b>Tarikh:</b> {$tarikhFmt}\n" .
           "<b>Masa:</b> {$masaFmt} WIB\n" .
           "<b>Tempat:</b> " . htmlspecialchars($tempat) . "\n\n" .
           "<i>Sila hubungi pengurus kejohanan untuk maklumat lanjut.</i>";
}

function tgLantikanKeyboard(string $token): array
{
    return [
        'inline_keyboard' => [[
            ['text' => '✅  Terima Tugasan',  'callback_data' => "act:accept:token:{$token}"],
            ['text' => '❌  Tolak Tugasan',   'callback_data' => "act:reject:token:{$token}"],
        ]],
    ];
}

/**
 * Format a match notification message (HTML).
 */
function tgLantikanMessage(
    string $nama,
    string $jawatan,
    string $kejohanan,
    string $tarikh,
    string $masa,
    string $tempat,
    string $pasukanHome,
    string $pasukanAway,
    string $noMatch = ''
): string {
    $tarikhFmt  = date('d M Y', strtotime($tarikh));
    $masaFmt    = $masa ? date('H:i', strtotime($masa)) : '-';
    $noMatchFmt = $noMatch ? 'P' . ltrim($noMatch, '0Pp') : '';
    $matchLine  = htmlspecialchars($pasukanHome) . ' lwn ' . htmlspecialchars($pasukanAway);
    $noLine     = $noMatchFmt ? "<b>No. Perlawanan:</b> {$noMatchFmt}\n" : '';

    $matchDt    = strtotime("$tarikh $masa");
    $deadlineDt = $matchDt ? date('d M Y, H:i', $matchDt - 3 * 3600) : date('d M Y', strtotime($tarikh));

    return "<b>\u{1F3DF} Lantikan Pengadil</b>\n\n" .
           "Assalamualaikum <b>" . htmlspecialchars($nama) . "</b>,\n\n" .
           "Anda telah dilantik sebagai <b>" . htmlspecialchars($jawatan) . "</b> " .
           "untuk perlawanan berikut:\n\n" .
           "<b>Kejohanan:</b> " . htmlspecialchars($kejohanan) . "\n" .
           $noLine .
           "<b>Perlawanan:</b> {$matchLine}\n" .
           "<b>Tarikh:</b> {$tarikhFmt}\n" .
           "<b>Masa:</b> {$masaFmt} WIB\n" .
           "<b>Tempat:</b> " . htmlspecialchars($tempat) . "\n\n" .
           "Sila <b>terima atau tolak</b> tugasan ini <b>sebelum {$deadlineDt}</b> (3 jam sebelum perlawanan).";
}
