<?php

/**

 * API: Get PP Profile

 * Returns PP Daerah profile information

 */



require_once __DIR__ . '/bootstrap.php';



header('Content-Type: application/json');



// Only allow GET requests

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    http_response_code(405);

    echo json_encode(['error' => true, 'message' => 'Method not allowed']);

    exit;

}



// Check if user is authenticated and is a PP Daerah

if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'PP Daerah') {

    http_response_code(403);

    echo json_encode(['error' => true, 'message' => 'Akses ditolak']);

    exit;

}



try {

    $userId = $_SESSION['user_id'];

    

    // Get database connection

    $pdo = getDbConnection();

    

    // Get PP profile data (same as referee profile)

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

            pbd.nama_persatuan as persatuan_bolasepak_daerah,

            u.password_changed,

            p.jenis_pengadil as permohonan_jenis_pengadil

        FROM users u

        LEFT JOIN persatuan_bolasepak_daerah pbd ON COALESCE(u.persatuan_id, u.district_id) = pbd.id

        LEFT JOIN permohonan p ON u.id = p.user_id

        WHERE u.id = ? AND u.role = 'PP Daerah'

    ");

    

    $stmt->execute([$userId]);

    $user = $stmt->fetch();

    

    if (!$user) {

        throw new Exception('Profil PP tidak dijumpai');

    }

    

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

?>