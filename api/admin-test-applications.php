<?php

/**

 * Admin Test Applications API

 * GET: List all test applications waiting for admin approval

 * POST: Approve or reject test applications

 */



require_once 'bootstrap.php';

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



    $pdo = getDbConnection();



    if ($_SERVER['REQUEST_METHOD'] === 'GET') {

        $type = $_GET['type'] ?? 'fitness'; // 'fitness' or 'written'

        $status = $_GET['status'] ?? 'pending';



        // Build query for unified table

        $typeMap = ['fitness' => 'ujian_kecergasan', 'written' => 'ujian_bertulis', 'kelas1' => 'ujian_kelas1_fam']; $jenis_permohonan = $typeMap[$type] ?? 'ujian_kecergasan';



        $whereClause = "WHERE p.jenis_permohonan = '{$jenis_permohonan}'";

        if ($status !== 'all') {

            $statusFilter = $status === 'pending' ? 'Pending' : ($status === 'approved' ? 'Approved' : ($status === 'rejected' ? 'Rejected' : 'Absent'));

            $whereClause .= " AND p.workflow_status = '{$statusFilter}'";

        }



        $stmt = $pdo->prepare("

            SELECT

                p.*,

                u.email as user_email,

                u.no_telefon as user_phone,

                u.url_gambar_profil,

                pb.nama_persatuan as district_nama

            FROM permohonan p

            LEFT JOIN users u ON p.user_id = u.id

            LEFT JOIN persatuan_bolasepak_daerah pb ON p.persatuan_id = pb.id

            {$whereClause}

            ORDER BY p.tarikh_hantar DESC

        ");



        $stmt->execute();

        $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);



        // Get statistics from unified table

        $statsStmt = $pdo->query("

            SELECT

                SUM(CASE WHEN workflow_status = 'Pending' AND jenis_permohonan = 'ujian_kecergasan' THEN 1 ELSE 0 END) as pending_fitness,

                SUM(CASE WHEN workflow_status = 'Approved' AND jenis_permohonan = 'ujian_kecergasan' THEN 1 ELSE 0 END) as approved_fitness,

                SUM(CASE WHEN workflow_status = 'Rejected' AND jenis_permohonan = 'ujian_kecergasan' THEN 1 ELSE 0 END) as rejected_fitness,

                SUM(CASE WHEN workflow_status = 'Absent' AND jenis_permohonan = 'ujian_kecergasan' THEN 1 ELSE 0 END) as absent_fitness,

                SUM(CASE WHEN jenis_permohonan = 'ujian_kecergasan' THEN 1 ELSE 0 END) as total_fitness,

                SUM(CASE WHEN workflow_status = 'Pending' AND jenis_permohonan = 'ujian_bertulis' THEN 1 ELSE 0 END) as pending_written,

                SUM(CASE WHEN workflow_status = 'Approved' AND jenis_permohonan = 'ujian_bertulis' THEN 1 ELSE 0 END) as approved_written,

                SUM(CASE WHEN workflow_status = 'Rejected' AND jenis_permohonan = 'ujian_bertulis' THEN 1 ELSE 0 END) as rejected_written,

                SUM(CASE WHEN workflow_status = 'Absent' AND jenis_permohonan = 'ujian_bertulis' THEN 1 ELSE 0 END) as absent_written,

                SUM(CASE WHEN jenis_permohonan = 'ujian_bertulis' THEN 1 ELSE 0 END) as total_written

            FROM permohonan

            WHERE jenis_permohonan IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam')

        ");



        $statistics = $statsStmt->fetch(PDO::FETCH_ASSOC);



        echo json_encode([

            'error' => false,

            'applications' => $applications,

            'statistics' => $statistics

        ]);

        exit;

    }



    if ($_SERVER['REQUEST_METHOD'] === 'POST') {

        $input = json_decode(file_get_contents('php://input'), true);

        $id = $input['id'] ?? 0;

        $type = $input['type'] ?? ''; // 'fitness' or 'written'

        $action = $input['action'] ?? ''; // 'approve', 'reject', 'absent'

        $notes = $input['notes'] ?? '';

        $is_edit = $input['is_edit'] ?? false; // Flag to indicate editing existing record



        if (!$id || !in_array($type, ['fitness', 'written']) || !in_array($action, ['approve', 'reject', 'absent'])) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'Parameter tidak sah.']);

            exit;

        }



        // Get application details from unified table

        $typeMap = ['fitness' => 'ujian_kecergasan', 'written' => 'ujian_bertulis', 'kelas1' => 'ujian_kelas1_fam']; $jenis_permohonan = $typeMap[$type] ?? 'ujian_kecergasan';



        // If editing, don't restrict by workflow_status
        if ($is_edit) {
            $stmt = $pdo->prepare("

                SELECT p.*, u.email as user_email, u.nama_penuh as user_nama

                FROM permohonan p

                LEFT JOIN users u ON p.user_id = u.id

                WHERE p.id = :id AND p.jenis_permohonan = :jenis

                LIMIT 1

            ");
        } else {
            $stmt = $pdo->prepare("

                SELECT p.*, u.email as user_email, u.nama_penuh as user_nama

                FROM permohonan p

                LEFT JOIN users u ON p.user_id = u.id

                WHERE p.id = :id AND p.jenis_permohonan = :jenis AND p.workflow_status = 'Pending'

                LIMIT 1

            ");
        }

        $stmt->execute(['id' => $id, 'jenis' => $jenis_permohonan]);

        $application = $stmt->fetch(PDO::FETCH_ASSOC);



        if (!$application) {

            http_response_code(404);

            echo json_encode(['error' => true, 'message' => 'Permohonan tidak dijumpai.']);

            exit;

        }



        $pdo->beginTransaction();



        if ($action === 'approve') {

            // Approve application

            $updateStmt = $pdo->prepare("

                UPDATE permohonan

                SET workflow_status = 'Approved',

                    admin_approved_at = NOW(),

                    admin_approved_by = :admin_id,

                    admin_notes = :notes,

                    status_kemaskini = NOW()

                WHERE id = :id

            ");



            $updateStmt->execute([

                'admin_id' => $_SESSION['user_id'],

                'notes' => $notes,

                'id' => $id

            ]);



            // Send email notification

            sendTestApprovalEmail($application, $type, $notes);



            $pdo->commit();



            echo json_encode([

                'error' => false,

                'message' => 'Permohonan ujian berjaya diluluskan. Email telah dihantar kepada pemohon.'

            ]);



        } elseif ($action === 'absent') {

            // Mark as Absent

            $updateStmt = $pdo->prepare("

                UPDATE permohonan

                SET workflow_status = 'Absent',

                    admin_approved_at = NOW(),

                    admin_approved_by = :admin_id,

                    admin_notes = :notes,

                    status_kemaskini = NOW()

                WHERE id = :id

            ");



            $updateStmt->execute([

                'admin_id' => $_SESSION['user_id'],

                'notes' => $notes,

                'id' => $id

            ]);



            // Send absent email

            sendTestAbsentEmail($application, $type, $notes);



            $pdo->commit();



            echo json_encode([

                'error' => false,

                'message' => 'Permohonan ujian telah ditanda sebagai Tidak Hadir. Email makluman telah dihantar.'

            ]);



        } else { // reject

            if (empty($notes)) {

                http_response_code(400);

                echo json_encode(['error' => true, 'message' => 'Sebab penolakan diperlukan.']);

                exit;

            }



            // Reject application

            $updateStmt = $pdo->prepare("

                UPDATE permohonan

                SET workflow_status = 'Rejected',

                    admin_approved_at = NOW(),

                    admin_approved_by = :admin_id,

                    admin_notes = :notes,

                    status_kemaskini = NOW()

                WHERE id = :id

            ");



            $updateStmt->execute([

                'admin_id' => $_SESSION['user_id'],

                'notes' => $notes,

                'id' => $id

            ]);



            // Send rejection email

            sendTestRejectionEmail($application, $type, $notes);



            $pdo->commit();



            echo json_encode([

                'error' => false,

                'message' => 'Permohonan ujian telah ditolak. Email telah dihantar kepada pemohon.'

            ]);

        }

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

 * Send test approval email to PP Daerah

 */

function sendTestApprovalEmail($application, $type, $notes)
{
    $testNameMap = ['fitness' => 'Ujian Kecergasan', 'written' => 'Ujian Kelas III FAM', 'kelas1' => 'Ujian Kelas 1 FAM'];
    $testName    = $testNameMap[$type] ?? 'Ujian Kecergasan';
    $formType    = $type === 'fitness' ? 'R4' : ($type === 'written' ? 'R5' : '');

    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailPara("Tahniah! Permohonan <strong>" . htmlspecialchars($testName) . "</strong> anda telah <strong>DILULUSKAN</strong>.");
    $body .= emailInfoTable([
        ['Nama',          htmlspecialchars($application['nama_penuh'])],
        ['Jenis Ujian',   htmlspecialchars($testName)],
        ['Tahun',         htmlspecialchars($application['tahun_permohonan'])],
    ]);
    if (!empty($notes)) {
        $body .= emailAlert('#16A34A', '#F0FDF4', 'Nota', htmlspecialchars($notes));
    }
    $stepsArr = [];
    if ($formType) {
        $stepsArr[] = "Borang <strong>{$formType}</strong> untuk {$testName} kini tersedia untuk dimuat turun di dashboard anda.";
        $stepsArr[] = "Bawa borang tersebut ke venue ujian pada tarikh yang ditetapkan.";
    } else {
        $stepsArr[] = "Maklumat lanjut tentang ujian akan dimaklumkan melalui notifikasi.";
    }
    $stepsArr[] = "Hubungi pejabat PBNP jika ada sebarang pertanyaan.";
    $body .= emailPara('<strong>Langkah Seterusnya:</strong>');
    $body .= emailOrderedList($stepsArr);
    $body .= emailButton('https://refpahang.com/pp-dashboard.html', 'Pergi ke Dashboard');

    $html = buildEmailTemplate('Permohonan Ujian Diluluskan', '#16A34A', '', $body);

    sendEmail(
        $application['user_email'] ?? $application['emel'],
        "Permohonan {$testName} Diluluskan - PBNP",
        $html,
        $application['nama_penuh'],
        'daftar'
    );
}



/**

 * Send test rejection email to PP Daerah

 */

function sendTestRejectionEmail($application, $type, $reason)
{
    $testNameMap = ['fitness' => 'Ujian Kecergasan', 'written' => 'Ujian Kelas III FAM', 'kelas1' => 'Ujian Kelas 1 FAM'];
    $testName    = $testNameMap[$type] ?? 'Ujian Kecergasan';

    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailPara("Kami ingin memaklumkan bahawa permohonan <strong>" . htmlspecialchars($testName) . "</strong> anda <strong>tidak berjaya</strong> pada kali ini.");
    $body .= emailInfoTable([
        ['Nama',        htmlspecialchars($application['nama_penuh'])],
        ['Jenis Ujian', htmlspecialchars($testName)],
        ['Tahun',       htmlspecialchars($application['tahun_permohonan'])],
    ]);
    $body .= emailAlert('#DC2626', '#FEF2F2', 'Sebab Penolakan', htmlspecialchars($reason));
    $body .= emailPara('Untuk pertanyaan atau rayuan, sila hubungi pejabat PBNP atau emel kepada <a href="mailto:support@refpahang.com" style="color:#2563EB;">support@refpahang.com</a>.');
    $body .= emailButton('https://refpahang.com/pp-dashboard.html', 'Semak Dashboard');

    $html = buildEmailTemplate('Permohonan Ujian Tidak Berjaya', '#DC2626', '', $body);

    sendEmail(
        $application['user_email'] ?? $application['emel'],
        "Permohonan {$testName} Ditolak - PBNP",
        $html,
        $application['nama_penuh'],
        'daftar'
    );
}



/**

 * Send test absent email to Pengadil

 */

function sendTestAbsentEmail($application, $type, $notes)
{
    $testNameMap = ['fitness' => 'Ujian Kecergasan', 'written' => 'Ujian Kelas III FAM', 'kelas1' => 'Ujian Kelas 1 FAM'];
    $testName    = $testNameMap[$type] ?? 'Ujian Kecergasan';

    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailPara("Kami ingin memaklumkan bahawa rekod anda bagi <strong>" . htmlspecialchars($testName) . "</strong> telah dikemaskini kepada status <strong>Tidak Hadir</strong>.");
    $body .= emailInfoTable([
        ['Nama',        htmlspecialchars($application['nama_penuh'])],
        ['Jenis Ujian', htmlspecialchars($testName)],
        ['Tahun',       htmlspecialchars($application['tahun_permohonan'])],
    ]);
    if (!empty($notes)) {
        $body .= emailAlert('#F59E0B', '#FFFBEB', 'Nota', htmlspecialchars($notes));
    }
    $body .= emailAlert('#F59E0B', '#FFFBEB', 'Tindakan Diperlukan', 'Sila hubungi pejabat PBNP <strong>dalam tempoh 7 hari</strong> untuk menjelaskan ketidakhadiran anda dan mendapatkan peluang susulan.');
    $body .= emailButton('https://refpahang.com/pp-dashboard.html', 'Semak Dashboard');

    $html = buildEmailTemplate('Status Tidak Hadir', '#F59E0B', '', $body);

    sendEmail(
        $application['user_email'] ?? $application['emel'],
        "Status Tidak Hadir {$testName} - PBNP",
        $html,
        $application['nama_penuh'],
        'daftar'
    );
}

?>