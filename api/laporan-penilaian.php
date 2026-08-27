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
 * PUT  action=hantar                         - submit to tournament chair
 * PUT  action=sahkan                         - audited Admin override
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/kriteria-penilaian.php';
require_once __DIR__ . '/../config/penilaian-helper.php';
require_once __DIR__ . '/../config/laporan-pengesahan.php';

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

function attachPengesahanPengerusi(PDO $pdo, array &$report, bool $includeAdminAudit = false): void
{
    $stmt = $pdo->prepare("
        SELECT status AS pengesahan_status, pengesah_nama, pengesah_jawatan,
               pengesah_negeri, email_sent_at, telegram_sent_at,
               CASE WHEN NULLIF(TRIM(email_recipient), '') IS NULL THEN 0 ELSE 1 END AS email_applicable,
               CASE WHEN telegram_chat_id IS NULL THEN 0 ELSE 1 END AS telegram_applicable,
               catatan_pengerusi, tarikh_sahkan AS tarikh_sahkan_pengerusi,
               alasan_override, admin_override_user_id, approval_token, id AS pengesahan_id
        FROM laporan_pengesahan_pengerusi
        WHERE laporan_id = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => (int) $report['id']]);
    $approval = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($approval && $includeAdminAudit) {
        $token = trim((string) ($approval['approval_token'] ?? ''));
        $approval['approval_url'] = $token !== '' && $approval['pengesahan_status'] === 'Menunggu'
            ? buildPengerusiApprovalUrl($token)
            : null;
        $auditStmt = $pdo->prepare("
            SELECT id, event_type, channel, event_status, actor_type,
                   actor_user_id, actor_luar_id, link_url, details_json, created_at
            FROM laporan_pengesahan_audit
            WHERE laporan_id = :id
            ORDER BY id DESC
            LIMIT 100
        ");
        $auditStmt->execute([':id' => (int) $report['id']]);
        $approval['audit'] = $auditStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($approval['audit'] as &$event) {
            $event['details'] = json_decode((string) ($event['details_json'] ?? ''), true) ?: [];
            unset($event['details_json']);
        }
        unset($event);
    }
    if ($approval) {
        unset($approval['approval_token']);
    }
    $report['pengesahan'] = $approval ?: null;
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
                attachPengesahanPengerusi($pdo, $r, $isAdmin);
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
            attachPengesahanPengerusi($pdo, $row, $isAdmin);
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
                attachPengesahanPengerusi($pdo, $r, $isAdmin);
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
                attachPengesahanPengerusi($pdo, $r, true);
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

    /* ── PUT: hantar / Admin override / notification tools ── */
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
            $delivery = null;
            try {
                $delivery = dispatchLaporanForPengerusi($pdo, $id);
            } catch (Throwable $notificationError) {
                error_log('[laporan-penilaian.php] Chair dispatch error: ' . $notificationError->getMessage());
            }
            $message = $delivery && $delivery['configured']
                ? 'Laporan berjaya dihantar kepada Pengerusi Pengadil. Admin menerima salinan.'
                : 'Laporan berjaya dihantar. Admin menerima salinan; penghantaran kepada Pengerusi Pengadil sedang menunggu tindakan pentadbir.';
            jsonResponse(['error' => false, 'message' => $message, 'pengesahan' => $delivery]);
        }

        if ($action === 'log_pengerusi_link_copy' && $isAdmin) {
            $state = ensureLaporanPengesahanState($pdo, $id);
            $token = trim((string) ($state['approval_token'] ?? ''));
            if ($state['status'] !== 'Menunggu' || $token === '') {
                jsonResponse(['error' => true, 'message' => 'Pautan Pengerusi tidak lagi aktif.'], 409);
            }
            $url = buildPengerusiApprovalUrl($token);
            recordLaporanPengesahanAudit(
                $pdo,
                (int) $state['id'],
                $id,
                'direct_link_copied',
                'admin',
                'success',
                'admin',
                $currentUserId,
                null,
                $url,
                ['purpose' => 'chair_report_confirmation']
            );
            jsonResponse(['error' => false, 'message' => 'Salinan pautan direkodkan.']);
        }

        if ($action === 'retry_pengerusi_notification' && $isAdmin) {
            $delivery = dispatchLaporanForPengerusi($pdo, $id);
            $delivered = $delivery['email_sent'] || $delivery['telegram_sent'];
            jsonResponse([
                'error' => false,
                'message' => $delivered
                    ? 'Percubaan penghantaran kepada Pengerusi selesai. Sekurang-kurangnya satu saluran berjaya.'
                    : 'Percubaan direkodkan tetapi tiada saluran berjaya. Gunakan pautan terus jika perlu.',
                'pengesahan' => $delivery,
            ]);
        }

        if ($action === 'sahkan' && $isAdmin) {
            try {
                overrideLaporanByAdmin(
                    $pdo,
                    $id,
                    $currentUserId,
                    trim((string) ($input['override_reason'] ?? '')),
                    trim((string) ($input['catatan_admin'] ?? ''))
                );
            } catch (InvalidArgumentException $e) {
                jsonResponse(['error' => true, 'message' => $e->getMessage()], 400);
            } catch (DomainException $e) {
                jsonResponse(['error' => true, 'message' => $e->getMessage()], 409);
            }
            jsonResponse(['error' => false, 'message' => 'Override Admin direkodkan dan laporan disahkan.']);
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
