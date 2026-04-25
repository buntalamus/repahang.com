<?php

/**

 * Admin Approve/Reject Application API

 * POST: Approve or reject application

 */



require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/../config/email.php';



header('Content-Type: application/json');



try {

    // Require Admin role

    requireAuth();

    

    if ($_SESSION['user_role'] !== 'Admin') {

        http_response_code(403);

        echo json_encode(['error' => true, 'message' => 'Akses ditolak. Hanya admin boleh mengakses.']);

        exit;

    }

    

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

        http_response_code(405);

        echo json_encode(['error' => true, 'message' => 'Method not allowed']);

        exit;

    }

    

    $input = json_decode(file_get_contents('php://input'), true);

    $permohonanId = $input['permohonan_id'] ?? 0;

    $action = $input['action'] ?? ''; // 'approve' or 'reject'

    $notes = $input['notes'] ?? '';

    

    if (!$permohonanId || !in_array($action, ['approve', 'reject'])) {

        http_response_code(400);

        echo json_encode(['error' => true, 'message' => 'Parameter tidak sah.']);

        exit;

    }

    

    $pdo = getDbConnection();

    

    // Get application details

    $stmt = $pdo->prepare("

        SELECT p.*, u.email as user_email, u.nama_penuh as user_nama

        FROM permohonan p

        LEFT JOIN users u ON p.user_id = u.id

        WHERE p.id = :id AND p.status_workflow = 'Menunggu Admin'

        LIMIT 1

    ");

    $stmt->execute(['id' => $permohonanId]);

    $application = $stmt->fetch(PDO::FETCH_ASSOC);

    

    if (!$application) {

        http_response_code(404);

        echo json_encode(['error' => true, 'message' => 'Permohonan tidak dijumpai atau sudah diproses.']);

        exit;

    }

    

    $pdo->beginTransaction();

    

    if ($action === 'approve') {

        // Approve application - handle different application types

        $workflowStatusUpdate = '';

        if ($application['jenis_borang'] === 'ujian_kelas1_fam') {

            $workflowStatusUpdate = ', workflow_status = \'Approved\'';

        }

        

        $updateStmt = $pdo->prepare("

            UPDATE permohonan 

            SET status = 'Approved',

                status_workflow = 'Lengkap'

                {$workflowStatusUpdate},

                admin_approved_at = NOW(),

                admin_approved_by = :admin_id,

                admin_notes = :notes,

                final_approved_at = NOW(),

                status_kemaskini = NOW()

            WHERE id = :id

        ");

        

        $updateStmt->execute([

            'admin_id' => $_SESSION['user_id'],

            'notes' => $notes,

            'id' => $permohonanId

        ]);

        

        // Create notification for pengadil

        $notifStmt = $pdo->prepare("

            INSERT INTO notifications (user_id, type, subject, message, created_at)

            VALUES (:user_id, 'Pendaftaran Lengkap', 'Pendaftaran Pengadil Diluluskan', 

                    'Tahniah! Permohonan pendaftaran pengadil anda telah diluluskan. Sijil pendaftaran akan dihantar ke emel anda.', 

                    NOW())

        ");

        $notifStmt->execute(['user_id' => $application['user_id']]);

        

        // Send email notification

        sendApprovalEmail($application, $notes);

        

        $pdo->commit();

        

        echo json_encode([

            'error' => false,

            'message' => 'Permohonan berjaya diluluskan. Email telah dihantar kepada pengadil.'

        ]);

        

    } else { // reject

        if (empty($notes)) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'Sebab penolakan diperlukan.']);

            exit;

        }

        

        // Reject application - handle different application types

        $workflowStatusUpdate = '';

        if ($application['jenis_borang'] === 'ujian_kelas1_fam') {

            $workflowStatusUpdate = ', workflow_status = \'Rejected\'';

        }

        

        // Reject application

        $updateStmt = $pdo->prepare("

            UPDATE permohonan 

            SET status = 'Rejected',

                status_workflow = 'Ditolak'

                {$workflowStatusUpdate},

                admin_approved_at = NOW(),

                admin_approved_by = :admin_id,

                admin_notes = :notes,

                status_kemaskini = NOW()

            WHERE id = :id

        ");

        

        $updateStmt->execute([

            'admin_id' => $_SESSION['user_id'],

            'notes' => $notes,

            'id' => $permohonanId

        ]);

        

        // Create notification for pengadil

        $notifStmt = $pdo->prepare("

            INSERT INTO notifications (user_id, type, subject, message, created_at)

            VALUES (:user_id, 'Permohonan Ditolak', 'Permohonan Pendaftaran Ditolak', 

                    :message, NOW())

        ");

        $notifStmt->execute([

            'user_id' => $application['user_id'],

            'message' => 'Permohonan pendaftaran anda telah ditolak. Sebab: ' . $notes

        ]);

        

        // Send rejection email

        sendRejectionEmail($application, $notes);

        

        $pdo->commit();

        

        echo json_encode([

            'error' => false,

            'message' => 'Permohonan telah ditolak. Email telah dihantar kepada pengadil.'

        ]);

    }

    

} catch (Exception $e) {

    if (isset($pdo) && $pdo->inTransaction()) {

        $pdo->rollBack();

    }

    

    http_response_code(500);

    echo json_encode([

        'error' => true,

        'message' => APP_DEBUG ? $e->getMessage() : 'Ralat sistem berlaku.',

        'line' => APP_DEBUG ? $e->getLine() : null

    ]);

}



/**

 * Send approval email to pengadil

 */

function sendApprovalEmail($application, $notes) {

    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailPara('Tahniah! Kami dengan sukacitanya memaklumkan bahawa permohonan pendaftaran pengadil anda telah <strong>DILULUSKAN</strong>.');
    $body .= emailInfoTable([
        ['Nama',               htmlspecialchars($application['nama_penuh'])],
        ['No. Kad Pengenalan', htmlspecialchars($application['no_kp'])],
        ['Jenis Pengadil',     htmlspecialchars($application['jenis_pengadil'])],
        ['Tahun Pendaftaran',  htmlspecialchars($application['tahun_permohonan'])],
    ]);
    if (!empty($notes)) {
        $body .= emailAlert('#16A34A', '#F0FDF4', 'Nota daripada Admin', htmlspecialchars($notes));
    }
    $body .= emailPara('<strong>Langkah Seterusnya:</strong>');
    $body .= emailOrderedList([
        'Sijil pendaftaran anda tersedia untuk dimuat turun dari dashboard.',
        'Semak dashboard untuk maklumat dan tugasan terkini.',
        'Hubungi pejabat PBNP jika ada sebarang pertanyaan.',
    ]);
    $body .= emailButton(env('BASE_URL') . '/pengadil', 'Pergi ke Dashboard');

    $html = buildEmailTemplate('Pendaftaran Pengadil Diluluskan', '#16A34A', '', $body);

    sendEmail(
        $application['user_email'] ?? $application['emel'],
        'Pendaftaran Pengadil Diluluskan - PBNP',
        $html,
        $application['nama_penuh'],
        'daftar'
    );
}



/**

 * Send rejection email to pengadil

 */

function sendRejectionEmail($application, $reason) {

    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailPara('Kami ingin memaklumkan bahawa permohonan pendaftaran pengadil anda telah <strong>DITOLAK</strong> selepas semakan dilakukan.');
    $body .= emailInfoTable([
        ['Nama',              htmlspecialchars($application['nama_penuh'])],
        ['No. Kad Pengenalan', htmlspecialchars($application['no_kp'])],
        ['Jenis Pengadil',    htmlspecialchars($application['jenis_pengadil'])],
    ]);
    $body .= emailAlert('#DC2626', '#FEF2F2', 'Sebab Penolakan', htmlspecialchars($reason));
    $body .= emailPara('Jika anda ingin membuat <strong>rayuan</strong> atau mempunyai sebarang pertanyaan, sila hubungi pejabat PBNP atau emel kepada <a href="mailto:support@refpahang.com" style="color:#2563EB;">support@refpahang.com</a>.');
    $body .= emailButton(env('BASE_URL') . '/login', 'Hubungi Kami');

    $html = buildEmailTemplate('Status Permohonan Ditolak', '#DC2626', '', $body);

    sendEmail(
        $application['user_email'] ?? $application['emel'],
        'Permohonan Pendaftaran Ditolak - PBNP',
        $html,
        $application['nama_penuh'],
        'daftar'
    );
}

