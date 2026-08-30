<?php
/**
 * Admin-only appointment audit and fallback direct-link API.
 *
 * GET  ?lantikan_id=X
 * POST action=prepare_links|record_copy|mark_manual_delivery|admin_override_acceptance
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/lantikan-helper.php';
require_once __DIR__ . '/../config/lantikan-audit.php';

$currentUser = requireRole(['Admin']);

/** @return array<string, mixed> */
function auditPayload(PDO $pdo, int $lantikanId): array
{
    $snapshot = getLantikanAuditSnapshot($pdo, $lantikanId);
    if (!$snapshot) {
        jsonResponse(['error' => true, 'message' => 'Lantikan tidak dijumpai.'], 404);
    }

    $telegramLink = null;
    if (empty($snapshot['telegram_chat_id']) && !empty($snapshot['tg_link_token'])) {
        $telegramLink = buildTelegramLink((string) $snapshot['tg_link_token']);
    }

    $stmt = $pdo->prepare("
        SELECT id, event_type, channel, event_status, link_url, details_json,
               actor_type, actor_user_id, ip_address, created_at
        FROM lantikan_audit_log
        WHERE lantikan_id = :id
        ORDER BY id DESC
        LIMIT 100
    ");
    $stmt->execute([':id' => $lantikanId]);
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($events as &$event) {
        $details = json_decode((string) ($event['details_json'] ?? ''), true);
        $event['details'] = is_array($details) ? $details : [];
        unset($event['details_json']);
    }
    unset($event);

    $isRejected = ($snapshot['status'] ?? '') === 'Ditolak';
    $isAutoRejected = $isRejected
        && ($snapshot['komen'] ?? '') === LANTIKAN_AUTO_TOLAK_KOMEN;
    $isManualKupRejected = $isRejected
        && !$isAutoRejected
        && isKupPosition((string) ($snapshot['jawatan'] ?? ''));
    $matchAllowsOverride = !in_array(
        (string) ($snapshot['jadual_status'] ?? ''),
        ['Dibatalkan', 'Ditangguhkan'],
        true
    );

    return [
        'lantikan' => [
            'id' => (int) $snapshot['lantikan_id'],
            'jadual_id' => (int) $snapshot['jadual_id'],
            'jawatan' => $snapshot['jawatan'],
            'status' => $snapshot['status'],
            'nama_pegawai' => $snapshot['nama_pegawai'],
            'is_external' => !empty($snapshot['pengadil_luar_id']),
            'email_available' => trim((string) $snapshot['emel_pegawai']) !== '',
            'telegram_linked' => !empty($snapshot['telegram_chat_id']),
            'notif_hantar' => (int) $snapshot['notif_hantar'],
            'tg_notif_hantar' => (int) $snapshot['tg_notif_hantar'],
            'tarikh_notif' => $snapshot['tarikh_notif'],
            'can_admin_override_acceptance' => $matchAllowsOverride
                && ($isAutoRejected || $isManualKupRejected),
        ],
        'links' => array_merge(getActiveDirectLinks($snapshot), [
            'telegram_link_url' => $telegramLink,
        ]),
        'events' => $events,
    ];
}

try {
    $pdo = getDbConnection();
    requireLantikanAuditSchema($pdo);
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $lantikanId = (int) ($_GET['lantikan_id'] ?? 0);
        if ($lantikanId <= 0) {
            jsonResponse(['error' => true, 'message' => 'lantikan_id diperlukan.'], 400);
        }
        jsonResponse(['error' => false, 'data' => auditPayload($pdo, $lantikanId)]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $action = trim((string) ($input['action'] ?? ''));
        $lantikanId = (int) ($input['lantikan_id'] ?? 0);
        if ($lantikanId <= 0) {
            jsonResponse(['error' => true, 'message' => 'lantikan_id diperlukan.'], 400);
        }

        if ($action === 'prepare_links') {
            $pdo->beginTransaction();
            try {
                $snapshot = getLantikanAuditSnapshot($pdo, $lantikanId, true);
                if (!$snapshot) {
                    $pdo->rollBack();
                    jsonResponse(['error' => true, 'message' => 'Lantikan tidak dijumpai.'], 404);
                }

                $emailToken = trim((string) ($snapshot['email_token'] ?? ''));
                if (($snapshot['status'] ?? '') === 'Belum Jawab' && $emailToken === '') {
                    $emailToken = bin2hex(random_bytes(32));
                    $pdo->prepare('UPDATE lantikan_pengadil SET email_token = :token WHERE id = :id')
                        ->execute([':token' => $emailToken, ':id' => $lantikanId]);
                    $snapshot['email_token'] = $emailToken;
                }

                $telegramLink = null;
                if (!empty($snapshot['pengadil_luar_id']) && empty($snapshot['telegram_chat_id'])) {
                    $tgLinkToken = trim((string) ($snapshot['tg_link_token'] ?? ''));
                    if ($tgLinkToken === '') {
                        $tgLinkToken = bin2hex(random_bytes(32));
                        $pdo->prepare('UPDATE pengadil_luar SET tg_link_token = :token WHERE id = :id')
                            ->execute([
                                ':token' => $tgLinkToken,
                                ':id' => (int) $snapshot['pengadil_luar_id'],
                            ]);
                        $snapshot['tg_link_token'] = $tgLinkToken;
                    }
                    $telegramLink = buildTelegramLink($tgLinkToken);
                }

                if (($snapshot['jawatan'] ?? '') === 'Penilai Pengadil'
                    && ($snapshot['status'] ?? '') === 'Diterima'
                    && empty($snapshot['penilaian_token'])) {
                    $raToken = bin2hex(random_bytes(32));
                    $pdo->prepare('UPDATE lantikan_pengadil SET penilaian_token = :token WHERE id = :id')
                        ->execute([':token' => $raToken, ':id' => $lantikanId]);
                    $snapshot['penilaian_token'] = $raToken;
                }

                $links = array_merge(getActiveDirectLinks($snapshot), [
                    'telegram_link_url' => $telegramLink,
                ]);
                recordLantikanAudit(
                    $pdo,
                    $lantikanId,
                    'direct_links_prepared',
                    'manual',
                    'success',
                    $links,
                    $links['accept_url'] ?? ($links['ra_form_url'] ?? $links['telegram_link_url']),
                    'admin',
                    (int) $currentUser['id'],
                    $snapshot
                );
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }

            jsonResponse([
                'error' => false,
                'message' => 'Pautan aktif disediakan. Tempoh jawapan belum bermula sehingga penghantaran ditandakan.',
                'data' => auditPayload($pdo, $lantikanId),
            ]);
        }

        if ($action === 'record_copy') {
            $linkType = trim((string) ($input['link_type'] ?? ''));
            $validTypes = ['accept_url', 'reject_url', 'ra_form_url', 'telegram_link_url'];
            if (!in_array($linkType, $validTypes, true)) {
                jsonResponse(['error' => true, 'message' => 'Jenis pautan tidak sah.'], 400);
            }
            $snapshot = getLantikanAuditSnapshot($pdo, $lantikanId);
            if (!$snapshot) {
                jsonResponse(['error' => true, 'message' => 'Lantikan tidak dijumpai.'], 404);
            }
            $payload = auditPayload($pdo, $lantikanId);
            $linkUrl = $payload['links'][$linkType] ?? null;
            if (!is_string($linkUrl) || $linkUrl === '') {
                jsonResponse(['error' => true, 'message' => 'Pautan ini tidak aktif. Muat semula log pautan.'], 409);
            }
            recordLantikanAudit(
                $pdo,
                $lantikanId,
                'direct_link_copied',
                'manual',
                'success',
                ['link_type' => $linkType],
                $linkUrl,
                'admin',
                (int) $currentUser['id'],
                $snapshot
            );
            jsonResponse(['error' => false, 'message' => 'Salinan pautan direkodkan.']);
        }

        if ($action === 'mark_manual_delivery') {
            $deliveryType = trim((string) ($input['delivery_type'] ?? 'appointment'));
            if (!in_array($deliveryType, ['appointment', 'ra_form', 'telegram_link'], true)) {
                jsonResponse(['error' => true, 'message' => 'Jenis penghantaran manual tidak sah.'], 400);
            }

            $pdo->beginTransaction();
            try {
                $snapshot = getLantikanAuditSnapshot($pdo, $lantikanId, true);
                if (!$snapshot) {
                    $pdo->rollBack();
                    jsonResponse(['error' => true, 'message' => 'Lantikan tidak dijumpai.'], 404);
                }

                if ($deliveryType === 'appointment') {
                    if (($snapshot['status'] ?? '') !== 'Belum Jawab' || empty($snapshot['email_token'])) {
                        $pdo->rollBack();
                        jsonResponse(['error' => true, 'message' => 'Pautan lantikan aktif belum tersedia.'], 409);
                    }
                    if (!empty($snapshot['notif_hantar'])) {
                        $pdo->rollBack();
                        jsonResponse([
                            'error' => true,
                            'message' => 'Tempoh jawapan lantikan ini sudah bermula. Gunakan tindakan hantar semula jika benar-benar perlu.',
                        ], 409);
                    }
                    $stmt = $pdo->prepare("
                        UPDATE lantikan_pengadil
                        SET notif_hantar = 1, tarikh_notif = NOW()
                        WHERE id = :id AND status = 'Belum Jawab' AND notif_hantar = 0
                    ");
                    $stmt->execute([':id' => $lantikanId]);
                    if ($stmt->rowCount() !== 1) {
                        throw new RuntimeException('Status lantikan berubah semasa penghantaran manual.');
                    }
                    $snapshot['notif_hantar'] = 1;
                }

                $activeLinks = getActiveDirectLinks($snapshot);
                $linkUrl = $deliveryType === 'appointment'
                    ? $activeLinks['accept_url']
                    : ($deliveryType === 'ra_form'
                        ? $activeLinks['ra_form_url']
                        : (!empty($snapshot['tg_link_token'])
                            ? buildTelegramLink((string) $snapshot['tg_link_token'])
                            : null));
                if (!is_string($linkUrl) || $linkUrl === '') {
                    $pdo->rollBack();
                    jsonResponse(['error' => true, 'message' => 'Pautan aktif tidak tersedia untuk ditandakan.'], 409);
                }

                recordLantikanAudit(
                    $pdo,
                    $lantikanId,
                    'manual_delivery_confirmed',
                    'manual',
                    'success',
                    [
                        'delivery_type' => $deliveryType,
                        'deadline_started' => $deliveryType === 'appointment',
                    ],
                    $linkUrl,
                    'admin',
                    (int) $currentUser['id'],
                    $snapshot
                );
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }

            $message = $deliveryType === 'appointment'
                ? 'Penghantaran manual direkodkan dan tempoh jawapan bermula sekarang.'
                : 'Penghantaran pautan manual direkodkan.';
            jsonResponse(['error' => false, 'message' => $message, 'data' => auditPayload($pdo, $lantikanId)]);
        }

        if ($action === 'admin_override_acceptance') {
            $initialSnapshot = getLantikanAuditSnapshot($pdo, $lantikanId);
            if (!$initialSnapshot) {
                jsonResponse(['error' => true, 'message' => 'Lantikan tidak dijumpai.'], 404);
            }

            $jadualId = (int) $initialSnapshot['jadual_id'];
            $shouldNotifyCompleteKup = false;
            $shouldNotifyRa = false;
            $officialUserId = null;
            $officialName = '';
            $jawatan = '';
            $matchLabel = '';

            $pdo->beginTransaction();
            try {
                // Use the same lock order as every official response path:
                // match first, followed by the individual appointment row.
                lockMatchForAppointmentResponse($pdo, $jadualId);
                $snapshot = getLantikanAuditSnapshot($pdo, $lantikanId, true);
                if (!$snapshot) {
                    throw new RuntimeException('Lantikan berubah semasa override Admin.');
                }
                if (in_array((string) ($snapshot['jadual_status'] ?? ''), ['Dibatalkan', 'Ditangguhkan'], true)) {
                    $pdo->rollBack();
                    jsonResponse([
                        'error' => true,
                        'message' => 'Penerimaan tidak boleh dioverride untuk perlawanan yang dibatalkan atau ditangguhkan.',
                    ], 409);
                }
                $isAutoRejected = ($snapshot['status'] ?? '') === 'Ditolak'
                    && ($snapshot['komen'] ?? '') === LANTIKAN_AUTO_TOLAK_KOMEN;
                $isManualKupRejected = ($snapshot['status'] ?? '') === 'Ditolak'
                    && !$isAutoRejected
                    && isKupPosition((string) ($snapshot['jawatan'] ?? ''));
                if (!$isAutoRejected && !$isManualKupRejected) {
                    $pdo->rollBack();
                    jsonResponse([
                        'error' => true,
                        'message' => 'Override hanya dibenarkan untuk penolakan automatik atau penolakan KUP yang disahkan tersilap.',
                    ], 409);
                }

                $overrideReason = $isAutoRejected
                    ? LANTIKAN_ADMIN_OVERRIDE_TERIMA_KOMEN
                    : LANTIKAN_ADMIN_OVERRIDE_PENOLAKAN_KOMEN;

                $stmt = $pdo->prepare("
                    UPDATE lantikan_pengadil
                    SET status = 'Diterima',
                        komen = :komen,
                        sebab_status = :sebab,
                        tarikh_jawab = NOW(),
                        status_dikemaskini_at = NOW(),
                        tg_token = NULL,
                        email_token = NULL
                    WHERE id = :id
                      AND status = 'Ditolak'
                ");
                $stmt->execute([
                    ':komen' => $overrideReason,
                    ':sebab' => $overrideReason,
                    ':id' => $lantikanId,
                ]);
                if ($stmt->rowCount() !== 1) {
                    throw new RuntimeException('Status lantikan berubah semasa override Admin. Sila muat semula.');
                }

                syncPerlawananHistoryForJadual($pdo, $jadualId);
                markMatchDispatchedIfComplete($pdo, $jadualId);

                $jawatan = (string) ($snapshot['jawatan'] ?? '');
                $officialUserId = !empty($snapshot['pengadil_id'])
                    ? (int) $snapshot['pengadil_id']
                    : null;
                $officialName = (string) ($snapshot['nama_pegawai'] ?? '');
                $matchLabel = trim(
                    (string) ($snapshot['pasukan_home'] ?? '')
                    . ' lwn '
                    . (string) ($snapshot['pasukan_away'] ?? '')
                );
                $shouldNotifyCompleteKup = isKupPosition($jawatan)
                    && isAcceptedKupCrewComplete($pdo, $jadualId);
                $shouldNotifyRa = $jawatan === 'Penilai Pengadil';

                recordLantikanAudit(
                    $pdo,
                    $lantikanId,
                    'appointment_admin_acceptance_override',
                    'admin',
                    'success',
                    [
                        'previous_status' => $snapshot['status'],
                        'previous_comment' => $snapshot['komen'],
                        'previous_reason' => $snapshot['sebab_status'],
                        'new_status' => 'Diterima',
                        'reason' => $overrideReason,
                        'override_source' => $isAutoRejected
                            ? 'automatic_timeout_rejection'
                            : 'official_rejection_mistake',
                        'official_confirmation_received_outside_portal' => true,
                    ],
                    null,
                    'admin',
                    (int) $currentUser['id'],
                    $snapshot
                );

                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }

            // Notifications remain post-commit. A delivery failure must never
            // undo the audited status and KUP history update.
            if ($officialUserId !== null) {
                try {
                    createPortalNotification(
                        $pdo,
                        $officialUserId,
                        'Lantikan Diterima',
                        "Penerimaan lantikan {$matchLabel} disahkan Admin",
                        "Pentadbir telah merekodkan penerimaan anda sebagai {$jawatan} selepas pengesahan diterima di luar portal."
                    );
                } catch (Throwable $notificationError) {
                    error_log('[lantikan-audit.php] override portal notification error: ' . $notificationError->getMessage());
                }
            }

            if ($shouldNotifyRa) {
                try {
                    generatePenilaianToken($pdo, $lantikanId);
                } catch (Throwable $raError) {
                    error_log('[lantikan-audit.php] override RA notification error: ' . $raError->getMessage());
                }
            }

            if ($shouldNotifyCompleteKup) {
                try {
                    notifyCompleteKupCrew($pdo, $jadualId);
                } catch (Throwable $crewError) {
                    error_log('[lantikan-audit.php] override KUP crew notification error: ' . $crewError->getMessage());
                }
            }

            jsonResponse([
                'error' => false,
                'message' => "Penerimaan {$officialName} sebagai {$jawatan} berjaya disahkan oleh Admin.",
                'data' => auditPayload($pdo, $lantikanId),
            ]);
        }

        jsonResponse(['error' => true, 'message' => 'Tindakan tidak disokong.'], 400);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);
} catch (Throwable $e) {
    error_log('[lantikan-audit.php] ' . $e->getMessage());
    jsonResponse([
        'error' => true,
        'message' => APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.',
    ], 500);
}
