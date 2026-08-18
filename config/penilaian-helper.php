<?php

declare(strict_types=1);

/**
 * Create a purpose-bound read-only token for one confirmed RA report.
 *
 * The RA form token remains the secret HMAC key and is never exposed to KUP.
 * A report-view token cannot be reused to open or submit the RA form.
 */
function createReportViewToken(int $laporanId, string $penilaianToken): string
{
    if ($laporanId <= 0 || trim($penilaianToken) === '') {
        return '';
    }

    return hash_hmac('sha256', 'laporan-penilaian:view:' . $laporanId, $penilaianToken);
}

function verifyReportViewToken(int $laporanId, string $penilaianToken, string $viewToken): bool
{
    if ($viewToken === '') {
        return false;
    }

    $expected = createReportViewToken($laporanId, $penilaianToken);
    return $expected !== '' && hash_equals($expected, $viewToken);
}

/**
 * Return only KUP who accepted the named match. RA is never part of this list.
 *
 * @return array<int, array{lantikan_pengadil_id:int, jawatan:string, nama_pengadil:string}>
 */
function getAcceptedKupForAssessment(PDO $pdo, int $jadualId): array
{
    $stmt = $pdo->prepare("
        SELECT lp.id AS lantikan_pengadil_id,
               lp.jawatan,
               COALESCE(
                   NULLIF(TRIM(u.nama_penuh), ''),
                   NULLIF(TRIM(pl.nama), ''),
                   'Nama tidak direkodkan'
               ) AS nama_pengadil
        FROM lantikan_pengadil lp
        LEFT JOIN users u ON u.id = lp.pengadil_id
        LEFT JOIN pengadil_luar pl ON pl.id = lp.pengadil_luar_id
        WHERE lp.jadual_id = :jid
          AND lp.status = 'Diterima'
          AND lp.jawatan IN (
              'Pengadil',
              'Penolong Pengadil 1',
              'Penolong Pengadil 2',
              'Pegawai ke4'
          )
        ORDER BY FIELD(
            lp.jawatan,
            'Pengadil',
            'Penolong Pengadil 1',
            'Penolong Pengadil 2',
            'Pegawai ke4'
        )
    ");
    $stmt->execute([':jid' => $jadualId]);

    return array_map(static fn(array $row): array => [
        'lantikan_pengadil_id' => (int) $row['lantikan_pengadil_id'],
        'jawatan' => (string) $row['jawatan'],
        'nama_pengadil' => (string) $row['nama_pengadil'],
    ], $stmt->fetchAll(PDO::FETCH_ASSOC));
}

/** The minimum valid KUP crew is R, AR1 and AR2. P4 is optional. */
function hasRequiredKupPositions(array $officials): bool
{
    $roles = array_fill_keys(array_column($officials, 'jawatan'), true);
    foreach (['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2'] as $requiredRole) {
        if (!isset($roles[$requiredRole])) {
            return false;
        }
    }

    return count($officials) >= 3 && count($officials) <= 4;
}

/**
 * Validate the client payload against the accepted KUP stored for the match.
 * Identity, name and role always come from the database; only assessment fields
 * are accepted from the client.
 */
function normalizeSubmittedKupAssessments(PDO $pdo, int $jadualId, array $submitted): array
{
    $officials = getAcceptedKupForAssessment($pdo, $jadualId);
    if (!hasRequiredKupPositions($officials)) {
        throw new InvalidArgumentException(
            'Laporan memerlukan sekurang-kurangnya Pengadil, Penolong Pengadil 1 dan Penolong Pengadil 2 yang telah menerima lantikan.'
        );
    }

    $submittedById = [];
    foreach ($submitted as $entry) {
        if (!is_array($entry)) {
            throw new InvalidArgumentException('Format senarai pegawai tidak sah.');
        }
        $lantikanId = (int) ($entry['lantikan_pengadil_id'] ?? 0);
        if ($lantikanId <= 0 || isset($submittedById[$lantikanId])) {
            throw new InvalidArgumentException('Senarai pegawai mengandungi lantikan tidak sah atau berulang.');
        }
        $submittedById[$lantikanId] = $entry;
    }

    if (count($submittedById) !== count($officials)) {
        throw new InvalidArgumentException('Semua KUP yang menerima lantikan mesti dinilai tepat sekali.');
    }

    $normalized = [];
    foreach ($officials as $official) {
        $lantikanId = $official['lantikan_pengadil_id'];
        if (!isset($submittedById[$lantikanId])) {
            throw new InvalidArgumentException('Senarai pegawai tidak sepadan dengan lantikan KUP perlawanan.');
        }

        $entry = $submittedById[$lantikanId];
        $entry['lantikan_pengadil_id'] = $lantikanId;
        $entry['jawatan'] = $official['jawatan'];
        $entry['nama_pengadil'] = $official['nama_pengadil'];
        $normalized[] = $entry;
    }

    return $normalized;
}

function userOwnsAcceptedRaAppointment(PDO $pdo, int $userId, int $lantikanId, int $jadualId): bool
{
    $stmt = $pdo->prepare("
        SELECT 1
        FROM lantikan_pengadil
        WHERE id = :lid
          AND jadual_id = :jid
          AND pengadil_id = :uid
          AND jawatan = 'Penilai Pengadil'
          AND status = 'Diterima'
        LIMIT 1
    ");
    $stmt->execute([
        ':lid' => $lantikanId,
        ':jid' => $jadualId,
        ':uid' => $userId,
    ]);

    return (bool) $stmt->fetchColumn();
}

function userHasAcceptedRaForMatch(PDO $pdo, int $userId, int $jadualId): bool
{
    $stmt = $pdo->prepare("
        SELECT 1
        FROM lantikan_pengadil
        WHERE jadual_id = :jid
          AND pengadil_id = :uid
          AND jawatan = 'Penilai Pengadil'
          AND status = 'Diterima'
        LIMIT 1
    ");
    $stmt->execute([':jid' => $jadualId, ':uid' => $userId]);

    return (bool) $stmt->fetchColumn();
}
