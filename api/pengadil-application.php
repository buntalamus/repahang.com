<?php
/**
 * Pengadil Application API
 * GET: Retrieve current user's application
 * POST: Submit new application
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/email.php';

header('Content-Type: application/json');

try {
    // Require authentication
    requireAuth();
    
    // Allow Pengadil, Penilai, and PP Daerah roles
    $allowedRoles = ['Pengadil', 'Penilai', 'PP Daerah'];
    if (!in_array($_SESSION['user_role'], $allowedRoles, true)) {
        http_response_code(403);
        echo json_encode(['error' => true, 'message' => 'Akses ditolak.']);
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
        // Load application settings from DB
        $settingRows = $pdo->query("SELECT setting_key, setting_value FROM application_settings")->fetchAll(PDO::FETCH_ASSOC);
        $appSettings = [];
        foreach ($settingRows as $sr) { $appSettings[$sr['setting_key']] = $sr['setting_value']; }
        $applicationsOpen     = ($appSettings['applications_open'] ?? '0') === '1';
        $berdaftarOpen        = ($appSettings['berdaftar_open'] ?? '0') === '1';
        $kelas3Open           = ($appSettings['kelas3_open']   ?? '0') === '1';
        $kelas1Open           = ($appSettings['kelas1_open']   ?? '0') === '1';
        $penilaiOpen          = ($appSettings['penilai_open']  ?? '0') === '1';
        $applicationYear      = (int)($appSettings['application_year'] ?? date('Y'));
        $paymentAmountSetting = (float)($appSettings['payment_amount'] ?? 80.00);
        $minVerifiedMatches   = (int)($appSettings['min_verified_matches'] ?? 20);
        $kelas3MinAge         = (int)($appSettings['kelas3_min_age'] ?? 15);
        $kelas3MaxAge         = (int)($appSettings['kelas3_max_age'] ?? 40);
        $kelas1MaxAge         = (int)($appSettings['kelas1_max_age'] ?? 32);

        // Get form data
        $data = $_POST;
        $jenisBorang = $data['jenis_borang'] ?? 'pengadil_berdaftar';
        $userRole    = $_SESSION['user_role'];

        // Validate role-to-form-type
        $allowedForRole = [
            'Pengadil'  => ['pengadil_berdaftar', 'kelas3_fam', 'ujian_kelas1_fam'],
            'Penilai'   => ['penilai_berdaftar'],
            'PP Daerah' => ['penilai_berdaftar', 'kelas3_fam', 'ujian_kelas1_fam'],
        ];
        if (!in_array($jenisBorang, $allowedForRole[$userRole] ?? [], true)) {
            http_response_code(403);
            echo json_encode(['error' => true, 'message' => 'Jenis borang tidak dibenarkan untuk peranan anda.']);
            exit;
        }

        // Per-type open/close check
        if ($jenisBorang === 'pengadil_berdaftar' && !$berdaftarOpen) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Maaf, permohonan Pendaftaran Tahunan tidak dibuka pada masa ini.']);
            exit;
        }
        if ($jenisBorang === 'kelas3_fam' && !$kelas3Open) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Maaf, permohonan Kelas III FAM tidak dibuka pada masa ini.']);
            exit;
        }
        if ($jenisBorang === 'ujian_kelas1_fam' && !$kelas1Open) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Maaf, permohonan Ujian Kelas I FAM tidak dibuka pada masa ini.']);
            exit;
        }
        if ($jenisBorang === 'penilai_berdaftar' && !$penilaiOpen) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Maaf, permohonan Pendaftaran Tahunan Penilai Pengadil tidak dibuka pada masa ini.']);
            exit;
        }
        if ($jenisBorang === 'pp_berdaftar' && !$berdaftarOpen) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Maaf, permohonan Pendaftaran Tahunan tidak dibuka pada masa ini.']);
            exit;
        }

        // Auto-populate ALL profile fields for ALL application types
        $profileStmt = $pdo->prepare("
            SELECT nama_penuh, no_ic, email, no_telefon, jantina, alamat1, alamat2,
                   poskod, daerah, negeri, district_id, persatuan_id, jenis_pengadil,
                   status_kerja, jawatan, nama_majikan, alamat_majikan1, alamat_majikan2,
                   poskod_majikan, daerah_majikan, negeri_majikan, saiz_baju,
                   tahun_mula_aktif
            FROM users WHERE id = :user_id
        ");
        $profileStmt->execute(['user_id' => $userId]);
        $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);

        if (!$profile) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Profil pengguna tidak dijumpai.']);
            exit;
        }

        // Age validation from IC (format: YYMMDD-PB-XXXX, 12 digits)
        $noIc = preg_replace('/\D/', '', $profile['no_ic'] ?? '');
        if (strlen($noIc) >= 6 && in_array($jenisBorang, ['kelas3_fam', 'ujian_kelas1_fam'], true)) {
            $icYY   = (int)substr($noIc, 0, 2);
            $birthYear = $icYY >= 0 && $icYY <= (int)date('y') ? 2000 + $icYY : 1900 + $icYY;
            $age    = $applicationYear - $birthYear;
            if ($jenisBorang === 'kelas3_fam') {
                if ($age < $kelas3MinAge || $age > $kelas3MaxAge) {
                    http_response_code(400);
                    echo json_encode(['error' => true, 'message' => "Anda tidak memenuhi syarat umur untuk Kelas III FAM. Calon mesti berumur antara {$kelas3MinAge} hingga {$kelas3MaxAge} tahun pada tahun {$applicationYear}."]);
                    exit;
                }
            }
            if ($jenisBorang === 'ujian_kelas1_fam') {
                if ($age > $kelas1MaxAge) {
                    http_response_code(400);
                    echo json_encode(['error' => true, 'message' => "Anda tidak memenuhi syarat umur untuk Ujian Kelas I FAM. Calon mesti berumur {$kelas1MaxAge} tahun ke bawah pada tahun {$applicationYear}."]);
                    exit;
                }
            }
        }

        // Kelas I: must have passed Kelas III at least 2 years before application year
        if ($jenisBorang === 'ujian_kelas1_fam') {
            $kelas3DeadlineYear = $applicationYear - 2;
            $kelas3Stmt = $pdo->prepare("
                SELECT tahun_permohonan FROM permohonan
                WHERE user_id = :user_id
                  AND jenis_borang = 'kelas3_fam'
                  AND status_workflow IN ('Lengkap', 'Admin Diluluskan', 'Bayaran Diterima')
                  AND tahun_permohonan <= :deadline_year
                ORDER BY tahun_permohonan DESC LIMIT 1
            ");
            $kelas3Stmt->execute(['user_id' => $userId, 'deadline_year' => $kelas3DeadlineYear]);
            if (!$kelas3Stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => "Anda tidak layak memohon Ujian Kelas I FAM. Sijil Kelas III FAM mesti diperoleh pada tahun {$kelas3DeadlineYear} atau sebelumnya (sekurang-kurangnya 2 tahun)."]);
                exit;
            }
        }

        // Override with profile data (profile is source of truth; user only provides waris + saiz_baju)
        $data['nama_penuh']     = $profile['nama_penuh'];
        $data['no_kp']          = $profile['no_ic'];
        $data['emel']           = $profile['email'];
        $data['no_telefon']     = $profile['no_telefon'];
        $data['jantina']        = $profile['jantina'];
        $data['alamat1']        = $profile['alamat1'] ?? '';
        $data['alamat2']        = $profile['alamat2'] ?? '';
        $data['poskod']         = $profile['poskod'] ?? '';
        $data['daerah']         = $profile['daerah'] ?? '';
        $data['negeri']         = $profile['negeri'] ?? '';
        $data['jenis_pengadil'] = $profile['jenis_pengadil'] ?? '';
        $data['status_kerja']   = $profile['status_kerja'] ?? '';
        $data['jawatan']        = $profile['jawatan'] ?? '';
        $data['nama_majikan']   = $profile['nama_majikan'] ?? '';
        $data['alamat_majikan1']= $profile['alamat_majikan1'] ?? '';
        $data['alamat_majikan2']= $profile['alamat_majikan2'] ?? '';
        $data['poskod_majikan'] = $profile['poskod_majikan'] ?? '';
        $data['daerah_majikan'] = $profile['daerah_majikan'] ?? '';
        $data['negeri_majikan'] = $profile['negeri_majikan'] ?? '';
        // saiz_baju: user form takes precedence, fallback to profile
        if (empty($data['saiz_baju'])) { $data['saiz_baju'] = $profile['saiz_baju'] ?? ''; }

        // Check if user already has an application for this type and year
        $checkStmt = $pdo->prepare("SELECT id FROM permohonan WHERE user_id = :user_id AND jenis_borang = :jenis_borang AND tahun_permohonan = :tahun LIMIT 1");
        $checkStmt->execute(['user_id' => $userId, 'jenis_borang' => $jenisBorang, 'tahun' => $applicationYear]);
        if ($checkStmt->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Anda sudah mempunyai permohonan untuk tahun ' . $applicationYear . '. Sila semak sejarah permohonan anda.']);
            exit;
        }

        // Check eligibility: minimum verified matches (only for pengadil_berdaftar by Pengadil role, NOT PP Daerah/Penilai)
        if ($jenisBorang === 'pengadil_berdaftar' && $userRole !== 'PP Daerah') {
            $matchStmt = $pdo->prepare("
                SELECT COUNT(*) as verified_count FROM perlawanan
                WHERE user_id = :user_id AND status_pp = 'Disahkan' AND YEAR(tarikh) = YEAR(CURDATE())
            ");
            $matchStmt->execute(['user_id' => $userId]);
            $matchData = $matchStmt->fetch(PDO::FETCH_ASSOC);
            if ($matchData['verified_count'] < $minVerifiedMatches) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => "Anda tidak layak memohon. Minimum {$minVerifiedMatches} perlawanan yang disahkan diperlukan.",
                    'verified_count' => $matchData['verified_count']
                ]);
                exit;
            }
        }

        // Validate user-provided required fields
        $annualRegTypes = ['pengadil_berdaftar', 'penilai_berdaftar', 'pp_berdaftar'];
        $required = ['nama_waris', 'hubungan_waris', 'telefon_waris'];
        if (in_array($jenisBorang, $annualRegTypes, true)) {
            $required[] = 'saiz_baju';
        }
        foreach ($required as $field) {
            if (empty($data[$field])) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => "Sila lengkapkan maklumat '{$field}'."]);
                exit;
            }
        }

        // Validate file uploads for annual registration types
        if (in_array($jenisBorang, ['pengadil_berdaftar', 'penilai_berdaftar', 'pp_berdaftar'], true)) {
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
        }
        
        // Handle file uploads
        $uploadDir = __DIR__ . '/../uploads/';
        if (!file_exists($uploadDir)) { mkdir($uploadDir, 0755, true); }

        $allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
        $allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];

        $resitUrl  = null;
        $gambarUrl = null;

        // Upload resit — required for annual registration types
        if (in_array($jenisBorang, ['pengadil_berdaftar', 'penilai_berdaftar', 'pp_berdaftar'], true) && isset($_FILES['resit']) && $_FILES['resit']['error'] === UPLOAD_ERR_OK) {
            $resitExt      = strtolower(pathinfo($_FILES['resit']['name'], PATHINFO_EXTENSION));
            if (!in_array($resitExt, $allowedExtensions, true)) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Format resit tidak dibenarkan. Gunakan JPG, PNG atau PDF.']);
                exit;
            }
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $resitMime = $finfo->file($_FILES['resit']['tmp_name']);
            if (!in_array($resitMime, $allowedMimes, true)) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Jenis fail resit tidak sah.']);
                exit;
            }
            $resitFilename = 'resit_' . $userId . '_' . time() . '.' . $resitExt;
            if (!move_uploaded_file($_FILES['resit']['tmp_name'], $uploadDir . $resitFilename)) {
                http_response_code(500);
                echo json_encode(['error' => true, 'message' => 'Gagal memuat naik resit bayaran.']);
                exit;
            }
            $resitUrl = '/uploads/' . $resitFilename;
        }

        // Upload gambar profil — required for annual registration types
        if (in_array($jenisBorang, ['pengadil_berdaftar', 'penilai_berdaftar', 'pp_berdaftar'], true) && isset($_FILES['gambar']) && $_FILES['gambar']['error'] === UPLOAD_ERR_OK) {
            $gambarExt      = strtolower(pathinfo($_FILES['gambar']['name'], PATHINFO_EXTENSION));
            $allowedImageExt = ['jpg', 'jpeg', 'png'];
            $allowedImageMimes = ['image/jpeg', 'image/png'];
            if (!in_array($gambarExt, $allowedImageExt, true)) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Format gambar tidak dibenarkan. Gunakan JPG atau PNG.']);
                exit;
            }
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $gambarMime = $finfo->file($_FILES['gambar']['tmp_name']);
            if (!in_array($gambarMime, $allowedImageMimes, true)) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Jenis fail gambar tidak sah.']);
                exit;
            }
            $gambarFilename = 'gambar_' . $userId . '_' . time() . '.' . $gambarExt;
            if (!move_uploaded_file($_FILES['gambar']['tmp_name'], $uploadDir . $gambarFilename)) {
                http_response_code(500);
                echo json_encode(['error' => true, 'message' => 'Gagal memuat naik gambar profil.']);
                exit;
            }
            $gambarUrl = '/uploads/' . $gambarFilename;
            // Also update the user's profile photo
            $pdo->prepare("UPDATE users SET url_gambar_profil = ? WHERE id = ?")->execute(['/uploads/' . $gambarFilename, $userId]);
        }

        // district_id already in $profile
        $districtId  = $profile['district_id'] ?? null;
        $persatuanId = $profile['persatuan_id'] ?? null;
        
        // Insert application
        $insertStmt = $pdo->prepare("
            INSERT INTO permohonan (
                user_id, district_id, persatuan_id, tahun_permohonan, jenis_borang,
                nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil,
                alamat1, alamat2, poskod, daerah, negeri,
                status_kerja, jawatan, nama_majikan,
                alamat_majikan1, alamat_majikan2, poskod_majikan, daerah_majikan, negeri_majikan,
                nama_waris, hubungan_waris, telefon_waris,
                url_resit, url_gambar_profil, saiz_baju,
                payment_amount, mohon_r1, mohon_ujian_kecergasan,
                status, status_workflow, tarikh_hantar
            ) VALUES (
                :user_id, :district_id, :persatuan_id, :tahun_permohonan, :jenis_borang,
                :nama_penuh, :no_kp, :emel, :no_telefon, :jantina, :jenis_pengadil,
                :alamat1, :alamat2, :poskod, :daerah, :negeri,
                :status_kerja, :jawatan, :nama_majikan,
                :alamat_majikan1, :alamat_majikan2, :poskod_majikan, :daerah_majikan, :negeri_majikan,
                :nama_waris, :hubungan_waris, :telefon_waris,
                :url_resit, :url_gambar_profil, :saiz_baju,
                :payment_amount, :mohon_r1, :mohon_ujian_kecergasan,
                'Pending', 'Menunggu PP Daerah', NOW()
            )
        ");

        $insertStmt->execute([
            'user_id'                => $userId,
            'district_id'            => $districtId,
            'persatuan_id'           => $persatuanId,
            'tahun_permohonan'       => $applicationYear,
            'jenis_borang'           => $jenisBorang,
            'nama_penuh'             => $data['nama_penuh'],
            'no_kp'                  => $data['no_kp'],
            'emel'                   => $data['emel'],
            'no_telefon'             => $data['no_telefon'],
            'jantina'                => $data['jantina'],
            'jenis_pengadil'         => $data['jenis_pengadil'],
            'alamat1'                => $data['alamat1'],
            'alamat2'                => $data['alamat2'] ?: null,
            'poskod'                 => $data['poskod'],
            'daerah'                 => $data['daerah'],
            'negeri'                 => $data['negeri'],
            'status_kerja'           => $data['status_kerja'],
            'jawatan'                => $data['jawatan'] ?: null,
            'nama_majikan'           => $data['nama_majikan'] ?: null,
            'alamat_majikan1'        => $data['alamat_majikan1'] ?: null,
            'alamat_majikan2'        => $data['alamat_majikan2'] ?: null,
            'poskod_majikan'         => $data['poskod_majikan'] ?: null,
            'daerah_majikan'         => $data['daerah_majikan'] ?: null,
            'negeri_majikan'         => $data['negeri_majikan'] ?: null,
            'nama_waris'             => $data['nama_waris'],
            'hubungan_waris'         => $data['hubungan_waris'],
            'telefon_waris'          => $data['telefon_waris'],
            'url_resit'              => $resitUrl,
            'url_gambar_profil'      => $gambarUrl,
            'saiz_baju'              => $data['saiz_baju'] ?: null,
            'payment_amount'         => $paymentAmountSetting,
            'mohon_r1'               => $jenisBorang === 'pengadil_berdaftar' ? 1 : 0,
            'mohon_ujian_kecergasan' => $jenisBorang === 'pengadil_berdaftar' ? 1 : 0,
        ]);
        
        $applicationId = $pdo->lastInsertId();

        // Auto-isi tahun mohon Kelas 3 FAM dalam profil (kekalkan tahun terawal).
        // Guna tahun semasa (tahun permohonan sebenar dihantar), bukan
        // $applicationYear dari tetapan 'application_year' yang boleh menunjuk
        // tahun kitaran hadapan.
        if ($jenisBorang === 'kelas3_fam') {
            $pdo->prepare("
                UPDATE users SET tahun_mohon_kelas3 = COALESCE(tahun_mohon_kelas3, :tahun)
                WHERE id = :uid
            ")->execute(['tahun' => (int) date('Y'), 'uid' => $userId]);
        }

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
    $body .= emailButton(env('BASE_URL') . '/pengadil', 'Semak Status Permohonan');

    $htmlBody = buildEmailTemplate('Permohonan Berjaya Dihantar', '#2563EB', '', $body);
    return sendEmail($to, $subject, $htmlBody, $nama, 'daftar');
}
