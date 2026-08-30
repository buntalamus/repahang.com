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

require_once __DIR__ . '/lantikan-audit.php';

// Komen penanda untuk lantikan yang ditolak secara automatik (tiada jawapan
// dalam tempoh). Juga digunakan sebagai flag machine-readable oleh saluran
// jawapan untuk memaparkan mesej "tempoh tamat" dan bukan "sudah dijawab".
const LANTIKAN_AUTO_TOLAK_KOMEN = 'Ditolak automatik - tiada jawapan dalam tempoh';
const LANTIKAN_ADMIN_OVERRIDE_TERIMA_KOMEN = 'Diterima melalui override Admin selepas tempoh tamat';
const LANTIKAN_ADMIN_OVERRIDE_PENOLAKAN_KOMEN = 'Diterima melalui override Admin selepas penolakan tersilap';

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
 * Convert the local Malaysia match date/time into an absolute timestamp.
 */
function getMatchKickoffTimestamp(string $tarikh, string $masa): ?int
{
    $masa = trim($masa);
    if (preg_match('/^\d{2}:\d{2}$/', $masa)) {
        $masa .= ':00';
    }

    $kickoff = DateTimeImmutable::createFromFormat(
        '!Y-m-d H:i:s',
        trim($tarikh) . ' ' . $masa,
        new DateTimeZone('Asia/Kuala_Lumpur')
    );
    $errors = DateTimeImmutable::getLastErrors();
    if ($kickoff === false || (is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
        return null;
    }

    return $kickoff->getTimestamp();
}

function hasMatchStarted(string $tarikh, string $masa, ?int $nowTimestamp = null): bool
{
    $kickoffTimestamp = getMatchKickoffTimestamp($tarikh, $masa);
    return $kickoffTimestamp !== null && ($nowTimestamp ?? time()) >= $kickoffTimestamp;
}

function shouldAutoRejectAppointment(
    int $notifTimestamp,
    string $jenisKejohanan,
    int $kickoffTimestamp,
    int $nowTimestamp
): bool {
    if ($notifTimestamp <= 0 || $kickoffTimestamp <= 0) {
        return false;
    }

    $deadlineTimestamp = $notifTimestamp + getDeadlineHours($jenisKejohanan) * 3600;
    return $deadlineTimestamp <= $nowTimestamp && $deadlineTimestamp < $kickoffTimestamp;
}

function matchStartedMessage(string $tarikh, string $masa): string
{
    $kickoffTimestamp = getMatchKickoffTimestamp($tarikh, $masa);
    $kickoff = $kickoffTimestamp !== null
        ? (new DateTimeImmutable('@' . $kickoffTimestamp))
            ->setTimezone(new DateTimeZone('Asia/Kuala_Lumpur'))
            ->format('d M Y, H:i')
        : trim($tarikh . ' ' . $masa);

    return "Lantikan atau notifikasi tidak dibenarkan kerana perlawanan telah bermula ({$kickoff}).";
}

/** Portal notifications are supplemental and never start the answer window. */
function hasSuccessfulExternalAppointmentDelivery(bool $telegramDelivered, bool $emailDelivered): bool
{
    return $telegramDelivered || $emailDelivered;
}

/** Persist dispatch and start the deadline only after Telegram or email succeeds. */
function markAppointmentExternallyDelivered(
    PDO $pdo,
    int $lantikanId,
    bool $telegramDelivered,
    bool $emailDelivered
): bool {
    if (!hasSuccessfulExternalAppointmentDelivery($telegramDelivered, $emailDelivered)) {
        return false;
    }

    $stmt = $pdo->prepare("
        UPDATE lantikan_pengadil
        SET notif_hantar = 1,
            tarikh_notif = NOW(),
            tg_notif_hantar = CASE WHEN :tg_success = 1 THEN 1 ELSE tg_notif_hantar END
        WHERE id = :id AND status = 'Belum Jawab'
    ");
    $stmt->execute([
        ':tg_success' => $telegramDelivered ? 1 : 0,
        ':id' => $lantikanId,
    ]);
    return $stmt->rowCount() === 1;
}

/**
 * Get the active KUP crew appointed to a match for notification display.
 *
 * KUP consists only of Pengadil, Penolong Pengadil 1, Penolong Pengadil 2,
 * and Pegawai ke4. Penilai Pengadil (RA) is intentionally excluded.
 * For state-level tournaments show the official's district; for every other
 * tournament level show their state, consistently with the appointment UI.
 *
 * @return array{region_label: string, officials: array<int, array<string, mixed>>}
 */
function getMatchKupOfficials(PDO $pdo, int $jadualId): array
{
    $stmt = $pdo->prepare("
        SELECT
            lp.id AS lantikan_id,
            lp.jawatan,
            COALESCE(NULLIF(TRIM(u.nama_penuh), ''), NULLIF(TRIM(pl.nama), ''), 'Nama tidak direkodkan') AS nama,
            COALESCE(NULLIF(TRIM(u.no_telefon), ''), NULLIF(TRIM(pl.no_tel), ''), '-') AS no_telefon,
            CASE
                WHEN COALESCE(kj.peringkat_kejohanan, 'Daerah') = 'Negeri'
                    THEN COALESCE(NULLIF(TRIM(u.daerah), ''), NULLIF(TRIM(pl.daerah), ''), '-')
                ELSE COALESCE(NULLIF(TRIM(u.negeri), ''), NULLIF(TRIM(pl.negeri), ''), '-')
            END AS wilayah,
            COALESCE(kj.peringkat_kejohanan, 'Daerah') AS peringkat_kejohanan
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
        LEFT JOIN kejohanan kj ON kj.id = jp.kejohanan_id
        LEFT JOIN users u ON u.id = lp.pengadil_id
        LEFT JOIN pengadil_luar pl ON pl.id = lp.pengadil_luar_id
        WHERE lp.jadual_id = :jid
          AND lp.jawatan IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
          AND lp.status IN ('Belum Jawab', 'Diterima')
        ORDER BY FIELD(lp.jawatan,
            'Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
    ");
    $stmt->execute([':jid' => $jadualId]);
    $officials = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $peringkat = (string) ($officials[0]['peringkat_kejohanan'] ?? 'Daerah');
    foreach ($officials as &$official) {
        unset($official['peringkat_kejohanan']);
    }
    unset($official);

    return [
        'region_label' => $peringkat === 'Negeri' ? 'Daerah' : 'Negeri',
        'officials' => $officials,
    ];
}

function isKupPosition(string $jawatan): bool
{
    return in_array($jawatan, [
        'Pengadil',
        'Penolong Pengadil 1',
        'Penolong Pengadil 2',
        'Pegawai ke4',
    ], true);
}

/**
 * Validate all five supported appointment slots. R, AR1 and AR2 are
 * mandatory; P4 and RA are optional. RA is slot five but remains separate
 * from KUP.
 *
 * @return array{valid: bool, total: int, missing: array<int, string>}
 */
function getAppointmentSlotValidation(PDO $pdo, int $jadualId): array
{
    $stmt = $pdo->prepare("
        SELECT jawatan
        FROM lantikan_pengadil
        WHERE jadual_id = :jid
          AND status IN ('Belum Jawab', 'Diterima')
    ");
    $stmt->execute([':jid' => $jadualId]);
    $positions = array_values(array_unique(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN))));
    $required = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2'];
    $missing = array_values(array_diff($required, $positions));

    return [
        'valid' => $missing === [] && count($positions) >= 3 && count($positions) <= 5,
        'total' => count($positions),
        'missing' => $missing,
    ];
}

/** Mark a match complete when every active appointment has been dispatched. */
function markMatchDispatchedIfComplete(PDO $pdo, int $jadualId): bool
{
    $slots = getAppointmentSlotValidation($pdo, $jadualId);
    if (!$slots['valid']) {
        return false;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'Diterima' OR notif_hantar = 1 THEN 1 ELSE 0 END) AS dihantar
        FROM lantikan_pengadil
        WHERE jadual_id = :jid
          AND status IN ('Belum Jawab', 'Diterima')
    ");
    $stmt->execute([':jid' => $jadualId]);
    $counts = $stmt->fetch(PDO::FETCH_ASSOC);
    $complete = (int) ($counts['total'] ?? 0) === (int) ($counts['dihantar'] ?? 0);
    if ($complete) {
        $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Disahkan' WHERE id = :id")
            ->execute([':id' => $jadualId]);
    }
    return $complete;
}

/** Serialize responses for one match so the final KUP acceptance is reliable. */
function lockMatchForAppointmentResponse(PDO $pdo, int $jadualId): void
{
    $stmt = $pdo->prepare("SELECT id FROM jadual_perlawanan WHERE id = :id FOR UPDATE");
    $stmt->execute([':id' => $jadualId]);
    if (!$stmt->fetchColumn()) {
        throw new RuntimeException('Perlawanan tidak dijumpai semasa memproses jawapan lantikan.');
    }
}

/**
 * True when the mandatory KUP trio exists and every appointed KUP has accepted.
 * Pegawai ke4 is optional. RA is the fifth appointment slot but is not a KUP
 * and therefore never gates the KUP contact-roster notification.
 */
function isAcceptedKupCrewComplete(PDO $pdo, int $jadualId): bool
{
    $stmt = $pdo->prepare("
        SELECT jawatan, status
        FROM lantikan_pengadil
        WHERE jadual_id = :jid
          AND jawatan IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
          AND status IN ('Belum Jawab', 'Diterima')
    ");
    $stmt->execute([':jid' => $jadualId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($rows) < 3 || count($rows) > 4) {
        return false;
    }

    $positions = [];
    foreach ($rows as $row) {
        $position = (string) ($row['jawatan'] ?? '');
        if (isset($positions[$position]) || ($row['status'] ?? '') !== 'Diterima') {
            return false;
        }
        $positions[$position] = true;
    }

    return isset(
        $positions['Pengadil'],
        $positions['Penolong Pengadil 1'],
        $positions['Penolong Pengadil 2']
    );
}

/**
 * Auto-TOLAK lantikan tertunggak hanya apabila seluruh tempoh jawapan tamat
 * sebelum sepak mula. Notifikasi lewat yang tempohnya melangkaui sepak mula
 * kekal "Belum Jawab" untuk semakan pentadbir dan tidak ditanda seolah-olah
 * pengadil menolak tugasan.
 *
 * UNIX_TIMESTAMP(tarikh_notif) memberikan masa mutlak dari MySQL. Waktu
 * sepak mula pula ditafsir secara jelas dalam Asia/Kuala_Lumpur supaya semakan
 * tidak bergantung pada timezone pelayan pangkalan data.
 *
 * @param array $scope Skop pilihan: 'id', 'jadual_id', 'pengadil_id', 'kejohanan_id'
 * @return int Bilangan baris yang ditukar kepada 'Ditolak'
 */
function autoTolakLantikanTertunggak(PDO $pdo, array $scope = []): int
{
    $where  = '';
    $params = [];
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
        SELECT lp.id, lp.jadual_id, lp.jawatan,
               UNIX_TIMESTAMP(lp.tarikh_notif) AS notif_timestamp,
               COALESCE(kj.jenis_kejohanan, '') AS jenis_kejohanan,
               jp.tarikh, jp.masa
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
        LEFT JOIN kejohanan kj    ON kj.id = jp.kejohanan_id
        WHERE lp.status = 'Belum Jawab'
          AND lp.notif_hantar = 1
          AND lp.tarikh_notif IS NOT NULL
          {$where}
    ");
    $stmt->execute($params);
    $pending = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $nowTimestamp = time();
    $expired = [];
    foreach ($pending as $row) {
        $notifTimestamp = (int) ($row['notif_timestamp'] ?? 0);
        $kickoffTimestamp = getMatchKickoffTimestamp(
            (string) ($row['tarikh'] ?? ''),
            (string) ($row['masa'] ?? '')
        );
        if ($notifTimestamp <= 0 || $kickoffTimestamp === null) {
            continue;
        }

        $jenisKejohanan = (string) ($row['jenis_kejohanan'] ?? '');
        $deadlineTimestamp = $notifTimestamp + getDeadlineHours($jenisKejohanan) * 3600;
        if (shouldAutoRejectAppointment(
            $notifTimestamp,
            $jenisKejohanan,
            $kickoffTimestamp,
            $nowTimestamp
        )) {
            $expired[] = [
                'id' => (int) $row['id'],
                'jadual_id' => (int) $row['jadual_id'],
                'jawatan' => (string) $row['jawatan'],
                'deadline' => $deadlineTimestamp,
            ];
        }
    }

    if ($expired === []) {
        return 0;
    }

    requireLantikanAuditSchema($pdo);

    $update = $pdo->prepare("
        UPDATE lantikan_pengadil
        SET status = 'Ditolak',
            komen = :komen,
            tarikh_jawab = FROM_UNIXTIME(:deadline),
            status_dikemaskini_at = FROM_UNIXTIME(:deadline),
            tg_token = NULL,
            email_token = NULL
        WHERE id = :id AND status = 'Belum Jawab'
    ");

    $updated = 0;
    $changedMatches = [];
    $changedKupMatches = [];
    $ownTransaction = !$pdo->inTransaction();
    if ($ownTransaction) {
        $pdo->beginTransaction();
    }
    try {
        foreach ($expired as $row) {
            $update->execute([
                ':komen' => LANTIKAN_AUTO_TOLAK_KOMEN,
                ':deadline' => $row['deadline'],
                ':id' => $row['id'],
            ]);
            if ($update->rowCount() === 1) {
                $updated++;
                $changedMatches[$row['jadual_id']] = true;
                if (isKupPosition((string) $row['jawatan'])) {
                    $changedKupMatches[$row['jadual_id']] = true;
                }
                $auditSnapshot = getLantikanAuditSnapshot($pdo, (int) $row['id']);
                if (!$auditSnapshot) {
                    throw new RuntimeException('Snapshot audit auto-tolak tidak dijumpai.');
                }
                recordLantikanAudit(
                    $pdo,
                    (int) $row['id'],
                    'appointment_auto_rejected',
                    'system',
                    'success',
                    [
                        'reason' => LANTIKAN_AUTO_TOLAK_KOMEN,
                        'deadline_timestamp' => $row['deadline'],
                    ],
                    null,
                    'system',
                    null,
                    $auditSnapshot
                );
            }
        }
        foreach (array_keys($changedMatches) as $jadualId) {
            syncPerlawananHistoryForJadual($pdo, (int) $jadualId);
        }
        if ($ownTransaction) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($ownTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    foreach (array_keys($changedKupMatches) as $jadualId) {
        if (isAcceptedKupCrewComplete($pdo, (int) $jadualId)) {
            try {
                notifyCompleteKupCrew($pdo, (int) $jadualId);
            } catch (Throwable $notificationError) {
                error_log('[autoTolakLantikanTertunggak] KUP crew notification error: '
                    . $notificationError->getMessage());
            }
        }
    }

    return $updated;
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
 * Updates an existing record when one is already linked (duplicate-safe via
 * lantikan_id UNIQUE) so every response channel refreshes the crew snapshot.
 * Only creates for registered pengadil (pengadil_id IS NOT NULL).
 *
 * @param PDO $pdo
 * @param int $lantikanId  The lantikan_pengadil.id that was just accepted
 * @param bool $syncExisting Update/remove an existing history row to match the
 *                           current accepted appointment.
 * @return bool True if history was created/updated/removed, false if skipped
 */
function createPerlawananFromLantikan(PDO $pdo, int $lantikanId, bool $syncExisting = false): bool
{
    // Fetch lantikan + jadual + kejohanan details
    $stmt = $pdo->prepare("
        SELECT lp.id, lp.pengadil_id, lp.jawatan, lp.jadual_id, lp.status,
               jp.tarikh, jp.masa, jp.tempat, jp.pasukan_home, jp.pasukan_away,
               jp.kategori, jp.peringkat, jp.kejohanan_id,
               COALESCE(kj.nama, '') AS kejohanan_nama
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
        WHERE lp.id = :id
    ");
    $stmt->execute([':id' => $lantikanId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $exists = $pdo->prepare("SELECT id FROM perlawanan WHERE lantikan_id = :lid LIMIT 1");
    $exists->execute([':lid' => $lantikanId]);
    $existingId = $exists->fetchColumn();

    if (!$row
        || ($row['status'] ?? '') !== 'Diterima'
        || empty($row['pengadil_id'])
        || !isKupPosition((string) ($row['jawatan'] ?? ''))) {
        // External, rejected, cancelled and RA appointments must not leave an
        // old registered KUP row in match history.
        if ($syncExisting && $existingId) {
            $pdo->prepare("DELETE FROM perlawanan WHERE id = :id")
                ->execute([':id' => (int) $existingId]);
            return true;
        }
        return false;
    }

    // Fetch all officials for this match to populate the crew fields
    $crewStmt = $pdo->prepare("
        SELECT lp.jawatan, lp.pengadil_id
        FROM lantikan_pengadil lp
        WHERE lp.jadual_id = :jid
          AND lp.pengadil_id IS NOT NULL
          AND lp.status = 'Diterima'
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
    // Schema perlawanan.jenis is VARCHAR(60). Keep the full tournament name
    // separately in nama_kejohanan and never let this label abort acceptance.
    $jenis = mb_substr(implode(' - ', $jenisParts) ?: 'Kejohanan', 0, 60);

    $params = [
        ':uid'     => (int) $row['pengadil_id'],
        ':lid'     => $lantikanId,
        ':tarikh'  => $row['tarikh'],
        ':masa'    => $row['masa'] ?? null,
        ':jenis'   => $jenis,
        ':nama_kejohanan' => $row['kejohanan_nama'] ?: null,
        ':tempat'  => $row['tempat'] ?? '',
        ':home'    => $row['pasukan_home'] ?? '',
        ':away'    => $row['pasukan_away'] ?? '',
        ':jawatan' => $row['jawatan'],
        ':hr'      => $crew['head_referee_id'],
        ':ar1'     => $crew['assistant_referee_1_id'],
        ':ar2'     => $crew['assistant_referee_2_id'],
        ':fo'      => $crew['fourth_official_id'],
    ];

    if ($existingId) {
        $upd = $pdo->prepare("
            UPDATE perlawanan
            SET user_id = :uid, tarikh = :tarikh, masa = :masa,
                jenis = :jenis, nama_kejohanan = :nama_kejohanan,
                tempat = :tempat, home_team = :home, away_team = :away,
                jawatan = :jawatan, head_referee_id = :hr,
                assistant_referee_1_id = :ar1,
                assistant_referee_2_id = :ar2,
                fourth_official_id = :fo, status_pp = 'Disahkan'
            WHERE id = :id
        ");
        unset($params[':lid']);
        $params[':id'] = (int) $existingId;
        $upd->execute($params);
        return true;
    }

    $ins = $pdo->prepare("
        INSERT INTO perlawanan
            (user_id, lantikan_id, tarikh, masa, jenis, nama_kejohanan,
             tempat, home_team, away_team,
             jawatan, head_referee_id, assistant_referee_1_id, assistant_referee_2_id,
             fourth_official_id, status_pp, created_at)
        VALUES
            (:uid, :lid, :tarikh, :masa, :jenis, :nama_kejohanan,
             :tempat, :home, :away,
             :jawatan, :hr, :ar1, :ar2, :fo, 'Disahkan', NOW())
    ");

    $ins->execute($params);

    return true;
}

/**
 * Keep every registered official's history snapshot aligned after an admin
 * corrects a match that has already started.
 */
function syncPerlawananHistoryForJadual(PDO $pdo, int $jadualId): void
{
    $stmt = $pdo->prepare("SELECT id FROM lantikan_pengadil WHERE jadual_id = :jid");
    $stmt->execute([':jid' => $jadualId]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $lantikanId) {
        createPerlawananFromLantikan($pdo, (int) $lantikanId, true);
    }
}

/**
 * Generate penilaian_token for Penilai Pengadil when they accept.
 * Sends email + Telegram notification with the borang penilaian link.
 *
 * @param PDO $pdo
 * @param int $lantikanId  The lantikan_pengadil.id just accepted
 * @param callable|null $emailSender Optional test seam; same arguments as sendEmail()
 * @param callable|null $telegramSender Optional test seam; same arguments as tgSend()
 * @return string|null  The token if generated, null if not applicable
 */
function generatePenilaianToken(
    PDO $pdo,
    int $lantikanId,
    ?callable $emailSender = null,
    ?callable $telegramSender = null
): ?string
{
    requireLantikanAuditSchema($pdo);
    $stmt = $pdo->prepare("
        SELECT lp.jawatan, lp.status, lp.penilaian_token,
               lp.pengadil_id, lp.pengadil_luar_id,
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
        WHERE lp.id = :id
          AND lp.jawatan = 'Penilai Pengadil'
          AND lp.status = 'Diterima'
    ");
    $stmt->execute([':id' => $lantikanId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return null; // Not a Penilai Pengadil
    }

    // Reuse an existing token so retries do not invalidate a link that has
    // already been delivered through another channel.
    $token = trim((string) ($row['penilaian_token'] ?? ''));
    if ($token === '') {
        $token = bin2hex(random_bytes(32));
        $pdo->prepare("
            UPDATE lantikan_pengadil
            SET penilaian_token = :tok
            WHERE id = :id AND status = 'Diterima'
        ")->execute([':tok' => $token, ':id' => $lantikanId]);
    }

    // Build borang link
    $baseUrl   = env('BASE_URL', 'https://refpahang.com');
    $borangUrl = $baseUrl . '/penilaian-borang.html?token=' . $token;
    $auditSnapshot = getLantikanAuditSnapshot($pdo, $lantikanId);
    if (!$auditSnapshot) {
        throw new RuntimeException('Snapshot audit RA tidak dijumpai.');
    }
    $emailDelivered = false;
    $telegramDelivered = false;
    $emailError = null;
    $telegramError = null;

    // Send email notification
    if (!empty($row['emel_penilai'])) {
        try {
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
            $subject = 'Borang Penilaian Pengadil — '
                . $row['pasukan_home'] . ' lwn ' . $row['pasukan_away'];
            $emailDelivered = $emailSender !== null
                ? (bool) $emailSender(
                    $row['emel_penilai'],
                    $subject,
                    $html,
                    $row['nama_penilai']
                )
                : sendEmail(
                    $row['emel_penilai'],
                    $subject,
                    $html,
                    $row['nama_penilai']
                );
            if (!$emailDelivered) {
                $emailError = 'Penghantar emel memulangkan status gagal.';
            }
        } catch (Throwable $e) {
            $emailDelivered = false;
            $emailError = $e->getMessage();
        }
        $emailDetails = [
            'recipient' => $row['emel_penilai'],
            'ra_form_url' => $borangUrl,
        ];
        if ($emailError !== null) {
            $emailDetails['error'] = $emailError;
        }
        recordLantikanAudit(
            $pdo,
            $lantikanId,
            'ra_form_notification',
            'email',
            $emailDelivered ? 'success' : 'failed',
            $emailDetails,
            $borangUrl,
            'system',
            null,
            $auditSnapshot
        );
    } else {
        recordLantikanAudit(
            $pdo,
            $lantikanId,
            'ra_form_notification',
            'email',
            'skipped',
            ['reason' => 'email_missing', 'ra_form_url' => $borangUrl],
            $borangUrl,
            'system',
            null,
            $auditSnapshot
        );
    }

    // Send Telegram notification
    if (!empty($row['tg_chat_id'])) {
        try {
            require_once __DIR__ . '/telegram.php';

            $tarikhFmt = date('d M Y', strtotime($row['tarikh']));
            $msg = "📋 <b>Borang Penilaian Pengadil</b>\n\n"
                 . "Anda telah menerima tugasan sebagai <b>Penilai Pengadil</b>.\n\n"
                 . "⚽ " . htmlspecialchars($row['pasukan_home'] . ' lwn ' . $row['pasukan_away']) . "\n"
                 . "📅 {$tarikhFmt}\n"
                 . "📍 " . htmlspecialchars($row['tempat'] ?? '') . "\n\n"
                 . "Sila isi borang penilaian selepas perlawanan:";
            $keyboard = [
                'inline_keyboard' => [
                    [['text' => '📋 Isi Borang Penilaian', 'url' => $borangUrl]]
                ]
            ];

            $telegramDelivered = $telegramSender !== null
                ? (bool) $telegramSender((int) $row['tg_chat_id'], $msg, $keyboard)
                : tgSend((int) $row['tg_chat_id'], $msg, $keyboard);
            if (!$telegramDelivered) {
                $telegramError = 'Penghantar Telegram memulangkan status gagal.';
            }
        } catch (Throwable $e) {
            $telegramDelivered = false;
            $telegramError = $e->getMessage();
        }
        $telegramDetails = [
            'telegram_linked' => true,
            'ra_form_url' => $borangUrl,
        ];
        if ($telegramError !== null) {
            $telegramDetails['error'] = $telegramError;
        }
        recordLantikanAudit(
            $pdo,
            $lantikanId,
            'ra_form_notification',
            'telegram',
            $telegramDelivered ? 'success' : 'failed',
            $telegramDetails,
            $borangUrl,
            'system',
            null,
            $auditSnapshot
        );
    } else {
        recordLantikanAudit(
            $pdo,
            $lantikanId,
            'ra_form_notification',
            'telegram',
            'skipped',
            ['reason' => 'telegram_not_linked', 'ra_form_url' => $borangUrl],
            $borangUrl,
            'system',
            null,
            $auditSnapshot
        );
    }

    recordLantikanAudit(
        $pdo,
        $lantikanId,
        'ra_form_dispatched',
        'combined',
        ($emailDelivered || $telegramDelivered) ? 'success' : 'failed',
        [
            'email_success' => $emailDelivered,
            'telegram_success' => $telegramDelivered,
            'email_error' => $emailError,
            'telegram_error' => $telegramError,
            'ra_form_url' => $borangUrl,
        ],
        $borangUrl,
        'system',
        null,
        $auditSnapshot
    );

    if (!$emailDelivered && !$telegramDelivered) {
        throw new RuntimeException(
            'Pautan borang RA telah disediakan tetapi gagal dihantar melalui emel dan Telegram. Gunakan pautan terus Admin.'
        );
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

/** @return array<string, int|bool|string> */
function emptyKupCrewNotificationResult(): array
{
    return [
        'complete' => false,
        'recipients' => 0,
        'crew_signature' => '',
        'telegram_sent' => 0,
        'email_sent' => 0,
        'telegram_already_sent' => 0,
        'email_already_sent' => 0,
        'pending_channels' => 0,
        'unreachable_recipients' => 0,
    ];
}

/**
 * Return the accepted KUP recipients and a stable fingerprint for this exact
 * three-or-four-person crew. The queue gives every reactivated fingerprint a
 * new delivery version, so A -> B -> A still produces an updated notification.
 *
 * @return array{fingerprint:string, roster:array<string,mixed>, recipients:array<int,array<string,mixed>>}|null
 */
function getCompleteKupCrewNotificationContext(PDO $pdo, int $jadualId): ?array
{
    if (!isAcceptedKupCrewComplete($pdo, $jadualId)) {
        return null;
    }

    $roster = getMatchKupOfficials($pdo, $jadualId);
    if (count($roster['officials']) < 3 || count($roster['officials']) > 4) {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT
            lp.id AS lantikan_id,
            lp.jawatan,
            COALESCE(NULLIF(TRIM(u.nama_penuh), ''), NULLIF(TRIM(pl.nama), ''), 'Pengadil') AS nama,
            COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(pl.emel), ''), '') AS email,
            COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
            jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
            jp.pasukan_home, jp.pasukan_away,
            COALESCE(kj.nama, '') AS kejohanan
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
        LEFT JOIN kejohanan kj ON kj.id = jp.kejohanan_id
        LEFT JOIN users u ON u.id = lp.pengadil_id
        LEFT JOIN pengadil_luar pl ON pl.id = lp.pengadil_luar_id
        WHERE lp.jadual_id = :jid
          AND lp.status = 'Diterima'
          AND lp.jawatan IN ('Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
        ORDER BY FIELD(lp.jawatan,
            'Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
    ");
    $stmt->execute([':jid' => $jadualId]);
    $recipients = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($recipients) !== count($roster['officials'])) {
        return null;
    }

    $signatureParts = [$jadualId];
    foreach ($recipients as $recipient) {
        $signatureParts[] = (string) $recipient['jawatan'] . ':' . (int) $recipient['lantikan_id'];
    }

    return [
        'fingerprint' => hash('sha256', implode('|', $signatureParts)),
        'roster' => $roster,
        'recipients' => $recipients,
    ];
}

/**
 * Persist one delivery row per KUP recipient and supersede older crew versions.
 *
 * @return array{signature:string, rows:array<int, array<string, mixed>>}
 */
function queueKupCrewNotifications(
    PDO $pdo,
    int $jadualId,
    string $fingerprint,
    array $recipients
): array {
    $ownTransaction = !$pdo->inTransaction();
    if ($ownTransaction) {
        $pdo->beginTransaction();
    }

    try {
        // Serialize queue version selection for this match. Without this lock,
        // two simultaneous final acceptances could both create and send a new
        // version before either delivery row becomes visible to the other.
        $lockStmt = $pdo->prepare('SELECT id FROM jadual_perlawanan WHERE id = :jid FOR UPDATE');
        $lockStmt->execute([':jid' => $jadualId]);
        if (!$lockStmt->fetchColumn()) {
            throw new RuntimeException('Perlawanan tidak dijumpai semasa menjadualkan notifikasi KUP.');
        }

        $versionStmt = $pdo->prepare("
            SELECT crew_signature
            FROM kup_crew_notifications
            WHERE jadual_id = :jid
              AND crew_fingerprint = :fingerprint
              AND superseded_at IS NULL
            LIMIT 1
            FOR UPDATE
        ");
        $versionStmt->execute([':jid' => $jadualId, ':fingerprint' => $fingerprint]);
        $signature = $versionStmt->fetchColumn();
        if (!is_string($signature) || $signature === '') {
            $signature = hash('sha256', $fingerprint . '|' . bin2hex(random_bytes(16)));
        }

        $pdo->prepare("
            UPDATE kup_crew_notifications
            SET superseded_at = COALESCE(superseded_at, NOW())
            WHERE jadual_id = :jid
              AND crew_signature <> :signature
              AND superseded_at IS NULL
        ")->execute([':jid' => $jadualId, ':signature' => $signature]);

        $insert = $pdo->prepare("
            INSERT INTO kup_crew_notifications
                (jadual_id, lantikan_id, crew_fingerprint, crew_signature,
                 telegram_applicable, email_applicable)
            VALUES
                (:jid, :lid, :fingerprint, :signature, :telegram_applicable, :email_applicable)
            ON DUPLICATE KEY UPDATE
                crew_fingerprint = VALUES(crew_fingerprint),
                telegram_applicable = VALUES(telegram_applicable),
                email_applicable = VALUES(email_applicable),
                superseded_at = NULL
        ");
        foreach ($recipients as $recipient) {
            $insert->execute([
                ':jid' => $jadualId,
                ':lid' => (int) $recipient['lantikan_id'],
                ':fingerprint' => $fingerprint,
                ':signature' => $signature,
                ':telegram_applicable' => !empty($recipient['telegram_chat_id']) ? 1 : 0,
                ':email_applicable' => trim((string) ($recipient['email'] ?? '')) !== '' ? 1 : 0,
            ]);
        }

        $pdo->prepare("
            UPDATE kup_crew_notifications
            SET completed_at = CASE
                    WHEN (telegram_applicable = 0 OR telegram_sent_at IS NOT NULL)
                     AND (email_applicable = 0 OR email_sent_at IS NOT NULL)
                    THEN COALESCE(completed_at, NOW())
                    ELSE NULL
                END
            WHERE jadual_id = :jid
              AND crew_signature = :signature
              AND superseded_at IS NULL
        ")->execute([':jid' => $jadualId, ':signature' => $signature]);

        $select = $pdo->prepare("
            SELECT *
            FROM kup_crew_notifications
            WHERE jadual_id = :jid
              AND crew_signature = :signature
              AND superseded_at IS NULL
        ");
        $select->execute([':jid' => $jadualId, ':signature' => $signature]);
        $rows = [];
        foreach ($select->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $rows[(int) $row['lantikan_id']] = $row;
        }

        if ($ownTransaction) {
            $pdo->commit();
        }
        return ['signature' => $signature, 'rows' => $rows];
    } catch (Throwable $error) {
        if ($ownTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

/** Claim one unsent channel for five minutes to prevent concurrent duplicates. */
function claimKupCrewNotificationChannel(PDO $pdo, int $notificationId, string $channel): ?int
{
    if (!in_array($channel, ['telegram', 'email'], true)) {
        throw new InvalidArgumentException('Saluran notifikasi KUP tidak sah.');
    }

    $applicable = $channel . '_applicable';
    $sentAt = $channel . '_sent_at';
    $claimedAt = $channel . '_claimed_at';
    $nextAttemptAt = $channel . '_next_attempt_at';
    $attempts = $channel . '_attempts';

    $stmt = $pdo->prepare("
        UPDATE kup_crew_notifications
        SET {$claimedAt} = NOW(), {$attempts} = {$attempts} + 1
        WHERE id = :id
          AND {$applicable} = 1
          AND {$sentAt} IS NULL
          AND superseded_at IS NULL
          AND ({$nextAttemptAt} IS NULL OR {$nextAttemptAt} <= NOW())
          AND ({$claimedAt} IS NULL OR {$claimedAt} < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
    ");
    $stmt->execute([':id' => $notificationId]);
    if ($stmt->rowCount() !== 1) {
        return null;
    }

    $attemptStmt = $pdo->prepare("SELECT {$attempts} FROM kup_crew_notifications WHERE id = :id");
    $attemptStmt->execute([':id' => $notificationId]);
    return (int) $attemptStmt->fetchColumn();
}

function finishKupCrewNotificationChannel(
    PDO $pdo,
    int $notificationId,
    string $channel,
    bool $success,
    int $attempt,
    string $errorMessage = ''
): void {
    if (!in_array($channel, ['telegram', 'email'], true)) {
        throw new InvalidArgumentException('Saluran notifikasi KUP tidak sah.');
    }

    $sentAt = $channel . '_sent_at';
    $claimedAt = $channel . '_claimed_at';
    $nextAttemptAt = $channel . '_next_attempt_at';
    $lastError = $channel . '_last_error';

    if ($success) {
        $stmt = $pdo->prepare("
            UPDATE kup_crew_notifications
            SET {$sentAt} = COALESCE({$sentAt}, NOW()),
                {$claimedAt} = NULL,
                {$nextAttemptAt} = NULL,
                {$lastError} = NULL
            WHERE id = :id AND superseded_at IS NULL
        ");
        $stmt->execute([':id' => $notificationId]);
    } else {
        $retrySeconds = min(3600, 60 * (2 ** max(0, min($attempt - 1, 6))));
        $stmt = $pdo->prepare("
            UPDATE kup_crew_notifications
            SET {$claimedAt} = NULL,
                {$nextAttemptAt} = DATE_ADD(NOW(), INTERVAL {$retrySeconds} SECOND),
                {$lastError} = :error
            WHERE id = :id AND {$sentAt} IS NULL AND superseded_at IS NULL
        ");
        $stmt->execute([
            ':error' => mb_substr($errorMessage !== '' ? $errorMessage : 'Penghantaran gagal.', 0, 500),
            ':id' => $notificationId,
        ]);
    }

    $pdo->prepare("
        UPDATE kup_crew_notifications
        SET completed_at = CASE
                WHEN (telegram_applicable = 0 OR telegram_sent_at IS NOT NULL)
                 AND (email_applicable = 0 OR email_sent_at IS NOT NULL)
                THEN COALESCE(completed_at, NOW())
                ELSE NULL
            END
        WHERE id = :id AND superseded_at IS NULL
    ")->execute([':id' => $notificationId]);
}

/** @return array{pending_channels:int, unreachable_recipients:int, telegram_already_sent:int, email_already_sent:int} */
function getKupCrewNotificationDeliverySummary(
    PDO $pdo,
    int $jadualId,
    string $signature
): array {
    $stmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(
                (telegram_applicable = 1 AND telegram_sent_at IS NULL)
              + (email_applicable = 1 AND email_sent_at IS NULL)
            ), 0) AS pending_channels,
            COALESCE(SUM(telegram_applicable = 0 AND email_applicable = 0), 0) AS unreachable_recipients,
            COALESCE(SUM(telegram_sent_at IS NOT NULL), 0) AS telegram_already_sent,
            COALESCE(SUM(email_sent_at IS NOT NULL), 0) AS email_already_sent
        FROM kup_crew_notifications
        WHERE jadual_id = :jid
          AND crew_signature = :signature
          AND superseded_at IS NULL
    ");
    $stmt->execute([':jid' => $jadualId, ':signature' => $signature]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'pending_channels' => (int) ($row['pending_channels'] ?? 0),
        'unreachable_recipients' => (int) ($row['unreachable_recipients'] ?? 0),
        'telegram_already_sent' => (int) ($row['telegram_already_sent'] ?? 0),
        'email_already_sent' => (int) ($row['email_already_sent'] ?? 0),
    ];
}

/**
 * Notify every accepted KUP after all appointed KUP accept.
 *
 * Each crew version and recipient/channel is persisted. Successful channels
 * are never sent again; failed channels are retried with exponential backoff.
 * Optional sender callbacks are provided for deterministic integration tests.
 *
 * @return array<string, int|bool|string>
 */
function notifyCompleteKupCrew(
    PDO $pdo,
    int $jadualId,
    ?callable $telegramSender = null,
    ?callable $emailSender = null
): array {
    $result = emptyKupCrewNotificationResult();
    $context = getCompleteKupCrewNotificationContext($pdo, $jadualId);
    if ($context === null) {
        return $result;
    }

    if ($telegramSender === null) {
        require_once __DIR__ . '/telegram.php';
        $telegramSender = static function (array $recipient, array $roster, string $regionLabel): bool {
            $message = tgKupCrewCompleteMessage(
                (string) $recipient['nama'],
                (string) $recipient['kejohanan'],
                (string) $recipient['tarikh'],
                (string) ($recipient['masa'] ?? ''),
                (string) ($recipient['tempat'] ?? ''),
                (string) ($recipient['pasukan_home'] ?? ''),
                (string) ($recipient['pasukan_away'] ?? ''),
                (string) ($recipient['no_perlawanan'] ?? ''),
                $roster,
                $regionLabel
            );
            return tgSend((int) $recipient['telegram_chat_id'], $message);
        };
    }
    if ($emailSender === null) {
        require_once __DIR__ . '/email.php';
        $emailSender = static function (array $recipient, array $roster, string $regionLabel): bool {
            return sendKupCrewCompleteEmail(
                (string) $recipient['email'],
                (string) $recipient['nama'],
                (string) $recipient['jawatan'],
                (string) $recipient['kejohanan'],
                (string) $recipient['tarikh'],
                (string) ($recipient['masa'] ?? ''),
                (string) ($recipient['tempat'] ?? ''),
                (string) ($recipient['pasukan_home'] ?? ''),
                (string) ($recipient['pasukan_away'] ?? ''),
                (string) ($recipient['no_perlawanan'] ?? ''),
                $roster,
                $regionLabel
            );
        };
    }

    $queued = queueKupCrewNotifications(
        $pdo,
        $jadualId,
        $context['fingerprint'],
        $context['recipients']
    );
    $signature = $queued['signature'];
    $deliveryRows = $queued['rows'];
    $result['complete'] = true;
    $result['recipients'] = count($context['recipients']);
    $result['crew_signature'] = $signature;

    foreach ($context['recipients'] as $recipient) {
        $lantikanId = (int) $recipient['lantikan_id'];
        $delivery = $deliveryRows[$lantikanId] ?? null;
        if (!$delivery) {
            continue;
        }

        if (!empty($delivery['telegram_applicable']) && empty($delivery['telegram_sent_at'])) {
            $attempt = claimKupCrewNotificationChannel($pdo, (int) $delivery['id'], 'telegram');
            if ($attempt !== null) {
                $success = false;
                $errorMessage = '';
                try {
                    $success = (bool) $telegramSender(
                        $recipient,
                        $context['roster']['officials'],
                        $context['roster']['region_label']
                    );
                    if (!$success) {
                        $errorMessage = 'Telegram API tidak mengesahkan penghantaran.';
                    }
                } catch (Throwable $telegramError) {
                    $errorMessage = $telegramError->getMessage();
                    error_log('[KUP crew notification] Telegram failed for jadual '
                        . $jadualId . ': ' . $errorMessage);
                }
                finishKupCrewNotificationChannel(
                    $pdo,
                    (int) $delivery['id'],
                    'telegram',
                    $success,
                    $attempt,
                    $errorMessage
                );
                if ($success) {
                    $result['telegram_sent']++;
                }
            }
        }

        if (!empty($delivery['email_applicable']) && empty($delivery['email_sent_at'])) {
            $attempt = claimKupCrewNotificationChannel($pdo, (int) $delivery['id'], 'email');
            if ($attempt !== null) {
                $success = false;
                $errorMessage = '';
                try {
                    $success = (bool) $emailSender(
                        $recipient,
                        $context['roster']['officials'],
                        $context['roster']['region_label']
                    );
                    if (!$success) {
                        $errorMessage = 'SMTP tidak mengesahkan penghantaran.';
                    }
                } catch (Throwable $emailError) {
                    $errorMessage = $emailError->getMessage();
                    error_log('[KUP crew notification] Email failed for jadual '
                        . $jadualId . ': ' . $errorMessage);
                }
                finishKupCrewNotificationChannel(
                    $pdo,
                    (int) $delivery['id'],
                    'email',
                    $success,
                    $attempt,
                    $errorMessage
                );
                if ($success) {
                    $result['email_sent']++;
                }
            }
        }
    }

    $summary = getKupCrewNotificationDeliverySummary($pdo, $jadualId, $signature);
    $result['pending_channels'] = $summary['pending_channels'];
    $result['unreachable_recipients'] = $summary['unreachable_recipients'];
    $result['telegram_already_sent'] = $summary['telegram_already_sent'];
    $result['email_already_sent'] = $summary['email_already_sent'];
    return $result;
}

/** Retry only an already-queued crew version; never notify historical crews implicitly. */
function retryPendingKupCrewNotifications(PDO $pdo, int $jadualId): array
{
    $result = emptyKupCrewNotificationResult();
    $context = getCompleteKupCrewNotificationContext($pdo, $jadualId);
    if ($context === null) {
        $pdo->prepare("
            UPDATE kup_crew_notifications
            SET superseded_at = COALESCE(superseded_at, NOW())
            WHERE jadual_id = :jid
              AND completed_at IS NULL
              AND superseded_at IS NULL
        ")->execute([':jid' => $jadualId]);
        return $result;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM kup_crew_notifications
        WHERE jadual_id = :jid
          AND crew_fingerprint = :fingerprint
          AND superseded_at IS NULL
          AND completed_at IS NULL
    ");
    $stmt->execute([':jid' => $jadualId, ':fingerprint' => $context['fingerprint']]);
    if ((int) $stmt->fetchColumn() === 0) {
        return $result;
    }

    return notifyCompleteKupCrew($pdo, $jadualId);
}

/** Process queued retries from CLI/cron without creating historical queues. */
function processQueuedKupCrewNotifications(PDO $pdo, int $limit = 100): array
{
    $limit = max(1, min($limit, 500));
    $stmt = $pdo->query("
        SELECT DISTINCT jadual_id
        FROM kup_crew_notifications
        WHERE completed_at IS NULL
          AND superseded_at IS NULL
          AND (
                (telegram_applicable = 1 AND telegram_sent_at IS NULL
                 AND (telegram_next_attempt_at IS NULL OR telegram_next_attempt_at <= NOW())
                 AND (telegram_claimed_at IS NULL OR telegram_claimed_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)))
             OR (email_applicable = 1 AND email_sent_at IS NULL
                 AND (email_next_attempt_at IS NULL OR email_next_attempt_at <= NOW())
                 AND (email_claimed_at IS NULL OR email_claimed_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)))
          )
        ORDER BY jadual_id
        LIMIT {$limit}
    ");
    $jadualIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

    $summary = [
        'matches_processed' => 0,
        'telegram_sent' => 0,
        'email_sent' => 0,
        'pending_channels' => 0,
        'errors' => 0,
    ];
    foreach ($jadualIds as $jadualId) {
        try {
            $result = retryPendingKupCrewNotifications($pdo, $jadualId);
            $summary['matches_processed']++;
            $summary['telegram_sent'] += (int) $result['telegram_sent'];
            $summary['email_sent'] += (int) $result['email_sent'];
            $summary['pending_channels'] += (int) $result['pending_channels'];
        } catch (Throwable $error) {
            $summary['errors']++;
            error_log('[KUP crew retry] jadual ' . $jadualId . ': ' . $error->getMessage());
        }
    }

    return $summary;
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
