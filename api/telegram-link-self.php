<?php
/**
 * Telegram Self-Service Linking API
 * Allows authenticated pengadil/penilai to generate their own Telegram link token.
 *
 * POST → generates (or returns existing) tg_link_token, returns linking URL.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (!function_exists('env')) {
    require_once __DIR__ . '/../config/env.php';
}

$currentUser = requireAuth();

$botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');

try {
    $pdo    = getDbConnection();
    $userId = (int) $currentUser['id'];

    // Check if already linked
    $stmt = $pdo->prepare("SELECT telegram_chat_id, tg_link_token FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        jsonResponse(['error' => true, 'message' => 'Pengguna tidak ditemui.'], 404);
    }

    if (!empty($user['telegram_chat_id'])) {
        jsonResponse(['error' => false, 'linked' => true, 'message' => 'Telegram telah dihubungkan.']);
    }

    // Reuse existing token or generate new one
    $token = $user['tg_link_token'];
    if (empty($token)) {
        $token = bin2hex(random_bytes(16));
        $pdo->prepare("UPDATE users SET tg_link_token = ? WHERE id = ?")->execute([$token, $userId]);
    }

    $linkUrl = "https://t.me/{$botUsername}?start={$token}";

    jsonResponse([
        'error'    => false,
        'linked'   => false,
        'link_url' => $linkUrl,
    ]);

} catch (Exception $e) {
    error_log('Telegram self-link error: ' . $e->getMessage());
    jsonResponse(['error' => true, 'message' => 'Ralat dalaman server.'], 500);
}
