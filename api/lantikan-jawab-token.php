<?php
/**
 * Token-based accept/reject for lantikan (no login required)
 * Used by email link clicks.
 *
 * GET  shows a confirmation page; POST records accept/reject.
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
    $pdo = getDbConnection();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (!in_array($method, ['GET', 'POST'], true)) {
        http_response_code(405);
        header('Allow: GET, POST');
        renderPage('Kaedah Tidak Sah', '⚠️', '#F59E0B', 'Kaedah Tidak Sah', 'Gunakan pautan daripada emel anda.');
    }
    $source = $method === 'POST' ? $_POST : $_GET;
    $token  = trim((string) ($source['token'] ?? ''));
    $action = trim((string) ($source['action'] ?? ''));

    if ($token === '' || !in_array($action, ['accept', 'reject'], true)) {
        renderPage(
            'Pautan Tidak Sah', '⚠️', '#F59E0B',
            'Pautan Tidak Sah',
            'Pautan ini tidak sah atau tidak lengkap. Sila semak emel anda dan cuba lagi.'
        );
    }

    $baseUrl = env('BASE_URL', 'https://refpahang.com');
    $dashUrl = '';

    // Look up assignment by email_token
    $stmt = $pdo->prepare("
        SELECT lp.id, lp.status, lp.komen, lp.tarikh_notif, lp.jawatan, lp.jadual_id,
               jp.tarikh, jp.masa, jp.tempat, jp.pasukan_home, jp.pasukan_away,
               COALESCE(kj.nama, '') AS kejohanan,
               COALESCE(kj.jenis_kejohanan, 'Persahabatan') AS jenis_kejohanan,
               lp.pengadil_id,
               COALESCE(
                   NULLIF(TRIM(u.nama_penuh), ''),
                   NULLIF(TRIM(pl.nama), ''),
                   'Pengadil'
               ) AS nama_penuh,
               u.persatuan_id
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
        LEFT JOIN users u ON lp.pengadil_id = u.id
        LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
        WHERE lp.email_token = :tok
        LIMIT 1
    ");
    $stmt->execute([':tok' => $token]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        renderPage(
            'Pautan Tidak Sah', '⚠️', '#F59E0B',
            'Pautan Tidak Sah',
            'Pautan ini tidak dapat dikenal pasti. Kemungkinan tugasan telah dijawab melalui
             saluran lain atau lantikan telah dikemaskini oleh pentadbir.
             Sila hubungi pentadbir untuk mendapatkan pautan aktif.',
            ''
        );
    }

    require_once __DIR__ . '/../config/lantikan-helper.php';
    requireLantikanAuditSchema($pdo);
    $dashUrl = !empty($row['pengadil_id']) ? $baseUrl . '/pengadil-dashboard.html' : '';

    // Email security scanners commonly open every GET link. GET must therefore
    // remain read-only and show an explicit confirmation form.
    if ($method === 'GET' && $row['status'] === 'Belum Jawab') {
        $notifTimestamp = !empty($row['tarikh_notif']) ? strtotime((string) $row['tarikh_notif']) : 0;
        $kickoffTimestamp = getMatchKickoffTimestamp((string) $row['tarikh'], (string) ($row['masa'] ?? ''));
        if ($notifTimestamp > 0 && $kickoffTimestamp !== null
            && shouldAutoRejectAppointment(
                $notifTimestamp,
                (string) $row['jenis_kejohanan'],
                $kickoffTimestamp,
                time()
            )) {
            $deadlineDt = calcDeadlineFromNotif((string) $row['jenis_kejohanan'], (string) $row['tarikh_notif']);
            renderPage(
                'Tempoh Menjawab Tamat', '⏰', '#F59E0B',
                'Tempoh Menjawab Telah Tamat',
                "Tempoh menjawab telah tamat pada <strong>{$deadlineDt}</strong>. Sila hubungi pentadbir jika anda masih boleh bertugas.",
                $dashUrl
            );
        }

        $safeToken = htmlspecialchars($token, ENT_QUOTES, 'UTF-8');
        $safeAction = htmlspecialchars($action, ENT_QUOTES, 'UTF-8');
        $actionLabel = $action === 'accept' ? 'Terima Tugasan' : 'Tolak Tugasan';
        $actionColor = $action === 'accept' ? '#059669' : '#DC2626';
        $match = htmlspecialchars(
            (string) $row['pasukan_home'] . ' lwn ' . (string) $row['pasukan_away'],
            ENT_QUOTES,
            'UTF-8'
        );
        $position = htmlspecialchars((string) $row['jawatan'], ENT_QUOTES, 'UTF-8');
        $body = "Sahkan tindakan <strong>{$actionLabel}</strong> sebagai <strong>{$position}</strong> untuk {$match}."
              . '<form method="post" style="margin-top:24px">'
              . '<input type="hidden" name="token" value="' . $safeToken . '">'
              . '<input type="hidden" name="action" value="' . $safeAction . '">'
              . '<button type="submit" style="border:0;border-radius:4px;padding:13px 24px;background:' . $actionColor
              . ';color:#fff;font-weight:700;cursor:pointer">' . $actionLabel . '</button></form>';
        renderPage('Sahkan Jawapan', '✉️', $actionColor, 'Sahkan Jawapan Lantikan', $body, $dashUrl);
    }

    // POST is the only method allowed to mutate an appointment response.
    $expiredNow = autoTolakLantikanTertunggak($pdo, ['id' => (int) $row['id']]);
    if ($expiredNow > 0
        || ($row['status'] === 'Ditolak' && ($row['komen'] ?? '') === LANTIKAN_AUTO_TOLAK_KOMEN)) {
        $deadlineHours = getDeadlineHours($row['jenis_kejohanan']);
        $deadlineDt    = $row['tarikh_notif']
            ? calcDeadlineFromNotif($row['jenis_kejohanan'], $row['tarikh_notif'])
            : '';
        $deadlineLine  = $deadlineDt ? " pada <strong>{$deadlineDt}</strong>" : '';
        renderPage(
            'Tempoh Menjawab Tamat', '⏰', '#F59E0B',
            'Tempoh Menjawab Telah Tamat',
            "Tempoh menjawab ({$deadlineHours} jam selepas notifikasi) telah tamat{$deadlineLine}.
             Lantikan ini telah <strong>DITOLAK secara automatik</strong>.
             Sila hubungi pentadbir jika anda masih boleh bertugas.",
            $dashUrl
        );
    }

    if ($row['status'] !== 'Belum Jawab') {
        $already = $row['status'] === 'Diterima' ? 'diterima' : 'ditolak';
        renderPage(
            'Sudah Dijawab', 'ℹ️', '#3B82F6',
            'Tugasan Sudah Dijawab',
            "Tugasan ini telah <strong>{$already}</strong> sebelum ini. Tiada tindakan lanjut diperlukan.",
            $dashUrl
        );
    }

    $newStatus = $action === 'accept' ? 'Diterima' : 'Ditolak';
    $shouldNotifyCompleteKup = false;

    // Atomic update — only succeeds if status is still 'Belum Jawab' (prevents double-accept race)
    $pdo->beginTransaction();
    try {
        lockMatchForAppointmentResponse($pdo, (int) $row['jadual_id']);
        $responseAuditSnapshot = getLantikanAuditSnapshot($pdo, (int) $row['id'], true);
        if (!$responseAuditSnapshot) {
            throw new RuntimeException('Snapshot audit jawapan lantikan tidak dijumpai.');
        }

        $updStmt = $pdo->prepare("
            UPDATE lantikan_pengadil
            SET status = :s, tarikh_jawab = NOW(), status_dikemaskini_at = NOW(),
                email_token = NULL, tg_token = NULL
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

        syncPerlawananHistoryForJadual($pdo, (int) $row['jadual_id']);
        $shouldNotifyCompleteKup = isKupPosition((string) $row['jawatan'])
            && isAcceptedKupCrewComplete($pdo, (int) $row['jadual_id']);

        $responseUrl = rtrim($baseUrl, '/') . '/api/lantikan-jawab-token.php?token='
            . urlencode($token) . '&action=' . urlencode($action);
        recordLantikanAudit(
            $pdo,
            (int) $row['id'],
            'appointment_response',
            'email_link',
            'success',
            ['action' => $action, 'new_status' => $newStatus],
            $responseUrl,
            'official',
            null,
            $responseAuditSnapshot
        );

        $pdo->commit();
    } catch (Throwable $txErr) {
        $pdo->rollBack();
        throw $txErr;
    }

    if ($newStatus === 'Diterima') {
        try {
            generatePenilaianToken($pdo, (int) $row['id']);
        } catch (Throwable $helperError) {
            error_log('[lantikan-jawab-token] generatePenilaianToken error: ' . $helperError->getMessage());
        }
    }

    if ($shouldNotifyCompleteKup) {
        try {
            notifyCompleteKupCrew($pdo, (int) $row['jadual_id']);
        } catch (Throwable $crewNotifyError) {
            error_log('[lantikan-jawab-token] KUP crew notification error: ' . $crewNotifyError->getMessage());
        }
    }

    $tarikhFmt = date('d M Y', strtotime($row['tarikh']));
    $pasukan   = htmlspecialchars($row['pasukan_home'] . ' lwn ' . $row['pasukan_away']);
    $jawatan   = htmlspecialchars($row['jawatan']);

    // ── Notify admin(s) & PP Daerah ───────────────────────────────────
    // Jawapan lantikan sudah berjaya disimpan. Kegagalan notifikasi sampingan
    // tidak boleh menukar halaman kejayaan kepada "Ralat Dalaman".
    try {
        $namaPengadil = $row['nama_penuh'];
        notifyAdminLantikanResponse($pdo, $action, $namaPengadil,
            $row['jawatan'], $row['kejohanan'], $row['tarikh'],
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
                    $row['jawatan'], $row['kejohanan'], $row['tarikh'],
                    $row['pasukan_home'], $row['pasukan_away']);
            }
        }
    } catch (Throwable $notificationError) {
        error_log('[lantikan-jawab-token] notification error: ' . $notificationError->getMessage());
    }

    if ($action === 'accept') {
        renderPage(
            'Tugasan Diterima', '✅', '#10B981',
            'Tugasan Diterima',
            "Terima kasih. Anda telah <strong>menerima</strong> tugasan sebagai <strong>{$jawatan}</strong>.<br><br>
             <strong>{$pasukan}</strong><br>{$tarikhFmt}<br>" . htmlspecialchars($row['tempat'] ?? '') . "<br><br>
             Sila hadir pada masa dan tempat yang ditetapkan.<br><br>
             ⚠️ <strong>Sila bawa kelengkapan penuh pengadil.</strong>",
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
