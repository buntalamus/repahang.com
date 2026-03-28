<?php
/**
 * Pengadil Application API
 * GET: Retrieve current user's application
 * POST: Submit new application
 */

require_once 'bootstrap.php';
require_once __DIR__ . '/../config/email.php';

header('Content-Type: application/json');

try {
    // Require authentication
    requireAuth();
    
    // Must be pengadil
    if ($_SESSION['user_role'] !== 'Pengadil') {
        http_response_code(403);
        echo json_encode(['error' => true, 'message' => 'Akses ditolak. Hanya pengadil boleh mengakses.']);
        exit;
    }
    
    $pdo = getDbConnection();
    $userId = $_SESSION['user_id'];
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get existing applications for this user, optionally filtered by jenis_borang
        $jenisBorang = $_GET['jenis_borang'] ?? null;
        
        $sql = "
            SELECT 
                id,
                jenis_borang,
                nama_penuh,
                no_kp,
                emel,
                no_telefon,
                jantina,
                jenis_pengadil,
                status_workflow as status,
                payment_amount,
                tarikh_hantar,
                DATE_FORMAT(tarikh_hantar, '%d/%m/%Y') as tarikh_mohon,
                pp_verified_at,
                pp_notes,
                admin_approved_at,
                admin_notes as catatan,
                YEAR(tarikh_hantar) as tahun_permohonan
            FROM permohonan
            WHERE user_id = :user_id
        ";
        
        // Filter by jenis_borang if provided
        if ($jenisBorang) {
            $sql .= " AND jenis_borang = :jenis_borang";
        }
        
        $sql .= " ORDER BY tarikh_hantar DESC";
        
        $stmt = $pdo->prepare($sql);
        $params = ['user_id' => $userId];
        
        if ($jenisBorang) {
            $params['jenis_borang'] = $jenisBorang;
        }
        
        $stmt->execute($params);
        $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'error' => false,
            'applications' => $applications,
            'message' => count($applications) > 0 ? '' : 'Tiada permohonan dijumpai.'
        ]);
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Check if user already has an application
        $checkStmt = $pdo->prepare("SELECT id FROM permohonan WHERE user_id = :user_id LIMIT 1");
        $checkStmt->execute(['user_id' => $userId]);
        
        if ($checkStmt->fetch()) {
            http_response_code(400);
            echo json_encode([
                'error' => true,
                'message' => 'Anda sudah mempunyai permohonan. Sila hubungi admin jika perlu bantuan.'
            ]);
            exit;
        }
        
        // Check eligibility (must have at least 20 verified matches)
        // This applies to ALL application types including Ujian Bertulis
        $matchStmt = $pdo->prepare("
            SELECT COUNT(*) as verified_count
            FROM perlawanan
            WHERE user_id = :user_id 
            AND status_pp = 'Disahkan'
            AND YEAR(tarikh) = YEAR(CURDATE())
        ");
        $matchStmt->execute(['user_id' => $userId]);
        $matchData = $matchStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($matchData['verified_count'] < 20) {
            http_response_code(400);
            echo json_encode([
                'error' => true,
                'message' => 'Anda tidak layak memohon. Minimum 20 perlawanan yang disahkan diperlukan.',
                'verified_count' => $matchData['verified_count']
            ]);
            exit;
        }
        
        // Get form data from multipart/form-data
        $data = $_POST;
        $jenisBorang = $data['jenis_borang'] ?? 'pengadil_berdaftar';
        
        // For ujian_kecergasan, auto-populate from user profile
        if ($jenisBorang === 'ujian_kecergasan') {
            $profileStmt = $pdo->prepare("
                SELECT nama_penuh, no_ic, email, no_telefon, jantina, alamat1, alamat2, 
                       poskod, daerah, negeri, district_id, jenis_pengadil,
                       status_kerja, jawatan, nama_majikan, alamat_majikan1, alamat_majikan2,
                       poskod_majikan, daerah_majikan, negeri_majikan, saiz_baju
                FROM users 
                WHERE id = :user_id
            ");
            $profileStmt->execute(['user_id' => $userId]);
            $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($profile) {
                // Auto-populate ALL fields from profile except waris info (which user must input)
                $data['nama_penuh'] = $data['nama_penuh'] ?? $profile['nama_penuh'];
                $data['no_kp'] = $data['no_kp'] ?? $profile['no_ic']; // Map no_ic to no_kp
                $data['emel'] = $data['emel'] ?? $profile['email']; // Map email to emel
                $data['no_telefon'] = $data['no_telefon'] ?? $profile['no_telefon'];
                $data['jantina'] = $data['jantina'] ?? $profile['jantina'];
                $data['alamat1'] = $data['alamat1'] ?? $profile['alamat1'];
                $data['alamat2'] = $data['alamat2'] ?? $profile['alamat2'];
                $data['poskod'] = $data['poskod'] ?? $profile['poskod'];
                $data['daerah'] = $data['daerah'] ?? $profile['daerah'];
                $data['negeri'] = $data['negeri'] ?? $profile['negeri'];
                $data['jenis_pengadil'] = $data['jenis_pengadil'] ?? $profile['jenis_pengadil'];
                $data['status_kerja'] = $data['status_kerja'] ?? $profile['status_kerja'];
                $data['jawatan'] = $data['jawatan'] ?? $profile['jawatan'];
                $data['nama_majikan'] = $data['nama_majikan'] ?? $profile['nama_majikan'];
                $data['alamat_majikan1'] = $data['alamat_majikan1'] ?? $profile['alamat_majikan1'];
                $data['alamat_majikan2'] = $data['alamat_majikan2'] ?? $profile['alamat_majikan2'];
                $data['poskod_majikan'] = $data['poskod_majikan'] ?? $profile['poskod_majikan'];
                $data['daerah_majikan'] = $data['daerah_majikan'] ?? $profile['daerah_majikan'];
                $data['negeri_majikan'] = $data['negeri_majikan'] ?? $profile['negeri_majikan'];
                $data['saiz_baju'] = $data['saiz_baju'] ?? $profile['saiz_baju'];
            }
        }
        
        // Validate required fields based on jenis_borang
        if ($jenisBorang === 'pengadil_berdaftar') {
            $required = ['nama_penuh', 'no_kp', 'jantina', 'emel', 'no_telefon', 'jenis_pengadil',
                        'alamat1', 'poskod', 'daerah', 'negeri', 'status_kerja',
                        'nama_waris', 'hubungan_waris', 'telefon_waris', 'saiz_baju'];
        } elseif ($jenisBorang === 'pengadil_futsal') {
            $required = ['nama_penuh', 'no_kp', 'jantina', 'emel', 'no_telefon',
                        'alamat1', 'poskod', 'daerah', 'negeri'];
        } elseif ($jenisBorang === 'ujian_kecergasan') {
            // Only validate what user actually needs to input
            $required = ['nama_waris', 'hubungan_waris', 'telefon_waris'];
            // Other fields auto-populated from profile
        } else {
            $required = ['nama_penuh', 'no_kp', 'jantina', 'emel', 'no_telefon'];
        }
        
        foreach ($required as $field) {
            if (empty($data[$field])) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => "Field '$field' diperlukan."
                ]);
                exit;
            }
        }
        
        // Validate file uploads - only for pengadil_berdaftar
        if ($jenisBorang === 'pengadil_berdaftar') {
            if (!isset($_FILES['resit']) || $_FILES['resit']['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Resit bayaran diperlukan.']);
                exit;
            }
            
            if (!isset($_FILES['gambar']) || $_FILES['gambar']['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Gambar profil diperlukan.']);
                exit;
            }
        } elseif ($jenisBorang === 'pengadil_futsal') {
            if (!isset($_FILES['resit']) || $_FILES['resit']['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Resit bayaran diperlukan.']);
                exit;
            }
        }
        // No file uploads required for ujian_kecergasan
        
        // Create upload directory if not exists
        $uploadDir = __DIR__ . '/../uploads/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        
        // Initialize file URLs
        $resitUrl = null;
        $gambarUrl = null;
        
        // Upload resit - only for pengadil_berdaftar and pengadil_futsal
        if ($jenisBorang === 'pengadil_berdaftar' || $jenisBorang === 'pengadil_futsal') {
            $resitExt = pathinfo($_FILES['resit']['name'], PATHINFO_EXTENSION);
            $resitFilename = 'resit_' . $userId . '_' . time() . '.' . $resitExt;
            $resitPath = $uploadDir . $resitFilename;
            
            if (!move_uploaded_file($_FILES['resit']['tmp_name'], $resitPath)) {
                http_response_code(500);
                echo json_encode(['error' => true, 'message' => 'Gagal memuat naik resit bayaran.']);
                exit;
            }
            $resitUrl = '/uploads/' . $resitFilename;
        }
        
        // Upload gambar - only for pengadil_berdaftar
        if ($jenisBorang === 'pengadil_berdaftar') {
            $gambarExt = pathinfo($_FILES['gambar']['name'], PATHINFO_EXTENSION);
            $gambarFilename = 'gambar_' . $userId . '_' . time() . '.' . $gambarExt;
            $gambarPath = $uploadDir . $gambarFilename;
            
            if (!move_uploaded_file($_FILES['gambar']['tmp_name'], $gambarPath)) {
                http_response_code(500);
                echo json_encode(['error' => true, 'message' => 'Gagal memuat naik gambar profil.']);
                exit;
            }
            $gambarUrl = '/uploads/' . $gambarFilename;
        }
        
        // Get user's district_id
        $userStmt = $pdo->prepare("SELECT district_id FROM users WHERE id = :user_id");
        $userStmt->execute(['user_id' => $userId]);
        $userData = $userStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$userData || !$userData['district_id']) {
            http_response_code(400);
            echo json_encode([
                'error' => true,
                'message' => 'Maklumat daerah tidak dijumpai. Sila hubungi admin.'
            ]);
            exit;
        }
        
        // Insert application
        $insertStmt = $pdo->prepare("
            INSERT INTO permohonan (
                user_id,
                district_id,
                tahun_permohonan,
                jenis_borang,
                nama_penuh,
                no_kp,
                emel,
                no_telefon,
                jantina,
                jenis_pengadil,
                alamat1,
                alamat2,
                poskod,
                daerah,
                negeri,
                status_kerja,
                jawatan,
                nama_majikan,
                alamat_majikan1,
                alamat_majikan2,
                poskod_majikan,
                daerah_majikan,
                negeri_majikan,
                nama_waris,
                hubungan_waris,
                telefon_waris,
                url_resit,
                url_gambar_profil,
                saiz_baju,
                payment_amount,
                status,
                status_workflow,
                tarikh_hantar
            ) VALUES (
                :user_id,
                :district_id,
                YEAR(CURDATE()) + 1,
                :jenis_borang,
                :nama_penuh,
                :no_kp,
                :emel,
                :no_telefon,
                :jantina,
                :jenis_pengadil,
                :alamat1,
                :alamat2,
                :poskod,
                :daerah,
                :negeri,
                :status_kerja,
                :jawatan,
                :nama_majikan,
                :alamat_majikan1,
                :alamat_majikan2,
                :poskod_majikan,
                :daerah_majikan,
                :negeri_majikan,
                :nama_waris,
                :hubungan_waris,
                :telefon_waris,
                :url_resit,
                :url_gambar_profil,
                :saiz_baju,
                80.00,
                'Pending',
                'Menunggu Admin',
                NOW()
            )
        ");
        
        $insertStmt->execute([
            'user_id' => $userId,
            'district_id' => $userData['district_id'],
            'jenis_borang' => $data['jenis_borang'] ?? 'pengadil_berdaftar',
            'nama_penuh' => $data['nama_penuh'],
            'no_kp' => $data['no_kp'],
            'emel' => $data['emel'],
            'no_telefon' => $data['no_telefon'],
            'jantina' => $data['jantina'],
            'jenis_pengadil' => $data['jenis_pengadil'],
            'alamat1' => $data['alamat1'],
            'alamat2' => $data['alamat2'] ?? null,
            'poskod' => $data['poskod'],
            'daerah' => $data['daerah'],
            'negeri' => $data['negeri'],
            'status_kerja' => $data['status_kerja'],
            'jawatan' => $data['jawatan'] ?? null,
            'nama_majikan' => $data['nama_majikan'] ?? null,
            'alamat_majikan1' => $data['alamat_majikan1'] ?? null,
            'alamat_majikan2' => $data['alamat_majikan2'] ?? null,
            'poskod_majikan' => $data['poskod_majikan'] ?? null,
            'daerah_majikan' => $data['daerah_majikan'] ?? null,
            'negeri_majikan' => $data['negeri_majikan'] ?? null,
            'nama_waris' => $data['nama_waris'],
            'hubungan_waris' => $data['hubungan_waris'],
            'telefon_waris' => $data['telefon_waris'],
            'url_resit' => $resitUrl,
            'url_gambar_profil' => $gambarUrl,
            'saiz_baju' => $data['saiz_baju']
        ]);
        
        $applicationId = $pdo->lastInsertId();
        
        // Link all verified matches to this application
        $linkStmt = $pdo->prepare("
            UPDATE perlawanan 
            SET permohonan_id = :permohonan_id 
            WHERE user_id = :user_id 
            AND status_pp = 'Disahkan'
            AND YEAR(tarikh) = YEAR(CURDATE())
            AND (permohonan_id IS NULL OR permohonan_id = 0)
        ");
        $linkStmt->execute([
            'permohonan_id' => $applicationId,
            'user_id' => $userId
        ]);
        
        $linkedMatches = $linkStmt->rowCount();
        
        // Create notification for Admin users (not PP anymore)
        $notifStmt = $pdo->prepare("
            INSERT INTO notifications (user_id, type, subject, message, created_at)
            SELECT 
                u.id,
                'Permohonan Baru',
                'Permohonan & Bayaran Pengadil Baru',
                CONCAT('Permohonan dan bayaran daripada ', :nama_penuh, ' (', :jenis_pengadil, ') telah dihantar. Sila semak dan sahkan.'),
                NOW()
            FROM users u
            WHERE u.role = 'Admin'
        ");
        $notifStmt->execute([
            'nama_penuh' => $data['nama_penuh'],
            'jenis_pengadil' => $data['jenis_pengadil']
        ]);
        
        // Send success email to user
        $emailSent = sendApplicationSuccessEmail(
            $data['emel'],
            $data['nama_penuh'],
            $applicationId,
            $data['jenis_pengadil']
        );
        
        echo json_encode([
            'error' => false,
            'message' => 'Permohonan berjaya dihantar!',
            'application_id' => $applicationId,
            'linked_matches' => $linkedMatches,
            'email_sent' => $emailSent
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

/**
 * Send application success email to user
 */
function sendApplicationSuccessEmail($to, $nama, $applicationId, $jenisPengadil) {
    $subject = "Permohonan Pendaftaran Pengadil Berjaya Dihantar - PBNP";
    $refNo   = 'REF-' . str_pad((string)$applicationId, 6, '0', STR_PAD_LEFT);

    $body  = emailGreeting($nama);
    $body .= emailPara("Terima kasih! Permohonan pendaftaran anda sebagai <strong>" . htmlspecialchars($jenisPengadil) . "</strong> telah berjaya dihantar kepada <strong>Sistem Pengurusan Pengadil PBNP</strong>.");
    $body .= emailInfoTable([
        ['No. Rujukan',     "<strong style=\"color:#2563EB;\">{$refNo}</strong>"],
        ['Tarikh Dihantar', date('d M Y, H:i')],
        ['Jenis Pengadil',  htmlspecialchars($jenisPengadil)],
        ['Yuran Pendaftaran', '<strong>RM 80.00</strong>'],
    ]);
    $body .= emailStatusBadge('Menunggu Kelulusan Admin', '#DBEAFE', '#1E40AF');
    $body .= emailAlert('#2563EB', '#EFF6FF', 'Maklumat Pemprosesan', 'Permohonan anda sedang disemak oleh pentadbir. Proses kelulusan biasanya mengambil masa <strong>1–3 hari bekerja</strong>. Anda akan menerima notifikasi apabila ada kemaskini.');
    $body .= emailPara('<strong>Langkah Seterusnya:</strong>');
    $body .= emailOrderedList([
        'Tunggu pengesahan daripada pentadbir sistem.',
        'Semak status permohonan secara berkala di dashboard anda.',
        'Pastikan semua maklumat yang dihantar adalah tepat dan lengkap.',
        'Setelah diluluskan, sijil pengadil rasmi akan dikeluarkan.',
    ]);
    $body .= emailButton('https://refpahang.com/pengadil-dashboard.html', 'Semak Status Permohonan');

    $htmlBody = buildEmailTemplate('Permohonan Berjaya Dihantar', '#2563EB', '', $body);
    return sendEmail($to, $subject, $htmlBody, $nama, 'daftar');
}
