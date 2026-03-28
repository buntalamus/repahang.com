<?php



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



// Check for multi-role session (user_id) or legacy admin session

if (!isset($_SESSION['user_id']) && !isset($_SESSION['admin_id'])) {

    jsonResponse(['authenticated' => false]);

}



// Return multi-role user data

if (isset($_SESSION['user_id'])) {

    jsonResponse([

        'authenticated' => true,

        'user_id' => (int) $_SESSION['user_id'],

        'user_email' => $_SESSION['user_email'] ?? null,

        'user_role' => $_SESSION['user_role'] ?? null,

        'user_persatuan_id' => $_SESSION['persatuan_id'] ?? null,

        'user_persatuan_name' => $_SESSION['user_persatuan_name'] ?? null,

        'nama_penuh' => $_SESSION['user_nama'] ?? null,

        'password_changed' => $_SESSION['password_changed'] ?? 0,

        'base_url' => BASE_URL,

    ]);

}



// Legacy admin response (backward compatibility)

jsonResponse([

    'authenticated' => true,

    'user_id' => (int) $_SESSION['admin_id'],

    'user_email' => $_SESSION['admin_email'] ?? null,

    'user_role' => 'Admin',

    'data' => [

        'id' => (int) $_SESSION['admin_id'],

        'email' => $_SESSION['admin_email'] ?? null,

    ],

    'base_url' => BASE_URL,

]);

