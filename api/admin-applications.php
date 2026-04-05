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
            'penilai' => 'penilai_berdaftar',
            'bertulis' => 'ujian_bertulis',
            'kelas1' => 'ujian_kelas1_fam',
        ];
        $jenisBorang = $typeMap[$type] ?? '';

        

        $stmt = $pdo->prepare("

            SELECT

                p.id,

                p.nama_penuh,

                p.jenis_permohonan as jenis_permohonan_slug,
                
                p.jenis_borang,

                CASE 
                    WHEN p.jenis_permohonan = 'penilai_pengadil' THEN 'Permohonan Penilai Pengadil'
                    WHEN p.jenis_borang = 'pengadil_futsal' THEN 'Pengadil Futsal'
                    WHEN p.jenis_borang = 'pengadil_berdaftar' THEN 'Pengadil Berdaftar'
                    WHEN p.jenis_borang = 'ujian_kecergasan' THEN 'Ujian Kecergasan'
                    WHEN p.jenis_borang = 'ujian_bertulis' THEN 'Ujian Kelas III FAM'
                    WHEN p.jenis_borang = 'ujian_kelas1_fam' THEN 'Ujian Kelas 1 FAM'
                    WHEN p.jenis_permohonan = 'pendaftaran_pengadil' THEN 'Pendaftaran Pengadil'
                    ELSE 'Pendaftaran Pengadil'
                END as jenis_permohonan,

                CASE 
                    WHEN p.jenis_borang IN ('pengadil_berdaftar', 'pengadil_futsal') THEN p.status_workflow
                    WHEN p.jenis_borang IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam') THEN 
                        CASE p.workflow_status
                            WHEN 'Pending' THEN 'Menunggu Admin'
                            WHEN 'Approved' THEN 'Lengkap'
                            WHEN 'Rejected' THEN 'Ditolak'
                            ELSE p.workflow_status
                        END
                    WHEN p.jenis_permohonan IN ('pendaftaran_pengadil', 'penilai_pengadil') THEN p.status_workflow
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

                        WHEN p.jenis_borang IN ('pengadil_berdaftar', 'pengadil_futsal') THEN p.status_workflow

                        WHEN p.jenis_borang IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam') THEN 
                            CASE p.workflow_status
                                WHEN 'Pending' THEN 'Menunggu Admin'
                                WHEN 'Approved' THEN 'Lengkap'
                                WHEN 'Rejected' THEN 'Ditolak'
                                ELSE p.workflow_status
                            END

                        WHEN p.jenis_permohonan IN ('pendaftaran_pengadil', 'penilai_pengadil') THEN p.status_workflow

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

                SUM(CASE WHEN ((p.jenis_borang IN ('pengadil_berdaftar', 'pengadil_futsal') OR p.jenis_permohonan IN ('pendaftaran_pengadil', 'penilai_pengadil')) AND p.status_workflow = 'Menunggu Admin') OR

                             (p.jenis_borang IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam') AND p.workflow_status = 'Pending') THEN 1 ELSE 0 END) as pending,

                SUM(CASE WHEN ((p.jenis_borang IN ('pengadil_berdaftar', 'pengadil_futsal') OR p.jenis_permohonan IN ('pendaftaran_pengadil', 'penilai_pengadil')) AND p.status_workflow = 'Lengkap' AND MONTH(p.tarikh_hantar) = MONTH(CURDATE())) OR

                             (p.jenis_borang IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam') AND p.workflow_status = 'Approved' AND MONTH(p.tarikh_hantar) = MONTH(CURDATE())) THEN 1 ELSE 0 END) as approved_this_month,

                SUM(CASE WHEN ((p.jenis_borang IN ('pengadil_berdaftar', 'pengadil_futsal') OR p.jenis_permohonan IN ('pendaftaran_pengadil', 'penilai_pengadil')) AND p.status_workflow = 'Lengkap') OR

                             (p.jenis_borang IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam') AND p.workflow_status = 'Approved') THEN 1 ELSE 0 END) as total_approved,

                SUM(CASE WHEN ((p.jenis_borang IN ('pengadil_berdaftar', 'pengadil_futsal') OR p.jenis_permohonan IN ('pendaftaran_pengadil', 'penilai_pengadil')) AND p.status_workflow = 'Ditolak') OR

                             (p.jenis_borang IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam') AND p.workflow_status = 'Rejected') THEN 1 ELSE 0 END) as total_rejected

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

