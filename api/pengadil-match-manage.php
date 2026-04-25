<?php

/**

 * Add/Edit/Delete Match API

 * Manage match records for pengadil

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/../config/email.php';



// Require Pengadil role

$currentUser = requireRole(['Pengadil']);

$userId = (int) $currentUser['id'];



if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
}

// Get JSON input

$input = getJsonInput();

$action = $input['action'] ?? '';



try {

    $pdo = getDbConnection();



    if ($action === 'add') {

        // Validate required fields
        $required = ['tarikh', 'jenis', 'tempat', 'home_team', 'away_team'];

        foreach ($required as $field) {

            if (empty($input[$field])) {

                jsonResponse(['error' => true, 'message' => "Field '$field' diperlukan."], 400);

            }

        }

        // 14 Days Rule Validation
        $matchDate = new DateTime($input['tarikh']);
        $today = new DateTime();
        $diff = $today->diff($matchDate);

        if ($matchDate < $today && $diff->days > 14) {
            jsonResponse(['error' => true, 'message' => "Rekod perlawanan tidak boleh dihantar melebihi 14 hari dari tarikh perlawanan."], 400);
        }

        // Check if this is a grouped submission (v3 — always grouped)
        $officials = $input['officials'] ?? [];
        $isGrouped = !empty($officials) && is_array($officials);

        if (!$isGrouped) {
            // v3: officials array is required for all submissions
            jsonResponse(['error' => true, 'message' => 'Sila pilih pegawai perlawanan.'], 400);
        }
            // --- GROUPED PERSAHABATAN FLOW ---
            // Validate we have at least 1 official
            if (count($officials) < 1 || count($officials) > 5) {
                jsonResponse(['error' => true, 'message' => 'Bilangan pegawai mestilah antara 1 hingga 5.'], 400);
            }

            // Validate daerah_perlawanan_id
            $daerahId = !empty($input['daerah_perlawanan_id']) ? (int) $input['daerah_perlawanan_id'] : null;
            if (!$daerahId) {
                jsonResponse(['error' => true, 'message' => 'Sila pilih daerah perlawanan.'], 400);
            }

            // Validate each official has user_id and jawatan
            $usedJawatan = [];
            foreach ($officials as $i => $off) {
                if (empty($off['user_id']) || empty($off['jawatan'])) {
                    jsonResponse(['error' => true, 'message' => "Pegawai #" . ($i + 1) . ": Sila pilih pengadil dan jawatan."], 400);
                }
                if (in_array($off['jawatan'], $usedJawatan, true)) {
                    jsonResponse(['error' => true, 'message' => "Jawatan '" . $off['jawatan'] . "' telah digunakan. Setiap jawatan hanya boleh diberikan kepada seorang pegawai."], 400);
                }
                $usedJawatan[] = $off['jawatan'];
            }

            // Generate match_group_id (UUID v4)
            $matchGroupId = sprintf(
                '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                random_int(0, 0xffff), random_int(0, 0xffff),
                random_int(0, 0xffff),
                random_int(0, 0x0fff) | 0x4000,
                random_int(0, 0x3fff) | 0x8000,
                random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0xffff)
            );

            $pdo->beginTransaction();

            $insertStmt = $pdo->prepare("
                INSERT INTO perlawanan (
                    match_group_id, user_id, submitted_by, tarikh, masa, jenis, nama_kejohanan,
                    tempat, jawatan, home_team, away_team, daerah_perlawanan_id,
                    skor_ht_home, skor_ht_away, skor_ft_home, skor_ft_away,
                    skor_et_home, skor_et_away, skor_ps_home, skor_ps_away, cuaca,
                    created_at
                ) VALUES (
                    :match_group_id, :user_id, :submitted_by, :tarikh, :masa, :jenis, :nama_kejohanan,
                    :tempat, :jawatan, :home_team, :away_team, :daerah_perlawanan_id,
                    :skor_ht_home, :skor_ht_away, :skor_ft_home, :skor_ft_away,
                    :skor_et_home, :skor_et_away, :skor_ps_home, :skor_ps_away, :cuaca,
                    NOW()
                )
            ");

            // Parse optional score values
            $skorFields = ['skor_ht_home','skor_ht_away','skor_ft_home','skor_ft_away','skor_et_home','skor_et_away','skor_ps_home','skor_ps_away'];
            $skorValues = [];
            foreach ($skorFields as $sf) {
                $skorValues[$sf] = isset($input[$sf]) && $input[$sf] !== '' && $input[$sf] !== null ? (int) $input[$sf] : null;
            }

            $insertedIds = [];
            $officialUserIds = [];

            foreach ($officials as $off) {
                $offUserId = (int) $off['user_id'];
                $insertStmt->execute([
                    ':match_group_id' => $matchGroupId,
                    ':user_id' => $offUserId,
                    ':submitted_by' => $userId,
                    ':tarikh' => $input['tarikh'],
                    ':masa' => !empty($input['masa']) ? $input['masa'] : null,
                    ':jenis' => !empty($input['jenis']) ? $input['jenis'] : null,
                    ':nama_kejohanan' => !empty($input['nama_kejohanan']) ? $input['nama_kejohanan'] : null,
                    ':tempat' => $input['tempat'],
                    ':jawatan' => $off['jawatan'],
                    ':home_team' => $input['home_team'],
                    ':away_team' => $input['away_team'],
                    ':daerah_perlawanan_id' => $daerahId,
                    ':skor_ht_home' => $skorValues['skor_ht_home'],
                    ':skor_ht_away' => $skorValues['skor_ht_away'],
                    ':skor_ft_home' => $skorValues['skor_ft_home'],
                    ':skor_ft_away' => $skorValues['skor_ft_away'],
                    ':skor_et_home' => $skorValues['skor_et_home'],
                    ':skor_et_away' => $skorValues['skor_et_away'],
                    ':skor_ps_home' => $skorValues['skor_ps_home'],
                    ':skor_ps_away' => $skorValues['skor_ps_away'],
                    ':cuaca' => !empty($input['cuaca']) ? $input['cuaca'] : null,
                ]);
                $insertedIds[] = (int) $pdo->lastInsertId();
                $officialUserIds[] = $offUserId;
            }

            $pdo->commit();

            // Get submitter name and resolve official names for email
            $userStmt = $pdo->prepare("SELECT nama_penuh FROM users WHERE id = :id");
            $userStmt->execute([':id' => $userId]);
            $submitterName = $userStmt->fetchColumn() ?: 'Pengadil';

            // Fetch names for all officials to enrich email template
            $officialIds = array_map(fn($o) => (int) $o['user_id'], $officials);
            $placeholders = implode(',', array_fill(0, count($officialIds), '?'));
            $nameStmt = $pdo->prepare("SELECT id, nama_penuh FROM users WHERE id IN ($placeholders)");
            $nameStmt->execute($officialIds);
            $officialNames = [];
            foreach ($nameStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $officialNames[(int) $row['id']] = $row['nama_penuh'];
            }
            $officialsWithNames = array_map(function ($o) use ($officialNames) {
                $o['nama'] = $officialNames[(int) $o['user_id']] ?? ('Pengadil #' . $o['user_id']);
                return $o;
            }, $officials);

            // Send notifications to PP Daerah of the MATCH DISTRICT (not pengadil's district)
            $ppStmt = $pdo->prepare("
                SELECT u.id, u.nama_penuh, u.email 
                FROM users u 
                INNER JOIN persatuan_bolasepak_daerah p ON u.persatuan_id = p.id
                INNER JOIN districts d ON p.daerah = d.nama
                WHERE u.role = 'PP Daerah' AND d.id = :daerah_id
            ");
            $ppStmt->execute([':daerah_id' => $daerahId]);
            $ppUsers = $ppStmt->fetchAll(PDO::FETCH_ASSOC);

            // Get daerah name for notification
            $daerahStmt = $pdo->prepare("SELECT nama FROM districts WHERE id = :id");
            $daerahStmt->execute([':id' => $daerahId]);
            $daerahName = $daerahStmt->fetchColumn() ?: '';

            foreach ($ppUsers as $ppUser) {
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications (user_id, type, subject, message, created_at) 
                    VALUES (:user_id, 'Perlawanan Baru', :subject, :message, NOW())
                ");
                $notifStmt->execute([
                    ':user_id' => $ppUser['id'],
                    ':subject' => 'Perlawanan Baru Untuk Pengesahan',
                    ':message' => sprintf(
                        '%s telah merekod perlawanan %s vs %s pada %s di %s (%s). %d pegawai perlawanan. Sila semak dan sahkan.',
                        $submitterName,
                        $input['home_team'],
                        $input['away_team'],
                        date('d/m/Y', strtotime($input['tarikh'])),
                        $input['tempat'],
                        $daerahName,
                        count($officials)
                    )
                ]);

                $emailSubject = '🔔 Perlawanan Baru — Pengesahan Diperlukan';
                $emailBody = getNewGroupMatchEmailTemplate(
                    $ppUser['nama_penuh'],
                    $submitterName,
                    $input,
                    $officialsWithNames,
                    $daerahName
                );
                sendEmail($ppUser['email'], $emailSubject, $emailBody, null, 'pengesahan');
            }

            // Notify all officials (except the submitter)
            foreach ($officials as $off) {
                $offUserId = (int) $off['user_id'];
                if ($offUserId === $userId) continue;

                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications (user_id, type, subject, message, created_at) 
                    VALUES (:user_id, 'Rekod Perlawanan', :subject, :message, NOW())
                ");
                $notifStmt->execute([
                    ':user_id' => $offUserId,
                    ':subject' => 'Rekod Perlawanan Baru Dimasukkan',
                    ':message' => sprintf(
                        '%s telah merekodkan anda sebagai %s dalam perlawanan %s vs %s pada %s di %s.',
                        $submitterName,
                        $off['jawatan'],
                        $input['home_team'],
                        $input['away_team'],
                        date('d/m/Y', strtotime($input['tarikh'])),
                        $input['tempat']
                    )
                ]);
            }

            jsonResponse([
                'error' => false,
                'message' => 'Rekod perlawanan berjaya ditambah untuk ' . count($officials) . ' pegawai.',
                'match_group_id' => $matchGroupId,
                'match_ids' => $insertedIds
            ]);



    } elseif ($action === 'edit') {

        // Validate match ID

        if (empty($input['match_id'])) {

            jsonResponse(['error' => true, 'message' => 'ID perlawanan diperlukan.'], 400);

        }



        $matchId = (int) $input['match_id'];



        // Verify ownership

        $checkStmt = $pdo->prepare('SELECT id FROM perlawanan WHERE id = :id AND user_id = :user_id LIMIT 1');

        $checkStmt->execute([':id' => $matchId, ':user_id' => $userId]);



        if (!$checkStmt->fetch()) {

            jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai atau anda tidak mempunyai akses.'], 403);

        }

        // 14 Days Rule Validation for Edit as well (optional, but good practice to prevent backtracking dates)
        if (isset($input['tarikh'])) {
            $matchDate = new DateTime($input['tarikh']);
            $today = new DateTime();
            $diff = $today->diff($matchDate);

            if ($matchDate < $today && $diff->days > 14) {
                jsonResponse(['error' => true, 'message' => "Rekod perlawanan tidak boleh dikemaskini kepada tarikh melebihi 14 hari yang lalu."], 400);
            }
        }



        // Build update query

        $updateFields = [];

        $params = [':id' => $matchId, ':user_id' => $userId];



        if (isset($input['tarikh'])) {

            $updateFields[] = 'tarikh = :tarikh';

            $params[':tarikh'] = $input['tarikh'];

        }

        if (isset($input['jenis'])) {

            $updateFields[] = 'jenis = :jenis';

            $params[':jenis'] = $input['jenis'];

        }

        if (isset($input['tempat'])) {

            $updateFields[] = 'tempat = :tempat';

            $params[':tempat'] = $input['tempat'];

        }

        if (isset($input['jawatan'])) {

            $updateFields[] = 'jawatan = :jawatan';

            $params[':jawatan'] = $input['jawatan'];

        }

        if (isset($input['home_team'])) {
            $updateFields[] = 'home_team = :home_team';
            $params[':home_team'] = $input['home_team'];
        }

        if (isset($input['away_team'])) {
            $updateFields[] = 'away_team = :away_team';
            $params[':away_team'] = $input['away_team'];
        }

        // Score fields
        $editSkorFields = ['skor_ht_home','skor_ht_away','skor_ft_home','skor_ft_away','skor_et_home','skor_et_away','skor_ps_home','skor_ps_away'];
        foreach ($editSkorFields as $sf) {
            if (array_key_exists($sf, $input)) {
                $updateFields[] = "$sf = :$sf";
                $params[":$sf"] = ($input[$sf] !== '' && $input[$sf] !== null) ? (int) $input[$sf] : null;
            }
        }

        if (array_key_exists('cuaca', $input)) {
            $updateFields[] = 'cuaca = :cuaca';
            $params[':cuaca'] = !empty($input['cuaca']) ? $input['cuaca'] : null;
        }

        if (isset($input['daerah_perlawanan_id'])) {
            $updateFields[] = 'daerah_perlawanan_id = :daerah_perlawanan_id';
            $params[':daerah_perlawanan_id'] = !empty($input['daerah_perlawanan_id']) ? (int) $input['daerah_perlawanan_id'] : null;
        }



        if (empty($updateFields)) {

            jsonResponse(['error' => true, 'message' => 'Tiada perubahan untuk dikemaskini.'], 400);

        }



        $sql = "UPDATE perlawanan SET " . implode(', ', $updateFields) . " WHERE id = :id AND user_id = :user_id";

        $stmt = $pdo->prepare($sql);

        $stmt->execute($params);



        jsonResponse([

            'error' => false,

            'message' => 'Rekod perlawanan berjaya dikemaskini.'

        ]);



    } elseif ($action === 'delete') {

        // Validate match ID

        if (empty($input['match_id'])) {

            jsonResponse(['error' => true, 'message' => 'ID perlawanan diperlukan.'], 400);

        }



        $matchId = (int) $input['match_id'];

        // Prevent deletion of system-created records (from lantikan)
        $chkStmt = $pdo->prepare('SELECT lantikan_id FROM perlawanan WHERE id = :id AND user_id = :uid');
        $chkStmt->execute([':id' => $matchId, ':uid' => $userId]);
        $chkRow = $chkStmt->fetch(PDO::FETCH_ASSOC);
        if ($chkRow && !empty($chkRow['lantikan_id'])) {
            jsonResponse(['error' => true, 'message' => 'Rekod lantikan rasmi tidak boleh dipadam.'], 403);
        }

        // Delete match (only if owned by user)

        $stmt = $pdo->prepare('DELETE FROM perlawanan WHERE id = :id AND user_id = :user_id');

        $stmt->execute([':id' => $matchId, ':user_id' => $userId]);



        if ($stmt->rowCount() === 0) {

            jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai atau anda tidak mempunyai akses.'], 403);

        }



        jsonResponse([

            'error' => false,

            'message' => 'Rekod perlawanan berjaya dipadam.'

        ]);



    } else {

        jsonResponse(['error' => true, 'message' => 'Action tidak sah. Gunakan: add, edit, atau delete.'], 400);

    }



} catch (Throwable $e) {

    error_log('[pengadil-match-manage.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

    error_log('[pengadil-match-manage.php] Stack trace: ' . $e->getTraceAsString());

    $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to manage match.';

    jsonResponse(['error' => true, 'message' => $message], 500);

}



/**

 * Email template for new match notification to PP Daerah

 */

function getNewMatchEmailTemplate($ppName, $pengadilName, $tarikh, $jenis, $tempat, $jawatan)
{
    require_once __DIR__ . '/../config/email.php';

    $tarikhFormatted = date('d M Y', strtotime($tarikh));

    $body  = emailGreeting($ppName);
    $body .= emailPara('Pengadil <strong>' . htmlspecialchars($pengadilName) . '</strong> telah menambah rekod perlawanan baru yang memerlukan <strong>pengesahan anda</strong>. Sila semak butiran di bawah:');
    $body .= emailInfoTable([
        ['Nama Pengadil',   htmlspecialchars($pengadilName)],
        ['Tarikh Perlawanan', $tarikhFormatted],
        ['Jenis Perlawanan', htmlspecialchars($jenis)],
        ['Tempat',          htmlspecialchars($tempat)],
        ['Jawatan',         htmlspecialchars($jawatan)],
    ]);
    $body .= emailAlert('#2563EB', '#EFF6FF', 'Tindakan Diperlukan', 'Sila log masuk ke sistem dan <strong>sahkan atau tolak</strong> rekod perlawanan ini dalam masa yang sewajarnya.');
    $body .= emailButton(env('BASE_URL') . '/pp-daerah', 'Sahkan Perlawanan');

    return buildEmailTemplate('Rekod Perlawanan Baru - Pengesahan Diperlukan', '#2563EB', '', $body);
}

/**
 * Email template for grouped persahabatan match notification to PP Daerah
 */
function getNewGroupMatchEmailTemplate($ppName, $submitterName, $matchData, $officials, $daerahName)
{
    require_once __DIR__ . '/../config/email.php';

    $tarikhFormatted = date('d M Y', strtotime($matchData['tarikh']));
    $masa = !empty($matchData['masa']) ? $matchData['masa'] : '-';

    $body  = emailGreeting($ppName);
    $body .= emailPara('<strong>' . htmlspecialchars($submitterName) . '</strong> telah merekod perlawanan persahabatan yang memerlukan <strong>pengesahan anda</strong>:');
    $body .= emailInfoTable([
        ['Perlawanan',       htmlspecialchars($matchData['home_team']) . ' vs ' . htmlspecialchars($matchData['away_team'])],
        ['Tarikh',           $tarikhFormatted],
        ['Masa',             htmlspecialchars($masa)],
        ['Jenis',            htmlspecialchars($matchData['jenis'])],
        ['Kejohanan',        htmlspecialchars($matchData['nama_kejohanan'] ?? '-')],
        ['Tempat',           htmlspecialchars($matchData['tempat'])],
        ['Daerah',           htmlspecialchars($daerahName)],
    ]);

    // Officials list
    $officialRows = [];
    foreach ($officials as $off) {
        $officialRows[] = [htmlspecialchars($off['jawatan']), htmlspecialchars($off['nama'] ?? 'Pengadil #' . $off['user_id'])];
    }
    if (!empty($officialRows)) {
        $body .= emailPara('<strong>Pegawai Perlawanan (' . count($officials) . '):</strong>');
        $body .= emailInfoTable($officialRows);
    }

    $body .= emailAlert('#2563EB', '#EFF6FF', 'Tindakan Diperlukan', 'Satu pengesahan sahaja diperlukan untuk kesemua pegawai perlawanan ini.');
    $body .= emailButton(env('BASE_URL') . '/pp-daerah/pengesahan-perlawanan', 'Sahkan Perlawanan');

    return buildEmailTemplate('Perlawanan Persahabatan Baru - Pengesahan Diperlukan', '#2563EB', '', $body);
}

