<?php
/**
 * Bulk Upload Jadual Perlawanan from Excel
 * POST /api/jadual-upload.php
 * Accepts JSON: { kejohanan_id: int, data: [...rows] }
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../config/lantikan-helper.php';
require_once __DIR__ . '/../config/pasukan-logo-helper.php';

$currentUser = requireRole(['Admin']);

try {
    $pdo = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);
    }

    $input = getJsonInput();
    $kejohanan_id = (int) ($input['kejohanan_id'] ?? 0);
    $rows = $input['data'] ?? [];

    if (!$kejohanan_id) {
        jsonResponse(['error' => true, 'message' => 'kejohanan_id diperlukan.'], 400);
    }

    // Verify kejohanan exists
    $check = $pdo->prepare("SELECT id FROM kejohanan WHERE id = :id");
    $check->execute([':id' => $kejohanan_id]);
    if (!$check->fetch()) {
        jsonResponse(['error' => true, 'message' => 'Kejohanan tidak dijumpai.'], 404);
    }

    if (!is_array($rows) || count($rows) === 0) {
        jsonResponse(['error' => true, 'message' => 'Tiada data untuk dimuat naik.'], 400);
    }

    if (count($rows) > 200) {
        jsonResponse(['error' => true, 'message' => 'Maksimum 200 perlawanan sekali muat naik.'], 400);
    }

    $hariList = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

    $stmt = $pdo->prepare("
        INSERT INTO jadual_perlawanan (kejohanan_id, no_perlawanan, tarikh, masa, hari, kategori, peringkat, kumpulan, pasukan_home, pasukan_away, tempat)
        VALUES (:kejohanan_id, :no_perlawanan, :tarikh, :masa, :hari, :kategori, :peringkat, :kumpulan, :pasukan_home, :pasukan_away, :tempat)
    ");

    $inserted = 0;
    $skipped = 0;
    $errors = [];

    $pdo->beginTransaction();

    foreach ($rows as $i => $row) {
        $rowNum = $i + 1;
        $tarikh       = trim((string) ($row['tarikh'] ?? ''));
        $masa         = trim((string) ($row['masa'] ?? ''));
        $pasukan_home = trim((string) ($row['pasukan_home'] ?? ''));
        $pasukan_away = trim((string) ($row['pasukan_away'] ?? ''));
        $kategori     = trim((string) ($row['kategori'] ?? ''));
        $peringkat    = trim((string) ($row['peringkat'] ?? ''));
        $kumpulan     = trim((string) ($row['kumpulan'] ?? ''));
        $tempat       = trim((string) ($row['tempat'] ?? ''));
        $no_per       = trim((string) ($row['no_perlawanan'] ?? ''));

        // Validate required
        if ($tarikh === '' || $masa === '') {
            $errors[] = "Baris $rowNum: Tarikh dan masa diperlukan.";
            $skipped++;
            continue;
        }

        // Validate date format
        $dateTs = strtotime($tarikh);
        if ($dateTs === false) {
            $errors[] = "Baris $rowNum: Tarikh '$tarikh' tidak sah.";
            $skipped++;
            continue;
        }
        $tarikh = date('Y-m-d', $dateTs);

        // Normalize masa to HH:MM format
        $masa = preg_replace('/[^0-9:]/', '', $masa);
        if (strlen($masa) === 4 && strpos($masa, ':') === false) {
            $masa = substr($masa, 0, 2) . ':' . substr($masa, 2);
        }
        if (!preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $masa)) {
            $errors[] = "Baris $rowNum: Masa '$masa' tidak sah.";
            $skipped++;
            continue;
        }

        // Auto hari
        $hari = $hariList[(int) date('w', $dateTs)];

        // Auto no_perlawanan (per kategori, berprefiks: cth B12-01) if not provided.
        // Re-derives from DB each time, so prior inserts in this batch are counted.
        if ($no_per === '') {
            $no_per = nextNoPerlawanan($pdo, $kejohanan_id, $kategori);
        }

        try {
            $stmt->execute([
                ':kejohanan_id'   => $kejohanan_id,
                ':no_perlawanan'  => $no_per,
                ':tarikh'         => $tarikh,
                ':masa'           => $masa,
                ':hari'           => $hari,
                ':kategori'       => $kategori,
                ':peringkat'      => $peringkat,
                ':kumpulan'       => $kumpulan,
                ':pasukan_home'   => $pasukan_home,
                ':pasukan_away'   => $pasukan_away,
                ':tempat'         => $tempat,
            ]);
            $inserted++;
        } catch (Throwable $e) {
            $errors[] = "Baris $rowNum: " . $e->getMessage();
            $skipped++;
        }
    }

    $pdo->commit();

    // Auto-isi logo dari registri pasukan (ikut nama)
    $logosFilled = $inserted > 0 ? isiLogoDariRegistri($pdo, $kejohanan_id) : 0;

    $message = "$inserted perlawanan berjaya ditambah.";
    if ($logosFilled > 0) {
        $message .= " $logosFilled logo pasukan diisi secara automatik.";
    }
    if ($skipped > 0) {
        $message .= " $skipped baris dilangkau.";
    }

    jsonResponse([
        'error'    => false,
        'message'  => $message,
        'inserted' => $inserted,
        'skipped'  => $skipped,
        'errors'   => array_slice($errors, 0, 20),
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[jadual-upload.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
