<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
}

// Check if user is logged in
$user = requireAuth();

// Only allow PP Daerah role
if ($user['role'] !== 'PP Daerah') {
    jsonResponse(['error' => true, 'message' => 'Akses ditolak. Hanya PP Daerah dibenarkan.'], 403);
}

try {
    $user_id = $user['id'];

    // Check if requesting a specific application
    $application_id = $_GET['application_id'] ?? null;

    if ($application_id) {
        // Fetch single application details - for applications in this PP Daerah's district or owned by the user
        $stmt = $pdo->prepare("
            SELECT
                p.*,
                u.nama_penuh,
                u.no_ic,
                u.email,
                u.no_telefon,
                u.alamat1,
                u.alamat2,
                u.poskod,
                u.daerah,
                u.negeri,
                u.status_kerja,
                u.jawatan,
                u.nama_majikan,
                u.alamat_majikan1,
                u.alamat_majikan2,
                u.poskod_majikan,
                u.daerah_majikan,
                u.negeri_majikan,
                u.nama_waris,
                u.hubungan_waris,
                u.telefon_waris,
                u.jenis_pengadil,
                u.tahun_mula_aktif,
                u.saiz_baju
            FROM permohonan p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ? AND (p.user_id = ? OR p.district_id = ?)
        ");

        $stmt->execute([$application_id, $user_id, $user['persatuan_id']]);
        $application = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$application) {
            jsonResponse(['error' => true, 'message' => 'Permohonan tidak dijumpai atau akses ditolak.'], 404);
        }

        jsonResponse([
            'error' => false,
            'application' => $application
        ]);

    } else {
        // Query to get all approved applications for this PP Daerah's district or owned by the user
        $stmt = $pdo->prepare("
            SELECT
                id,
                CASE 
                    WHEN jenis_borang IN ('pengadil_berdaftar', 'pengadil_futsal') THEN jenis_borang
                    WHEN jenis_permohonan = 'ujian_kecergasan' THEN 'ujian_kecergasan'
                    WHEN jenis_permohonan = 'ujian_bertulis' THEN 'ujian_bertulis'
                    WHEN jenis_permohonan = 'ujian_kelas1_fam' THEN 'ujian_kelas1_fam'
                    ELSE jenis_borang
                END as jenis_borang,
                CASE 
                    WHEN jenis_permohonan IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam') THEN 
                        CASE 
                            WHEN workflow_status = 'Approved' THEN 'approved'
                            WHEN workflow_status = 'Rejected' THEN 'rejected'
                            ELSE 'pending'
                        END
                    ELSE LOWER(status)
                END as status,
                admin_notes as catatan_admin,
                tarikh_hantar as created_at,
                user_id
            FROM permohonan
            WHERE (user_id = ? OR district_id = ?) AND (
                (jenis_borang IN ('pengadil_berdaftar', 'pengadil_futsal') AND LOWER(status) = 'approved')
                OR (jenis_permohonan IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam') AND workflow_status = 'Approved')
            )
            ORDER BY tarikh_hantar DESC
        ");

        $stmt->execute([$user_id, $user['persatuan_id']]);
        $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format the response
        $response = [
            'error' => false,
            'applications' => array_map(function($app) {
                return [
                    'id' => $app['id'],
                    'jenis_borang' => $app['jenis_borang'],
                    'status' => $app['status'] ?: 'pending',
                    'catatan_admin' => $app['catatan_admin'],
                    'created_at' => $app['created_at'],
                    'user_id' => $app['user_id']
                ];
            }, $applications)
        ];

        jsonResponse($response);
    }

} catch (Exception $e) {
    jsonResponse([
        'error' => true,
        'message' => 'Ralat dalaman pelayan: ' . $e->getMessage()
    ], 500);
}