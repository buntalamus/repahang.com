<?php
/**
 * Token-based accept/reject for lantikan (no login required)
 * Used by email link clicks.
 *
 * GET /api/lantikan-jawab-token.php?token=TOKEN&action=accept|reject
 *
 * Returns a full HTML page (user opens this in browser from email).
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

// ── Helper: render a self-contained HTML result page ──────────────────────────
function renderPage(string $title, string $icon, string $color, string $heading, string $body, string $nextUrl = ''): never
{
    $year = date('Y');
    $btnHtml = $nextUrl
        ? "<a href=\"" . htmlspecialchars($nextUrl) . "\"
              style=\"display:inline-block;margin-top:28px;background:#111827;color:#FADA00;
                      padding:12px 32px;text-decoration:none;font-weight:700;font-size:13px;
                      letter-spacing:1px;text-transform:uppercase;\">
            Ke Dashboard
           </a>"
        : '';
    echo <<<HTML
<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{$title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #E8EAED; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
           min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; max-width: 480px; width: 100%;
            box-shadow: 0 1px 8px rgba(0,0,0,.12); }
    .top  { background: {$color}; height: 6px; }
    .hdr  { background: #111827; padding: 28px 36px 24px; text-align: center; }
    .hdr img { width: 56px; height: 56px; border-radius: 50%; display: block; margin: 0 auto 12px; }
    .hdr .org { color: #F9FAFB; font-size: 13px; font-weight: 700; letter-spacing: .6px; }
    .hdr .sub { color: #6B7280; font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .body { padding: 40px 36px 36px; text-align: center; }
    .icon { font-size: 52px; margin-bottom: 18px; }
    .heading { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 14px; }
    .msg  { font-size: 14px; color: #6B7280; line-height: 1.7; }
    .ftr  { background: #111827; padding: 18px 36px; text-align: center;
            color: #9CA3AF; font-size: 11px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="top"></div>
    <div class="hdr">
      <img src="https://upload.wikimedia.org/wikipedia/en/b/b3/Pahang_FA_logo.png" alt="PBNP">
      <div class="org">PERSATUAN BOLA SEPAK NEGERI PAHANG</div>
      <div class="sub">Sistem Pengurusan Pengadil</div>
    </div>
    <div class="body">
      <div class="icon">{$icon}</div>
      <div class="heading">{$heading}</div>
      <div class="msg">{$body}</div>
      {$btnHtml}
    </div>
    <div class="ftr">&copy; {$year} Persatuan Bola Sepak Negeri Pahang</div>
  </div>
</body>
</html>
HTML;
    exit;
}

try {
    $pdo    = getDbConnection();
    $token  = trim($_GET['token'] ?? '');
    $action = trim($_GET['action'] ?? '');

    if ($token === '' || !in_array($action, ['accept', 'reject'], true)) {
        renderPage(
            'Pautan Tidak Sah', '⚠️', '#F59E0B',
            'Pautan Tidak Sah',
            'Pautan ini tidak sah atau tidak lengkap. Sila semak emel anda dan cuba lagi.'
        );
    }

    // Look up assignment by email_token
    $stmt = $pdo->prepare("
        SELECT lp.id, lp.status, lp.jawatan, lp.jadual_id,
               jp.tarikh, jp.masa, jp.tempat, jp.pasukan_home, jp.pasukan_away,
               COALESCE(kj.nama, '') AS kejohanan,
               lp.pengadil_id
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
        WHERE lp.email_token = :tok
        LIMIT 1
    ");
    $stmt->execute([':tok' => $token]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        renderPage(
            'Pautan Tidak Sah', '⚠️', '#F59E0B',
            'Pautan Sudah Tamat Tempoh',
            'Pautan ini sudah tidak aktif. Kemungkinan tugasan ini sudah dijawab sebelum ini.'
        );
    }

    if ($row['status'] !== 'Belum Jawab') {
        $already = $row['status'] === 'Diterima' ? 'diterima' : 'ditolak';
        renderPage(
            'Sudah Dijawab', 'ℹ️', '#3B82F6',
            'Tugasan Sudah Dijawab',
            "Tugasan ini telah <strong>{$already}</strong> sebelum ini. Tiada tindakan lanjut diperlukan."
        );
    }

    $newStatus = $action === 'accept' ? 'Diterima' : 'Ditolak';

    // Atomic update — only succeeds if status is still 'Belum Jawab' (prevents double-accept race)
    $pdo->beginTransaction();
    try {
        $updStmt = $pdo->prepare("
            UPDATE lantikan_pengadil
            SET status = :s, tarikh_jawab = NOW(), email_token = NULL
            WHERE id = :id AND status = 'Belum Jawab'
        ");
        $updStmt->execute([':s' => $newStatus, ':id' => $row['id']]);

        if ($updStmt->rowCount() === 0) {
            $pdo->rollBack();
            renderPage(
                'Sudah Dijawab', 'ℹ️', '#3B82F6',
                'Tugasan Sudah Dijawab',
                'Tugasan ini telah dijawab sebelum ini. Tiada tindakan lanjut diperlukan.'
            );
        }

        // Auto-create perlawanan + update jadual status if ALL accepted
        if ($newStatus === 'Diterima') {
            require_once __DIR__ . '/../config/lantikan-helper.php';
            createPerlawananFromLantikan($pdo, (int) $row['id']);

            $chkStmt = $pdo->prepare("
                SELECT COUNT(*) AS total,
                       SUM(CASE WHEN status = 'Diterima' THEN 1 ELSE 0 END) AS diterima
                FROM lantikan_pengadil WHERE jadual_id = :jid
            ");
            $chkStmt->execute([':jid' => $row['jadual_id']]);
            $counts = $chkStmt->fetch(PDO::FETCH_ASSOC);
            if ((int)$counts['total'] > 0 && (int)$counts['total'] === (int)$counts['diterima']) {
                $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Disahkan' WHERE id = :id AND status = 'Menunggu Pengesahan'")
                    ->execute([':id' => $row['jadual_id']]);
            }
        }

        $pdo->commit();
    } catch (Throwable $txErr) {
        $pdo->rollBack();
        throw $txErr;
    }

    $tarikhFmt = date('d M Y', strtotime($row['tarikh']));
    $pasukan   = htmlspecialchars($row['pasukan_home'] . ' lwn ' . $row['pasukan_away']);
    $jawatan   = htmlspecialchars($row['jawatan']);

    // Determine dashboard URL (only for registered referees)
    $baseUrl  = env('BASE_URL', 'https://refpahang.com');
    $dashUrl  = !empty($row['pengadil_id']) ? $baseUrl . '/pengadil-dashboard.html' : '';

    if ($action === 'accept') {
        renderPage(
            'Tugasan Diterima', '✅', '#10B981',
            'Tugasan Diterima',
            "Terima kasih. Anda telah <strong>menerima</strong> tugasan sebagai <strong>{$jawatan}</strong>.<br><br>
             <strong>{$pasukan}</strong><br>{$tarikhFmt}<br>" . htmlspecialchars($row['tempat'] ?? '') . "<br><br>
             Sila hadir pada masa dan tempat yang ditetapkan.",
            $dashUrl
        );
    } else {
        renderPage(
            'Tugasan Ditolak', '❌', '#EF4444',
            'Tugasan Ditolak',
            "Anda telah <strong>menolak</strong> tugasan sebagai <strong>{$jawatan}</strong>.<br><br>
             <strong>{$pasukan}</strong><br>{$tarikhFmt}<br><br>
             Pentadbir telah dimaklumkan. Terima kasih atas maklum balas anda.",
            $dashUrl
        );
    }

} catch (Throwable $e) {
    error_log('[lantikan-jawab-token] ' . $e->getMessage());
    renderPage(
        'Ralat', '⚠️', '#EF4444',
        'Ralat Dalaman',
        'Ralat berlaku semasa memproses permintaan anda. Sila cuba lagi atau hubungi pentadbir.'
    );
}
