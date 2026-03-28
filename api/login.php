<?php

/**

 * Multi-Role Login System

 * Supports: Pengadil, Penilai, PP Daerah, Admin

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



$input = getJsonInput();

$email = isset($input['email']) ? trim(strtolower($input['email'])) : '';

$password = $input['password'] ?? '';



if ($email === '' || $password === '') {

    jsonResponse(['error' => true, 'message' => 'Emel dan kata laluan diperlukan.'], 422);

}



try {

    $pdo = getDbConnection();

    

    // Query users table with persatuan info

    $stmt = $pdo->prepare('

        SELECT 

            u.id, 

            u.email, 

            u.password, 

            u.role,

            u.persatuan_id,

            u.district_id,

            u.nama_penuh,

            u.no_ic,

            u.no_telefon,

            u.aktif,

            u.password_changed,

            p.nama_persatuan as persatuan_nama,

            p.kod_persatuan as persatuan_kod

        FROM users u

        LEFT JOIN persatuan_bolasepak_daerah p ON u.persatuan_id = p.id

        WHERE u.email = :email 

        LIMIT 1

    ');

    $stmt->execute([':email' => $email]);

    $user = $stmt->fetch();



    if (!$user) {

        jsonResponse(['error' => true, 'message' => 'Emel atau kata laluan tidak sah.'], 401);

    }



    // Check if user is active

    if ((int) $user['aktif'] !== 1) {

        jsonResponse(['error' => true, 'message' => 'Akaun anda tidak aktif. Sila hubungi pentadbir.'], 403);

    }



    // Verify password

    if (!password_verify($password, $user['password'])) {

        jsonResponse(['error' => true, 'message' => 'Emel atau kata laluan tidak sah.'], 401);

    }



    // Update last login

    $updateStmt = $pdo->prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = :id');

    $updateStmt->execute([':id' => $user['id']]);

    // Regenerate session ID to prevent session fixation
    session_regenerate_id(true);

    // Set session based on role

    $_SESSION['user_id'] = (int) $user['id'];

    $_SESSION['user_email'] = $user['email'];

    $_SESSION['user_role'] = $user['role'];

    $_SESSION['user_nama'] = $user['nama_penuh'];

    $_SESSION['persatuan_id'] = $user['persatuan_id'] ?: $user['district_id']; // Fallback to district_id if persatuan_id is null

    $_SESSION['user_persatuan_name'] = $user['persatuan_nama'];

    $_SESSION['password_changed'] = (int) $user['password_changed'];



    // Backward compatibility for admin

    if ($user['role'] === 'Admin') {

        $_SESSION['admin_id'] = (int) $user['id'];

        $_SESSION['admin_email'] = $user['email'];

    }



    // Determine redirect URL based on role

    $redirectUrls = [

        'Admin' => '/admin-dashboard.html',

        'PP Daerah' => '/pp-dashboard.html',

        'Pengadil' => '/pengadil-dashboard.html',

        'Penilai' => '/penilai-dashboard.html',

    ];



    jsonResponse([

        'error' => false,

        'message' => 'Log masuk berjaya.',

        'data' => [

            'id' => $user['id'],

            'email' => $user['email'],

            'role' => $user['role'],

            'nama_penuh' => $user['nama_penuh'],

            'persatuan_id' => $user['persatuan_id'],

            'persatuan_nama' => $user['persatuan_nama'],

            'password_changed' => (int) $user['password_changed'],

            'redirect_url' => $redirectUrls[$user['role']] ?? '/admin-dashboard.html',

        ],

    ]);

} catch (PDOException $e) {

    error_log('Login error: ' . $e->getMessage());

    jsonResponse(['error' => true, 'message' => 'Ralat pangkalan data semasa log masuk.'], 500);

}

