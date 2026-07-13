<?php
/**
 * Lantikan Pengadil API (Admin)
 * GET    /api/lantikan.php?jadual_id=X   - get assignments for a match
 * POST   /api/lantikan.php               - assign referee (or batch)
 * PUT    /api/lantikan.php               - update assignment (change referee)
 * DELETE /api/lantikan.php?id=X          - remove assignment
 * POST   /api/lantikan.php action=notify - send notification
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/lantikan-helper.php';

$currentUser = requireRole(['Admin']);

$VALID_JAWATAN = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4', 'Penilai Pengadil'];

/**
 * Cancel all assignments for given jadual IDs, sending cancellation notifications.
 */
function batalLantikanByJadual(PDO $pdo, array $jadualIds): array
{
    if (empty($jadualIds)) return ['message' => 'Tiada perlawanan.'];

    $placeholders = implode(',', array_fill(0, count($jadualIds), '?'));

    // Fetch all assignments with details before deleting
    $stmt = $pdo->prepare("
        SELECT lp.id, lp.jawatan, lp.notif_hantar, lp.jadual_id,
               COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
               COALESCE(u.nama_penuh, pl.nama)  AS nama,
               COALESCE(u.email, pl.emel)        AS email,
               lp.pengadil_id,
               jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
               jp.pasukan_home, jp.pasukan_away,
               jp.logo_home, jp.logo_away,
               COALESCE(kj.nama, '') AS kejohanan
        FROM lantikan_pengadil lp
        JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
        LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
        LEFT JOIN users u ON lp.pengadil_id = u.id
        LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
        WHERE lp.jadual_id IN ({$placeholders})
    ");
    $stmt->execute($jadualIds);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($records)) return ['message' => 'Tiada lantikan untuk dibatalkan.'];

    require_once __DIR__ . '/../config/telegram.php';
    require_once __DIR__ . '/../config/email.php';

    $notifCount = 0;
    foreach ($records as $r) {
        if (!empty($r['notif_hantar'])) {
            // Telegram cancellation
            if (!empty($r['telegram_chat_id'])) {
                $msg = tgBatalMessage(
                    $r['nama'], $r['jawatan'], $r['kejohanan'],
                    $r['tarikh'], $r['masa'] ?? '', $r['tempat'] ?? '',
                    $r['pasukan_home'], $r['pasukan_away'],
                    $r['no_perlawanan'] ?? ''
                );
                tgSend((int) $r['telegram_chat_id'], $msg);
            }
            // Email cancellation
            if (!empty($r['email'])) {
                sendBatalEmail(
                    $r['email'], $r['nama'], $r['jawatan'], $r['kejohanan'],
                    $r['tarikh'], $r['masa'] ?? '', $r['tempat'] ?? '',
                    $r['pasukan_home'], $r['pasukan_away'],
                    $r['no_perlawanan'] ?? '',
                    $r['logo_home'] ?? '', $r['logo_away'] ?? '',
                    !empty($r['pengadil_id'])
                );
            }
            $notifCount++;
        }
    }

    // Delete all assignments
    $pdo->prepare("DELETE FROM lantikan_pengadil WHERE jadual_id IN ({$placeholders})")
        ->execute($jadualIds);

    // Reset jadual status
    $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Belum Lantik' WHERE id IN ({$placeholders})")
        ->execute($jadualIds);

    $matchCount = count($jadualIds);
    $totalDeleted = count($records);
    $msg = "{$totalDeleted} lantikan dibatalkan untuk {$matchCount} perlawanan.";
    if ($notifCount > 0) $msg .= " {$notifCount} notifikasi pembatalan dihantar.";

    return ['message' => $msg];
}

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $jadual_id = (int) ($_GET['jadual_id'] ?? 0);
        if (!$jadual_id) {
            jsonResponse(['error' => true, 'message' => 'jadual_id diperlukan.'], 400);
        }

        // Auto-tolak lantikan yang tempoh jawapannya sudah tamat
        autoTolakLantikanTertunggak($pdo, ['jadual_id' => $jadual_id]);

        $stmt = $pdo->prepare("
            SELECT lp.id, lp.jawatan, lp.status, lp.komen, lp.tarikh_jawab, lp.notif_hantar, lp.tg_notif_hantar, lp.tarikh_notif, lp.created_at,
                lp.pengadil_id, lp.pengadil_luar_id,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN u.nama_penuh
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.nama
                END AS nama_penuh,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN u.no_telefon
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.no_tel
                END AS no_telefon,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN u.email
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.emel
                END AS email,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN u.jenis_pengadil
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN pl.jenis_pengadil
                END AS jenis_pengadil,
                CASE
                    WHEN lp.pengadil_id IS NOT NULL THEN 'Berdaftar'
                    WHEN lp.pengadil_luar_id IS NOT NULL THEN 'Luar'
                END AS jenis_sumber
            FROM lantikan_pengadil lp
            LEFT JOIN users u ON lp.pengadil_id = u.id
            LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
            WHERE lp.jadual_id = :jadual_id
            ORDER BY FIELD(lp.jawatan,'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4','Penilai Pengadil')
        ");
        $stmt->execute([':jadual_id' => $jadual_id]);
        $assignments = $stmt->fetchAll();

        // Get pool-based referees for this kejohanan
        // First get kejohanan_id from jadual
        $kjStmt = $pdo->prepare("SELECT kejohanan_id FROM jadual_perlawanan WHERE id = :jid");
        $kjStmt->execute([':jid' => $jadual_id]);
        $kjRow = $kjStmt->fetch();
        $kejohanan_id = $kjRow ? (int) $kjRow['kejohanan_id'] : 0;

        $referees = [];
        if ($kejohanan_id) {
            $refStmt = $pdo->prepare("
                SELECT
                    pp.id AS pool_id,
                    pp.pengadil_id,
                    pp.pengadil_luar_id,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.nama_penuh
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.nama
                    END AS nama_penuh,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.no_telefon
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.no_tel
                    END AS no_telefon,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.email
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.emel
                    END AS email,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN u.jenis_pengadil
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.jenis_pengadil
                    END AS jenis_pengadil,
                    CASE
                        WHEN pp.pengadil_id IS NOT NULL THEN 'Berdaftar'
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN 'Luar'
                    END AS jenis_sumber,
                    CASE
                        WHEN pp.pengadil_luar_id IS NOT NULL THEN pl.negeri
                        ELSE 'Pahang'
                    END AS negeri,
                    (
                        SELECT COUNT(*) FROM lantikan_pengadil lp2
                        JOIN jadual_perlawanan jp2 ON lp2.jadual_id = jp2.id
                        WHERE jp2.kejohanan_id = pp.kejohanan_id
                          AND (lp2.pengadil_id = pp.pengadil_id OR lp2.pengadil_luar_id = pp.pengadil_luar_id)
                    ) AS jumlah_lantikan_kejohanan
                FROM pool_pengadil pp
                LEFT JOIN users u ON pp.pengadil_id = u.id
                LEFT JOIN pengadil_luar pl ON pp.pengadil_luar_id = pl.id
                WHERE pp.kejohanan_id = :kid
                ORDER BY nama_penuh ASC
            ");
            $refStmt->execute([':kid' => $kejohanan_id]);
            $referees = $refStmt->fetchAll();
        }

        jsonResponse(['error' => false, 'data' => $assignments, 'referees' => $referees]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $action = $input['action'] ?? 'assign';

        if ($action === 'notify') {
            $jadual_id = (int) ($input['jadual_id'] ?? 0);
            if (!$jadual_id) {
                jsonResponse(['error' => true, 'message' => 'jadual_id diperlukan.'], 400);
            }

            // Auto-tolak dulu — baris yang sudah tamat tempoh tidak boleh
            // "dihidupkan semula" oleh hantar semula
            autoTolakLantikanTertunggak($pdo, ['jadual_id' => $jadual_id]);

            // Check if any assignment already notified (re-send: window restarts)
            $alreadyNotifiedStmt = $pdo->prepare("
                SELECT COUNT(*) FROM lantikan_pengadil
                WHERE jadual_id = :jid AND notif_hantar = 1 AND status = 'Belum Jawab'
            ");
            $alreadyNotifiedStmt->execute([':jid' => $jadual_id]);
            $renotifyCount = (int) $alreadyNotifiedStmt->fetchColumn();

            // Fetch match details + all pending assignments
            $stmt = $pdo->prepare("
                SELECT lp.id AS lantikan_id,
                       lp.jawatan, lp.tg_notif_hantar,
                       lp.tg_token, lp.email_token,
                       COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
                       COALESCE(u.tg_link_token,    pl.tg_link_token)    AS tg_link_token,
                       COALESCE(u.id, NULL)          AS user_id,
                       COALESCE(pl.id, NULL)         AS luar_id,
                       COALESCE(u.nama_penuh, pl.nama) AS nama,
                       COALESCE(u.email, pl.emel)    AS email,
                       lp.pengadil_id,
                       u.persatuan_id,
                       jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
                       jp.pasukan_home, jp.pasukan_away, jp.kejohanan_id,
                       jp.logo_home, jp.logo_away,
                       COALESCE(kj.nama, '') AS kejohanan,
                       COALESCE(kj.jenis_kejohanan, 'Persahabatan') AS jenis_kejohanan
                FROM lantikan_pengadil lp
                JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
                LEFT JOIN users u ON lp.pengadil_id = u.id
                LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
                WHERE lp.jadual_id = :jid AND lp.status = 'Belum Jawab'
            ");
            $stmt->execute([':jid' => $jadual_id]);
            $assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($assignments)) {
                jsonResponse(['error' => true, 'message' => 'Tiada pengadil dengan status Belum Jawab.'], 400);
            }

            require_once __DIR__ . '/../config/telegram.php';
            require_once __DIR__ . '/../config/email.php';

            // Fetch ALL officials for this match (for email display, all statuses)
            $allOffStmt = $pdo->prepare("
                SELECT lp.jawatan, COALESCE(u.nama_penuh, pl.nama) AS nama
                FROM lantikan_pengadil lp
                LEFT JOIN users u ON lp.pengadil_id = u.id
                LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
                WHERE lp.jadual_id = :jid
                ORDER BY FIELD(lp.jawatan,
                    'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2',
                    'Pegawai ke4','Penilai Pengadil')
            ");
            $allOffStmt->execute([':jid' => $jadual_id]);
            $allOfficials = $allOffStmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch team logos from jadual_perlawanan
            $logoHome = $assignments[0]['logo_home'] ?? '';
            $logoAway = $assignments[0]['logo_away'] ?? '';

            $tgSent    = 0;
            $tgSkipped = 0;
            $emailSent = 0;
            $ppNotified = []; // Track PP Daerah already notified (by persatuan_id)

            foreach ($assignments as $a) {
                // Guna semula token sedia ada supaya pautan dalam emel/Telegram
                // lama kekal sah bila notifikasi dihantar semula
                $tgToken    = !empty($a['tg_token'])    ? $a['tg_token']    : bin2hex(random_bytes(16));
                $emailToken = !empty($a['email_token']) ? $a['email_token'] : bin2hex(random_bytes(16));

                // Auto-generate tg_link_token if referee doesn't have one yet (for Telegram account linking)
                $tgLinkToken = $a['tg_link_token'];
                if (empty($tgLinkToken) && empty($a['telegram_chat_id'])) {
                    $tgLinkToken = bin2hex(random_bytes(16));
                    $tgLinkId = !empty($a['user_id']) ? (int) $a['user_id'] : (int) $a['luar_id'];
                    if (!empty($a['user_id'])) {
                        $pdo->prepare("UPDATE users SET tg_link_token = :tok WHERE id = :id")
                            ->execute([':tok' => $tgLinkToken, ':id' => $tgLinkId]);
                    } else {
                        $pdo->prepare("UPDATE pengadil_luar SET tg_link_token = :tok WHERE id = :id")
                            ->execute([':tok' => $tgLinkToken, ':id' => $tgLinkId]);
                    }
                }

                $pdo->prepare("
                    UPDATE lantikan_pengadil
                    SET notif_hantar = 1, tarikh_notif = NOW(), tg_token = :tg, email_token = :em
                    WHERE id = :id
                ")->execute([':tg' => $tgToken, ':em' => $emailToken, ':id' => $a['lantikan_id']]);

                $botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');

                // ── Telegram notification ─────────────────────────────────
                if (!empty($a['telegram_chat_id'])) {
                    $msg  = tgLantikanMessage(
                        $a['nama'], $a['jawatan'], $a['kejohanan'],
                        $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                        $a['pasukan_home'], $a['pasukan_away'],
                        $a['no_perlawanan'] ?? '',
                        $a['jenis_kejohanan'] ?? 'Persahabatan'
                    );
                    $sent = tgSend((int) $a['telegram_chat_id'], $msg, tgLantikanKeyboard($tgToken));
                    if ($sent) {
                        $pdo->prepare("UPDATE lantikan_pengadil SET tg_notif_hantar = 1 WHERE id = :id")
                            ->execute([':id' => $a['lantikan_id']]);
                        $tgSent++;
                    } else {
                        $tgSkipped++;
                    }
                } else {
                    $tgSkipped++;
                }

                // ── Email notification ────────────────────────────────────
                if (!empty($a['email'])) {
                    $tgLinkUrl = (!empty($tgLinkToken) && empty($a['telegram_chat_id']))
                        ? "https://t.me/{$botUsername}?start={$tgLinkToken}"
                        : null;

                    sendLantikanEmail(
                        $a['email'],
                        $a['nama'],
                        $a['jawatan'],
                        $a['kejohanan'],
                        $a['tarikh'],
                        $a['masa'] ?? '',
                        $a['tempat'] ?? '',
                        $a['pasukan_home'],
                        $a['pasukan_away'],
                        $emailToken,
                        $tgLinkUrl,
                        !empty($a['pengadil_id']),
                        $a['no_perlawanan'] ?? '',
                        $logoHome,
                        $logoAway,
                        $allOfficials,
                        $a['jenis_kejohanan'] ?? 'Persahabatan'
                    );
                    $emailSent++;
                }

                // ── Portal notification ───────────────────────────────────
                if (!empty($a['user_id'])) {
                    notifyLantikanPortal($pdo, (int)$a['user_id'], $a['jawatan'], $a['kejohanan'],
                        $a['tarikh'], $a['pasukan_home'], $a['pasukan_away']);
                }

                // ── PP Daerah notification ────────────────────────────────
                $pid = (int)($a['persatuan_id'] ?? 0);
                if ($pid && !isset($ppNotified[$pid])) {
                    notifyPPDaerahLantikan($pdo, $pid, $a['nama'], $a['jawatan'], $a['kejohanan'],
                        $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                        $a['pasukan_home'], $a['pasukan_away'], $a['no_perlawanan'] ?? '');
                    $ppNotified[$pid] = true;
                }
            }

            // Update jadual status to 'Menunggu Pengesahan'
            $pdo->prepare("
                UPDATE jadual_perlawanan SET status = 'Menunggu Pengesahan' WHERE id = :id
            ")->execute([':id' => $jadual_id]);

            $parts = ["Notifikasi dihantar kepada " . count($assignments) . " pengadil."];
            if ($emailSent > 0) $parts[] = "{$emailSent} emel dihantar.";
            if ($tgSent > 0)    $parts[] = "{$tgSent} notifikasi Telegram dihantar.";
            if ($tgSkipped > 0) $parts[] = "{$tgSkipped} pengadil belum mendaftar Telegram (pautan disertakan dalam emel).";
            if ($renotifyCount > 0) $parts[] = "Nota: {$renotifyCount} pengadil dihantar semula (pautan asal masih sah; tempoh jawapan dikira semula dari notifikasi terbaru).";

            jsonResponse([
                'error'        => false,
                'message'      => implode(' ', $parts),
                'tg_sent'      => $tgSent,
                'tg_skipped'   => $tgSkipped,
                'email_sent'   => $emailSent,
                'renotify_count' => $renotifyCount,
            ]);
        }

        // ── Bulk notify all pending assignments for an entire kejohanan ──────
        if ($action === 'notify_all') {
            $kejohanan_id = (int) ($input['kejohanan_id'] ?? 0);
            if (!$kejohanan_id) {
                jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
            }

            // Optional: specific jadual IDs (partial send)
            $filterIds = !empty($input['jadual_ids']) && is_array($input['jadual_ids'])
                ? array_map('intval', $input['jadual_ids'])
                : [];

            // Auto-tolak dulu — baris yang sudah tamat tempoh tidak boleh
            // "dihidupkan semula" oleh hantar semula
            autoTolakLantikanTertunggak($pdo, ['kejohanan_id' => $kejohanan_id]);

            // Get all jadual IDs with pending (Belum Jawab) assignments
            $sql = "
                SELECT DISTINCT jp.id
                FROM jadual_perlawanan jp
                JOIN lantikan_pengadil lp ON lp.jadual_id = jp.id
                WHERE jp.kejohanan_id = :kid AND lp.status = 'Belum Jawab'
            ";
            if (!empty($filterIds)) {
                $placeholders = implode(',', array_fill(0, count($filterIds), '?'));
                $stmt = $pdo->prepare("
                    SELECT DISTINCT jp.id
                    FROM jadual_perlawanan jp
                    JOIN lantikan_pengadil lp ON lp.jadual_id = jp.id
                    WHERE jp.kejohanan_id = ? AND lp.status = 'Belum Jawab'
                      AND jp.id IN ({$placeholders})
                    ORDER BY jp.tarikh ASC, jp.masa ASC
                ");
                $stmt->execute(array_merge([$kejohanan_id], $filterIds));
            } else {
                $stmt = $pdo->prepare($sql . " ORDER BY jp.tarikh ASC, jp.masa ASC");
                $stmt->execute([':kid' => $kejohanan_id]);
            }
            $jadualIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

            if (empty($jadualIds)) {
                jsonResponse(['error' => true, 'message' => 'Tiada pengadil dengan status Belum Jawab untuk dihantar notifikasi.'], 400);
            }

            require_once __DIR__ . '/../config/telegram.php';
            require_once __DIR__ . '/../config/email.php';

            $totalEmail = 0;
            $totalTgSent = 0;
            $totalTgSkipped = 0;
            $totalAssignments = 0;
            $totalRenotify = 0;
            $matchesProcessed = 0;
            $ppNotified = []; // Track PP Daerah already notified

            foreach ($jadualIds as $jadual_id) {
                // Renotify count
                $reStmt = $pdo->prepare("
                    SELECT COUNT(*) FROM lantikan_pengadil
                    WHERE jadual_id = :jid AND notif_hantar = 1 AND status = 'Belum Jawab'
                ");
                $reStmt->execute([':jid' => $jadual_id]);
                $totalRenotify += (int) $reStmt->fetchColumn();

                // Fetch pending assignments for this match
                $stmt = $pdo->prepare("
                    SELECT lp.id AS lantikan_id,
                           lp.jawatan, lp.tg_notif_hantar,
                           lp.tg_token, lp.email_token,
                           COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
                           COALESCE(u.tg_link_token,    pl.tg_link_token)    AS tg_link_token,
                           COALESCE(u.id, NULL)          AS user_id,
                           COALESCE(pl.id, NULL)         AS luar_id,
                           COALESCE(u.nama_penuh, pl.nama) AS nama,
                           COALESCE(u.email, pl.emel)    AS email,
                           lp.pengadil_id,
                           u.persatuan_id,
                           jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
                           jp.pasukan_home, jp.pasukan_away, jp.kejohanan_id,
                           jp.logo_home, jp.logo_away,
                           COALESCE(kj.nama, '') AS kejohanan,
                           COALESCE(kj.jenis_kejohanan, 'Persahabatan') AS jenis_kejohanan
                    FROM lantikan_pengadil lp
                    JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
                    LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
                    LEFT JOIN users u ON lp.pengadil_id = u.id
                    LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
                    WHERE lp.jadual_id = :jid AND lp.status = 'Belum Jawab'
                ");
                $stmt->execute([':jid' => $jadual_id]);
                $assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if (empty($assignments)) continue;

                // Fetch ALL officials for this match
                $allOffStmt = $pdo->prepare("
                    SELECT lp.jawatan, COALESCE(u.nama_penuh, pl.nama) AS nama
                    FROM lantikan_pengadil lp
                    LEFT JOIN users u ON lp.pengadil_id = u.id
                    LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
                    WHERE lp.jadual_id = :jid
                    ORDER BY FIELD(lp.jawatan,
                        'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2',
                        'Pegawai ke4','Penilai Pengadil')
                ");
                $allOffStmt->execute([':jid' => $jadual_id]);
                $allOfficials = $allOffStmt->fetchAll(PDO::FETCH_ASSOC);

                $logoHome = $assignments[0]['logo_home'] ?? '';
                $logoAway = $assignments[0]['logo_away'] ?? '';

                foreach ($assignments as $a) {
                    // Guna semula token sedia ada supaya pautan lama kekal sah
                    $tgToken    = !empty($a['tg_token'])    ? $a['tg_token']    : bin2hex(random_bytes(16));
                    $emailToken = !empty($a['email_token']) ? $a['email_token'] : bin2hex(random_bytes(16));

                    $tgLinkToken = $a['tg_link_token'];
                    if (empty($tgLinkToken) && empty($a['telegram_chat_id'])) {
                        $tgLinkToken = bin2hex(random_bytes(16));
                        $tgLinkId = !empty($a['user_id']) ? (int) $a['user_id'] : (int) $a['luar_id'];
                        if (!empty($a['user_id'])) {
                            $pdo->prepare("UPDATE users SET tg_link_token = :tok WHERE id = :id")
                                ->execute([':tok' => $tgLinkToken, ':id' => $tgLinkId]);
                        } else {
                            $pdo->prepare("UPDATE pengadil_luar SET tg_link_token = :tok WHERE id = :id")
                                ->execute([':tok' => $tgLinkToken, ':id' => $tgLinkId]);
                        }
                    }

                    $pdo->prepare("
                        UPDATE lantikan_pengadil
                        SET notif_hantar = 1, tarikh_notif = NOW(), tg_token = :tg, email_token = :em
                        WHERE id = :id
                    ")->execute([':tg' => $tgToken, ':em' => $emailToken, ':id' => $a['lantikan_id']]);

                    $botUsername = env('TELEGRAM_BOT_USERNAME', 'refpahang_bot');

                    // Telegram
                    if (!empty($a['telegram_chat_id'])) {
                        $msg  = tgLantikanMessage(
                            $a['nama'], $a['jawatan'], $a['kejohanan'],
                            $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                            $a['pasukan_home'], $a['pasukan_away'],
                            $a['no_perlawanan'] ?? '',
                            $a['jenis_kejohanan'] ?? 'Persahabatan'
                        );
                        $sent = tgSend((int) $a['telegram_chat_id'], $msg, tgLantikanKeyboard($tgToken));
                        if ($sent) {
                            $pdo->prepare("UPDATE lantikan_pengadil SET tg_notif_hantar = 1 WHERE id = :id")
                                ->execute([':id' => $a['lantikan_id']]);
                            $totalTgSent++;
                        } else {
                            $totalTgSkipped++;
                        }
                    } else {
                        $totalTgSkipped++;
                    }

                    // Email
                    if (!empty($a['email'])) {
                        $tgLinkUrl = (!empty($tgLinkToken) && empty($a['telegram_chat_id']))
                            ? "https://t.me/{$botUsername}?start={$tgLinkToken}"
                            : null;

                        sendLantikanEmail(
                            $a['email'], $a['nama'], $a['jawatan'], $a['kejohanan'],
                            $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                            $a['pasukan_home'], $a['pasukan_away'],
                            $emailToken, $tgLinkUrl, !empty($a['pengadil_id']),
                            $a['no_perlawanan'] ?? '', $logoHome, $logoAway, $allOfficials,
                            $a['jenis_kejohanan'] ?? 'Persahabatan'
                        );
                        $totalEmail++;
                    }

                    // ── Portal notification ───────────────────────────────
                    if (!empty($a['user_id'])) {
                        notifyLantikanPortal($pdo, (int)$a['user_id'], $a['jawatan'], $a['kejohanan'],
                            $a['tarikh'], $a['pasukan_home'], $a['pasukan_away']);
                    }

                    // ── PP Daerah notification ────────────────────────────
                    $pid = (int)($a['persatuan_id'] ?? 0);
                    if ($pid && !isset($ppNotified[$pid])) {
                        notifyPPDaerahLantikan($pdo, $pid, $a['nama'], $a['jawatan'], $a['kejohanan'],
                            $a['tarikh'], $a['masa'] ?? '', $a['tempat'] ?? '',
                            $a['pasukan_home'], $a['pasukan_away'], $a['no_perlawanan'] ?? '');
                        $ppNotified[$pid] = true;
                    }

                    $totalAssignments++;
                }

                // Update jadual status
                $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Menunggu Pengesahan' WHERE id = :id")
                    ->execute([':id' => $jadual_id]);
                $matchesProcessed++;
            }

            $parts = ["{$totalAssignments} notifikasi dihantar untuk {$matchesProcessed} perlawanan."];
            if ($totalEmail > 0)     $parts[] = "{$totalEmail} emel dihantar.";
            if ($totalTgSent > 0)    $parts[] = "{$totalTgSent} Telegram dihantar.";
            if ($totalTgSkipped > 0) $parts[] = "{$totalTgSkipped} pengadil belum mendaftar Telegram.";
            if ($totalRenotify > 0)  $parts[] = "Nota: {$totalRenotify} pengadil dihantar semula (pautan asal masih sah; tempoh jawapan dikira semula dari notifikasi terbaru).";

            jsonResponse([
                'error'             => false,
                'message'           => implode(' ', $parts),
                'total_assignments' => $totalAssignments,
                'matches_processed' => $matchesProcessed,
                'email_sent'        => $totalEmail,
                'tg_sent'           => $totalTgSent,
                'tg_skipped'        => $totalTgSkipped,
            ]);
        }

        // ── Cancel all assignments for a single match ────────────────────────
        if ($action === 'batal_jadual') {
            $jadual_id = (int) ($input['jadual_id'] ?? 0);
            if (!$jadual_id) {
                jsonResponse(['error' => true, 'message' => 'jadual_id diperlukan.'], 400);
            }
            $result = batalLantikanByJadual($pdo, [$jadual_id]);
            jsonResponse(['error' => false, 'message' => $result['message']]);
        }

        // ── Bulk cancel assignments for multiple matches ─────────────────────
        if ($action === 'batal_bulk') {
            $jadualIds = !empty($input['jadual_ids']) && is_array($input['jadual_ids'])
                ? array_map('intval', $input['jadual_ids'])
                : [];
            if (empty($jadualIds)) {
                jsonResponse(['error' => true, 'message' => 'jadual_ids diperlukan.'], 400);
            }
            $result = batalLantikanByJadual($pdo, $jadualIds);
            jsonResponse(['error' => false, 'message' => $result['message']]);
        }

        // Assign single referee (supports both registered and luar)
        $jadual_id       = (int) ($input['jadual_id'] ?? 0);
        $pengadil_id     = !empty($input['pengadil_id']) ? (int) $input['pengadil_id'] : null;
        $pengadil_luar_id = !empty($input['pengadil_luar_id']) ? (int) $input['pengadil_luar_id'] : null;
        $jawatan         = trim($input['jawatan'] ?? '');

        if (!$jadual_id || (!$pengadil_id && !$pengadil_luar_id) || !$jawatan) {
            jsonResponse(['error' => true, 'message' => 'jadual_id, pengadil dan jawatan diperlukan.'], 400);
        }
        if (!in_array($jawatan, $VALID_JAWATAN, true)) {
            jsonResponse(['error' => true, 'message' => 'Jawatan tidak sah.'], 400);
        }

        // Upsert: if same jadual+jawatan exists, update; else insert
        // Use transaction + FOR UPDATE lock to prevent race condition
        $pdo->beginTransaction();
        try {
            $checkStmt = $pdo->prepare("SELECT id FROM lantikan_pengadil WHERE jadual_id = :jid AND jawatan = :jaw FOR UPDATE");
            $checkStmt->execute([':jid' => $jadual_id, ':jaw' => $jawatan]);
            $existing = $checkStmt->fetch();

        if ($existing) {
            // Token WAJIB dikosongkan: pautan emel/Telegram pengadil lama tidak
            // boleh digunakan untuk menjawab lantikan pengadil baru
            $pdo->prepare("
                UPDATE lantikan_pengadil
                SET pengadil_id = :pid, pengadil_luar_id = :plid, status = 'Belum Jawab', komen = NULL, tarikh_jawab = NULL, notif_hantar = 0, tarikh_notif = NULL, tg_token = NULL, email_token = NULL, created_by = :cb
                WHERE id = :id
            ")->execute([':pid' => $pengadil_id, ':plid' => $pengadil_luar_id, ':cb' => (int)$currentUser['id'], ':id' => $existing['id']]);
            $pdo->commit();
            jsonResponse(['error' => false, 'message' => 'Lantikan dikemaskini.']);
        } else {
            $pdo->prepare("
                INSERT INTO lantikan_pengadil (jadual_id, pengadil_id, pengadil_luar_id, jawatan, created_by)
                VALUES (:jid, :pid, :plid, :jaw, :cb)
            ")->execute([':jid' => $jadual_id, ':pid' => $pengadil_id, ':plid' => $pengadil_luar_id, ':jaw' => $jawatan, ':cb' => (int)$currentUser['id']]);

            // Update jadual status — any assignment means match is being prepared

            $pdo->commit();
            jsonResponse(['error' => false, 'message' => 'Pengadil berjaya dilantik.']);
        }
        } catch (Throwable $txErr) {
            $pdo->rollBack();
            throw $txErr;
        }
    }

    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'ID diperlukan.'], 400);
        }

        // Fetch full record before delete so we can send cancellation notification
        $preStmt = $pdo->prepare("
            SELECT lp.jawatan, lp.notif_hantar,
                   COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
                   COALESCE(u.nama_penuh, pl.nama)  AS nama,
                   COALESCE(u.email, pl.emel)        AS email,
                   lp.pengadil_id,
                   lp.jadual_id, jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
                   jp.pasukan_home, jp.pasukan_away, jp.kejohanan_id,
                   jp.logo_home, jp.logo_away,
                   COALESCE(kj.nama, '') AS kejohanan
            FROM lantikan_pengadil lp
            JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
            LEFT JOIN kejohanan kj ON jp.kejohanan_id = kj.id
            LEFT JOIN users u ON lp.pengadil_id = u.id
            LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
            WHERE lp.id = :id
        ");
        $preStmt->execute([':id' => $id]);
        $record = $preStmt->fetch(PDO::FETCH_ASSOC);

        $pdo->prepare("DELETE FROM lantikan_pengadil WHERE id = :id")->execute([':id' => $id]);

        // Revert jadual status if no more assignments remain
        if ($record) {
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM lantikan_pengadil WHERE jadual_id = :jid");
            $countStmt->execute([':jid' => $record['jadual_id']]);
            $remaining = (int) $countStmt->fetchColumn();
            if ($remaining === 0) {
                $pdo->prepare("UPDATE jadual_perlawanan SET status = 'Belum Lantik' WHERE id = :id")
                    ->execute([':id' => $record['jadual_id']]);
            }

            // Send cancellation notifications only if original notification was already sent
            if (!empty($record['notif_hantar'])) {
                require_once __DIR__ . '/../config/telegram.php';
                require_once __DIR__ . '/../config/email.php';

                // Fetch logos
                $logoHome = $record['logo_home'] ?? '';
                $logoAway = $record['logo_away'] ?? '';

                // Telegram
                if (!empty($record['telegram_chat_id'])) {
                    $msg = tgBatalMessage(
                        $record['nama'], $record['jawatan'], $record['kejohanan'],
                        $record['tarikh'], $record['masa'] ?? '', $record['tempat'] ?? '',
                        $record['pasukan_home'], $record['pasukan_away'],
                        $record['no_perlawanan'] ?? ''
                    );
                    tgSend((int) $record['telegram_chat_id'], $msg);
                }

                // Email
                if (!empty($record['email'])) {
                    sendBatalEmail(
                        $record['email'],
                        $record['nama'],
                        $record['jawatan'],
                        $record['kejohanan'],
                        $record['tarikh'],
                        $record['masa'] ?? '',
                        $record['tempat'] ?? '',
                        $record['pasukan_home'],
                        $record['pasukan_away'],
                        $record['no_perlawanan'] ?? '',
                        $logoHome,
                        $logoAway,
                        !empty($record['pengadil_id'])
                    );
                }
            }
        }

        jsonResponse(['error' => false, 'message' => 'Lantikan dibuang.']);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);

} catch (Throwable $e) {
    error_log('[lantikan.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
