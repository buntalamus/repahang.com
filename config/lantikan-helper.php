<?php
/**
 * Shared helper: auto-create perlawanan record when lantikan is accepted,
 * portal notifications, PP Daerah notifications, admin notifications.
 *
 * Called from:
 *   - api/lantikan-jawab-token.php  (email accept)
 *   - api/telegram-webhook.php      (Telegram accept)
 *   - api/lantikan-jawab.php        (dashboard accept)
 *   - api/lantikan.php              (admin notify)
 */

declare(strict_types=1);

// Komen penanda untuk lantikan yang ditolak secara automatik (tiada jawapan
// dalam tempoh). Juga digunakan sebagai flag machine-readable oleh saluran
// jawapan untuk memaparkan mesej "tempoh tamat" dan bukan "sudah dijawab".
const LANTIKAN_AUTO_TOLAK_KOMEN = 'Ditolak automatik - tiada jawapan dalam tempoh';

/**
 * Get the answer-window hours based on jenis_kejohanan.
 *   - Liga: 48 jam selepas notifikasi dihantar
 *   - Karnival / Persahabatan: 3 jam selepas notifikasi dihantar
 */
function getDeadlineHours(string $jenisKejohanan): int
{
    return strtolower($jenisKejohanan) === 'liga' ? 48 : 3;
}

/**
 * Get the auto-reject rule text (Malay) for the given jenis_kejohanan.
 */
function getDeadlineRuleText(string $jenisKejohanan): string
{
    $hours = getDeadlineHours($jenisKejohanan);
    return "Anda perlu menjawab lantikan ini dalam masa {$hours} jam selepas notifikasi dihantar. "
         . "Jika tidak dijawab dalam tempoh tersebut, lantikan akan DITOLAK secara automatik.";
}

/**
 * Calculate formatted deadline string from the notification timestamp.
 * Deadline = tarikh_notif + N jam (Liga 48, lain 3).
 * Defaults to "now" for use at send time.
 * Returns e.g. "05 Apr 2026, 14:00"
 */
function calcDeadlineFromNotif(string $jenisKejohanan, ?string $tarikhNotif = null): string
{
    $hours  = getDeadlineHours($jenisKejohanan);
    $notifTs = $tarikhNotif !== null ? strtotime($tarikhNotif) : time();
    if (!$notifTs) {
        $notifTs = time();
    }
    return date('d M Y, H:i', $notifTs + $hours * 3600);
}

/**
 * Auto-TOLAK lantikan tertunggak: status 'Belum Jawab' yang tempoh jawapannya
 * (tarikh_notif + N jam) sudah tamat. Baris yang belum dinotifikasi
 * (notif_hantar=0 / tarikh_notif NULL) tidak disentuh. Token TIDAK
 * dikosongkan supaya pautan lama boleh dikenal pasti dan halaman
 * "Tamat Tempoh" yang tepat dipaparkan.
 *
 * Perbandingan masa dibuat sepenuhnya di sisi SQL (tarikh_notif lawan NOW())
 * supaya kalis perbezaan timezone PHP/DB.
 *
 * @param array $scope Skop pilihan: 'id', 'jadual_id', 'pengadil_id', 'kejohanan_id'
 * @return int Bilangan baris yang ditukar kepada 'Ditolak'
 */
function autoTolakLantikanTertunggak(PDO $pdo, array $scope = []): int
{
    $where  = '';
    $params = [
        ':komen'  => LANTIKAN_AUTO_TOLAK_KOMEN,
        ':hLiga1' => getDeadlineHours('Liga'),
        ':hLain1' => getDeadlineHours('Persahabatan'),
        ':hLiga2' => getDeadlineHours('Liga'),
        ':hLain2' => getDeadlineHours('Persahabatan'),
    ];
    if (isset($scope['id'])) {
        $where .= ' AND lp.id = :sid';
        $params[':sid'] = (int) $scope['id'];
    }
    if (isset($scope['jadual_id'])) {
        $where .= ' AND lp.jadual_id = :sjid';
        $params[':sjid'] = (int) $scope['jadual_id'];
    }
    if (isset($scope['pengadil_id'])) {
        $where .= ' AND lp.pengadil_id = :suid';
        $params[':suid'] = (int) $scope['pengadil_id'];
    }
    if (isset($scope['kejohanan_id'])) {
        $where .= ' AND jp.kejohanan_id = :skid';
        $params[':skid'] = (int) $scope['kejohanan_id'];
    }

    $stmt = $pdo->prepare("
        UPDATE lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
        LEFT JOIN kejohanan kj    ON kj.id = jp.kejohanan_id
        SET lp.status = 'Ditolak',
            lp.komen  = :komen,
            lp.tarikh_jawab = DATE_ADD(lp.tarikh_notif, INTERVAL
                (CASE WHEN LOWER(COALESCE(kj.jenis_kejohanan,'')) = 'liga' THEN :hLiga1 ELSE :hLain1 END) HOUR)
        WHERE lp.status = 'Belum Jawab'
          AND lp.notif_hantar = 1
          AND lp.tarikh_notif IS NOT NULL
          AND DATE_ADD(lp.tarikh_notif, INTERVAL
                (CASE WHEN LOWER(COALESCE(kj.jenis_kejohanan,'')) = 'liga' THEN :hLiga2 ELSE :hLain2 END) HOUR) <= NOW()
          {$where}
    ");
    $stmt->execute($params);
    return $stmt->rowCount();
}

/**
 * Normalize a kategori string into a no_perlawanan prefix.
 * e.g. "b12" / " B12 " → "B12". Falls back to "P" when kategori is empty.
 */
function katPrefix(string $kategori): string
{
    $prefix = strtoupper(preg_replace('/\s+/', '', $kategori));
    return $prefix !== '' ? $prefix : 'P';
}

/**
 * Generate the next no_perlawanan for a (kejohanan, kategori) pair.
 * Format: {PREFIX}-{NN} e.g. "B12-01".
 * Sequence is derived from the highest existing numeric suffix for that prefix
 * (not COUNT) to avoid collisions after deletions.
 */
function nextNoPerlawanan(PDO $pdo, int $kejohananId, string $kategori): string
{
    $prefix = katPrefix($kategori);
    $stmt = $pdo->prepare("
        SELECT no_perlawanan FROM jadual_perlawanan
        WHERE kejohanan_id = :kid AND no_perlawanan LIKE :pat
    ");
    $stmt->execute([':kid' => $kejohananId, ':pat' => $prefix . '-%']);
    $max = 0;
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $no) {
        if (preg_match('/-(\d+)$/', (string) $no, $m)) {
            $max = max($max, (int) $m[1]);
        }
    }
    return $prefix . '-' . str_pad((string) ($max + 1), 2, '0', STR_PAD_LEFT);
}

/**
 * Renumber ALL matches for a kejohanan: group by kategori, order by
 * (tarikh, masa, id), and assign no_perlawanan = {PREFIX}-{NN} starting at 01
 * within each kategori. Runs in a single transaction (joins an outer one if any).
 *
 * @return int Number of rows updated
 */
function renumberNoPerlawanan(PDO $pdo, int $kejohananId): int
{
    $stmt = $pdo->prepare("
        SELECT id, kategori FROM jadual_perlawanan
        WHERE kejohanan_id = :kid
        ORDER BY kategori ASC, tarikh ASC, masa ASC, id ASC
    ");
    $stmt->execute([':kid' => $kejohananId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $update = $pdo->prepare("UPDATE jadual_perlawanan SET no_perlawanan = :no WHERE id = :id");

    $seq = [];
    $count = 0;
    $ownTransaction = !$pdo->inTransaction();
    if ($ownTransaction) $pdo->beginTransaction();
    try {
        foreach ($rows as $r) {
            $prefix = katPrefix((string) ($r['kategori'] ?? ''));
            $seq[$prefix] = ($seq[$prefix] ?? 0) + 1;
            $no = $prefix . '-' . str_pad((string) $seq[$prefix], 2, '0', STR_PAD_LEFT);
            $update->execute([':no' => $no, ':id' => (int) $r['id']]);
            $count++;
        }
        if ($ownTransaction) $pdo->commit();
    } catch (Throwable $e) {
        if ($ownTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return $count;
}

/**
 * Create a perlawanan record from an accepted lantikan.
 * Populates all official IDs so the pengadil can see the full crew.
 * Skips if record already exists (duplicate-safe via lantikan_id UNIQUE).
 * Only creates for registered pengadil (pengadil_id IS NOT NULL).
 *
 * @param PDO $pdo
 * @param int $lantikanId  The lantikan_pengadil.id that was just accepted
 * @return bool True if record created, false if skipped
 */
function createPerlawananFromLantikan(PDO $pdo, int $lantikanId): bool
{
    // Fetch lantikan + jadual + kejohanan details
    $stmt = $pdo->prepare("
        SELECT lp.id, lp.pengadil_id, lp.jawatan, lp.jadual_id,
               jp.tarikh, jp.tempat, jp.pasukan_home, jp.pasukan_away,
               jp.kategori, jp.peringkat, jp.kejohanan_id,
               COALESCE(kj.nama, '') AS kejohanan_nama
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
        WHERE lp.id = :id AND lp.status = 'Diterima'
    ");
    $stmt->execute([':id' => $lantikanId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || empty($row['pengadil_id'])) {
        // pengadil_luar — no dashboard account, skip
        return false;
    }

    // Check if already created (prevent duplicate)
    $exists = $pdo->prepare("SELECT 1 FROM perlawanan WHERE lantikan_id = :lid LIMIT 1");
    $exists->execute([':lid' => $lantikanId]);
    if ($exists->fetchColumn()) {
        return false;
    }

    // Fetch all officials for this match to populate the crew fields
    $crewStmt = $pdo->prepare("
        SELECT lp.jawatan, lp.pengadil_id
        FROM lantikan_pengadil lp
        WHERE lp.jadual_id = :jid AND lp.pengadil_id IS NOT NULL
    ");
    $crewStmt->execute([':jid' => $row['jadual_id']]);
    $crewRows = $crewStmt->fetchAll(PDO::FETCH_ASSOC);

    $crew = [
        'head_referee_id'        => null,
        'assistant_referee_1_id' => null,
        'assistant_referee_2_id' => null,
        'fourth_official_id'     => null,
    ];
    foreach ($crewRows as $c) {
        switch ($c['jawatan']) {
            case 'Pengadil':             $crew['head_referee_id']        = (int) $c['pengadil_id']; break;
            case 'Penolong Pengadil 1':  $crew['assistant_referee_1_id'] = (int) $c['pengadil_id']; break;
            case 'Penolong Pengadil 2':  $crew['assistant_referee_2_id'] = (int) $c['pengadil_id']; break;
            case 'Pegawai ke4':          $crew['fourth_official_id']     = (int) $c['pengadil_id']; break;
        }
    }

    // Build jenis from kejohanan name + kategori/peringkat
    $jenisParts = [];
    if (!empty($row['kejohanan_nama'])) $jenisParts[] = $row['kejohanan_nama'];
    if (!empty($row['kategori']))       $jenisParts[] = $row['kategori'];
    if (!empty($row['peringkat']))      $jenisParts[] = $row['peringkat'];
    $jenis = implode(' - ', $jenisParts) ?: 'Kejohanan';

    $ins = $pdo->prepare("
        INSERT INTO perlawanan
            (user_id, lantikan_id, tarikh, jenis, tempat, home_team, away_team,
             jawatan, head_referee_id, assistant_referee_1_id, assistant_referee_2_id,
             fourth_official_id, status_pp, created_at)
        VALUES
            (:uid, :lid, :tarikh, :jenis, :tempat, :home, :away,
             :jawatan, :hr, :ar1, :ar2, :fo, 'Disahkan', NOW())
    ");

    $ins->execute([
        ':uid'     => (int) $row['pengadil_id'],
        ':lid'     => $lantikanId,
        ':tarikh'  => $row['tarikh'],
        ':jenis'   => $jenis,
        ':tempat'  => $row['tempat'] ?? '',
        ':home'    => $row['pasukan_home'] ?? '',
        ':away'    => $row['pasukan_away'] ?? '',
        ':jawatan' => $row['jawatan'],
        ':hr'      => $crew['head_referee_id'],
        ':ar1'     => $crew['assistant_referee_1_id'],
        ':ar2'     => $crew['assistant_referee_2_id'],
        ':fo'      => $crew['fourth_official_id'],
    ]);

    return true;
}

/**
 * Generate penilaian_token for Penilai Pengadil when they accept.
 * Sends email + Telegram notification with the borang penilaian link.
 *
 * @param PDO $pdo
 * @param int $lantikanId  The lantikan_pengadil.id just accepted
 * @return string|null  The token if generated, null if not applicable
 */
function generatePenilaianToken(PDO $pdo, int $lantikanId): ?string
{
    $stmt = $pdo->prepare("
        SELECT lp.jawatan, lp.pengadil_id, lp.pengadil_luar_id,
               jp.tarikh, jp.pasukan_home, jp.pasukan_away, jp.tempat,
               COALESCE(kj.nama, '') AS kejohanan,
               COALESCE(u.nama_penuh, pl.nama, '') AS nama_penilai,
               COALESCE(u.email, pl.emel, '') AS emel_penilai,
               COALESCE(u.telegram_chat_id, pl.telegram_chat_id, '') AS tg_chat_id
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
        LEFT JOIN users u ON lp.pengadil_id = u.id
        LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
        WHERE lp.id = :id AND lp.jawatan = 'Penilai Pengadil'
    ");
    $stmt->execute([':id' => $lantikanId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return null; // Not a Penilai Pengadil
    }

    // Generate secure token
    $token = bin2hex(random_bytes(32));

    $pdo->prepare("UPDATE lantikan_pengadil SET penilaian_token = :tok WHERE id = :id")
        ->execute([':tok' => $token, ':id' => $lantikanId]);

    // Build borang link
    $baseUrl   = env('BASE_URL', 'https://refpahang.com');
    $borangUrl = $baseUrl . '/penilaian-borang.html?token=' . $token;

    // Send email notification
    if (!empty($row['emel_penilai'])) {
        require_once __DIR__ . '/email.php';

        $tarikhFmt = date('d M Y', strtotime($row['tarikh']));
        $pasukan   = htmlspecialchars($row['pasukan_home'] . ' lwn ' . $row['pasukan_away']);

        $body = emailGreeting($row['nama_penilai'])
              . emailPara("Anda telah menerima tugasan sebagai <strong>Penilai Pengadil</strong> untuk perlawanan berikut:")
              . emailInfoTable([
                    'Kejohanan'  => htmlspecialchars($row['kejohanan']),
                    'Perlawanan' => $pasukan,
                    'Tarikh'     => $tarikhFmt,
                    'Tempat'     => htmlspecialchars($row['tempat'] ?? ''),
                ])
              . emailPara("Sila gunakan pautan di bawah untuk mengisi <strong>Borang Penilaian Pengadil</strong> selepas perlawanan:")
              . emailButton($borangUrl, 'Isi Borang Penilaian')
              . emailPara("<span style=\"color:#9CA3AF;font-size:12px;\">Pautan ini unik untuk anda. Jangan kongsikan dengan orang lain.</span>");

        $html = buildEmailTemplate('Borang Penilaian Pengadil', '#2563EB', '📋', $body);
        sendEmail(
            $row['emel_penilai'],
            'Borang Penilaian Pengadil — ' . $row['pasukan_home'] . ' lwn ' . $row['pasukan_away'],
            $html,
            $row['nama_penilai']
        );
    }

    // Send Telegram notification
    if (!empty($row['tg_chat_id'])) {
        require_once __DIR__ . '/telegram.php';

        $tarikhFmt = date('d M Y', strtotime($row['tarikh']));
        $msg = "📋 <b>Borang Penilaian Pengadil</b>\n\n"
             . "Anda telah menerima tugasan sebagai <b>Penilai Pengadil</b>.\n\n"
             . "⚽ " . htmlspecialchars($row['pasukan_home'] . ' lwn ' . $row['pasukan_away']) . "\n"
             . "📅 {$tarikhFmt}\n"
             . "📍 " . htmlspecialchars($row['tempat'] ?? '') . "\n\n"
             . "Sila isi borang penilaian selepas perlawanan:";

        tgSend((int) $row['tg_chat_id'], $msg, [
            'inline_keyboard' => [
                [['text' => '📋 Isi Borang Penilaian', 'url' => $borangUrl]]
            ]
        ]);
    }

    return $token;
}

/**
 * Create a portal notification for a user.
 */
function createPortalNotification(PDO $pdo, int $userId, string $type, string $subject, string $message): void
{
    $pdo->prepare("
        INSERT INTO notifications (user_id, type, subject, message, created_at)
        VALUES (:uid, :type, :subject, :msg, NOW())
    ")->execute([
        ':uid'     => $userId,
        ':type'    => $type,
        ':subject' => $subject,
        ':msg'     => $message,
    ]);
}

/**
 * Create portal notification for lantikan assignment.
 */
function notifyLantikanPortal(PDO $pdo, int $userId, string $jawatan, string $kejohanan, string $tarikh, string $pasukanHome, string $pasukanAway): void
{
    $tarikhFmt = date('d M Y', strtotime($tarikh));
    $subject = "Lantikan: {$pasukanHome} lwn {$pasukanAway}";
    $message = "Anda telah dilantik sebagai {$jawatan} untuk perlawanan {$pasukanHome} lwn {$pasukanAway} ({$kejohanan}) pada {$tarikhFmt}. Sila semak menu Tugasan untuk terima atau tolak.";
    createPortalNotification($pdo, $userId, 'Lantikan', $subject, $message);
}

/**
 * Notify PP Daerah about a lantikan involving pengadil in their district.
 * Sends portal notification, Telegram, and email.
 */
function notifyPPDaerahLantikan(
    PDO $pdo,
    int $persatuanId,
    string $namaPengadil,
    string $jawatan,
    string $kejohanan,
    string $tarikh,
    string $masa,
    string $tempat,
    string $pasukanHome,
    string $pasukanAway,
    string $noMatch = ''
): void {
    if (!$persatuanId) return;

    $stmt = $pdo->prepare("
        SELECT id, nama_penuh, email, telegram_chat_id
        FROM users
        WHERE role = 'PP Daerah' AND persatuan_id = :pid AND aktif = 1
    ");
    $stmt->execute([':pid' => $persatuanId]);
    $ppUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($ppUsers)) return;

    $tarikhFmt = date('d M Y', strtotime($tarikh));
    $masaFmt = $masa ? date('H:i', strtotime($masa)) : '-';
    $pasukan = "{$pasukanHome} lwn {$pasukanAway}";

    foreach ($ppUsers as $pp) {
        // Portal notification
        $subject = "Lantikan Pengadil Daerah: {$pasukan}";
        $message = "{$namaPengadil} telah dilantik sebagai {$jawatan} untuk perlawanan {$pasukan} ({$kejohanan}) pada {$tarikhFmt}.";
        createPortalNotification($pdo, (int)$pp['id'], 'Lantikan PP Daerah', $subject, $message);

        // Telegram
        if (!empty($pp['telegram_chat_id'])) {
            $tgMsg = "<b>📋 Makluman Lantikan Pengadil</b>\n\n"
                   . "Pengadil daerah anda telah dilantik:\n\n"
                   . "<b>Pengadil:</b> " . htmlspecialchars($namaPengadil) . "\n"
                   . "<b>Jawatan:</b> " . htmlspecialchars($jawatan) . "\n"
                   . "<b>Kejohanan:</b> " . htmlspecialchars($kejohanan) . "\n"
                   . "<b>Perlawanan:</b> " . htmlspecialchars($pasukan) . "\n"
                   . "<b>Tarikh:</b> {$tarikhFmt}\n"
                   . "<b>Masa:</b> {$masaFmt}\n"
                   . "<b>Tempat:</b> " . htmlspecialchars($tempat) . "\n";

            if (!function_exists('tgSend')) {
                require_once __DIR__ . '/telegram.php';
            }
            tgSend((int)$pp['telegram_chat_id'], $tgMsg);
        }

        // Email
        if (!empty($pp['email'])) {
            if (!function_exists('sendEmail')) {
                require_once __DIR__ . '/email.php';
            }
            $body = emailGreeting($pp['nama_penuh'])
                  . emailPara("Pengadil dari daerah anda telah dilantik untuk bertugas:")
                  . emailInfoTable([
                        'Pengadil'   => htmlspecialchars($namaPengadil),
                        'Jawatan'    => htmlspecialchars($jawatan),
                        'Kejohanan'  => htmlspecialchars($kejohanan),
                        'Perlawanan' => htmlspecialchars($pasukan),
                        'Tarikh'     => $tarikhFmt,
                        'Masa'       => $masaFmt,
                        'Tempat'     => htmlspecialchars($tempat),
                    ])
                  . emailPara("Sila log masuk ke portal untuk maklumat lanjut.");

            $html = buildEmailTemplate('Makluman Lantikan Pengadil', '#1e293b', '📋', $body);
            sendEmail(
                $pp['email'],
                "Lantikan Pengadil: {$namaPengadil} — {$pasukan}",
                $html,
                $pp['nama_penuh']
            );
        }
    }
}

/**
 * Notify admin(s) when a pengadil accepts or rejects a lantikan.
 */
function notifyAdminLantikanResponse(
    PDO $pdo,
    string $action,
    string $namaPengadil,
    string $jawatan,
    string $kejohanan,
    string $tarikh,
    string $pasukanHome,
    string $pasukanAway,
    string $komen = ''
): void {
    $admins = $pdo->query("SELECT id, nama_penuh, telegram_chat_id FROM users WHERE role = 'Admin' AND aktif = 1")
        ->fetchAll(PDO::FETCH_ASSOC);

    if (empty($admins)) return;

    $tarikhFmt = date('d M Y', strtotime($tarikh));
    $pasukan = "{$pasukanHome} lwn {$pasukanAway}";
    $isAccept = $action === 'accept';

    $type = $isAccept ? 'Lantikan Diterima' : 'Lantikan Ditolak';
    $subject = ($isAccept ? '✅ ' : '❌ ') . "{$namaPengadil} — {$pasukan}";
    $statusText = $isAccept ? 'menerima' : 'menolak';
    $message = "{$namaPengadil} telah {$statusText} lantikan sebagai {$jawatan} untuk {$pasukan} ({$kejohanan}) pada {$tarikhFmt}.";
    if (!$isAccept && $komen) {
        $message .= " Sebab: {$komen}";
    }

    foreach ($admins as $admin) {
        createPortalNotification($pdo, (int)$admin['id'], $type, $subject, $message);

        if (!empty($admin['telegram_chat_id'])) {
            $icon = $isAccept ? '✅' : '❌';
            $tgMsg = "<b>{$icon} Lantikan " . ($isAccept ? 'Diterima' : 'Ditolak') . "</b>\n\n"
                   . "<b>Pengadil:</b> " . htmlspecialchars($namaPengadil) . "\n"
                   . "<b>Jawatan:</b> " . htmlspecialchars($jawatan) . "\n"
                   . "<b>Perlawanan:</b> " . htmlspecialchars($pasukan) . "\n"
                   . "<b>Kejohanan:</b> " . htmlspecialchars($kejohanan) . "\n"
                   . "<b>Tarikh:</b> {$tarikhFmt}\n";
            if (!$isAccept && $komen) {
                $tgMsg .= "<b>Sebab:</b> " . htmlspecialchars($komen) . "\n";
            }

            if (!function_exists('tgSend')) {
                require_once __DIR__ . '/telegram.php';
            }
            tgSend((int)$admin['telegram_chat_id'], $tgMsg);
        }
    }
}

/**
 * Notify PP Daerah when a pengadil in their district accepts/rejects a lantikan.
 */
function notifyPPDaerahResponse(
    PDO $pdo,
    string $action,
    int $persatuanId,
    string $namaPengadil,
    string $jawatan,
    string $kejohanan,
    string $tarikh,
    string $pasukanHome,
    string $pasukanAway,
    string $komen = ''
): void {
    if (!$persatuanId) return;

    $stmt = $pdo->prepare("
        SELECT id, nama_penuh, telegram_chat_id
        FROM users
        WHERE role = 'PP Daerah' AND persatuan_id = :pid AND aktif = 1
    ");
    $stmt->execute([':pid' => $persatuanId]);
    $ppUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($ppUsers)) return;

    $tarikhFmt = date('d M Y', strtotime($tarikh));
    $pasukan = "{$pasukanHome} lwn {$pasukanAway}";
    $isAccept = $action === 'accept';

    $type = $isAccept ? 'Pengadil Terima Lantikan' : 'Pengadil Tolak Lantikan';
    $statusText = $isAccept ? 'menerima' : 'menolak';
    $subject = ($isAccept ? '✅ ' : '❌ ') . "{$namaPengadil} — {$pasukan}";
    $message = "{$namaPengadil} telah {$statusText} lantikan sebagai {$jawatan} untuk {$pasukan} ({$kejohanan}) pada {$tarikhFmt}.";
    if (!$isAccept && $komen) {
        $message .= " Sebab: {$komen}";
    }

    foreach ($ppUsers as $pp) {
        createPortalNotification($pdo, (int)$pp['id'], $type, $subject, $message);

        if (!empty($pp['telegram_chat_id'])) {
            $icon = $isAccept ? '✅' : '❌';
            $tgMsg = "<b>{$icon} Pengadil " . ($isAccept ? 'Terima' : 'Tolak') . " Lantikan</b>\n\n"
                   . "<b>Pengadil:</b> " . htmlspecialchars($namaPengadil) . "\n"
                   . "<b>Jawatan:</b> " . htmlspecialchars($jawatan) . "\n"
                   . "<b>Perlawanan:</b> " . htmlspecialchars($pasukan) . "\n"
                   . "<b>Kejohanan:</b> " . htmlspecialchars($kejohanan) . "\n"
                   . "<b>Tarikh:</b> {$tarikhFmt}\n";
            if (!$isAccept && $komen) {
                $tgMsg .= "<b>Sebab:</b> " . htmlspecialchars($komen) . "\n";
            }

            if (!function_exists('tgSend')) {
                require_once __DIR__ . '/telegram.php';
            }
            tgSend((int)$pp['telegram_chat_id'], $tgMsg);
        }
    }
}
