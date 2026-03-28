<?php

/**

 * API: Preload PP Application Data

 * Returns PP Daerah profile data for preloading application forms

 */



require_once __DIR__ . '/bootstrap.php';



header('Content-Type: application/json');



// Only allow GET requests
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {

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



    // Get PP profile data for application forms

    $stmt = $pdo->prepare("

        SELECT

            u.id as user_id,

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

            u.jenis_pengadil,

            u.tahun_mula_aktif,

            u.saiz_baju,

            pbd.nama_persatuan as user_persatuan_name,

            pbd.id as user_persatuan_id

        FROM users u

        LEFT JOIN persatuan_bolasepak_daerah pbd ON COALESCE(u.persatuan_id, u.district_id) = pbd.id

        WHERE u.id = ? AND u.role = 'PP Daerah'

    ");



    $stmt->execute([$userId]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);



    if (!$user) {

        throw new Exception('Data profil PP tidak dijumpai');

    }



    // Format data for application forms

    $applicationData = [

        // Personal Information

        'nama_penuh' => $user['nama_penuh'] ?? '',

        'no_ic' => $user['no_ic'] ?? '',

        'jantina' => $user['jantina'] ?? '',

        'email' => $user['email'] ?? '',

        'no_telefon' => $user['no_telefon'] ?? '',

        'jenis_pengadil' => $user['jenis_pengadil'] ?? '',

        'tahun_mula_aktif' => $user['tahun_mula_aktif'] ?? '',

        'user_persatuan_name' => $user['user_persatuan_name'] ?? '',

        'user_persatuan_id' => $user['user_persatuan_id'] ?? '',



        // Address Information

        'alamat1' => $user['alamat1'] ?? '',

        'alamat2' => $user['alamat2'] ?? '',

        'poskod' => $user['poskod'] ?? '',

        'daerah' => $user['daerah'] ?? '',

        'negeri' => $user['negeri'] ?? 'Pahang',



        // Employment Information

        'status_kerja' => $user['status_kerja'] ?? '',

        'jawatan' => $user['jawatan'] ?? '',

        'nama_majikan' => $user['nama_majikan'] ?? '',

        'alamat_majikan1' => $user['alamat_majikan1'] ?? '',

        'alamat_majikan2' => $user['alamat_majikan2'] ?? '',

        'poskod_majikan' => $user['poskod_majikan'] ?? '',

        'daerah_majikan' => $user['daerah_majikan'] ?? '',

        'negeri_majikan' => $user['negeri_majikan'] ?? 'Pahang',



        // Emergency Contact

        'nama_waris' => $user['nama_waris'] ?? '',

        'hubungan_waris' => $user['hubungan_waris'] ?? '',

        'telefon_waris' => $user['telefon_waris'] ?? '',



        // Additional Info

        'saiz_baju' => $user['saiz_baju'] ?? '',

        'umur' => $user['umur'] ?? '',



        // User ID for submissions

        'user_id' => $user['user_id']

    ];



    echo json_encode([

        'error' => false,

        'data' => $applicationData,

        'message' => 'Data profil berjaya dimuatkan'

    ]);



} catch (Exception $e) {

    error_log('PP Preload Application Data Error: ' . $e->getMessage());

    http_response_code(400);

    echo json_encode([

        'error' => true,

        'message' => $e->getMessage()

    ]);

}