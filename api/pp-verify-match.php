<?php

/**
 * PP Daerah Match Verification API (v2)
 * - Persahabatan: grouped by match_group_id, scoped by daerah_perlawanan_id
 * - Lantikan/legacy: scoped by pengadil's persatuan (backward compatible)
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['PP Daerah']);
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetMatches($currentUser);
        break;
    case 'POST':
        handleVerifyMatch($currentUser);
        break;
    case 'DELETE':
        handleDeleteMatch($currentUser);
        break;
    default:
        jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
}

/**
 * Get matches for PP verification.
 * Grouped persahabatan: scoped by daerah_perlawanan_id matching PP's district
 * Legacy/non-grouped: scoped by pengadil's persatuan_id
 */
function handleGetMatches(array $currentUser): void
{
    try {
        $pdo = getDbConnection();

        if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {
            jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);
        }

        $persatuanId = (int) $currentUser['persatuan_id'];

        // Get PP's district ID
        $distStmt = $pdo->prepare("
            SELECT d.id as district_id FROM persatuan_bolasepak_daerah p
            INNER JOIN districts d ON p.daerah = d.nama
            WHERE p.id = :persatuan_id
        ");
        $distStmt->execute([':persatuan_id' => $persatuanId]);
        $distRow = $distStmt->fetch(PDO::FETCH_ASSOC);
        $ppDistrictId = $distRow ? (int) $distRow['district_id'] : 0;

        // Filter parameters
        $status = isset($_GET['status']) ? trim($_GET['status']) : '';
        $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
        $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 20;
        $offset = ($page - 1) * $perPage;

        // Status filter
        $statusFilter = '';
        if ($status === 'pending') {
            $statusFilter = " AND (p.status_pp IS NULL OR p.status_pp = '' OR p.status_pp = 'Belum Disahkan')";
        } elseif ($status === 'verified') {
            $statusFilter = " AND p.status_pp = 'Disahkan'";
        } elseif ($status === 'rejected') {
            $statusFilter = " AND p.status_pp = 'Tidak Disahkan'";
        }

        // Scope: grouped matches by daerah_perlawanan OR legacy by pengadil's persatuan
        $scopeWhere = "(
            (p.match_group_id IS NOT NULL AND p.daerah_perlawanan_id = :pp_district_id)
            OR
            (p.match_group_id IS NULL AND u.persatuan_id = :persatuan_id AND u.role = 'Pengadil')
        )";

        // Fetch all matching rows then group in PHP
        $matchSql = "
            SELECT 
                p.id, p.match_group_id, p.tarikh, p.masa, p.jenis, p.nama_kejohanan,
                p.tempat, p.jawatan, p.home_team, p.away_team,
                p.status_pp, p.catatan_pp, p.verified_at, p.created_at,
                p.lantikan_id, p.submitted_by, p.daerah_perlawanan_id,
                p.skor_ht_home, p.skor_ht_away, p.skor_ft_home, p.skor_ft_away,
                p.skor_et_home, p.skor_et_away, p.skor_ps_home, p.skor_ps_away,
                p.cuaca,
                d.nama as daerah_perlawanan_nama,
                u.id as pengadil_id, u.nama_penuh as pengadil_nama,
                u.no_ic as pengadil_ic, u.jenis_pengadil,
                u_sub.nama_penuh as submitter_name
            FROM perlawanan p
            INNER JOIN users u ON p.user_id = u.id
            LEFT JOIN users u_sub ON p.submitted_by = u_sub.id
            LEFT JOIN districts d ON p.daerah_perlawanan_id = d.id
            WHERE $scopeWhere $statusFilter
            ORDER BY p.tarikh DESC, p.match_group_id, p.id
        ";
        $matchStmt = $pdo->prepare($matchSql);
        $matchStmt->execute([':pp_district_id' => $ppDistrictId, ':persatuan_id' => $persatuanId]);
        $allRows = $matchStmt->fetchAll(PDO::FETCH_ASSOC);

        // Group rows by match_group_id (or individual id for legacy)
        $grouped = [];
        foreach ($allRows as $row) {
            $key = $row['match_group_id'] ?: 'single_' . $row['id'];
            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'match_group_id' => $row['match_group_id'],
                    'id' => (int) $row['id'],
                    'tarikh' => $row['tarikh'],
                    'masa' => $row['masa'],
                    'jenis' => $row['jenis'],
                    'nama_kejohanan' => $row['nama_kejohanan'],
                    'tempat' => $row['tempat'],
                    'home_team' => $row['home_team'],
                    'away_team' => $row['away_team'],
                    'status_pp' => $row['status_pp'],
                    'catatan_pp' => $row['catatan_pp'],
                    'verified_at' => $row['verified_at'],
                    'created_at' => $row['created_at'],
                    'lantikan_id' => $row['lantikan_id'],
                    'submitted_by' => $row['submitted_by'],
                    'submitter_name' => $row['submitter_name'],
                    'daerah_perlawanan_id' => $row['daerah_perlawanan_id'],
                    'daerah_perlawanan_nama' => $row['daerah_perlawanan_nama'],
                    'skor_ht_home' => $row['skor_ht_home'],
                    'skor_ht_away' => $row['skor_ht_away'],
                    'skor_ft_home' => $row['skor_ft_home'],
                    'skor_ft_away' => $row['skor_ft_away'],
                    'skor_et_home' => $row['skor_et_home'],
                    'skor_et_away' => $row['skor_et_away'],
                    'skor_ps_home' => $row['skor_ps_home'],
                    'skor_ps_away' => $row['skor_ps_away'],
                    'cuaca' => $row['cuaca'],
                    'is_grouped' => $row['match_group_id'] !== null,
                    'officials' => [],
                ];
            }
            $grouped[$key]['officials'][] = [
                'id' => (int) $row['id'],
                'user_id' => (int) $row['pengadil_id'],
                'nama' => $row['pengadil_nama'],
                'no_ic' => $row['pengadil_ic'],
                'jenis_pengadil' => $row['jenis_pengadil'],
                'jawatan' => $row['jawatan'],
            ];
        }

        $groupedList = array_values($grouped);
        $totalGroups = count($groupedList);
        $paginatedList = array_slice($groupedList, $offset, $perPage);

        // Statistics
        $statsSql = "
            SELECT 
                COUNT(DISTINCT COALESCE(p.match_group_id, CAST(p.id AS CHAR))) as total,
                COUNT(DISTINCT CASE WHEN p.status_pp IS NULL OR p.status_pp = '' OR p.status_pp = 'Belum Disahkan'
                    THEN COALESCE(p.match_group_id, CAST(p.id AS CHAR)) END) as pending,
                COUNT(DISTINCT CASE WHEN p.status_pp = 'Disahkan'
                    THEN COALESCE(p.match_group_id, CAST(p.id AS CHAR)) END) as verified,
                COUNT(DISTINCT CASE WHEN p.status_pp = 'Tidak Disahkan'
                    THEN COALESCE(p.match_group_id, CAST(p.id AS CHAR)) END) as rejected
            FROM perlawanan p
            INNER JOIN users u ON p.user_id = u.id
            WHERE $scopeWhere
        ";
        $statsStmt = $pdo->prepare($statsSql);
        $statsStmt->execute([':pp_district_id' => $ppDistrictId, ':persatuan_id' => $persatuanId]);
        $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);

        jsonResponse([
            'error' => false,
            'matches' => $paginatedList,
            'statistics' => $stats,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => (int) ceil($totalGroups / $perPage),
                'total_items' => $totalGroups
            ]
        ]);

    } catch (Throwable $e) {
        error_log('[pp-verify-match.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());
        $message = APP_DEBUG ? 'Error: ' . $e->getMessage() : 'Gagal memuatkan senarai perlawanan.';
        jsonResponse(['error' => true, 'message' => $message], 500);
    }
}

/**
 * Verify or reject a match.
 * Grouped: updates ALL rows with same match_group_id
 * Legacy: updates single row by id
 */
function handleVerifyMatch(array $currentUser): void
{
    $input = getJsonInput();
    $matchId = isset($input['match_id']) ? (int) $input['match_id'] : 0;
    $matchGroupId = $input['match_group_id'] ?? null;
    $action = $input['action'] ?? '';
    $notes = trim($input['notes'] ?? '');

    if (($matchId <= 0 && empty($matchGroupId)) || !in_array($action, ['verify', 'reject', 'revert'], true)) {
        jsonResponse(['error' => true, 'message' => 'Parameter tidak sah.'], 422);
    }

    try {
        $pdo = getDbConnection();

        if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {
            jsonResponse(['error' => true, 'message' => 'Persatuan not assigned.'], 403);
        }

        $persatuanId = (int) $currentUser['persatuan_id'];
        $ppUserId = (int) $currentUser['id'];

        // Get PP's district
        $distStmt = $pdo->prepare("
            SELECT d.id FROM persatuan_bolasepak_daerah p
            INNER JOIN districts d ON p.daerah = d.nama
            WHERE p.id = :persatuan_id
        ");
        $distStmt->execute([':persatuan_id' => $persatuanId]);
        $ppDistrictId = (int) ($distStmt->fetchColumn() ?: 0);

        $newStatus = $action === 'verify' ? 'Disahkan' : ($action === 'reject' ? 'Tidak Disahkan' : 'Belum Disahkan');

        if (!empty($matchGroupId)) {
            // --- GROUPED VERIFICATION ---
            $checkStmt = $pdo->prepare("
                SELECT p.id, p.tarikh, p.jenis, p.tempat, p.home_team, p.away_team,
                       p.user_id, u.nama_penuh as pengadil_nama, p.jawatan
                FROM perlawanan p
                INNER JOIN users u ON p.user_id = u.id
                WHERE p.match_group_id = :group_id
                AND p.daerah_perlawanan_id = :district_id
            ");
            $checkStmt->execute([':group_id' => $matchGroupId, ':district_id' => $ppDistrictId]);
            $groupRows = $checkStmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($groupRows)) {
                jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai atau bukan dalam daerah anda.'], 404);
            }

            $pdo->beginTransaction();
            $updateStmt = $pdo->prepare("
                UPDATE perlawanan
                SET status_pp = :status, catatan_pp = :notes, verified_at = NOW(), verified_by = :pp_id
                WHERE match_group_id = :group_id
            ");
            $updateStmt->execute([
                ':status' => $newStatus, ':notes' => $notes,
                ':pp_id' => $ppUserId, ':group_id' => $matchGroupId
            ]);
            $pdo->commit();

            // Notify each unique pengadil in the group
            $firstRow = $groupRows[0];
            $notifiedUsers = [];
            foreach ($groupRows as $row) {
                if (in_array($row['user_id'], $notifiedUsers, true)) continue;
                $notifiedUsers[] = $row['user_id'];

                if ($action === 'revert') {
                    $notifMsg = sprintf('Rekod perlawanan %s vs %s pada %s telah dikembalikan untuk semakan semula oleh PP Daerah.',
                        $firstRow['home_team'], $firstRow['away_team'], date('d/m/Y', strtotime($firstRow['tarikh'])));
                } else {
                    $notifMsg = $action === 'verify'
                        ? sprintf('Rekod perlawanan %s vs %s pada %s telah disahkan oleh PP Daerah.', $firstRow['home_team'], $firstRow['away_team'], date('d/m/Y', strtotime($firstRow['tarikh'])))
                        : sprintf('Rekod perlawanan %s vs %s pada %s tidak disahkan. Catatan: %s', $firstRow['home_team'], $firstRow['away_team'], date('d/m/Y', strtotime($firstRow['tarikh'])), $notes ?: '-');
                }

                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications (user_id, type, subject, message, created_at)
                    VALUES (:user_id, 'Pengesahan Perlawanan', :subject, :message, NOW())
                ");
                $notifStmt->execute([
                    ':user_id' => $row['user_id'],
                    ':subject' => $action === 'verify' ? 'Perlawanan Disahkan' : ($action === 'reject' ? 'Perlawanan Tidak Disahkan' : 'Perlawanan Dikembalikan'),
                    ':message' => $notifMsg
                ]);
            }

            $actionLabel = match ($action) {
                'verify' => 'Perlawanan berjaya disahkan untuk ' . count($groupRows) . ' pegawai.',
                'reject' => 'Perlawanan ditolak untuk ' . count($groupRows) . ' pegawai.',
                'revert' => 'Perlawanan dikembalikan ke status menunggu untuk ' . count($groupRows) . ' pegawai.',
            };

            logActivity($pdo, $ppUserId, 'verify_match_group', 'perlawanan', (int) $firstRow['id'],
                "Perlawanan {$firstRow['home_team']} vs {$firstRow['away_team']} pada " . date('d/m/Y', strtotime($firstRow['tarikh'])) . " - " . count($groupRows) . " pegawai - Status: $newStatus");

            jsonResponse([
                'error' => false,
                'message' => $actionLabel,
                'match' => [
                    'match_group_id' => $matchGroupId,
                    'status_pp' => $newStatus,
                    'verified_at' => date('Y-m-d H:i:s'),
                    'officials_count' => count($groupRows)
                ]
            ]);

        } else {
            // --- LEGACY SINGLE VERIFICATION ---
            $checkStmt = $pdo->prepare("
                SELECT p.id, p.tarikh, p.jenis, p.tempat, p.user_id, p.home_team, p.away_team,
                       u.nama_penuh as pengadil_nama
                FROM perlawanan p
                INNER JOIN users u ON p.user_id = u.id
                WHERE p.id = :match_id
                AND u.persatuan_id = :persatuan_id
                AND u.role = 'Pengadil'
                LIMIT 1
            ");
            $checkStmt->execute([':match_id' => $matchId, ':persatuan_id' => $persatuanId]);
            $match = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$match) {
                jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai atau bukan dalam daerah anda.'], 404);
            }

            $updateStmt = $pdo->prepare("
                UPDATE perlawanan
                SET status_pp = :status, catatan_pp = :notes, verified_at = NOW(), verified_by = :pp_id
                WHERE id = :match_id
            ");
            $updateStmt->execute([
                ':status' => $newStatus, ':notes' => $notes,
                ':pp_id' => $ppUserId, ':match_id' => $matchId
            ]);

            $notifMsg = match ($action) {
                'verify' => sprintf('Rekod perlawanan anda pada %s (%s) telah disahkan oleh PP Daerah.', date('d/m/Y', strtotime($match['tarikh'])), $match['jenis']),
                'reject' => sprintf('Rekod perlawanan anda pada %s (%s) tidak disahkan. Catatan: %s', date('d/m/Y', strtotime($match['tarikh'])), $match['jenis'], $notes ?: '-'),
                'revert' => sprintf('Rekod perlawanan anda pada %s (%s) telah dikembalikan untuk semakan semula oleh PP Daerah.', date('d/m/Y', strtotime($match['tarikh'])), $match['jenis']),
            };

            $notifStmt = $pdo->prepare("
                INSERT INTO notifications (user_id, type, subject, message, created_at)
                VALUES (:user_id, 'Pengesahan Perlawanan', :subject, :message, NOW())
            ");
            $notifStmt->execute([
                ':user_id' => $match['user_id'],
                ':subject' => $action === 'verify' ? 'Perlawanan Disahkan' : ($action === 'reject' ? 'Perlawanan Tidak Disahkan' : 'Perlawanan Dikembalikan'),
                ':message' => $notifMsg
            ]);

            logActivity($pdo, $ppUserId, 'verify_match', 'perlawanan', $matchId,
                "Perlawanan {$match['pengadil_nama']} pada " . date('d/m/Y', strtotime($match['tarikh'])) . " - Status: $newStatus");

            jsonResponse([
                'error' => false,
                'message' => match ($action) {
                    'verify' => 'Perlawanan berjaya disahkan.',
                    'reject' => 'Perlawanan telah ditolak.',
                    'revert' => 'Perlawanan dikembalikan ke status menunggu.',
                },
                'match' => [
                    'id' => $matchId,
                    'status_pp' => $newStatus,
                    'verified_at' => date('Y-m-d H:i:s')
                ]
            ]);
        }

    } catch (Throwable $e) {
        error_log('[pp-verify-match.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());
        $message = APP_DEBUG ? 'Error: ' . $e->getMessage() : 'Gagal mengemaskini status perlawanan.';
        jsonResponse(['error' => true, 'message' => $message], 500);
    }
}

/**
 * Delete a match (grouped or single).
 */
function handleDeleteMatch(array $currentUser): void
{
    $input = getJsonInput();
    $matchId = isset($input['match_id']) ? (int) $input['match_id'] : 0;
    $matchGroupId = $input['match_group_id'] ?? null;

    if ($matchId <= 0 && empty($matchGroupId)) {
        jsonResponse(['error' => true, 'message' => 'Parameter tidak sah.'], 422);
    }

    try {
        $pdo = getDbConnection();

        if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {
            jsonResponse(['error' => true, 'message' => 'Persatuan not assigned.'], 403);
        }

        $persatuanId = (int) $currentUser['persatuan_id'];
        $ppUserId = (int) $currentUser['id'];

        // Get PP's district
        $distStmt = $pdo->prepare("
            SELECT d.id FROM persatuan_bolasepak_daerah p
            INNER JOIN districts d ON p.daerah = d.nama
            WHERE p.id = :persatuan_id
        ");
        $distStmt->execute([':persatuan_id' => $persatuanId]);
        $ppDistrictId = (int) ($distStmt->fetchColumn() ?: 0);

        if (!empty($matchGroupId)) {
            // --- GROUPED DELETE ---
            $checkStmt = $pdo->prepare("
                SELECT p.id, p.home_team, p.away_team, p.tarikh
                FROM perlawanan p
                WHERE p.match_group_id = :group_id
                AND p.daerah_perlawanan_id = :district_id
            ");
            $checkStmt->execute([':group_id' => $matchGroupId, ':district_id' => $ppDistrictId]);
            $groupRows = $checkStmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($groupRows)) {
                jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai atau bukan dalam daerah anda.'], 404);
            }

            $firstRow = $groupRows[0];

            $pdo->beginTransaction();
            $delStmt = $pdo->prepare("DELETE FROM perlawanan WHERE match_group_id = :group_id AND daerah_perlawanan_id = :district_id");
            $delStmt->execute([':group_id' => $matchGroupId, ':district_id' => $ppDistrictId]);
            $pdo->commit();

            logActivity($pdo, $ppUserId, 'delete_match_group', 'perlawanan', (int) $firstRow['id'],
                "Padam perlawanan {$firstRow['home_team']} vs {$firstRow['away_team']} pada " . date('d/m/Y', strtotime($firstRow['tarikh'])) . " - " . count($groupRows) . " rekod");

            jsonResponse([
                'error' => false,
                'message' => 'Perlawanan berjaya dipadam (' . count($groupRows) . ' rekod).'
            ]);

        } else {
            // --- SINGLE DELETE ---
            $checkStmt = $pdo->prepare("
                SELECT p.id, p.home_team, p.away_team, p.tarikh, p.user_id
                FROM perlawanan p
                INNER JOIN users u ON p.user_id = u.id
                WHERE p.id = :match_id
                AND u.persatuan_id = :persatuan_id
                AND u.role = 'Pengadil'
                LIMIT 1
            ");
            $checkStmt->execute([':match_id' => $matchId, ':persatuan_id' => $persatuanId]);
            $match = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$match) {
                jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai atau bukan dalam daerah anda.'], 404);
            }

            $delStmt = $pdo->prepare("DELETE FROM perlawanan WHERE id = :match_id");
            $delStmt->execute([':match_id' => $matchId]);

            logActivity($pdo, $ppUserId, 'delete_match', 'perlawanan', $matchId,
                "Padam perlawanan {$match['home_team']} vs {$match['away_team']} pada " . date('d/m/Y', strtotime($match['tarikh'])));

            jsonResponse([
                'error' => false,
                'message' => 'Perlawanan berjaya dipadam.'
            ]);
        }

    } catch (Throwable $e) {
        error_log('[pp-verify-match.php Line ' . $e->getLine() . '] Delete error: ' . $e->getMessage());
        $message = APP_DEBUG ? 'Error: ' . $e->getMessage() : 'Gagal memadam perlawanan.';
        jsonResponse(['error' => true, 'message' => $message], 500);
    }
}

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
        error_log('[logActivity] Failed: ' . $e->getMessage());
    }
}
