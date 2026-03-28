<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/penilai_permohonan_helper.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || ($_SESSION['user_role'] ?? '') !== 'Penilai') {
    jsonResponse([
        'error' => true,
        'message' => 'Akses ditolak. Hanya penilai dibenarkan menggunakan ciri ini.'
    ], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = getDbConnection();
    ensurePenilaiPermohonanTable($pdo);

    switch ($method) {
        case 'GET':
            handlePenilaiPermohonanList($pdo);
            break;
        case 'POST':
            handlePenilaiPermohonanCreate($pdo);
            break;
        default:
            jsonResponse([
                'error' => true,
                'message' => 'Kaedah tidak dibenarkan.'
            ], 405);
    }
} catch (Throwable $e) {
    error_log('Penilai permohonan API error: ' . $e->getMessage());
    jsonResponse([
        'error' => true,
        'message' => APP_DEBUG ? $e->getMessage() : 'Ralat dalaman pelayan.'
    ], 500);
}

function handlePenilaiPermohonanList(PDO $pdo): void
{
    $userId = (int) $_SESSION['user_id'];

    $stmt = $pdo->prepare(<<<'SQL'
        SELECT 
            p.id,
            p.tahun_permohonan,
            p.nama_penuh,
            p.emel,
            p.no_telefon,
            p.status,
            p.status_workflow,
            p.workflow_status,
            p.tarikh_hantar,
            p.status_kemaskini,
            p.admin_notes,
            det.jenis_penilai,
            det.tahun_pengalaman,
            det.kelayakan,
            det.sijil_kursus_url,
            det.sijil_kesihatan_url,
            det.catatan
        FROM permohonan p
        LEFT JOIN penilai_permohonan det ON det.permohonan_id = p.id
        WHERE p.user_id = ?
          AND p.jenis_permohonan = 'penilai_pengadil'
        ORDER BY p.tarikh_hantar DESC
    SQL);
    $stmt->execute([$userId]);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $statsStmt = $pdo->prepare(<<<'SQL'
        SELECT 
            SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
        FROM permohonan
        WHERE user_id = ?
          AND jenis_permohonan = 'penilai_pengadil'
    SQL);
    $statsStmt->execute([$userId]);
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC) ?: ['pending' => 0, 'approved' => 0, 'rejected' => 0];

    $blockedYears = [];
    $formatted = array_map(static function (array $row) use (&$blockedYears): array {
        $year = isset($row['tahun_permohonan']) ? (int) $row['tahun_permohonan'] : 0;
        $status = $row['status'] ?? 'Pending';

        if ($year > 0 && in_array($status, ['Pending', 'Approved'], true)) {
            $blockedYears[$year] = true;
        }

        return formatPenilaiPermohonanRow($row);
    }, $applications);

    jsonResponse([
        'error' => false,
        'applications' => $formatted,
        'stats' => [
            'pending' => (int) ($stats['pending'] ?? 0),
            'approved' => (int) ($stats['approved'] ?? 0),
            'rejected' => (int) ($stats['rejected'] ?? 0),
            'total' => (int) (($stats['pending'] ?? 0) + ($stats['approved'] ?? 0) + ($stats['rejected'] ?? 0)),
        ],
        'meta' => [
            'blockedYears' => array_keys($blockedYears),
        ],
    ]);
}

function handlePenilaiPermohonanCreate(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
    }

    $userId = (int) $_SESSION['user_id'];
    $inputYear = filter_input(INPUT_POST, 'tahun_permohonan', FILTER_VALIDATE_INT);

    if (!$inputYear || $inputYear < ((int) date('Y')) || $inputYear > 2100) {
        throw new InvalidArgumentException('Tahun permohonan tidak sah.');
    }

    $jenisPenilai = trim($_POST['jenis_penilai'] ?? '');
    $tahunPengalaman = filter_input(INPUT_POST, 'tahun_pengalaman', FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 0, 'max_range' => 60],
    ]);

    if ($tahunPengalaman === false || $tahunPengalaman === null) {
        throw new InvalidArgumentException('Sila masukkan jumlah tahun pengalaman yang sah.');
    }

    $kelayakan = trim($_POST['kelayakan'] ?? '');
    if ($kelayakan === '') {
        throw new InvalidArgumentException('Sila jelaskan kelayakan dan pengalaman anda.');
    }

    $catatan = trim($_POST['catatan'] ?? '');

    $namaPenuh = trim($_POST['nama_penuh'] ?? '');
    $noKp = preg_replace('/[^0-9]/', '', $_POST['no_ic'] ?? '');
    $emelInput = trim($_POST['emel'] ?? '');
    $noTelefon = trim($_POST['no_telefon'] ?? '');

    $sijilKursusUrl = uploadSupportingDocument($_FILES['sijil_kursus'] ?? null, 'sijil_kursus');
    $sijilKesihatanUrl = uploadSupportingDocument($_FILES['sijil_kesihatan'] ?? null, 'sijil_kesihatan');

    $userStmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        throw new RuntimeException('Profil penilai tidak dijumpai.');
    }

    $namaPenuh = $namaPenuh !== '' ? $namaPenuh : ($user['nama_penuh'] ?? '');
    $noKp = $noKp !== '' ? $noKp : ($user['no_ic'] ?? '');
    $emel = $emelInput !== '' ? $emelInput : ($user['email'] ?? '');
    $noTelefon = $noTelefon !== '' ? $noTelefon : ($user['no_telefon'] ?? '');
    $jantina = $user['jantina'] ?? 'Tidak Dinyatakan';
    $jenisPenilai = $jenisPenilai !== '' ? $jenisPenilai : ($user['jenis_penilai'] ?? 'Penilai Pengadil');

    if ($namaPenuh === '' || $noKp === '' || $emel === '' || $noTelefon === '') {
        throw new InvalidArgumentException('Nama, no. kad pengenalan, emel dan telefon diperlukan.');
    }

    if (!filter_var($emel, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Alamat emel tidak sah.');
    }

    $duplicateStmt = $pdo->prepare(<<<'SQL'
        SELECT id FROM permohonan 
        WHERE user_id = ? 
          AND jenis_permohonan = 'penilai_pengadil' 
          AND tahun_permohonan = ?
          AND status IN ('Pending', 'Approved')
        LIMIT 1
    SQL);
    $duplicateStmt->execute([$userId, $inputYear]);
    if ($duplicateStmt->fetch()) {
        throw new RuntimeException('Anda sudah mempunyai permohonan aktif untuk tahun tersebut.');
    }

    $persatuanId = $user['persatuan_id'] ?? ($_SESSION['persatuan_id'] ?? null);
    $now = date('Y-m-d H:i:s');

    $insertData = [
        'user_id' => $userId,
        'persatuan_id' => $persatuanId,
        'tahun_permohonan' => $inputYear,
        'nama_penuh' => $namaPenuh,
        'no_kp' => $noKp,
        'emel' => $emel,
        'no_telefon' => $noTelefon,
        'jantina' => $jantina,
        'jenis_borang' => 'penilai_pengadil',
        'jenis_permohonan' => 'penilai_pengadil',
        'jenis_pengadil' => $jenisPenilai,
        'alamat1' => $user['alamat1'] ?? 'Tidak Dinyatakan',
        'alamat2' => $user['alamat2'] ?? null,
        'poskod' => $user['poskod'] ?? '00000',
        'daerah' => $user['daerah'] ?? 'Tidak Dinyatakan',
        'negeri' => $user['negeri'] ?? 'Pahang',
        'status_kerja' => $user['status_kerja'] ?? 'Tidak Dinyatakan',
        'jawatan' => $user['jawatan'] ?? null,
        'nama_waris' => $user['nama_waris'] ?? 'Tidak Dinyatakan',
        'hubungan_waris' => $user['hubungan_waris'] ?? 'Tidak Dinyatakan',
        'telefon_waris' => $user['telefon_waris'] ?? 'Tidak Dinyatakan',
        'status' => 'Pending',
        'workflow_status' => 'Pending',
        'status_workflow' => 'Menunggu Admin',
        'tarikh_hantar' => $now,
        'status_kemaskini' => $now,
        'pp_notes' => $catatan !== '' ? $catatan : null,
    ];

    $columns = array_keys($insertData);
    $placeholders = implode(', ', array_fill(0, count($columns), '?'));

    try {
        $pdo->beginTransaction();

        $insertStmt = $pdo->prepare(
            'INSERT INTO permohonan (' . implode(', ', $columns) . ') VALUES (' . $placeholders . ')'
        );
        $insertStmt->execute(array_values($insertData));
        $permohonanId = (int) $pdo->lastInsertId();

        $detailStmt = $pdo->prepare(<<<'SQL'
            INSERT INTO penilai_permohonan 
                (permohonan_id, jenis_penilai, tahun_pengalaman, kelayakan, sijil_kursus_url, sijil_kesihatan_url, catatan)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        SQL);
        $detailStmt->execute([
            $permohonanId,
            $jenisPenilai,
            $tahunPengalaman,
            $kelayakan,
            $sijilKursusUrl,
            $sijilKesihatanUrl,
            $catatan !== '' ? $catatan : null,
        ]);

        $notifStmt = $pdo->prepare(<<<'SQL'
            INSERT INTO notifications (user_id, permohonan_id, type, subject, message, created_at)
            VALUES (?, ?, 'Permohonan Diterima', 'Permohonan Penilai Diterima', 'Permohonan anda sedang disemak oleh pentadbir.', NOW())
        SQL);
        $notifStmt->execute([$userId, $permohonanId]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    jsonResponse([
        'error' => false,
        'message' => 'Permohonan penilai berjaya dihantar.',
        'application_id' => $permohonanId,
    ], 201);
}

function formatPenilaiPermohonanRow(array $row): array
{
    $tarikh = $row['tarikh_hantar'] ?? null;
    $kemaskini = $row['status_kemaskini'] ?? null;
    $statusWorkflow = $row['status_workflow'] ?? '';
    $status = $row['status'] ?? 'Pending';

    return [
        'id' => (int) ($row['id'] ?? 0),
        'tahun_permohonan' => (int) ($row['tahun_permohonan'] ?? 0),
        'nama_penuh' => $row['nama_penuh'] ?? null,
        'emel' => $row['emel'] ?? null,
        'no_telefon' => $row['no_telefon'] ?? null,
        'status' => $status,
        'status_workflow' => $statusWorkflow,
        'status_label' => mapStatusLabel($status, $statusWorkflow),
        'tarikh_permohonan' => $tarikh,
        'kemaskini_terakhir' => $kemaskini,
        'admin_notes' => $row['admin_notes'] ?? null,
        'jenis_penilai' => $row['jenis_penilai'] ?? null,
        'tahun_pengalaman' => isset($row['tahun_pengalaman']) ? (int) $row['tahun_pengalaman'] : null,
        'kelayakan' => $row['kelayakan'] ?? null,
        'dokumen' => [
            'sijil_kursus' => $row['sijil_kursus_url'] ?? null,
            'sijil_kesihatan' => $row['sijil_kesihatan_url'] ?? null,
        ],
        'catatan' => $row['catatan'] ?? null,
    ];
}

function mapStatusLabel(string $status, string $workflow): string
{
    if ($status === 'Approved' || $workflow === 'Lengkap') {
        return 'Diluluskan';
    }
    if ($status === 'Rejected' || $workflow === 'Ditolak') {
        return 'Ditolak';
    }
    if ($workflow === 'Menunggu Admin') {
        return 'Menunggu Admin';
    }
    return 'Sedang Diproses';
}

function uploadSupportingDocument(?array $file, string $prefix): string
{
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        throw new InvalidArgumentException('Dokumen sokongan diperlukan.');
    }

    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Gagal memuat naik dokumen: ' . ($file['error'] ?? 'Tidak diketahui'));
    }

    $maxSize = 5 * 1024 * 1024; // 5MB
    if (($file['size'] ?? 0) > $maxSize) {
        throw new RuntimeException('Saiz dokumen melebihi 5MB.');
    }

    $allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    $originalExt = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
    if (!in_array($originalExt, $allowedExtensions, true)) {
        throw new RuntimeException('Format dokumen tidak disokong. Gunakan PDF atau imej (JPG/PNG).');
    }

    $uploadsDir = realpath(__DIR__ . '/../uploads');
    if ($uploadsDir === false) {
        $uploadsDir = __DIR__ . '/../uploads';
    }

    $targetDir = $uploadsDir . '/penilai_permohonan';
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0775, true);
    }

    $filename = sprintf('%s_%s.%s', $prefix, bin2hex(random_bytes(8)), $originalExt);
    $destination = $targetDir . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'] ?? '', $destination)) {
        throw new RuntimeException('Tidak dapat menyimpan dokumen sokongan.');
    }

    return '/uploads/penilai_permohonan/' . $filename;
}
