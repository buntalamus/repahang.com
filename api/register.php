<?php

/**

 * API: Public Registration

 * Handles basic registration for new referees

 * Creates user account with generated password and sends welcome email

 */



require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/../config/email.php';



// Get database connection

$pdo = getDbConnection();



header('Content-Type: application/json');



// Only allow POST requests

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    http_response_code(405);

    echo json_encode(['error' => true, 'message' => 'Method not allowed']);

    exit;

}



try {

    // Get JSON input

    $input = json_decode(file_get_contents('php://input'), true);

    

    if (!$input) {

        throw new Exception('Invalid JSON input');

    }

    // Normalize field names from Angular component
    if (isset($input['no_ic']) && !isset($input['no_kp'])) {
        $input['no_kp'] = $input['no_ic'];
    }
    if (isset($input['persatuan_id']) && !isset($input['persatuan_bolasepak'])) {
        // Map numeric persatuan_id to persatuan code
        $idToCode = [
            1 => 'PBDBTG', 2 => 'PBDBRA', 3 => 'PBDCMH', 4 => 'PBDJRT',
            5 => 'PBDKTN', 6 => 'PBDLPS', 7 => 'PBDMRN', 8 => 'PBDPKN',
            9 => 'PBDRUB', 10 => 'PBDRMP', 11 => 'PBDTML', 12 => 'PBDMDS',
        ];
        $pid = (int) $input['persatuan_id'];
        $input['persatuan_bolasepak'] = $idToCode[$pid] ?? '';
    }

    // Validate required fields

    $required = ['nama_penuh', 'no_kp', 'email', 'no_telefon', 'jantina', 'jenis_pengadil', 'persatuan_bolasepak'];

    foreach ($required as $field) {

        if (empty($input[$field])) {

            throw new Exception("Field '$field' diperlukan!");

        }

    }



    // Validate daerah if Pegawai Pembangunan

    if ($input['jenis_pengadil'] === 'Pegawai Pembangunan') {

        if (empty($input['daerah'])) {

            throw new Exception("Daerah diperlukan untuk Pegawai Pembangunan!");

        }

        

        // Validate Persatuan Bolasepak Daerah code

        $validPersatuanCodes = [

            'PBDBTG', 'PBDBRA', 'PBDCMH', 'PBDJRT', 'PBDKTN', 

            'PBDLPS', 'PBDMRN', 'PBDMDS', 'PBDPKN', 'PBDRUB', 'PBDRMP', 'PBDTML'

        ];

        

        if (!in_array($input['daerah'], $validPersatuanCodes)) {

            throw new Exception("Kod Persatuan Bolasepak Daerah tidak sah!");

        }

        

        $persatuanId = $input['daerah'];

    } else {

        // For regular referees, validate and store their persatuan_bolasepak

        $validPersatuanCodes = [

            'PBDBTG', 'PBDBRA', 'PBDCMH', 'PBDJRT', 'PBDKTN', 

            'PBDLPS', 'PBDMRN', 'PBDMDS', 'PBDPKN', 'PBDRUB', 'PBDRMP', 'PBDTML'

        ];

        

        if (!in_array($input['persatuan_bolasepak'], $validPersatuanCodes)) {

            throw new Exception("Kod Persatuan Bolasepak tidak sah!");

        }

        

        $persatuanId = $input['persatuan_bolasepak'];

    }



    // Convert persatuan code to district_id

    $districtCodeToId = [

        'PBDBTG' => 1,   // Bentong

        'PBDBRA' => 2,   // Bera

        'PBDCMH' => 3,   // Cameron Highlands

        'PBDJRT' => 4,   // Jerantut

        'PBDKTN' => 5,   // Kuantan

        'PBDLPS' => 6,   // Lipis

        'PBDMRN' => 7,   // Maran

        'PBDMDS' => 12,  // Muadzam Shah

        'PBDPKN' => 8,   // Pekan

        'PBDRUB' => 9,   // Raub

        'PBDRMP' => 10,  // Rompin

        'PBDTML' => 11   // Temerloh

    ];



    $districtId = isset($districtCodeToId[$persatuanId]) ? $districtCodeToId[$persatuanId] : null;



    // Convert code to full name for new system

    $codeToName = [

        'PBDBTG' => 'Persatuan Bolasepak Daerah Bentong',

        'PBDBRA' => 'Persatuan Bolasepak Daerah Bera',

        'PBDCMH' => 'Persatuan Bolasepak Daerah Cameron Highlands',

        'PBDJRT' => 'Persatuan Bolasepak Daerah Jerantut',

        'PBDKTN' => 'Persatuan Bolasepak Daerah Kuantan',

        'PBDLPS' => 'Persatuan Bolasepak Daerah Lipis',

        'PBDMRN' => 'Persatuan Bolasepak Daerah Maran',

        'PBDMDS' => 'Persatuan Bolasepak Daerah Muadzam Shah',

        'PBDPKN' => 'Persatuan Bolasepak Daerah Pekan',

        'PBDRUB' => 'Persatuan Bolasepak Daerah Raub',

        'PBDRMP' => 'Persatuan Bolasepak Daerah Rompin',

        'PBDTML' => 'Persatuan Bolasepak Daerah Temerloh'

    ];



    $persatuanName = isset($codeToName[$persatuanId]) ? $codeToName[$persatuanId] : null;



    // Also set persatuan_id for new system

    $persatuanIdNew = $districtId; // Same ID for now



    // Validate IC format (12 digits)

    if (!preg_match('/^\d{12}$/', $input['no_kp'])) {

        throw new Exception('No. Kad Pengenalan mesti 12 digit sahaja!');

    }



    // Validate email format

    if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {

        throw new Exception('Format email tidak sah!');

    }



    // Validate phone format (10-11 digits)

    if (!preg_match('/^\d{10,11}$/', $input['no_telefon'])) {

        throw new Exception('No. telefon mesti 10-11 digit sahaja!');

    }



    // Check if IC already exists

    $stmt = $pdo->prepare("SELECT id FROM users WHERE no_ic = ?");

    $stmt->execute([$input['no_kp']]);

    if ($stmt->fetch()) {

        throw new Exception('No. Kad Pengenalan ini telah didaftarkan!');

    }



    // Check if email already exists

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");

    $stmt->execute([$input['email']]);

    if ($stmt->fetch()) {

        throw new Exception('Alamat emel ini telah didaftarkan!');

    }



    // Determine role based on jenis_pengadil

    $role = 'Pengadil'; // default

    if ($input['jenis_pengadil'] === 'Pegawai Pembangunan') {

        $role = 'PP Daerah';

    }



    // Generate random password (10 characters: cryptographically secure)
    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $password = '';
    $max = strlen($chars) - 1;
    for ($i = 0; $i < 10; $i++) {
        $password .= $chars[random_int(0, $max)];
    }
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);



    // Insert new user

    $stmt = $pdo->prepare("

        INSERT INTO users (

            email, 

            password, 

            role, 

            district_id,

            persatuan_id,

            nama_penuh, 

            no_ic, 

            no_telefon, 

            jantina,

            jenis_pengadil,

            aktif,

            password_changed,

            created_at

        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())

    ");



    $stmt->execute([

        $input['email'],

        $hashedPassword,

        $role,

        $districtId,

        $persatuanIdNew,

        strtoupper($input['nama_penuh']),

        $input['no_kp'],

        $input['no_telefon'],

        strtoupper($input['jantina']),

        $input['jenis_pengadil']

    ]);



    $userId = $pdo->lastInsertId();

    // Generate Telegram link token for immediate linking
    $tgLinkToken = bin2hex(random_bytes(16));
    $pdo->prepare("UPDATE users SET tg_link_token = ? WHERE id = ?")->execute([$tgLinkToken, $userId]);
    $botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');
    $telegramLink = "https://t.me/{$botUsername}?start={$tgLinkToken}";

    // Send welcome email with credentials

    $emailSent = sendWelcomeEmail(

        $input['email'],

        $input['nama_penuh'],

        $input['email'], // username = email

        $password,

        $role, // Pass role to customize email content

        $telegramLink

    );



    // Create notification for user
    $stmt = $pdo->prepare("
        INSERT INTO notifications (user_id, type, subject, message, created_at)
        VALUES (?, 'Permohonan Diterima', 'Pendaftaran Berjaya', 'Selamat datang! Akaun anda telah berjaya didaftarkan. Sila lengkapkan profil anda di dashboard.', NOW())
    ");
    $stmt->execute([$userId]);



    // Success response

    echo json_encode([

        'error' => false,

        'message' => 'Pendaftaran berjaya! Email dengan kata laluan telah dihantar ke ' . $input['email'],

        'user_id' => $userId,

        'email_sent' => $emailSent,

        'telegram_link' => $telegramLink

    ]);



} catch (PDOException $e) {

    error_log('Registration DB error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Ralat pangkalan data semasa pendaftaran. Sila cuba lagi.'
    ]);

} catch (Exception $e) {

    http_response_code(400);

    echo json_encode([

        'error' => true,

        'message' => $e->getMessage()

    ]);

}



/**

 * Send welcome email with login credentials

 */

function sendWelcomeEmail($to, $nama, $username, $password, $role = 'Pengadil', $telegramLink = '') {

    $subject = "Selamat Datang - Sistem Pengurusan Unit Pengadil Persatuan Bola Sepak Negeri Pahang";

    $dashboardUrl = $role === 'PP Daerah'
        ? 'https://refpahang.com/pp-dashboard.html'
        : 'https://refpahang.com/index.html';

    if ($role === 'PP Daerah') {
        $nextStepsList = emailOrderedList([
            'Log masuk menggunakan emel dan kata laluan di atas.',
            'Lengkapkan profil anda (alamat, maklumat pekerjaan, waris).',
            'Muat naik gambar profil.',
            'Mula mengesahkan permohonan pengadil di daerah anda.',
        ]);
    } else {
        $nextStepsList = emailOrderedList([
            'Log masuk menggunakan emel dan kata laluan di atas.',
            'Lengkapkan profil anda (alamat, maklumat pekerjaan, waris).',
            'Muat naik gambar profil.',
            'Mulakan pengesahan perlawanan bersama PP Daerah.',
            'Setelah 20 perlawanan disahkan, hantar permohonan rasmi.',
        ]);
    }

    $body  = emailGreeting($nama);
    $body .= emailPara('Tahniah! Akaun anda dalam <strong>Sistem Pengurusan Pengadil Persatuan Bola Sepak Negeri Pahang</strong> telah berjaya didaftarkan.');
    $body .= emailPara('Berikut adalah maklumat log masuk anda:');
    $body .= emailCredBox('Alamat Emel', htmlspecialchars($username));
    $body .= emailCredBox('Kata Laluan', htmlspecialchars($password));
    $body .= emailAlert('#F59E0B', '#FFFBEB', 'Penting', 'Simpan kata laluan ini dengan selamat. Anda <strong>digalakkan menukar kata laluan</strong> selepas log masuk pertama. Jangan kongsikan maklumat log masuk dengan sesiapa.');
    $body .= emailPara('<strong>Langkah Seterusnya:</strong>');
    $body .= $nextStepsList;
    $body .= emailButton($dashboardUrl, 'Log Masuk Sekarang');

    // Telegram linking section
    if ($telegramLink) {
        $body .= emailPara('<strong>📱 Hubungkan Telegram</strong>');
        $body .= emailPara('Aktifkan notifikasi Telegram untuk menerima maklumat lantikan perlawanan terus ke telefon anda. Klik butang di bawah untuk menghubungkan akaun Telegram anda:');
        $body .= emailButton($telegramLink, 'Hubungkan Telegram');
    }

    $htmlBody = buildEmailTemplate('Akaun Berjaya Didaftarkan', '#16A34A', '', $body);

    return sendEmail($to, $subject, $htmlBody, $nama, 'daftar');
}

