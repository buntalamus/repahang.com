<?php
/**
 * Laporan Penilaian API — v2 (per-official evaluations)
 *
 * GET  ?officials=<jadual_id>                - officials for a match (form builder)
 * GET  ?penilai=1                            - my reports list
 * GET  ?id=X                                 - single report + pegawai detail
 * GET  ?jadual_id=X                          - reports for a match
 * GET  (no params, admin)                    - all reports list
 * POST                                       - create / update draft (parent + pegawai[])
 * PUT  action=hantar                         - submit to admin
 * PUT  action=sahkan                         - admin confirm
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/kriteria-penilaian.php';
require_once __DIR__ . '/../config/penilaian-helper.php';

$currentUser = requireRole(['Admin', 'Penilai', 'PP Daerah']);
$isAdmin = ($currentUser['user_role'] ?? $currentUser['role'] ?? '') === 'Admin';
$currentUserId = (int) $currentUser['id'];

/* ────────────── helpers ────────────── */

function fetchPegawaiForLaporan(PDO $pdo, int $laporanId): array {
    $stmt = $pdo->prepare("
        SELECT lpp.*, lp.pengadil_id
        FROM laporan_penilaian_pegawai lpp
        LEFT JOIN lantikan_pengadil lp ON lpp.lantikan_pengadil_id = lp.id
        WHERE lpp.laporan_id = :lid
        ORDER BY FIELD(lpp.jawatan,'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')
    ");
    $stmt->execute([':lid' => $laporanId]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        foreach (['kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan','fizikal_kelemahan','kerjasama_kekuatan','kerjasama_kelemahan'] as $col) {
            if (isset($r[$col]) && is_string($r[$col])) {
                $r[$col] = json_decode($r[$col], true) ?: [];
            }
        }
    }
    return $rows;
}

function savePegawai(PDO $pdo, int $laporanId, array $pegawaiList): void {
    // Delete old children, reinsert
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

/* ────────────── main ────────────── */

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    /* ── GET ── */
    if ($method === 'GET') {

        // Officials for a match (populates form)
        if (isset($_GET['officials'])) {
            $jadualId = (int) $_GET['officials'];
            if (!$isAdmin && !userHasAcceptedRaForMatch($pdo, $currentUserId, $jadualId)) {
                jsonResponse(['error' => true, 'message' => 'Anda bukan RA yang diterima untuk perlawanan ini.'], 403);
            }

            $officials = getAcceptedKupForAssessment($pdo, $jadualId);

            // Attach criteria sections per jawatan
            foreach ($officials as &$o) {
                $o['lantikan_id'] = $o['lantikan_pengadil_id'];
                $o['sections'] = getSectionsForJawatan($o['jawatan']);
            }

            jsonResponse(['error' => false, 'data' => $officials]);
        }

        // Kriteria dropdown data
        if (isset($_GET['kriteria'])) {
            jsonResponse(['error' => false, 'data' => getKriteriaPenilaian()]);
        }

        // Penilai: my reports
        if (isset($_GET['penilai'])) {
            $uid = (int) $currentUser['id'];
            $stmt = $pdo->prepare("
                SELECT lp.id, lp.jadual_id, lp.lantikan_id, lp.tahap_kesukaran, lp.ulasan_keseluruhan,
                       lp.status, lp.tarikh_hantar, lp.catatan_admin, lp.created_at,
                       jp.no_perlawanan, jp.tarikh, jp.masa, jp.pasukan_home, jp.pasukan_away, jp.tempat,
                       k.nama AS nama_kejohanan
                FROM laporan_penilaian lp
                JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                JOIN kejohanan k ON jp.kejohanan_id = k.id
                WHERE lp.penilai_id = :uid
                ORDER BY jp.tarikh DESC
            ");
            $stmt->execute([':uid' => $uid]);
            $reports = $stmt->fetchAll();

            // Attach pegawai summary to each report
            foreach ($reports as &$r) {
                $r['pegawai'] = fetchPegawaiForLaporan($pdo, (int)$r['id']);
            }

            jsonResponse(['error' => false, 'data' => $reports]);
        }

        // Single report by ID
        if (isset($_GET['id'])) {
            $id = (int) $_GET['id'];
            $stmt = $pdo->prepare("
                SELECT lp.*, jp.no_perlawanan, jp.tarikh, jp.masa, jp.pasukan_home, jp.pasukan_away, jp.tempat,
                    k.nama AS nama_kejohanan, k.id AS kejohanan_id,
                    COALESCE(u_penilai.nama_penuh, pl_penilai.nama) AS nama_penilai
                FROM laporan_penilaian lp
                JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                JOIN kejohanan k ON jp.kejohanan_id = k.id
                LEFT JOIN users u_penilai ON lp.penilai_id = u_penilai.id
                LEFT JOIN lantikan_pengadil lp2 ON lp.lantikan_id = lp2.id
                LEFT JOIN pengadil_luar pl_penilai ON lp2.pengadil_luar_id = pl_penilai.id
                WHERE lp.id = :id
                  AND (:is_admin = 1 OR lp.penilai_id = :uid)
            ");
            $stmt->execute([
                ':id' => $id,
                ':is_admin' => $isAdmin ? 1 : 0,
                ':uid' => $currentUserId,
            ]);
            $row = $stmt->fetch();
            if (!$row) {
                jsonResponse(['error' => true, 'message' => 'Laporan tidak dijumpai.'], 404);
            }
            $row['pegawai'] = fetchPegawaiForLaporan($pdo, (int)$row['id']);
            jsonResponse(['error' => false, 'laporan' => $row]);
        }

        // Reports for a match
        if (isset($_GET['jadual_id'])) {
            $jadualId = (int) $_GET['jadual_id'];
            $stmt = $pdo->prepare("
                SELECT lp.id, lp.jadual_id, lp.status, lp.tahap_kesukaran, lp.ulasan_keseluruhan,
                       lp.tarikh_hantar, lp.catatan_admin,
                       COALESCE(u_penilai.nama_penuh, pl_penilai.nama) AS nama_penilai
                FROM laporan_penilaian lp
                LEFT JOIN users u_penilai ON lp.penilai_id = u_penilai.id
                LEFT JOIN lantikan_pengadil lp2 ON lp.lantikan_id = lp2.id
                LEFT JOIN pengadil_luar pl_penilai ON lp2.pengadil_luar_id = pl_penilai.id
                WHERE lp.jadual_id = :jid
                  AND (:is_admin = 1 OR lp.penilai_id = :uid)
                ORDER BY lp.created_at ASC
            ");
            $stmt->execute([
                ':jid' => $jadualId,
                ':is_admin' => $isAdmin ? 1 : 0,
                ':uid' => $currentUserId,
            ]);
            $reports = $stmt->fetchAll();
            foreach ($reports as &$r) {
                $r['pegawai'] = fetchPegawaiForLaporan($pdo, (int)$r['id']);
            }
            jsonResponse(['error' => false, 'data' => $reports]);
        }

        // Admin: list all reports
        if ($isAdmin) {
            $status = $_GET['status'] ?? '';
            $sql = "
                SELECT lp.id, lp.jadual_id, lp.status, lp.tahap_kesukaran, lp.tarikh_hantar,
                    jp.no_perlawanan, jp.tarikh, jp.pasukan_home, jp.pasukan_away,
                    k.id AS kejohanan_id, k.nama AS nama_kejohanan,
                    COALESCE(u_penilai.nama_penuh, pl_penilai.nama) AS nama_penilai
                FROM laporan_penilaian lp
                JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                JOIN kejohanan k ON jp.kejohanan_id = k.id
                LEFT JOIN users u_penilai ON lp.penilai_id = u_penilai.id
                LEFT JOIN lantikan_pengadil lp2 ON lp.lantikan_id = lp2.id
                LEFT JOIN pengadil_luar pl_penilai ON lp2.pengadil_luar_id = pl_penilai.id
            ";
            $params = [];
            if ($status) {
                $sql .= " WHERE lp.status = :status";
                $params[':status'] = $status;
            }
            $sql .= " ORDER BY jp.tarikh DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $reports = $stmt->fetchAll();
            foreach ($reports as &$r) {
                $r['pegawai'] = fetchPegawaiForLaporan($pdo, (int)$r['id']);
            }
            jsonResponse(['error' => false, 'data' => $reports]);
        }

        jsonResponse(['error' => true, 'message' => 'Parameter tidak sah.'], 400);
    }

    /* ── POST: create / update draft ── */
    if ($method === 'POST') {
        $input = getJsonInput();
        $jadual_id   = (int) ($input['jadual_id'] ?? 0);
        $lantikan_id = (int) ($input['lantikan_id'] ?? 0);
        $pegawaiInput = $input['pegawai'] ?? [];

        if (!$jadual_id || !$lantikan_id) {
            jsonResponse(['error' => true, 'message' => 'jadual_id dan lantikan_id diperlukan.'], 400);
        }
        if (empty($pegawaiInput) || !is_array($pegawaiInput)) {
            jsonResponse(['error' => true, 'message' => 'Senarai pegawai diperlukan.'], 400);
        }

        if ($isAdmin || !userOwnsAcceptedRaAppointment($pdo, $currentUserId, $lantikan_id, $jadual_id)) {
            jsonResponse(['error' => true, 'message' => 'Lantikan RA tidak sah atau bukan milik anda.'], 403);
        }

        try {
            $pegawai = normalizeSubmittedKupAssessments($pdo, $jadual_id, $pegawaiInput);
        } catch (InvalidArgumentException $validationError) {
            jsonResponse(['error' => true, 'message' => $validationError->getMessage()], 400);
        }

        $penilai_id = $currentUserId;

        $parentFields = [
            'tahap_kesukaran'    => $input['tahap_kesukaran'] ?? 'Normal',
            'cuaca'              => !empty($input['cuaca']) ? $input['cuaca'] : null,
            'ulasan_keseluruhan' => $input['ulasan_keseluruhan'] ?? '',
            'status'             => 'Draf',
        ];

        // Score fields
        foreach (['skor_ht_home','skor_ht_away','skor_ft_home','skor_ft_away','skor_et_home','skor_et_away','skor_ps_home','skor_ps_away'] as $sf) {
            $parentFields[$sf] = isset($input[$sf]) && $input[$sf] !== '' && $input[$sf] !== null ? (int)$input[$sf] : null;
        }

        $pdo->beginTransaction();

        // Serialize both session and token report writers on the one RA
        // appointment. This prevents duplicate reports and edits racing a
        // submission or admin confirmation.
        $lockStmt = $pdo->prepare("
            SELECT id
            FROM lantikan_pengadil
            WHERE id = :lid
            FOR UPDATE
        ");
        $lockStmt->execute([':lid' => $lantikan_id]);
        if (!$lockStmt->fetchColumn()) {
            $pdo->rollBack();
            jsonResponse(['error' => true, 'message' => 'Lantikan RA tidak dijumpai.'], 404);
        }

        $checkStmt = $pdo->prepare("
            SELECT id, status
            FROM laporan_penilaian
            WHERE lantikan_id = :lid AND penilai_id = :pid
            LIMIT 1 FOR UPDATE
        ");
        $checkStmt->execute([':lid' => $lantikan_id, ':pid' => $penilai_id]);
        $existing = $checkStmt->fetch();

        if ($existing && $existing['status'] !== 'Draf') {
            $pdo->rollBack();
            jsonResponse(['error' => true, 'message' => 'Laporan yang telah dihantar tidak boleh diedit semula.'], 409);
        }

        if ($existing) {
            $laporanId = (int) $existing['id'];
            $setParts = array_map(fn($k) => "$k = :$k", array_keys($parentFields));
            $sql = "UPDATE laporan_penilaian SET " . implode(', ', $setParts) . " WHERE id = :id";
            $params = $parentFields;
            $params[':id'] = $laporanId;
            $pdo->prepare($sql)->execute($params);
        } else {
            $cols = array_keys($parentFields);
            $sql = "INSERT INTO laporan_penilaian (jadual_id, lantikan_id, penilai_id, " . implode(', ', $cols) . ")
                    VALUES (:jadual_id, :lantikan_id, :penilai_id, " . implode(', ', array_map(fn($k) => ":$k", $cols)) . ")";
            $params = $parentFields;
            $params[':jadual_id']   = $jadual_id;
            $params[':lantikan_id'] = $lantikan_id;
            $params[':penilai_id']  = $penilai_id;
            $pdo->prepare($sql)->execute($params);
            $laporanId = (int) $pdo->lastInsertId();
        }

        // Save per-official evaluations
        savePegawai($pdo, $laporanId, $pegawai);

        $pdo->commit();
        jsonResponse(['error' => false, 'message' => 'Draf laporan disimpan.', 'id' => $laporanId]);
    }

    /* ── PUT: hantar / sahkan ── */
    if ($method === 'PUT') {
        $input = getJsonInput();
        $action = $input['action'] ?? '';
        $id = (int) ($input['id'] ?? 0);

        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }

        if ($action === 'hantar') {
            $pdo->beginTransaction();
            try {
                $ownerStmt = $pdo->prepare("
                    SELECT lantikan_id
                    FROM laporan_penilaian
                    WHERE id = :id AND penilai_id = :pid AND status = 'Draf'
                    FOR UPDATE
                ");
                $ownerStmt->execute([':id' => $id, ':pid' => $currentUserId]);
                if (!$ownerStmt->fetchColumn()) {
                    $pdo->rollBack();
                    jsonResponse(['error' => true, 'message' => 'Laporan bukan milik anda atau bukan lagi berstatus Draf.'], 409);
                }

                // Validate the exact child snapshot while the parent report is
                // locked, then make submission immutable in the same unit.
                $pegawai = fetchPegawaiForLaporan($pdo, $id);
                if ($pegawai === []) {
                    $pdo->rollBack();
                    jsonResponse(['error' => true, 'message' => 'Senarai penilaian KUP masih kosong.'], 400);
                }
                foreach ($pegawai as $p) {
                    if ($p['markah'] === null || $p['markah'] === '') {
                        $pdo->rollBack();
                        jsonResponse(['error' => true, 'message' => 'Markah untuk semua pegawai perlu diisi sebelum menghantar.'], 400);
                    }
                }

                $pdo->prepare("
                    UPDATE laporan_penilaian
                    SET status = 'Dihantar', tarikh_hantar = NOW()
                    WHERE id = :id AND penilai_id = :pid AND status = 'Draf'
                ")->execute([':id' => $id, ':pid' => $currentUserId]);
                $pdo->commit();
            } catch (Throwable $submissionError) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $submissionError;
            }
            jsonResponse(['error' => false, 'message' => 'Laporan berjaya dihantar kepada admin.']);
        }

        if ($action === 'sahkan' && $isAdmin) {
            $catatan = trim($input['catatan_admin'] ?? '');
            $pdo->beginTransaction();
            try {
                $rowStmt = $pdo->prepare("
                    SELECT laporan.jadual_id, laporan.lantikan_id, ra.penilaian_token
                    FROM laporan_penilaian laporan
                    JOIN lantikan_pengadil ra ON ra.id = laporan.lantikan_id
                    WHERE laporan.id = :id
                      AND laporan.status = 'Dihantar'
                      AND ra.jawatan = 'Penilai Pengadil'
                      AND ra.status = 'Diterima'
                    FOR UPDATE
                ");
                $rowStmt->execute([':id' => $id]);
                $row = $rowStmt->fetch();
                if (!$row) {
                    $pdo->rollBack();
                    jsonResponse(['error' => true, 'message' => 'Laporan tidak dijumpai atau belum berstatus Dihantar.'], 409);
                }

                if (trim((string) ($row['penilaian_token'] ?? '')) === '') {
                    $row['penilaian_token'] = bin2hex(random_bytes(32));
                    $pdo->prepare("
                        UPDATE lantikan_pengadil
                        SET penilaian_token = :token
                        WHERE id = :id AND status = 'Diterima'
                    ")->execute([
                        ':token' => $row['penilaian_token'],
                        ':id' => $row['lantikan_id'],
                    ]);
                }

                $pdo->prepare("
                    UPDATE laporan_penilaian
                    SET status = 'Disahkan', catatan_admin = :catatan, tarikh_sahkan = NOW()
                    WHERE id = :id AND status = 'Dihantar'
                ")->execute([':catatan' => $catatan, ':id' => $id]);
                $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Selesai' WHERE id = :jid")
                    ->execute([':jid' => $row['jadual_id']]);
                $pdo->commit();
            } catch (Throwable $confirmationError) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $confirmationError;
            }

            // Send notifications to each official
            try {
                require_once __DIR__ . '/../config/email.php';
                require_once __DIR__ . '/../config/telegram.php';
                require_once __DIR__ . '/../config/env.php';

                $baseUrl = env('BASE_URL', 'https://refpahang.com');
                $reportStmt = $pdo->prepare("
                    SELECT lp.*, jp.no_perlawanan, jp.tarikh, jp.masa, jp.pasukan_home, jp.pasukan_away,
                           k.nama AS nama_kejohanan,
                           COALESCE(u_pen.nama_penuh, pl_pen.nama) AS nama_penilai,
                           lp3.penilaian_token
                    FROM laporan_penilaian lp
                    JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                    JOIN kejohanan k ON jp.kejohanan_id = k.id
                    LEFT JOIN users u_pen ON lp.penilai_id = u_pen.id
                    LEFT JOIN lantikan_pengadil lp3 ON lp.lantikan_id = lp3.id
                    LEFT JOIN pengadil_luar pl_pen ON lp3.pengadil_luar_id = pl_pen.id
                    WHERE lp.id = :id
                ");
                $reportStmt->execute([':id' => $id]);
                $report = $reportStmt->fetch();
                $reportViewToken = createReportViewToken(
                    $id,
                    (string) ($report['penilaian_token'] ?? '')
                );
                $reportUrl = $baseUrl . '/api/download-laporan-penilaian.php?id=' . $id
                    . '&view_token=' . urlencode($reportViewToken);

                $pegawaiList = fetchPegawaiForLaporan($pdo, $id);
                $pasukan = ($report['pasukan_home'] ?? '') . ' vs ' . ($report['pasukan_away'] ?? '');

                foreach ($pegawaiList as $pg) {
                    // Get official's email and telegram chat_id
                    $lpStmt = $pdo->prepare("
                        SELECT lp.pengadil_id, lp.pengadil_luar_id,
                               u.email, u.nama_penuh, u.telegram_chat_id,
                               pl.emel AS pl_email, pl.nama AS pl_nama,
                               pl.telegram_chat_id AS pl_telegram_chat_id
                        FROM lantikan_pengadil lp
                        LEFT JOIN users u ON lp.pengadil_id = u.id
                        LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
                        WHERE lp.id = :lpid
                    ");
                    $lpStmt->execute([':lpid' => $pg['lantikan_pengadil_id']]);
                    $official = $lpStmt->fetch();
                    if (!$official) continue;

                    $email = $official['email'] ?: $official['pl_email'];
                    $nama  = $official['nama_penuh'] ?: $official['pl_nama'];

                    // Merge all kekuatan/kelemahan from sections
                    $allKekuatan = array_merge($pg['kawalan_kekuatan'] ?? [], $pg['fizikal_kekuatan'] ?? [], $pg['kerjasama_kekuatan'] ?? []);
                    $allKelemahan = array_merge($pg['kawalan_kelemahan'] ?? [], $pg['fizikal_kelemahan'] ?? [], $pg['kerjasama_kelemahan'] ?? []);
                    $allNasihat = implode("\n", array_filter([
                        $pg['kawalan_nasihat'] ?? '', $pg['fizikal_nasihat'] ?? '', $pg['kerjasama_nasihat'] ?? ''
                    ]));

                    // Send email
                    if ($email) {
                        sendPenilaianEmail(
                            $email,
                            $nama ?: '-',
                            $pg['jawatan'],
                            $report['nama_kejohanan'] ?? '',
                            $report['tarikh'] ?? '',
                            $pasukan,
                            $report['nama_penilai'] ?? '-',
                            $pg['markah'] !== null ? (float)$pg['markah'] : null,
                            $pg['prestasi'],
                            $allKekuatan,
                            $allKelemahan,
                            $allNasihat,
                            $report['ulasan_keseluruhan'] ?? '',
                            $catatan,
                            $reportUrl
                        );
                    }

                    // Send Telegram
                    $chatId = $official['telegram_chat_id'] ?: ($official['pl_telegram_chat_id'] ?? null);
                    if ($chatId) {
                        $markahStr = $pg['markah'] !== null ? number_format((float)$pg['markah'], 1) : '-';
                        $tgMsg = "📋 <b>Laporan Penilaian</b>\n\n"
                               . "⚽ <b>{$pasukan}</b>\n"
                               . "🏆 {$report['nama_kejohanan']}\n"
                               . "📅 {$report['tarikh']}\n\n"
                               . "👤 Jawatan: <b>{$pg['jawatan']}</b>\n"
                               . "📊 Markah: <b>{$markahStr}</b>/10\n"
                               . ($pg['prestasi'] ? "⭐ Prestasi: {$pg['prestasi']}\n" : "")
                               . "\n🔍 Penilai: {$report['nama_penilai']}";

                        if (!empty($allKekuatan)) {
                            $tgMsg .= "\n\n✅ <b>Kekuatan:</b>\n• " . implode("\n• ", array_slice($allKekuatan, 0, 5));
                            if (count($allKekuatan) > 5) $tgMsg .= "\n  <i>+" . (count($allKekuatan) - 5) . " lagi</i>";
                        }
                        if (!empty($allKelemahan)) {
                            $tgMsg .= "\n\n⚠️ <b>Perlu Diperbaiki:</b>\n• " . implode("\n• ", array_slice($allKelemahan, 0, 5));
                            if (count($allKelemahan) > 5) $tgMsg .= "\n  <i>+" . (count($allKelemahan) - 5) . " lagi</i>";
                        }

                        $tgMsg .= "\n\n📋 <a href=\"{$reportUrl}\">Lihat Laporan Penuh</a>";

                        tgSend($chatId, $tgMsg);
                    }
                }
            } catch (Throwable $e) {
                error_log('[laporan-penilaian.php] Notification error: ' . $e->getMessage());
                // Don't fail the sahkan just because notification failed
            }

            jsonResponse(['error' => false, 'message' => 'Laporan disahkan.']);
        }

        jsonResponse(['error' => true, 'message' => 'Action tidak sah.'], 400);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('[laporan-penilaian.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
