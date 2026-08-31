<?php

/**
 * Tournament-scoped Telegram onboarding for external referees.
 *
 * This flow deliberately does not read or update lantikan_pengadil. It prepares
 * one persistent Telegram identity link per external referee and records every
 * email attempt before appointments are sent.
 */

declare(strict_types=1);

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/email.php';

function requireTelegramOnboardingSchema(PDO $pdo): void
{
    try {
        $pdo->query('SELECT id FROM telegram_onboarding_batch LIMIT 1');
        $pdo->query('SELECT kejohanan_id, linked_at FROM telegram_onboarding_state LIMIT 1');
        $pdo->query('SELECT id FROM telegram_onboarding_log LIMIT 1');
    } catch (Throwable $e) {
        throw new RuntimeException(
            'Log onboarding Telegram belum tersedia. Jalankan docs/migration_lantikan_audit.sql sebelum meneruskan.',
            0,
            $e
        );
    }
}

function buildExternalTelegramOnboardingLink(string $token): string
{
    $botUsername = ltrim((string) env('TELEGRAM_BOT_USERNAME', 'refpahang_bot'), '@');
    return 'https://t.me/' . rawurlencode($botUsername) . '?start=' . rawurlencode($token);
}

/** @return array<string, mixed> */
function getTelegramOnboardingTournament(PDO $pdo, int $kejohananId): array
{
    $stmt = $pdo->prepare("
        SELECT id, nama, status, tarikh_mula, tarikh_akhir
        FROM kejohanan
        WHERE id = :id
    ");
    $stmt->execute([':id' => $kejohananId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new InvalidArgumentException('Kejohanan tidak dijumpai.');
    }
    return $row;
}

/** @return array<int, array<string, mixed>> */
function getExternalTelegramOnboardingRecipients(PDO $pdo, int $kejohananId): array
{
    $stmt = $pdo->prepare("
        SELECT pl.id, pl.nama, pl.daerah, pl.negeri, pl.no_tel, pl.emel,
               pl.telegram_chat_id, pl.tg_link_token, pl.jenis_pengadil,
               os.attempts, os.first_sent_at, os.last_sent_at,
               os.last_failed_at, os.last_error, os.claimed_at, os.linked_at
        FROM pool_pengadil pp
        JOIN pengadil_luar pl ON pl.id = pp.pengadil_luar_id
        LEFT JOIN telegram_onboarding_state os
          ON os.kejohanan_id = pp.kejohanan_id
         AND os.pengadil_luar_id = pp.pengadil_luar_id
        WHERE pp.kejohanan_id = :kejohanan_id
          AND pp.pengadil_luar_id IS NOT NULL
        ORDER BY pl.negeri ASC, pl.nama ASC, pl.id ASC
    ");
    $stmt->execute([':kejohanan_id' => $kejohananId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * @param array<string, mixed> $recipient
 * @return array<string, mixed>
 */
function normalizeTelegramOnboardingRecipient(array $recipient): array
{
    $email = trim((string) ($recipient['emel'] ?? ''));
    $linked = trim((string) ($recipient['telegram_chat_id'] ?? '')) !== '';
    $emailValid = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    $firstSentAt = $recipient['first_sent_at'] ?? null;

    if ($linked) {
        $status = 'linked';
    } elseif ($email === '') {
        $status = 'no_email';
    } elseif (!$emailValid) {
        $status = 'invalid_email';
    } elseif (!empty($firstSentAt)) {
        $status = 'emailed_waiting';
    } elseif (!empty($recipient['last_failed_at'])) {
        $status = 'failed';
    } else {
        $status = 'ready';
    }

    $token = trim((string) ($recipient['tg_link_token'] ?? ''));
    $recipient['id'] = (int) ($recipient['id'] ?? 0);
    $recipient['attempts'] = (int) ($recipient['attempts'] ?? 0);
    $recipient['emel'] = $email;
    $recipient['telegram_linked'] = $linked;
    $recipient['email_valid'] = $emailValid;
    $recipient['onboarding_status'] = $status;
    $recipient['link_url'] = !$linked && $token !== ''
        ? buildExternalTelegramOnboardingLink($token)
        : null;

    unset($recipient['telegram_chat_id'], $recipient['tg_link_token']);
    return $recipient;
}

/** @return array<string, mixed> */
function getTelegramOnboardingPreview(PDO $pdo, int $kejohananId): array
{
    requireTelegramOnboardingSchema($pdo);
    $tournament = getTelegramOnboardingTournament($pdo, $kejohananId);
    $rawRecipients = getExternalTelegramOnboardingRecipients($pdo, $kejohananId);
    $recipients = array_map('normalizeTelegramOnboardingRecipient', $rawRecipients);

    $counts = [
        'total_external' => count($recipients),
        'linked' => 0,
        'no_email' => 0,
        'invalid_email' => 0,
        'ready' => 0,
        'failed' => 0,
        'emailed_waiting' => 0,
        'initial_sendable' => 0,
        'resendable' => 0,
    ];

    foreach ($recipients as $recipient) {
        $status = (string) $recipient['onboarding_status'];
        if (array_key_exists($status, $counts)) {
            $counts[$status]++;
        }
        if (!$recipient['telegram_linked'] && $recipient['email_valid']) {
            $counts['resendable']++;
            if (empty($recipient['first_sent_at'])) {
                $counts['initial_sendable']++;
            }
        }
    }

    $batchStmt = $pdo->prepare("
        SELECT id, batch_token, attempt_mode, total_pool, targeted_count,
               sent_count, failed_count, skipped_count, status,
               actor_user_id, started_at, completed_at
        FROM telegram_onboarding_batch
        WHERE kejohanan_id = :kejohanan_id
        ORDER BY id DESC
        LIMIT 10
    ");
    $batchStmt->execute([':kejohanan_id' => $kejohananId]);

    return [
        'kejohanan' => $tournament,
        'counts' => $counts,
        'recipients' => $recipients,
        'recent_batches' => $batchStmt->fetchAll(PDO::FETCH_ASSOC),
    ];
}

function buildExternalTelegramOnboardingEmail(
    string $nama,
    string $kejohanan,
    string $linkUrl
): string {
    $botUsername = ltrim((string) env('TELEGRAM_BOT_USERNAME', 'refpahang_bot'), '@');
    $safeTournament = htmlspecialchars($kejohanan, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeBot = htmlspecialchars($botUsername, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $body = emailGreeting($nama)
        . emailPara(
            'Nama anda telah dimasukkan dalam pool pengadil luar bagi <strong>'
            . $safeTournament
            . '</strong>. Sila pautkan akaun Telegram anda sebelum lantikan perlawanan dihantar.'
        )
        . emailAlert(
            '#2563EB',
            '#EFF6FF',
            'INI BUKAN LANTIKAN PERLAWANAN',
            'Tiada tindakan Terima atau Tolak diperlukan sekarang. Emel ini hanya untuk memautkan Telegram dan tidak memulakan tempoh jawapan lantikan.'
        )
        . emailButton($linkUrl, 'Pautkan Telegram Sekarang')
        . emailPara('<strong>Langkah mudah:</strong>')
        . emailOrderedList([
            'Klik butang <strong>Pautkan Telegram Sekarang</strong>.',
            'Aplikasi Telegram akan membuka bot <strong>@' . $safeBot . '</strong>.',
            'Klik <strong>START</strong>. Sistem akan mengesahkan bahawa Telegram anda sudah dipautkan.',
        ])
        . emailAlert(
            '#F59E0B',
            '#FFFBEB',
            'PAUTAN PERIBADI',
            'Pautan ini dikhaskan untuk anda. Jangan kongsikan pautan ini dengan orang lain.'
        );

    return buildEmailTemplate('Pautkan Telegram Sebelum Lantikan', '#0088CC', '', $body);
}

/**
 * @param array<string, mixed> $batch
 * @param array<string, mixed> $recipient
 */
function recordTelegramOnboardingLog(
    PDO $pdo,
    array $batch,
    array $recipient,
    string $eventStatus,
    ?string $reason,
    ?string $linkUrl,
    ?string $errorMessage,
    int $actorUserId
): int {
    requireTelegramOnboardingSchema($pdo);
    $stmt = $pdo->prepare("
        INSERT INTO telegram_onboarding_log (
            batch_id, batch_token, kejohanan_id, kejohanan_nama,
            pengadil_luar_id, nama_pegawai, emel_pegawai,
            attempt_mode, event_status, reason, link_url, error_message,
            actor_user_id, ip_address, user_agent
        ) VALUES (
            :batch_id, :batch_token, :kejohanan_id, :kejohanan_nama,
            :pengadil_luar_id, :nama, :emel,
            :attempt_mode, :event_status, :reason, :link_url, :error_message,
            :actor_user_id, :ip_address, :user_agent
        )
    ");
    $stmt->execute([
        ':batch_id' => $batch['id'],
        ':batch_token' => $batch['batch_token'],
        ':kejohanan_id' => $batch['kejohanan_id'],
        ':kejohanan_nama' => $batch['kejohanan_nama'],
        ':pengadil_luar_id' => $recipient['id'],
        ':nama' => $recipient['nama'],
        ':emel' => $recipient['emel'] ?: null,
        ':attempt_mode' => $batch['attempt_mode'],
        ':event_status' => $eventStatus,
        ':reason' => $reason,
        ':link_url' => $linkUrl,
        ':error_message' => $errorMessage,
        ':actor_user_id' => $actorUserId,
        ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        ':user_agent' => isset($_SERVER['HTTP_USER_AGENT'])
            ? mb_substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 255)
            : null,
    ]);
    return (int) $pdo->lastInsertId();
}
