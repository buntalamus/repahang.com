<?php

/**
 * Admin configuration for the tournament-scoped Pengerusi Pengadil who
 * confirms submitted RA reports.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/laporan-pengesahan.php';

$adminId = requireAdmin();

try {
    $pdo = getDbConnection();
    requireLaporanPengesahanSchema($pdo);
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $kejohananId = (int) ($_GET['kejohanan_id'] ?? 0);
        if ($kejohananId < 1) {
            jsonResponse(['error' => true, 'message' => 'ID kejohanan diperlukan.'], 400);
        }

        $tournamentStmt = $pdo->prepare("
            SELECT id, nama, peringkat_kejohanan, status
            FROM kejohanan WHERE id = :id LIMIT 1
        ");
        $tournamentStmt->execute([':id' => $kejohananId]);
        $tournament = $tournamentStmt->fetch(PDO::FETCH_ASSOC);
        if (!$tournament) {
            jsonResponse(['error' => true, 'message' => 'Kejohanan tidak dijumpai.'], 404);
        }

        $candidateStmt = $pdo->prepare("
            SELECT source, official_id, nama, daerah, negeri, no_telefon, email,
                   telegram_chat_id, dalam_pool
            FROM (
                SELECT 'Berdaftar' AS source, u.id AS official_id,
                       u.nama_penuh AS nama, u.daerah,
                       COALESCE(NULLIF(TRIM(u.negeri), ''), 'Pahang') AS negeri,
                       u.no_telefon, u.email, u.telegram_chat_id,
                       CASE WHEN pp.id IS NULL THEN 0 ELSE 1 END AS dalam_pool
                FROM users u
                LEFT JOIN pool_pengadil pp
                  ON pp.kejohanan_id = :pool_user_kejohanan AND pp.pengadil_id = u.id
                WHERE u.aktif = 1
                  AND (u.role = 'Penilai' OR u.jenis_pengadil = 'Penilai Pengadil')

                UNION ALL

                SELECT 'Luar' AS source, pl.id AS official_id,
                       pl.nama, pl.daerah, pl.negeri,
                       pl.no_tel AS no_telefon, pl.emel AS email,
                       pl.telegram_chat_id,
                       CASE WHEN pp.id IS NULL THEN 0 ELSE 1 END AS dalam_pool
                FROM pengadil_luar pl
                LEFT JOIN pool_pengadil pp
                  ON pp.kejohanan_id = :pool_luar_kejohanan AND pp.pengadil_luar_id = pl.id
                WHERE pl.jenis_pengadil = 'Penilai Pengadil'
            ) candidates
            ORDER BY dalam_pool DESC, nama ASC
        ");
        $candidateStmt->execute([
            ':pool_user_kejohanan' => $kejohananId,
            ':pool_luar_kejohanan' => $kejohananId,
        ]);
        $candidates = $candidateStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($candidates as &$candidate) {
            $candidate['official_id'] = (int) $candidate['official_id'];
            $candidate['dalam_pool'] = (bool) $candidate['dalam_pool'];
            $candidate['telegram_linked'] = !empty($candidate['telegram_chat_id']);
            unset($candidate['telegram_chat_id']);
        }
        unset($candidate);

        $current = getKejohananPengesahLaporan($pdo, $kejohananId);
        if ($current) {
            $current['telegram_linked'] = !empty($current['telegram_chat_id']);
            unset($current['telegram_chat_id']);
        }

        $auditStmt = $pdo->prepare("
            SELECT a.id, a.event_type, a.old_identity_json, a.new_identity_json,
                   a.actor_user_id, u.nama_penuh AS actor_name, a.created_at
            FROM kejohanan_pengesah_laporan_audit a
            LEFT JOIN users u ON u.id = a.actor_user_id
            WHERE a.kejohanan_id = :id
            ORDER BY a.id DESC
            LIMIT 25
        ");
        $auditStmt->execute([':id' => $kejohananId]);
        $audit = $auditStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($audit as &$entry) {
            $entry['old_identity'] = json_decode((string) ($entry['old_identity_json'] ?? ''), true);
            $entry['new_identity'] = json_decode((string) ($entry['new_identity_json'] ?? ''), true);
            unset($entry['old_identity_json'], $entry['new_identity_json']);
        }
        unset($entry);

        jsonResponse([
            'error' => false,
            'data' => [
                'kejohanan' => $tournament,
                'current' => $current,
                'candidates' => $candidates,
                'audit' => $audit,
            ],
        ]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $kejohananId = (int) ($input['kejohanan_id'] ?? 0);
        $source = trim((string) ($input['source'] ?? ''));
        $officialId = (int) ($input['official_id'] ?? 0);
        $jawatan = trim((string) ($input['jawatan'] ?? 'Pengerusi Pengadil'));
        if ($kejohananId < 1 || $officialId < 1 || !in_array($source, ['Berdaftar', 'Luar'], true)) {
            jsonResponse(['error' => true, 'message' => 'Pilihan Pengerusi Pengadil tidak sah.'], 400);
        }
        if ($jawatan === '') {
            $jawatan = 'Pengerusi Pengadil';
        }

        $tournamentStmt = $pdo->prepare("
            SELECT id, nama, peringkat_kejohanan FROM kejohanan WHERE id = :id LIMIT 1
        ");
        $tournamentStmt->execute([':id' => $kejohananId]);
        $tournament = $tournamentStmt->fetch(PDO::FETCH_ASSOC);
        if (!$tournament) {
            jsonResponse(['error' => true, 'message' => 'Kejohanan tidak dijumpai.'], 404);
        }

        if ($source === 'Berdaftar') {
            $officialStmt = $pdo->prepare("
                SELECT id, nama_penuh AS nama, negeri, email, no_telefon, telegram_chat_id
                FROM users
                WHERE id = :id AND aktif = 1
                  AND (role = 'Penilai' OR jenis_pengadil = 'Penilai Pengadil')
                LIMIT 1
            ");
        } else {
            $officialStmt = $pdo->prepare("
                SELECT id, nama, negeri, emel AS email, no_tel AS no_telefon, telegram_chat_id
                FROM pengadil_luar
                WHERE id = :id AND jenis_pengadil = 'Penilai Pengadil'
                LIMIT 1
            ");
        }
        $officialStmt->execute([':id' => $officialId]);
        $official = $officialStmt->fetch(PDO::FETCH_ASSOC);
        if (!$official) {
            jsonResponse(['error' => true, 'message' => 'Pegawai mesti berstatus Penilai Pengadil.'], 422);
        }
        if (trim((string) ($official['email'] ?? '')) === '' && empty($official['telegram_chat_id'])) {
            jsonResponse([
                'error' => true,
                'message' => 'Pengerusi mesti mempunyai sekurang-kurangnya emel atau Telegram yang telah dipautkan.',
            ], 422);
        }

        $old = getKejohananPengesahLaporan($pdo, $kejohananId);
        $newIdentity = [
            'source' => $source,
            'official_id' => $officialId,
            'nama' => $official['nama'],
            'jawatan' => $jawatan,
            'peringkat' => $tournament['peringkat_kejohanan'],
            'email' => $official['email'] ?? null,
            'telegram_linked' => !empty($official['telegram_chat_id']),
        ];

        $pdo->beginTransaction();
        try {
            $upsert = $pdo->prepare("
                INSERT INTO kejohanan_pengesah_laporan (
                    kejohanan_id, pengesah_user_id, pengesah_luar_id,
                    nama_snapshot, jawatan_snapshot, peringkat_snapshot,
                    aktif, created_by
                ) VALUES (
                    :kejohanan_id, :user_id, :luar_id,
                    :nama, :jawatan, :peringkat, 1, :created_by
                )
                ON DUPLICATE KEY UPDATE
                    pengesah_user_id = VALUES(pengesah_user_id),
                    pengesah_luar_id = VALUES(pengesah_luar_id),
                    nama_snapshot = VALUES(nama_snapshot),
                    jawatan_snapshot = VALUES(jawatan_snapshot),
                    peringkat_snapshot = VALUES(peringkat_snapshot),
                    aktif = 1,
                    created_by = VALUES(created_by)
            ");
            $upsert->execute([
                ':kejohanan_id' => $kejohananId,
                ':user_id' => $source === 'Berdaftar' ? $officialId : null,
                ':luar_id' => $source === 'Luar' ? $officialId : null,
                ':nama' => $official['nama'],
                ':jawatan' => mb_substr($jawatan, 0, 150),
                ':peringkat' => $tournament['peringkat_kejohanan'],
                ':created_by' => $adminId,
            ]);
            $mapping = getKejohananPengesahLaporan($pdo, $kejohananId);
            if (!$mapping) {
                throw new RuntimeException('Konfigurasi Pengerusi gagal disimpan.');
            }

            $auditStmt = $pdo->prepare("
                INSERT INTO kejohanan_pengesah_laporan_audit (
                    kejohanan_id, kejohanan_pengesah_id, event_type,
                    old_identity_json, new_identity_json, actor_user_id,
                    ip_address, user_agent
                ) VALUES (
                    :kejohanan_id, :mapping_id, :event_type,
                    :old_identity, :new_identity, :actor_user_id,
                    :ip_address, :user_agent
                )
            ");
            $auditStmt->execute([
                ':kejohanan_id' => $kejohananId,
                ':mapping_id' => (int) $mapping['id'],
                ':event_type' => $old ? 'chair_changed' : 'chair_assigned',
                ':old_identity' => $old
                    ? json_encode($old, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    : null,
                ':new_identity' => json_encode($newIdentity, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ':actor_user_id' => $adminId,
                ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                ':user_agent' => isset($_SERVER['HTTP_USER_AGENT'])
                    ? mb_substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 255)
                    : null,
            ]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        $pendingStmt = $pdo->prepare("
            SELECT laporan.id
            FROM laporan_penilaian laporan
            JOIN jadual_perlawanan jp ON jp.id = laporan.jadual_id
            WHERE jp.kejohanan_id = :kejohanan_id
              AND laporan.status = 'Dihantar'
        ");
        $pendingStmt->execute([':kejohanan_id' => $kejohananId]);
        $dispatched = 0;
        $failed = 0;
        foreach ($pendingStmt->fetchAll(PDO::FETCH_COLUMN) as $reportId) {
            try {
                dispatchLaporanForPengerusi($pdo, (int) $reportId);
                $dispatched++;
            } catch (Throwable $e) {
                $failed++;
                error_log('[kejohanan-pengesah-laporan.php] Pending dispatch error: ' . $e->getMessage());
            }
        }

        jsonResponse([
            'error' => false,
            'message' => 'Pengerusi Pengadil berjaya ditetapkan untuk kejohanan ini.',
            'data' => [
                'current' => getKejohananPengesahLaporan($pdo, $kejohananId),
                'pending_dispatched' => $dispatched,
                'pending_failed' => $failed,
            ],
        ]);
    }

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[kejohanan-pengesah-laporan.php] ' . $e->getMessage());
    jsonResponse([
        'error' => true,
        'message' => APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.',
    ], 500);
}
