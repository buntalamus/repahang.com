<?php

/**

 * API: Get User Profile

 * Returns user data from users table for profile completion check

 */



require_once __DIR__ . '/bootstrap.php';



header('Content-Type: application/json');



// Only allow GET requests

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    http_response_code(405);

    echo json_encode(['error' => true, 'message' => 'Method not allowed']);

    exit;

}



try {

    // Require authentication

    $auth = requireAuth();

    $userId = $auth['id'];

    

    // Get database connection

    $pdo = getDbConnection();

    

    // Get user profile data

    $stmt = $pdo->prepare("

        SELECT

            u.id,

            u.email,

            u.nama_penuh,

            u.no_ic,

            u.no_telefon,

            u.jantina,

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

            u.url_gambar_profil,

            u.umur,

            u.jenis_pengadil,

            u.tahun_mula_aktif,

            u.saiz_baju,
            u.telegram_chat_id,

            pbd.nama_persatuan as persatuan_bolasepak_daerah,

            u.password_changed,

            p.jenis_pengadil as permohonan_jenis_pengadil,

            (SELECT tahun_permohonan FROM permohonan
             WHERE user_id = u.id AND jenis_borang = 'ujian_bertulis'
             AND status_workflow IN ('Lengkap', 'Admin Diluluskan', 'Bayaran Diterima')
             ORDER BY tahun_permohonan DESC LIMIT 1) AS tahun_lulus_kelas3

        FROM users u

        LEFT JOIN persatuan_bolasepak_daerah pbd ON COALESCE(u.persatuan_id, u.district_id) = pbd.id

        LEFT JOIN permohonan p ON u.id = p.user_id

        WHERE u.id = ?

    ");

    

    $stmt->execute([$userId]);

    $user = $stmt->fetch();

    

    if (!$user) {

        throw new Exception('User not found');

    }

    

    // Debug: Log user data

    error_log('get-user-profile.php - User data: ' . json_encode($user));

    

    echo json_encode([

        'error' => false,

        'user' => $user

    ]);



} catch (Exception $e) {

    http_response_code(400);

    echo json_encode([

        'error' => true,

        'message' => $e->getMessage()

    ]);

}

