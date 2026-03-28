<?php

/**

 * Admin Users API

 * GET: List all users

 * POST: Create new user

 * PUT: Update user

 * DELETE: Delete user

 * PATCH: Reset user password

 */



require_once 'bootstrap.php';
require_once 'user-utils.php';



header('Content-Type: application/json');



try {

    // Require Admin role

    requireAdmin();

    

    $pdo = getDbConnection();

    

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $userId = $_GET['id'] ?? null;

        if ($userId) {
            // Fetch single user with full profile
            $stmt = $pdo->prepare("
                SELECT 
                    u.*,
                    p.nama_persatuan as persatuan_nama,
                    p.kod_persatuan
                FROM users u
                LEFT JOIN persatuan_bolasepak_daerah p ON u.persatuan_id = p.id
                WHERE u.id = ?
            ");
            
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                http_response_code(404);
                echo json_encode(['error' => true, 'message' => 'Pengguna tidak dijumpai.']);
                exit;
            }
            
            echo json_encode([
                'error' => false,
                'user' => $user
            ]);
            exit;
        }

        // List all users
                // Fast count query for dashboard stats
                if (isset($_GET['action']) && $_GET['action'] === 'count') {
                    $countStmt = $pdo->query("SELECT COUNT(*) as total FROM users");
                    $count = $countStmt->fetch(PDO::FETCH_ASSOC);
                    echo json_encode(['error' => false, 'total' => (int) $count['total']]);
                    exit;
                }

                // List all users
        $stmt = $pdo->prepare("
            SELECT 
                u.id,
                u.email,
                u.role as user_role,
                u.persatuan_id,
                u.nama_penuh,
                u.no_ic,
                u.no_telefon,
                u.jantina,
                u.jenis_pengadil,
                u.url_gambar_profil,
                u.aktif as is_active,
                u.created_at,
                p.nama_persatuan as persatuan_nama,
                p.kod_persatuan
            FROM users u
            LEFT JOIN persatuan_bolasepak_daerah p ON u.persatuan_id = p.id
            ORDER BY u.created_at DESC
        ");
        
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'error' => false,
            'users' => $users,
            'persatuan' => getPersatuanList($pdo)
        ]);
        exit;
    }

    

    // Check for method overrides first (for hosting that doesn't support certain HTTP methods)
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
        $overrideMethod = $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'];
        
        if ($overrideMethod === 'DELETE') {
            // Handle DELETE override
            $input = getJsonInput();
            $userId = $input['userId'] ?? 0;
            
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'ID pengguna diperlukan.']);
                exit;
            }
            
            // Check if user exists
            $checkStmt = $pdo->prepare("SELECT id, nama_penuh FROM users WHERE id = ?");
            $checkStmt->execute([$userId]);
            $user = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                http_response_code(404);
                echo json_encode(['error' => true, 'message' => 'Pengguna tidak dijumpai.']);
                exit;
            }
            
            // Prevent deleting own account
            if ($userId == $_SESSION['user_id']) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Anda tidak boleh memadam akaun sendiri.']);
                exit;
            }
            
            // Delete user
            $deleteStmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
            $deleteStmt->execute([$userId]);
            
            echo json_encode([
                'error' => false,
                'message' => 'Pengguna berjaya dipadam.',
                'deletedUser' => $user['nama_penuh']
            ]);
            
            exit;
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {

        // Create new user

        $input = $_POST;

        

        $nama_penuh = strtoupper(trim($input['nama_penuh'] ?? ''));

        $email = trim($input['email'] ?? '');

        $no_telefon = trim($input['no_telefon'] ?? '');

        $user_role = $input['user_role'] ?? '';

        $persatuan_id = $input['persatuan_id'] ?? null;

        $jenis_pengadil = strtoupper(trim($input['jenis_pengadil'] ?? ''));

        $password = $input['password'] ?? '';

        

        // Debug logging
        error_log("POST Data received: " . json_encode($input));
        error_log("nama_penuh: '$nama_penuh', email: '$email', user_role: '$user_role'");

        if (!$nama_penuh || !$email || !$user_role) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'Nama penuh, email dan peranan diperlukan.']);

            exit;

        }

        

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'Format email tidak sah.']);

            exit;

        }

        

        $validRoles = ['Pengadil', 'Penilai', 'PP Daerah', 'Admin'];

        if (!in_array($user_role, $validRoles)) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'Peranan tidak sah.']);

            exit;

        }

        

        // Validate persatuan_id for all roles except Admin

        if ($user_role !== 'Admin' && !$persatuan_id) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'FA diperlukan untuk peranan ini.']);

            exit;

        }

        

        // Check if email already exists

        $checkStmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");

        $checkStmt->execute([$email]);

        if ($checkStmt->fetch()) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'Email sudah wujud.']);

            exit;

        }

        

        // Generate password if not provided

        if (!$password) {

            $password = generatePassword();

        }

        

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        

        $stmt = $pdo->prepare("

            INSERT INTO users (email, password, role, persatuan_id, jenis_pengadil, nama_penuh, no_telefon, aktif, password_changed)

            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)

        ");

        

        $stmt->execute([$email, $passwordHash, $user_role, $persatuan_id, $jenis_pengadil, $nama_penuh, $no_telefon]);

        

        echo json_encode([

            'error' => false,

            'message' => 'Pengguna berjaya ditambah.',

            'generatedPassword' => $password

        ]);

        exit;

    }

    

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {

        // Update user - expect JSON input

        $input = getJsonInput();

        $userId = $input['userId'] ?? 0;

        

        if (!$userId) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'ID pengguna diperlukan.']);

            exit;

        }

        

        // Extract basic required fields

        $nama_penuh = trim($input['nama_penuh'] ?? '');

        $email = trim($input['email'] ?? '');

        $user_role = trim($input['user_role'] ?? '');

        $no_telefon = trim($input['no_telefon'] ?? '');

        $persatuan_id = $input['persatuan_id'] ?? null;

        $jenis_pengadil = trim($input['jenis_pengadil'] ?? '');

        $password = trim($input['password'] ?? '');

        

            // Extended profile fields
            $no_ic = trim($input['no_ic'] ?? '');
            $jantina = trim($input['jantina'] ?? '');
            $alamat1 = trim($input['alamat1'] ?? '');
            $alamat2 = trim($input['alamat2'] ?? '');
            $poskod = trim($input['poskod'] ?? '');
            $daerah = trim($input['daerah'] ?? '');
            $negeri = trim($input['negeri'] ?? '');
            $status_kerja = trim($input['status_kerja'] ?? '');
            $jawatan = trim($input['jawatan'] ?? '');
            $nama_majikan = trim($input['nama_majikan'] ?? '');
            $alamat_majikan1 = trim($input['alamat_majikan1'] ?? '');
            $alamat_majikan2 = trim($input['alamat_majikan2'] ?? '');
            $poskod_majikan = trim($input['poskod_majikan'] ?? '');
            $daerah_majikan = trim($input['daerah_majikan'] ?? '');
            $negeri_majikan = trim($input['negeri_majikan'] ?? '');
            $nama_waris = trim($input['nama_waris'] ?? '');
            $hubungan_waris = trim($input['hubungan_waris'] ?? '');
            $telefon_waris = trim($input['telefon_waris'] ?? '');
            $url_gambar_profil = trim($input['url_gambar_profil'] ?? '');
            $umur = $input['umur'] ?? null;

            if (!$nama_penuh || !$email || !$user_role) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Nama penuh, email dan peranan diperlukan.']);
                exit;
            }

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Format email tidak sah.']);
                exit;
            }

            $validRoles = ['Pengadil', 'Penilai', 'PP Daerah', 'Admin'];
            if (!in_array($user_role, $validRoles)) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Peranan tidak sah.']);
                exit;
            }

            // Validate persatuan_id for all roles except Admin
            if ($user_role !== 'Admin' && !$persatuan_id) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'FA diperlukan untuk peranan ini.']);
                exit;
            }

            // Check if email exists for another user
            $checkStmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
            $checkStmt->execute([$email, $userId]);
            if ($checkStmt->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Email sudah digunakan oleh pengguna lain.']);
                exit;
            }

            // Build update query with extended fields
            $updateFields = "nama_penuh = ?, email = ?, no_telefon = ?, no_ic = ?, jantina = ?, alamat1 = ?, alamat2 = ?, poskod = ?, daerah = ?, negeri = ?, status_kerja = ?, jawatan = ?, nama_majikan = ?, alamat_majikan1 = ?, alamat_majikan2 = ?, poskod_majikan = ?, daerah_majikan = ?, negeri_majikan = ?, nama_waris = ?, hubungan_waris = ?, telefon_waris = ?, url_gambar_profil = ?, umur = ?, role = ?, persatuan_id = ?, jenis_pengadil = ?";

            $params = [$nama_penuh, $email, $no_telefon, $no_ic, $jantina, $alamat1, $alamat2, $poskod, $daerah, $negeri, $status_kerja, $jawatan, $nama_majikan, $alamat_majikan1, $alamat_majikan2, $poskod_majikan, $daerah_majikan, $negeri_majikan, $nama_waris, $hubungan_waris, $telefon_waris, $url_gambar_profil, $umur, $user_role, $persatuan_id, $jenis_pengadil];

            if ($password) {
                $updateFields .= ", password = ?, password_changed = 0";
                $params[] = password_hash($password, PASSWORD_DEFAULT);
            }

            $params[] = $userId;

            $stmt = $pdo->prepare("UPDATE users SET $updateFields WHERE id = ?");
            $stmt->execute($params);

            echo json_encode([
                'error' => false,
                'message' => 'Pengguna berjaya dikemaskini.'
            ]);
            exit;
        }
        
        
        
        if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {

        // Reset password or other actions

        $input = getJsonInput();

        $userId = $input['userId'] ?? 0;

        $action = $input['action'] ?? '';

        

        if (!$userId || !$action) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'ID pengguna dan aksi diperlukan.']);

            exit;

        }

        

        if ($action === 'reset_password') {

            $newPassword = '12345678';

            $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);



            // Get user details for email

            $userStmt = $pdo->prepare("SELECT nama_penuh, email, role, jenis_pengadil FROM users WHERE id = ?");

            $userStmt->execute([$userId]);

            $user = $userStmt->fetch(PDO::FETCH_ASSOC);



            if (!$user) {

                http_response_code(404);

                echo json_encode(['error' => true, 'message' => 'Pengguna tidak dijumpai.']);

                exit;

            }



            // Update password in database

            $stmt = $pdo->prepare("UPDATE users SET password = ?, password_changed = 0 WHERE id = ?");

            $stmt->execute([$passwordHash, $userId]);



            // Send notification email with new password

            $emailSent = sendUserRegistrationEmail($user['email'], $user['nama_penuh'], $user['role'], $newPassword, $user['jenis_pengadil'], true);



            echo json_encode([

                'error' => false,

                'message' => $emailSent
                    ? 'Kata laluan berjaya direset kepada 12345678. Emel telah dihantar kepada pengguna.'
                    : 'Kata laluan berjaya direset kepada 12345678. (Emel notifikasi gagal dihantar)',

                'newPassword' => $newPassword

            ]);

            exit;

        }

        if ($action === 'resend_notification') {

            // Get user details

            $userStmt = $pdo->prepare("SELECT nama_penuh, email, role, jenis_pengadil FROM users WHERE id = ?");

            $userStmt->execute([$userId]);

            $user = $userStmt->fetch(PDO::FETCH_ASSOC);



            if (!$user) {

                http_response_code(404);

                echo json_encode(['error' => true, 'message' => 'Pengguna tidak dijumpai.']);

                exit;

            }



            // Generate new password

            $newPassword = '12345678';

            $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);



            // Update password in database

            $updateStmt = $pdo->prepare("UPDATE users SET password = ?, password_changed = 0 WHERE id = ?");

            $updateStmt->execute([$passwordHash, $userId]);



            // Send notification email with credentials

            $emailSent = sendUserRegistrationEmail($user['email'], $user['nama_penuh'], $user['role'], $newPassword, $user['jenis_pengadil'], true);



            echo json_encode([

                'error' => false,

                'message' => $emailSent
                    ? 'Emel notifikasi pendaftaran berjaya dihantar semula.'
                    : 'Kata laluan berjaya direset. (Emel notifikasi gagal dihantar)',

                'newPassword' => $newPassword

            ]);

            exit;

        }

        

        http_response_code(400);

        echo json_encode(['error' => true, 'message' => 'Aksi tidak sah.']);

        exit;

    }

    

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {

        // Delete user - support both JSON body and query param

        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: [];

        $userId = $input['userId'] ?? $_GET['id'] ?? 0;

        

        if (!$userId) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'ID pengguna diperlukan.']);

            exit;

        }

        

        // Check if user exists

        $checkStmt = $pdo->prepare("SELECT id, nama_penuh FROM users WHERE id = ?");

        $checkStmt->execute([$userId]);

        $user = $checkStmt->fetch(PDO::FETCH_ASSOC);

        

        if (!$user) {

            http_response_code(404);

            echo json_encode(['error' => true, 'message' => 'Pengguna tidak dijumpai.']);

            exit;

        }

        

        // Prevent deleting own account

        if ($userId == $_SESSION['user_id']) {

            http_response_code(400);

            echo json_encode(['error' => true, 'message' => 'Anda tidak boleh memadam akaun sendiri.']);

            exit;

        }

        

        // Delete user

        $deleteStmt = $pdo->prepare("DELETE FROM users WHERE id = ?");

        $deleteStmt->execute([$userId]);

        

        echo json_encode([

            'error' => false,

            'message' => 'Pengguna berjaya dipadam.',

            'deletedUser' => $user['nama_penuh']

        ]);

        

        exit;

    }

    

    http_response_code(405);

    echo json_encode(['error' => true, 'message' => 'Method not allowed']);

    

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([

        'error' => true,

        'message' => APP_DEBUG ? $e->getMessage() : 'Ralat sistem berlaku.',

        'line' => APP_DEBUG ? $e->getLine() : null

    ]);

}



function getPersatuanList($pdo) {

    $stmt = $pdo->prepare("SELECT id, nama_persatuan FROM persatuan_bolasepak_daerah ORDER BY nama_persatuan");

    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);

}



/**

 * Send user registration email with login credentials

 */

function sendUserRegistrationEmail($to, $nama, $role, $password, $jenisPengadil = null, $isReset = false) {

    require_once __DIR__ . '/../config/email.php';

    $roleNames = [
        'Admin'      => 'Administrator',
        'PP Daerah'  => 'Penolong Pegawai Pembangunan Daerah',
        'Pengadil'   => 'Pengadil',
        'Penilai'    => 'Penilai Pengadil',
    ];
    $roleDisplay = $roleNames[$role] ?? $role;

    $subject = $isReset
        ? "Reset Kata Laluan - Sistem Pengurusan Pengadil PBNP"
        : "Akaun Berjaya Didaftarkan - Sistem Pengurusan Pengadil PBNP";

    $accentColor = $isReset ? '#F59E0B' : '#111827';
    $accentIcon  = '';
    $bannerTitle = $isReset ? 'Reset Kata Laluan' : 'Akaun Berjaya Didaftarkan';

    $rows = [
        ['Nama',    htmlspecialchars($nama)],
        ['Peranan', htmlspecialchars($roleDisplay)],
        ['Emel',    htmlspecialchars($to)],
    ];
    if ($jenisPengadil) {
        $rows[] = ['Jenis Pengadil', htmlspecialchars($jenisPengadil)];
    }

    $body  = emailGreeting($nama);
    $body .= emailPara($isReset
        ? 'Kata laluan akaun anda dalam <strong>Sistem Pengurusan Pengadil Persatuan Bola Sepak Negeri Pahang</strong> telah <strong>direset</strong> oleh pentadbir.'
        : 'Akaun anda dalam <strong>Sistem Pengurusan Pengadil Persatuan Bola Sepak Negeri Pahang</strong> telah berjaya didaftarkan.');
    $body .= emailInfoTable($rows);
    $body .= emailPara($isReset ? '<strong>Kata Laluan Baru:</strong>' : '<strong>Maklumat Log Masuk:</strong>');
    $body .= emailCredBox('Emel / ID Pengguna', htmlspecialchars($to));
    $body .= emailCredBox($isReset ? 'Kata Laluan Baru' : 'Kata Laluan', htmlspecialchars($password));
    $body .= emailAlert('#F59E0B', '#FFFBEB', 'Keselamatan Akaun',
        'Simpan kata laluan ini dengan selamat. ' .
        ($isReset ? '<strong>Kata laluan lama anda tidak lagi sah.</strong> ' : '') .
        'Anda <strong>digalakkan menukar kata laluan</strong> selepas log masuk pertama. Jangan kongsikan maklumat log masuk dengan sesiapa.');
    $body .= emailButton('https://refpahang.com/index.html', 'Log Masuk ke Sistem');

    $htmlBody = buildEmailTemplate($bannerTitle, $accentColor, $accentIcon, $body);

    return sendEmail($to, $subject, $htmlBody, $nama, 'admin');
}



/**

 * Get role-specific features for email

 */

function getRoleFeatures($role) {

    switch ($role) {

        case 'Admin':

            return "

                <li>Urus semua pengguna sistem</li>

                <li>Luluskan permohonan pengadil</li>

                <li>Papar laporan dan statistik</li>

                <li>Urus tetapan sistem</li>

            ";

        case 'PP Daerah':

            return "

                <li>Semak permohonan dari daerah</li>

                <li>Verify dokumen permohonan</li>

                <li>Hantar ke admin untuk kelulusan</li>

                <li>Urus program pembangunan</li>

            ";

        case 'Pengadil':

            return "

                <li>Hantar permohonan pendaftaran</li>

                <li>Semak status permohonan</li>

                <li>Terima penugasan perlawanan</li>

                <li>Lihat rekod penilaian</li>

            ";

        case 'Penilai':

            return "

                <li>Nilai prestasi pengadil</li>

                <li>Semak rekod penilaian</li>

                <li>Terima penugasan penilaian</li>

                <li>Lihat laporan penilaian</li>

            ";

        default:

            return "<li>Akses asas sistem</li>";

    }

}