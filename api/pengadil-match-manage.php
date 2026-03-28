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
        $required = ['tarikh', 'jenis', 'tempat', 'jawatan', 'home_team', 'away_team'];

        foreach ($required as $field) {

            if (empty($input[$field])) {

                jsonResponse(['error' => true, 'message' => "Field '$field' diperlukan."], 400);

            }

        }

        // 14 Days Rule Validation
        $matchDate = new DateTime($input['tarikh']);
        $today = new DateTime();
        $diff = $today->diff($matchDate);

        // Check if date is in the past more than 14 days
        if ($matchDate < $today && $diff->days > 14) {
            jsonResponse(['error' => true, 'message' => "Rekod perlawanan tidak boleh dihantar melebihi 14 hari dari tarikh perlawanan."], 400);
        }



        // Insert match

        $stmt = $pdo->prepare("

            INSERT INTO perlawanan (
                user_id, tarikh, jenis, tempat, jawatan, 
                home_team, away_team, 
                head_referee_id, assistant_referee_1_id, assistant_referee_2_id, fourth_official_id,
                created_at
            )

            VALUES (
                :user_id, :tarikh, :jenis, :tempat, :jawatan, 
                :home_team, :away_team,
                :head_referee_id, :assistant_referee_1_id, :assistant_referee_2_id, :fourth_official_id,
                NOW()
            )

        ");



        $stmt->execute([

            ':user_id' => $userId,

            ':tarikh' => $input['tarikh'],

            ':jenis' => $input['jenis'],

            ':tempat' => $input['tempat'],

            ':jawatan' => $input['jawatan'],

            ':home_team' => $input['home_team'],

            ':away_team' => $input['away_team'],

            ':head_referee_id' => !empty($input['head_referee_id']) ? $input['head_referee_id'] : null,

            ':assistant_referee_1_id' => !empty($input['assistant_referee_1_id']) ? $input['assistant_referee_1_id'] : null,

            ':assistant_referee_2_id' => !empty($input['assistant_referee_2_id']) ? $input['assistant_referee_2_id'] : null,

            ':fourth_official_id' => !empty($input['fourth_official_id']) ? $input['fourth_official_id'] : null

        ]);



        $matchId = (int) $pdo->lastInsertId();



        // Get user persatuan and name for notifications

        $userStmt = $pdo->prepare("SELECT persatuan_id, nama_penuh FROM users WHERE id = :user_id");

        $userStmt->execute([':user_id' => $userId]);

        $userData = $userStmt->fetch(PDO::FETCH_ASSOC);



        if ($userData) {

            // Send notifications to all PP Daerah in the same persatuan

            $ppStmt = $pdo->prepare("SELECT id, nama_penuh, email FROM users WHERE role = 'PP Daerah' AND persatuan_id = :persatuan_id");

            $ppStmt->execute([':persatuan_id' => $userData['persatuan_id']]);

            $ppUsers = $ppStmt->fetchAll(PDO::FETCH_ASSOC);



            foreach ($ppUsers as $ppUser) {

                // Insert notification for PP Daerah

                $notifStmt = $pdo->prepare("

                    INSERT INTO notifications (user_id, type, subject, message, created_at) 

                    VALUES (:user_id, 'Perlawanan Baru', :subject, :message, NOW())

                ");

                $notifStmt->execute([

                    ':user_id' => $ppUser['id'],

                    ':subject' => 'Perlawanan Baru Untuk Pengesahan',

                    ':message' => sprintf(

                        'Pengadil %s telah menambah rekod perlawanan baru pada %s (%s) di %s. Sila semak dan sahkan.',

                        $userData['nama_penuh'],

                        date('d/m/Y', strtotime($input['tarikh'])),

                        $input['jenis'],

                        $input['tempat']

                    )

                ]);



                // Send email notification to PP Daerah

                $emailSubject = '🔔 Perlawanan Baru Memerlukan Pengesahan';

                $emailBody = getNewMatchEmailTemplate(

                    $ppUser['nama_penuh'],

                    $userData['nama_penuh'],

                    $input['tarikh'],

                    $input['jenis'],

                    $input['tempat'],

                    $input['jawatan']

                );



                sendEmail($ppUser['email'], $emailSubject, $emailBody, null, 'lantikan');

            }

        }



        jsonResponse([

            'error' => false,

            'message' => 'Rekod perlawanan berjaya ditambah.',

            'match_id' => $matchId

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

        if (isset($input['head_referee_id'])) {
            $updateFields[] = 'head_referee_id = :head_referee_id';
            $params[':head_referee_id'] = !empty($input['head_referee_id']) ? $input['head_referee_id'] : null;
        }

        if (isset($input['assistant_referee_1_id'])) {
            $updateFields[] = 'assistant_referee_1_id = :assistant_referee_1_id';
            $params[':assistant_referee_1_id'] = !empty($input['assistant_referee_1_id']) ? $input['assistant_referee_1_id'] : null;
        }

        if (isset($input['assistant_referee_2_id'])) {
            $updateFields[] = 'assistant_referee_2_id = :assistant_referee_2_id';
            $params[':assistant_referee_2_id'] = !empty($input['assistant_referee_2_id']) ? $input['assistant_referee_2_id'] : null;
        }

        if (isset($input['fourth_official_id'])) {
            $updateFields[] = 'fourth_official_id = :fourth_official_id';
            $params[':fourth_official_id'] = !empty($input['fourth_official_id']) ? $input['fourth_official_id'] : null;
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
    $body .= emailButton('https://refpahang.com/pp-dashboard.html', 'Sahkan Perlawanan');

    return buildEmailTemplate('Rekod Perlawanan Baru - Pengesahan Diperlukan', '#2563EB', '', $body);
}

