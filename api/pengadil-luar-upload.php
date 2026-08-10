<?php
/**
 * Bulk Upload Pengadil Luar (External Referees)
 * POST /api/pengadil-luar-upload.php
 * Accepts JSON array of pengadil records parsed from Excel on frontend.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/pengadil-luar-helper.php';

$currentUser = requireRole(['Admin']);

try {
    $pdo = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);
    }

    $input = getJsonInput();
    $rows = $input['data'] ?? [];

    if (!is_array($rows) || count($rows) === 0) {
        jsonResponse(['error' => true, 'message' => 'Tiada data untuk dimuat naik.'], 400);
    }

    if (count($rows) > 500) {
        jsonResponse(['error' => true, 'message' => 'Maksimum 500 rekod sekali muat naik.'], 400);
    }

    // Pre-load registered referees for matching (by phone, email, name)
    $regStmt = $pdo->query("
        SELECT id, nama_penuh, no_telefon, email, daerah, negeri, jenis_pengadil
        FROM users
        WHERE role IN ('Pengadil', 'Penilai', 'PP Daerah') AND aktif = 1
    ");
    $registeredList = $regStmt->fetchAll();

    // Build lookup indexes for fast matching
    $byPhone = [];
    $byEmail = [];
    $byName  = [];
    foreach ($registeredList as $reg) {
        $phone = preg_replace('/[^0-9]/', '', $reg['no_telefon'] ?? '');
        if ($phone !== '') {
            $byPhone[$phone] = $reg;
        }
        $email = strtolower(trim($reg['email'] ?? ''));
        if ($email !== '') {
            $byEmail[$email] = $reg;
        }
        $name = strtolower(trim($reg['nama_penuh'] ?? ''));
        if ($name !== '') {
            $byName[$name] = $reg;
        }
    }

    $stmt = $pdo->prepare("
        INSERT INTO pengadil_luar (nama, daerah, negeri, no_tel, emel, jenis_pengadil)
        VALUES (:nama, :daerah, :negeri, :no_tel, :emel, :jenis)
    ");

    $inserted = 0;
    $skipped = 0;
    $matched = []; // rows that match registered pengadil
    $errors = [];

    $pdo->beginTransaction();

    foreach ($rows as $i => $row) {
        $rowNum = $i + 1;
        $nama   = trim((string) ($row['nama'] ?? ''));
        $daerah = trim((string) ($row['daerah'] ?? ''));
        $negeri = trim((string) ($row['negeri'] ?? ''));
        $no_tel = trim((string) ($row['no_tel'] ?? ''));
        $emel   = trim((string) ($row['emel'] ?? ''));
        $jenis  = trim((string) ($row['jenis_pengadil'] ?? 'Pengadil Negeri'));

        // Validate required fields
        if ($nama === '' || $daerah === '' || $negeri === '') {
            $errors[] = "Baris $rowNum: Nama, daerah dan negeri diperlukan.";
            $skipped++;
            continue;
        }

        // Validate negeri (case-insensitive)
        $negeriMatch = normalizePengadilLuarNegeri($negeri);
        if (!$negeriMatch) {
            $errors[] = "Baris $rowNum: Negeri '$negeri' tidak sah.";
            $skipped++;
            continue;
        }
        $negeri = $negeriMatch;

        // Normalize jenis pengadil
        $jenisMatch = normalizePengadilLuarJenis($jenis);
        if ($jenisMatch === null) {
            $errors[] = "Baris $rowNum: Jenis pengadil '$jenis' tidak sah.";
            $skipped++;
            continue;
        }
        $jenis = $jenisMatch;

        // Validate email format if provided
        if ($emel !== '' && !filter_var($emel, FILTER_VALIDATE_EMAIL)) {
            $errors[] = "Baris $rowNum: Emel '$emel' tidak sah.";
            $skipped++;
            continue;
        }

        // Check if this row matches a registered pengadil
        $matchedReg = null;
        $matchBy = '';
        $phoneNorm = preg_replace('/[^0-9]/', '', $no_tel);
        $emailLower = strtolower($emel);
        $nameLower = strtolower($nama);

        if ($phoneNorm !== '' && isset($byPhone[$phoneNorm])) {
            $matchedReg = $byPhone[$phoneNorm];
            $matchBy = 'no_telefon';
        } elseif ($emailLower !== '' && isset($byEmail[$emailLower])) {
            $matchedReg = $byEmail[$emailLower];
            $matchBy = 'emel';
        } elseif (isset($byName[$nameLower])) {
            $matchedReg = $byName[$nameLower];
            $matchBy = 'nama';
        }

        if ($matchedReg) {
            $matched[] = [
                'baris'       => $rowNum,
                'upload_nama' => $nama,
                'match_by'    => $matchBy,
                'pengadil_id' => (int) $matchedReg['id'],
                'nama_penuh'  => $matchedReg['nama_penuh'],
                'daerah'      => $matchedReg['daerah'] ?? '',
                'negeri'      => $matchedReg['negeri'] ?? 'Pahang',
                'no_telefon'  => $matchedReg['no_telefon'] ?? '',
                'email'       => $matchedReg['email'] ?? '',
                'jenis_pengadil' => $matchedReg['jenis_pengadil'] ?? '',
            ];
            $skipped++;
            continue;
        }

        try {
            $stmt->execute([
                ':nama'   => $nama,
                ':daerah' => $daerah,
                ':negeri' => $negeri,
                ':no_tel' => $no_tel,
                ':emel'   => $emel,
                ':jenis'  => $jenis,
            ]);
            $inserted++;
        } catch (Throwable $e) {
            $errors[] = "Baris $rowNum: " . $e->getMessage();
            $skipped++;
        }
    }

    $pdo->commit();

    $message = "$inserted pengadil luar berjaya ditambah.";
    if (count($matched) > 0) {
        $message .= " " . count($matched) . " pengadil sudah berdaftar dalam sistem.";
    }
    if ($skipped - count($matched) > 0) {
        $message .= " " . ($skipped - count($matched)) . " baris dilangkau.";
    }

    jsonResponse([
        'error'    => false,
        'message'  => $message,
        'inserted' => $inserted,
        'skipped'  => $skipped,
        'matched'  => $matched,
        'errors'   => array_slice($errors, 0, 20),
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[pengadil-luar-upload.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
