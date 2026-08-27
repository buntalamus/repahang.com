<?php

/**
 * Read-only GET + explicit POST confirmation for a tournament chair.
 * No RefPahang portal account is required; the purpose-bound token identifies
 * the configured Pengerusi Pengadil and the exact submitted RA report.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/laporan-pengesahan.php';

function approvalPage(string $title, string $content, int $statusCode = 200): never
{
    http_response_code($statusCode);
    header('Content-Type: text/html; charset=UTF-8');
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $year = date('Y');
    echo <<<HTML
<!doctype html>
<html lang="ms">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{$safeTitle}</title>
  <style>
    *{box-sizing:border-box} body{margin:0;background:#e8eaed;color:#111827;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;padding:24px}
    .card{max-width:620px;margin:20px auto;background:#fff;box-shadow:0 2px 12px rgba(15,23,42,.14)}
    .bar{height:7px;background:#f59e0b}.head{background:#111827;color:#fff;text-align:center;padding:27px 24px}
    .head strong{display:block;font-size:15px;letter-spacing:.5px}.head span{display:block;margin-top:5px;color:#9ca3af;font-size:11px;letter-spacing:2px;text-transform:uppercase}
    .body{padding:30px}.body h1{font-size:22px;margin:0 0 8px}.muted{color:#6b7280;font-size:13px;line-height:1.6}.info{width:100%;border-collapse:collapse;margin:22px 0;font-size:13px}.info td{padding:9px;border-bottom:1px solid #e5e7eb;vertical-align:top}.info td:first-child{width:34%;color:#64748b;font-weight:600}
    textarea{width:100%;min-height:120px;border:1px solid #cbd5e1;border-radius:6px;padding:12px;font:inherit;resize:vertical}.label{display:block;font-size:13px;font-weight:700;margin:20px 0 7px}
    .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.btn{display:inline-block;border:0;border-radius:5px;padding:12px 18px;font-weight:700;font-size:13px;text-decoration:none;cursor:pointer}.primary{background:#059669;color:#fff}.secondary{background:#e2e8f0;color:#0f172a}.notice{border-left:4px solid #f59e0b;background:#fffbeb;padding:12px 14px;margin:18px 0;color:#854d0e;font-size:13px;line-height:1.55}.success{border-color:#10b981;background:#ecfdf5;color:#065f46}.error{border-color:#ef4444;background:#fef2f2;color:#991b1b}
    .foot{background:#111827;color:#9ca3af;text-align:center;padding:16px;font-size:11px}
  </style>
</head>
<body><main class="card"><div class="bar"></div><header class="head"><strong>PERSATUAN BOLA SEPAK NEGERI PAHANG</strong><span>Sistem Pengurusan Pengadil</span></header><section class="body">{$content}</section><footer class="foot">&copy; {$year} Persatuan Bola Sepak Negeri Pahang</footer></main></body>
</html>
HTML;
    exit;
}

function approvalStateByToken(PDO $pdo, string $token): ?array
{
    $stmt = $pdo->prepare("
        SELECT approval.*, laporan.status AS laporan_status,
               jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
               jp.pasukan_home, jp.pasukan_away,
               k.nama AS nama_kejohanan,
               COALESCE(u_ra.nama_penuh, pl_ra.nama, 'Penilai Pengadil') AS nama_penilai
        FROM laporan_pengesahan_pengerusi approval
        JOIN laporan_penilaian laporan ON laporan.id = approval.laporan_id
        JOIN jadual_perlawanan jp ON jp.id = laporan.jadual_id
        JOIN kejohanan k ON k.id = jp.kejohanan_id
        JOIN lantikan_pengadil ra ON ra.id = laporan.lantikan_id
        LEFT JOIN users u_ra ON u_ra.id = ra.pengadil_id
        LEFT JOIN pengadil_luar pl_ra ON pl_ra.id = ra.pengadil_luar_id
        WHERE approval.approval_token = :token
        LIMIT 1
    ");
    $stmt->execute([':token' => $token]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

try {
    $pdo = getDbConnection();
    requireLaporanPengesahanSchema($pdo);
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        approvalPage('Kaedah Tidak Sah', '<h1>Kaedah Tidak Sah</h1><div class="notice error">Gunakan pautan asal daripada emel atau Telegram anda.</div>', 405);
    }

    $source = $method === 'POST' ? $_POST : $_GET;
    $token = trim((string) ($source['token'] ?? ''));
    if (strlen($token) !== 64 || !ctype_xdigit($token)) {
        approvalPage('Pautan Tidak Sah', '<h1>Pautan Tidak Sah</h1><div class="notice error">Pautan pengesahan ini tidak dapat dikenal pasti. Sila hubungi pentadbir.</div>', 404);
    }
    $state = approvalStateByToken($pdo, $token);
    if (!$state) {
        approvalPage('Pautan Tidak Sah', '<h1>Pautan Tidak Sah</h1><div class="notice error">Pautan pengesahan ini tidak dapat dikenal pasti. Sila hubungi pentadbir.</div>', 404);
    }

    $safe = static fn(mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
    $match = $safe($state['pasukan_home']) . ' lwn ' . $safe($state['pasukan_away']);
    $date = date('d/m/Y', strtotime((string) $state['tarikh']));
    $time = substr((string) $state['masa'], 0, 5);

    if ($method === 'POST') {
        $comment = trim((string) ($_POST['catatan_pengerusi'] ?? ''));
        if (mb_strlen($comment) > 5000) {
            approvalPage('Komen Terlalu Panjang', '<h1>Komen Terlalu Panjang</h1><div class="notice error">Komen mestilah tidak melebihi 5,000 aksara.</div>', 422);
        }
        try {
            confirmLaporanByPengerusi($pdo, $token, $comment);
        } catch (DomainException $e) {
            approvalPage('Laporan Telah Diproses', '<h1>Laporan Telah Diproses</h1><div class="notice">' . $safe($e->getMessage()) . '</div>', 409);
        } catch (InvalidArgumentException $e) {
            approvalPage('Pautan Tidak Sah', '<h1>Pautan Tidak Sah</h1><div class="notice error">' . $safe($e->getMessage()) . '</div>', 404);
        }
        $commentText = $comment !== ''
            ? '<p class="muted"><strong>Komen direkodkan:</strong><br>' . nl2br($safe($comment)) . '</p>'
            : '<p class="muted">Tiada komen tambahan direkodkan.</p>';
        approvalPage(
            'Laporan Disahkan',
            '<h1>Laporan Berjaya Disahkan</h1><div class="notice success">Pengesahan anda sebagai Pengerusi Pengadil telah direkodkan. Salinan laporan akan dihantar kepada pegawai perlawanan.</div>' . $commentText
        );
    }

    if ($state['status'] !== 'Menunggu' || $state['laporan_status'] !== 'Dihantar') {
        $status = $state['status'] === 'Override Admin'
            ? 'Laporan ini telah disahkan melalui override Admin.'
            : 'Laporan ini telah disahkan sebelum ini.';
        approvalPage('Laporan Telah Diproses', '<h1>Laporan Telah Diproses</h1><div class="notice">' . $safe($status) . '</div>');
    }

    $previewUrl = buildPengerusiReportPreviewUrl((int) $state['laporan_id'], $token);
    $formToken = $safe($token);
    $content = '<h1>Semak & Sahkan Laporan RA</h1>'
        . '<p class="muted">Tuan/Puan ditetapkan sebagai <strong>' . $safe($state['pengesah_jawatan']) . '</strong> bagi kejohanan ini. Semak laporan penuh sebelum mengesahkan.</p>'
        . '<table class="info"><tr><td>Pengerusi</td><td><strong>' . $safe($state['pengesah_nama']) . '</strong></td></tr>'
        . '<tr><td>Kejohanan</td><td>' . $safe($state['nama_kejohanan']) . '</td></tr>'
        . '<tr><td>Perlawanan</td><td><strong>' . $match . '</strong></td></tr>'
        . '<tr><td>Tarikh / Masa</td><td>' . $safe($date . ' · ' . $time) . '</td></tr>'
        . '<tr><td>Tempat</td><td>' . $safe($state['tempat'] ?: '-') . '</td></tr>'
        . '<tr><td>Penilai</td><td>' . $safe($state['nama_penilai']) . '</td></tr></table>'
        . '<div class="notice">Klik “Lihat Laporan Penuh” dan semak semua markah serta ulasan. Membuka pautan ini sahaja tidak mengesahkan laporan.</div>'
        . '<a class="btn secondary" href="' . $safe($previewUrl) . '" target="_blank" rel="noopener">Lihat Laporan Penuh</a>'
        . '<form method="post"><input type="hidden" name="token" value="' . $formToken . '">'
        . '<label class="label" for="catatan">Komen Pengerusi Pengadil (pilihan)</label>'
        . '<textarea id="catatan" name="catatan_pengerusi" maxlength="5000" placeholder="Tulis komen atau arahan sebelum mengesahkan..."></textarea>'
        . '<div class="actions"><button class="btn primary" type="submit">Sahkan Laporan</button></div></form>';
    approvalPage('Pengesahan Laporan RA', $content);
} catch (Throwable $e) {
    error_log('[laporan-pengesahan-token.php] ' . $e->getMessage());
    approvalPage('Ralat Pelayan', '<h1>Ralat Pelayan</h1><div class="notice error">Pengesahan tidak dapat diproses sekarang. Sila cuba semula atau hubungi pentadbir.</div>', 500);
}
