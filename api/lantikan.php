<?php
/**
 * Lantikan Pengadil API (Admin)
 * GET    /api/lantikan.php?jadual_id=X   - get assignments for a match
 * POST   /api/lantikan.php               - assign referee (or batch)
 * PUT    /api/lantikan.php               - update assignment (change referee)
 * DELETE /api/lantikan.php?id=X          - remove assignment
 * POST   /api/lantikan.php action=notify - send notification
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/lantikan-helper.php';

$currentUser = requireRole(['Admin']);

$VALID_JAWATAN = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4', 'Penilai Pengadil'];

function getJadualTiming(PDO $pdo, int $jadualId): ?array
{
    $stmt = $pdo->prepare("SELECT id, tarikh, masa, status FROM jadual_perlawanan WHERE id = :id");
    $stmt->execute([':id' => $jadualId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function rejectIfMatchStarted(PDO $pdo, int $jadualId): void
{
    $jadual = getJadualTiming($pdo, $jadualId);
    if (!$jadual) {
        jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai.'], 404);
    }
    if (in_array((string) ($jadual['status'] ?? ''), ['Dibatalkan', 'Ditangguhkan'], true)) {
        jsonResponse([
            'error' => true,
            'message' => 'Lantikan tidak boleh dihantar untuk perlawanan yang dibatalkan atau ditangguhkan.',
        ], 409);
    }
    if (hasMatchStarted((string) $jadual['tarikh'], (string) $jadual['masa'])) {
        jsonResponse([
            'error' => true,
            'message' => matchStartedMessage((string) $jadual['tarikh'], (string) $jadual['masa']),
        ], 409);
    }
}

/**
 * Mark all assignments for given matches as cancelled/postponed and notify officials.
 */
function batalLantikanByJadual(
    PDO $pdo,
    array $jadualIds,
    string $status,
    string $sebab,
    int $actorUserId
): array
{
    $jadualIds = array_values(array_unique(array_filter(
        array_map('intval', $jadualIds),
        static fn(int $id): bool => $id > 0
    )));
    if (empty($jadualIds)) return ['message' => 'Tiada perlawanan.'];
    requireLantikanAuditSchema($pdo);

    $placeholders = implode(',', array_fill(0, count($jadualIds), '?'));

    // Validate every selected match independently of whether it currently has
    // any appointment rows. This also prevents an empty, already-started match
    // from bypassing the kickoff guard.
    $matchStmt = $pdo->prepare("
        SELECT id, no_perlawanan, tarikh, masa
        FROM jadual_perlawanan
        WHERE id IN ({$placeholders})
    ");
    $matchStmt->execute($jadualIds);
    $matches = $matchStmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($matches) !== count($jadualIds)) {
        jsonResponse(['error' => true, 'message' => 'Satu atau lebih perlawanan tidak dijumpai.'], 404);
    }
    foreach ($matches as $match) {
        if (hasMatchStarted((string) $match['tarikh'], (string) ($match['masa'] ?? ''))) {
            jsonResponse([
                'error' => true,
                'message' => 'Perlawanan yang telah bermula tidak boleh dibatalkan melalui aliran lantikan. Rekod sejarah perlu dikekalkan.',
            ], 409);
        }
    }

    // Fetch every appointment before the atomic status change so post-commit
    // cancellation messages still have their recipient and match details.
    $stmt = $pdo->prepare("
        SELECT lp.id, lp.jawatan, lp.notif_hantar, lp.jadual_id,
               COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
               COALESCE(u.nama_penuh, pl.nama)  AS nama,
               COALESCE(u.email, pl.emel)        AS email,
               lp.pengadil_id,
               jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
               jp.pasukan_home, jp.pasukan_away,
               jp.logo_home, jp.logo_away,
               COALESCE(kj.nama, '') AS kejohanan
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
        LEFT JOIN users u ON lp.pengadil_id = u.id
        LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
        WHERE lp.jadual_id IN ({$placeholders})
    ");
    $stmt->execute($jadualIds);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $pdo->beginTransaction();
    try {
        $lockStmt = $pdo->prepare("SELECT id FROM jadual_perlawanan WHERE id IN ({$placeholders}) FOR UPDATE");
        $lockStmt->execute($jadualIds);

        // A report is an official snapshot of the match crew. Check while the
        // matches are locked so a concurrent report cannot race cancellation.
        $reportStmt = $pdo->prepare("
            SELECT id
            FROM laporan_penilaian
            WHERE jadual_id IN ({$placeholders})
            LIMIT 1 FOR UPDATE
        ");
        $reportStmt->execute($jadualIds);
        if ($reportStmt->fetchColumn()) {
            $pdo->rollBack();
            jsonResponse([
                'error' => true,
                'message' => 'Perlawanan tidak boleh dibatalkan kerana laporan RA telah diwujudkan.',
            ], 409);
        }

        $legacyReportStmt = $pdo->prepare("
            SELECT pp.id
            FROM penilaian_pengadil pp
            JOIN perlawanan p ON p.id = pp.perlawanan_id
            JOIN lantikan_pengadil lp ON lp.id = p.lantikan_id
            WHERE lp.jadual_id IN ({$placeholders})
            LIMIT 1 FOR UPDATE
        ");
        $legacyReportStmt->execute($jadualIds);
        if ($legacyReportStmt->fetchColumn()) {
            $pdo->rollBack();
            jsonResponse([
                'error' => true,
                'message' => 'Perlawanan tidak boleh dibatalkan kerana rekod penilaian pengadil telah wujud.',
            ], 409);
        }

        // Preserve appointment rows for audit, revoke every response/report
        // bearer token, and remove their pre-kickoff history atomically.
        $pdo->prepare("
            UPDATE lantikan_pengadil
            SET status = ?, sebab_status = ?, status_dikemaskini_at = NOW(),
                tg_token = NULL, email_token = NULL, penilaian_token = NULL
            WHERE jadual_id IN ({$placeholders})
        ")->execute(array_merge([$status, $sebab], $jadualIds));

        foreach ($records as $record) {
            $auditSnapshot = getLantikanAuditSnapshot($pdo, (int) $record['id']);
            if (!$auditSnapshot) {
                throw new RuntimeException('Snapshot audit pembatalan lantikan tidak dijumpai.');
            }
            recordLantikanAudit(
                $pdo,
                (int) $record['id'],
                'appointment_status_changed',
                'admin',
                'success',
                ['new_status' => $status, 'reason' => $sebab],
                null,
                'admin',
                $actorUserId,
                $auditSnapshot
            );
        }

        foreach ($jadualIds as $jadualId) {
            syncPerlawananHistoryForJadual($pdo, (int) $jadualId);
        }

        $pdo->prepare("
            UPDATE jadual_perlawanan
            SET status = ?, sebab_status = ?, status_dikemaskini_at = NOW()
            WHERE id IN ({$placeholders})
        ")->execute(array_merge([$status, $sebab], $jadualIds));
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    require_once __DIR__ . '/../config/telegram.php';
    require_once __DIR__ . '/../config/email.php';

    $notifCount = 0;
    foreach ($records as $r) {
        // Officials who were never notified must not receive a cancellation
        // for an appointment they never saw.
        if (empty($r['notif_hantar'])) {
            continue;
        }

        $delivered = false;
        if (!empty($r['telegram_chat_id'])) {
            $msg = tgBatalMessage($r['nama'], $r['jawatan'], $r['kejohanan'], $r['tarikh'],
                $r['masa'] ?? '', $r['tempat'] ?? '', $r['pasukan_home'], $r['pasukan_away'],
                $r['no_perlawanan'] ?? '', $status, $sebab);
            $telegramError = null;
            try {
                $telegramDelivered = tgSend((int) $r['telegram_chat_id'], $msg);
            } catch (Throwable $channelError) {
                $telegramDelivered = false;
                $telegramError = $channelError->getMessage();
                error_log('[batalLantikanByJadual] Telegram error: ' . $telegramError);
            }
            $delivered = $telegramDelivered || $delivered;
            recordLantikanAudit(
                $pdo,
                (int) $r['id'],
                'cancellation_notification',
                'telegram',
                $telegramDelivered ? 'success' : 'failed',
                ['new_status' => $status, 'reason' => $sebab, 'error' => $telegramError],
                null,
                'admin',
                $actorUserId
            );
        }
        if (!empty($r['email'])) {
            $emailError = null;
            try {
                $emailDelivered = sendBatalEmail($r['email'], $r['nama'], $r['jawatan'], $r['kejohanan'], $r['tarikh'],
                    $r['masa'] ?? '', $r['tempat'] ?? '', $r['pasukan_home'], $r['pasukan_away'],
                    $r['no_perlawanan'] ?? '', $r['logo_home'] ?? '', $r['logo_away'] ?? '',
                    !empty($r['pengadil_id']), $status, $sebab);
            } catch (Throwable $channelError) {
                $emailDelivered = false;
                $emailError = $channelError->getMessage();
                error_log('[batalLantikanByJadual] Email error: ' . $emailError);
            }
            $delivered = $emailDelivered || $delivered;
            recordLantikanAudit(
                $pdo,
                (int) $r['id'],
                'cancellation_notification',
                'email',
                $emailDelivered ? 'success' : 'failed',
                [
                    'new_status' => $status,
                    'reason' => $sebab,
                    'recipient' => $r['email'],
                    'error' => $emailError,
                ],
                null,
                'admin',
                $actorUserId
            );
        }
        if (!empty($r['pengadil_id'])) {
            $subject = "Perlawanan {$status}: {$r['pasukan_home']} lwn {$r['pasukan_away']}";
            $message = "Lantikan anda sebagai {$r['jawatan']} telah " . strtolower($status)
                . ". Sebab: {$sebab}";
            createPortalNotification($pdo, (int) $r['pengadil_id'], 'Status Perlawanan', $subject, $message);
            $delivered = true;
        }
        if ($delivered) {
            $notifCount++;
        }
    }

    $matchCount = count($jadualIds);
    $totalDeleted = count($records);
    $msg = "{$totalDeleted} lantikan ditanda {$status} untuk {$matchCount} perlawanan.";
    if ($notifCount > 0) $msg .= " {$notifCount} notifikasi pembatalan dihantar.";

    return ['message' => $msg];
}

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $jadual_id = (int) ($_GET['jadual_id'] ?? 0);
        if (!$jadual_id) {
            jsonResponse(['error' => true, 'message' => 'jadual_id diperlukan.'], 400);
        }

        // Auto-tolak lantikan yang tempoh jawapannya sudah tamat
        autoTolakLantikanTertunggak($pdo, ['jadual_id' => $jadual_id]);
        try {
            retryPendingKupCrewNotifications($pdo, $jadual_id);
        } catch (Throwable $retryError) {
            error_log('[lantikan.php GET] KUP crew retry error: ' . $retryError->getMessage());
        }

        $stmt = $pdo->prepare("
            SELECT lp.id, lp.jawatan, lp.status, lp.komen, lp.tarikh_jawab, lp.notif_hantar, lp.tg_notif_hantar, lp.tarikh_notif, lp.created_at,
                CASE WHEN lp.status = 'Ditolak' AND lp.komen = :auto_tolak_komen THEN 1 ELSE 0 END AS is_auto_tolak,
                lp.pengadil_id, lp.pengadil_luar_id,
                CASE WHEN COALESCE(u.email, pl.emel, '') <> '' THEN 1 ELSE 0 END AS email_available,
                CASE WHEN COALESCE(u.telegram_chat_id, pl.telegram_chat_id) IS NOT NULL
                          AND COALESCE(u.telegram_chat_id, pl.telegram_chat_id) <> '' THEN 1 ELSE 0 END AS telegram_linked,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN u.nama_penuh
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.nama
                END AS nama_penuh,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN u.no_telefon
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.no_tel
                END AS no_telefon,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN u.email
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.emel
                END AS email,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN u.jenis_pengadil
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.jenis_pengadil
                END AS jenis_pengadil,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN 'Berdaftar'
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN 'Luar'
                END AS jenis_sumber
            FROM lantikan_pengadil lp
            LEFT JOIN users u ON lp.pengadil_id = u.id
            LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
            WHERE lp.jadual_id = :jadual_id
            ORDER BY FIELD(lp.jawatan,'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4','Penilai Pengadil')
        ");
        $stmt->execute([
            ':auto_tolak_komen' => LANTIKAN_AUTO_TOLAK_KOMEN,
            ':jadual_id' => $jadual_id,
        ]);
        $assignments = $stmt->fetchAll();

        // Get pool-based referees for this kejohanan
        // First get kejohanan_id from jadual
        $kjStmt = $pdo->prepare("
            SELECT jp.kejohanan_id, COALESCE(k.peringkat_kejohanan, 'Daerah') AS peringkat_kejohanan
            FROM jadual_perlawanan jp
            LEFT JOIN kejohanan k ON jp.kejohanan_id = k.id
            WHERE jp.id = :jid
        ");
        $kjStmt->execute([':jid' => $jadual_id]);
        $kjRow = $kjStmt->fetch();
        $kejohanan_id = $kjRow ? (int) $kjRow['kejohanan_id'] : 0;
        $peringkatKejohanan = $kjRow['peringkat_kejohanan'] ?? 'Daerah';

        $referees = [];
        if ($kejohanan_id) {
            $refStmt = $pdo->prepare("
                SELECT
                    pp.id AS pool_id,
                    pp.pengadil_id,
                    pp.pengadil_luar_id,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.nama_penuh
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.nama
                    END AS nama_penuh,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.no_telefon
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.no_tel
                    END AS no_telefon,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.email
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.emel
                    END AS email,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.jenis_pengadil
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.jenis_pengadil
                    END AS jenis_pengadil,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN 'Berdaftar'
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN 'Luar'
                    END AS jenis_sumber,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.daerah
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.daerah
                    END AS daerah,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.negeri
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.negeri
                    END AS negeri,
                    (
                        SELECT COUNT(*) FROM lantikan_pengadil lp2
                        JOIN jadual_perlawanan jp2 ON lp2.jadual_id = jp2.id
                        WHERE jp2.kejohanan_id = pp.kejohanan_id
                          AND (lp2.pengadil_id = pp.pengadil_id OR lp2.pengadil_luar_id = pp.pengadil_luar_id)
                    ) AS jumlah_lantikan_kejohanan
                FROM pool_pengadil pp
                LEFT JOIN users u ON pp.pengadil_id = u.id
                LEFT JOIN pengadil_luar pl ON pp.pengadil_luar_id = pl.id
                WHERE pp.kejohanan_id = :kid
                ORDER BY nama_penuh ASC
            ");
            $refStmt->execute([':kid' => $kejohanan_id]);
            $referees = $refStmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($referees as &$referee) {
                $referee['wilayah'] = $peringkatKejohanan === 'Negeri'
                    ? ($referee['daerah'] ?: '-')
                    : ($referee['negeri'] ?: '-');
            }
            unset($referee);
        }

        jsonResponse([
            'error' => false,
            'data' => $assignments,
            'referees' => $referees,
            'region_label' => $peringkatKejohanan === 'Negeri' ? 'Daerah' : 'Negeri',
        ]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $action = $input['action'] ?? 'assign';

        if ($action === 'notify') {
            $jadual_id = (int) ($input['jadual_id'] ?? 0);
            if (!$jadual_id) {
                jsonResponse(['error' => true, 'message' => 'jadual_id diperlukan.'], 400);
            }
            rejectIfMatchStarted($pdo, $jadual_id);
            requireLantikanAuditSchema($pdo);

            // Auto-tolak dulu — baris yang sudah tamat tempoh tidak boleh
            // "dihidupkan semula" oleh hantar semula
            autoTolakLantikanTertunggak($pdo, ['jadual_id' => $jadual_id]);

            $slotValidation = getAppointmentSlotValidation($pdo, $jadual_id);
            if (!$slotValidation['valid']) {
                jsonResponse([
                    'error' => true,
                    'message' => 'Lantikan belum boleh dihantar. Slot wajib belum lengkap: '
                        . implode(', ', $slotValidation['missing']) . '.',
                    'missing_positions' => $slotValidation['missing'],
                ], 409);
            }

            // Check if any assignment already notified (re-send: window restarts)
            $alreadyNotifiedStmt = $pdo->prepare("
                SELECT COUNT(*) FROM lantikan_pengadil
                WHERE jadual_id = :jid AND notif_hantar = 1 AND status = 'Belum Jawab'
            ");
            $alreadyNotifiedStmt->execute([':jid' => $jadual_id]);
            $renotifyCount = (int) $alreadyNotifiedStmt->fetchColumn();

            // Fetch match details + all pending assignments
            $stmt = $pdo->prepare("
                SELECT lp.id AS lantikan_id,
                       lp.jawatan, lp.tg_notif_hantar,
                       lp.tg_token, lp.email_token,
                       COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
                       COALESCE(u.tg_link_token,    pl.tg_link_token)    AS tg_link_token,
                       COALESCE(u.id, NULL)          AS user_id,
                       COALESCE(pl.id, NULL)         AS luar_id,
                       COALESCE(u.nama_penuh, pl.nama) AS nama,
                       COALESCE(u.email, pl.emel)    AS email,
                       lp.pengadil_id,
                       u.persatuan_id,
                       jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
                       jp.pasukan_home, jp.pasukan_away, jp.kejohanan_id,
                       jp.logo_home, jp.logo_away,
                       COALESCE(kj.nama, '') AS kejohanan,
                       COALESCE(kj.jenis_kejohanan, 'Persahabatan') AS jenis_kejohanan
                FROM lantikan_pengadil lp
                JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
                LEFT JOIN users u ON lp.pengadil_id = u.id
                LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
                WHERE lp.jadual_id = :jid AND lp.status = 'Belum Jawab'
            ");
            $stmt->execute([':jid' => $jadual_id]);
            $assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($assignments)) {
                jsonResponse(['error' => true, 'message' => 'Tiada pengadil dengan status Belum Jawab.'], 400);
            }

            require_once __DIR__ . '/../config/telegram.php';
            require_once __DIR__ . '/../config/email.php';

            // One shared KUP roster for Telegram and email. RA is separate.
            $kupRoster = getMatchKupOfficials($pdo, $jadual_id);
            $allOfficials = $kupRoster['officials'];
            $regionLabel = $kupRoster['region_label'];

            // Fetch team logos from jadual_perlawanan
            $logoHome = $assignments[0]['logo_home'] ?? '';
            $logoAway = $assignments[0]['logo_away'] ?? '';

            $tgSent    = 0;
            $tgSkipped = 0;
            $emailSent = 0;
            $deliveredCount = 0;
            $deliveryFailed = 0;
            $ppNotified = []; // Track PP Daerah already notified (by persatuan_id)

            foreach ($assignments as $a) {
                // Guna semula token sedia ada supaya pautan dalam emel/Telegram
                // lama kekal sah bila notifikasi dihantar semula
                $tgToken    = !empty($a['tg_token'])    ? $a['tg_token']    : bin2hex(random_bytes(16));
                $emailToken = !empty($a['email_token']) ? $a['email_token'] : bin2hex(random_bytes(16));

                // Auto-generate tg_link_token if referee doesn't have one yet (for Telegram account linking)
                $tgLinkToken = $a['tg_link_token'];
                if (empty($tgLinkToken) && empty($a['telegram_chat_id'])) {
                    $tgLinkToken = bin2hex(random_bytes(16));
                    $tgLinkId = !empty($a['user_id']) ? (int) $a['user_id'] : (int) $a['luar_id'];
                    if (!empty($a['user_id'])) {
                        $pdo->prepare("UPDATE users SET tg_link_token = :tok WHERE id = :id")
                            ->execute([':tok' => $tgLinkToken, ':id' => $tgLinkId]);
                    } else {
                        $pdo->prepare("UPDATE pengadil_luar SET tg_link_token = :tok WHERE id = :id")
                            ->execute([':tok' => $tgLinkToken, ':id' => $tgLinkId]);
                    }
                }

                // Save response tokens first so a button can be used as soon
                // as its message arrives, but do not start the deadline yet.
                $pdo->prepare("
                    UPDATE lantikan_pengadil
                    SET tg_token = :tg, email_token = :em
                    WHERE id = :id
                ")->execute([':tg' => $tgToken, ':em' => $emailToken, ':id' => $a['lantikan_id']]);

                $auditSnapshot = getLantikanAuditSnapshot($pdo, (int) $a['lantikan_id']);
                if (!$auditSnapshot) {
                    throw new RuntimeException('Snapshot audit lantikan tidak dijumpai.');
                }
                $appointmentLinks = buildAppointmentDirectLinks($emailToken);
                recordLantikanAudit(
                    $pdo,
                    (int) $a['lantikan_id'],
                    'appointment_links_prepared',
                    'system',
                    'success',
                    $appointmentLinks,
                    $appointmentLinks['accept_url'],
                    'admin',
                    (int) $currentUser['id'],
                    $auditSnapshot
                );

                $botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');

                // ── Telegram notification ─────────────────────────────────
                $tgDelivered = false;
                $emailDelivered = false;
                $tgErrorMessage = null;
                $emailErrorMessage = null;
                if (!empty($a['telegram_chat_id'])) {
                    $msg  = tgLantikanMessage(
                        $a['nama'], $a['jawatan'], $a['kejohanan'],
                        $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                        $a['pasukan_home'], $a['pasukan_away'],
                        $a['no_perlawanan'] ?? '',
                        $a['jenis_kejohanan'] ?? 'Persahabatan',
                        $allOfficials,
                        $regionLabel
                    );
                    try {
                        $tgDelivered = tgSend((int) $a['telegram_chat_id'], $msg, tgLantikanKeyboard($tgToken));
                    } catch (Throwable $tgError) {
                        $tgErrorMessage = $tgError->getMessage();
                        error_log('[lantikan.php notify] Telegram error: ' . $tgErrorMessage);
                    }
                    if ($tgDelivered) {
                        $tgSent++;
                    } else {
                        $tgSkipped++;
                    }
                    recordLantikanAudit(
                        $pdo,
                        (int) $a['lantikan_id'],
                        'appointment_notification',
                        'telegram',
                        $tgDelivered ? 'success' : 'failed',
                        [
                            'telegram_linked' => true,
                            'callback_buttons' => ['accept', 'reject'],
                            'error' => $tgErrorMessage,
                        ],
                        null,
                        'admin',
                        (int) $currentUser['id'],
                        $auditSnapshot
                    );
                } else {
                    $tgSkipped++;
                    recordLantikanAudit(
                        $pdo,
                        (int) $a['lantikan_id'],
                        'appointment_notification',
                        'telegram',
                        'skipped',
                        [
                            'reason' => 'telegram_not_linked',
                            'telegram_link_url' => !empty($tgLinkToken) ? buildTelegramLink((string) $tgLinkToken) : null,
                        ],
                        !empty($tgLinkToken) ? buildTelegramLink((string) $tgLinkToken) : null,
                        'admin',
                        (int) $currentUser['id'],
                        $auditSnapshot
                    );
                }

                // ── Email notification ────────────────────────────────────
                if (!empty($a['email'])) {
                    $tgLinkUrl = (!empty($tgLinkToken) && empty($a['telegram_chat_id']))
                        ? "https://t.me/{$botUsername}?start={$tgLinkToken}"
                        : null;

                    try {
                        $emailDelivered = sendLantikanEmail(
                            $a['email'],
                            $a['nama'],
                            $a['jawatan'],
                            $a['kejohanan'],
                            $a['tarikh'],
                            $a['masa'] ?? '',
                            $a['tempat'] ?? '',
                            $a['pasukan_home'],
                            $a['pasukan_away'],
                            $emailToken,
                            $tgLinkUrl,
                            !empty($a['pengadil_id']),
                            $a['no_perlawanan'] ?? '',
                            $logoHome,
                            $logoAway,
                            $allOfficials,
                            $a['jenis_kejohanan'] ?? 'Persahabatan',
                            $regionLabel
                        );
                    } catch (Throwable $emailError) {
                        $emailErrorMessage = $emailError->getMessage();
                        error_log('[lantikan.php notify] Email error: ' . $emailErrorMessage);
                    }
                    if ($emailDelivered) {
                        $emailSent++;
                    }
                    recordLantikanAudit(
                        $pdo,
                        (int) $a['lantikan_id'],
                        'appointment_notification',
                        'email',
                        $emailDelivered ? 'success' : 'failed',
                        [
                            'recipient' => $a['email'],
                            'accept_url' => $appointmentLinks['accept_url'],
                            'reject_url' => $appointmentLinks['reject_url'],
                            'error' => $emailErrorMessage,
                        ],
                        $appointmentLinks['accept_url'],
                        'admin',
                        (int) $currentUser['id'],
                        $auditSnapshot
                    );
                } else {
                    recordLantikanAudit(
                        $pdo,
                        (int) $a['lantikan_id'],
                        'appointment_notification',
                        'email',
                        'skipped',
                        ['reason' => 'email_missing'],
                        $appointmentLinks['accept_url'],
                        'admin',
                        (int) $currentUser['id'],
                        $auditSnapshot
                    );
                }

                // Portal is supplemental only. The appointment deadline starts
                // after Telegram or email actually succeeds, never from a
                // portal row alone.
                $delivered = hasSuccessfulExternalAppointmentDelivery($tgDelivered, $emailDelivered);
                $deliveryRecorded = false;
                if ($delivered) {
                    $deliveryRecorded = markAppointmentExternallyDelivered(
                        $pdo,
                        (int) $a['lantikan_id'],
                        $tgDelivered,
                        $emailDelivered
                    );
                    if ($deliveryRecorded) {
                        $deliveredCount++;
                    }

                    recordLantikanAudit(
                        $pdo,
                        (int) $a['lantikan_id'],
                        'appointment_dispatched',
                        'combined',
                        $deliveryRecorded ? 'success' : 'failed',
                        [
                            'telegram_success' => $tgDelivered,
                            'email_success' => $emailDelivered,
                            'deadline_started' => $deliveryRecorded,
                        ],
                        $appointmentLinks['accept_url'],
                        'admin',
                        (int) $currentUser['id'],
                        $auditSnapshot
                    );

                    if ($deliveryRecorded && !empty($a['user_id'])) {
                        try {
                            notifyLantikanPortal($pdo, (int)$a['user_id'], $a['jawatan'], $a['kejohanan'],
                                $a['tarikh'], $a['pasukan_home'], $a['pasukan_away']);
                        } catch (Throwable $portalError) {
                            error_log('[lantikan.php notify] Portal notification error: '
                                . $portalError->getMessage());
                        }
                    }
                } else {
                    $deliveryFailed++;
                    recordLantikanAudit(
                        $pdo,
                        (int) $a['lantikan_id'],
                        'appointment_dispatched',
                        'combined',
                        'failed',
                        [
                            'telegram_success' => false,
                            'email_success' => false,
                            'deadline_started' => false,
                        ],
                        $appointmentLinks['accept_url'],
                        'admin',
                        (int) $currentUser['id'],
                        $auditSnapshot
                    );
                }

                // ── PP Daerah notification ────────────────────────────────
                $pid = (int)($a['persatuan_id'] ?? 0);
                $ppKey = $jadual_id . ':' . $pid . ':' . (int) $a['lantikan_id'];
                if ($deliveryRecorded && $pid && !isset($ppNotified[$ppKey])) {
                    try {
                        notifyPPDaerahLantikan($pdo, $pid, $a['nama'], $a['jawatan'], $a['kejohanan'],
                            $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                            $a['pasukan_home'], $a['pasukan_away'], $a['no_perlawanan'] ?? '');
                        $ppNotified[$ppKey] = true;
                    } catch (Throwable $ppError) {
                        error_log('[lantikan.php notify] PP Daerah notification error: '
                            . $ppError->getMessage());
                    }
                }
            }

            $dispatchComplete = markMatchDispatchedIfComplete($pdo, $jadual_id);
            if (!$dispatchComplete) {
                $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Menunggu Pengesahan' WHERE id = :id")
                    ->execute([':id' => $jadual_id]);
            }

            $parts = ["Notifikasi berjaya dihantar kepada {$deliveredCount} pegawai."];
            if ($emailSent > 0) $parts[] = "{$emailSent} emel dihantar.";
            if ($tgSent > 0)    $parts[] = "{$tgSent} notifikasi Telegram dihantar.";
            if ($tgSkipped > 0) $parts[] = "{$tgSkipped} pegawai tidak menerima notifikasi Telegram; saluran emel digunakan jika berjaya.";
            if ($renotifyCount > 0) $parts[] = "Nota: {$renotifyCount} pengadil dihantar semula (pautan asal masih sah; tempoh jawapan dikira semula dari notifikasi terbaru).";
            if ($deliveryFailed > 0) $parts[] = "{$deliveryFailed} lantikan gagal dihantar dan tempoh jawapannya belum bermula.";

            jsonResponse([
                'error'        => false,
                'message'      => implode(' ', $parts),
                'tg_sent'      => $tgSent,
                'tg_skipped'   => $tgSkipped,
                'email_sent'   => $emailSent,
                'delivery_failed' => $deliveryFailed,
                'appointment_complete' => $dispatchComplete,
                'renotify_count' => $renotifyCount,
            ]);
        }

        // ── Bulk notify all pending assignments for an entire kejohanan ──────
        if ($action === 'notify_all') {
            $kejohanan_id = (int) ($input['kejohanan_id'] ?? 0);
            if (!$kejohanan_id) {
                jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
            }
            requireLantikanAuditSchema($pdo);

            // Optional: specific jadual IDs (partial send)
            $filterIds = !empty($input['jadual_ids']) && is_array($input['jadual_ids'])
                ? array_map('intval', $input['jadual_ids'])
                : [];

            // Auto-tolak dulu — baris yang sudah tamat tempoh tidak boleh
            // "dihidupkan semula" oleh hantar semula
            autoTolakLantikanTertunggak($pdo, ['kejohanan_id' => $kejohanan_id]);

            // Get all jadual IDs with pending (Belum Jawab) assignments
            $sql = "
                SELECT DISTINCT jp.id, jp.tarikh, jp.masa
                FROM jadual_perlawanan jp
                JOIN lantikan_pengadil lp ON lp.jadual_id = jp.id
                WHERE jp.kejohanan_id = :kid AND lp.status = 'Belum Jawab'
            ";
            if (!empty($filterIds)) {
                $placeholders = implode(',', array_fill(0, count($filterIds), '?'));
                $stmt = $pdo->prepare("
                    SELECT DISTINCT jp.id, jp.tarikh, jp.masa
                    FROM jadual_perlawanan jp
                    JOIN lantikan_pengadil lp ON lp.jadual_id = jp.id
                    WHERE jp.kejohanan_id = ? AND lp.status = 'Belum Jawab'
                      AND jp.id IN ({$placeholders})
                    ORDER BY jp.tarikh ASC, jp.masa ASC
                ");
                $stmt->execute(array_merge([$kejohanan_id], $filterIds));
            } else {
                $stmt = $pdo->prepare($sql . " ORDER BY jp.tarikh ASC, jp.masa ASC");
                $stmt->execute([':kid' => $kejohanan_id]);
            }
            $jadualRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $startedMatchCount = 0;
            $jadualIds = [];
            foreach ($jadualRows as $jadualRow) {
                if (hasMatchStarted((string) $jadualRow['tarikh'], (string) $jadualRow['masa'])) {
                    $startedMatchCount++;
                    continue;
                }
                $jadualIds[] = (int) $jadualRow['id'];
            }

            if (empty($jadualIds)) {
                $message = $startedMatchCount > 0
                    ? "Notifikasi tidak dihantar: {$startedMatchCount} perlawanan yang dipilih telah bermula."
                    : 'Tiada pengadil dengan status Belum Jawab untuk dihantar notifikasi.';
                jsonResponse(['error' => true, 'message' => $message], 400);
            }

            require_once __DIR__ . '/../config/telegram.php';
            require_once __DIR__ . '/../config/email.php';

            $totalEmail = 0;
            $totalTgSent = 0;
            $totalTgSkipped = 0;
            $totalAssignments = 0;
            $totalDeliveryFailed = 0;
            $totalRenotify = 0;
            $matchesProcessed = 0;
            $incompleteMatchCount = 0;
            $ppNotified = []; // Track PP Daerah already notified

            foreach ($jadualIds as $jadual_id) {
                $slotValidation = getAppointmentSlotValidation($pdo, $jadual_id);
                if (!$slotValidation['valid']) {
                    $incompleteMatchCount++;
                    continue;
                }

                // Renotify count
                $reStmt = $pdo->prepare("
                    SELECT COUNT(*) FROM lantikan_pengadil
                    WHERE jadual_id = :jid AND notif_hantar = 1 AND status = 'Belum Jawab'
                ");
                $reStmt->execute([':jid' => $jadual_id]);
                $totalRenotify += (int) $reStmt->fetchColumn();

                // Fetch pending assignments for this match
                $stmt = $pdo->prepare("
                    SELECT lp.id AS lantikan_id,
                           lp.jawatan, lp.tg_notif_hantar,
                           lp.tg_token, lp.email_token,
                           COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
                           COALESCE(u.tg_link_token,    pl.tg_link_token)    AS tg_link_token,
                           COALESCE(u.id, NULL)          AS user_id,
                           COALESCE(pl.id, NULL)         AS luar_id,
                           COALESCE(u.nama_penuh, pl.nama) AS nama,
                           COALESCE(u.email, pl.emel)    AS email,
                           lp.pengadil_id,
                           u.persatuan_id,
                           jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
                           jp.pasukan_home, jp.pasukan_away, jp.kejohanan_id,
                           jp.logo_home, jp.logo_away,
                           COALESCE(kj.nama, '') AS kejohanan,
                           COALESCE(kj.jenis_kejohanan, 'Persahabatan') AS jenis_kejohanan
                    FROM lantikan_pengadil lp
                    JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                    LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
                    LEFT JOIN users u ON lp.pengadil_id = u.id
                    LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
                    WHERE lp.jadual_id = :jid AND lp.status = 'Belum Jawab'
                ");
                $stmt->execute([':jid' => $jadual_id]);
                $assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if (empty($assignments)) continue;

                // One shared KUP roster for Telegram and email. RA is separate.
                $kupRoster = getMatchKupOfficials($pdo, $jadual_id);
                $allOfficials = $kupRoster['officials'];
                $regionLabel = $kupRoster['region_label'];

                $logoHome = $assignments[0]['logo_home'] ?? '';
                $logoAway = $assignments[0]['logo_away'] ?? '';

                foreach ($assignments as $a) {
                    // Guna semula token sedia ada supaya pautan lama kekal sah
                    $tgToken    = !empty($a['tg_token'])    ? $a['tg_token']    : bin2hex(random_bytes(16));
                    $emailToken = !empty($a['email_token']) ? $a['email_token'] : bin2hex(random_bytes(16));

                    $tgLinkToken = $a['tg_link_token'];
                    if (empty($tgLinkToken) && empty($a['telegram_chat_id'])) {
                        $tgLinkToken = bin2hex(random_bytes(16));
                        $tgLinkId = !empty($a['user_id']) ? (int) $a['user_id'] : (int) $a['luar_id'];
                        if (!empty($a['user_id'])) {
                            $pdo->prepare("UPDATE users SET tg_link_token = :tok WHERE id = :id")
                                ->execute([':tok' => $tgLinkToken, ':id' => $tgLinkId]);
                        } else {
                            $pdo->prepare("UPDATE pengadil_luar SET tg_link_token = :tok WHERE id = :id")
                                ->execute([':tok' => $tgLinkToken, ':id' => $tgLinkId]);
                        }
                    }

                    // Store bearer tokens before delivery, but start the
                    // response deadline only after at least one channel works.
                    $pdo->prepare("
                        UPDATE lantikan_pengadil
                        SET tg_token = :tg, email_token = :em
                        WHERE id = :id
                    ")->execute([':tg' => $tgToken, ':em' => $emailToken, ':id' => $a['lantikan_id']]);

                    $auditSnapshot = getLantikanAuditSnapshot($pdo, (int) $a['lantikan_id']);
                    if (!$auditSnapshot) {
                        throw new RuntimeException('Snapshot audit lantikan tidak dijumpai.');
                    }
                    $appointmentLinks = buildAppointmentDirectLinks($emailToken);
                    recordLantikanAudit(
                        $pdo,
                        (int) $a['lantikan_id'],
                        'appointment_links_prepared',
                        'system',
                        'success',
                        $appointmentLinks,
                        $appointmentLinks['accept_url'],
                        'admin',
                        (int) $currentUser['id'],
                        $auditSnapshot
                    );

                    $botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');

                    // Telegram
                    $tgDelivered = false;
                    $emailDelivered = false;
                    $tgErrorMessage = null;
                    $emailErrorMessage = null;
                    if (!empty($a['telegram_chat_id'])) {
                        $msg  = tgLantikanMessage(
                            $a['nama'], $a['jawatan'], $a['kejohanan'],
                            $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                            $a['pasukan_home'], $a['pasukan_away'],
                            $a['no_perlawanan'] ?? '',
                            $a['jenis_kejohanan'] ?? 'Persahabatan',
                            $allOfficials,
                            $regionLabel
                        );
                        try {
                            $tgDelivered = tgSend((int) $a['telegram_chat_id'], $msg, tgLantikanKeyboard($tgToken));
                        } catch (Throwable $tgError) {
                            $tgErrorMessage = $tgError->getMessage();
                            error_log('[lantikan.php notify_all] Telegram error: ' . $tgErrorMessage);
                        }
                        if ($tgDelivered) {
                            $totalTgSent++;
                        } else {
                            $totalTgSkipped++;
                        }
                        recordLantikanAudit(
                            $pdo,
                            (int) $a['lantikan_id'],
                            'appointment_notification',
                            'telegram',
                            $tgDelivered ? 'success' : 'failed',
                            [
                                'telegram_linked' => true,
                                'callback_buttons' => ['accept', 'reject'],
                                'error' => $tgErrorMessage,
                            ],
                            null,
                            'admin',
                            (int) $currentUser['id'],
                            $auditSnapshot
                        );
                    } else {
                        $totalTgSkipped++;
                        recordLantikanAudit(
                            $pdo,
                            (int) $a['lantikan_id'],
                            'appointment_notification',
                            'telegram',
                            'skipped',
                            [
                                'reason' => 'telegram_not_linked',
                                'telegram_link_url' => !empty($tgLinkToken) ? buildTelegramLink((string) $tgLinkToken) : null,
                            ],
                            !empty($tgLinkToken) ? buildTelegramLink((string) $tgLinkToken) : null,
                            'admin',
                            (int) $currentUser['id'],
                            $auditSnapshot
                        );
                    }

                    // Email
                    if (!empty($a['email'])) {
                        $tgLinkUrl = (!empty($tgLinkToken) && empty($a['telegram_chat_id']))
                            ? "https://t.me/{$botUsername}?start={$tgLinkToken}"
                            : null;

                        try {
                            $emailDelivered = sendLantikanEmail(
                                $a['email'], $a['nama'], $a['jawatan'], $a['kejohanan'],
                                $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                                $a['pasukan_home'], $a['pasukan_away'],
                                $emailToken, $tgLinkUrl, !empty($a['pengadil_id']),
                                $a['no_perlawanan'] ?? '', $logoHome, $logoAway, $allOfficials,
                                $a['jenis_kejohanan'] ?? 'Persahabatan', $regionLabel
                            );
                        } catch (Throwable $emailError) {
                            $emailErrorMessage = $emailError->getMessage();
                            error_log('[lantikan.php notify_all] Email error: ' . $emailErrorMessage);
                        }
                        if ($emailDelivered) {
                            $totalEmail++;
                        }
                        recordLantikanAudit(
                            $pdo,
                            (int) $a['lantikan_id'],
                            'appointment_notification',
                            'email',
                            $emailDelivered ? 'success' : 'failed',
                            [
                                'recipient' => $a['email'],
                                'accept_url' => $appointmentLinks['accept_url'],
                                'reject_url' => $appointmentLinks['reject_url'],
                                'error' => $emailErrorMessage,
                            ],
                            $appointmentLinks['accept_url'],
                            'admin',
                            (int) $currentUser['id'],
                            $auditSnapshot
                        );
                    } else {
                        recordLantikanAudit(
                            $pdo,
                            (int) $a['lantikan_id'],
                            'appointment_notification',
                            'email',
                            'skipped',
                            ['reason' => 'email_missing'],
                            $appointmentLinks['accept_url'],
                            'admin',
                            (int) $currentUser['id'],
                            $auditSnapshot
                        );
                    }

                    // Portal supplements a confirmed Telegram/email delivery;
                    // it cannot start the answer deadline on its own.
                    $delivered = hasSuccessfulExternalAppointmentDelivery($tgDelivered, $emailDelivered);
                    $deliveryRecorded = false;
                    if ($delivered) {
                        $deliveryRecorded = markAppointmentExternallyDelivered(
                            $pdo,
                            (int) $a['lantikan_id'],
                            $tgDelivered,
                            $emailDelivered
                        );
                        if ($deliveryRecorded) {
                            $totalAssignments++;
                        }

                        recordLantikanAudit(
                            $pdo,
                            (int) $a['lantikan_id'],
                            'appointment_dispatched',
                            'combined',
                            $deliveryRecorded ? 'success' : 'failed',
                            [
                                'telegram_success' => $tgDelivered,
                                'email_success' => $emailDelivered,
                                'deadline_started' => $deliveryRecorded,
                            ],
                            $appointmentLinks['accept_url'],
                            'admin',
                            (int) $currentUser['id'],
                            $auditSnapshot
                        );

                        if ($deliveryRecorded && !empty($a['user_id'])) {
                            try {
                                notifyLantikanPortal($pdo, (int)$a['user_id'], $a['jawatan'], $a['kejohanan'],
                                    $a['tarikh'], $a['pasukan_home'], $a['pasukan_away']);
                            } catch (Throwable $portalError) {
                                error_log('[lantikan.php notify_all] Portal notification error: '
                                    . $portalError->getMessage());
                            }
                        }
                    } else {
                        $totalDeliveryFailed++;
                        recordLantikanAudit(
                            $pdo,
                            (int) $a['lantikan_id'],
                            'appointment_dispatched',
                            'combined',
                            'failed',
                            [
                                'telegram_success' => false,
                                'email_success' => false,
                                'deadline_started' => false,
                            ],
                            $appointmentLinks['accept_url'],
                            'admin',
                            (int) $currentUser['id'],
                            $auditSnapshot
                        );
                    }

                    // ── PP Daerah notification ────────────────────────────
                    $pid = (int)($a['persatuan_id'] ?? 0);
                    $ppKey = $jadual_id . ':' . $pid . ':' . (int) $a['lantikan_id'];
                    if ($deliveryRecorded && $pid && !isset($ppNotified[$ppKey])) {
                        try {
                            notifyPPDaerahLantikan($pdo, $pid, $a['nama'], $a['jawatan'], $a['kejohanan'],
                                $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                                $a['pasukan_home'], $a['pasukan_away'], $a['no_perlawanan'] ?? '');
                            $ppNotified[$ppKey] = true;
                        } catch (Throwable $ppError) {
                            error_log('[lantikan.php notify_all] PP Daerah notification error: '
                                . $ppError->getMessage());
                        }
                    }
                }

                if (!markMatchDispatchedIfComplete($pdo, $jadual_id)) {
                    $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Menunggu Pengesahan' WHERE id = :id")
                        ->execute([':id' => $jadual_id]);
                }
                $matchesProcessed++;
            }

            $parts = ["{$totalAssignments} notifikasi dihantar untuk {$matchesProcessed} perlawanan."];
            if ($totalEmail > 0)     $parts[] = "{$totalEmail} emel dihantar.";
            if ($totalTgSent > 0)    $parts[] = "{$totalTgSent} Telegram dihantar.";
            if ($totalTgSkipped > 0) $parts[] = "{$totalTgSkipped} pegawai tidak menerima notifikasi Telegram; saluran emel digunakan jika berjaya.";
            if ($totalRenotify > 0)  $parts[] = "Nota: {$totalRenotify} pengadil dihantar semula (pautan asal masih sah; tempoh jawapan dikira semula dari notifikasi terbaru).";
            if ($startedMatchCount > 0) $parts[] = "{$startedMatchCount} perlawanan yang telah bermula dilangkau.";
            if ($incompleteMatchCount > 0) $parts[] = "{$incompleteMatchCount} perlawanan tanpa Pengadil, AR1 dan AR2 lengkap dilangkau.";
            if ($totalDeliveryFailed > 0) $parts[] = "{$totalDeliveryFailed} lantikan gagal dihantar dan tempoh jawapannya belum bermula.";

            jsonResponse([
                'error'             => false,
                'message'           => implode(' ', $parts),
                'total_assignments' => $totalAssignments,
                'matches_processed' => $matchesProcessed,
                'email_sent'        => $totalEmail,
                'tg_sent'           => $totalTgSent,
                'tg_skipped'        => $totalTgSkipped,
                'delivery_failed'   => $totalDeliveryFailed,
                'matches_skipped_incomplete' => $incompleteMatchCount,
                'matches_skipped_started' => $startedMatchCount,
            ]);
        }

        // ── Cancel all assignments for a single match ────────────────────────
        if ($action === 'batal_jadual') {
            $jadual_id = (int) ($input['jadual_id'] ?? 0);
            $status = trim($input['status'] ?? 'Dibatalkan');
            $sebab = trim($input['sebab'] ?? '');
            if (!$jadual_id) {
                jsonResponse(['error' => true, 'message' => 'jadual_id diperlukan.'], 400);
            }
            if (!in_array($status, ['Dibatalkan', 'Ditangguhkan'], true) || $sebab === '' || mb_strlen($sebab) > 500) {
                jsonResponse(['error' => true, 'message' => 'Status dan sebab (maksimum 500 aksara) diperlukan.'], 400);
            }
            $result = batalLantikanByJadual($pdo, [$jadual_id], $status, $sebab, (int) $currentUser['id']);
            jsonResponse(['error' => false, 'message' => $result['message']]);
        }

        // ── Bulk cancel assignments for multiple matches ─────────────────────
        if ($action === 'batal_bulk') {
            $jadualIds = !empty($input['jadual_ids']) && is_array($input['jadual_ids'])
                ? array_map('intval', $input['jadual_ids'])
                : [];
            $status = trim($input['status'] ?? 'Dibatalkan');
            $sebab = trim($input['sebab'] ?? '');
            if (empty($jadualIds)) {
                jsonResponse(['error' => true, 'message' => 'jadual_ids diperlukan.'], 400);
            }
            if (!in_array($status, ['Dibatalkan', 'Ditangguhkan'], true) || $sebab === '' || mb_strlen($sebab) > 500) {
                jsonResponse(['error' => true, 'message' => 'Status dan sebab (maksimum 500 aksara) diperlukan.'], 400);
            }
            $result = batalLantikanByJadual($pdo, $jadualIds, $status, $sebab, (int) $currentUser['id']);
            jsonResponse(['error' => false, 'message' => $result['message']]);
        }

        // Assign single referee (supports both registered and luar)
        $jadual_id       = (int) ($input['jadual_id'] ?? 0);
        $pengadil_id     = !empty($input['pengadil_id']) ? (int) $input['pengadil_id'] : null;
        $pengadil_luar_id = !empty($input['pengadil_luar_id']) ? (int) $input['pengadil_luar_id'] : null;
        $jawatan         = trim($input['jawatan'] ?? '');

        if (!$jadual_id || (!$pengadil_id && !$pengadil_luar_id) || !$jawatan) {
            jsonResponse(['error' => true, 'message' => 'jadual_id, pengadil dan jawatan diperlukan.'], 400);
        }
        if (($pengadil_id !== null) === ($pengadil_luar_id !== null)) {
            jsonResponse(['error' => true, 'message' => 'Pilih tepat satu pegawai berdaftar atau pegawai luar.'], 400);
        }
        if (!in_array($jawatan, $VALID_JAWATAN, true)) {
            jsonResponse(['error' => true, 'message' => 'Jawatan tidak sah.'], 400);
        }
        $jadualTiming = getJadualTiming($pdo, $jadual_id);
        if (!$jadualTiming) {
            jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai.'], 404);
        }
        if (in_array((string) ($jadualTiming['status'] ?? ''), ['Dibatalkan', 'Ditangguhkan'], true)) {
            jsonResponse(['error' => true, 'message' => 'Lantikan tidak boleh diubah untuk perlawanan yang dibatalkan atau ditangguhkan.'], 409);
        }

        requireLantikanAuditSchema($pdo);

        $poolStmt = $pdo->prepare("
            SELECT COALESCE(u.jenis_pengadil, pl.jenis_pengadil, '') AS jenis_pengadil
            FROM jadual_perlawanan jp
            JOIN pool_pengadil pp ON pp.kejohanan_id = jp.kejohanan_id
            LEFT JOIN users u ON u.id = pp.pengadil_id
            LEFT JOIN pengadil_luar pl ON pl.id = pp.pengadil_luar_id
            WHERE jp.id = :jid
              AND (
                    (:pid IS NOT NULL AND pp.pengadil_id = :pool_pid)
                 OR (:plid IS NOT NULL AND pp.pengadil_luar_id = :pool_plid)
              )
            LIMIT 1
        ");
        $poolStmt->execute([
            ':jid' => $jadual_id,
            ':pid' => $pengadil_id,
            ':pool_pid' => $pengadil_id,
            ':plid' => $pengadil_luar_id,
            ':pool_plid' => $pengadil_luar_id,
        ]);
        $poolMember = $poolStmt->fetch(PDO::FETCH_ASSOC);
        if (!$poolMember) {
            jsonResponse(['error' => true, 'message' => 'Pegawai yang dipilih tiada dalam pool kejohanan ini.'], 409);
        }
        $jenisPengadil = trim((string) ($poolMember['jenis_pengadil'] ?? ''));
        if ($jawatan === 'Penilai Pengadil' && $jenisPengadil !== 'Penilai Pengadil') {
            jsonResponse([
                'error' => true,
                'message' => 'Slot RA hanya boleh diberikan kepada pegawai berjenis Penilai Pengadil.',
            ], 409);
        }
        if ($jawatan !== 'Penilai Pengadil' && $jenisPengadil === 'Penilai Pengadil') {
            jsonResponse([
                'error' => true,
                'message' => 'Penilai Pengadil tidak boleh ditempatkan dalam slot KUP.',
            ], 409);
        }
        $matchStarted = hasMatchStarted((string) $jadualTiming['tarikh'], (string) $jadualTiming['masa']);

        // Upsert: if same jadual+jawatan exists, update; else insert
        // Use transaction + FOR UPDATE lock to prevent race condition
        $shouldNotifyCompleteKup = false;
        $pdo->beginTransaction();
        try {
            lockMatchForAppointmentResponse($pdo, $jadual_id);

            $checkStmt = $pdo->prepare("
                SELECT id, pengadil_id, pengadil_luar_id, status, penilaian_token
                FROM lantikan_pengadil
                WHERE jadual_id = :jid AND jawatan = :jaw
                FOR UPDATE
            ");
            $checkStmt->execute([':jid' => $jadual_id, ':jaw' => $jawatan]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            $identityChanged = !$existing
                || (int) ($existing['pengadil_id'] ?? 0) !== (int) ($pengadil_id ?? 0)
                || (int) ($existing['pengadil_luar_id'] ?? 0) !== (int) ($pengadil_luar_id ?? 0);
            $requiresFreshResponse = $identityChanged
                || ($existing && !in_array((string) $existing['status'], ['Belum Jawab', 'Diterima'], true));

            if ($requiresFreshResponse) {
                $conflictStmt = $pdo->prepare("
                    SELECT lp.id, lp.jawatan, jp.no_perlawanan
                    FROM lantikan_pengadil lp
                    JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
                    WHERE lp.status IN ('Belum Jawab', 'Diterima')
                      AND jp.tarikh = :tarikh
                      AND jp.masa = :masa
                      AND NOT (lp.jadual_id = :jid AND lp.jawatan = :jawatan)
                      AND (
                            (:pid IS NOT NULL AND lp.pengadil_id = :conflict_pid)
                         OR (:plid IS NOT NULL AND lp.pengadil_luar_id = :conflict_plid)
                      )
                    LIMIT 1
                    FOR UPDATE
                ");
                $conflictStmt->execute([
                    ':tarikh' => $jadualTiming['tarikh'],
                    ':masa' => $jadualTiming['masa'],
                    ':jid' => $jadual_id,
                    ':jawatan' => $jawatan,
                    ':pid' => $pengadil_id,
                    ':conflict_pid' => $pengadil_id,
                    ':plid' => $pengadil_luar_id,
                    ':conflict_plid' => $pengadil_luar_id,
                ]);
                $conflict = $conflictStmt->fetch(PDO::FETCH_ASSOC);
                if ($conflict) {
                    $pdo->rollBack();
                    jsonResponse([
                        'error' => true,
                        'message' => "Pegawai ini sudah dilantik sebagai {$conflict['jawatan']} pada tarikh dan masa yang sama.",
                    ], 409);
                }
            }

            // Once an RA report exists, its listed officials are an official
            // snapshot. Do not silently replace that crew.
            if ($requiresFreshResponse) {
                $reportStmt = $pdo->prepare("
                    SELECT id FROM laporan_penilaian
                    WHERE jadual_id = :jid
                    LIMIT 1 FOR UPDATE
                ");
                $reportStmt->execute([':jid' => $jadual_id]);
                if ($reportStmt->fetchColumn()) {
                    $pdo->rollBack();
                    jsonResponse([
                        'error' => true,
                        'message' => 'Lantikan tidak boleh diubah kerana laporan RA untuk perlawanan ini telah diwujudkan.',
                    ], 409);
                }

                $legacyAssessmentStmt = $pdo->prepare("
                    SELECT pp.id
                    FROM penilaian_pengadil pp
                    JOIN perlawanan p ON p.id = pp.perlawanan_id
                    JOIN lantikan_pengadil lp ON lp.id = p.lantikan_id
                    WHERE lp.jadual_id = :jid
                    LIMIT 1 FOR UPDATE
                ");
                $legacyAssessmentStmt->execute([':jid' => $jadual_id]);
                if ($legacyAssessmentStmt->fetchColumn()) {
                    $pdo->rollBack();
                    jsonResponse([
                        'error' => true,
                        'message' => 'Lantikan tidak boleh diubah kerana rekod penilaian pengadil telah wujud dalam sejarah perlawanan.',
                    ], 409);
                }
            }

            $lantikanId = 0;
            $shouldNotifyRa = false;

            if ($existing) {
                $lantikanId = (int) $existing['id'];
                if ($matchStarted) {
                    $keepPenilaianToken = $jawatan === 'Penilai Pengadil'
                        && !$identityChanged
                        && $existing['status'] === 'Diterima';
                    $pdo->prepare("
                        UPDATE lantikan_pengadil
                        SET pengadil_id = :pid, pengadil_luar_id = :plid,
                            status = 'Diterima', komen = NULL,
                            sebab_status = 'Disahkan terus oleh pentadbir selepas perlawanan bermula',
                            tarikh_jawab = NOW(), status_dikemaskini_at = NOW(),
                            notif_hantar = 0, tg_notif_hantar = 0, tarikh_notif = NULL,
                            tg_token = NULL, email_token = NULL,
                            penilaian_token = CASE WHEN :keep_penilaian = 1 THEN penilaian_token ELSE NULL END,
                            created_by = :cb
                        WHERE id = :id
                    ")->execute([
                        ':pid' => $pengadil_id,
                        ':plid' => $pengadil_luar_id,
                        ':keep_penilaian' => $keepPenilaianToken ? 1 : 0,
                        ':cb' => (int) $currentUser['id'],
                        ':id' => $lantikanId,
                    ]);
                    $shouldNotifyRa = $jawatan === 'Penilai Pengadil' && !$keepPenilaianToken;
                } elseif ($requiresFreshResponse) {
                    // Old response links must not answer a replacement's appointment.
                    $pdo->prepare("
                        UPDATE lantikan_pengadil
                        SET pengadil_id = :pid, pengadil_luar_id = :plid,
                            status = 'Belum Jawab', komen = NULL, sebab_status = NULL,
                            tarikh_jawab = NULL, status_dikemaskini_at = NULL,
                            notif_hantar = 0, tg_notif_hantar = 0, tarikh_notif = NULL,
                            tg_token = NULL, email_token = NULL, penilaian_token = NULL,
                            created_by = :cb
                        WHERE id = :id
                    ")->execute([
                        ':pid' => $pengadil_id,
                        ':plid' => $pengadil_luar_id,
                        ':cb' => (int) $currentUser['id'],
                        ':id' => $lantikanId,
                    ]);
                }
            } elseif ($matchStarted) {
                $pdo->prepare("
                    INSERT INTO lantikan_pengadil
                        (jadual_id, pengadil_id, pengadil_luar_id, jawatan, status,
                         sebab_status, tarikh_jawab, status_dikemaskini_at,
                         notif_hantar, tg_notif_hantar, created_by)
                    VALUES
                        (:jid, :pid, :plid, :jaw, 'Diterima',
                         'Disahkan terus oleh pentadbir selepas perlawanan bermula', NOW(), NOW(),
                         0, 0, :cb)
                ")->execute([
                    ':jid' => $jadual_id,
                    ':pid' => $pengadil_id,
                    ':plid' => $pengadil_luar_id,
                    ':jaw' => $jawatan,
                    ':cb' => (int) $currentUser['id'],
                ]);
                $lantikanId = (int) $pdo->lastInsertId();
                $shouldNotifyRa = $jawatan === 'Penilai Pengadil';
            } else {
                $pdo->prepare("
                    INSERT INTO lantikan_pengadil (jadual_id, pengadil_id, pengadil_luar_id, jawatan, created_by)
                    VALUES (:jid, :pid, :plid, :jaw, :cb)
                ")->execute([
                    ':jid' => $jadual_id,
                    ':pid' => $pengadil_id,
                    ':plid' => $pengadil_luar_id,
                    ':jaw' => $jawatan,
                    ':cb' => (int) $currentUser['id'],
                ]);
                $lantikanId = (int) $pdo->lastInsertId();
            }

            $auditEvent = !$existing
                ? 'appointment_created'
                : ($identityChanged ? 'appointment_reassigned' : 'appointment_reviewed');
            $auditSnapshot = getLantikanAuditSnapshot($pdo, $lantikanId);
            if (!$auditSnapshot) {
                throw new RuntimeException('Snapshot audit lantikan tidak dijumpai selepas lantikan disimpan.');
            }
            recordLantikanAudit(
                $pdo,
                $lantikanId,
                $auditEvent,
                'admin',
                'success',
                [
                    'previous_pengadil_id' => $existing['pengadil_id'] ?? null,
                    'previous_pengadil_luar_id' => $existing['pengadil_luar_id'] ?? null,
                    'previous_status' => $existing['status'] ?? null,
                    'match_started' => $matchStarted,
                    'notification_sent' => false,
                ],
                null,
                'admin',
                (int) $currentUser['id'],
                $auditSnapshot
            );

            syncPerlawananHistoryForJadual($pdo, $jadual_id);
            if ($matchStarted) {
                $pdo->prepare("
                    UPDATE jadual_perlawanan
                    SET status = CASE
                        WHEN status IN ('Belum Lantik', 'Menunggu Pengesahan') THEN 'Disahkan'
                        ELSE status
                    END
                    WHERE id = :id
                ")->execute([':id' => $jadual_id]);

                $shouldNotifyCompleteKup = $requiresFreshResponse
                    && isKupPosition($jawatan)
                    && isAcceptedKupCrewComplete($pdo, $jadual_id);
            } elseif ($requiresFreshResponse || !$existing) {
                $pdo->prepare("
                    UPDATE jadual_perlawanan
                    SET status = 'Menunggu Pengesahan'
                    WHERE id = :id
                ")->execute([':id' => $jadual_id]);
            }

            $pdo->commit();

            $message = $matchStarted
                ? 'Lantikan rekod lama disahkan terus dan sejarah pengadil dikemaskini.'
                : ($existing ? 'Lantikan dikemaskini.' : 'Pengadil berjaya dilantik.');

            if ($shouldNotifyCompleteKup) {
                try {
                    $crewResult = notifyCompleteKupCrew($pdo, $jadual_id);
                    $message .= " Krew KUP lengkap dimaklumkan melalui {$crewResult['telegram_sent']} Telegram dan {$crewResult['email_sent']} emel.";
                    if ((int) $crewResult['pending_channels'] > 0) {
                        $message .= " {$crewResult['pending_channels']} penghantaran akan dicuba semula secara automatik.";
                    }
                } catch (Throwable $crewNotifyError) {
                    error_log('[lantikan.php] KUP crew notification error: ' . $crewNotifyError->getMessage());
                    $message .= ' Krew KUP lengkap, tetapi notifikasi krew gagal dihantar.';
                }
            }

            if ($shouldNotifyRa) {
                try {
                    generatePenilaianToken($pdo, $lantikanId);
                    $message .= ' Pautan borang penilaian RA telah dihantar.';
                } catch (Throwable $notifyErr) {
                    error_log('[lantikan.php] RA notification failed: ' . $notifyErr->getMessage());
                    $message .= ' Lantikan RA berjaya, tetapi notifikasi borang gagal dihantar.';
                }
            }

            jsonResponse(['error' => false, 'message' => $message]);
        } catch (Throwable $txErr) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $txErr;
        }
    }

    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }

        // Fetch full record before delete so we can send cancellation notification
        $preStmt = $pdo->prepare("
            SELECT lp.jawatan, lp.status, lp.notif_hantar,
                   COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
                   COALESCE(u.nama_penuh, pl.nama)  AS nama,
                   COALESCE(u.email, pl.emel)        AS email,
                   lp.pengadil_id,
                   lp.jadual_id, jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
                   jp.pasukan_home, jp.pasukan_away, jp.kejohanan_id,
                   jp.logo_home, jp.logo_away,
                   COALESCE(kj.nama, '') AS kejohanan
            FROM lantikan_pengadil lp
            JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
            LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
            LEFT JOIN users u ON lp.pengadil_id = u.id
            LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
            WHERE lp.id = :id
        ");
        $preStmt->execute([':id' => $id]);
        $record = $preStmt->fetch(PDO::FETCH_ASSOC);

        if (!$record) {
            jsonResponse(['error' => true, 'message' => 'Lantikan tidak dijumpai.'], 404);
        }

        if (hasMatchStarted((string) $record['tarikh'], (string) $record['masa'])) {
            jsonResponse([
                'error' => true,
                'message' => 'Lantikan perlawanan yang telah bermula tidak boleh dibuang. Gunakan tindakan Ganti untuk membetulkan pegawai.',
            ], 409);
        }

        requireLantikanAuditSchema($pdo);

        $shouldNotifyCompleteKup = false;
        $pdo->beginTransaction();
        try {
            lockMatchForAppointmentResponse($pdo, (int) $record['jadual_id']);
            $deleteAuditSnapshot = getLantikanAuditSnapshot($pdo, $id, true);
            if (!$deleteAuditSnapshot) {
                throw new RuntimeException('Snapshot audit lantikan tidak dijumpai sebelum dibuang.');
            }

            $reportStmt = $pdo->prepare("
                SELECT lp.id
                FROM laporan_penilaian lp
                LEFT JOIN laporan_penilaian_pegawai lpp ON lpp.laporan_id = lp.id
                WHERE lp.lantikan_id = :report_lid OR lpp.lantikan_pengadil_id = :pegawai_lid
                LIMIT 1 FOR UPDATE
            ");
            $reportStmt->execute([':report_lid' => $id, ':pegawai_lid' => $id]);
            if ($reportStmt->fetchColumn()) {
                $pdo->rollBack();
                jsonResponse([
                    'error' => true,
                    'message' => 'Lantikan tidak boleh dibuang kerana sudah digunakan dalam laporan RA.',
                ], 409);
            }

            $legacyAssessmentStmt = $pdo->prepare("
                SELECT pp.id
                FROM penilaian_pengadil pp
                JOIN perlawanan p ON p.id = pp.perlawanan_id
                WHERE p.lantikan_id = :id
                LIMIT 1 FOR UPDATE
            ");
            $legacyAssessmentStmt->execute([':id' => $id]);
            if ($legacyAssessmentStmt->fetchColumn()) {
                $pdo->rollBack();
                jsonResponse([
                    'error' => true,
                    'message' => 'Lantikan tidak boleh dibuang kerana rekod penilaian pengadil telah wujud.',
                ], 409);
            }

            // Remove the linked history first so no orphan row survives even
            // on installations without a foreign-key cascade.
            $pdo->prepare("DELETE FROM perlawanan WHERE lantikan_id = :id")
                ->execute([':id' => $id]);
            recordLantikanAudit(
                $pdo,
                $id,
                'appointment_deleted',
                'admin',
                'success',
                [
                    'previous_status' => $record['status'],
                    'notification_was_sent' => (bool) $record['notif_hantar'],
                ],
                null,
                'admin',
                (int) $currentUser['id'],
                $deleteAuditSnapshot
            );
            $deleteStmt = $pdo->prepare("DELETE FROM lantikan_pengadil WHERE id = :id");
            $deleteStmt->execute([':id' => $id]);
            if ($deleteStmt->rowCount() !== 1) {
                throw new RuntimeException('Lantikan berubah semasa proses buang. Sila cuba lagi.');
            }

            syncPerlawananHistoryForJadual($pdo, (int) $record['jadual_id']);
            $shouldNotifyCompleteKup = isKupPosition((string) $record['jawatan'])
                && in_array((string) $record['status'], ['Belum Jawab', 'Diterima'], true)
                && isAcceptedKupCrewComplete($pdo, (int) $record['jadual_id']);
            $slotValidation = getAppointmentSlotValidation($pdo, (int) $record['jadual_id']);
            if (!$slotValidation['valid']) {
                $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Belum Lantik' WHERE id = :id")
                    ->execute([':id' => $record['jadual_id']]);
            } elseif (!markMatchDispatchedIfComplete($pdo, (int) $record['jadual_id'])) {
                $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Menunggu Pengesahan' WHERE id = :id")
                    ->execute([':id' => $record['jadual_id']]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        if ($shouldNotifyCompleteKup) {
            try {
                notifyCompleteKupCrew($pdo, (int) $record['jadual_id']);
            } catch (Throwable $crewNotifyError) {
                error_log('[lantikan.php delete] KUP crew notification error: ' . $crewNotifyError->getMessage());
            }
        }

        // Send cancellation notifications only after the atomic delete commits.
        if (!empty($record['notif_hantar'])) {
                require_once __DIR__ . '/../config/telegram.php';
                require_once __DIR__ . '/../config/email.php';

                // Fetch logos
                $logoHome = $record['logo_home'] ?? '';
                $logoAway = $record['logo_away'] ?? '';

                // Telegram
                if (!empty($record['telegram_chat_id'])) {
                    $msg = tgBatalMessage(
                        $record['nama'], $record['jawatan'], $record['kejohanan'],
                        $record['tarikh'], $record['masa'] ?? '', $record['tempat'] ?? '',
                        $record['pasukan_home'], $record['pasukan_away'],
                        $record['no_perlawanan'] ?? ''
                    );
                    $telegramError = null;
                    try {
                        $telegramDelivered = tgSend((int) $record['telegram_chat_id'], $msg);
                    } catch (Throwable $channelError) {
                        $telegramDelivered = false;
                        $telegramError = $channelError->getMessage();
                        error_log('[lantikan.php delete] Telegram cancellation error: ' . $telegramError);
                    }
                    recordLantikanAudit(
                        $pdo,
                        $id,
                        'cancellation_notification',
                        'telegram',
                        $telegramDelivered ? 'success' : 'failed',
                        ['reason' => 'Lantikan dibuang oleh pentadbir', 'error' => $telegramError],
                        null,
                        'admin',
                        (int) $currentUser['id'],
                        $deleteAuditSnapshot
                    );
                }

                // Email
                if (!empty($record['email'])) {
                    $emailError = null;
                    try {
                        $emailDelivered = sendBatalEmail(
                            $record['email'],
                            $record['nama'],
                            $record['jawatan'],
                            $record['kejohanan'],
                            $record['tarikh'],
                            $record['masa'] ?? '',
                            $record['tempat'] ?? '',
                            $record['pasukan_home'],
                            $record['pasukan_away'],
                            $record['no_perlawanan'] ?? '',
                            $logoHome,
                            $logoAway,
                            !empty($record['pengadil_id'])
                        );
                    } catch (Throwable $channelError) {
                        $emailDelivered = false;
                        $emailError = $channelError->getMessage();
                        error_log('[lantikan.php delete] Email cancellation error: ' . $emailError);
                    }
                    recordLantikanAudit(
                        $pdo,
                        $id,
                        'cancellation_notification',
                        'email',
                        $emailDelivered ? 'success' : 'failed',
                        [
                            'reason' => 'Lantikan dibuang oleh pentadbir',
                            'recipient' => $record['email'],
                            'error' => $emailError,
                        ],
                        null,
                        'admin',
                        (int) $currentUser['id'],
                        $deleteAuditSnapshot
                    );
                }
        }

        jsonResponse(['error' => false, 'message' => 'Lantikan dibuang.']);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    error_log('[lantikan.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
