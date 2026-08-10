<?php
/**
 * Pool Pengadil API - Tag referees to a kejohanan
 * GET    /api/pool-pengadil.php?kejohanan_id=X   - list pool members
 * POST   /api/pool-pengadil.php                   - add to pool (single or batch)
 * DELETE /api/pool-pengadil.php?id=X              - remove from pool
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Admin']);

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $kejohanan_id = (int) ($_GET['kejohanan_id'] ?? 0);
        if (!$kejohanan_id) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
        }

        // Get pool members with full info
        $stmt = $pdo->prepare("
            SELECT pp.id AS pool_id, pp.kejohanan_id,
                pp.pengadil_id, pp.pengadil_luar_id,
                CASE
                    WHEN pp.pengadil_id IS NOT NULL THEN u.nama_penuh
                    WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.nama
                END AS nama,
                CASE
                    WHEN pp.pengadil_id IS NOT NULL THEN 'Berdaftar'
                    WHEN pp.pengadil_luar_id IS NOT NULL THEN 'Luar'
                END AS jenis_sumber,
                CASE
                    WHEN pp.pengadil_id IS NOT NULL THEN u.daerah
                    WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.daerah
                END AS daerah,
                CASE
                    WHEN pp.pengadil_id IS NOT NULL THEN u.negeri
                    WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.negeri
                END AS negeri,
                COALESCE(k.peringkat_kejohanan, 'Daerah') AS peringkat_kejohanan,
                CASE
                    WHEN pp.pengadil_id IS NOT NULL THEN u.no_telefon
                    WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.no_tel
                END AS no_tel,
                CASE
                    WHEN pp.pengadil_id IS NOT NULL THEN u.email
                    WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.emel
                END AS emel,
                CASE
                    WHEN pp.pengadil_id IS NOT NULL THEN u.jenis_pengadil
                    WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.jenis_pengadil
                END AS jenis_pengadil
            FROM pool_pengadil pp
            JOIN kejohanan k ON pp.kejohanan_id = k.id
            LEFT JOIN users u ON pp.pengadil_id = u.id
            LEFT JOIN pengadil_luar pl ON pp.pengadil_luar_id = pl.id
            WHERE pp.kejohanan_id = :kid
            ORDER BY nama ASC
        ");
        $stmt->execute([':kid' => $kejohanan_id]);
        $pool = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($pool as &$member) {
            $member['wilayah'] = $member['peringkat_kejohanan'] === 'Negeri'
                ? ($member['daerah'] ?: '-')
                : ($member['negeri'] ?: '-');
        }
        unset($member);

        jsonResponse(['error' => false, 'data' => $pool]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $kejohanan_id = (int) ($input['kejohanan_id'] ?? 0);

        if (!$kejohanan_id) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
        }

        // Support batch add
        $items = $input['items'] ?? [];

        // Single add fallback
        if (empty($items)) {
            $pengadil_id = isset($input['pengadil_id']) ? (int) $input['pengadil_id'] : null;
            $pengadil_luar_id = isset($input['pengadil_luar_id']) ? (int) $input['pengadil_luar_id'] : null;

            if (!$pengadil_id && !$pengadil_luar_id) {
                jsonResponse(['error' => true, 'message' => 'pengadil_id atau pengadil_luar_id diperlukan.'], 400);
            }

            $items = [['pengadil_id' => $pengadil_id, 'pengadil_luar_id' => $pengadil_luar_id]];
        }

        $added = 0;
        $skipped = 0;
        $stmt = $pdo->prepare("
            INSERT IGNORE INTO pool_pengadil (kejohanan_id, pengadil_id, pengadil_luar_id)
            VALUES (:kid, :pid, :plid)
        ");

        foreach ($items as $item) {
            $pid = !empty($item['pengadil_id']) ? (int) $item['pengadil_id'] : null;
            $plid = !empty($item['pengadil_luar_id']) ? (int) $item['pengadil_luar_id'] : null;

            if (!$pid && !$plid) continue;

            $stmt->execute([
                ':kid'  => $kejohanan_id,
                ':pid'  => $pid,
                ':plid' => $plid,
            ]);

            if ($stmt->rowCount() > 0) {
                $added++;
            } else {
                $skipped++;
            }
        }

        $msg = "$added pengadil ditambah ke pool.";
        if ($skipped > 0) {
            $msg .= " $skipped sudah ada dalam pool.";
        }
        jsonResponse(['error' => false, 'message' => $msg, 'added' => $added, 'skipped' => $skipped]);
    }

    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }
        $pdo->prepare("DELETE FROM pool_pengadil WHERE id = :id")->execute([':id' => $id]);
        jsonResponse(['error' => false, 'message' => 'Dibuang dari pool.']);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    error_log('[pool-pengadil.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
