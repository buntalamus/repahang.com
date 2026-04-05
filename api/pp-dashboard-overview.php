<?php

/**

 * PP Daerah Dashboard Overview API

 * Get overview statistics for PP dashboard

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



// Require PP Daerah role

$currentUser = requireRole(['PP Daerah']);



$method = $_SERVER['REQUEST_METHOD'];



if ($method !== 'GET') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



handleGetDashboardOverview();



function handleGetDashboardOverview(): void

{

    global $currentUser;



    try {

        $pdo = getDbConnection();



        // Check if PP has persatuan assigned

        if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {

            error_log('PP Dashboard: persatuan_id not set for user: ' . json_encode($currentUser));

            jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);

        }



        $persatuanId = (int) $currentUser['persatuan_id'];



        // Get overview statistics

        $overview = [

            'total_referees' => getRegisteredRefereesCount($pdo, $persatuanId),

            'pending_applications' => getPendingApplicationsCount($pdo, $persatuanId),
            'approved_applications' => getApprovedApplicationsCount($pdo, $persatuanId),

            'total_matches' => getTotalMatchesCount($pdo, $persatuanId),

            'matches_this_month' => getMatchesThisMonthCount($pdo, $persatuanId),

            'verified_matches' => getVerifiedMatchesCount($pdo, $persatuanId),

            'verification_rate' => getVerificationRate($pdo, $persatuanId),

            'pending_matches' => getPendingMatchesCount($pdo, $persatuanId)

        ];



        // Get top 5 referees by match count

        $topReferees = getTopRefereesByMatches($pdo, $persatuanId);



        // Get current assignments

        $currentAssignments = getCurrentAssignments($pdo, $persatuanId);



        jsonResponse([

            'error' => false,

            'overview' => $overview,

            'top_referees' => $topReferees,

            'current_assignments' => $currentAssignments

        ]);



    } catch (Throwable $e) {

        error_log('[pp-dashboard-overview.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

        error_log('[pp-dashboard-overview.php] Stack trace: ' . $e->getTraceAsString());

        $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to load dashboard overview.';

        jsonResponse(['error' => true, 'message' => $message], 500);

    }

}



function getRegisteredRefereesCount(PDO $pdo, int $persatuanId): int

{

    // Count all referees in the district (role = 'Pengadil')

    $stmt = $pdo->prepare("

        SELECT COUNT(*) as count

        FROM users u

        WHERE u.role = 'Pengadil'

        AND u.persatuan_id = :persatuan_id

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    return $result ? (int) $result['count'] : 0;

}



function getInactiveRefereesCount(PDO $pdo, int $persatuanId): int

{

    // Count referees who do NOT have an approved application

    $stmt = $pdo->prepare("

        SELECT COUNT(*) as count

        FROM users u

        WHERE u.role = 'Pengadil'

        AND u.persatuan_id = :persatuan_id

        AND NOT EXISTS (

            SELECT 1 FROM permohonan p

            WHERE p.user_id = u.id

            AND p.status_workflow = 'Admin Diluluskan'

        )

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    return $result ? (int) $result['count'] : 0;

}



function getTotalMatchesCount(PDO $pdo, int $persatuanId): int

{

    $stmt = $pdo->prepare("

        SELECT COUNT(*) as count

        FROM perlawanan p

        JOIN permohonan pm ON p.permohonan_id = pm.id

        WHERE pm.persatuan_id = :persatuan_id

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    return $result ? (int) $result['count'] : 0;

}



function getMatchesThisMonthCount(PDO $pdo, int $persatuanId): int

{

    $stmt = $pdo->prepare("

        SELECT COUNT(*) as count

        FROM perlawanan p

        JOIN permohonan pm ON p.permohonan_id = pm.id

        WHERE pm.persatuan_id = :persatuan_id

        AND YEAR(p.tarikh) = YEAR(CURRENT_DATE)

        AND MONTH(p.tarikh) = MONTH(CURRENT_DATE)

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    return $result ? (int) $result['count'] : 0;

}



function getVerificationRate(PDO $pdo, int $persatuanId): float

{

    $total = getTotalMatchesCount($pdo, $persatuanId);

    $verified = getVerifiedMatchesCount($pdo, $persatuanId);

    return $total > 0 ? round(($verified / $total) * 100, 1) : 0.0;

}



function getVerifiedMatchesCount(PDO $pdo, int $persatuanId): int

{

    $stmt = $pdo->prepare("

        SELECT COUNT(*) as count

        FROM perlawanan p

        JOIN permohonan pm ON p.permohonan_id = pm.id

        WHERE pm.persatuan_id = :persatuan_id

        AND p.status_pp = 'Disahkan'

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    $result = $stmt->fetch();

    return $result ? (int) $result['count'] : 0;

}



function getTopRefereesByMatches(PDO $pdo, int $persatuanId): array

{

    $stmt = $pdo->prepare("

        SELECT

            u.id,

            u.nama_penuh,

            u.jenis_pengadil,

            COUNT(DISTINCT pp.perlawanan_id) as total_matches,

            COUNT(DISTINCT CASE WHEN p.status_pp = 'Disahkan' THEN pp.perlawanan_id END) as verified_matches

        FROM users u

        JOIN perlawanan_pengadil pp ON u.id = pp.pengadil_id

        JOIN perlawanan p ON pp.perlawanan_id = p.id

        JOIN permohonan pm ON p.permohonan_id = pm.id

        WHERE u.role = 'Pengadil'

        AND u.persatuan_id = :persatuan_id

        GROUP BY u.id, u.nama_penuh, u.jenis_pengadil

        ORDER BY total_matches DESC, verified_matches DESC

        LIMIT 5

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);

}



function getCurrentAssignments(PDO $pdo, int $persatuanId): array

{

    // Get current/future assignments for referees in this district

    $stmt = $pdo->prepare("

        SELECT

            p.jenis,

            p.tempat,

            p.tarikh,

            p.jawatan,

            u.nama_penuh,

            p.status_pp as status

        FROM perlawanan p

        JOIN permohonan pm ON p.permohonan_id = pm.id

        JOIN users u ON pm.user_id = u.id

        WHERE pm.persatuan_id = :persatuan_id

        AND u.role = 'Pengadil'

        AND p.tarikh >= CURDATE()

        ORDER BY p.tarikh ASC

        LIMIT 10

    ");

    $stmt->execute([':persatuan_id' => $persatuanId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);

}
function getPendingApplicationsCount(PDO $pdo, int $persatuanId): int
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM permohonan p
        JOIN users u ON p.user_id = u.id
        WHERE u.persatuan_id = :persatuan_id
        AND p.status_workflow IN ('Menunggu PP Daerah', 'Menunggu Admin')
    ");
    $stmt->execute([':persatuan_id' => $persatuanId]);
    $result = $stmt->fetch();
    return $result ? (int) $result['count'] : 0;
}

function getApprovedApplicationsCount(PDO $pdo, int $persatuanId): int
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM permohonan p
        JOIN users u ON p.user_id = u.id
        WHERE u.persatuan_id = :persatuan_id
        AND p.status_workflow = 'Admin Diluluskan'
    ");
    $stmt->execute([':persatuan_id' => $persatuanId]);
    $result = $stmt->fetch();
    return $result ? (int) $result['count'] : 0;
}

function getPendingMatchesCount(PDO $pdo, int $persatuanId): int
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM perlawanan p
        INNER JOIN users u ON p.user_id = u.id
        WHERE u.persatuan_id = :persatuan_id
        AND u.role = 'Pengadil'
        AND (p.status_pp IS NULL OR p.status_pp = '' OR p.status_pp = 'Menunggu')
    ");
    $stmt->execute([':persatuan_id' => $persatuanId]);
    $result = $stmt->fetch();
    return $result ? (int) $result['count'] : 0;
}
