<?php



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



if (!isset($_FILES['resit'])) {

    jsonResponse(['error' => true, 'message' => 'Tiada fail resit diterima.'], 422);

}



$file = $_FILES['resit'];



if ($file['error'] !== UPLOAD_ERR_OK) {

    jsonResponse(['error' => true, 'message' => 'Gagal memuat naik fail. Kod: ' . $file['error']], 422);

}



$allowedMime = ['image/jpeg', 'image/png', 'application/pdf'];

$finfo = new finfo(FILEINFO_MIME_TYPE);

$mime = $finfo->file($file['tmp_name']);



if (!in_array($mime, $allowedMime, true)) {

    jsonResponse(['error' => true, 'message' => 'Format fail tidak dibenarkan.'], 422);

}



if ($file['size'] > 5 * 1024 * 1024) {

    jsonResponse(['error' => true, 'message' => 'Saiz fail melebihi 5MB.'], 422);

}



$uploadsDir = __DIR__ . '/../uploads';

if (!is_dir($uploadsDir)) {

    mkdir($uploadsDir, 0775, true);

}



$mimeToExt = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'application/pdf' => 'pdf'];
$ext = $mimeToExt[$mime] ?? 'dat';
$filename = uniqid('resit_', true) . '.' . $ext;
$destination = $uploadsDir . '/' . $filename;



if (!move_uploaded_file($file['tmp_name'], $destination)) {

    jsonResponse(['error' => true, 'message' => 'Tidak dapat menyimpan fail.'], 500);

}



$publicUrl = '/uploads/' . $filename;



jsonResponse([

    'error' => false,

    'message' => 'Fail berjaya dimuat naik.',

    'data' => ['url' => $publicUrl],

]);

