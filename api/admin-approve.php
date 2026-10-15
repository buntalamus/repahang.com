<?php

/**

 * Admin Approve/Reject Application API

 * POST: Approve or reject application

 */



require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../config/pendaftaran-workflow.php';



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

        SELECT p.*, u.email as user_email, u.nama_penuh as user_nama, u.role as user_role

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

    

    if ($action === 'reject' && trim((string) $notes) === '') {
        http_response_code(400);
        echo json_encode(['error' => true, 'message' => 'Sebab penolakan diperlukan.']);
        exit;
    }

    $pdo->beginTransaction();
    // Sahkan status di dalam transaksi untuk mengelakkan dua keputusan serentak.
    $lockStmt = $pdo->prepare("SELECT status_workflow FROM permohonan WHERE id = ? FOR UPDATE");
    $lockStmt->execute([$permohonanId]);
    if ($lockStmt->fetchColumn() !== 'Menunggu Admin') {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => true, 'message' => 'Permohonan sudah diproses.']);
        exit;
    }

    

    if ($action === 'approve') {

        // Approve application - handle different application types

        $workflowStatusUpdate = '';

        if ($application['jenis_borang'] === 'ujian_kelas1_fam') {

            $workflowStatusUpdate = ', workflow_status = \'Approved\'';

        }

        

        $fitnessGate = requiresAnnualFitnessResult($application);
        $isPenilai = ($application['jenis_borang'] ?? '') === 'penilai_berdaftar';
        $updateStmt = $pdo->prepare("

            UPDATE permohonan 

            SET status = 'Approved',

                status_workflow = '" . ($fitnessGate ? "Admin Diluluskan" : "Lengkap") . "'

                {$workflowStatusUpdate},

                admin_approved_at = NOW(),

                admin_approved_by = :admin_id,

                admin_notes = :notes,

                final_approved_at = " . ($fitnessGate ? "NULL" : "NOW()") . ",

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
            VALUES (:user_id, :type, :subject, :message, NOW())
        ");

        $notifStmt->execute([
            'user_id' => $application['user_id'],
            'type' => $fitnessGate ? 'Semakan Permohonan' : 'Pendaftaran Lengkap',
            'subject' => $fitnessGate ? 'Dokumen Diluluskan - Menunggu Ujian Kecergasan'
                : ($isPenilai ? 'Pendaftaran Penilai Pengadil Diluluskan' : 'Pendaftaran Pengadil Diluluskan'),
            'message' => $fitnessGate
                ? 'Anda telah didaftarkan untuk sesi ini. Kelayakan patch dan lesen Pengadil Negeri menunggu keputusan ujian kecergasan.'
                : ($isPenilai ? 'Pendaftaran tahunan Penilai Pengadil anda telah diluluskan.' : 'Permohonan pendaftaran pengadil anda telah diluluskan.'),
        ]);

        

        $pdo->commit();
        $emailSent = false;
        try {
            $emailSent = $fitnessGate
                ? sendAnnualRegistrationStageEmail($application, 'documents', (string) $notes)
                : sendApprovalEmail($application, $notes);
        } catch (Throwable $emailError) {
            error_log('[admin-approve] Approval email failed: ' . $emailError->getMessage());
        }

        

        echo json_encode([

            'error' => false,

            'message' => $fitnessGate
                ? 'Dokumen diluluskan; menunggu keputusan ujian kecergasan.'
                : 'Permohonan berjaya diluluskan.',
            'email_sent' => $emailSent

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

        

        $pdo->commit();
        $emailSent = false;
        try {
            $emailSent = sendRejectionEmail($application, $notes);
        } catch (Throwable $emailError) {
            error_log('[admin-approve] Rejection email failed: ' . $emailError->getMessage());
        }

        

        echo json_encode([

            'error' => false,

            'message' => 'Permohonan telah ditolak.',
            'email_sent' => $emailSent

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

    $isPenilai = ($application['jenis_borang'] ?? '') === 'penilai_berdaftar';
    $title = $isPenilai ? 'Pendaftaran Tahunan Penilai Pengadil Diluluskan' : 'Pendaftaran Pengadil Diluluskan';
    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailPara($isPenilai
        ? 'Tahniah! Permohonan pendaftaran tahunan Penilai Pengadil anda telah <strong>DILULUSKAN</strong>.'
        : 'Tahniah! Kami dengan sukacitanya memaklumkan bahawa permohonan pendaftaran pengadil anda telah <strong>DILULUSKAN</strong>.');
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
        $isPenilai ? 'Salinan borang R1 anda boleh dimuat turun dari dashboard.' : 'Sijil pendaftaran anda tersedia untuk dimuat turun dari dashboard.',
        'Semak dashboard untuk maklumat dan tugasan terkini.',
        'Hubungi pejabat PBNP jika ada sebarang pertanyaan.',
    ]);
    $dashboardPath = $isPenilai ? match ($application['user_role'] ?? '') {
        'Admin' => '/admin/daftar/ra',
        'PP Daerah' => '/pp-daerah/daftar/tahunan',
        default => '/penilai/permohonan/tahunan',
    } : '/pengadil';
    $body .= emailButton(env('BASE_URL') . $dashboardPath, 'Semak Pendaftaran');

    $html = buildEmailTemplate($title, '#16A34A', '', $body);

    return sendEmail(
        $application['user_email'] ?? $application['emel'],
        $title . ' - PBNP',
        $html,
        $application['nama_penuh'],
        'daftar'
    );
}



/**

 * Send rejection email to pengadil

 */

function sendRejectionEmail($application, $reason) {

    $isPenilai = ($application['jenis_borang'] ?? '') === 'penilai_berdaftar';
    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailPara($isPenilai
        ? 'Permohonan pendaftaran tahunan Penilai Pengadil anda telah <strong>DITOLAK</strong> selepas semakan dilakukan.'
        : 'Kami ingin memaklumkan bahawa permohonan pendaftaran pengadil anda telah <strong>DITOLAK</strong> selepas semakan dilakukan.');
    $body .= emailInfoTable([
        ['Nama',              htmlspecialchars($application['nama_penuh'])],
        ['No. Kad Pengenalan', htmlspecialchars($application['no_kp'])],
        ['Jenis Pengadil',    htmlspecialchars($application['jenis_pengadil'])],
    ]);
    $body .= emailAlert('#DC2626', '#FEF2F2', 'Sebab Penolakan', htmlspecialchars($reason));
    $body .= emailPara('Jika anda ingin membuat <strong>rayuan</strong> atau mempunyai sebarang pertanyaan, sila hubungi pejabat PBNP atau emel kepada <a href="mailto:support@refpahang.com" style="color:#2563EB;">support@refpahang.com</a>.');
    $body .= emailButton(env('BASE_URL') . '/login', 'Hubungi Kami');

    $title = $isPenilai ? 'Pendaftaran Penilai Pengadil Ditolak' : 'Status Permohonan Ditolak';
    $html = buildEmailTemplate($title, '#DC2626', '', $body);

    return sendEmail(
        $application['user_email'] ?? $application['emel'],
        $title . ' - PBNP',
        $html,
        $application['nama_penuh'],
        'daftar'
    );
}

