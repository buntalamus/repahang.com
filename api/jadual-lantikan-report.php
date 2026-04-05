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

        // 1. Kejohanan info
        $stmt = $pdo->prepare("SELECT id, nama, tarikh_mula, tarikh_akhir, tempat, anjuran, logo_kiri, logo_kanan, status FROM kejohanan WHERE id = ?");
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
            ORDER BY tarikh ASC, masa ASC, no_perlawanan ASC
        ");
        $stmt->execute([$kejohananId]);
        $jadualList = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 4. All assignments for this kejohanan
        $stmt = $pdo->prepare("
            SELECT lp.jadual_id, lp.jawatan, lp.status AS status_lantikan,
                   COALESCE(p.nama_penuh, pl.nama) AS nama_penuh,
                   COALESCE(p.jenis_pengadil, pl.jenis_pengadil) AS jenis_pengadil,
                   COALESCE(p.negeri, pl.negeri) AS negeri,
                   COALESCE(p.no_telefon, pl.no_tel) AS no_telefon,
                   CASE WHEN lp.pengadil_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber,
                   lp.notif_hantar
            FROM lantikan_pengadil lp
            LEFT JOIN users p ON lp.pengadil_id = p.id
            LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
            JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
            WHERE jp.kejohanan_id = ?
        ");
        $stmt->execute([$kejohananId]);
        $allAssignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Group assignments by jadual_id → jawatan
        $assignmentMap = [];
        $totalLantikan = 0;
        $totalTerima = 0;
        foreach ($allAssignments as $a) {
            $assignmentMap[(int)$a['jadual_id']][$a['jawatan']] = $a;
            $totalLantikan++;
            if ($a['status_lantikan'] === 'Diterima') $totalTerima++;
        }

        // Attach assignments to each jadual + compute completeness
        $lengkap = 0;
        $separa = 0;
        $tiada = 0;
        foreach ($jadualList as &$j) {
            $j['assignments'] = [];
            $jCount = 0;
            foreach ($JAWATAN_LIST as $jaw) {
                $a = $assignmentMap[(int)$j['id']][$jaw] ?? null;
                $j['assignments'][$jaw] = $a;
                if ($a) $jCount++;
            }
            $j['jumlah_lantikan'] = $jCount;
            $j['is_lengkap'] = ($jCount === count($JAWATAN_LIST));
            if ($jCount === count($JAWATAN_LIST)) $lengkap++;
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
