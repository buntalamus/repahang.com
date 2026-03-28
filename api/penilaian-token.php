<?php
/**
 * Token-based Penilaian API for external RA (pengadil_luar)
 *
 * GET  ?token=TOKEN                 - get match + officials info for form
 * POST body { token, pegawai[], ... } - save/submit evaluation
 *
 * No login required — token from lantikan_pengadil.penilaian_token
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/kriteria-penilaian.php';

/* ── Reuse helper from laporan-penilaian.php ── */
function savePegawaiToken(PDO $pdo, int $laporanId, array $pegawaiList): void {
    $pdo->prepare("DELETE FROM laporan_penilaian_pegawai WHERE laporan_id = :lid")->execute([':lid' => $laporanId]);

    $ins = $pdo->prepare("
        INSERT INTO laporan_penilaian_pegawai
            (laporan_id, lantikan_pengadil_id, jawatan, nama_pengadil, markah, prestasi,
             kawalan_kekuatan, kawalan_kelemahan, kawalan_nasihat,
             fizikal_kekuatan, fizikal_kelemahan, fizikal_nasihat,
             kerjasama_kekuatan, kerjasama_kelemahan, kerjasama_nasihat)
        VALUES
            (:lid, :lpid, :jawatan, :nama, :markah, :prestasi,
             :kk, :kw, :kn, :fk, :fw, :fn, :sk, :sw, :sn)
    ");

    foreach ($pegawaiList as $p) {
        $ins->execute([
            ':lid'     => $laporanId,
            ':lpid'    => !empty($p['lantikan_pengadil_id']) ? (int)$p['lantikan_pengadil_id'] : null,
            ':jawatan' => $p['jawatan'] ?? '',
            ':nama'    => $p['nama_pengadil'] ?? '',
            ':markah'  => isset($p['markah']) && $p['markah'] !== '' ? (float)$p['markah'] : null,
            ':prestasi'=> !empty($p['prestasi']) ? $p['prestasi'] : null,
            ':kk'      => json_encode($p['kawalan_kekuatan'] ?? [], JSON_UNESCAPED_UNICODE),
            ':kw'      => json_encode($p['kawalan_kelemahan'] ?? [], JSON_UNESCAPED_UNICODE),
            ':kn'      => $p['kawalan_nasihat'] ?? '',
            ':fk'      => json_encode($p['fizikal_kekuatan'] ?? [], JSON_UNESCAPED_UNICODE),
            ':fw'      => json_encode($p['fizikal_kelemahan'] ?? [], JSON_UNESCAPED_UNICODE),
            ':fn'      => $p['fizikal_nasihat'] ?? '',
            ':sk'      => json_encode($p['kerjasama_kekuatan'] ?? [], JSON_UNESCAPED_UNICODE),
            ':sw'      => json_encode($p['kerjasama_kelemahan'] ?? [], JSON_UNESCAPED_UNICODE),
            ':sn'      => $p['kerjasama_nasihat'] ?? '',
        ]);
    }
}

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    /* ── Validate token ── */
    $token = $_GET['token'] ?? '';
    if ($method === 'POST') {
        $input = getJsonInput();
        $token = $input['token'] ?? '';
    }

    if (!$token || strlen($token) < 16) {
        jsonResponse(['error' => true, 'message' => 'Token tidak sah.'], 401);
    }

    // Find the penilai assignment from token
    $stmt = $pdo->prepare("
        SELECT lp.id AS lantikan_id, lp.jadual_id, lp.pengadil_id, lp.pengadil_luar_id, lp.jawatan,
               jp.no_perlawanan, jp.tarikh, jp.masa, jp.hari, jp.pasukan_home, jp.pasukan_away, jp.tempat,
               jp.kumpulan_tahap,
               k.nama AS nama_kejohanan, k.anjuran,
               CASE WHEN lp.pengadil_id IS NOT NULL THEN u.nama_penuh
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.nama
                    ELSE NULL END AS nama_penilai
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        JOIN kejohanan k ON jp.kejohanan_id = k.id
        LEFT JOIN users u ON lp.pengadil_id = u.id
        LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
        WHERE lp.penilaian_token = :token AND lp.jawatan = 'Penilai Pengadil'
    ");
    $stmt->execute([':token' => $token]);
    $penilai = $stmt->fetch();

    if (!$penilai) {
        jsonResponse(['error' => true, 'message' => 'Token tidak sah atau tamat tempoh.'], 401);
    }

    /* ── GET: return match + officials ── */
    if ($method === 'GET') {
        // Get officials for this match
        $offStmt = $pdo->prepare("
            SELECT lp.id AS lantikan_id, lp.jawatan,
                CASE WHEN lp.pengadil_id IS NOT NULL THEN u.nama_penuh
                     WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.nama
                     ELSE NULL END AS nama_pengadil
            FROM lantikan_pengadil lp
            LEFT JOIN users u ON lp.pengadil_id = u.id
            LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
            WHERE lp.jadual_id = :jid AND lp.jawatan != 'Penilai Pengadil' AND lp.status = 'Diterima'
            ORDER BY FIELD(lp.jawatan,'Pengadil Utama','Pembantu Pengadil 1','Pembantu Pengadil 2','Pengadil Keempat')
        ");
        $offStmt->execute([':jid' => $penilai['jadual_id']]);
        $officials = $offStmt->fetchAll();

        foreach ($officials as &$o) {
            $o['sections'] = getSectionsForJawatan($o['jawatan']);
        }

        // Check if report already exists
        $existStmt = $pdo->prepare("SELECT id, status, tahap_kesukaran, ulasan_keseluruhan FROM laporan_penilaian WHERE lantikan_id = :lid");
        $existStmt->execute([':lid' => $penilai['lantikan_id']]);
        $existing = $existStmt->fetch();

        $existingPegawai = [];
        if ($existing) {
            $pgStmt = $pdo->prepare("SELECT * FROM laporan_penilaian_pegawai WHERE laporan_id = :lid");
            $pgStmt->execute([':lid' => $existing['id']]);
            $existingPegawai = $pgStmt->fetchAll();
            foreach ($existingPegawai as &$ep) {
                foreach (['kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan','fizikal_kelemahan','kerjasama_kekuatan','kerjasama_kelemahan'] as $col) {
                    if (isset($ep[$col]) && is_string($ep[$col])) $ep[$col] = json_decode($ep[$col], true) ?: [];
                }
            }
        }

        jsonResponse([
            'error' => false,
            'match' => [
                'no_perlawanan' => $penilai['no_perlawanan'],
                'tarikh'        => $penilai['tarikh'],
                'masa'          => $penilai['masa'],
                'hari'          => $penilai['hari'],
                'pasukan_home'  => $penilai['pasukan_home'],
                'pasukan_away'  => $penilai['pasukan_away'],
                'tempat'        => $penilai['tempat'],
                'kejohanan'     => $penilai['nama_kejohanan'],
                'kumpulan_tahap'=> $penilai['kumpulan_tahap'],
            ],
            'penilai_nama'  => $penilai['nama_penilai'],
            'officials'     => $officials,
            'existing'      => $existing ? [
                'id'                  => $existing['id'],
                'status'              => $existing['status'],
                'tahap_kesukaran'     => $existing['tahap_kesukaran'],
                'ulasan_keseluruhan'  => $existing['ulasan_keseluruhan'],
                'pegawai'             => $existingPegawai,
            ] : null,
            'kriteria'      => getKriteriaPenilaian(),
        ]);
    }

    /* ── POST: save evaluation ── */
    if ($method === 'POST') {
        $pegawai = $input['pegawai'] ?? [];
        if (empty($pegawai) || !is_array($pegawai)) {
            jsonResponse(['error' => true, 'message' => 'Senarai pegawai diperlukan.'], 400);
        }

        $hantar = !empty($input['hantar']);

        // Validate markah if submitting
        if ($hantar) {
            foreach ($pegawai as $p) {
                if (empty($p['markah'])) {
                    jsonResponse(['error' => true, 'message' => 'Markah untuk semua pegawai perlu diisi.'], 400);
                }
            }
        }

        $pdo->beginTransaction();

        // Check existing
        $checkStmt = $pdo->prepare("SELECT id, status FROM laporan_penilaian WHERE lantikan_id = :lid");
        $checkStmt->execute([':lid' => $penilai['lantikan_id']]);
        $existing = $checkStmt->fetch();

        if ($existing && $existing['status'] === 'Disahkan') {
            $pdo->rollBack();
            jsonResponse(['error' => true, 'message' => 'Laporan sudah disahkan.'], 400);
        }

        $penilaiId = $penilai['pengadil_id'] ?: null;
        $tahap = $input['tahap_kesukaran'] ?? 'Normal';
        $ulasan = $input['ulasan_keseluruhan'] ?? '';
        $status = $hantar ? 'Dihantar' : 'Draf';

        if ($existing) {
            $laporanId = (int) $existing['id'];
            $pdo->prepare("UPDATE laporan_penilaian SET tahap_kesukaran = :tahap, ulasan_keseluruhan = :ulasan, status = :status" .
                ($hantar ? ", tarikh_hantar = NOW()" : "") . " WHERE id = :id")
                ->execute([':tahap' => $tahap, ':ulasan' => $ulasan, ':status' => $status, ':id' => $laporanId]);
        } else {
            $pdo->prepare("INSERT INTO laporan_penilaian (jadual_id, lantikan_id, penilai_id, tahap_kesukaran, ulasan_keseluruhan, status" .
                ($hantar ? ", tarikh_hantar" : "") . ") VALUES (:jid, :lid, :pid, :tahap, :ulasan, :status" .
                ($hantar ? ", NOW()" : "") . ")")
                ->execute([
                    ':jid' => $penilai['jadual_id'],
                    ':lid' => $penilai['lantikan_id'],
                    ':pid' => $penilaiId,
                    ':tahap' => $tahap,
                    ':ulasan' => $ulasan,
                    ':status' => $status,
                ]);
            $laporanId = (int) $pdo->lastInsertId();
        }

        savePegawaiToken($pdo, $laporanId, $pegawai);
        $pdo->commit();

        $msg = $hantar ? 'Laporan berjaya dihantar kepada admin.' : 'Draf disimpan.';
        jsonResponse(['error' => false, 'message' => $msg, 'id' => $laporanId]);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('[penilaian-token.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
