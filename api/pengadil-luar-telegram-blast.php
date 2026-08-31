<?php

/**
 * Admin-only Telegram onboarding email blast for external referees in one
 * tournament pool.
 *
 * GET  ?kejohanan_id=X previews recipients and previous batches.
 * POST {kejohanan_id, mode: initial|resend} sends onboarding email only.
 *
 * This endpoint never reads or updates lantikan_pengadil, therefore it cannot
 * start an appointment response deadline.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/telegram-onboarding.php';

$actorUserId = requireAdmin();
$pdo = getDbConnection();
$batchId = null;

try {
    requireTelegramOnboardingSchema($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $kejohananId = (int) ($_GET['kejohanan_id'] ?? 0);
        if ($kejohananId <= 0) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
        }
        jsonResponse([
            'error' => false,
            'data' => getTelegramOnboardingPreview($pdo, $kejohananId),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);
    }

    $input = getJsonInput();
    $kejohananId = (int) ($input['kejohanan_id'] ?? 0);
    $mode = trim((string) ($input['mode'] ?? 'initial'));
    if ($kejohananId <= 0) {
        jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
    }
    if (!in_array($mode, ['initial', 'resend'], true)) {
        jsonResponse(['error' => true, 'message' => 'Mode penghantaran tidak sah.'], 400);
    }

    set_time_limit(600);
    $tournament = getTelegramOnboardingTournament($pdo, $kejohananId);
    $recipients = getExternalTelegramOnboardingRecipients($pdo, $kejohananId);
    $batchToken = bin2hex(random_bytes(16));

    $batchStmt = $pdo->prepare("
        INSERT INTO telegram_onboarding_batch (
            batch_token, kejohanan_id, kejohanan_nama, attempt_mode,
            total_pool, actor_user_id, ip_address, user_agent
        ) VALUES (
            :batch_token, :kejohanan_id, :kejohanan_nama, :attempt_mode,
            :total_pool, :actor_user_id, :ip_address, :user_agent
        )
    ");
    $batchStmt->execute([
        ':batch_token' => $batchToken,
        ':kejohanan_id' => $kejohananId,
        ':kejohanan_nama' => $tournament['nama'],
        ':attempt_mode' => $mode,
        ':total_pool' => count($recipients),
        ':actor_user_id' => $actorUserId,
        ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        ':user_agent' => isset($_SERVER['HTTP_USER_AGENT'])
            ? mb_substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 255)
            : null,
    ]);
    $batchId = (int) $pdo->lastInsertId();
    $batch = [
        'id' => $batchId,
        'batch_token' => $batchToken,
        'kejohanan_id' => $kejohananId,
        'kejohanan_nama' => (string) $tournament['nama'],
        'attempt_mode' => $mode,
    ];

    $sent = 0;
    $failed = 0;
    $skipped = 0;
    $errors = [];
    $consecutiveFailures = 0;
    $smtpCircuitOpen = false;

    $insertStateStmt = $pdo->prepare("
        INSERT IGNORE INTO telegram_onboarding_state (kejohanan_id, pengadil_luar_id)
        VALUES (:kejohanan_id, :pengadil_luar_id)
    ");
    $claimInitialStmt = $pdo->prepare("
        UPDATE telegram_onboarding_state
        SET claim_token = :claim_token,
            claimed_at = CURRENT_TIMESTAMP,
            attempts = attempts + 1,
            last_batch_id = :batch_id
        WHERE kejohanan_id = :kejohanan_id
          AND pengadil_luar_id = :pengadil_luar_id
          AND first_sent_at IS NULL
          AND (claimed_at IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE))
    ");
    $claimResendStmt = $pdo->prepare("
        UPDATE telegram_onboarding_state
        SET claim_token = :claim_token,
            claimed_at = CURRENT_TIMESTAMP,
            attempts = attempts + 1,
            last_batch_id = :batch_id
        WHERE kejohanan_id = :kejohanan_id
          AND pengadil_luar_id = :pengadil_luar_id
          AND (claimed_at IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE))
    ");
    $stateStatusStmt = $pdo->prepare("
        SELECT first_sent_at, claimed_at
        FROM telegram_onboarding_state
        WHERE kejohanan_id = :kejohanan_id
          AND pengadil_luar_id = :pengadil_luar_id
    ");
    $ensureTokenStmt = $pdo->prepare("
        UPDATE pengadil_luar
        SET tg_link_token = IF(
            tg_link_token IS NULL OR tg_link_token = '',
            :candidate_token,
            tg_link_token
        )
        WHERE id = :pengadil_luar_id
    ");
    $profileStmt = $pdo->prepare("
        SELECT telegram_chat_id, tg_link_token
        FROM pengadil_luar
        WHERE id = :pengadil_luar_id
    ");
    $clearClaimStmt = $pdo->prepare("
        UPDATE telegram_onboarding_state
        SET claim_token = NULL, claimed_at = NULL
        WHERE kejohanan_id = :kejohanan_id
          AND pengadil_luar_id = :pengadil_luar_id
          AND claim_token = :claim_token
    ");
    $completeSuccessStmt = $pdo->prepare("
        UPDATE telegram_onboarding_state
        SET first_sent_at = COALESCE(first_sent_at, CURRENT_TIMESTAMP),
            last_sent_at = CURRENT_TIMESTAMP,
            last_error = NULL,
            claim_token = NULL,
            claimed_at = NULL
        WHERE kejohanan_id = :kejohanan_id
          AND pengadil_luar_id = :pengadil_luar_id
          AND claim_token = :claim_token
    ");
    $completeFailureStmt = $pdo->prepare("
        UPDATE telegram_onboarding_state
        SET last_failed_at = CURRENT_TIMESTAMP,
            last_error = :last_error,
            claim_token = NULL,
            claimed_at = NULL
        WHERE kejohanan_id = :kejohanan_id
          AND pengadil_luar_id = :pengadil_luar_id
          AND claim_token = :claim_token
    ");

    foreach ($recipients as $rawRecipient) {
        $recipient = normalizeTelegramOnboardingRecipient($rawRecipient);
        $skipReason = null;
        if ($recipient['telegram_linked']) {
            $skipReason = 'already_linked';
        } elseif (trim((string) $recipient['emel']) === '') {
            $skipReason = 'email_missing';
        } elseif (!$recipient['email_valid']) {
            $skipReason = 'email_invalid';
        } elseif ($mode === 'initial' && !empty($recipient['first_sent_at'])) {
            $skipReason = 'already_emailed';
        }

        if ($skipReason !== null) {
            recordTelegramOnboardingLog(
                $pdo,
                $batch,
                $recipient,
                'skipped',
                $skipReason,
                $recipient['link_url'],
                null,
                $actorUserId
            );
            $skipped++;
            continue;
        }

        // A server-wide SMTP outage must not hold one HTTP request open for
        // every member of a large pool. Three consecutive failures stop this
        // batch; untouched recipients remain eligible for a later retry.
        if ($smtpCircuitOpen) {
            recordTelegramOnboardingLog(
                $pdo,
                $batch,
                $recipient,
                'skipped',
                'smtp_circuit_open',
                $recipient['link_url'],
                null,
                $actorUserId
            );
            $skipped++;
            continue;
        }

        $insertStateStmt->execute([
            ':kejohanan_id' => $kejohananId,
            ':pengadil_luar_id' => $recipient['id'],
        ]);
        $claimToken = bin2hex(random_bytes(16));
        $claimParams = [
            ':claim_token' => $claimToken,
            ':batch_id' => $batchId,
            ':kejohanan_id' => $kejohananId,
            ':pengadil_luar_id' => $recipient['id'],
        ];
        $claimStmt = $mode === 'initial' ? $claimInitialStmt : $claimResendStmt;
        $claimStmt->execute($claimParams);
        if ($claimStmt->rowCount() !== 1) {
            $stateStatusStmt->execute([
                ':kejohanan_id' => $kejohananId,
                ':pengadil_luar_id' => $recipient['id'],
            ]);
            $state = $stateStatusStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $reason = $mode === 'initial' && !empty($state['first_sent_at'])
                ? 'already_emailed'
                : 'delivery_in_progress';
            recordTelegramOnboardingLog(
                $pdo,
                $batch,
                $recipient,
                'skipped',
                $reason,
                $recipient['link_url'],
                null,
                $actorUserId
            );
            $skipped++;
            continue;
        }

        $ensureTokenStmt->execute([
            ':candidate_token' => bin2hex(random_bytes(16)),
            ':pengadil_luar_id' => $recipient['id'],
        ]);
        $profileStmt->execute([':pengadil_luar_id' => $recipient['id']]);
        $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);
        if (!$profile) {
            $clearClaimStmt->execute([
                ':kejohanan_id' => $kejohananId,
                ':pengadil_luar_id' => $recipient['id'],
                ':claim_token' => $claimToken,
            ]);
            recordTelegramOnboardingLog(
                $pdo,
                $batch,
                $recipient,
                'skipped',
                'profile_missing',
                null,
                null,
                $actorUserId
            );
            $skipped++;
            continue;
        }
        if (trim((string) ($profile['telegram_chat_id'] ?? '')) !== '') {
            $clearClaimStmt->execute([
                ':kejohanan_id' => $kejohananId,
                ':pengadil_luar_id' => $recipient['id'],
                ':claim_token' => $claimToken,
            ]);
            recordTelegramOnboardingLog(
                $pdo,
                $batch,
                $recipient,
                'skipped',
                'linked_during_batch',
                null,
                null,
                $actorUserId
            );
            $skipped++;
            continue;
        }

        $token = trim((string) ($profile['tg_link_token'] ?? ''));
        if ($token === '') {
            throw new RuntimeException('Token Telegram tidak dapat disediakan untuk ' . $recipient['nama'] . '.');
        }
        $linkUrl = buildExternalTelegramOnboardingLink($token);
        recordTelegramOnboardingLog(
            $pdo,
            $batch,
            $recipient,
            'processing',
            'smtp_attempt_started',
            $linkUrl,
            null,
            $actorUserId
        );

        $emailError = null;
        try {
            $html = buildExternalTelegramOnboardingEmail(
                (string) $recipient['nama'],
                (string) $tournament['nama'],
                $linkUrl
            );
            $delivered = sendEmail(
                (string) $recipient['emel'],
                'Pautkan Telegram Sebelum Lantikan — ' . (string) $tournament['nama'],
                $html,
                (string) $recipient['nama'],
                'lantikan'
            );
            if (!$delivered) {
                $emailError = 'Penghantar SMTP mengembalikan status gagal.';
            }
        } catch (Throwable $emailException) {
            $delivered = false;
            $emailError = $emailException->getMessage();
            error_log('[pengadil-luar-telegram-blast] Email error: ' . $emailError);
        }

        $pdo->beginTransaction();
        try {
            if ($delivered) {
                $completeSuccessStmt->execute([
                    ':kejohanan_id' => $kejohananId,
                    ':pengadil_luar_id' => $recipient['id'],
                    ':claim_token' => $claimToken,
                ]);
                if ($completeSuccessStmt->rowCount() !== 1) {
                    throw new RuntimeException('Claim penghantaran berubah sebelum keputusan disimpan.');
                }
                recordTelegramOnboardingLog(
                    $pdo,
                    $batch,
                    $recipient,
                    'sent',
                    'smtp_accepted',
                    $linkUrl,
                    null,
                    $actorUserId
                );
                $sent++;
                $consecutiveFailures = 0;
            } else {
                $completeFailureStmt->execute([
                    ':last_error' => $emailError,
                    ':kejohanan_id' => $kejohananId,
                    ':pengadil_luar_id' => $recipient['id'],
                    ':claim_token' => $claimToken,
                ]);
                if ($completeFailureStmt->rowCount() !== 1) {
                    throw new RuntimeException('Claim penghantaran berubah sebelum kegagalan disimpan.');
                }
                recordTelegramOnboardingLog(
                    $pdo,
                    $batch,
                    $recipient,
                    'failed',
                    'smtp_failed',
                    $linkUrl,
                    $emailError,
                    $actorUserId
                );
                $failed++;
                $consecutiveFailures++;
                if ($consecutiveFailures >= 3) {
                    $smtpCircuitOpen = true;
                }
                $errors[] = [
                    'pengadil_luar_id' => (int) $recipient['id'],
                    'nama' => (string) $recipient['nama'],
                    'emel' => (string) $recipient['emel'],
                ];
            }
            $pdo->commit();
        } catch (Throwable $stateException) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $stateException;
        }

        usleep(200_000);
    }

    $targeted = $sent + $failed;
    $batchStatus = $failed > 0
        ? ($sent > 0 ? 'partial' : 'failed')
        : 'completed';
    $finishBatchStmt = $pdo->prepare("
        UPDATE telegram_onboarding_batch
        SET targeted_count = :targeted_count,
            sent_count = :sent_count,
            failed_count = :failed_count,
            skipped_count = :skipped_count,
            status = :status,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = :id
    ");
    $finishBatchStmt->execute([
        ':targeted_count' => $targeted,
        ':sent_count' => $sent,
        ':failed_count' => $failed,
        ':skipped_count' => $skipped,
        ':status' => $batchStatus,
        ':id' => $batchId,
    ]);

    $message = $targeted === 0
        ? 'Tiada emel onboarding baharu untuk dihantar.'
        : "Blast selesai: {$sent} berjaya, {$failed} gagal, {$skipped} dilangkau.";
    if ($smtpCircuitOpen) {
        $message .= ' Baki penerima tidak dicuba selepas tiga kegagalan SMTP berturut-turut.';
    }
    jsonResponse([
        'error' => false,
        'message' => $message,
        'batch_id' => $batchId,
        'mode' => $mode,
        'sent' => $sent,
        'failed' => $failed,
        'skipped' => $skipped,
        'errors' => $errors,
        'smtp_circuit_open' => $smtpCircuitOpen,
        'data' => getTelegramOnboardingPreview($pdo, $kejohananId),
    ]);
} catch (InvalidArgumentException $e) {
    jsonResponse(['error' => true, 'message' => $e->getMessage()], 404);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($batchId !== null) {
        try {
            $pdo->prepare("
                UPDATE telegram_onboarding_state
                SET claim_token = NULL, claimed_at = NULL
                WHERE last_batch_id = :id AND claim_token IS NOT NULL
            ")->execute([':id' => $batchId]);
            $pdo->prepare("
                UPDATE telegram_onboarding_batch
                SET status = 'failed', completed_at = CURRENT_TIMESTAMP
                WHERE id = :id AND status = 'processing'
            ")->execute([':id' => $batchId]);
        } catch (Throwable $ignored) {
            error_log('[pengadil-luar-telegram-blast] Batch cleanup error: ' . $ignored->getMessage());
        }
    }
    error_log('[pengadil-luar-telegram-blast] ' . $e->getMessage());
    jsonResponse([
        'error' => true,
        'message' => APP_DEBUG ? $e->getMessage() : 'Ralat semasa menghantar onboarding Telegram.',
    ], 500);
}
