<?php

/**

 * PP Daerah Referees API

 * Get and manage referees in PP's district

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



// Require PP Daerah role

$currentUser = requireRole(['PP Daerah']);



$method = $_SERVER['REQUEST_METHOD'];



switch ($method) {

    case 'GET':

        handleGetReferees($currentUser);

        break;

    case 'POST':

        handleToggleStatus($currentUser);

        break;

    case 'DELETE':

        handleDeleteReferee($currentUser);

        break;

    default:

        jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



function handleGetReferees(array $currentUser): void

{

    try {

        $pdo = getDbConnection();



        // Check if PP has persatuan assigned

        if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {

            jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);

        }



        $persatuanId = (int) $currentUser['persatuan_id'];



        // Check if requesting single referee

        $singleRefereeId = isset($_GET['single']) ? (int) $_GET['single'] : null;

        if ($singleRefereeId) {

            // Get single referee details

            $refereeStmt = $pdo->prepare("

                SELECT

                    u.*,

                    p.nama_persatuan as persatuan_nama,

                    COUNT(perm.id) as total_permohonan,

                    COUNT(CASE WHEN perm.status = 'Approved' THEN 1 END) as permohonan_lulus,

                    COUNT(CASE WHEN perm.tahun_permohonan = 2026 AND perm.status = 'Approved' THEN 1 END) as permohonan_2026_lulus

                FROM users u

                LEFT JOIN persatuan_bolasepak_daerah p ON u.persatuan_id = p.id

                LEFT JOIN permohonan perm ON u.id = perm.user_id

                WHERE u.id = :referee_id

                AND u.role = 'Pengadil'

                AND u.persatuan_id = :persatuan_id

                GROUP BY u.id

            ");

            $refereeStmt->execute([

                ':referee_id' => $singleRefereeId,

                ':persatuan_id' => $persatuanId

            ]);

            $referee = $refereeStmt->fetch(PDO::FETCH_ASSOC);



            if (!$referee) {

                jsonResponse(['error' => true, 'message' => 'Pengadil tidak dijumpai.'], 404);

            }



            // Get matches for this referee

            $matchesStmt = $pdo->prepare("

                SELECT * FROM perlawanan

                WHERE user_id = :user_id

                ORDER BY tarikh DESC

            ");

            $matchesStmt->execute([':user_id' => $singleRefereeId]);

            $matches = $matchesStmt->fetchAll(PDO::FETCH_ASSOC);



            $referee['perlawanan'] = $matches;



            jsonResponse([

                'error' => false,

                'referees' => [$referee]

            ]);



            return;

        }



        // Get referees in district with application stats

        $refereesStmt = $pdo->prepare("

            SELECT

                u.id,

                u.email,

                u.nama_penuh,

                u.no_ic,

                u.no_telefon,

                u.jenis_pengadil,

                u.aktif,

                u.created_at,

                u.last_login,

                COUNT(p.id) as total_permohonan,

                COUNT(CASE WHEN p.status = 'Approved' THEN 1 END) as permohonan_lulus,

                COUNT(CASE WHEN p.status_workflow = 'Lengkap' THEN 1 END) as permohonan_lengkap,

                MAX(p.tarikh_hantar) as permohonan_terakhir,

                COUNT(CASE WHEN p.tahun_permohonan = 2026 AND p.status = 'Approved' THEN 1 END) as permohonan_2026_lulus

            FROM users u

            LEFT JOIN permohonan p ON u.id = p.user_id

            WHERE u.role = 'Pengadil'

            AND u.persatuan_id = :persatuan_id

            GROUP BY u.id

            ORDER BY u.nama_penuh ASC

        ");



        $refereesStmt->execute([':persatuan_id' => $persatuanId]);

        $referees = $refereesStmt->fetchAll(PDO::FETCH_ASSOC);



        // Get statistics

        $stats = getRefereeStats($pdo, $persatuanId);



        jsonResponse([

            'error' => false,

            'referees' => $referees,

            'statistics' => $stats,

            'persatuan_id' => $persatuanId,

        ]);



    } catch (Throwable $e) {

        error_log('[pp-referees.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

        error_log('[pp-referees.php] Stack trace: ' . $e->getTraceAsString());

        $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to load referees.';

        jsonResponse(['error' => true, 'message' => $message], 500);

    }

}



function handleToggleStatus(array $currentUser): void

{

    $input = getJsonInput();

    $refereeId = isset($input['referee_id']) ? (int) $input['referee_id'] : 0;

    $newStatus = isset($input['aktif']) ? (int) $input['aktif'] : 0;



    if (!$refereeId) {

        jsonResponse(['error' => true, 'message' => 'ID pengadil diperlukan.'], 422);

    }



    if (!in_array($newStatus, [0, 1])) {

        jsonResponse(['error' => true, 'message' => 'Status tidak sah.'], 422);

    }



    try {

        $pdo = getDbConnection();



        // Check if PP has persatuan assigned

        if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {

            jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);

        }



        $persatuanId = (int) $currentUser['persatuan_id'];



        // Verify referee belongs to PP's district

        $checkStmt = $pdo->prepare("

            SELECT id, nama_penuh, aktif

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



        // Update status

        $updateStmt = $pdo->prepare("

            UPDATE users

            SET aktif = :aktif, updated_at = CURRENT_TIMESTAMP

            WHERE id = :referee_id

        ");

        $updateStmt->execute([

            ':aktif' => $newStatus,

            ':referee_id' => $refereeId

        ]);



        // Log activity

        logActivity($pdo, $currentUser['id'], 'toggle_referee_status', 'users', $refereeId,

            "Status pengadil {$referee['nama_penuh']} ditukar kepada " . ($newStatus ? 'Aktif' : 'Tidak Aktif'));



        jsonResponse([

            'error' => false,

            'message' => "Status pengadil berjaya dikemaskini.",

            'referee' => [

                'id' => $refereeId,

                'nama_penuh' => $referee['nama_penuh'],

                'aktif' => $newStatus

            ]

        ]);



    } catch (Throwable $e) {

        error_log('[pp-referees.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

        $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to update referee status.';

        jsonResponse(['error' => true, 'message' => $message], 500);

    }

}

function handleDeleteReferee(array $currentUser): void

{

    $raw = file_get_contents('php://input');

    $input = json_decode($raw, true) ?: [];

    $refereeId = $input['referee_id'] ?? $_GET['id'] ?? 0;

    $refereeId = (int) $refereeId;



    if (!$refereeId) {

        jsonResponse(['error' => true, 'message' => 'ID pengadil diperlukan.'], 422);

    }



    try {

        $pdo = getDbConnection();



        // Check if PP has persatuan assigned

        if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {

            jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);

        }



        $persatuanId = (int) $currentUser['persatuan_id'];



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



        // Delete referee (this will cascade delete related records due to foreign key constraints)

        $deleteStmt = $pdo->prepare("

            DELETE FROM users

            WHERE id = :referee_id

        ");

        $deleteStmt->execute([':referee_id' => $refereeId]);



        // Log activity

        logActivity($pdo, $currentUser['id'], 'delete_referee', 'users', $refereeId,

            "Pengadil {$referee['nama_penuh']} telah dipadamkan");



        jsonResponse([

            'error' => false,

            'message' => "Pengadil berjaya dipadamkan.",

            'referee' => [

                'id' => $refereeId,

                'nama_penuh' => $referee['nama_penuh']

            ]

        ]);



    } catch (Throwable $e) {

        error_log('[pp-referees.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

        $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to delete referee.';

        jsonResponse(['error' => true, 'message' => $message], 500);

    }

}



function getRefereeStats(PDO $pdo, int $persatuanId): array

{

    $stats = [];



    // Total referees

    $totalStmt = $pdo->prepare("

        SELECT COUNT(*) as count FROM users

        WHERE role = 'Pengadil' AND persatuan_id = :persatuan_id

    ");

    $totalStmt->execute([':persatuan_id' => $persatuanId]);

    $stats['total'] = (int) $totalStmt->fetch()['count'];



    // Active referees (those with approved 2026 applications)

    $activeStmt = $pdo->prepare("

        SELECT COUNT(DISTINCT u.id) as count FROM users u

        INNER JOIN permohonan p ON u.id = p.user_id

        WHERE u.role = 'Pengadil' AND u.persatuan_id = :persatuan_id

        AND p.tahun_permohonan = 2026 AND p.status = 'Approved'

    ");

    $activeStmt->execute([':persatuan_id' => $persatuanId]);

    $stats['active'] = (int) $activeStmt->fetch()['count'];



    // Inactive referees (total minus active)

    $stats['inactive'] = $stats['total'] - $stats['active'];



    // Applications this month

    $monthlyStmt = $pdo->prepare("

        SELECT COUNT(*) as count FROM permohonan

        WHERE persatuan_id = :persatuan_id

        AND YEAR(tarikh_hantar) = YEAR(CURRENT_DATE)

        AND MONTH(tarikh_hantar) = MONTH(CURRENT_DATE)

    ");

    $monthlyStmt->execute([':persatuan_id' => $persatuanId]);

    $stats['applications_this_month'] = (int) $monthlyStmt->fetch()['count'];



    // Approved applications this year

    $approvedStmt = $pdo->prepare("

        SELECT COUNT(*) as count FROM permohonan

        WHERE persatuan_id = :persatuan_id

        AND status = 'Approved'

        AND YEAR(status_kemaskini) = YEAR(CURRENT_DATE)

    ");

    $approvedStmt->execute([':persatuan_id' => $persatuanId]);

    $stats['approved_this_year'] = (int) $approvedStmt->fetch()['count'];



    return $stats;

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