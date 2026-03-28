<?php
/**
 * Telegram Account Linking API (Admin only)
 *
 * GET  ?type=user&id=X   OR  ?type=luar&id=X
 *       → returns current telegram_chat_id and a fresh linking URL.
 *
 * POST { type, id }
 *       → (re)generates tg_link_token, returns linking URL.
 *
 * DELETE ?type=user|luar&id=X
 *       → removes telegram_chat_id and tg_link_token (unlink).
 *
 * Linking Flow:
 *   1. Admin calls POST to get a linking URL for a referee.
 *   2. Admin sends the URL to the referee (e.g. via WhatsApp/SMS).
 *      URL looks like: https://t.me/<BOT_USERNAME>?start=<TOKEN>
 *   3. Referee taps the link → opens Telegram bot → /start TOKEN is sent.
 *   4. api/telegram-webhook.php handles /start, validates TOKEN, saves chat_id.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (!function_exists('env')) {
    require_once __DIR__ . '/../config/env.php';
}

$currentUser = requireRole(['Admin']);

$botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');

try {
    $pdo    = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // ── GET: current status + generate linking URL ────────────────────────────
    if ($method === 'GET') {
        $type = $_GET['type'] ?? '';
        $id   = (int) ($_GET['id'] ?? 0);

        if (!in_array($type, ['user', 'luar'], true) || $id <= 0) {
            jsonResponse(['error' => true, 'message' => 'Parameter type (user|luar) dan id diperlukan.'], 400);
        }

        if ($type === 'user') {
            $row = $pdo->prepare("SELECT id, nama_penuh, telegram_chat_id, tg_link_token FROM users WHERE id = :id");
        } else {
            $row = $pdo->prepare("SELECT id, nama, telegram_chat_id, tg_link_token FROM pengadil_luar WHERE id = :id");
        }
        $row->execute([':id' => $id]);
        $ref = $row->fetch(PDO::FETCH_ASSOC);

        if (!$ref) {
            jsonResponse(['error' => true, 'message' => 'Pengadil tidak ditemui.'], 404);
        }

        $linkUrl = null;
        if (!empty($ref['tg_link_token'])) {
            $linkUrl = "https://t.me/{$botUsername}?start=" . $ref['tg_link_token'];
        }

        jsonResponse([
            'error'              => false,
            'telegram_chat_id'   => $ref['telegram_chat_id'],
            'tg_link_token'      => $ref['tg_link_token'],
            'link_url'           => $linkUrl,
            'linked'             => !empty($ref['telegram_chat_id']),
        ]);
    }

    // ── POST: generate (or regenerate) a linking token ───────────────────────
    if ($method === 'POST') {
        $input = getJsonInput();
        $type  = $input['type'] ?? '';
        $id    = (int) ($input['id'] ?? 0);

        if (!in_array($type, ['user', 'luar'], true) || $id <= 0) {
            jsonResponse(['error' => true, 'message' => 'Parameter type (user|luar) dan id diperlukan.'], 400);
        }

        $table   = $type === 'user' ? 'users' : 'pengadil_luar';
        $token   = bin2hex(random_bytes(16)); // 32 hex chars
        $linkUrl = "https://t.me/{$botUsername}?start={$token}";

        $affected = $pdo->prepare("UPDATE {$table} SET tg_link_token = :tok WHERE id = :id")
            ->execute([':tok' => $token, ':id' => $id]);

        if (!$affected) {
            jsonResponse(['error' => true, 'message' => 'Pengadil tidak ditemui.'], 404);
        }

        jsonResponse([
            'error'    => false,
            'message'  => 'Pautan Telegram telah dijana.',
            'link_url' => $linkUrl,
            'token'    => $token,
        ]);
    }

    // ── DELETE: unlink Telegram from a referee ───────────────────────────────
    if ($method === 'DELETE') {
        $type = $_GET['type'] ?? '';
        $id   = (int) ($_GET['id'] ?? 0);

        if (!in_array($type, ['user', 'luar'], true) || $id <= 0) {
            jsonResponse(['error' => true, 'message' => 'Parameter type (user|luar) dan id diperlukan.'], 400);
        }

        $table = $type === 'user' ? 'users' : 'pengadil_luar';
        $pdo->prepare("UPDATE {$table} SET telegram_chat_id = NULL, tg_link_token = NULL WHERE id = :id")
            ->execute([':id' => $id]);

        jsonResponse(['error' => false, 'message' => 'Akaun Telegram berjaya dinyahpautkan.']);
    }

    jsonResponse(['error' => true, 'message' => 'Method tidak disokong.'], 405);

} catch (Throwable $e) {
    error_log('[telegram-link] ' . $e->getMessage());
    jsonResponse(['error' => true, 'message' => 'Ralat dalaman.'], 500);
}
