<?php

/**

 * Pengadil Matches API

 * Get matches for logged-in pengadil

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



// Require Pengadil role

$currentUser = requireRole(['Pengadil']);



try {

    $pdo = getDbConnection();

    $userId = (int) $currentUser['id'];



    // Get pagination parameters

    $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;

    $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;

    $offset = ($page - 1) * $perPage;



    // Get total count for pagination

    $totalStmt = $pdo->prepare("

        SELECT COUNT(*) as total

        FROM perlawanan

        WHERE user_id = :user_id

    ");

    $totalStmt->execute([':user_id' => $userId]);

    $totalRow = $totalStmt->fetch();

    $totalMatches = (int) $totalRow['total'];



    // Get paginated matches for this user

    $matchesStmt = $pdo->prepare("
        SELECT 
            p.id,
            p.match_group_id,
            p.tarikh,
            p.masa,
            p.jenis,
            p.nama_kejohanan,
            p.tempat,
            p.jawatan,
            p.status_pp,
            p.catatan_pp,
            p.verified_at,
            p.created_at,
            p.home_team,
            p.away_team,
            p.lantikan_id,
            p.submitted_by,
            p.daerah_perlawanan_id,
            p.skor_ht_home, p.skor_ht_away,
            p.skor_ft_home, p.skor_ft_away,
            p.skor_et_home, p.skor_et_away,
            p.skor_ps_home, p.skor_ps_away,
            p.cuaca,
            d.nama as daerah_perlawanan_nama,
            u_reporter.nama_penuh as reporter_name,
            u_submitter.nama_penuh as submitter_name,
            u1.nama_penuh as head_referee_name,
            u2.nama_penuh as assistant_referee_1_name,
            u3.nama_penuh as assistant_referee_2_name,
            u4.nama_penuh as fourth_official_name
        FROM perlawanan p
        LEFT JOIN users u_reporter ON p.user_id = u_reporter.id
        LEFT JOIN users u_submitter ON p.submitted_by = u_submitter.id
        LEFT JOIN users u1 ON p.head_referee_id = u1.id
        LEFT JOIN users u2 ON p.assistant_referee_1_id = u2.id
        LEFT JOIN users u3 ON p.assistant_referee_2_id = u3.id
        LEFT JOIN users u4 ON p.fourth_official_id = u4.id
        LEFT JOIN districts d ON p.daerah_perlawanan_id = d.id
        WHERE p.user_id = :user_id
        ORDER BY p.tarikh DESC
        LIMIT :limit OFFSET :offset
    ");



    $matchesStmt->bindValue(':user_id', $userId, PDO::PARAM_INT);

    $matchesStmt->bindValue(':limit', $perPage, PDO::PARAM_INT);

    $matchesStmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    $matchesStmt->execute();

    $matches = $matchesStmt->fetchAll();



    // Count matches for current year

    $currentYear = date('Y');

    $yearCountStmt = $pdo->prepare("

        SELECT COUNT(*) as count

        FROM perlawanan

        WHERE user_id = :user_id

        AND YEAR(tarikh) = :year

    ");



    $yearCountStmt->execute([

        ':user_id' => $userId,

        ':year' => $currentYear

    ]);



    $yearCountRow = $yearCountStmt->fetch();

    $currentYearCount = (int) ($yearCountRow['count'] ?? 0);

    // Count confirmed matches for current year
    $verifiedCountStmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM perlawanan
        WHERE user_id = :user_id
        AND YEAR(tarikh) = :year
        AND status_pp = 'Disahkan'
    ");

    $verifiedCountStmt->execute([
        ':user_id' => $userId,
        ':year' => $currentYear
    ]);

    $verifiedCountRow = $verifiedCountStmt->fetch();
    $verifiedYearCount = (int) ($verifiedCountRow['count'] ?? 0);


    jsonResponse([

        'error' => false,

        'matches' => $matches,

        'statistics' => [

            'total' => $totalMatches,

            'current_year' => $currentYearCount,
            'verified_year' => $verifiedYearCount,

            'year' => $currentYear,

            'minimum_required' => 20,

            'eligible' => $verifiedYearCount >= 20

        ],

        'pagination' => [

            'page' => $page,

            'per_page' => $perPage,

            'total_pages' => ceil($totalMatches / $perPage),

            'total_items' => $totalMatches

        ]

    ]);



} catch (Throwable $e) {

    error_log('[pengadil-matches.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

    error_log('[pengadil-matches.php] Stack trace: ' . $e->getTraceAsString());

    $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to load matches.';

    jsonResponse(['error' => true, 'message' => $message], 500);

}

