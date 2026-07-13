<?php
/**
 * PP Daerah Penilaian Reports API
 * 
 * GET  (no params)     - list all confirmed reports for pengadil in PP's district
 * GET  ?id=X           - single report detail
 * 
 * PP Daerah can view reports for pengadil belonging to their persatuan/daerah.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/kriteria-penilaian.php';

$currentUser = requireRole(['PP Daerah']);

try {
    $pdo = getDbConnection();

    $persatuanId = (int) ($currentUser['persatuan_id'] ?? 0);
    if (!$persatuanId) {
        jsonResponse(['error' => true, 'message' => 'Persatuan ID tidak ditemui.'], 400);
    }

    // Get all pengadil IDs in this district
    $refStmt = $pdo->prepare("SELECT id FROM users WHERE persatuan_id = :pid AND role IN ('Pengadil', 'Penilai')");
    $refStmt->execute([':pid' => $persatuanId]);
    $refIds = array_column($refStmt->fetchAll(), 'id');

    if (empty($refIds)) {
        jsonResponse(['error' => false, 'data' => []]);
    }

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {

        // Single report detail
        if (isset($_GET['id'])) {
            $id = (int) $_GET['id'];
            $stmt = $pdo->prepare("
                SELECT lp.*,
                       jp.no_perlawanan, jp.tarikh, jp.masa, jp.pasukan_home, jp.pasukan_away, jp.tempat,
                       k.nama AS nama_kejohanan,
                       COALESCE(u_penilai.nama_penuh, pl_penilai.nama) AS nama_penilai
                FROM laporan_penilaian lp
                JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                JOIN kejohanan k ON jp.kejohanan_id = k.id
                LEFT JOIN users u_penilai ON lp.penilai_id = u_penilai.id
                LEFT JOIN lantikan_pengadil lp2 ON lp.lantikan_id = lp2.id
                LEFT JOIN pengadil_luar pl_penilai ON lp2.pengadil_luar_id = pl_penilai.id
                WHERE lp.id = :id AND lp.status = 'Disahkan'
            ");
            $stmt->execute([':id' => $id]);
            $report = $stmt->fetch();

            if (!$report) {
                jsonResponse(['error' => true, 'message' => 'Laporan tidak dijumpai.'], 404);
            }

            // Verify that at least one pegawai in this report belongs to our district
            $pgStmt = $pdo->prepare("
                SELECT lpp.*, lp.pengadil_id
                FROM laporan_penilaian_pegawai lpp
                LEFT JOIN lantikan_pengadil lp ON lpp.lantikan_pengadil_id = lp.id
                WHERE lpp.laporan_id = :lid
                ORDER BY FIELD(lpp.jawatan,'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')
            ");
            $pgStmt->execute([':lid' => $id]);
            $pegawaiList = $pgStmt->fetchAll();

            $hasOurPengadil = false;
            foreach ($pegawaiList as &$pg) {
                // Get pengadil_id from lantikan
                if ($pg['lantikan_pengadil_id']) {
                    $lpCheck = $pdo->prepare("SELECT pengadil_id FROM lantikan_pengadil WHERE id = :lid");
                    $lpCheck->execute([':lid' => $pg['lantikan_pengadil_id']]);
                    $lpRow = $lpCheck->fetch();
                    if ($lpRow && in_array((int)$lpRow['pengadil_id'], $refIds)) {
                        $hasOurPengadil = true;
                    }
                }
                // Decode JSON columns
                foreach (['kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan','fizikal_kelemahan','kerjasama_kekuatan','kerjasama_kelemahan'] as $col) {
                    if (isset($pg[$col]) && is_string($pg[$col])) {
                        $pg[$col] = json_decode($pg[$col], true) ?: [];
                    }
                }
            }
            unset($pg);

            if (!$hasOurPengadil) {
                jsonResponse(['error' => true, 'message' => 'Laporan ini tiada pengadil dalam daerah anda.'], 403);
            }

            $report['pegawai'] = $pegawaiList;
            jsonResponse(['error' => false, 'laporan' => $report]);
        }

        // List all confirmed reports that involve our district's pengadil
        $placeholders = implode(',', array_fill(0, count($refIds), '?'));
        $sql = "
            SELECT DISTINCT lp.id, lp.jadual_id, lp.tahap_kesukaran, lp.status, lp.tarikh_hantar, lp.tarikh_sahkan,
                   lp.skor_ht_home, lp.skor_ht_away, lp.skor_ft_home, lp.skor_ft_away,
                   jp.no_perlawanan, jp.tarikh, jp.masa, jp.pasukan_home, jp.pasukan_away, jp.tempat,
                   k.nama AS nama_kejohanan,
                   COALESCE(u_penilai.nama_penuh, pl_penilai.nama) AS nama_penilai
            FROM laporan_penilaian lp
            JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
            JOIN kejohanan k ON jp.kejohanan_id = k.id
            LEFT JOIN users u_penilai ON lp.penilai_id = u_penilai.id
            LEFT JOIN lantikan_pengadil lp2 ON lp.lantikan_id = lp2.id
            LEFT JOIN pengadil_luar pl_penilai ON lp2.pengadil_luar_id = pl_penilai.id
            JOIN laporan_penilaian_pegawai lpg ON lpg.laporan_id = lp.id
            JOIN lantikan_pengadil lp3 ON lpg.lantikan_pengadil_id = lp3.id
            WHERE lp.status = 'Disahkan'
            AND lp3.pengadil_id IN ($placeholders)
            ORDER BY jp.tarikh DESC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($refIds);
        $reports = $stmt->fetchAll();

        // Attach pegawai summary to each report
        foreach ($reports as &$r) {
            $pgStmt = $pdo->prepare("
                SELECT lpg.jawatan, lpg.nama_pengadil, lpg.markah, lpg.prestasi
                FROM laporan_penilaian_pegawai lpg
                WHERE lpg.laporan_id = :lid
                ORDER BY FIELD(lpg.jawatan,'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')
            ");
            $pgStmt->execute([':lid' => $r['id']]);
            $r['pegawai'] = $pgStmt->fetchAll();
        }
        unset($r);

        jsonResponse(['error' => false, 'data' => $reports]);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    error_log('[pp-penilaian.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
