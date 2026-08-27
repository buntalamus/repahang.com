<?php
/**
 * Append-only audit trail and direct-link helpers for appointments.
 *
 * The audit table intentionally has no cascading foreign keys. Historical
 * evidence must survive an appointment, match, tournament or profile removal.
 */

declare(strict_types=1);

function requireLantikanAuditSchema(PDO $pdo): void
{
    try {
        $pdo->query('SELECT id FROM lantikan_audit_log LIMIT 1');
    } catch (Throwable $e) {
        throw new RuntimeException(
            'Log audit lantikan belum tersedia. Jalankan docs/migration_lantikan_audit.sql sebelum meneruskan.',
            0,
            $e
        );
    }
}

/** @return array<string, mixed>|null */
function getLantikanAuditSnapshot(PDO $pdo, int $lantikanId, bool $forUpdate = false): ?array
{
    $lock = $forUpdate ? ' FOR UPDATE' : '';
    $stmt = $pdo->prepare("
        SELECT lp.id AS lantikan_id, lp.jadual_id, jp.kejohanan_id,
               lp.pengadil_id, lp.pengadil_luar_id, lp.jawatan, lp.status,
               lp.notif_hantar, lp.tg_notif_hantar, lp.tarikh_notif,
               lp.email_token, lp.tg_token, lp.penilaian_token,
               COALESCE(u.nama_penuh, pl.nama, '') AS nama_pegawai,
               COALESCE(u.email, pl.emel, '') AS emel_pegawai,
               COALESCE(u.no_telefon, pl.no_tel, '') AS no_telefon_pegawai,
               COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
               COALESCE(u.tg_link_token, pl.tg_link_token) AS tg_link_token,
               jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
               jp.pasukan_home, jp.pasukan_away,
               COALESCE(kj.nama, '') AS kejohanan
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
        LEFT JOIN kejohanan kj ON kj.id = jp.kejohanan_id
        LEFT JOIN users u ON u.id = lp.pengadil_id
        LEFT JOIN pengadil_luar pl ON pl.id = lp.pengadil_luar_id
        WHERE lp.id = :id{$lock}
    ");
    $stmt->execute([':id' => $lantikanId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function buildTelegramLink(string $linkToken): string
{
    $botUsername = ltrim((string) env('TELEGRAM_BOT_USERNAME', 'refpahang_bot'), '@');
    return 'https://t.me/' . rawurlencode($botUsername) . '?start=' . rawurlencode($linkToken);
}

/**
 * @param array<string, mixed> $details
 * @param array<string, mixed>|null $snapshot
 */
function recordLantikanAudit(
    PDO $pdo,
    int $lantikanId,
    string $eventType,
    string $channel = 'system',
    string $eventStatus = 'info',
    array $details = [],
    ?string $linkUrl = null,
    string $actorType = 'system',
    ?int $actorUserId = null,
    ?array $snapshot = null,
    ?string $eventKey = null
): int {
    requireLantikanAuditSchema($pdo);
    $snapshot ??= getLantikanAuditSnapshot($pdo, $lantikanId);
    if (!$snapshot) {
        throw new RuntimeException('Lantikan untuk log audit tidak dijumpai.');
    }

    $json = json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Butiran log audit tidak dapat dikodkan.');
    }

    $stmt = $pdo->prepare("
        INSERT INTO lantikan_audit_log (
            event_key, lantikan_id, jadual_id, kejohanan_id,
            pengadil_id, pengadil_luar_id, jawatan,
            nama_pegawai, emel_pegawai, no_telefon_pegawai,
            event_type, channel, event_status, link_url, details_json,
            actor_type, actor_user_id, ip_address, user_agent
        ) VALUES (
            :event_key, :lantikan_id, :jadual_id, :kejohanan_id,
            :pengadil_id, :pengadil_luar_id, :jawatan,
            :nama, :emel, :telefon,
            :event_type, :channel, :event_status, :link_url, :details,
            :actor_type, :actor_user_id, :ip, :user_agent
        )
    ");
    $stmt->execute([
        ':event_key' => $eventKey,
        ':lantikan_id' => $lantikanId,
        ':jadual_id' => $snapshot['jadual_id'] ?? null,
        ':kejohanan_id' => $snapshot['kejohanan_id'] ?? null,
        ':pengadil_id' => $snapshot['pengadil_id'] ?? null,
        ':pengadil_luar_id' => $snapshot['pengadil_luar_id'] ?? null,
        ':jawatan' => $snapshot['jawatan'] ?? null,
        ':nama' => $snapshot['nama_pegawai'] ?? null,
        ':emel' => $snapshot['emel_pegawai'] ?? null,
        ':telefon' => $snapshot['no_telefon_pegawai'] ?? null,
        ':event_type' => $eventType,
        ':channel' => $channel,
        ':event_status' => $eventStatus,
        ':link_url' => $linkUrl,
        ':details' => $json,
        ':actor_type' => $actorType,
        ':actor_user_id' => $actorUserId,
        ':ip' => $_SERVER['REMOTE_ADDR'] ?? null,
        ':user_agent' => isset($_SERVER['HTTP_USER_AGENT'])
            ? mb_substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 255)
            : null,
    ]);

    return (int) $pdo->lastInsertId();
}

/** @return array{accept_url: string, reject_url: string} */
function buildAppointmentDirectLinks(string $emailToken): array
{
    $baseUrl = rtrim((string) env('BASE_URL', 'https://refpahang.com'), '/');
    $encoded = urlencode($emailToken);
    return [
        'accept_url' => $baseUrl . '/api/lantikan-jawab-token.php?token=' . $encoded . '&action=accept',
        'reject_url' => $baseUrl . '/api/lantikan-jawab-token.php?token=' . $encoded . '&action=reject',
    ];
}

function buildRaDirectLink(string $penilaianToken): string
{
    $baseUrl = rtrim((string) env('BASE_URL', 'https://refpahang.com'), '/');
    return $baseUrl . '/penilaian-borang.html?token=' . urlencode($penilaianToken);
}

/**
 * @param array<string, mixed> $snapshot
 * @return array<string, string|null>
 */
function getActiveDirectLinks(array $snapshot): array
{
    $acceptUrl = null;
    $rejectUrl = null;
    $emailToken = trim((string) ($snapshot['email_token'] ?? ''));
    if (($snapshot['status'] ?? '') === 'Belum Jawab' && $emailToken !== '') {
        $links = buildAppointmentDirectLinks($emailToken);
        $acceptUrl = $links['accept_url'];
        $rejectUrl = $links['reject_url'];
    }

    $raUrl = null;
    $raToken = trim((string) ($snapshot['penilaian_token'] ?? ''));
    if (($snapshot['jawatan'] ?? '') === 'Penilai Pengadil'
        && ($snapshot['status'] ?? '') === 'Diterima'
        && $raToken !== '') {
        $raUrl = buildRaDirectLink($raToken);
    }

    return [
        'accept_url' => $acceptUrl,
        'reject_url' => $rejectUrl,
        'ra_form_url' => $raUrl,
    ];
}

function recordExternalTelegramLinked(PDO $pdo, int $pengadilLuarId, int $chatId): void
{
    requireLantikanAuditSchema($pdo);
    $stmt = $pdo->prepare("
        SELECT id
        FROM lantikan_pengadil
        WHERE pengadil_luar_id = :id
        ORDER BY id ASC
    ");
    $stmt->execute([':id' => $pengadilLuarId]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $lantikanId) {
        $snapshot = getLantikanAuditSnapshot($pdo, (int) $lantikanId);
        if (!$snapshot) {
            continue;
        }
        recordLantikanAudit(
            $pdo,
            (int) $lantikanId,
            'telegram_account_linked',
            'telegram',
            'success',
            ['telegram_chat_id' => $chatId],
            null,
            'official',
            null,
            $snapshot
        );
    }
}

/**
 * Record the successful pre-appointment Telegram onboarding against every
 * tournament for which this external official received an onboarding blast.
 *
 * The caller already owns the database transaction that links telegram_chat_id,
 * so state and append-only evidence commit or roll back together.
 */
function recordExternalTelegramOnboardingLinked(PDO $pdo, int $pengadilLuarId, int $chatId): void
{
    try {
        $stmt = $pdo->prepare("
            SELECT os.kejohanan_id, os.last_batch_id, os.linked_at,
                   b.batch_token, b.kejohanan_nama, b.attempt_mode,
                   b.actor_user_id,
                   pl.nama, pl.emel
            FROM telegram_onboarding_state os
            LEFT JOIN telegram_onboarding_batch b ON b.id = os.last_batch_id
            JOIN pengadil_luar pl ON pl.id = os.pengadil_luar_id
            WHERE os.pengadil_luar_id = :id
            ORDER BY os.kejohanan_id ASC
            FOR UPDATE
        ");
        $stmt->execute([':id' => $pengadilLuarId]);
        $states = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        throw new RuntimeException(
            'Audit kejayaan pemautan Telegram belum tersedia. Jalankan semula docs/migration_lantikan_audit.sql.',
            0,
            $e
        );
    }

    if (!$states) {
        return;
    }

    $update = $pdo->prepare("
        UPDATE telegram_onboarding_state
        SET linked_at = COALESCE(linked_at, CURRENT_TIMESTAMP),
            claim_token = NULL,
            claimed_at = NULL
        WHERE kejohanan_id = :kejohanan_id
          AND pengadil_luar_id = :pengadil_luar_id
    ");
    $insert = $pdo->prepare("
        INSERT INTO telegram_onboarding_log (
            batch_id, batch_token, kejohanan_id, kejohanan_nama,
            pengadil_luar_id, nama_pegawai, emel_pegawai,
            attempt_mode, event_status, reason, link_url, error_message,
            actor_user_id, ip_address, user_agent
        ) VALUES (
            :batch_id, :batch_token, :kejohanan_id, :kejohanan_nama,
            :pengadil_luar_id, :nama, :emel,
            :attempt_mode, 'linked', 'telegram_account_linked', NULL, NULL,
            :actor_user_id, :ip_address, :user_agent
        )
    ");

    foreach ($states as $state) {
        $update->execute([
            ':kejohanan_id' => (int) $state['kejohanan_id'],
            ':pengadil_luar_id' => $pengadilLuarId,
        ]);

        // A state without a source batch can exist only through manual legacy
        // data. Preserve linked_at, but do not fabricate a batch snapshot.
        if (empty($state['last_batch_id']) || empty($state['batch_token'])) {
            continue;
        }

        $insert->execute([
            ':batch_id' => (int) $state['last_batch_id'],
            ':batch_token' => (string) $state['batch_token'],
            ':kejohanan_id' => (int) $state['kejohanan_id'],
            ':kejohanan_nama' => (string) $state['kejohanan_nama'],
            ':pengadil_luar_id' => $pengadilLuarId,
            ':nama' => (string) $state['nama'],
            ':emel' => trim((string) ($state['emel'] ?? '')) ?: null,
            ':attempt_mode' => (string) $state['attempt_mode'],
            ':actor_user_id' => $state['actor_user_id'] !== null
                ? (int) $state['actor_user_id']
                : null,
            ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            ':user_agent' => isset($_SERVER['HTTP_USER_AGENT'])
                ? mb_substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 255)
                : null,
        ]);
    }
}
