<?php

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/../config/email.php';



header('Content-Type: application/json');



try {

    // Verify PP Daerah role

    $currentUser = requireRole(['PP Daerah']);

    $persatuanId = $currentUser['persatuan_id'];

    

    // Get database connection

    $pdo = getDbConnection();

    

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Check if requesting single match details
        if (isset($_GET['match_id'])) {
            $matchId = (int)$_GET['match_id'];
            
            $sql = "SELECT 
                        p.id, p.tarikh, p.jenis, p.tempat, p.jawatan,
                        p.home_team, p.away_team,
                        p.status_pp, p.verified_by, p.verified_at, p.catatan_pp,
                        p.user_id,
                        u.nama_penuh, u.email,
                        verifier.nama_penuh as verified_by_name
                    FROM perlawanan p
                    JOIN users u ON p.user_id = u.id
                    LEFT JOIN users verifier ON p.verified_by = verifier.id
                    WHERE p.id = :match_id
                    AND u.persatuan_id = :persatuan_id
                    AND u.role = 'Pengadil'";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindValue(':match_id', $matchId, PDO::PARAM_INT);
            $stmt->bindValue(':persatuan_id', $persatuanId, PDO::PARAM_STR);
            $stmt->execute();
            $match = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$match) {
                http_response_code(404);
                echo json_encode([
                    'error' => true,
                    'message' => 'Perlawanan tidak dijumpai atau anda tidak mempunyai akses.'
                ]);
                exit;
            }
            
            echo json_encode([
                'error' => false,
                'match' => $match
            ]);
            exit;
        }
        
        // Get list of matches from pengadil in PP's district

        $statusFilter = $_GET['status'] ?? null;

        

        $sql = "SELECT 

                    p.id, p.tarikh, p.jenis, p.tempat, p.jawatan, 

                    p.status_pp, p.verified_by, p.verified_at, p.catatan_pp,

                    p.user_id,

                    u.nama_penuh, u.email

                FROM perlawanan p

                JOIN users u ON p.user_id = u.id

                WHERE u.persatuan_id = :persatuan_id

                AND u.role = 'Pengadil'";

        

        if ($statusFilter) {

            $sql .= " AND p.status_pp = :status";

        }

        

        $sql .= " ORDER BY p.tarikh DESC, u.nama_penuh ASC";

        

        $stmt = $pdo->prepare($sql);

        $stmt->bindValue(':persatuan_id', $persatuanId, PDO::PARAM_STR);

        

        if ($statusFilter) {

            $stmt->bindValue(':status', $statusFilter, PDO::PARAM_STR);

        }

        

        $stmt->execute();

        $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        

        echo json_encode([

            'error' => false,

            'matches' => $matches,

            'count' => count($matches)

        ]);

        

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {

        // Verify or reject a match

        $input = getJsonInput();

        $matchId = (int) ($input['match_id'] ?? 0);

        $action = $input['action'] ?? ''; // 'approve' or 'reject'

        $catatan = $input['catatan'] ?? null;

        

        if (!$matchId) {

            throw new Exception('ID perlawanan tidak sah');

        }

        

        if (!in_array($action, ['approve', 'reject'])) {

            throw new Exception('Tindakan tidak sah');

        }

        

        // Verify the match belongs to a pengadil in PP's district

        $checkSql = "SELECT p.id, p.tarikh, p.jenis, p.tempat, p.jawatan,

                            u.nama_penuh, u.email, u.id as user_id

                     FROM perlawanan p

                     JOIN users u ON p.user_id = u.id

                     WHERE p.id = :match_id

                     AND u.persatuan_id = :persatuan_id

                     AND u.role = 'Pengadil'";

        

        $checkStmt = $pdo->prepare($checkSql);

        $checkStmt->execute([

            ':match_id' => $matchId,

            ':persatuan_id' => $persatuanId

        ]);

        

        $match = $checkStmt->fetch(PDO::FETCH_ASSOC);

        

        if (!$match) {

            throw new Exception('Perlawanan tidak dijumpai atau bukan dalam daerah anda');

        }

        

        // Update match status

        if ($action === 'approve') {

            $updateSql = "UPDATE perlawanan 

                         SET status_pp = 'Disahkan',

                             verified_by = :verified_by,

                             verified_at = NOW(),

                             catatan_pp = NULL

                         WHERE id = :match_id";

            

            $updateStmt = $pdo->prepare($updateSql);

            $updateStmt->execute([

                ':verified_by' => $currentUser['id'],

                ':match_id' => $matchId

            ]);

            

            $message = 'Perlawanan telah disahkan';

            

            // Create notification for pengadil

            $notifSql = "INSERT INTO notifications (user_id, type, subject, message, created_at) 

                        VALUES (:user_id, 'PP Disahkan', :subject, :message, NOW())";

            $notifStmt = $pdo->prepare($notifSql);

            $notifStmt->execute([

                ':user_id' => $match['user_id'],

                ':subject' => 'Perlawanan Disahkan oleh PP Daerah',

                ':message' => sprintf(

                    'Perlawanan anda pada %s (%s) di %s telah disahkan oleh PP Daerah.',

                    date('d/m/Y', strtotime($match['tarikh'] ?? 'now')),

                    $match['jenis'] ?? 'N/A',

                    $match['tempat'] ?? 'N/A'

                )

            ]);

            

            // Send email notification

            $emailSubject = '✅ Perlawanan Anda Telah Disahkan';

            $emailBody = getVerificationEmailTemplate(

                $match['nama_penuh'],

                'disahkan',

                $match['tarikh'],

                $match['jenis'],

                $match['tempat'],

                $match['jawatan'],

                null

            );

            

            sendEmail($match['email'], $emailSubject, $emailBody, null, 'pengesahan');

            

        } else { // reject

            if (!$catatan) {

                throw new Exception('Sila nyatakan sebab penolakan');

            }

            

            $updateSql = "UPDATE perlawanan 

                         SET status_pp = 'Tidak Disahkan',

                             verified_by = :verified_by,

                             verified_at = NOW(),

                             catatan_pp = :catatan

                         WHERE id = :match_id";

            

            $updateStmt = $pdo->prepare($updateSql);

            $updateStmt->execute([

                ':verified_by' => $currentUser['id'],

                ':catatan' => $catatan,

                ':match_id' => $matchId

            ]);

            

            $message = 'Perlawanan telah ditolak';

            

            // Create notification for pengadil

            $notifSql = "INSERT INTO notifications (user_id, type, subject, message, created_at) 

                        VALUES (:user_id, 'Ditolak', :subject, :message, NOW())";

            $notifStmt = $pdo->prepare($notifSql);

            $notifStmt->execute([

                ':user_id' => $match['user_id'],

                ':subject' => 'Perlawanan Ditolak oleh PP Daerah',

                ':message' => sprintf(

                    'Perlawanan anda pada %s (%s) di %s telah ditolak oleh PP Daerah. Sebab: %s',

                    date('d/m/Y', strtotime($match['tarikh'] ?? 'now')),

                    $match['jenis'] ?? 'N/A',

                    $match['tempat'] ?? 'N/A',

                    $catatan

                )

            ]);

            

            // Send email notification

            $emailSubject = '❌ Perlawanan Anda Memerlukan Semakan';

            $emailBody = getVerificationEmailTemplate(

                $match['nama_penuh'],

                'ditolak',

                $match['tarikh'],

                $match['jenis'],

                $match['tempat'],

                $match['jawatan'],

                $catatan

            );

            

            sendEmail($match['email'], $emailSubject, $emailBody, null, 'pengesahan');

        }

        

        // TODO: Send notification to pengadil

        

        echo json_encode([

            'error' => false,

            'message' => $message

        ]);

        

    } else {

        throw new Exception('Method not allowed');

    }

    

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([

        'error' => true,

        'message' => $e->getMessage(),

        'line' => $e->getLine()

    ]);

}



/**

 * Email template for verification notification

 */

function getVerificationEmailTemplate($nama, $status, $tarikh, $jenis, $tempat, $jawatan, $catatan = null) {
    require_once __DIR__ . '/../config/email.php';

    $tarikhFormatted = date('d M Y', strtotime($tarikh));
    $isVerified = $status === 'disahkan';

    $accent    = $isVerified ? '#16A34A' : '#DC2626';
    $icon      = '';
    $banner    = $isVerified ? 'Perlawanan Disahkan' : 'Perlawanan Memerlukan Semakan';

    $body  = emailGreeting($nama);
    $body .= emailPara($isVerified
        ? 'Perlawanan anda telah <strong>disahkan</strong> oleh Penolong Pegawai Pembangunan Daerah dan dikira dalam rekod rasmi anda.'
        : 'Rekod perlawanan anda <strong>memerlukan semakan</strong>. Sila baca catatan di bawah untuk tindakan selanjutnya.');
    $body .= emailInfoTable([
        ['Tarikh Perlawanan', $tarikhFormatted],
        ['Jenis Perlawanan',  htmlspecialchars($jenis)],
        ['Tempat',            htmlspecialchars($tempat)],
        ['Jawatan',           htmlspecialchars($jawatan)],
        ['Status',            $isVerified
                               ? '<span style="color:#16A34A;font-weight:700;">DISAHKAN</span>'
                               : '<span style="color:#DC2626;font-weight:700;">PERLU SEMAKAN</span>'],
    ]);
    if ($catatan && !$isVerified) {
        $body .= emailAlert('#DC2626', '#FEF2F2', 'Catatan PP Daerah', htmlspecialchars($catatan));
    }
    if ($isVerified) {
        $currentYear = date('Y');
        $body .= emailAlert('#16A34A', '#F0FDF4', 'Maklumat', "Perlawanan ini dikira dalam rekod rasmi tahun <strong>{$currentYear}</strong>. Pastikan anda mencapai minimum <strong>20 perlawanan disahkan</strong> untuk layak memohon pendaftaran pengadil bagi tahun " . ($currentYear + 1) . '.');
    } else {
        $body .= emailAlert('#F59E0B', '#FFFBEB', 'Tindakan Diperlukan', 'Sila semak catatan di atas dan kemaskini maklumat perlawanan anda melalui dashboard, kemudian kemukakan semula untuk pengesahan.');
    }
    $body .= emailButton('https://refpahang.com/pengadil-dashboard.html', 'Pergi ke Dashboard');

    return buildEmailTemplate($banner, $accent, $icon, $body);
}

