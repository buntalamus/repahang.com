<?php

/**
 * Email Configuration & Helper Functions
 * Uses native SMTP with Implicit TLS (port 465).
 * Kelayakan dimuatkan daripada fail .env.
 */

declare(strict_types=1);
require_once __DIR__ . '/env.php';

/**
 * Return SMTP account config for the given email type.
 */
function _getEmailAccount(string $type): array
{
    $host = env('SMTP_HOST', 'mail.refpahang.com');
    $port = (int) env('SMTP_PORT', '465');

    $accounts = [
        'admin' => [
            'host' => $host,
            'port' => $port,
            'user' => env('MAIL_ADMIN_USER', 'admin@refpahang.com'),
            'pass' => env('MAIL_ADMIN_PASS', ''),
            'name' => env('MAIL_ADMIN_NAME', 'Admin RefPahang'),
        ],
        'daftar' => [
            'host' => $host,
            'port' => $port,
            'user' => env('MAIL_DAFTAR_USER', 'daftar@refpahang.com'),
            'pass' => env('MAIL_DAFTAR_PASS', ''),
            'name' => env('MAIL_DAFTAR_NAME', 'Pendaftaran Pengadil Pahang'),
        ],
        'lantikan' => [
            'host' => $host,
            'port' => $port,
            'user' => env('MAIL_LANTIKAN_USER', 'lantikan@refpahang.com'),
            'pass' => env('MAIL_LANTIKAN_PASS', ''),
            'name' => env('MAIL_LANTIKAN_NAME', 'Lantikan Pengadil Pahang'),
        ],
        'support' => [
            'host' => $host,
            'port' => $port,
            'user' => env('MAIL_SUPPORT_USER', 'support@refpahang.com'),
            'pass' => env('MAIL_SUPPORT_PASS', ''),
            'name' => env('MAIL_SUPPORT_NAME', 'Sokongan Pengadil Pahang'),
        ],
        'pengesahan' => [
            'host' => $host,
            'port' => $port,
            'user' => env('MAIL_PENGESAHAN_USER', 'pengesahan@refpahang.com'),
            'pass' => env('MAIL_PENGESAHAN_PASS', ''),
            'name' => env('MAIL_PENGESAHAN_NAME', 'Pengesahan Perlawanan Pahang'),
        ],
    ];

    return $accounts[$type] ?? $accounts['admin'];
}

/**
 * Low-level SMTP sender using stream_socket_client (Implicit TLS, port 465).
 */
function _smtpSend(array $account, string $to, string $toName, string $subject, string $htmlBody, array $inlineImages = []): bool
{
    $host      = $account['host'];
    $port      = $account['port'];
    $user      = $account['user'];
    $pass      = $account['pass'];
    $fromEmail = $user;
    $fromName  = $account['name'];

    $context = stream_context_create([
        'ssl' => [
            'verify_peer'       => true,
            'verify_peer_name'  => true,
            'allow_self_signed' => false,
        ],
    ]);

    $errno  = 0;
    $errstr = '';
    $socket = @stream_socket_client(
        "ssl://{$host}:{$port}",
        $errno,
        $errstr,
        30,
        STREAM_CLIENT_CONNECT,
        $context
    );

    if (!$socket) {
        error_log("SMTP connect failed [{$errno}]: {$errstr}");
        return false;
    }

    stream_set_timeout($socket, 15);

    // Drain all lines of a multi-line SMTP response (e.g. 220- or 250-)
    // Returns the last line (the one with a space at position 3: "XXX text")
    $drain = static function (string $firstLine = '') use ($socket): string {
        $last = $firstLine;
        // If already a final line (pos 3 is space or line is short), return immediately
        if ($firstLine === '' || (strlen($firstLine) >= 4 && $firstLine[3] === ' ') || strlen($firstLine) < 4) {
            if ($firstLine === '') {
                $last = (string) fgets($socket, 512);
            }
            while (strlen($last) >= 4 && $last[3] === '-') {
                $last = (string) fgets($socket, 512);
            }
        } else {
            while (strlen($last) >= 4 && $last[3] === '-') {
                $last = (string) fgets($socket, 512);
            }
        }
        return $last;
    };

    // Send a command, drain multi-line response, return last line
    $cmd = static function (string $line) use ($socket, $drain): string {
        fwrite($socket, $line . "\r\n");
        return $drain();
    };

    // Greeting — may be multi-line (220-xxx / 220 xxx)
    $resp = $drain();
    if (!str_starts_with($resp, '220')) {
        fclose($socket);
        error_log("SMTP: unexpected greeting: {$resp}");
        return false;
    }

    // EHLO — drain full multi-line response
    $ehloHost = gethostname() ?: 'localhost';
    $cmd("EHLO {$ehloHost}");

    // AUTH LOGIN
    $r = $cmd('AUTH LOGIN');
    if (!str_starts_with($r, '334')) {
        fclose($socket);
        error_log("SMTP: AUTH LOGIN not accepted: {$r}");
        return false;
    }
    $r = $cmd(base64_encode($user));
    if (!str_starts_with($r, '334')) {
        fclose($socket);
        error_log("SMTP: username rejected: {$r}");
        return false;
    }
    $r = $cmd(base64_encode($pass));
    if (!str_starts_with($r, '235')) {
        fclose($socket);
        error_log("SMTP: password rejected: {$r}");
        return false;
    }

    // MAIL FROM
    $r = $cmd("MAIL FROM:<{$fromEmail}>");
    if (!str_starts_with($r, '250')) {
        fclose($socket);
        error_log("SMTP: MAIL FROM rejected: {$r}");
        return false;
    }

    // RCPT TO
    $r = $cmd("RCPT TO:<{$to}>");
    if (!str_starts_with($r, '250') && !str_starts_with($r, '251')) {
        fclose($socket);
        error_log("SMTP: RCPT TO rejected: {$r}");
        return false;
    }

    // DATA
    $r = $cmd('DATA');
    if (!str_starts_with($r, '354')) {
        fclose($socket);
        error_log("SMTP: DATA not accepted: {$r}");
        return false;
    }

    // Build MIME message
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $encodedFrom    = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
    $encodedToName  = '=?UTF-8?B?' . base64_encode($toName ?: $to) . '?=';
    $altBoundary    = bin2hex(random_bytes(16));
    $date           = date('r');
    $msgId          = '<' . bin2hex(random_bytes(8)) . '@' . $host . '>';

    $plainText = wordwrap(strip_tags(html_entity_decode($htmlBody)), 76, "\r\n");

    // Build the multipart/alternative part (text + html)
    $altPart  = "--{$altBoundary}\r\n";
    $altPart .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $altPart .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $altPart .= chunk_split(base64_encode($plainText)) . "\r\n";
    $altPart .= "--{$altBoundary}\r\n";
    $altPart .= "Content-Type: text/html; charset=UTF-8\r\n";
    $altPart .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $altPart .= chunk_split(base64_encode($htmlBody)) . "\r\n";
    $altPart .= "--{$altBoundary}--\r\n";

    $message  = "Date: {$date}\r\n";
    $message .= "Message-ID: {$msgId}\r\n";
    $message .= "From: {$encodedFrom} <{$fromEmail}>\r\n";
    $message .= "To: {$encodedToName} <{$to}>\r\n";
    $message .= "Subject: {$encodedSubject}\r\n";
    $message .= "MIME-Version: 1.0\r\n";

    if (!empty($inlineImages)) {
        // multipart/related wrapping multipart/alternative + CID images
        $relBoundary = bin2hex(random_bytes(16));
        $message .= "Content-Type: multipart/related; boundary=\"{$relBoundary}\"\r\n";
        $message .= "\r\n";
        $message .= "--{$relBoundary}\r\n";
        $message .= "Content-Type: multipart/alternative; boundary=\"{$altBoundary}\"\r\n";
        $message .= "\r\n";
        $message .= $altPart;
        foreach ($inlineImages as $img) {
            // $img = ['cid' => 'logo_home', 'mime' => 'image/jpeg', 'data' => <binary>]
            $message .= "--{$relBoundary}\r\n";
            $message .= "Content-Type: {$img['mime']}\r\n";
            $message .= "Content-Transfer-Encoding: base64\r\n";
            $message .= "Content-ID: <{$img['cid']}>\r\n";
            $message .= "Content-Disposition: inline\r\n\r\n";
            $message .= chunk_split(base64_encode($img['data'])) . "\r\n";
        }
        $message .= "--{$relBoundary}--\r\n";
    } else {
        // Simple multipart/alternative (no images)
        $message .= "Content-Type: multipart/alternative; boundary=\"{$altBoundary}\"\r\n";
        $message .= "\r\n";
        $message .= $altPart;
    }

    // RFC 5321 dot-stuffing: escape lines that start with a dot
    $message = str_replace("\r\n.", "\r\n..", $message);

    fwrite($socket, $message . "\r\n.\r\n");

    $r = $drain();
    if (!str_starts_with($r, '250')) {
        fclose($socket);
        error_log("SMTP: message rejected after DATA: {$r}");
        return false;
    }

    fwrite($socket, "QUIT\r\n");
    fclose($socket);

    error_log("Email sent: to={$to} from={$fromEmail} subject={$subject}");
    return true;
}

/**
 * Send a transactional email.
 *
 * @param string      $to      Recipient email address
 * @param string      $subject Email subject
 * @param string      $html    Email body (HTML)
 * @param string|null $toName  Recipient display name (optional)
 * @param string      $type    Sender identity: 'admin' | 'daftar' | 'lantikan' | 'support'
 */
// ============================================================
// Email template builder helpers
// ============================================================

/**
 * Build a standardised full HTML email.
 *
 * @param string $title   Email title shown below the header
 * @param string $accent  Hex accent colour e.g. '#16A34A' — used for top bar & title border
 * @param string $icon    Kept for backward compatibility; not rendered
 * @param string $body    Inner HTML for the white content area
 */
function buildEmailTemplate(string $title, string $accent, string $icon, string $body): string
{
    $year = date('Y');
    return <<<HTML
<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#E8EAED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E8EAED;">
    <tr><td align="center" style="padding:40px 16px 48px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;background:#ffffff;
                    box-shadow:0 1px 4px rgba(0,0,0,0.10);">

        <!-- TOP ACCENT LINE -->
        <tr>
          <td style="background:{$accent};height:4px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- HEADER -->
        <tr>
          <td style="background:#111827;padding:28px 36px 24px;text-align:center;">
            <img src="https://upload.wikimedia.org/wikipedia/en/b/b3/Pahang_FA_logo.png"
                 alt="PBNP" width="60" height="60"
                 style="width:60px;height:60px;border-radius:50%;
                        display:block;margin:0 auto 14px;">
            <div style="color:#F9FAFB;font-size:14px;font-weight:700;
                        letter-spacing:0.8px;margin-bottom:4px;">
              PERSATUAN BOLA SEPAK NEGERI PAHANG
            </div>
            <div style="color:#6B7280;font-size:10px;font-weight:600;
                        letter-spacing:2.5px;text-transform:uppercase;">
              Sistem Pengurusan Pengadil
            </div>
          </td>
        </tr>

        <!-- TITLE -->
        <tr>
          <td style="background:#F9FAFB;padding:22px 36px;
                     border-bottom:1px solid #E5E7EB;">
            <div style="border-left:3px solid {$accent};padding-left:14px;">
              <div style="color:#9CA3AF;font-size:10px;font-weight:700;
                          text-transform:uppercase;letter-spacing:2px;
                          margin-bottom:5px;">Pemberitahuan Rasmi</div>
              <div style="color:#111827;font-size:20px;font-weight:700;
                          line-height:1.3;">{$title}</div>
            </div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:32px 36px 36px;">
            {$body}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#111827;padding:24px 36px;text-align:center;">
            <div style="color:#F9FAFB;font-size:12px;font-weight:600;
                        margin-bottom:10px;letter-spacing:0.3px;">
              Unit Pengadil &mdash; Persatuan Bola Sepak Negeri Pahang
            </div>
            <div style="color:#9CA3AF;font-size:12px;margin-bottom:14px;">
              <a href="mailto:admin@refpahang.com"
                 style="color:#FADA00;text-decoration:none;">admin@refpahang.com</a>
              &nbsp;&nbsp;&bull;&nbsp;&nbsp;
              <a href="mailto:support@refpahang.com"
                 style="color:#FADA00;text-decoration:none;">support@refpahang.com</a>
            </div>
            <div style="color:#4B5563;font-size:10px;
                        border-top:1px solid #374151;padding-top:14px;">
              &copy; {$year} Persatuan Bola Sepak Negeri Pahang. Hak Cipta Terpelihara.
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
}

/** Greeting paragraph */
function emailGreeting(string $nama): string
{
    return "<p style=\"color:#6B7280;font-size:14px;line-height:1.7;margin:0 0 4px 0;\">
              Assalamualaikum w.b.t. dan Salam Sejahtera,
            </p>
            <p style=\"color:#111827;font-size:15px;font-weight:600;margin:0 0 22px 0;
                       border-bottom:1px solid #F3F4F6;padding-bottom:18px;\">
              " . htmlspecialchars($nama) . ",
            </p>";
}

/** Generic paragraph */
function emailPara(string $text): string
{
    return "<p style=\"color:#374151;font-size:14px;line-height:1.8;margin:0 0 16px 0;\">{$text}</p>";
}

/** Coloured alert / notice box */
function emailAlert(string $borderColor, string $bgColor, string $label, string $text): string
{
    return "<div style=\"background:{$bgColor};border-left:3px solid {$borderColor};
                         padding:14px 18px;margin:20px 0;\">
              <div style=\"font-weight:700;color:#111827;margin-bottom:5px;font-size:12px;
                          text-transform:uppercase;letter-spacing:0.8px;\">
                {$label}
              </div>
              <div style=\"color:#374151;font-size:14px;line-height:1.6;\">{$text}</div>
            </div>";
}

/** Key–value info table. Accepts [['Label','Value'],...] or ['Label'=>'Value',...] */
function emailInfoTable(array $rows): string
{
    // Normalise both indexed-pairs and associative formats
    $pairs = [];
    foreach ($rows as $k => $v) {
        if (is_array($v)) {
            $pairs[] = [(string) $v[0], (string) $v[1]];
        } else {
            $pairs[] = [(string) $k, (string) $v];
        }
    }
    $html = "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"
                    style=\"margin:20px 0;border:1px solid #E5E7EB;border-collapse:collapse;\">";
    $last = count($pairs) - 1;
    foreach ($pairs as $i => [$label, $value]) {
        $border = $i < $last ? 'border-bottom:1px solid #E5E7EB;' : '';
        $bg     = $i % 2 === 0 ? '#F9FAFB' : '#ffffff';
        $html .= "<tr>
                    <td style=\"padding:10px 16px;font-weight:600;color:#6B7280;
                                font-size:11px;text-transform:uppercase;letter-spacing:0.8px;
                                width:36%;background:{$bg};{$border}\">"
                 . htmlspecialchars($label) . "</td>
                    <td style=\"padding:10px 16px;color:#111827;font-size:14px;
                                background:{$bg};{$border}\">"
                 . $value . "</td>
                  </tr>";
    }
    $html .= "</table>";
    return $html;
}

/** Credential / password box */
function emailCredBox(string $label, string $value): string
{
    return "<div style=\"margin:10px 0;\">
              <div style=\"font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;
                           letter-spacing:1px;margin-bottom:5px;\">{$label}</div>
              <div style=\"background:#F3F4F6;border:1px solid #D1D5DB;
                           padding:10px 14px;font-family:'Courier New',monospace;
                           font-size:15px;color:#111827;word-break:break-all;\">{$value}</div>
            </div>";
}

/** CTA button */
function emailButton(string $url, string $label): string
{
    return "<div style=\"text-align:center;margin:28px 0 8px;\">
              <a href=\"{$url}\"
                 style=\"display:inline-block;background:#111827;color:#FADA00;
                         padding:12px 32px;text-decoration:none;
                         font-weight:700;font-size:13px;letter-spacing:1px;
                         text-transform:uppercase;\">{$label}</a>
            </div>";
}

/** Ordered list */
function emailOrderedList(array $items): string
{
    $html = "<ol style=\"color:#374151;font-size:14px;line-height:1.8;margin:0 0 16px 0;padding-left:20px;\">";
    foreach ($items as $item) {
        $html .= "<li style=\"margin-bottom:6px;\">{$item}</li>";
    }
    $html .= "</ol>";
    return $html;
}

/** Status badge */
function emailStatusBadge(string $text, string $bg, string $color = '#ffffff'): string
{
    return "<div style=\"text-align:center;margin:20px 0;\">
              <span style=\"display:inline-block;background:{$bg};color:{$color};
                            padding:6px 20px;font-weight:700;font-size:11px;
                            letter-spacing:1.5px;text-transform:uppercase;\">{$text}</span>
            </div>";
}

function sendEmail(string $to, string $subject, string $html, ?string $toName = null, string $type = 'admin', array $inlineImages = []): bool
{
    $account = _getEmailAccount($type);
    return _smtpSend($account, $to, $toName ?? $to, $subject, $html, $inlineImages);
}

/**
 * Send lantikan notification email to a referee.
 *
 * @param string      $to            Referee email address
 * @param string      $nama          Referee name
 * @param string      $jawatan       e.g. "Pengadil Utama"
 * @param string      $kejohanan     Tournament name
 * @param string      $tarikh        Match date (YYYY-MM-DD)
 * @param string      $masa          Match time (HH:MM:SS or empty)
 * @param string      $tempat        Venue
 * @param string      $pasukan       "Home vs Away"
 * @param string      $emailToken    Token for one-click accept/reject via email
 * @param string|null $tgLinkUrl     Telegram linking URL (null if already linked)
 * @param bool        $isDashboard   True if referee has a dashboard (registered)
 */
function sendLantikanEmail(
    string  $to,
    string  $nama,
    string  $jawatan,
    string  $kejohanan,
    string  $tarikh,
    string  $masa,
    string  $tempat,
    string  $pasukanHome,
    string  $pasukanAway,
    string  $emailToken,
    ?string $tgLinkUrl    = null,
    bool    $isDashboard  = false,
    string  $noMatch      = '',
    string  $logoHome     = '',
    string  $logoAway     = '',
    array   $allOfficials = [],
    string  $jenisKejohanan = 'Persahabatan'
): bool {
    if (!function_exists('env')) {
        require_once __DIR__ . '/env.php';
    }
    $baseUrl   = env('BASE_URL', 'https://refpahang.com');
    $acceptUrl = $baseUrl . '/api/lantikan-jawab-token.php?token=' . urlencode($emailToken) . '&action=accept';
    $rejectUrl = $baseUrl . '/api/lantikan-jawab-token.php?token=' . urlencode($emailToken) . '&action=reject';

    $tarikhFmt = date('d M Y', strtotime($tarikh));
    $masaFmt   = $masa ? date('H:i', strtotime($masa)) : '-';
    $noMatchFmt = $noMatch ? 'P' . ltrim($noMatch, '0Pp') : '-';

    // ── Logo helpers — embed as CID inline images ─────────────────────
    $inlineImages = [];
    $projectRoot  = realpath(__DIR__ . '/..');

    $makeLogo = function (string $logoPath, string $namaTeam, string $cidName) use ($projectRoot, &$inlineImages): string {
        if ($logoPath) {
            // Try to read file from disk and embed as CID
            $filePath = $projectRoot . $logoPath;
            if (file_exists($filePath) && ($data = file_get_contents($filePath)) !== false) {
                $ext  = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
                $mime = match ($ext) {
                    'jpg', 'jpeg' => 'image/jpeg',
                    'png'         => 'image/png',
                    'gif'         => 'image/gif',
                    'webp'        => 'image/webp',
                    default       => 'image/png',
                };
                $inlineImages[] = ['cid' => $cidName, 'mime' => $mime, 'data' => $data];
                return "<img src=\"cid:{$cidName}\" alt=\"" . htmlspecialchars($namaTeam) . "\"
                            width=\"72\" height=\"72\"
                            style=\"width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;\">";
            }
            // Fallback to remote URL if file not readable
            $url = strpos($logoPath, 'http') === 0 ? $logoPath : $baseUrl . $logoPath;
            return "<img src=\"" . htmlspecialchars($url) . "\" alt=\"" . htmlspecialchars($namaTeam) . "\"
                        width=\"72\" height=\"72\"
                        style=\"width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;\">";
        }
        // Placeholder circle with team initial
        $initial = mb_strtoupper(mb_substr(trim($namaTeam), 0, 1));
        return "<div style=\"width:72px;height:72px;border-radius:50%;background:#E5E7EB;
                             display:flex;align-items:center;justify-content:center;
                             font-size:28px;font-weight:700;color:#6B7280;margin:0 auto;
                             line-height:72px;text-align:center;\">{$initial}</div>";
    };

    // ── Section: Maklumat Perlawanan ──────────────────────────────────────
    $infoRows = [
        ['Kejohanan',     htmlspecialchars($kejohanan)],
        ['No. Perlawanan', htmlspecialchars($noMatchFmt)],
        ['Tarikh',        $tarikhFmt],
        ['Masa',          $masaFmt . ' WIB'],
        ['Tempat',        htmlspecialchars($tempat)],
    ];
    $infoHtml = '';
    foreach ($infoRows as $i => [$lbl, $val]) {
        $bg = $i % 2 === 0 ? '#1F2937' : '#111827';
        $infoHtml .= "<tr>
            <td style=\"padding:10px 16px;font-size:11px;font-weight:600;color:#9CA3AF;
                        text-transform:uppercase;letter-spacing:.8px;width:38%;background:{$bg};
                        border-bottom:1px solid #374151;\">{$lbl}</td>
            <td style=\"padding:10px 16px;font-size:13px;color:#F9FAFB;background:{$bg};
                        border-bottom:1px solid #374151;\">{$val}</td>
          </tr>";
    }

    $sectionInfo = "
    <div style=\"margin:28px 0 0;\">
      <div style=\"background:#FADA00;padding:9px 16px;\">
        <span style=\"font-size:10px;font-weight:700;color:#111827;letter-spacing:2px;
                      text-transform:uppercase;\">Maklumat Perlawanan</span>
      </div>
      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"
             style=\"border-collapse:collapse;border:1px solid #374151;\">
        {$infoHtml}
      </table>
    </div>";

    // ── Section: Pasukan ──────────────────────────────────────────────────
    $logoHomeHtml = $makeLogo($logoHome, $pasukanHome, 'logo_home');
    $logoAwayHtml = $makeLogo($logoAway, $pasukanAway, 'logo_away');

    $sectionPasukan = "
    <div style=\"margin:20px 0 0;\">
      <div style=\"background:#FADA00;padding:9px 16px;\">
        <span style=\"font-size:10px;font-weight:700;color:#111827;letter-spacing:2px;
                      text-transform:uppercase;\">Pasukan</span>
      </div>
      <div style=\"background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;padding:24px 16px;\">
        <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
          <tr>
            <td width=\"44%\" style=\"text-align:center;vertical-align:middle;\">
              {$logoHomeHtml}
              <div style=\"font-weight:700;font-size:12px;color:#111827;margin-top:10px;
                          text-transform:uppercase;line-height:1.4;\">"
                  . htmlspecialchars($pasukanHome) . "
              </div>
              <div style=\"font-size:10px;color:#9CA3AF;margin-top:3px;\">Tuan Rumah</div>
            </td>
            <td width=\"12%\" style=\"text-align:center;vertical-align:middle;\">
              <div style=\"font-size:13px;font-weight:700;color:#374151;letter-spacing:1px;\">VS</div>
            </td>
            <td width=\"44%\" style=\"text-align:center;vertical-align:middle;\">
              {$logoAwayHtml}
              <div style=\"font-weight:700;font-size:12px;color:#111827;margin-top:10px;
                          text-transform:uppercase;line-height:1.4;\">"
                  . htmlspecialchars($pasukanAway) . "
              </div>
              <div style=\"font-size:10px;color:#9CA3AF;margin-top:3px;\">Pasukan Tamu</div>
            </td>
          </tr>
        </table>
      </div>
    </div>";

    // ── Section: Pegawai Perlawanan ───────────────────────────────────────
    $officialsHtml = '';
    if (!empty($allOfficials)) {
        $offRows = '';
        foreach ($allOfficials as $i => $off) {
            $isMe = strtolower(trim($off['jawatan'])) === strtolower(trim($jawatan));
            $bg   = $isMe ? '#FEFCE8' : ($i % 2 === 0 ? '#F9FAFB' : '#ffffff');
            $namStyle = $isMe
                ? 'font-size:13px;color:#92400E;font-weight:700;'
                : 'font-size:13px;color:#111827;';
            $jwStyle  = $isMe
                ? 'font-size:11px;color:#92400E;font-weight:700;text-transform:uppercase;letter-spacing:.8px;'
                : 'font-size:11px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:.8px;';
            $badge = $isMe
                ? '<span style="display:inline-block;background:#FADA00;color:#111827;
                                font-size:9px;font-weight:700;letter-spacing:1px;
                                text-transform:uppercase;padding:2px 7px;margin-left:6px;
                                vertical-align:middle;">Anda</span>'
                : '';
            $border = 'border-bottom:1px solid #E5E7EB;';
            $offRows .= "<tr>
                <td style=\"padding:10px 16px;{$jwStyle}background:{$bg};{$border}\">"
                    . htmlspecialchars($off['jawatan']) . "</td>
                <td style=\"padding:10px 16px;{$namStyle}background:{$bg};{$border}\">"
                    . htmlspecialchars($off['nama']) . $badge . "</td>
              </tr>";
        }
        $officialsHtml = "
        <div style=\"margin:20px 0 0;\">
          <div style=\"background:#FADA00;padding:9px 16px;\">
            <span style=\"font-size:10px;font-weight:700;color:#111827;letter-spacing:2px;
                          text-transform:uppercase;\">Pegawai Perlawanan</span>
          </div>
          <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"
                 style=\"border-collapse:collapse;border:1px solid #E5E7EB;border-top:none;\">
            {$offRows}
          </table>
        </div>";
    }

    // ── Accept / Reject buttons ───────────────────────────────────────────
    require_once __DIR__ . '/lantikan-helper.php';
    $deadlineHours = getDeadlineHours($jenisKejohanan);
    $deadlineDt    = calcDeadlineFromNotif($jenisKejohanan);
    $ruleText      = getDeadlineRuleText($jenisKejohanan);
    $buttonsHtml = "
    <div style=\"margin:28px 0 0;\">
      <p style=\"color:#374151;font-size:13px;line-height:1.8;margin:0 0 10px 0;\">
        Sila maklumkan penerimaan atau penolakan tugasan ini <strong>sebelum {$deadlineDt}</strong> ({$deadlineHours} jam selepas notifikasi ini dihantar).
      </p>
      <div style=\"background:#FEF3C7;border:1px solid #F59E0B;border-left:3px solid #F59E0B;
                   padding:12px 16px;margin-bottom:16px;\">
        <span style=\"font-size:12px;font-weight:700;color:#92400E;\">⚠ Peraturan Auto-Tolak:</span>
        <p style=\"font-size:12px;color:#78350F;line-height:1.6;margin:4px 0 0;\">{$ruleText}</p>
      </div>
      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
        <tr>
          <td style=\"padding:0 6px 0 0;\">
            <a href=\"" . htmlspecialchars($acceptUrl) . "\"
               style=\"display:block;text-align:center;background:#059669;color:#ffffff;
                       padding:14px 0;text-decoration:none;font-weight:700;font-size:12px;
                       letter-spacing:1px;text-transform:uppercase;\">
              ✓ &nbsp;Terima Tugasan
            </a>
          </td>
          <td style=\"padding:0 0 0 6px;\">
            <a href=\"" . htmlspecialchars($rejectUrl) . "\"
               style=\"display:block;text-align:center;background:#DC2626;color:#ffffff;
                       padding:14px 0;text-decoration:none;font-weight:700;font-size:12px;
                       letter-spacing:1px;text-transform:uppercase;\">
              ✗ &nbsp;Tolak Tugasan
            </a>
          </td>
        </tr>
      </table>
    </div>";

    // ── Telegram section ──────────────────────────────────────────────────
    $tgSection = '';
    if ($tgLinkUrl !== null) {
        $tgSection = "
        <div style=\"margin:24px 0 0;padding:16px 20px;background:#EFF6FF;
                     border:1px solid #BFDBFE;border-left:3px solid #3B82F6;\">
          <div style=\"font-weight:700;font-size:11px;color:#1E40AF;
                       text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;\">
            Hubungkan Akaun Telegram
          </div>
          <p style=\"color:#374151;font-size:13px;line-height:1.7;margin:0 0 14px 0;\">
            Dapatkan notifikasi perlawanan terus melalui Telegram dan jawab tugasan dengan
            lebih pantas menggunakan butang <em>Terima / Tolak</em> dalam Telegram.
          </p>
          <a href=\"" . htmlspecialchars($tgLinkUrl) . "\"
             style=\"display:inline-block;background:#2563EB;color:#ffffff;
                     padding:9px 20px;text-decoration:none;font-weight:700;
                     font-size:11px;letter-spacing:.8px;text-transform:uppercase;\">
            Daftar Telegram Sekarang
          </a>
        </div>";
    }

    // ── Dashboard button ──────────────────────────────────────────────────
    $dashSection = '';
    if ($isDashboard) {
        $dashSection = "
        <div style=\"border-top:1px solid #F3F4F6;margin-top:24px;padding-top:20px;text-align:center;\">
          <p style=\"color:#6B7280;font-size:12px;margin:0 0 12px 0;\">
            Lihat semua tugasan anda dalam dashboard:
          </p>"
          . emailButton($baseUrl . '/pengadil-dashboard.html', 'Dashboard Pengadil') . "
        </div>";
    }

    // ── Assemble body ─────────────────────────────────────────────────────
    $body =
        emailGreeting($nama) .
        emailPara("Anda telah dilantik sebagai <strong>" . htmlspecialchars($jawatan) . "</strong> untuk perlawanan berikut:") .
        $sectionInfo .
        $sectionPasukan .
        $officialsHtml .
        $buttonsHtml .
        $tgSection .
        $dashSection .
        "<p style=\"color:#9CA3AF;font-size:11px;margin:24px 0 0;line-height:1.6;\">
           Pautan Terima/Tolak di atas hanya boleh digunakan sekali sahaja. Jika anda telah
           menjawab melalui Telegram atau dashboard, pautan ini tidak akan berfungsi lagi.
           Pautan ini juga akan terbatal selepas tempoh menjawab tamat.
         </p>";

    $subject = 'Lantikan Perlawanan: ' . $kejohanan
             . ($noMatchFmt !== '-' ? ' (No: ' . $noMatchFmt . ')' : '')
             . ' — ' . $pasukanHome . ' vs ' . $pasukanAway
             . ' — ' . $tarikhFmt;

    $html = buildEmailTemplate('Lantikan Pengadil', '#FADA00', '', $body);
    return sendEmail($to, $subject, $html, $nama, 'lantikan', $inlineImages);
}

/**
 * Send a cancellation notification email to a referee.
 */
function sendBatalEmail(
    string  $to,
    string  $nama,
    string  $jawatan,
    string  $kejohanan,
    string  $tarikh,
    string  $masa,
    string  $tempat,
    string  $pasukanHome,
    string  $pasukanAway,
    string  $noMatch  = '',
    string  $logoHome = '',
    string  $logoAway = '',
    bool    $isDashboard = false,
    string  $status = 'Dibatalkan',
    string  $sebab = ''
): bool {
    if (!function_exists('env')) {
        require_once __DIR__ . '/env.php';
    }
    $baseUrl    = env('BASE_URL', 'https://refpahang.com');
    $tarikhFmt  = date('d M Y', strtotime($tarikh));
    $masaFmt    = $masa ? date('H:i', strtotime($masa)) : '-';
    $noMatchFmt = $noMatch ? 'P' . ltrim($noMatch, '0Pp') : '-';

    // ── Logo helper — embed as CID inline images ───────────────────────
    $inlineImages = [];
    $projectRoot  = realpath(__DIR__ . '/..');

    $makeLogo = function (string $logoPath, string $namaTeam, string $cidName) use ($projectRoot, $baseUrl, &$inlineImages): string {
        if ($logoPath) {
            $filePath = $projectRoot . $logoPath;
            if (file_exists($filePath) && ($data = file_get_contents($filePath)) !== false) {
                $ext  = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
                $mime = match ($ext) {
                    'jpg', 'jpeg' => 'image/jpeg',
                    'png'         => 'image/png',
                    'gif'         => 'image/gif',
                    'webp'        => 'image/webp',
                    default       => 'image/png',
                };
                $inlineImages[] = ['cid' => $cidName, 'mime' => $mime, 'data' => $data];
                return "<img src=\"cid:{$cidName}\" alt=\"" . htmlspecialchars($namaTeam) . "\"
                            width=\"72\" height=\"72\"
                            style=\"width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;
                                    opacity:0.5;filter:grayscale(100%)\">";
            }
            $url = strpos($logoPath, 'http') === 0 ? $logoPath : $baseUrl . $logoPath;
            return "<img src=\"" . htmlspecialchars($url) . "\" alt=\"" . htmlspecialchars($namaTeam) . "\"
                        width=\"72\" height=\"72\"
                        style=\"width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;
                                opacity:0.5;filter:grayscale(100%)\">";
        }
        $initial = mb_strtoupper(mb_substr(trim($namaTeam), 0, 1));
        return "<div style=\"width:72px;height:72px;border-radius:50%;background:#E5E7EB;
                             font-size:28px;font-weight:700;color:#9CA3AF;margin:0 auto;
                             line-height:72px;text-align:center;\">{$initial}</div>";
    };

    $isPostponed = $status === 'Ditangguhkan';
    $title = $isPostponed ? 'Perlawanan Ditangguhkan' : 'Perlawanan Dibatalkan';
    $statusText = $isPostponed ? 'ditangguhkan' : 'dibatalkan';
    $accent = $isPostponed ? '#D97706' : '#DC2626';

    // ── Cancellation / postponement notice ─────────────────────────────────
    $noticeBanner = "
    <div style=\"background:#FEF2F2;border:1px solid #FECACA;border-left:4px solid {$accent};
                 padding:16px 20px;margin:0 0 4px;\">
      <div style=\"font-weight:700;font-size:12px;color:#991B1B;text-transform:uppercase;
                   letter-spacing:.8px;margin-bottom:6px;\">⊗ &nbsp;{$title}</div>
      <p style=\"color:#7F1D1D;font-size:13px;line-height:1.7;margin:0;\">
        Lantikan anda sebagai <strong>" . htmlspecialchars($jawatan) . "</strong>
        telah {$statusText} oleh pengurus kejohanan."
        . ($sebab !== '' ? "<br><strong>Sebab:</strong> " . nl2br(htmlspecialchars($sebab)) : '') . "
      </p>
    </div>";

    // ── Match info (dark table, strikethrough style) ───────────────────────
    $infoRows = [
        ['Kejohanan',      htmlspecialchars($kejohanan)],
        ['No. Perlawanan', htmlspecialchars($noMatchFmt)],
        ['Tarikh',         $tarikhFmt],
        ['Masa',           $masaFmt . ' WIB'],
        ['Tempat',         htmlspecialchars($tempat)],
    ];
    $infoHtml = '';
    foreach ($infoRows as $i => [$lbl, $val]) {
        $bg = $i % 2 === 0 ? '#1F2937' : '#111827';
        $infoHtml .= "<tr>
            <td style=\"padding:10px 16px;font-size:11px;font-weight:600;color:#9CA3AF;
                        text-transform:uppercase;letter-spacing:.8px;width:38%;background:{$bg};
                        border-bottom:1px solid #374151;\">{$lbl}</td>
            <td style=\"padding:10px 16px;font-size:13px;color:#9CA3AF;background:{$bg};
                        border-bottom:1px solid #374151;text-decoration:line-through;\">{$val}</td>
          </tr>";
    }
    $sectionInfo = "
    <div style=\"margin:20px 0 0;\">
      <div style=\"background:#6B7280;padding:9px 16px;\">
        <span style=\"font-size:10px;font-weight:700;color:#F9FAFB;letter-spacing:2px;
                      text-transform:uppercase;\">Maklumat Perlawanan</span>
      </div>
      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"
             style=\"border-collapse:collapse;border:1px solid #374151;\">
        {$infoHtml}
      </table>
    </div>";

    // ── Pasukan section (greyed out) ──────────────────────────────────────
    $logoHomeHtml = $makeLogo($logoHome, $pasukanHome, 'logo_home');
    $logoAwayHtml = $makeLogo($logoAway, $pasukanAway, 'logo_away');
    $sectionPasukan = "
    <div style=\"margin:20px 0 0;\">
      <div style=\"background:#6B7280;padding:9px 16px;\">
        <span style=\"font-size:10px;font-weight:700;color:#F9FAFB;letter-spacing:2px;
                      text-transform:uppercase;\">Pasukan</span>
      </div>
      <div style=\"background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;padding:24px 16px;\">
        <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
          <tr>
            <td width=\"44%\" style=\"text-align:center;vertical-align:middle;\">
              {$logoHomeHtml}
              <div style=\"font-weight:700;font-size:12px;color:#9CA3AF;margin-top:10px;
                          text-transform:uppercase;line-height:1.4;text-decoration:line-through;\">"
                  . htmlspecialchars($pasukanHome) . "
              </div>
              <div style=\"font-size:10px;color:#D1D5DB;margin-top:3px;\">Tuan Rumah</div>
            </td>
            <td width=\"12%\" style=\"text-align:center;vertical-align:middle;\">
              <div style=\"font-size:13px;font-weight:700;color:#D1D5DB;letter-spacing:1px;\">VS</div>
            </td>
            <td width=\"44%\" style=\"text-align:center;vertical-align:middle;\">
              {$logoAwayHtml}
              <div style=\"font-weight:700;font-size:12px;color:#9CA3AF;margin-top:10px;
                          text-transform:uppercase;line-height:1.4;text-decoration:line-through;\">"
                  . htmlspecialchars($pasukanAway) . "
              </div>
              <div style=\"font-size:10px;color:#D1D5DB;margin-top:3px;\">Pasukan Tamu</div>
            </td>
          </tr>
        </table>
      </div>
    </div>";

    // ── Dashboard button ──────────────────────────────────────────────────
    $dashSection = '';
    if ($isDashboard) {
        $dashSection = "
        <div style=\"border-top:1px solid #F3F4F6;margin-top:24px;padding-top:20px;text-align:center;\">
          <p style=\"color:#6B7280;font-size:12px;margin:0 0 12px 0;\">
            Semak status tugasan anda yang lain dalam dashboard:
          </p>"
          . emailButton($baseUrl . '/pengadil-dashboard.html', 'Dashboard Pengadil') . "
        </div>";
    }

    $body =
        emailGreeting($nama) .
        $noticeBanner .
        $sectionInfo .
        $sectionPasukan .
        $dashSection .
        "<p style=\"color:#9CA3AF;font-size:11px;margin:24px 0 0;line-height:1.6;\">
           Ini adalah notifikasi automatik. Sila hubungi pengurus kejohanan jika anda mempunyai
           sebarang pertanyaan berkenaan pembatalan ini.
         </p>";

    $subject = ($isPostponed ? 'Penangguhan Perlawanan: ' : 'Pembatalan Perlawanan: ') . $kejohanan
             . ($noMatchFmt !== '-' ? ' (No: ' . $noMatchFmt . ')' : '')
             . ' — ' . $pasukanHome . ' vs ' . $pasukanAway
             . ' — ' . $tarikhFmt;

    $html = buildEmailTemplate($title, $accent, '', $body);
    return sendEmail($to, $subject, $html, $nama, 'lantikan', $inlineImages);
}

/**
 * Send penilaian report email to an official after admin confirms the report.
 *
 * @param string $to        Official's email
 * @param string $nama      Official's name
 * @param string $jawatan   e.g. "Pengadil Utama"
 * @param string $kejohanan Tournament name
 * @param string $tarikh    Match date (YYYY-MM-DD)
 * @param string $pasukan   "Home vs Away"
 * @param string $penilai   Assessor name
 * @param float|null $markah Score (6.0-10)
 * @param string|null $prestasi Performance level
 * @param array  $kekuatan  Array of strength points
 * @param array  $kelemahan Array of weakness points
 * @param string $nasihat   Advice text
 * @param string $ulasan    Overall remarks
 * @param string $catatanAdmin Admin notes
 */
function sendPenilaianEmail(
    string  $to,
    string  $nama,
    string  $jawatan,
    string  $kejohanan,
    string  $tarikh,
    string  $pasukan,
    string  $penilai,
    ?float  $markah = null,
    ?string $prestasi = null,
    array   $kekuatan = [],
    array   $kelemahan = [],
    string  $nasihat = '',
    string  $ulasan = '',
    string  $catatanAdmin = '',
    string  $reportUrl = ''
): bool {
    $tarikhFmt = '-';
    if ($tarikh) {
        $bulan = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
        $dt = strtotime($tarikh);
        if ($dt) $tarikhFmt = date('d', $dt) . ' ' . $bulan[(int)date('m', $dt) - 1] . ' ' . date('Y', $dt);
    }

    $markahColor = '#6B7280';
    if ($markah !== null) {
        if ($markah >= 8.3) $markahColor = '#059669';
        elseif ($markah >= 8.0) $markahColor = '#2563EB';
        elseif ($markah >= 7.5) $markahColor = '#D97706';
        else $markahColor = '#DC2626';
    }

    $body = emailGreeting($nama)
          . emailPara("Laporan penilaian anda untuk perlawanan berikut telah disahkan oleh admin.")
          . emailInfoTable([
                'Kejohanan'   => htmlspecialchars($kejohanan),
                'Perlawanan'  => htmlspecialchars($pasukan),
                'Tarikh'      => $tarikhFmt,
                'Jawatan'     => htmlspecialchars($jawatan),
                'Penilai'     => htmlspecialchars($penilai),
            ]);

    // Markah & Prestasi
    $body .= "<div style=\"text-align:center;margin:24px 0;\">
                <div style=\"display:inline-block;background:#F9FAFB;border:2px solid #E5E7EB;padding:16px 32px;\">
                  <div style=\"font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;\">Markah Anda</div>
                  <div style=\"font-size:36px;font-weight:800;color:{$markahColor};\">" . ($markah !== null ? number_format($markah, 1) : '-') . "</div>
                  <div style=\"font-size:10px;color:#9CA3AF;\">/10</div>"
             . ($prestasi ? "<div style=\"font-size:12px;font-weight:600;color:#374151;margin-top:4px;\">" . htmlspecialchars($prestasi) . "</div>" : "")
             . "</div></div>";

    // Kekuatan chips
    if (!empty($kekuatan)) {
        $body .= "<div style=\"margin:16px 0;\">
                    <div style=\"font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;\">Kekuatan</div>";
        foreach ($kekuatan as $item) {
            $body .= "<span style=\"display:inline-block;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;padding:3px 10px;font-size:12px;margin:2px 4px 2px 0;\">" . htmlspecialchars($item) . "</span>";
        }
        $body .= "</div>";
    }

    // Kelemahan chips
    if (!empty($kelemahan)) {
        $body .= "<div style=\"margin:16px 0;\">
                    <div style=\"font-size:10px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;\">Perlu Diperbaiki</div>";
        foreach ($kelemahan as $item) {
            $body .= "<span style=\"display:inline-block;background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;padding:3px 10px;font-size:12px;margin:2px 4px 2px 0;\">" . htmlspecialchars($item) . "</span>";
        }
        $body .= "</div>";
    }

    // Nasihat
    if ($nasihat) {
        $body .= emailAlert('#2563EB', '#EFF6FF', 'Nasihat & Cadangan', htmlspecialchars($nasihat));
    }

    // Ulasan keseluruhan
    if ($ulasan) {
        $body .= emailAlert('#6B7280', '#F9FAFB', 'Ulasan Keseluruhan', htmlspecialchars($ulasan));
    }

    // Catatan admin
    if ($catatanAdmin) {
        $body .= emailAlert('#FADA00', '#FFFBEB', 'Catatan Admin', htmlspecialchars($catatanAdmin));
    }

    // Report download link
    if ($reportUrl) {
        $body .= "<div style=\"text-align:center;margin:24px 0;\">
                    <a href=\"" . htmlspecialchars($reportUrl) . "\" target=\"_blank\"
                       style=\"display:inline-block;background:#0066cc;color:#fff;padding:12px 32px;
                              font-weight:700;font-size:14px;text-decoration:none;border-radius:4px;\">
                      📋 Lihat Laporan Penuh (RA Report)
                    </a>
                    <div style=\"font-size:11px;color:#9CA3AF;margin-top:8px;\">Klik untuk melihat dan muat turun laporan penilaian penuh dalam format PDF</div>
                  </div>";
    }

    $body .= emailPara("Sila jadikan maklum balas ini sebagai panduan untuk meningkatkan prestasi pada masa hadapan. Terima kasih atas dedikasi anda.");

    $subject = 'Laporan Penilaian — ' . $pasukan . ' — ' . $tarikhFmt;
    $html = buildEmailTemplate('Laporan Penilaian Pengadil', '#2563EB', '', $body);
    return sendEmail($to, $subject, $html, $nama, 'lantikan');
}
