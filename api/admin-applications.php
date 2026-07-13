<?php

/**

 * Admin Applications API

 * GET: List all applications waiting for admin approval

 */



require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/penilai_permohonan_helper.php';



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
    ensurePenilaiPermohonanTable($pdo);

    

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Handle POST request for updating status_ujian
        $input = json_decode(file_get_contents('php://input'), true);
        
        $action = $input['action'] ?? '';
        
        if ($action === 'blast_kelas3_welcome') {
            // Jana password baru & hantar emel kelayakan untuk semua kelas3_fam
            // yang belum tukar password (password_changed = 0)
            require_once __DIR__ . '/../config/email.php';

            $rows = $pdo->query("
                SELECT u.id, u.nama_penuh, u.email, u.tg_link_token, u.telegram_chat_id
                FROM users u
                JOIN permohonan p ON p.user_id = u.id
                WHERE p.jenis_borang = 'kelas3_fam'
                  AND p.tahun_permohonan = 2026
                  AND u.password_changed = 0
                  AND u.aktif = 1
                GROUP BY u.id
            ")->fetchAll(PDO::FETCH_ASSOC);

            if (empty($rows)) {
                echo json_encode(['error' => false, 'message' => 'Tiada akaun yang layak untuk blast (semua sudah tukar password).', 'sent' => 0]);
                exit;
            }

            $chars  = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            $update = $pdo->prepare("UPDATE users SET password = ?, tg_link_token = ? WHERE id = ?");
            $sent   = 0;
            $failed = 0;
            $botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');
            $loginUrl    = env('BASE_URL', 'https://refpahang.com') . '/login';

            foreach ($rows as $u) {
                // Jana password baru
                $pw = '';
                $max = strlen($chars) - 1;
                for ($k = 0; $k < 10; $k++) $pw .= $chars[random_int(0, $max)];
                $hashed = password_hash($pw, PASSWORD_DEFAULT);

                // Guna semula tg_link_token sedia ada supaya pautan pendaftaran
                // Telegram yang sudah dihantar sebelum ini kekal berfungsi.
                // Akaun yang sudah terhubung tidak perlu token langsung.
                $tgToken = !empty($u['telegram_chat_id'])
                    ? null
                    : (!empty($u['tg_link_token']) ? $u['tg_link_token'] : bin2hex(random_bytes(16)));

                $update->execute([$hashed, $tgToken, $u['id']]);

                // Hantar emel
                $telegramLink = "https://t.me/{$botUsername}?start={$tgToken}";
                $ok = sendWelcomeEmailKelas3($u['email'], $u['nama_penuh'], $u['email'], $pw, $loginUrl);
                $ok ? $sent++ : $failed++;
            }

            echo json_encode([
                'error'   => false,
                'message' => "Blast selesai. Berjaya: {$sent}, Gagal: {$failed}.",
                'sent'    => $sent,
                'failed'  => $failed,
            ]);
            exit;
        }

        if ($action === 'update_status_ujian') {
            $applicationId = $input['id'] ?? 0;
            $statusUjian = $input['status_ujian'] ?? '';
            
            if (!$applicationId || !in_array($statusUjian, ['Lulus', 'Tidak Lulus', 'Tidak Hadir'])) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Parameter tidak sah.']);
                exit;
            }
            
            // Update status_ujian in permohonan table (column must exist)
            try {
                $updateStmt = $pdo->prepare("
                    UPDATE permohonan
                    SET status_ujian = :status_ujian
                    WHERE id = :id
                ");
                
                $result = $updateStmt->execute([
                    'status_ujian' => $statusUjian,
                    'id' => $applicationId
                ]);

                // Auto-isi tahun Kelas 3 FAM dalam profil pengguna.
                // Guna tahun permohonan DIHANTAR (bukan tahun kitaran dari
                // tetapan 'application_year', yang boleh menunjuk tahun hadapan).
                $appStmt = $pdo->prepare("
                    SELECT user_id, jenis_borang,
                           COALESCE(YEAR(tarikh_hantar), tahun_permohonan) AS tahun_sebenar
                    FROM permohonan WHERE id = :id
                ");
                $appStmt->execute(['id' => $applicationId]);
                $app = $appStmt->fetch(PDO::FETCH_ASSOC);

                if ($app && !empty($app['user_id'])
                    && in_array($app['jenis_borang'], ['kelas3_fam', 'ujian_bertulis'], true)) {
                    $uid   = (int) $app['user_id'];
                    $tahun = (int) $app['tahun_sebenar'];
                    if ($statusUjian === 'Lulus') {
                        $pdo->prepare("
                            UPDATE users
                            SET tahun_lulus_kelas3 = :tahun,
                                tahun_mohon_kelas3 = COALESCE(tahun_mohon_kelas3, :tahun2)
                            WHERE id = :uid
                        ")->execute(['tahun' => $tahun, 'tahun2' => $tahun, 'uid' => $uid]);
                    } else {
                        // Keputusan diubah dari Lulus — kosongkan hanya jika tahun sepadan
                        $pdo->prepare("
                            UPDATE users SET tahun_lulus_kelas3 = NULL
                            WHERE id = :uid AND tahun_lulus_kelas3 = :tahun
                        ")->execute(['uid' => $uid, 'tahun' => $tahun]);
                    }
                }

                echo json_encode([
                    'error' => false,
                    'message' => 'Status ujian berjaya dikemaskini.',
                    'affected_rows' => $updateStmt->rowCount()
                ]);
                exit;
            } catch (PDOException $e) {
                error_log('[admin-applications] Status ujian error: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'error' => true,
                    'message' => 'Gagal mengemaskini status ujian.'
                ]);
                exit;
            }
        } else if ($action === 'delete_application') {
            $applicationId = (int)($input['id'] ?? 0);

            if (!$applicationId) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'ID permohonan diperlukan.']);
                exit;
            }

            try {
                $pdo->beginTransaction();
                // Delete related match records first
                $delMatches = $pdo->prepare("DELETE FROM perlawanan WHERE permohonan_id = :id");
                $delMatches->execute(['id' => $applicationId]);
                // Delete the application
                $delApp = $pdo->prepare("DELETE FROM permohonan WHERE id = :id");
                $delApp->execute(['id' => $applicationId]);
                $pdo->commit();

                echo json_encode([
                    'error' => false,
                    'message' => 'Permohonan berjaya dipadam.',
                    'affected_rows' => $delApp->rowCount()
                ]);
                exit;
            } catch (PDOException $e) {
                $pdo->rollBack();
                error_log('[admin-applications] Delete error: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'error' => true,
                    'message' => 'Gagal memadam permohonan.'
                ]);
                exit;
            }
        } else {
            // Unknown action
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Tindakan tidak sah: ' . $action]);
            exit;
        }
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {

        // Get filter from query string

        $status = $_GET['status'] ?? 'all';
        $type = $_GET['type'] ?? '';
        
        // Map tab key to jenis_borang
        $typeMap = [
            'berdaftar' => 'pengadil_berdaftar',
            'penilai'   => 'penilai_berdaftar',
            'kelas3'    => 'kelas3_fam',
            'kelas1'    => 'ujian_kelas1_fam',
        ];
        $jenisBorang = $typeMap[$type] ?? '';

        

        $stmt = $pdo->prepare("

            SELECT

                p.id,

                p.nama_penuh,

                p.jenis_permohonan as jenis_permohonan_slug,
                
                p.jenis_borang,

                CASE
                    WHEN p.jenis_borang = 'pengadil_berdaftar' THEN 'Pengadil Berdaftar'
                    WHEN p.jenis_borang = 'penilai_berdaftar'  THEN 'RA Berdaftar'
                    WHEN p.jenis_borang = 'pp_berdaftar'       THEN 'PP Berdaftar'
                    WHEN p.jenis_borang = 'kelas3_fam'         THEN 'Kelas III FAM'
                    WHEN p.jenis_borang = 'ujian_kelas1_fam'   THEN 'Ujian Kelas I FAM'
                    ELSE p.jenis_borang
                END as jenis_permohonan,

                CASE
                    WHEN p.jenis_borang = 'ujian_kelas1_fam' THEN
                        CASE p.workflow_status
                            WHEN 'Pending' THEN 'Menunggu Admin'
                            WHEN 'Approved' THEN 'Lengkap'
                            WHEN 'Rejected' THEN 'Ditolak'
                            ELSE p.workflow_status
                        END
                    ELSE p.status_workflow
                END as status,

                p.status_ujian,

                p.tarikh_hantar,

                p.emel,

                p.no_telefon,

                p.jenis_pengadil,

                p.tahun_permohonan,

                COALESCE(NULLIF(p.url_gambar_profil, ''), u.url_gambar_profil) as url_gambar_profil,

                p.no_kp,

                p.saiz_baju,

                p.alamat1,

                p.alamat2,

                p.poskod,

                p.daerah,

                p.negeri,

                p.status_kerja,

                p.jawatan,

                p.nama_majikan,

                p.nama_waris,

                p.hubungan_waris,

                p.telefon_waris,

                p.url_resit,

                penilai_det.jenis_penilai as penilai_jenis,

                penilai_det.tahun_pengalaman as penilai_tahun_pengalaman,

                penilai_det.kelayakan as penilai_kelayakan,

                penilai_det.sijil_kursus_url,

                penilai_det.sijil_kesihatan_url,

                penilai_det.catatan as penilai_catatan,

                pb.nama_persatuan as district_nama,

                u.email as user_email,

                (
                    SELECT COUNT(*)
                    FROM perlawanan pl
                    WHERE pl.permohonan_id = p.id
                ) as total_matches

            FROM permohonan p

            LEFT JOIN users u ON p.user_id = u.id

            LEFT JOIN persatuan_bolasepak_daerah pb ON p.persatuan_id = pb.id

            LEFT JOIN penilai_permohonan penilai_det ON penilai_det.permohonan_id = p.id

            WHERE
                (
                    CASE
                        WHEN p.jenis_borang = 'ujian_kelas1_fam' THEN
                            CASE p.workflow_status
                                WHEN 'Pending' THEN 'Menunggu Admin'
                                WHEN 'Approved' THEN 'Lengkap'
                                WHEN 'Rejected' THEN 'Ditolak'
                                ELSE p.workflow_status
                            END
                        ELSE p.status_workflow
                    END = ? OR ? = 'all'
                )
                AND (p.jenis_borang = ? OR ? = '')

            ORDER BY p.tarikh_hantar DESC

        ");

        

        $stmt->execute([$status, $status, $jenisBorang, $jenisBorang]);

        

        $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Apply limit if requested (e.g. for dashboard preview)
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 0;
        if ($limit > 0) {
            $applications = array_slice($applications, 0, $limit);
        }

        

        // Get statistics

        $statsStmt = $pdo->query("

            SELECT 

                SUM(CASE WHEN p.status_workflow = 'Menunggu Admin'
                              OR (p.jenis_borang = 'ujian_kelas1_fam' AND p.workflow_status = 'Pending')
                         THEN 1 ELSE 0 END) as pending,

                SUM(CASE WHEN (p.status_workflow = 'Lengkap' AND MONTH(p.tarikh_hantar) = MONTH(CURDATE()))
                              OR (p.jenis_borang = 'ujian_kelas1_fam' AND p.workflow_status = 'Approved' AND MONTH(p.tarikh_hantar) = MONTH(CURDATE()))
                         THEN 1 ELSE 0 END) as approved_this_month,

                SUM(CASE WHEN p.status_workflow = 'Lengkap'
                              OR (p.jenis_borang = 'ujian_kelas1_fam' AND p.workflow_status = 'Approved')
                         THEN 1 ELSE 0 END) as total_approved,

                SUM(CASE WHEN p.status_workflow = 'Ditolak'
                              OR (p.jenis_borang = 'ujian_kelas1_fam' AND p.workflow_status = 'Rejected')
                         THEN 1 ELSE 0 END) as total_rejected

            FROM permohonan p

        ");

        

        $statistics = $statsStmt->fetch(PDO::FETCH_ASSOC);

        

        echo json_encode([

            'error' => false,

            'applications' => $applications,

            'statistics' => $statistics

        ]);

        exit;

    }

    

    http_response_code(405);

    echo json_encode(['error' => true, 'message' => 'Method not allowed']);

    

} catch (Exception $e) {

    error_log('[admin-applications] Error: ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());

    http_response_code(500);

    $response = ['error' => true, 'message' => 'Ralat dalaman.'];

    if (defined('APP_DEBUG') && APP_DEBUG) {

        $response['debug'] = $e->getMessage();

        $response['trace'] = $e->getTraceAsString();

    }

    echo json_encode($response);

}



function sendWelcomeEmailKelas3(string $to, string $nama, string $username, string $password, string $loginUrl): bool
{
    $subject = "Akaun Sistem RefPahang — Peperiksaan Kelas III FAM 2026";

    $credHtml = '
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="padding:16px 20px;background:#f0f4ff;border-radius:8px;border-left:4px solid #3b5bdb;">
          <p style="margin:0 0 8px;font-size:13px;color:#666;">Alamat Emel (untuk log masuk)</p>
          <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1a1a2e;font-family:monospace;">' . htmlspecialchars($username) . '</p>
          <p style="margin:0 0 8px;font-size:13px;color:#666;">Kata Laluan Sementara</p>
          <p style="margin:0;font-size:22px;font-weight:700;color:#3b5bdb;font-family:monospace;letter-spacing:3px;">' . htmlspecialchars($password) . '</p>
        </td>
      </tr>
    </table>';

    $body  = emailGreeting($nama);
    $body .= emailPara('Akaun anda dalam <strong>Sistem Pengurusan Pengadil Persatuan Bola Sepak Negeri Pahang</strong> telah didaftarkan untuk <strong>Peperiksaan Kelas III FAM 2026</strong>.');
    $body .= emailPara('Berikut adalah maklumat log masuk anda:');
    $body .= $credHtml;
    $body .= emailAlert('#f59f00', '#fff9db', 'Keputusan Ujian Masih Dalam Proses',
        'Permohonan anda sedang dalam semakan admin. Keputusan peperiksaan akan dikemas kini dalam sistem setelah diumumkan. Anda akan dimaklumkan melalui emel ini.');
    $body .= emailPara('Langkah seterusnya:');
    $body .= emailOrderedList([
        'Log masuk di <a href="' . $loginUrl . '" style="color:#3b5bdb;">' . $loginUrl . '</a>',
        'Tukar kata laluan sementara kepada kata laluan pilihan anda.',
        'Lengkapkan maklumat profil anda.',
        'Semak status keputusan ujian di bahagian <strong>Permohonan</strong>.',
    ]);
    $body .= emailButton($loginUrl, 'Log Masuk Sekarang');
    $body .= emailPara('<small>Jika ada pertanyaan, hubungi admin di <a href="mailto:admin@refpahang.com">admin@refpahang.com</a></small>');

    $html = buildEmailTemplate('Akaun Berjaya Didaftarkan', '#3b5bdb', '🎉', $body);
    return sendEmail($to, $subject, $html, $nama, 'daftar');
}
