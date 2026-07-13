<?php
/**
 * Profil Pengadil/RA API (modal profil global)
 * GET /api/profil-pengadil.php?id=X
 *
 * Profil penuh: maklumat peribadi, taraf, tahun Kelas 3 FAM, statistik
 * tugasan, sejarah permohonan dan sejarah perlawanan.
 *
 * Boleh diakses semua pengguna log masuk. Maklumat sensitif (IC, kontak,
 * alamat, majikan, waris) hanya didedahkan kepada Admin dan PP Daerah.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Admin', 'Pengadil', 'Penilai', 'PP Daerah']);

try {
    $pdo = getDbConnection();

    /* ── PUT: kemaskini profil (Admin semua; PP Daerah untuk daerah sendiri) ── */
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        if (!in_array($currentUser['role'], ['Admin', 'PP Daerah'], true)) {
            jsonResponse(['error' => true, 'message' => 'Tidak dibenarkan.'], 403);
        }

        $input = getJsonInput();
        $id = (int) ($input['id'] ?? 0);
        if (!$id) {
            jsonResponse(['error' => true, 'message' => 'id diperlukan.'], 400);
        }

        $targetStmt = $pdo->prepare("SELECT persatuan_id FROM users WHERE id = :id");
        $targetStmt->execute([':id' => $id]);
        $target = $targetStmt->fetch(PDO::FETCH_ASSOC);
        if (!$target) {
            jsonResponse(['error' => true, 'message' => 'Pengguna tidak dijumpai.'], 404);
        }

        // PP Daerah hanya boleh kemaskini pengadil dalam persatuan/daerah sendiri
        if ($currentUser['role'] === 'PP Daerah'
            && (int) ($target['persatuan_id'] ?? 0) !== (int) ($currentUser['persatuan_id'] ?? -1)) {
            jsonResponse(['error' => true, 'message' => 'Anda hanya boleh kemaskini pengadil di bawah pentadbiran daerah anda.'], 403);
        }

        // Field yang dibenarkan (whitelist); nilai '' menjadi NULL
        $allowed = [
            'nama_penuh', 'no_ic', 'jantina', 'no_telefon', 'email', 'saiz_baju',
            'alamat1', 'alamat2', 'poskod', 'daerah', 'negeri',
            'status_kerja', 'jawatan', 'nama_majikan',
            'nama_waris', 'hubungan_waris', 'telefon_waris',
            'jenis_pengadil', 'jenis_penilai', 'tahun_mula_aktif',
            'tahun_mohon_kelas3', 'tahun_lulus_kelas3',
        ];
        // Hanya Admin boleh tukar persatuan dan status aktif
        if ($currentUser['role'] === 'Admin') {
            $allowed[] = 'persatuan_id';
            $allowed[] = 'aktif';
        }

        $set = [];
        $params = [':id' => $id];
        foreach ($allowed as $field) {
            if (!array_key_exists($field, $input)) continue;
            $value = $input[$field];
            if (is_string($value)) $value = trim($value);
            if ($value === '' || $value === null) {
                $value = null;
            } elseif (in_array($field, ['tahun_mula_aktif', 'tahun_mohon_kelas3', 'tahun_lulus_kelas3', 'persatuan_id', 'aktif'], true)) {
                $value = (int) $value;
            }
            $set[] = "{$field} = :{$field}";
            $params[":{$field}"] = $value;
        }

        if (empty($set)) {
            jsonResponse(['error' => true, 'message' => 'Tiada perubahan untuk disimpan.'], 400);
        }

        $pdo->prepare("UPDATE users SET " . implode(', ', $set) . " WHERE id = :id")
            ->execute($params);

        jsonResponse(['error' => false, 'message' => 'Profil berjaya dikemaskini.']);
    }

    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) {
        jsonResponse(['error' => true, 'message' => 'id diperlukan.'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT u.id, u.nama_penuh, u.url_gambar_profil, u.role,
               u.jenis_pengadil, u.jenis_penilai, u.tahun_mula_aktif,
               u.tahun_mohon_kelas3, u.tahun_lulus_kelas3,
               u.pengadil_kebangsaan, u.pengadil_negeri, u.pengadil_daerah,
               u.aktif, u.jantina, u.saiz_baju, u.umur, u.telegram_chat_id,
               u.email, u.no_telefon, u.no_ic, u.persatuan_id,
               u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
               u.status_kerja, u.jawatan, u.nama_majikan,
               u.nama_waris, u.hubungan_waris, u.telefon_waris,
               pbd.nama_persatuan, pbd.daerah AS daerah_persatuan
        FROM users u
        LEFT JOIN persatuan_bolasepak_daerah pbd ON u.persatuan_id = pbd.id
        WHERE u.id = :id
    ");
    $stmt->execute([':id' => $id]);
    $profil = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profil) {
        jsonResponse(['error' => true, 'message' => 'Pengguna tidak dijumpai.'], 404);
    }

    // Maklumat sensitif hanya untuk Admin / PP Daerah
    if (!in_array($currentUser['role'], ['Admin', 'PP Daerah'], true)) {
        unset(
            $profil['email'], $profil['no_telefon'], $profil['no_ic'],
            $profil['alamat1'], $profil['alamat2'], $profil['poskod'],
            $profil['status_kerja'], $profil['jawatan'], $profil['nama_majikan'],
            $profil['nama_waris'], $profil['hubungan_waris'], $profil['telefon_waris']
        );
    }

    $profil['pengadil_kebangsaan'] = (int) $profil['pengadil_kebangsaan'];
    $profil['pengadil_negeri']     = (int) $profil['pengadil_negeri'];
    $profil['pengadil_daerah']     = (int) $profil['pengadil_daerah'];
    $profil['telegram_linked']     = !empty($profil['telegram_chat_id']) ? 1 : 0;
    unset($profil['telegram_chat_id']);

    // Hak kemaskini: Admin semua; PP Daerah untuk persatuan/daerah sendiri
    $profil['boleh_kemaskini'] = ($currentUser['role'] === 'Admin'
        || ($currentUser['role'] === 'PP Daerah'
            && (int) ($profil['persatuan_id'] ?? 0) === (int) ($currentUser['persatuan_id'] ?? -1))) ? 1 : 0;

    // ── Statistik tugasan (lantikan) ───────────────────────────────────
    $statStmt = $pdo->prepare("
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'Diterima' THEN 1 ELSE 0 END) AS diterima,
               SUM(CASE WHEN status = 'Ditolak' THEN 1 ELSE 0 END) AS ditolak,
               SUM(CASE WHEN status = 'Belum Jawab' THEN 1 ELSE 0 END) AS belum_jawab
        FROM lantikan_pengadil
        WHERE pengadil_id = :id
    ");
    $statStmt->execute([':id' => $id]);
    $tugasan = $statStmt->fetch(PDO::FETCH_ASSOC);

    // ── Sejarah permohonan ─────────────────────────────────────────────
    // tahun_sebenar = tahun permohonan DIHANTAR. Jangan guna tahun_permohonan
    // sebagai paparan utama — ia tahun kitaran dari tetapan 'application_year'
    // (boleh berbeza dari tahun sebenar permohonan dibuat).
    $appStmt = $pdo->prepare("
        SELECT id, jenis_borang, jenis_permohonan, jenis_pengadil,
               status, status_ujian, admin_notes,
               tahun_permohonan, status_kemaskini, tarikh_hantar,
               COALESCE(YEAR(tarikh_hantar), tahun_permohonan) AS tahun_sebenar
        FROM permohonan
        WHERE user_id = :id
        ORDER BY tarikh_hantar DESC, id DESC
    ");
    $appStmt->execute([':id' => $id]);
    $permohonan = $appStmt->fetchAll(PDO::FETCH_ASSOC);

    // ── Keputusan ujian kecergasan tahunan ─────────────────────────────
    $fitStmt = $pdo->prepare("
        SELECT id, tahun_permohonan, status_ujian, tarikh_hantar,
               COALESCE(YEAR(tarikh_hantar), tahun_permohonan) AS tahun_sebenar
        FROM permohonan
        WHERE user_id = :id
          AND (jenis_borang = 'ujian_kecergasan' OR jenis_permohonan = 'ujian_kecergasan')
        ORDER BY tahun_sebenar DESC, tarikh_hantar DESC
    ");
    $fitStmt->execute([':id' => $id]);
    $ujianKecergasan = $fitStmt->fetchAll(PDO::FETCH_ASSOC);

    // ── Sejarah perlawanan ─────────────────────────────────────────────
    $matchStmt = $pdo->prepare("
        SELECT id, tarikh, jenis, tempat, jawatan, home_team, away_team
        FROM perlawanan
        WHERE user_id = :id
        ORDER BY tarikh DESC
    ");
    $matchStmt->execute([':id' => $id]);
    $perlawanan = $matchStmt->fetchAll(PDO::FETCH_ASSOC);

    $profil['stats'] = [
        'tugasan_total'     => (int) ($tugasan['total'] ?? 0),
        'tugasan_diterima'  => (int) ($tugasan['diterima'] ?? 0),
        'tugasan_ditolak'   => (int) ($tugasan['ditolak'] ?? 0),
        'tugasan_belum'     => (int) ($tugasan['belum_jawab'] ?? 0),
        'jumlah_perlawanan' => count($perlawanan),
    ];
    $profil['permohonan'] = $permohonan;
    $profil['perlawanan'] = $perlawanan;
    $profil['ujian_kecergasan'] = $ujianKecergasan;

    jsonResponse(['error' => false, 'profil' => $profil]);

} catch (Throwable $e) {
    error_log('[profil-pengadil.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
