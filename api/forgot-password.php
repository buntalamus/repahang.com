<?php
/**
 * Forgot Password API
 * POST /api/forgot-password.php
 * Body: { "email": "user@example.com" }
 *
 * Generates a reset token, stores it, and sends an email with the reset link.
 * Uses the 'admin' email account for sending.
 */

declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/email.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => true, 'message' => 'Method not allowed.'], 405);
}

$input = getJsonInput();
$email = trim($input['email'] ?? '');

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => true, 'message' => 'Sila masukkan alamat emel yang sah.'], 400);
}

$pdo = getDbConnection();

// Check if user exists
$stmt = $pdo->prepare("SELECT id, nama_penuh, email, aktif FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

// Always return success to prevent email enumeration
if (!$user || !$user['aktif']) {
    jsonResponse(['error' => false, 'message' => 'Jika emel berdaftar, pautan tetapan semula kata laluan akan dihantar.']);
}

// Rate limit: max 3 requests per hour per user
$stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM password_reset_tokens WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) AND used = 0");
$stmt->execute([$user['id']]);
$count = (int)$stmt->fetch(PDO::FETCH_ASSOC)['cnt'];
if ($count >= 3) {
    jsonResponse(['error' => false, 'message' => 'Jika emel berdaftar, pautan tetapan semula kata laluan akan dihantar.']);
}

// Generate secure token
$token = bin2hex(random_bytes(32));
$expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

// Store token
$stmt = $pdo->prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
$stmt->execute([$user['id'], $token, $expiresAt]);

// Build reset URL
$baseUrl = env('APP_URL', 'https://refpahang.com');
$resetUrl = $baseUrl . '/reset-kata-laluan?token=' . $token;

// Build email
$body = buildEmailTemplate(
    'Tetapan Semula Kata Laluan',
    '#DC2626',
    '',
    <<<HTML
    <p style="font-size:15px;color:#333;margin:0 0 16px;">Salam <strong>{$user['nama_penuh']}</strong>,</p>
    <p style="font-size:14px;color:#555;margin:0 0 16px;">
        Kami menerima permintaan untuk menetapkan semula kata laluan akaun anda. 
        Klik butang di bawah untuk menetapkan kata laluan baharu:
    </p>
    <div style="text-align:center;margin:24px 0;">
        <a href="{$resetUrl}" 
           style="display:inline-block;padding:12px 32px;background:#111827;color:#FADA00;
                  text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">
            Tetapkan Semula Kata Laluan
        </a>
    </div>
    <p style="font-size:13px;color:#888;margin:0 0 8px;">
        Pautan ini akan tamat tempoh dalam <strong>1 jam</strong>.
    </p>
    <p style="font-size:13px;color:#888;margin:0 0 8px;">
        Jika anda tidak membuat permintaan ini, sila abaikan emel ini. 
        Kata laluan anda tidak akan berubah.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
    <p style="font-size:12px;color:#aaa;margin:0;">
        Jika butang tidak berfungsi, salin pautan ini ke pelayar anda:<br/>
        <span style="word-break:break-all;color:#666;">{$resetUrl}</span>
    </p>
    HTML
);

$emailSent = _smtpSend(
    _getEmailAccount('admin'),
    $user['email'],
    $user['nama_penuh'],
    'Tetapan Semula Kata Laluan - Sistem Pengadil Pahang',
    $body
);

if (!$emailSent) {
    error_log("Failed to send password reset email to {$user['email']}");
}

jsonResponse(['error' => false, 'message' => 'Jika emel berdaftar, pautan tetapan semula kata laluan akan dihantar.']);
