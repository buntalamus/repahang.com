<?php
/**
 * Shared helper: auto-create perlawanan record when lantikan is accepted.
 *
 * Called from:
 *   - api/lantikan-jawab-token.php  (email accept)
 *   - api/telegram-webhook.php      (Telegram accept)
 *   - api/lantikan-jawab.php        (dashboard accept)
 */

declare(strict_types=1);

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
            case 'Pengadil Utama':      $crew['head_referee_id']        = (int) $c['pengadil_id']; break;
            case 'Pembantu Pengadil 1': $crew['assistant_referee_1_id'] = (int) $c['pengadil_id']; break;
            case 'Pembantu Pengadil 2': $crew['assistant_referee_2_id'] = (int) $c['pengadil_id']; break;
            case 'Pengadil Keempat':    $crew['fourth_official_id']     = (int) $c['pengadil_id']; break;
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
