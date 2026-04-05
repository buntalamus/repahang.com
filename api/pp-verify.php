<?php

/**

 * PP Daerah Verification API

 * Approve or reject applications

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



// Require PP Daerah role

$currentUser = requireRole(['PP Daerah']);
$userId = $currentUser['id'];



$input = getJsonInput();



$permohonanId = isset($input['permohonan_id']) ? (int) $input['permohonan_id'] : 0;

$action = $input['action'] ?? '';

$notes = trim($input['notes'] ?? '');



if ($permohonanId <= 0 || !in_array($action, ['approve', 'reject'], true)) {

    jsonResponse(['error' => true, 'message' => 'Invalid request parameters.'], 422);

}



try {

    $pdo = getDbConnection();

    

    // Get PP's persatuan

    $userStmt = $pdo->prepare('SELECT persatuan_id, nama_penuh FROM users WHERE id = :id LIMIT 1');

    $userStmt->execute([':id' => $userId]);

    $ppUser = $userStmt->fetch(PDO::FETCH_ASSOC);

    

    if (!$ppUser || !$ppUser['persatuan_id']) {

        jsonResponse(['error' => true, 'message' => 'Persatuan not assigned.'], 403);

    }

    

    // Get application

    $appStmt = $pdo->prepare('

        SELECT p.*, u.email as user_email, u.nama_penuh as user_nama

        FROM permohonan p

        LEFT JOIN users u ON p.user_id = u.id

        WHERE p.id = :id 

        AND p.persatuan_id = :persatuan_id

        AND p.status_workflow = \'Menunggu PP Daerah\'

        LIMIT 1

    ');

    

    $appStmt->execute([

        ':id' => $permohonanId,

        ':persatuan_id' => $ppUser['persatuan_id'],

    ]);

    

    $application = $appStmt->fetch(PDO::FETCH_ASSOC);

    

    if (!$application) {

        jsonResponse(['error' => true, 'message' => 'Application not found or already processed.'], 404);

    }

    

    $pdo->beginTransaction();

    

    if ($action === 'approve') {

        // Approve: Update to "PP Daerah Disahkan" then "Menunggu Admin"

        $updateStmt = $pdo->prepare('

            UPDATE permohonan 

            SET status_workflow = :status,

                pp_verified_at = NOW(),

                pp_verified_by = :pp_id,

                pp_notes = :notes,

                status_kemaskini = NOW()

            WHERE id = :id

        ');

        

        $updateStmt->execute([

            ':status' => 'Menunggu Admin', // Skip intermediate, go straight to admin

            ':pp_id' => $userId,

            ':notes' => $notes,

            ':id' => $permohonanId,

        ]);

        

        // Send notification to admin

        sendAdminNotification($pdo, $application, $ppUser['nama_penuh']);

        

        // Send confirmation to applicant

        sendApplicantNotification($pdo, $application, 'approved');

        

        $pdo->commit();

        

        jsonResponse([

            'error' => false,

            'message' => 'Application approved. Admin will be notified.',

        ]);

        

    } else { // reject

        // Reject: Update to "Ditolak"

        $updateStmt = $pdo->prepare('

            UPDATE permohonan 

            SET status_workflow = :status,

                status = \'Rejected\',

                pp_verified_at = NOW(),

                pp_verified_by = :pp_id,

                pp_notes = :notes,

                status_kemaskini = NOW()

            WHERE id = :id

        ');

        

        $updateStmt->execute([

            ':status' => 'Ditolak',

            ':pp_id' => $userId,

            ':notes' => $notes,

            ':id' => $permohonanId,

        ]);

        

        // Send rejection notification to applicant

        sendApplicantNotification($pdo, $application, 'rejected', $notes);

        

        $pdo->commit();

        

        jsonResponse([

            'error' => false,

            'message' => 'Application rejected. Applicant will be notified.',

        ]);

    }

    

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {

        $pdo->rollBack();

    }

    error_log('[pp-verify.php] Error: ' . $e->getMessage());

    $message = APP_DEBUG ? 'Error: ' . $e->getMessage() : 'Verification failed.';

    jsonResponse(['error' => true, 'message' => $message], 500);

}



/**

 * Notify admin about approved application

 */

function sendAdminNotification(PDO $pdo, array $application, string $ppName): void
{
    require_once __DIR__ . '/../config/email.php';

    $adminStmt = $pdo->prepare("SELECT email, nama_penuh FROM users WHERE role = 'Admin' AND aktif = 1");
    $adminStmt->execute();
    $admins = $adminStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($admins)) {
        error_log('[pp-verify] No active admins found');
        return;
    }

    $subject = "Tindakan Diperlukan: Permohonan Pengadil Disahkan PP - {$application['nama_penuh']}";

    $body  = emailGreeting('Pentadbir');
    $body .= emailPara("Permohonan pengadil berikut telah <strong>disahkan oleh PP Daerah " . htmlspecialchars($ppName) . "</strong> dan kini menunggu kelulusan anda.");
    $body .= emailInfoTable([
        ['Nama Pemohon',   htmlspecialchars($application['nama_penuh'])],
        ['No. Kad Pengenalan', htmlspecialchars($application['no_kp'])],
        ['Emel',           htmlspecialchars($application['emel'])],
        ['Jenis Pengadil', htmlspecialchars($application['jenis_pengadil'])],
        ['Disahkan Oleh',  htmlspecialchars($ppName)],
    ]);
    $body .= emailStatusBadge('Menunggu Kelulusan Admin', '#FEF3C7', '#92400E');
    $body .= emailButton(env('BASE_URL') . '/admin/permohonan', 'Semak Permohonan');

    $html = buildEmailTemplate('Tindakan Diperlukan: Pengesahan PP Diterima', '#7C3AED', '', $body);

    foreach ($admins as $admin) {
        sendEmail($admin['email'], $subject, $html, $admin['nama_penuh'], 'admin');
    }
}



/**

 * Notify applicant about verification result

 */

function sendApplicantNotification(PDO $pdo, array $application, string $result, string $reason = ''): void
{
    require_once __DIR__ . '/../config/email.php';

    if ($result === 'approved') {
        $subject     = "Permohonan Disahkan PP Daerah - Sistem Pengadil PBNP";
        $banner      = 'Permohonan Disahkan PP Daerah';
        $accent      = '#16A34A';
        $icon        = '';
        $alertHtml   = emailAlert('#16A34A', '#F0FDF4', 'Tahniah!',
            'Permohonan anda telah disahkan oleh <strong>Penolong Pegawai Pembangunan Daerah</strong>. Permohonan kini menunggu kelulusan akhir pela pentadbir sistem.');
        $nextHtml    = emailOrderedList([
            'Tunggu kelulusan akhir daripada pentadbir PBNP.',
            'Semak status permohonan di dashboard anda.',
            'Anda akan menerima notifikasi emel setelah keputusan muktamad.',
        ]);
    } else {
        $subject     = "Permohonan Ditolak PP Daerah - Sistem Pengadil PBNP";
        $banner      = 'Permohonan Ditolak PP Daerah';
        $accent      = '#DC2626';
        $icon        = '';
        $alertHtml   = emailAlert('#DC2626', '#FEF2F2', 'Sebab Penolakan',
            htmlspecialchars($reason) ?: 'Tiada sebab dinyatakan.');
        $nextHtml    = emailPara('Jika anda ingin membuat <strong>rayuan</strong>, sila hubungi pejabat PBNP atau emel kepada <a href="mailto:support@refpahang.com" style="color:#2563EB;">support@refpahang.com</a>.');
    }

    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailInfoTable([
        ['Nama',          htmlspecialchars($application['nama_penuh'])],
        ['Jenis Pengadil', htmlspecialchars($application['jenis_pengadil'])],
    ]);
    $body .= $alertHtml;
    $body .= $nextHtml;
    $body .= emailButton(env('BASE_URL') . '/pengadil', 'Semak Dashboard');

    $html = buildEmailTemplate($banner, $accent, $icon, $body);
    sendEmail($application['emel'], $subject, $html, $application['nama_penuh'], 'daftar');
}

