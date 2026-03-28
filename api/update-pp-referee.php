<?php

/**

 * Update PP Referee API

 * Update referee details by PP Daerah

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



// Require PP Daerah role

$currentUser = requireRole(['PP Daerah']);



$method = $_SERVER['REQUEST_METHOD'];



if ($method !== 'POST') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



try {

    $pdo = getDbConnection();



    // Check if PP has persatuan assigned

    if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {

        jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);

    }



    $persatuanId = (int) $currentUser['persatuan_id'];



    // Get form data

    $refereeId = isset($_POST['referee_id']) ? (int) $_POST['referee_id'] : 0;

    if (!$refereeId) {

        jsonResponse(['error' => true, 'message' => 'ID pengadil diperlukan.'], 422);

    }



    // Verify referee belongs to PP's district

    $checkStmt = $pdo->prepare("

        SELECT id, nama_penuh

        FROM users

        WHERE id = :referee_id

        AND role = 'Pengadil'

        AND persatuan_id = :persatuan_id

    ");

    $checkStmt->execute([

        ':referee_id' => $refereeId,

        ':persatuan_id' => $persatuanId

    ]);

    $referee = $checkStmt->fetch(PDO::FETCH_ASSOC);



    if (!$referee) {

        jsonResponse(['error' => true, 'message' => 'Pengadil tidak dijumpai atau tidak dalam daerah anda.'], 404);

    }



    // Prepare update data

    $updateData = [];

    $updateFields = [

        'nama_penuh',

        'umur',

        'email',

        'no_telefon',

        'jantina',

        'alamat',

        'jenis_pengadil',

        'tahun_mula_aktif',

        'saiz_baju',

        'status_kerja',

        'jawatan',

        'nama_majikan',

        'alamat_majikan',

        'nama_waris',

        'hubungan_waris',

        'telefon_waris'

    ];



    foreach ($updateFields as $field) {

        if (isset($_POST[$field])) {

            $value = trim($_POST[$field]);

            if ($value !== '') {

                $updateData[$field] = $value;

            }

        }

    }



    if (empty($updateData)) {

        jsonResponse(['error' => true, 'message' => 'Tiada data untuk dikemaskini.'], 422);

    }



    // Build update query

    $setParts = [];

    $params = [':referee_id' => $refereeId];



    foreach ($updateData as $field => $value) {

        $setParts[] = "{$field} = :{$field}";

        $params[":{$field}"] = $value;

    }



    $setParts[] = "updated_at = CURRENT_TIMESTAMP";



    $updateQuery = "

        UPDATE users

        SET " . implode(', ', $setParts) . "

        WHERE id = :referee_id

    ";



    $updateStmt = $pdo->prepare($updateQuery);

    $updateStmt->execute($params);



    // Log activity

    logActivity($pdo, $currentUser['id'], 'update_referee', 'users', $refereeId,

        "Maklumat pengadil {$referee['nama_penuh']} dikemaskini oleh PP Daerah");



    jsonResponse([

        'error' => false,

        'message' => 'Maklumat pengadil berjaya dikemaskini.',

        'referee_id' => $refereeId

    ]);



} catch (Throwable $e) {

    error_log('[update-pp-referee.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

    error_log('[update-pp-referee.php] Stack trace: ' . $e->getTraceAsString());

    $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to update referee.';

        jsonResponse(['error' => true, 'message' => $message], 500);
}

/**
 * Log activity to activity_log table
 */
function logActivity(PDO $pdo, int $userId, string $action, ?string $tableName, ?int $recordId, string $description): void
{
    try {
        $ipAddress = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        $stmt = $pdo->prepare("
            INSERT INTO activity_log (user_id, action, table_name, record_id, description, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ");

        $stmt->execute([$userId, $action, $tableName, $recordId, $description, $ipAddress, $userAgent]);
    } catch (Throwable $e) {
        // Log the error but don't fail the main operation
        error_log('[logActivity] Failed to log activity: ' . $e->getMessage());
    }
}