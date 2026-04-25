<?php

/**
 * Admin Match Oversight API
 * Admin boleh tengok semua perlawanan merentas semua daerah,
 * dan override status pengesahan dengan justifikasi mandatori.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Admin']);
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetMatches();
        break;
    case 'POST':
        handleOverride($currentUser);
        break;
    case 'DELETE':
        handleDelete($currentUser);
        break;
    default:
        jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
}

function handleGetMatches(): void
{
    try {
        $pdo = getDbConnection();

        $status    = isset($_GET['status'])   ? trim($_GET['status'])   : '';
        $daerahId  = isset($_GET['daerah_id']) ? (int) $_GET['daerah_id'] : 0;
        $page      = isset($_GET['page'])     ? max(1, (int) $_GET['page']) : 1;
        $perPage   = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 50;
        $offset    = ($page - 1) * $perPage;

        $where = ['1=1'];
        $params = [];

        if ($status === 'pending') {
            $where[] = "(p.status_pp IS NULL OR p.status_pp = '' OR p.status_pp = 'Belum Disahkan')";
        } elseif ($status === 'verified') {
            $where[] = "p.status_pp = 'Disahkan'";
        } elseif ($status === 'rejected') {
            $where[] = "p.status_pp = 'Tidak Disahkan'";
        }

        if ($daerahId > 0) {
            $where[] = 'p.daerah_perlawanan_id = :daerah_id';
            $params[':daerah_id'] = $daerahId;
        }

        $whereClause = implode(' AND ', $where);

        // Fetch all rows then group by match_group_id in PHP (same as PP)
        $sql = "
            SELECT
                p.id, p.match_group_id, p.tarikh, p.masa, p.jenis, p.nama_kejohanan,
                p.tempat, p.jawatan, p.home_team, p.away_team,
                p.status_pp, p.catatan_pp, p.verified_at, p.created_at,
                p.lantikan_id, p.submitted_by, p.daerah_perlawanan_id,
                p.skor_ht_home, p.skor_ht_away, p.skor_ft_home, p.skor_ft_away,
                p.skor_et_home, p.skor_et_away, p.skor_ps_home, p.skor_ps_away,
                p.cuaca,
                d.nama AS daerah_perlawanan_nama,
                u.id AS pengadil_id, u.nama_penuh AS pengadil_nama,
                u.no_ic AS pengadil_ic, u.jenis_pengadil,
                u_sub.nama_penuh AS submitter_name,
                u_ver.nama_penuh AS verified_by_name
            FROM perlawanan p
            INNER JOIN users u ON p.user_id = u.id
            LEFT JOIN users u_sub ON p.submitted_by = u_sub.id
            LEFT JOIN users u_ver ON p.verified_by = u_ver.id
            LEFT JOIN districts d ON p.daerah_perlawanan_id = d.id
            WHERE $whereClause
            ORDER BY p.tarikh DESC, p.match_group_id, p.id
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $allRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Group by match_group_id
        $grouped = [];
        foreach ($allRows as $row) {
            $key = $row['match_group_id'] ?: 'single_' . $row['id'];
            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'match_group_id'        => $row['match_group_id'],
                    'id'                    => (int) $row['id'],
                    'tarikh'                => $row['tarikh'],
                    'masa'                  => $row['masa'],
                    'jenis'                 => $row['jenis'],
                    'nama_kejohanan'        => $row['nama_kejohanan'],
                    'tempat'                => $row['tempat'],
                    'home_team'             => $row['home_team'],
                    'away_team'             => $row['away_team'],
                    'status_pp'             => $row['status_pp'],
                    'catatan_pp'            => $row['catatan_pp'],
                    'verified_at'           => $row['verified_at'],
                    'verified_by_name'      => $row['verified_by_name'],
                    'created_at'            => $row['created_at'],
                    'lantikan_id'           => $row['lantikan_id'],
                    'submitted_by'          => $row['submitted_by'],
                    'submitter_name'        => $row['submitter_name'],
                    'daerah_perlawanan_id'  => $row['daerah_perlawanan_id'],
                    'daerah_perlawanan_nama' => $row['daerah_perlawanan_nama'],
                    'skor_ht_home'          => $row['skor_ht_home'],
                    'skor_ht_away'          => $row['skor_ht_away'],
                    'skor_ft_home'          => $row['skor_ft_home'],
                    'skor_ft_away'          => $row['skor_ft_away'],
                    'skor_et_home'          => $row['skor_et_home'],
                    'skor_et_away'          => $row['skor_et_away'],
                    'skor_ps_home'          => $row['skor_ps_home'],
                    'skor_ps_away'          => $row['skor_ps_away'],
                    'cuaca'                 => $row['cuaca'],
                    'is_grouped'            => $row['match_group_id'] !== null,
                    'officials'             => [],
                ];
            }
            $grouped[$key]['officials'][] = [
                'id'            => (int) $row['id'],
                'user_id'       => (int) $row['pengadil_id'],
                'nama'          => $row['pengadil_nama'],
                'no_ic'         => $row['pengadil_ic'],
                'jenis_pengadil' => $row['jenis_pengadil'],
                'jawatan'       => $row['jawatan'],
            ];
        }

        $groupedList  = array_values($grouped);
        $totalGroups  = count($groupedList);
        $paginated    = array_slice($groupedList, $offset, $perPage);

        // Stats (all daerah)
        $statWhere = $daerahId > 0 ? 'WHERE p.daerah_perlawanan_id = :daerah_id' : '';
        $statSql = "
            SELECT
                COUNT(DISTINCT COALESCE(p.match_group_id, CAST(p.id AS CHAR))) AS total,
                COUNT(DISTINCT CASE WHEN p.status_pp IS NULL OR p.status_pp = '' OR p.status_pp = 'Belum Disahkan'
                    THEN COALESCE(p.match_group_id, CAST(p.id AS CHAR)) END) AS pending,
                COUNT(DISTINCT CASE WHEN p.status_pp = 'Disahkan'
                    THEN COALESCE(p.match_group_id, CAST(p.id AS CHAR)) END) AS verified,
                COUNT(DISTINCT CASE WHEN p.status_pp = 'Tidak Disahkan'
                    THEN COALESCE(p.match_group_id, CAST(p.id AS CHAR)) END) AS rejected
            FROM perlawanan p
            $statWhere
        ";
        $statStmt = $pdo->prepare($statSql);
        if ($daerahId > 0) $statStmt->execute([':daerah_id' => $daerahId]);
        else $statStmt->execute();
        $stats = $statStmt->fetch(PDO::FETCH_ASSOC);

        // Daerah list for filter dropdown
        $daerahStmt = $pdo->query("SELECT id, nama FROM districts ORDER BY nama ASC");
        $daerahList = $daerahStmt->fetchAll(PDO::FETCH_ASSOC);

        jsonResponse([
            'error'      => false,
            'matches'    => $paginated,
            'statistics' => $stats,
            'districts'  => $daerahList,
            'pagination' => [
                'page'        => $page,
                'per_page'    => $perPage,
                'total_pages' => (int) ceil($totalGroups / $perPage),
                'total_items' => $totalGroups,
            ],
        ]);

    } catch (Throwable $e) {
        error_log('[admin-matches.php GET] ' . $e->getMessage());
        $msg = APP_DEBUG ? $e->getMessage() : 'Gagal memuatkan senarai perlawanan.';
        jsonResponse(['error' => true, 'message' => $msg], 500);
    }
}

function handleOverride(array $currentUser): void
{
    $input        = getJsonInput();
    $action       = $input['action']        ?? '';
    $justification = trim($input['justification'] ?? '');
    $matchGroupId = $input['match_group_id'] ?? null;
    $matchId      = isset($input['match_id']) ? (int) $input['match_id'] : 0;

    if (!in_array($action, ['verify', 'reject', 'revert'], true)) {
        jsonResponse(['error' => true, 'message' => 'Action tidak sah.'], 422);
    }
    if ($action !== 'revert' && empty($justification)) {
        jsonResponse(['error' => true, 'message' => 'Justifikasi wajib diisi untuk override admin.'], 422);
    }
    if (empty($matchGroupId) && $matchId <= 0) {
        jsonResponse(['error' => true, 'message' => 'ID perlawanan diperlukan.'], 422);
    }

    try {
        $pdo       = getDbConnection();
        $adminId   = (int) $currentUser['id'];
        $adminName = $currentUser['nama_penuh'] ?? 'Admin';

        $newStatus = match ($action) {
            'verify' => 'Disahkan',
            'reject' => 'Tidak Disahkan',
            'revert' => 'Belum Disahkan',
        };

        $notePrefix = "[Admin Override - $adminName] ";
        $catatan = $action === 'revert'
            ? $notePrefix . ($justification ?: 'Status dikembalikan untuk semakan semula.')
            : $notePrefix . $justification;

        if (!empty($matchGroupId)) {
            // Grouped
            $checkStmt = $pdo->prepare("
                SELECT p.id, p.home_team, p.away_team, p.tarikh, p.user_id, u.nama_penuh AS pengadil_nama
                FROM perlawanan p INNER JOIN users u ON p.user_id = u.id
                WHERE p.match_group_id = :group_id
            ");
            $checkStmt->execute([':group_id' => $matchGroupId]);
            $rows = $checkStmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($rows)) {
                jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai.'], 404);
            }

            $pdo->beginTransaction();
            $pdo->prepare("
                UPDATE perlawanan
                SET status_pp = :status, catatan_pp = :catatan, verified_at = NOW(), verified_by = :admin_id
                WHERE match_group_id = :group_id
            ")->execute([':status' => $newStatus, ':catatan' => $catatan, ':admin_id' => $adminId, ':group_id' => $matchGroupId]);
            $pdo->commit();

            // Notify officials
            $first = $rows[0];
            $notified = [];
            foreach ($rows as $row) {
                if (in_array($row['user_id'], $notified, true)) continue;
                $notified[] = $row['user_id'];
                $msg = match ($action) {
                    'verify' => sprintf('Rekod perlawanan %s vs %s pada %s telah disahkan oleh Admin.', $first['home_team'], $first['away_team'], date('d/m/Y', strtotime($first['tarikh']))),
                    'reject' => sprintf('Rekod perlawanan %s vs %s pada %s tidak disahkan oleh Admin. Justifikasi: %s', $first['home_team'], $first['away_team'], date('d/m/Y', strtotime($first['tarikh'])), $justification),
                    'revert' => sprintf('Rekod perlawanan %s vs %s pada %s telah dikembalikan untuk semakan semula oleh Admin.', $first['home_team'], $first['away_team'], date('d/m/Y', strtotime($first['tarikh']))),
                };
                $pdo->prepare("
                    INSERT INTO notifications (user_id, type, subject, message, created_at)
                    VALUES (:uid, 'Pengesahan Perlawanan', :subject, :message, NOW())
                ")->execute([
                    ':uid'     => $row['user_id'],
                    ':subject' => match ($action) { 'verify' => 'Perlawanan Disahkan (Admin)', 'reject' => 'Perlawanan Tidak Disahkan (Admin)', default => 'Perlawanan Dikembalikan (Admin)' },
                    ':message' => $msg,
                ]);
            }

            logAdminActivity($pdo, $adminId, 'admin_override_match_group', 'perlawanan', (int) $first['id'],
                "Override {$first['home_team']} vs {$first['away_team']} - Status: $newStatus - Justifikasi: $justification");

            jsonResponse([
                'error'   => false,
                'message' => match ($action) {
                    'verify' => 'Perlawanan berjaya disahkan (Admin Override).',
                    'reject' => 'Perlawanan ditolak (Admin Override).',
                    'revert' => 'Status perlawanan dikembalikan.',
                },
            ]);

        } else {
            // Single
            $checkStmt = $pdo->prepare("
                SELECT p.id, p.home_team, p.away_team, p.tarikh, p.user_id
                FROM perlawanan p WHERE p.id = :id LIMIT 1
            ");
            $checkStmt->execute([':id' => $matchId]);
            $match = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$match) {
                jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai.'], 404);
            }

            $pdo->prepare("
                UPDATE perlawanan
                SET status_pp = :status, catatan_pp = :catatan, verified_at = NOW(), verified_by = :admin_id
                WHERE id = :id
            ")->execute([':status' => $newStatus, ':catatan' => $catatan, ':admin_id' => $adminId, ':id' => $matchId]);

            $pdo->prepare("
                INSERT INTO notifications (user_id, type, subject, message, created_at)
                VALUES (:uid, 'Pengesahan Perlawanan', :subject, :message, NOW())
            ")->execute([
                ':uid'     => $match['user_id'],
                ':subject' => match ($action) { 'verify' => 'Perlawanan Disahkan (Admin)', 'reject' => 'Perlawanan Tidak Disahkan (Admin)', default => 'Perlawanan Dikembalikan (Admin)' },
                ':message' => sprintf('Rekod perlawanan anda pada %s telah dikemaskini oleh Admin.', date('d/m/Y', strtotime($match['tarikh']))),
            ]);

            logAdminActivity($pdo, $adminId, 'admin_override_match', 'perlawanan', $matchId,
                "Override {$match['home_team']} vs {$match['away_team']} - Status: $newStatus - Justifikasi: $justification");

            jsonResponse(['error' => false, 'message' => 'Status perlawanan berjaya dikemaskini.']);
        }

    } catch (Throwable $e) {
        error_log('[admin-matches.php POST] ' . $e->getMessage());
        $msg = APP_DEBUG ? $e->getMessage() : 'Gagal mengemaskini status perlawanan.';
        jsonResponse(['error' => true, 'message' => $msg], 500);
    }
}

function handleDelete(array $currentUser): void
{
    $input        = getJsonInput();
    $matchGroupId = $input['match_group_id'] ?? null;
    $matchId      = isset($input['match_id']) ? (int) $input['match_id'] : 0;
    $justification = trim($input['justification'] ?? '');

    if (empty($matchGroupId) && $matchId <= 0) {
        jsonResponse(['error' => true, 'message' => 'ID perlawanan diperlukan.'], 422);
    }
    if (empty($justification)) {
        jsonResponse(['error' => true, 'message' => 'Justifikasi wajib diisi untuk memadam rekod.'], 422);
    }

    try {
        $pdo     = getDbConnection();
        $adminId = (int) $currentUser['id'];

        if (!empty($matchGroupId)) {
            $checkStmt = $pdo->prepare("SELECT id, home_team, away_team, tarikh FROM perlawanan WHERE match_group_id = :group_id LIMIT 1");
            $checkStmt->execute([':group_id' => $matchGroupId]);
            $first = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$first) {
                jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai.'], 404);
            }

            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM perlawanan WHERE match_group_id = :group_id");
            $countStmt->execute([':group_id' => $matchGroupId]);
            $count = (int) $countStmt->fetchColumn();

            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM perlawanan WHERE match_group_id = :group_id")->execute([':group_id' => $matchGroupId]);
            $pdo->commit();

            logAdminActivity($pdo, $adminId, 'admin_delete_match_group', 'perlawanan', (int) $first['id'],
                "Padam {$first['home_team']} vs {$first['away_team']} ($count rekod) - Justifikasi: $justification");

            jsonResponse(['error' => false, 'message' => "Perlawanan dipadam ($count rekod)."]);

        } else {
            $checkStmt = $pdo->prepare("SELECT id, home_team, away_team, tarikh FROM perlawanan WHERE id = :id LIMIT 1");
            $checkStmt->execute([':id' => $matchId]);
            $match = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$match) {
                jsonResponse(['error' => true, 'message' => 'Perlawanan tidak dijumpai.'], 404);
            }

            $pdo->prepare("DELETE FROM perlawanan WHERE id = :id")->execute([':id' => $matchId]);

            logAdminActivity($pdo, $adminId, 'admin_delete_match', 'perlawanan', $matchId,
                "Padam {$match['home_team']} vs {$match['away_team']} - Justifikasi: $justification");

            jsonResponse(['error' => false, 'message' => 'Perlawanan berjaya dipadam.']);
        }

    } catch (Throwable $e) {
        error_log('[admin-matches.php DELETE] ' . $e->getMessage());
        $msg = APP_DEBUG ? $e->getMessage() : 'Gagal memadam perlawanan.';
        jsonResponse(['error' => true, 'message' => $msg], 500);
    }
}

function logAdminActivity(PDO $pdo, int $userId, string $action, ?string $tableName, ?int $recordId, string $description): void
{
    try {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
        $pdo->prepare("
            INSERT INTO activity_log (user_id, action, table_name, record_id, description, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ")->execute([$userId, $action, $tableName, $recordId, $description, $ip, $ua]);
    } catch (Throwable $e) {
        error_log('[logAdminActivity] ' . $e->getMessage());
    }
}
