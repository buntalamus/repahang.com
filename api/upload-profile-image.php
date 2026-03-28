<?php



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



$method = $_SERVER['REQUEST_METHOD'];



if ($method !== 'POST') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



handleUpload();



function handleUpload(): void

{

    // Check if file was uploaded

    if (!isset($_FILES['image']) || $_FILES['image']['error'] === UPLOAD_ERR_NO_FILE) {

        jsonResponse(['error' => true, 'message' => 'Tiada fail dimuat naik.'], 422);

    }



    $file = $_FILES['image'];



    // Check for upload errors

    if ($file['error'] !== UPLOAD_ERR_OK) {

        $errorMessage = getUploadErrorMessage($file['error']);

        jsonResponse(['error' => true, 'message' => $errorMessage], 400);

    }



    // Validate file type

    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    $finfo = finfo_open(FILEINFO_MIME_TYPE);

    $mimeType = finfo_file($finfo, $file['tmp_name']);

    finfo_close($finfo);



    if (!in_array($mimeType, $allowedTypes, true)) {

        jsonResponse(['error' => true, 'message' => 'Format fail tidak sah. Hanya JPEG, PNG, dan WebP dibenarkan.'], 422);

    }



    // Validate file size (max 5MB)

    $maxSize = 5 * 1024 * 1024; // 5MB in bytes

    if ($file['size'] > $maxSize) {

        jsonResponse(['error' => true, 'message' => 'Saiz fail terlalu besar. Maksimum 5MB.'], 422);

    }



    // Validate image dimensions

    $imageInfo = getimagesize($file['tmp_name']);

    if ($imageInfo === false) {

        jsonResponse(['error' => true, 'message' => 'Fail bukan imej yang sah.'], 422);

    }



    [$width, $height] = $imageInfo;



    // Optional: enforce minimum dimensions

    if ($width < 150 || $height < 150) {

        jsonResponse(['error' => true, 'message' => 'Resolusi imej terlalu kecil. Minimum 150x150 piksel.'], 422);

    }



    // Optional: enforce maximum dimensions

    if ($width > 4000 || $height > 4000) {

        jsonResponse(['error' => true, 'message' => 'Resolusi imej terlalu besar. Maksimum 4000x4000 piksel.'], 422);

    }



    try {

        // Create upload directory if it doesn't exist

        $uploadDir = __DIR__ . '/../uploads';

        if (!is_dir($uploadDir)) {

            if (!mkdir($uploadDir, 0775, true)) {

                throw new RuntimeException('Gagal mencipta direktori penyimpanan.');

            }

        }



        // Generate unique filename

        $extension = match ($mimeType) {

            'image/jpeg', 'image/jpg' => 'jpg',

            'image/png' => 'png',

            'image/webp' => 'webp',

            default => 'jpg',

        };



        $filename = uniqid('profile_', true) . '_' . time() . '.' . $extension;

        $targetPath = $uploadDir . '/' . $filename;



        // Move uploaded file

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {

            throw new RuntimeException('Gagal memuat naik fail.');

        }



        // Set proper permissions

        chmod($targetPath, 0644);



        // Return relative URL

        $fileUrl = '/uploads/' . $filename;



        jsonResponse([

            'error' => false,

            'message' => 'Gambar profil berjaya dimuat naik.',

            'data' => [

                'url' => $fileUrl,

                'filename' => $filename,

            ],

        ]);

    } catch (Throwable $e) {

        error_log('[upload-profile-image.php] handleUpload: ' . $e->getMessage());

        $message = APP_DEBUG ? 'Gagal memuat naik gambar: ' . $e->getMessage() : 'Gagal memuat naik gambar.';

        jsonResponse(['error' => true, 'message' => $message], 500);

    }

}



function getUploadErrorMessage(int $errorCode): string

{

    return match ($errorCode) {

        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Saiz fail melebihi had yang dibenarkan.',

        UPLOAD_ERR_PARTIAL => 'Fail dimuat naik sebahagian sahaja.',

        UPLOAD_ERR_NO_TMP_DIR => 'Direktori sementara tidak wujud.',

        UPLOAD_ERR_CANT_WRITE => 'Gagal menulis fail ke cakera.',

        UPLOAD_ERR_EXTENSION => 'Sambungan PHP menghalang muat naik fail.',

        default => 'Ralat tidak diketahui semasa memuat naik fail.',

    };

}

