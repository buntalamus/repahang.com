<?php

/**

 * User Management Utilities

 * Functions for creating users, generating passwords, sending credentials

 */



declare(strict_types=1);



/**

 * Generate random secure password

 */

function generatePassword(int $length = 10): string

{

    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    $password = '';

    $max = strlen($chars) - 1;

    

    for ($i = 0; $i < $length; $i++) {

        $password .= $chars[random_int(0, $max)];

    }

    

    return $password;

}



/**

 * Create user account for new referee application

 */

function createUserFromApplication(PDO $pdo, array $applicationData, int $persatuanId): array

{

    // Generate secure password

    $plainPassword = generatePassword(10);

    $hashedPassword = password_hash($plainPassword, PASSWORD_DEFAULT);

    

    // Insert user

    $stmt = $pdo->prepare('

        INSERT INTO users 

            (email, password, role, persatuan_id, nama_penuh, no_ic, no_telefon, aktif, password_changed)

        VALUES 

            (:email, :password, :role, :persatuan_id, :nama_penuh, :no_ic, :no_telefon, 1, 0)

    ');

    

    $stmt->execute([

        ':email' => strtolower(trim($applicationData['emel'])),

        ':password' => $hashedPassword,

        ':role' => 'Pengadil',

        ':persatuan_id' => $persatuanId,

        ':nama_penuh' => $applicationData['nama_penuh'],

        ':no_ic' => $applicationData['no_kp'],

        ':no_telefon' => $applicationData['no_telefon'],

    ]);

    

    $userId = (int) $pdo->lastInsertId();

    

    return [

        'user_id' => $userId,

        'temp_password' => $plainPassword,

    ];

}



/**

 * Send welcome email with login credentials

 */

function sendWelcomeEmail(string $email, string $nama, string $password): bool
{
    require_once __DIR__ . '/../config/email.php';

    $subject = 'Akaun Anda Berjaya Didaftarkan - Sistem Pengurusan Pengadil PBNP';

    $body  = emailGreeting($nama);
    $body .= emailPara('Terima kasih kerana menghantar permohonan pendaftaran sebagai pengadil dengan <strong>Unit Pengadil Persatuan Bola Sepak Negeri Pahang</strong>.');
    $body .= emailPara('Berikut adalah maklumat log masuk anda ke sistem:');
    $body .= emailCredBox('Alamat Emel / ID Pengguna', htmlspecialchars($email));
    $body .= emailCredBox('Kata Laluan Sementara', htmlspecialchars($password));
    $body .= emailAlert('#F59E0B', '#FFFBEB', 'PENTING', 'Sila <strong>tukar kata laluan</strong> anda selepas log masuk kali pertama untuk keselamatan akaun anda.');
    $body .= emailStatusBadge('Status: Menunggu Pengesahan PP Daerah', '#DBEAFE', '#1E40AF');
    $body .= emailPara('Penolong Pegawai Pembangunan Daerah akan menyemak dan mengesahkan rekod perlawanan anda. Anda akan diberitahu melalui emel apabila:');
    $body .= emailOrderedList([
        'PP Daerah telah mengesahkan rekod perlawanan anda.',
        'Permohonan anda diluluskan oleh pentadbir.',
        'Maklumat bayaran RM80 diperlukan.',
        'Permohonan anda lengkap dan diluluskan.',
    ]);
    $body .= emailButton('https://refpahang.com/admin-login.html', 'Log Masuk Sekarang');
    $body .= emailAlert('#2563EB', '#EFF6FF', 'Hubungi Kami', 'Jika anda mempunyai sebarang pertanyaan, sila emel kepada <a href="mailto:daftar@refpahang.com" style="color:#2563EB;">daftar@refpahang.com</a>.');

    $htmlContent = buildEmailTemplate('Akaun Berjaya Didaftarkan', '#16A34A', '', $body);

    return sendEmail($email, $subject, $htmlContent, $nama, 'daftar');
}



/**

 * Send PP Daerah notification email

 */

function notifyPPDaerah(PDO $pdo, int $persatuanId, array $applicationData, string $pdfUrl): bool
{
    require_once __DIR__ . '/../config/email.php';

    // Get PP Daerah for this persatuan
    $stmt = $pdo->prepare(
        "SELECT u.id, u.nama_penuh, u.email
         FROM users u
         JOIN persatuan p ON p.pp_daerah_id = u.id
         WHERE p.id = :id AND u.aktif = 1
         LIMIT 1"
    );
    $stmt->execute([':id' => $persatuanId]);
    $ppDaerah = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$ppDaerah) {
        error_log("No active PP Daerah found for persatuan ID: $persatuanId");
        return false;
    }

    $pemohonNama   = $applicationData['nama_penuh'];
    $pemohonEmail  = $applicationData['emel'];
    $pemohonIC     = $applicationData['no_kp'];
    $jenisPengadil = $applicationData['jenis_pengadil'];

    $subject = "Permohonan Baru Memerlukan Pengesahan - {$pemohonNama}";

    $body  = emailGreeting($ppDaerah['nama_penuh']);
    $body .= emailPara('Permohonan pendaftaran pengadil baru telah diterima untuk daerah anda. Sila semak dan sahkan maklumat serta rekod perlawanan pemohon.');
    $body .= emailInfoTable([
        ['Nama Penuh',     htmlspecialchars($pemohonNama)],
        ['No. Kad Pengenalan', htmlspecialchars($pemohonIC)],
        ['Emel',          htmlspecialchars($pemohonEmail)],
        ['Jenis Pengadil', htmlspecialchars($jenisPengadil)],
    ]);
    $body .= emailAlert('#2563EB', '#EFF6FF', 'Tindakan Diperlukan', implode('<br>', [
        '1. Log masuk ke dashboard PP Daerah.',
        '2. Semak borang permohonan pemohon.',
        '3. Sahkan rekod perlawanan pemohon.',
        '4. Luluskan atau tolak permohonan dengan catatan.',
    ]));
    $body .= emailButton('https://refpahang.com/pp-dashboard.html', 'Semak Permohonan');

    $html = buildEmailTemplate('Permohonan Baru - Pengesahan Diperlukan', '#7C3AED', '', $body);

    return sendEmail($ppDaerah['email'], $subject, $html, $ppDaerah['nama_penuh'], 'daftar');
}

