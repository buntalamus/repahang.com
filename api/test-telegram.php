<?php
/**
 * Diagnostic: test Telegram connectivity + register webhook
 * DELETE this file after testing!
 *
 * Usage:
 *   GET  /api/test-telegram.php          → diagnostic info
 *   POST /api/test-telegram.php          → register webhook + diagnostic info
 */
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Admin']);

header('Content-Type: application/json');

$token = env('TELEGRAM_BOT_TOKEN', '');
$baseUrl = env('BASE_URL', 'https://refpahang.com');
$webhookTarget = rtrim($baseUrl, '/') . '/api/telegram-webhook.php';

$results = [];

// ── AUTO-REGISTER WEBHOOK on POST ──
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($token) && $token !== 'your_bot_token_here') {
    $regUrl = "https://api.telegram.org/bot{$token}/setWebhook";
    $regPayload = json_encode([
        'url'             => $webhookTarget,
        'allowed_updates' => ['message', 'callback_query'],
    ]);

    $regCtx = stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/json\r\n",
            'content' => $regPayload,
            'timeout' => 15,
        ],
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);

    $regResp = @file_get_contents($regUrl, false, $regCtx);
    $regData = $regResp !== false ? json_decode($regResp, true) : null;

    $results['register_webhook'] = [
        'target_url' => $webhookTarget,
        'success'    => $regData['ok'] ?? false,
        'description'=> $regData['description'] ?? ($regResp === false ? 'Request failed' : $regResp),
    ];
}

// 1. Check curl availability
$results['curl_init_exists'] = function_exists('curl_init');
$results['curl_exec_exists'] = function_exists('curl_exec');

// 2. Check allow_url_fopen
$results['allow_url_fopen'] = ini_get('allow_url_fopen');

// 3. Check disabled functions
$disabled = ini_get('disable_functions');
$results['disabled_functions'] = $disabled ?: '(none)';

// 4. Try file_get_contents to Telegram
$results['bot_token_set'] = !empty($token) && $token !== 'your_bot_token_here';

if ($results['bot_token_set']) {
    $url = "https://api.telegram.org/bot{$token}/getMe";
    
    // Try file_get_contents
    $ctx = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'timeout' => 10,
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);
    
    $resp = @file_get_contents($url, false, $ctx);
    if ($resp !== false) {
        $data = json_decode($resp, true);
        $results['file_get_contents_test'] = 'OK';
        $results['bot_name'] = $data['result']['first_name'] ?? '?';
    } else {
        $results['file_get_contents_test'] = 'FAILED';
        $err = error_get_last();
        $results['file_get_contents_error'] = $err['message'] ?? 'unknown';
    }
}

// 5. Check telegram.php version
$tgFile = realpath(__DIR__ . '/../config/telegram.php');
$results['telegram_php_size'] = filesize($tgFile);
$results['telegram_php_modified'] = date('Y-m-d H:i:s', filemtime($tgFile));
$results['telegram_php_has_tgHttpPost'] = str_contains(file_get_contents($tgFile), 'tgHttpPost');
$results['telegram_php_has_curl_exec_check'] = str_contains(file_get_contents($tgFile), "function_exists('curl_exec')");

// 6. Check webhook registration
if ($results['bot_token_set']) {
    $whUrl = "https://api.telegram.org/bot{$token}/getWebhookInfo";
    $whResp = @file_get_contents($whUrl, false, $ctx);
    if ($whResp !== false) {
        $whData = json_decode($whResp, true);
        $results['webhook_url'] = $whData['result']['url'] ?? '(not set)';
        $results['webhook_pending'] = $whData['result']['pending_update_count'] ?? 0;
        $results['webhook_last_error'] = $whData['result']['last_error_message'] ?? '(none)';
        $results['webhook_last_error_date'] = isset($whData['result']['last_error_date'])
            ? date('Y-m-d H:i:s', $whData['result']['last_error_date'])
            : '(none)';
    }
}

// 7. Recent app.log errors (last 20 lines)
$logFile = __DIR__ . '/../storage/logs/app.log';
if (file_exists($logFile)) {
    $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $results['recent_logs'] = array_slice($lines, -20);
} else {
    $results['recent_logs'] = '(no log file)';
}

// 8. Webhook file check
$whFile = realpath(__DIR__ . '/telegram-webhook.php');
$results['webhook_file_size'] = filesize($whFile);
$results['webhook_file_modified'] = date('Y-m-d H:i:s', filemtime($whFile));
$results['webhook_uses_bootstrap'] = str_contains(file_get_contents($whFile), "require_once __DIR__ . '/bootstrap.php'");

// 9. Check if webhook contains the set_error_handler fix
$results['webhook_has_minimal_setup'] = str_contains(file_get_contents($whFile), 'NO bootstrap.php');

echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
