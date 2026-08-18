<?php
/**
 * Jadual Lantikan Report API (Admin)
 * GET  /api/jadual-lantikan-report.php?kejohanan_id=X
 *      → full appointment schedule with referee details + pengesahan status
 * POST { action: 'sahkan', kejohanan_id, nama_penyahkan, jawatan_penyahkan, nota }
 *      → save verification record
 * POST { action: 'batal', kejohanan_id }
 *      → remove verification record
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/lantikan-helper.php';

$currentUser = requireRole(['Admin']);

$JAWATAN_LIST = [
    'Pengadil',
    'Penolong Pengadil 1',
    'Penolong Pengadil 2',
    'Pegawai ke4',
    'Penilai Pengadil',
];

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // ─── GET: Full report ───────────────────────────────────────────────────
    if ($method === 'GET') {
        $kejohananId = (int) ($_GET['kejohanan_id'] ?? 0);
        if (!$kejohananId) {
            jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
        }

        // Auto-tolak lantikan yang tempoh jawapannya sudah tamat
        autoTolakLantikanTertunggak($pdo, ['kejohanan_id' => $kejohananId]);

        // 1. Kejohanan info
        $stmt = $pdo->prepare("SELECT id, nama, tarikh_mula, tarikh_akhir, tempat, anjuran, logo_kiri, logo_kanan, status, COALESCE(peringkat_kejohanan, 'Daerah') AS peringkat_kejohanan FROM kejohanan WHERE id = ?");
        $stmt->execute([$kejohananId]);
        $kejohanan = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$kejohanan) {
            jsonResponse(['error' => true, 'message' => 'Kejohanan tidak dijumpai.'], 404);
        }

        // 2. Pengesahan record
        $stmt = $pdo->prepare("SELECT * FROM jadual_lantikan_pengesahan WHERE kejohanan_id = ?");
        $stmt->execute([$kejohananId]);
        $pengesahan = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        if ($pengesahan) {
            // Generate verification code from kejohanan_id + timestamp
            $pengesahan['kod_verifikasi'] = strtoupper(
                substr(hash('sha256', $pengesahan['kejohanan_id'] . '|' . $pengesahan['tarikh_sahkan'] . '|RFPHG2025'), 0, 12)
            );
        }

        // 3. All jadual for this kejohanan
        $stmt = $pdo->prepare("
            SELECT id, no_perlawanan, tarikh, hari, masa, kategori, peringkat, kumpulan,
                   pasukan_home, pasukan_away, tempat, status
            FROM jadual_perlawanan
            WHERE kejohanan_id = ?
            ORDER BY kategori ASC, tarikh ASC, masa ASC,
                     CAST(SUBSTRING_INDEX(no_perlawanan, '-', -1) AS UNSIGNED) ASC,
                     no_perlawanan ASC
        ");
        $stmt->execute([$kejohananId]);
        $jadualList = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 4. All assignments for this kejohanan
        $stmt = $pdo->prepare("
            SELECT lp.jadual_id, lp.jawatan, lp.status AS status_lantikan,
                   lp.pengadil_id,
                   COALESCE(p.nama_penuh, pl.nama) AS nama_penuh,
                   COALESCE(p.jenis_pengadil, pl.jenis_pengadil) AS jenis_pengadil,
                   COALESCE(p.daerah, pl.daerah) AS daerah,
                   COALESCE(p.negeri, pl.negeri) AS negeri,
                   COALESCE(p.no_telefon, pl.no_tel) AS no_telefon,
                   CASE WHEN lp.pengadil_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber,
                   lp.notif_hantar,
                   CASE WHEN lp.komen = :auto_tolak_komen THEN 1 ELSE 0 END AS is_auto_tolak
            FROM lantikan_pengadil lp
            LEFT JOIN users p ON lp.pengadil_id = p.id
            LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
            JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
            WHERE jp.kejohanan_id = :kejohanan_id
        ");
        $stmt->execute([
            ':auto_tolak_komen' => LANTIKAN_AUTO_TOLAK_KOMEN,
            ':kejohanan_id' => $kejohananId,
        ]);
        $allAssignments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $regionLabel = $kejohanan['peringkat_kejohanan'] === 'Negeri' ? 'Daerah' : 'Negeri';
        foreach ($allAssignments as &$assignment) {
            $assignment['wilayah'] = $regionLabel === 'Daerah'
                ? ($assignment['daerah'] ?: '-')
                : ($assignment['negeri'] ?: '-');
        }
        unset($assignment);

        // Group assignments by jadual_id → jawatan
        $assignmentMap = [];
        $totalLantikan = 0;
        $totalTerima = 0;
        foreach ($allAssignments as $a) {
            $assignmentMap[(int)$a['jadual_id']][$a['jawatan']] = $a;
            if (in_array($a['status_lantikan'], ['Belum Jawab', 'Diterima'], true)) {
                $totalLantikan++;
            }
            if ($a['status_lantikan'] === 'Diterima') $totalTerima++;
        }

        // Attach assignments to each jadual + compute completeness
        $lengkap = 0;
        $separa = 0;
        $tiada = 0;
        foreach ($jadualList as &$j) {
            $j['is_started'] = hasMatchStarted((string) $j['tarikh'], (string) $j['masa']);
            $j['assignments'] = [];
            $jCount = 0;
            $activePositions = [];
            foreach ($JAWATAN_LIST as $jaw) {
                $a = $assignmentMap[(int)$j['id']][$jaw] ?? null;
                $j['assignments'][$jaw] = $a;
                if ($a && in_array($a['status_lantikan'], ['Belum Jawab', 'Diterima'], true)) {
                    $jCount++;
                    $activePositions[$jaw] = true;
                }
            }
            $j['jumlah_lantikan'] = $jCount;
            $j['is_lengkap'] = $jCount >= 3 && $jCount <= 5
                && isset(
                    $activePositions['Pengadil'],
                    $activePositions['Penolong Pengadil 1'],
                    $activePositions['Penolong Pengadil 2']
                );
            if ($j['is_lengkap']) $lengkap++;
            elseif ($jCount === 0) $tiada++;
            else $separa++;
        }
        unset($j);

        $stats = [
            'total_perlawanan'    => count($jadualList),
            'lantikan_lengkap'    => $lengkap,
            'lantikan_separa'     => $separa,
            'tiada_lantikan'      => $tiada,
            'jumlah_lantikan'     => $totalLantikan,
            'jumlah_terima'       => $totalTerima,
            'kadar_terima'        => $totalLantikan > 0 ? round($totalTerima / $totalLantikan * 100) : 0,
        ];

        jsonResponse([
            'error'      => false,
            'kejohanan'  => $kejohanan,
            'region_label' => $regionLabel,
            'pengesahan' => $pengesahan,
            'stats'      => $stats,
            'jadual'     => $jadualList,
        ]);
    }

    // ─── POST: Sahkan / Batal ────────────────────────────────────────────────
    if ($method === 'POST') {
        $body = getJsonInput();
        $action = $body['action'] ?? '';

        if ($action === 'sahkan') {
            $kejohananId   = (int) ($body['kejohanan_id'] ?? 0);
            $namaPenyahkan = trim($body['nama_penyahkan'] ?? '');
            $jawatanPenyahkan = trim($body['jawatan_penyahkan'] ?? '');
            $nota = trim($body['nota'] ?? '');

            if (!$kejohananId || !$namaPenyahkan || !$jawatanPenyahkan) {
                jsonResponse(['error' => true, 'message' => 'Data tidak lengkap.'], 400);
            }
            if (mb_strlen($nota) > 500) {
                jsonResponse(['error' => true, 'message' => 'Nota terlalu panjang (maks 500 aksara).'], 400);
            }

            $incompleteStmt = $pdo->prepare("
                SELECT jp.no_perlawanan
                FROM jadual_perlawanan jp
                LEFT JOIN lantikan_pengadil lp
                  ON lp.jadual_id = jp.id
                 AND lp.status IN ('Belum Jawab', 'Diterima')
                WHERE jp.kejohanan_id = :kid
                  AND jp.status NOT IN ('Dibatalkan', 'Ditangguhkan')
                GROUP BY jp.id, jp.no_perlawanan, jp.status
                HAVING jp.status NOT IN ('Disahkan', 'Selesai')
                    OR COUNT(DISTINCT lp.jawatan) < 3
                    OR COUNT(DISTINCT lp.jawatan) > 5
                    OR SUM(lp.jawatan = 'Pengadil') = 0
                    OR SUM(lp.jawatan = 'Penolong Pengadil 1') = 0
                    OR SUM(lp.jawatan = 'Penolong Pengadil 2') = 0
                    OR SUM(lp.status = 'Belum Jawab' AND lp.notif_hantar = 0) > 0
                LIMIT 10
            ");
            $incompleteStmt->execute([':kid' => $kejohananId]);
            $incompleteMatches = $incompleteStmt->fetchAll(PDO::FETCH_COLUMN);
            if ($incompleteMatches !== []) {
                jsonResponse([
                    'error' => true,
                    'message' => 'Jadual belum boleh disahkan. Lengkapkan dan hantar lantikan minimum Pengadil, AR1 dan AR2 bagi: '
                        . implode(', ', array_map('strval', $incompleteMatches)) . '.',
                ], 409);
            }

            // Upsert
            $stmt = $pdo->prepare("
                INSERT INTO jadual_lantikan_pengesahan
                    (kejohanan_id, nama_penyahkan, jawatan_penyahkan, nota, tarikh_sahkan, created_by)
                VALUES (?, ?, ?, ?, NOW(), ?)
                ON DUPLICATE KEY UPDATE
                    nama_penyahkan = VALUES(nama_penyahkan),
                    jawatan_penyahkan = VALUES(jawatan_penyahkan),
                    nota = VALUES(nota),
                    tarikh_sahkan = NOW(),
                    created_by = VALUES(created_by)
            ");
            $stmt->execute([$kejohananId, $namaPenyahkan, $jawatanPenyahkan, $nota, $currentUser['id']]);

            jsonResponse(['error' => false, 'message' => 'Jadual lantikan berjaya disahkan.']);
        }

        if ($action === 'batal') {
            $kejohananId = (int) ($body['kejohanan_id'] ?? 0);
            if (!$kejohananId) {
                jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
            }
            $stmt = $pdo->prepare("DELETE FROM jadual_lantikan_pengesahan WHERE kejohanan_id = ?");
            $stmt->execute([$kejohananId]);
            jsonResponse(['error' => false, 'message' => 'Pengesahan dibatalkan.']);
        }

        jsonResponse(['error' => true, 'message' => 'Tindakan tidak dikenali.'], 400);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

} catch (PDOException $e) {
    error_log('jadual-lantikan-report.php error: ' . $e->getMessage());
    jsonResponse(['error' => true, 'message' => 'Ralat pangkalan data.'], 500);
}
