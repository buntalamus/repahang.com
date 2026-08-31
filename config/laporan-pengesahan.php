<?php

/**
 * Pengerusi Pengadil approval workflow for RA reports.
 *
 * The report submit remains final from the RA's perspective. A configured
 * tournament chair reviews it through a purpose-bound token. Admin receives a
 * copy and may only confirm through an explicitly audited override.
 */

declare(strict_types=1);

function requireLaporanPengesahanSchema(PDO $pdo): void
{
    $required = [
        'kejohanan_pengesah_laporan',
        'kejohanan_pengesah_laporan_audit',
        'laporan_pengesahan_pengerusi',
        'laporan_pengesahan_audit',
    ];
    $placeholders = implode(',', array_fill(0, count($required), '?'));
    $stmt = $pdo->prepare(
        "SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ({$placeholders})"
    );
    $stmt->execute($required);
    $found = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $missing = array_values(array_diff($required, $found));
    if ($missing !== []) {
        throw new RuntimeException(
            'Migrasi pengesahan Pengerusi Pengadil belum dijalankan: ' . implode(', ', $missing)
        );
    }
}

/** @param array<string, mixed> $details */
function recordLaporanPengesahanAudit(
    PDO $pdo,
    int $stateId,
    int $reportId,
    string $eventType,
    string $channel,
    string $eventStatus,
    string $actorType = 'system',
    ?int $actorUserId = null,
    ?int $actorLuarId = null,
    ?string $linkUrl = null,
    array $details = []
): void {
    $stmt = $pdo->prepare("
        INSERT INTO laporan_pengesahan_audit (
            laporan_pengesahan_id, laporan_id, event_type, channel,
            event_status, actor_type, actor_user_id, actor_luar_id,
            link_url, details_json, ip_address, user_agent
        ) VALUES (
            :state_id, :report_id, :event_type, :channel,
            :event_status, :actor_type, :actor_user_id, :actor_luar_id,
            :link_url, :details_json, :ip_address, :user_agent
        )
    ");
    $stmt->execute([
        ':state_id' => $stateId,
        ':report_id' => $reportId,
        ':event_type' => mb_substr($eventType, 0, 60),
        ':channel' => mb_substr($channel, 0, 30),
        ':event_status' => mb_substr($eventStatus, 0, 30),
        ':actor_type' => mb_substr($actorType, 0, 30),
        ':actor_user_id' => $actorUserId,
        ':actor_luar_id' => $actorLuarId,
        ':link_url' => $linkUrl,
        ':details_json' => $details === []
            ? null
            : json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        ':user_agent' => isset($_SERVER['HTTP_USER_AGENT'])
            ? mb_substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 255)
            : null,
    ]);
}

/** @return array<string, mixed>|null */
function getKejohananPengesahLaporan(PDO $pdo, int $kejohananId): ?array
{
    $stmt = $pdo->prepare("
        SELECT kp.*,
               COALESCE(u.email, pl.emel, '') AS email,
               COALESCE(u.no_telefon, pl.no_tel, '') AS no_telefon,
               COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
               COALESCE(NULLIF(TRIM(u.negeri), ''), NULLIF(TRIM(pl.negeri), ''), '') AS negeri,
               CASE WHEN kp.pengesah_user_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber
        FROM kejohanan_pengesah_laporan kp
        LEFT JOIN users u ON u.id = kp.pengesah_user_id
        LEFT JOIN pengadil_luar pl ON pl.id = kp.pengesah_luar_id
        WHERE kp.kejohanan_id = :kejohanan_id AND kp.aktif = 1
        LIMIT 1
    ");
    $stmt->execute([':kejohanan_id' => $kejohananId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function buildPengerusiApprovalUrl(string $token): string
{
    $baseUrl = rtrim((string) env('BASE_URL', 'https://refpahang.com'), '/');
    return $baseUrl . '/api/laporan-pengesahan-token.php?token=' . urlencode($token);
}

function buildPengerusiReportPreviewUrl(int $reportId, string $token): string
{
    $baseUrl = rtrim((string) env('BASE_URL', 'https://refpahang.com'), '/');
    return $baseUrl . '/api/download-laporan-penilaian.php?id=' . $reportId
        . '&approval_token=' . urlencode($token);
}

/** @return array<string, mixed> */
function getLaporanApprovalSnapshot(PDO $pdo, int $reportId): array
{
    $stmt = $pdo->prepare("
        SELECT laporan.id AS laporan_id, laporan.status AS laporan_status,
               laporan.jadual_id, laporan.lantikan_id, laporan.tarikh_hantar,
               laporan.tahap_kesukaran, laporan.cuaca, laporan.ulasan_keseluruhan,
               jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
               jp.pasukan_home, jp.pasukan_away, jp.kejohanan_id,
               k.nama AS nama_kejohanan, k.peringkat_kejohanan,
               COALESCE(u_ra.nama_penuh, pl_ra.nama, 'Penilai Pengadil') AS nama_penilai
        FROM laporan_penilaian laporan
        JOIN jadual_perlawanan jp ON jp.id = laporan.jadual_id
        JOIN kejohanan k ON k.id = jp.kejohanan_id
        JOIN lantikan_pengadil ra ON ra.id = laporan.lantikan_id
        LEFT JOIN users u_ra ON u_ra.id = ra.pengadil_id
        LEFT JOIN pengadil_luar pl_ra ON pl_ra.id = ra.pengadil_luar_id
        WHERE laporan.id = :id
          AND ra.jawatan = 'Penilai Pengadil'
          AND ra.status = 'Diterima'
        LIMIT 1
    ");
    $stmt->execute([':id' => $reportId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new RuntimeException('Laporan RA tidak dijumpai.');
    }
    return $row;
}

/** @return array<string, mixed> */
function ensureLaporanPengesahanState(PDO $pdo, int $reportId): array
{
    requireLaporanPengesahanSchema($pdo);
    $report = getLaporanApprovalSnapshot($pdo, $reportId);
    $mapping = getKejohananPengesahLaporan($pdo, (int) $report['kejohanan_id']);

    $stmt = $pdo->prepare("
        SELECT * FROM laporan_pengesahan_pengerusi WHERE laporan_id = :id LIMIT 1
    ");
    $stmt->execute([':id' => $reportId]);
    $state = $stmt->fetch(PDO::FETCH_ASSOC);

    $mappingId = $mapping ? (int) $mapping['id'] : null;
    $mappingChanged = $state
        && $state['status'] === 'Menunggu'
        && (int) ($state['kejohanan_pengesah_id'] ?? 0) !== (int) ($mappingId ?? 0);
    $contactChanged = $state
        && $mapping
        && $state['status'] === 'Menunggu'
        && !$mappingChanged
        && (
            trim((string) ($state['email_recipient'] ?? '')) !== trim((string) ($mapping['email'] ?? ''))
            || (string) ($state['telegram_chat_id'] ?? '') !== (string) ($mapping['telegram_chat_id'] ?? '')
        );

    if (!$state) {
        $token = $mapping ? bin2hex(random_bytes(32)) : null;
        $insert = $pdo->prepare("
            INSERT INTO laporan_pengesahan_pengerusi (
                laporan_id, kejohanan_pengesah_id,
                pengesah_user_id, pengesah_luar_id,
                pengesah_nama, pengesah_jawatan, pengesah_negeri,
                approval_token, email_recipient, telegram_chat_id
            ) VALUES (
                :laporan_id, :mapping_id,
                :user_id, :luar_id,
                :nama, :jawatan, :negeri,
                :token, :email, :chat_id
            )
            ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
        ");
        $insert->execute([
            ':laporan_id' => $reportId,
            ':mapping_id' => $mappingId,
            ':user_id' => $mapping['pengesah_user_id'] ?? null,
            ':luar_id' => $mapping['pengesah_luar_id'] ?? null,
            ':nama' => $mapping['nama_snapshot'] ?? null,
            ':jawatan' => $mapping['jawatan_snapshot'] ?? null,
            ':negeri' => $mapping['negeri'] ?? null,
            ':token' => $token,
            ':email' => $mapping['email'] ?? null,
            ':chat_id' => $mapping['telegram_chat_id'] ?? null,
        ]);
        if ($insert->rowCount() === 1) {
            $stateId = (int) $pdo->lastInsertId();
            recordLaporanPengesahanAudit(
                $pdo,
                $stateId,
                $reportId,
                'approval_prepared',
                'system',
                $mapping ? 'success' : 'failed',
                'system',
                null,
                null,
                $token ? buildPengerusiApprovalUrl($token) : null,
                ['reason' => $mapping ? null : 'pengerusi_not_configured']
            );
        }
    } elseif ($mappingChanged) {
        $token = $mapping ? bin2hex(random_bytes(32)) : null;
        $update = $pdo->prepare("
            UPDATE laporan_pengesahan_pengerusi
            SET kejohanan_pengesah_id = :mapping_id,
                pengesah_user_id = :user_id,
                pengesah_luar_id = :luar_id,
                pengesah_nama = :nama,
                pengesah_jawatan = :jawatan,
                pengesah_negeri = :negeri,
                approval_token = :token,
                email_recipient = :email,
                email_sent_at = NULL,
                email_claimed_at = NULL,
                email_last_error = NULL,
                telegram_chat_id = :chat_id,
                telegram_sent_at = NULL,
                telegram_claimed_at = NULL,
                telegram_last_error = NULL
            WHERE id = :id AND status = 'Menunggu'
              AND (kejohanan_pengesah_id <=> :old_mapping_id)
        ");
        $update->execute([
            ':mapping_id' => $mappingId,
            ':user_id' => $mapping['pengesah_user_id'] ?? null,
            ':luar_id' => $mapping['pengesah_luar_id'] ?? null,
            ':nama' => $mapping['nama_snapshot'] ?? null,
            ':jawatan' => $mapping['jawatan_snapshot'] ?? null,
            ':negeri' => $mapping['negeri'] ?? null,
            ':token' => $token,
            ':email' => $mapping['email'] ?? null,
            ':chat_id' => $mapping['telegram_chat_id'] ?? null,
            ':id' => (int) $state['id'],
            ':old_mapping_id' => $state['kejohanan_pengesah_id'] ?? null,
        ]);
        if ($update->rowCount() === 1) {
            recordLaporanPengesahanAudit(
                $pdo,
                (int) $state['id'],
                $reportId,
                'approver_changed',
                'system',
                $mapping ? 'success' : 'failed',
                'system',
                null,
                null,
                $token ? buildPengerusiApprovalUrl($token) : null,
                ['reason' => $mapping ? null : 'pengerusi_not_configured']
            );
        }
    } elseif ($contactChanged) {
        $pdo->prepare("
            UPDATE laporan_pengesahan_pengerusi
            SET email_recipient = :email,
                email_last_error = CASE WHEN email_sent_at IS NULL THEN NULL ELSE email_last_error END,
                telegram_chat_id = :chat_id,
                telegram_last_error = CASE WHEN telegram_sent_at IS NULL THEN NULL ELSE telegram_last_error END
            WHERE id = :id AND status = 'Menunggu'
        ")->execute([
            ':email' => $mapping['email'] ?? null,
            ':chat_id' => $mapping['telegram_chat_id'] ?? null,
            ':id' => (int) $state['id'],
        ]);
        recordLaporanPengesahanAudit(
            $pdo,
            (int) $state['id'],
            $reportId,
            'approver_contact_refreshed',
            'system',
            'success',
            'system',
            null,
            null,
            !empty($state['approval_token']) ? buildPengerusiApprovalUrl((string) $state['approval_token']) : null,
            [
                'email_available' => trim((string) ($mapping['email'] ?? '')) !== '',
                'telegram_linked' => !empty($mapping['telegram_chat_id']),
            ]
        );
    }

    $stmt->execute([':id' => $reportId]);
    $state = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$state) {
        throw new RuntimeException('Status pengesahan Pengerusi gagal disediakan.');
    }
    return $state;
}

function notifyAdminReportCopy(PDO $pdo, array $report, array $state): void
{
    $ownsTransaction = !$pdo->inTransaction();
    if ($ownsTransaction) {
        $pdo->beginTransaction();
    }
    try {
        $claim = $pdo->prepare("
            UPDATE laporan_pengesahan_pengerusi
            SET admin_copy_at = NOW()
            WHERE id = :id AND admin_copy_at IS NULL
        ");
        $claim->execute([':id' => (int) $state['id']]);
        if ($claim->rowCount() !== 1) {
            if ($ownsTransaction) {
                $pdo->commit();
            }
            return;
        }

        $admins = $pdo->query("SELECT id FROM users WHERE role = 'Admin' AND aktif = 1")
            ->fetchAll(PDO::FETCH_COLUMN);
        $subject = 'Salinan Laporan RA — Menunggu Pengesahan Pengerusi';
        $pengerusi = trim((string) ($state['pengesah_nama'] ?? '')) ?: 'belum ditetapkan';
        $message = sprintf(
            '%s telah menghantar laporan RA bagi %s lwn %s (%s). Pengerusi Pengadil: %s. Admin boleh menyemak salinan dan hanya menggunakan override jika perlu.',
            $report['nama_penilai'],
            $report['pasukan_home'],
            $report['pasukan_away'],
            $report['nama_kejohanan'],
            $pengerusi
        );
        $insert = $pdo->prepare("
            INSERT INTO notifications (user_id, type, subject, message)
            VALUES (:user_id, 'Laporan RA', :subject, :message)
        ");
        foreach ($admins as $adminId) {
            $insert->execute([
                ':user_id' => (int) $adminId,
                ':subject' => $subject,
                ':message' => $message,
            ]);
        }

        recordLaporanPengesahanAudit(
            $pdo,
            (int) $state['id'],
            (int) $report['laporan_id'],
            'admin_copy_created',
            'portal',
            'success',
            'system',
            null,
            null,
            null,
            ['admin_count' => count($admins)]
        );
        if ($ownsTransaction) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($ownsTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/**
 * @param null|callable(string,string,string,string):bool $emailSender
 * @param null|callable(int,string,array):bool $telegramSender
 * @return array<string, mixed>
 */
function dispatchLaporanForPengerusi(
    PDO $pdo,
    int $reportId,
    ?callable $emailSender = null,
    ?callable $telegramSender = null
): array {
    require_once __DIR__ . '/env.php';
    require_once __DIR__ . '/email.php';
    $state = ensureLaporanPengesahanState($pdo, $reportId);
    $report = getLaporanApprovalSnapshot($pdo, $reportId);
    notifyAdminReportCopy($pdo, $report, $state);

    $token = trim((string) ($state['approval_token'] ?? ''));
    if ($token === '' || empty($state['kejohanan_pengesah_id'])) {
        return [
            'configured' => false,
            'email_sent' => false,
            'telegram_sent' => false,
            'state' => $state,
        ];
    }

    $approvalUrl = buildPengerusiApprovalUrl($token);
    $previewUrl = buildPengerusiReportPreviewUrl($reportId, $token);
    $emailDelivered = !empty($state['email_sent_at']);
    $telegramDelivered = !empty($state['telegram_sent_at']);

    if (!$emailDelivered && trim((string) ($state['email_recipient'] ?? '')) === ''
        && (int) ($state['email_attempts'] ?? 0) === 0) {
        $skipEmail = $pdo->prepare("
            UPDATE laporan_pengesahan_pengerusi
            SET email_attempts = email_attempts + 1, email_last_error = 'email_not_available'
            WHERE id = :id AND email_sent_at IS NULL AND email_attempts = 0
        ");
        $skipEmail->execute([':id' => (int) $state['id']]);
        if ($skipEmail->rowCount() === 1) {
            recordLaporanPengesahanAudit(
                $pdo, (int) $state['id'], $reportId,
                'chair_notification', 'email', 'skipped',
                'system', null, null, $approvalUrl,
                ['reason' => 'email_not_available']
            );
        }
    }

    if (!$telegramDelivered && empty($state['telegram_chat_id'])
        && (int) ($state['telegram_attempts'] ?? 0) === 0) {
        $skipTelegram = $pdo->prepare("
            UPDATE laporan_pengesahan_pengerusi
            SET telegram_attempts = telegram_attempts + 1, telegram_last_error = 'telegram_not_linked'
            WHERE id = :id AND telegram_sent_at IS NULL AND telegram_attempts = 0
        ");
        $skipTelegram->execute([':id' => (int) $state['id']]);
        if ($skipTelegram->rowCount() === 1) {
            recordLaporanPengesahanAudit(
                $pdo, (int) $state['id'], $reportId,
                'chair_notification', 'telegram', 'skipped',
                'system', null, null, $approvalUrl,
                ['reason' => 'telegram_not_linked']
            );
        }
    }

    if (!$emailDelivered && trim((string) ($state['email_recipient'] ?? '')) !== '') {
        $claim = $pdo->prepare("
            UPDATE laporan_pengesahan_pengerusi
            SET email_claimed_at = NOW(), email_attempts = email_attempts + 1
            WHERE id = :id AND email_sent_at IS NULL
              AND (email_claimed_at IS NULL OR email_claimed_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE))
        ");
        $claim->execute([':id' => (int) $state['id']]);
        if ($claim->rowCount() === 1) {
            try {
                if ($emailSender === null) {
                    $emailSender = static function (string $to, string $name, string $subject, string $html): bool {
                        return sendEmail($to, $subject, $html, $name, 'lantikan');
                    };
                }
                $body = emailGreeting((string) $state['pengesah_nama'])
                    . emailPara('Satu laporan Penilai Pengadil telah dihantar dan memerlukan pengesahan anda sebagai <strong>'
                        . htmlspecialchars((string) $state['pengesah_jawatan']) . '</strong>.')
                    . emailInfoTable([
                        'Kejohanan' => htmlspecialchars((string) $report['nama_kejohanan']),
                        'Perlawanan' => htmlspecialchars($report['pasukan_home'] . ' lwn ' . $report['pasukan_away']),
                        'Tarikh' => date('d M Y', strtotime((string) $report['tarikh'])),
                        'Penilai' => htmlspecialchars((string) $report['nama_penilai']),
                    ])
                    . emailPara('Sila semak laporan penuh, tulis komen jika perlu, kemudian buat pengesahan.')
                    . emailButton($approvalUrl, 'Semak & Sahkan Laporan')
                    . emailPara('<a href="' . htmlspecialchars($previewUrl) . '">Lihat laporan penuh dalam mod baca sahaja</a>');
                $html = buildEmailTemplate('Pengesahan Laporan RA', '#7C3AED', '📋', $body);
                $emailDelivered = (bool) $emailSender(
                    (string) $state['email_recipient'],
                    (string) $state['pengesah_nama'],
                    'Pengesahan Laporan RA — ' . $report['pasukan_home'] . ' lwn ' . $report['pasukan_away'],
                    $html
                );
                $pdo->prepare("
                    UPDATE laporan_pengesahan_pengerusi
                    SET email_sent_at = IF(:ok = 1, NOW(), email_sent_at),
                        email_last_error = IF(:ok = 1, NULL, 'send_failed'),
                        email_claimed_at = NULL
                    WHERE id = :id
                ")->execute([':ok' => $emailDelivered ? 1 : 0, ':id' => (int) $state['id']]);
                recordLaporanPengesahanAudit(
                    $pdo, (int) $state['id'], $reportId,
                    'chair_notification', 'email', $emailDelivered ? 'success' : 'failed',
                    'system', null, null, $approvalUrl,
                    ['recipient' => $state['email_recipient']]
                );
            } catch (Throwable $e) {
                $pdo->prepare("
                    UPDATE laporan_pengesahan_pengerusi
                    SET email_last_error = :error, email_claimed_at = NULL WHERE id = :id
                ")->execute([
                    ':error' => mb_substr($e->getMessage(), 0, 2000),
                    ':id' => (int) $state['id'],
                ]);
                recordLaporanPengesahanAudit(
                    $pdo, (int) $state['id'], $reportId,
                    'chair_notification', 'email', 'failed',
                    'system', null, null, $approvalUrl,
                    ['error' => $e->getMessage()]
                );
            }
        }
    }

    if (!$telegramDelivered && !empty($state['telegram_chat_id'])) {
        $claim = $pdo->prepare("
            UPDATE laporan_pengesahan_pengerusi
            SET telegram_claimed_at = NOW(), telegram_attempts = telegram_attempts + 1
            WHERE id = :id AND telegram_sent_at IS NULL
              AND (telegram_claimed_at IS NULL OR telegram_claimed_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE))
        ");
        $claim->execute([':id' => (int) $state['id']]);
        if ($claim->rowCount() === 1) {
            try {
                if ($telegramSender === null) {
                    require_once __DIR__ . '/telegram.php';
                    $telegramSender = static function (int $chatId, string $message, array $keyboard): bool {
                        return tgSend($chatId, $message, $keyboard);
                    };
                }
                $message = "📋 <b>Pengesahan Laporan RA</b>\n\n"
                    . "🏆 " . htmlspecialchars((string) $report['nama_kejohanan']) . "\n"
                    . "⚽ " . htmlspecialchars($report['pasukan_home'] . ' lwn ' . $report['pasukan_away']) . "\n"
                    . "👤 Penilai: " . htmlspecialchars((string) $report['nama_penilai']) . "\n\n"
                    . "Sila semak, tulis komen dan sahkan laporan ini.";
                $telegramDelivered = (bool) $telegramSender(
                    (int) $state['telegram_chat_id'],
                    $message,
                    ['inline_keyboard' => [[['text' => '📋 Semak & Sahkan', 'url' => $approvalUrl]]]]
                );
                $pdo->prepare("
                    UPDATE laporan_pengesahan_pengerusi
                    SET telegram_sent_at = IF(:ok = 1, NOW(), telegram_sent_at),
                        telegram_last_error = IF(:ok = 1, NULL, 'send_failed'),
                        telegram_claimed_at = NULL
                    WHERE id = :id
                ")->execute([':ok' => $telegramDelivered ? 1 : 0, ':id' => (int) $state['id']]);
                recordLaporanPengesahanAudit(
                    $pdo, (int) $state['id'], $reportId,
                    'chair_notification', 'telegram', $telegramDelivered ? 'success' : 'failed',
                    'system', null, null, $approvalUrl,
                    ['telegram_chat_id' => $state['telegram_chat_id']]
                );
            } catch (Throwable $e) {
                $pdo->prepare("
                    UPDATE laporan_pengesahan_pengerusi
                    SET telegram_last_error = :error, telegram_claimed_at = NULL WHERE id = :id
                ")->execute([
                    ':error' => mb_substr($e->getMessage(), 0, 2000),
                    ':id' => (int) $state['id'],
                ]);
                recordLaporanPengesahanAudit(
                    $pdo, (int) $state['id'], $reportId,
                    'chair_notification', 'telegram', 'failed',
                    'system', null, null, $approvalUrl,
                    ['error' => $e->getMessage()]
                );
            }
        }
    }

    $stmt = $pdo->prepare("SELECT * FROM laporan_pengesahan_pengerusi WHERE id = :id");
    $stmt->execute([':id' => (int) $state['id']]);
    $latest = $stmt->fetch(PDO::FETCH_ASSOC) ?: $state;
    return [
        'configured' => true,
        'email_sent' => !empty($latest['email_sent_at']),
        'telegram_sent' => !empty($latest['telegram_sent_at']),
        'state' => $latest,
    ];
}

/** @return array<int, array<string, mixed>> */
function fetchLaporanPegawaiForNotification(PDO $pdo, int $reportId): array
{
    $stmt = $pdo->prepare("
        SELECT lpp.*
        FROM laporan_penilaian_pegawai lpp
        WHERE lpp.laporan_id = :id
        ORDER BY FIELD(lpp.jawatan, 'Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
    ");
    $stmt->execute([':id' => $reportId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) {
        foreach (['kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan','fizikal_kelemahan','kerjasama_kekuatan','kerjasama_kelemahan'] as $column) {
            $decoded = json_decode((string) ($row[$column] ?? ''), true);
            $row[$column] = is_array($decoded) ? $decoded : [];
        }
    }
    unset($row);
    return $rows;
}

function notifyConfirmedReportOfficials(
    PDO $pdo,
    int $reportId,
    string $finalComment,
    string $commentLabel,
    int $approvalStateId
): void {
    require_once __DIR__ . '/email.php';
    require_once __DIR__ . '/telegram.php';
    require_once __DIR__ . '/penilaian-helper.php';

    $stmt = $pdo->prepare("
        SELECT laporan.*, jp.tarikh, jp.pasukan_home, jp.pasukan_away,
               k.nama AS nama_kejohanan,
               COALESCE(u_ra.nama_penuh, pl_ra.nama, 'Penilai Pengadil') AS nama_penilai,
               ra.penilaian_token
        FROM laporan_penilaian laporan
        JOIN jadual_perlawanan jp ON jp.id = laporan.jadual_id
        JOIN kejohanan k ON k.id = jp.kejohanan_id
        JOIN lantikan_pengadil ra ON ra.id = laporan.lantikan_id
        LEFT JOIN users u_ra ON u_ra.id = ra.pengadil_id
        LEFT JOIN pengadil_luar pl_ra ON pl_ra.id = ra.pengadil_luar_id
        WHERE laporan.id = :id AND laporan.status = 'Disahkan'
    ");
    $stmt->execute([':id' => $reportId]);
    $report = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$report) {
        throw new RuntimeException('Laporan disahkan tidak dijumpai untuk notifikasi KUP.');
    }

    if (trim((string) ($report['penilaian_token'] ?? '')) === '') {
        $report['penilaian_token'] = bin2hex(random_bytes(32));
        $pdo->prepare("
            UPDATE lantikan_pengadil
            SET penilaian_token = :token
            WHERE id = :id AND status = 'Diterima' AND jawatan = 'Penilai Pengadil'
        ")->execute([
            ':token' => $report['penilaian_token'],
            ':id' => (int) $report['lantikan_id'],
        ]);
    }

    $viewToken = createReportViewToken($reportId, (string) $report['penilaian_token']);
    $reportUrl = rtrim((string) env('BASE_URL', 'https://refpahang.com'), '/')
        . '/api/download-laporan-penilaian.php?id=' . $reportId
        . '&view_token=' . urlencode($viewToken);
    $pasukan = $report['pasukan_home'] . ' vs ' . $report['pasukan_away'];

    foreach (fetchLaporanPegawaiForNotification($pdo, $reportId) as $officialReport) {
        $officialStmt = $pdo->prepare("
            SELECT COALESCE(u.email, pl.emel, '') AS email,
                   COALESCE(u.nama_penuh, pl.nama, '') AS nama,
                   COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id
            FROM lantikan_pengadil lp
            LEFT JOIN users u ON u.id = lp.pengadil_id
            LEFT JOIN pengadil_luar pl ON pl.id = lp.pengadil_luar_id
            WHERE lp.id = :id
        ");
        $officialStmt->execute([':id' => (int) $officialReport['lantikan_pengadil_id']]);
        $recipient = $officialStmt->fetch(PDO::FETCH_ASSOC);
        if (!$recipient) {
            recordLaporanPengesahanAudit(
                $pdo, $approvalStateId, $reportId,
                'kup_report_notification', 'system', 'skipped',
                'system', null, null, $reportUrl,
                ['lantikan_id' => (int) $officialReport['lantikan_pengadil_id'], 'reason' => 'appointment_not_found']
            );
            continue;
        }

        $strengths = array_merge(
            $officialReport['kawalan_kekuatan'],
            $officialReport['fizikal_kekuatan'],
            $officialReport['kerjasama_kekuatan']
        );
        $weaknesses = array_merge(
            $officialReport['kawalan_kelemahan'],
            $officialReport['fizikal_kelemahan'],
            $officialReport['kerjasama_kelemahan']
        );
        $advice = implode("\n", array_filter([
            $officialReport['kawalan_nasihat'] ?? '',
            $officialReport['fizikal_nasihat'] ?? '',
            $officialReport['kerjasama_nasihat'] ?? '',
        ]));

        if (trim((string) $recipient['email']) !== '') {
            $emailDetails = [
                'lantikan_id' => (int) $officialReport['lantikan_pengadil_id'],
                'recipient' => $recipient['email'],
            ];
            try {
                $ok = sendPenilaianEmail(
                    (string) $recipient['email'],
                    (string) ($recipient['nama'] ?: '-'),
                    (string) $officialReport['jawatan'],
                    (string) $report['nama_kejohanan'],
                    (string) $report['tarikh'],
                    $pasukan,
                    (string) $report['nama_penilai'],
                    $officialReport['markah'] !== null ? (float) $officialReport['markah'] : null,
                    $officialReport['prestasi'],
                    $strengths,
                    $weaknesses,
                    $advice,
                    (string) ($report['ulasan_keseluruhan'] ?? ''),
                    $finalComment,
                    $reportUrl,
                    $commentLabel
                );
            } catch (Throwable $e) {
                $ok = false;
                $emailDetails['error'] = $e->getMessage();
            }
            recordLaporanPengesahanAudit(
                $pdo, $approvalStateId, $reportId,
                'kup_report_notification', 'email', $ok ? 'success' : 'failed',
                'system', null, null, $reportUrl,
                $emailDetails
            );
        } else {
            recordLaporanPengesahanAudit(
                $pdo, $approvalStateId, $reportId,
                'kup_report_notification', 'email', 'skipped',
                'system', null, null, $reportUrl,
                ['lantikan_id' => (int) $officialReport['lantikan_pengadil_id'], 'reason' => 'email_not_available']
            );
        }

        if (!empty($recipient['telegram_chat_id'])) {
            $mark = $officialReport['markah'] !== null
                ? number_format((float) $officialReport['markah'], 1)
                : '-';
            $message = "📋 <b>Laporan Penilaian Disahkan</b>\n\n"
                . "⚽ <b>" . htmlspecialchars($pasukan) . "</b>\n"
                . "🏆 " . htmlspecialchars((string) $report['nama_kejohanan']) . "\n"
                . "👤 Jawatan: <b>" . htmlspecialchars((string) $officialReport['jawatan']) . "</b>\n"
                . "📊 Markah: <b>{$mark}</b>/10\n"
                . "🔍 Penilai: " . htmlspecialchars((string) $report['nama_penilai'])
                . "\n\n📋 <a href=\"" . htmlspecialchars($reportUrl) . "\">Lihat Laporan Penuh</a>";
            $telegramDetails = ['lantikan_id' => (int) $officialReport['lantikan_pengadil_id']];
            try {
                $ok = tgSend((int) $recipient['telegram_chat_id'], $message);
            } catch (Throwable $e) {
                $ok = false;
                $telegramDetails['error'] = $e->getMessage();
            }
            recordLaporanPengesahanAudit(
                $pdo, $approvalStateId, $reportId,
                'kup_report_notification', 'telegram', $ok ? 'success' : 'failed',
                'system', null, null, $reportUrl,
                $telegramDetails
            );
        } else {
            recordLaporanPengesahanAudit(
                $pdo, $approvalStateId, $reportId,
                'kup_report_notification', 'telegram', 'skipped',
                'system', null, null, $reportUrl,
                ['lantikan_id' => (int) $officialReport['lantikan_pengadil_id'], 'reason' => 'telegram_not_linked']
            );
        }
    }
}

/** @return array<string, mixed> */
function confirmLaporanByPengerusi(
    PDO $pdo,
    string $token,
    string $comment,
    ?callable $officialNotifier = null
): array
{
    requireLaporanPengesahanSchema($pdo);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            SELECT approval.*, laporan.jadual_id, laporan.status AS laporan_status
            FROM laporan_pengesahan_pengerusi approval
            JOIN laporan_penilaian laporan ON laporan.id = approval.laporan_id
            WHERE approval.approval_token = :token
            LIMIT 1 FOR UPDATE
        ");
        $stmt->execute([':token' => $token]);
        $state = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$state) {
            throw new InvalidArgumentException('Pautan pengesahan tidak sah.');
        }
        if ($state['status'] !== 'Menunggu' || $state['laporan_status'] !== 'Dihantar') {
            throw new DomainException('Laporan ini telah disahkan atau di-override sebelum ini.');
        }

        $pdo->prepare("
            UPDATE laporan_pengesahan_pengerusi
            SET status = 'Disahkan', catatan_pengerusi = :comment, tarikh_sahkan = NOW()
            WHERE id = :id AND status = 'Menunggu'
        ")->execute([':comment' => $comment, ':id' => (int) $state['id']]);
        $pdo->prepare("
            UPDATE laporan_penilaian
            SET status = 'Disahkan', catatan_admin = :comment, tarikh_sahkan = NOW()
            WHERE id = :id AND status = 'Dihantar'
        ")->execute([':comment' => $comment, ':id' => (int) $state['laporan_id']]);
        $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Selesai' WHERE id = :id")
            ->execute([':id' => (int) $state['jadual_id']]);
        recordLaporanPengesahanAudit(
            $pdo, (int) $state['id'], (int) $state['laporan_id'],
            'report_confirmed', 'token', 'success',
            !empty($state['pengesah_luar_id']) ? 'pengerusi_luar' : 'pengerusi_berdaftar',
            !empty($state['pengesah_user_id']) ? (int) $state['pengesah_user_id'] : null,
            !empty($state['pengesah_luar_id']) ? (int) $state['pengesah_luar_id'] : null,
            buildPengerusiApprovalUrl($token),
            ['comment' => $comment]
        );
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    try {
        if ($officialNotifier === null) {
            notifyConfirmedReportOfficials(
                $pdo,
                (int) $state['laporan_id'],
                $comment,
                'Catatan Pengerusi Pengadil',
                (int) $state['id']
            );
        } else {
            $officialNotifier($pdo, (int) $state['laporan_id'], $comment, 'Catatan Pengerusi Pengadil', (int) $state['id']);
        }
    } catch (Throwable $e) {
        error_log('[confirmLaporanByPengerusi] notification error: ' . $e->getMessage());
    }
    return $state;
}

/** @return array<string, mixed> */
function overrideLaporanByAdmin(
    PDO $pdo,
    int $reportId,
    int $adminUserId,
    string $reason,
    string $comment,
    ?callable $officialNotifier = null
): array {
    if (trim($reason) === '') {
        throw new InvalidArgumentException('Sebab override Admin diperlukan.');
    }
    $state = ensureLaporanPengesahanState($pdo, $reportId);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            SELECT approval.*, laporan.jadual_id, laporan.status AS laporan_status
            FROM laporan_pengesahan_pengerusi approval
            JOIN laporan_penilaian laporan ON laporan.id = approval.laporan_id
            WHERE approval.id = :id
            LIMIT 1 FOR UPDATE
        ");
        $stmt->execute([':id' => (int) $state['id']]);
        $locked = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$locked || $locked['status'] !== 'Menunggu' || $locked['laporan_status'] !== 'Dihantar') {
            throw new DomainException('Laporan ini telah disahkan atau di-override sebelum ini.');
        }

        $pdo->prepare("
            UPDATE laporan_pengesahan_pengerusi
            SET status = 'Override Admin', admin_override_user_id = :admin_id,
                alasan_override = :reason, catatan_pengerusi = :comment,
                tarikh_sahkan = NOW()
            WHERE id = :id AND status = 'Menunggu'
        ")->execute([
            ':admin_id' => $adminUserId,
            ':reason' => $reason,
            ':comment' => $comment,
            ':id' => (int) $locked['id'],
        ]);
        $pdo->prepare("
            UPDATE laporan_penilaian
            SET status = 'Disahkan', catatan_admin = :comment, tarikh_sahkan = NOW()
            WHERE id = :id AND status = 'Dihantar'
        ")->execute([':comment' => $comment, ':id' => $reportId]);
        $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Selesai' WHERE id = :id")
            ->execute([':id' => (int) $locked['jadual_id']]);
        recordLaporanPengesahanAudit(
            $pdo, (int) $locked['id'], $reportId,
            'report_admin_override', 'admin', 'success',
            'admin', $adminUserId, null, null,
            ['reason' => $reason, 'comment' => $comment, 'configured_chair' => $locked['pengesah_nama']]
        );
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    try {
        if ($officialNotifier === null) {
            notifyConfirmedReportOfficials(
                $pdo,
                $reportId,
                $comment,
                'Catatan Override Admin',
                (int) $locked['id']
            );
        } else {
            $officialNotifier($pdo, $reportId, $comment, 'Catatan Override Admin', (int) $locked['id']);
        }
    } catch (Throwable $e) {
        error_log('[overrideLaporanByAdmin] notification error: ' . $e->getMessage());
    }
    return $locked;
}
