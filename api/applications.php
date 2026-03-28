<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/user-utils.php';

$method = $_SERVER['REQUEST_METHOD'];

// Handle POST with action parameter for status updates (InfinityFree compatibility)
if ($method === 'POST' && isset($_GET['action']) && $_GET['action'] === 'update-status') {
    handleStatusUpdate();
    exit;
}

switch ($method) {
    case 'GET':
        handleList();
        break;
    case 'POST':
        handleCreate();
        break;
    case 'PATCH':
        handleStatusUpdate();
        break;
    default:
        jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
}

function handleList(): void
{
    requireAdmin();

    $status = isset($_GET['status']) ? trim($_GET['status']) : null;
    $keyword = isset($_GET['q']) ? trim($_GET['q']) : null;

    try {
        $pdo = getDbConnection();

        $sql = 'SELECT a.* FROM permohonan a';
        $conds = [];
        $params = [];

        if ($status && in_array($status, ['Pending', 'Approved', 'Rejected'], true)) {
            $conds[] = 'a.status = :status';
            $params[':status'] = $status;
        }

        if ($keyword) {
            $conds[] = '(a.nama_penuh LIKE :kw OR a.no_kp LIKE :kw OR a.emel LIKE :kw)';
            $params[':kw'] = "%$keyword%";
        }

        if ($conds) {
            $sql .= ' WHERE ' . implode(' AND ', $conds);
        }

        $sql .= ' ORDER BY a.tarikh_hantar DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $records = $stmt->fetchAll();

        foreach ($records as &$record) {
            $record['perlawanan'] = fetchMatches($pdo, (int) $record['id']);
        }

        jsonResponse(['error' => false, 'data' => $records]);
    } catch (Throwable $e) {
        error_log('[applications.php] handleList: ' . $e->getMessage());
        $message = APP_DEBUG ? 'Ralat semasa memuatkan permohonan: ' . $e->getMessage() : 'Ralat semasa memuatkan permohonan.';
        jsonResponse(['error' => true, 'message' => $message], 500);
    }
}

function handleCreate(): void
{
    $input = getJsonInput();

    $required = [
        'nama_penuh', 'no_kp', 'emel', 'no_telefon', 'jantina', 'jenis_pengadil', 'daerah_bertugas',
        'alamat1', 'poskod', 'daerah', 'negeri',
        'status_kerja', 'nama_waris', 'hubungan_waris', 'telefon_waris',
    ];

    $missing = array_filter($required, fn($field) => empty($input[$field]));
    if ($missing) {
        jsonResponse(['error' => true, 'message' => 'Medan berikut diperlukan: ' . implode(', ', $missing)], 422);
    }

    // Validate email format
    $email = strtolower(trim($input['emel']));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => true, 'message' => 'Format emel tidak sah.'], 422);
    }

    try {
        $pdo = getDbConnection();
        
        // Check if email already exists
        $checkEmail = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $checkEmail->execute([':email' => $email]);
        if ($checkEmail->fetch()) {
            jsonResponse(['error' => true, 'message' => 'Emel ini telah didaftarkan. Sila gunakan emel lain.'], 422);
        }
        
        // Validate and get persatuan_id
        $districtName = $input['daerah_bertugas'];
        $districtStmt = $pdo->prepare('SELECT id FROM persatuan_bolasepak_daerah WHERE nama = :nama LIMIT 1');
        $districtStmt->execute([':nama' => $districtName]);
        $district = $districtStmt->fetch();
        
        if (!$district) {
            jsonResponse(['error' => true, 'message' => 'Daerah tidak sah: ' . $districtName], 422);
        }
        
        $persatuanId = (int) $district['id'];
        
        $pdo->beginTransaction();

        $sql = <<<'SQL'
            INSERT INTO permohonan
                (user_id, persatuan_id, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, 
                 alamat1, alamat2, poskod, daerah, negeri,
                 status_kerja, jawatan, nama_majikan, alamat_majikan1, alamat_majikan2, poskod_majikan,
                 daerah_majikan, negeri_majikan, nama_waris, hubungan_waris, telefon_waris, url_resit,
                 url_gambar_profil, status, status_workflow, tarikh_hantar)
            VALUES
                (:user_id, :persatuan_id, :nama_penuh, :no_kp, :emel, :no_telefon, :jantina, :jenis_pengadil,
                 :alamat1, :alamat2, :poskod, :daerah, :negeri,
                 :status_kerja, :jawatan, :nama_majikan, :alamat_majikan1, :alamat_majikan2, :poskod_majikan,
                 :daerah_majikan, :negeri_majikan, :nama_waris, :hubungan_waris, :telefon_waris, :url_resit,
                 :url_gambar_profil, 'Pending', 'Menunggu PP Daerah', NOW())
        SQL;

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':user_id' => null, // Will be updated after user creation
            ':persatuan_id' => $persatuanId,
            ':nama_penuh' => $input['nama_penuh'],
            ':no_kp' => $input['no_kp'],
            ':emel' => $email,
            ':no_telefon' => $input['no_telefon'],
            ':jantina' => $input['jantina'],
            ':jenis_pengadil' => $input['jenis_pengadil'],
            ':alamat1' => $input['alamat1'],
            ':alamat2' => $input['alamat2'] ?? null,
            ':poskod' => $input['poskod'],
            ':daerah' => $input['daerah'],
            ':negeri' => $input['negeri'],
            ':status_kerja' => $input['status_kerja'],
            ':jawatan' => $input['jawatan'] ?? null,
            ':nama_majikan' => $input['nama_majikan'] ?? null,
            ':alamat_majikan1' => $input['alamat_majikan1'] ?? null,
            ':alamat_majikan2' => $input['alamat_majikan2'] ?? null,
            ':poskod_majikan' => $input['poskod_majikan'] ?? null,
            ':daerah_majikan' => $input['daerah_majikan'] ?? null,
            ':negeri_majikan' => $input['negeri_majikan'] ?? null,
            ':nama_waris' => $input['nama_waris'],
            ':hubungan_waris' => $input['hubungan_waris'],
            ':telefon_waris' => $input['telefon_waris'],
            ':url_resit' => $input['url_resit'] ?? null,
            ':url_gambar_profil' => $input['url_gambar_profil'] ?? null,
        ]);

        $applicationId = (int) $pdo->lastInsertId();

        // Insert match records
        if (!empty($input['perlawanan']) && is_array($input['perlawanan'])) {
            $stmtMatch = $pdo->prepare('
                INSERT INTO perlawanan 
                    (permohonan_id, tarikh, jenis, tempat, jawatan, persatuan_id) 
                VALUES 
                    (:permohonan_id, :tarikh, :jenis, :tempat, :jawatan, :persatuan_id)
            ');
            foreach ($input['perlawanan'] as $match) {
                if (empty($match['tarikh'])) {
                    continue;
                }
                $stmtMatch->execute([
                    ':permohonan_id' => $applicationId,
                    ':tarikh' => $match['tarikh'],
                    ':jenis' => $match['jenis'] ?? null,
                    ':tempat' => $match['tempat'] ?? null,
                    ':jawatan' => $match['jawatan'] ?? null,
                    ':persatuan_id' => $persatuanId,
                ]);
            }
        }

        // Create user account and link to application
        $userResult = createUserFromApplication($pdo, $input, $persatuanId);
        
        // Update permohonan with user_id
        $updateStmt = $pdo->prepare('UPDATE permohonan SET user_id = :user_id WHERE id = :id');
        $updateStmt->execute([
            ':user_id' => $userResult['user_id'],
            ':id' => $applicationId,
        ]);
        
        $pdo->commit();

        // Send welcome email with login credentials
        sendWelcomeEmail(
            $email,
            $input['nama_penuh'],
            $userResult['temp_password']
        );

        // Send application copy to applicant
        sendApplicationCopyEmail($input, $applicationId);

        // Notify PP Daerah (PDF URL will be generated in function)
        notifyPPDaerah($pdo, $persatuanId, $input, '');


        jsonResponse([
            'error' => false,
            'message' => 'Permohonan berjaya dihantar. Emel dengan maklumat log masuk telah dihantar ke ' . $email,
            'data' => [
                'id' => $applicationId,
                'user_id' => $userResult['user_id'],
            ],
        ], 201);
        
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[applications.php] handleCreate: ' . $e->getMessage() . ' on line ' . $e->getLine());
        $message = APP_DEBUG ? 'Gagal menyimpan permohonan: ' . $e->getMessage() : 'Gagal menyimpan permohonan.';
        jsonResponse(['error' => true, 'message' => $message], 500);
    }
}

function handleStatusUpdate(): void
{
    requireAdmin();

    $input = getJsonInput();
    $id = isset($input['id']) ? (int) $input['id'] : 0;
    $status = $input['status'] ?? '';

    if ($id <= 0 || !in_array($status, ['Pending', 'Approved', 'Rejected'], true)) {
        jsonResponse(['error' => true, 'message' => 'Data status tidak sah.'], 422);
    }

    try {
        $pdo = getDbConnection();
        $fetch = $pdo->prepare('SELECT nama_penuh, emel, status FROM permohonan WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => $id]);
        $application = $fetch->fetch();

        if (!$application) {
            jsonResponse(['error' => true, 'message' => 'Permohonan tidak ditemui.'], 404);
        }

        if ($application['status'] === $status) {
            jsonResponse(['error' => false, 'message' => 'Status permohonan tidak berubah.']);
        }

        $stmt = $pdo->prepare('UPDATE permohonan SET status = :status, status_kemaskini = NOW() WHERE id = :id');
        $stmt->execute([
            ':status' => $status,
            ':id' => $id,
        ]);

        if ($stmt->rowCount() === 0) {
            jsonResponse(['error' => true, 'message' => 'Tiada perubahan dilakukan.'], 500);
        }

        $adminEmail = 'pbnpreferees@gmail.com';
        sendStatusEmail([
            'nama_penuh' => $application['nama_penuh'],
            'emel' => $application['emel'],
        ], $status, $adminEmail);

        jsonResponse(['error' => false, 'message' => 'Status permohonan dikemas kini dan emel pemberitahuan dihantar.']);
    } catch (Throwable $e) {
        error_log('[applications.php] handleStatusUpdate: ' . $e->getMessage());
        $message = APP_DEBUG ? 'Gagal mengemas kini status: ' . $e->getMessage() : 'Gagal mengemas kini status.';
        jsonResponse(['error' => true, 'message' => $message], 500);
    }
}

function fetchMatches(PDO $pdo, int $applicationId): array
{
    $stmt = $pdo->prepare('SELECT id, tarikh, jenis, tempat, jawatan FROM perlawanan WHERE permohonan_id = :id ORDER BY tarikh ASC');
    $stmt->execute([':id' => $applicationId]);
    return $stmt->fetchAll();
}

function sendStatusEmail(array $application, string $newStatus, string $adminEmail): void
{
    require_once __DIR__ . '/../config/email.php';

    $statusConfig = [
        'Pending'  => ['label' => 'Menunggu Semakan', 'accent' => '#2563EB', 'icon' => '', 'banner' => 'Kemaskini Status Permohonan'],
        'Approved' => ['label' => 'Diluluskan',        'accent' => '#16A34A', 'icon' => '', 'banner' => 'Permohonan Diluluskan'],
        'Rejected' => ['label' => 'Ditolak',           'accent' => '#DC2626', 'icon' => '', 'banner' => 'Permohonan Ditolak'],
    ];

    $cfg    = $statusConfig[$newStatus] ?? $statusConfig['Pending'];
    $label  = $cfg['label'];
    $subject = "Kemaskini Status Permohonan Pengadil - PBNP";

    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailPara("Status permohonan pengadil anda telah dikemaskini kepada:");
    $body .= emailStatusBadge($label, $cfg['accent']);
    if ($newStatus === 'Approved') {
        $body .= emailAlert('#16A34A', '#F0FDF4', 'Selamat!', 'Permohonan anda telah diluluskan. Sila log masuk ke dashboard untuk maklumat lanjut.');
    } elseif ($newStatus === 'Rejected') {
        $body .= emailAlert('#DC2626', '#FEF2F2', 'Tidak Berjaya', 'Permohonan anda tidak berjaya pada kali ini. Untuk pertanyaan atau rayuan, sila hubungi <a href="mailto:support@refpahang.com" style="color:#2563EB;">support@refpahang.com</a>.');
    }
    $body .= emailButton('https://refpahang.com/pengadil-dashboard.html', 'Semak Dashboard');

    $html = buildEmailTemplate($cfg['banner'], $cfg['accent'], $cfg['icon'], $body);
    sendEmail($application['emel'], $subject, $html, $application['nama_penuh'], 'daftar');
}

function sendApplicationCopyEmail(array $application, int $applicationId): void
{
    require_once __DIR__ . '/../config/email.php';

    $refNo   = 'REF-' . str_pad((string) $applicationId, 6, '0', STR_PAD_LEFT);
    $subject = 'Salinan Borang Permohonan Pengadil - ' . $refNo;

    $rows = [
        'No. Rujukan'   => $refNo,
        'Nama Penuh'    => $application['nama_penuh'],
        'No. Kad Pengenalan' => $application['no_kp'],
        'Emel'          => $application['emel'],
        'No. Telefon'   => $application['no_telefon'],
        'Jantina'       => $application['jantina'],
        'Jenis Pengadil'=> $application['jenis_pengadil'],
        'Daerah Bertugas' => $application['daerah_bertugas'] ?? ($application['daerah'] ?? '-'),
        'Status'        => 'Menunggu Semakan',
    ];

    $body  = emailGreeting($application['nama_penuh']);
    $body .= emailPara('Terima kasih kerana menghantar permohonan pendaftaran sebagai pengadil Pahang FA. Berikut adalah ringkasan maklumat permohonan anda.');
    $body .= emailInfoTable($rows);
    $body .= emailAlert('#2563EB', '#EFF6FF', 'Makluman', 'Permohonan anda sedang dalam proses semakan. Anda akan menerima emel pemberitahuan apabila terdapat kemaskini status.');
    $body .= emailButton('https://refpahang.com/pengadil-dashboard.html', 'Semak Status Permohonan');

    $html = buildEmailTemplate('Salinan Permohonan Pengadil', '#2563EB', '', $body);
    sendEmail($application['emel'], $subject, $html, $application['nama_penuh'], 'daftar');
}
