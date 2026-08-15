<?php



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



$method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';



if ($method !== 'GET' && $method !== 'CLI') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



$method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';



if ($method !== 'GET' && $method !== 'CLI') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



handleDownload();



function handleDownload(): void

{

    global $method;

    requireAdmin();



    $year = isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y');
    $currentYear = (int) date('Y');

    // For CLI testing, allow year parameter
    if ($method === 'CLI') {
        $year = isset($GLOBALS['test_year']) ? (int) $GLOBALS['test_year'] : $year;
    }

    // Validate year range (3 years back, 3 years forward)
    if ($year < ($currentYear - 3) || $year > ($currentYear + 3)) {
        jsonResponse(['error' => true, 'message' => 'Tahun tidak sah.'], 422);
    }

    // Support type param: pengadil_berdaftar (default) or penilai_berdaftar (RA)
    $allowedTypes = ['pengadil_berdaftar', 'penilai_berdaftar'];
    $type = isset($_GET['type']) && in_array($_GET['type'], $allowedTypes, true) ? $_GET['type'] : 'pengadil_berdaftar';

    if ($type === 'penilai_berdaftar') {
        // Semua PP Daerah juga RA secara automatik, tanpa permohonan tahunan.
        $roleCondition = "AND (
            u.role = 'PP Daerah'
            OR a.jenis_pengadil IN ('Penilai Pengadil', 'Pegawai Pembangunan')
        )";
        $typeLabel = 'RA';
    } else {
        $roleCondition = "AND a.id IS NOT NULL
            AND (a.jenis_pengadil NOT IN ('Penilai Pengadil', 'Pegawai Pembangunan') OR a.jenis_pengadil IS NULL)";
        $typeLabel = 'pengadil';
    }

    try {
        $pdo = getDbConnection();

        $sql = <<<SQL
            SELECT DISTINCT
                u.id as user_id,
                u.nama_penuh,
                u.no_ic as no_kp,
                u.jantina,
                u.email as emel,
                u.no_telefon,
                u.saiz_baju,
                CASE WHEN u.role = 'PP Daerah' THEN 'Penilai Pengadil'
                     ELSE COALESCE(a.jenis_pengadil, u.jenis_pengadil) END AS jenis_pengadil,
                COALESCE(a.alamat1, u.alamat1) AS alamat1,
                COALESCE(a.alamat2, u.alamat2) AS alamat2,
                COALESCE(a.poskod, u.poskod) AS poskod,
                COALESCE(a.daerah, u.daerah) AS daerah,
                COALESCE(a.negeri, u.negeri) AS negeri,
                COALESCE(a.status_kerja, u.status_kerja) AS status_kerja,
                COALESCE(a.jawatan, u.jawatan) AS jawatan,
                COALESCE(a.nama_majikan, u.nama_majikan) AS nama_majikan,
                COALESCE(a.nama_waris, u.nama_waris) AS nama_waris,
                COALESCE(a.hubungan_waris, u.hubungan_waris) AS hubungan_waris,
                COALESCE(a.telefon_waris, u.telefon_waris) AS telefon_waris,
                p.nama_persatuan as persatuan
            FROM users u
            LEFT JOIN permohonan a ON u.id = a.user_id
                AND a.jenis_borang IN ('pengadil_berdaftar', 'penilai_berdaftar')
                AND a.status = 'Approved'
                AND (
                    (a.status_kemaskini IS NOT NULL AND YEAR(a.status_kemaskini) = :year)
                    OR (a.status_kemaskini IS NULL AND YEAR(a.tarikh_hantar) = :year)
                )
            LEFT JOIN persatuan_bolasepak_daerah p ON p.id = COALESCE(a.persatuan_id, u.persatuan_id)
            WHERE 1 = 1
            {$roleCondition}
            ORDER BY u.nama_penuh ASC
        SQL;

        $stmt = $pdo->prepare($sql);
        $stmt->execute([':year' => $year]);
        $records = $stmt->fetchAll();

        // Generate CSV content
        $csvContent = generateCSV($records, $year);

        // Set headers for file download
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="senarai-' . $typeLabel . '-' . $year . '.csv"');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Pragma: public');

        echo $csvContent;
        exit;

    } catch (Throwable $e) {
        error_log('[download-referees-excel.php] handleDownload: ' . $e->getMessage());
        $message = APP_DEBUG ? 'Ralat semasa menjana fail Excel: ' . $e->getMessage() : 'Ralat semasa menjana fail Excel.';
        jsonResponse(['error' => true, 'message' => $message], 500);
    }
}



function generateCSV(array $records, int $year): string
{
    $headers = [
        'Bil',
        'Nama Penuh',
        'No. K/P',
        'Jantina',
        'Umur',
        'Jenis Pengadil',
        'Persatuan Bola Sepak Daerah',
        'Emel',
        'No. Telefon',
        'Alamat 1',
        'Alamat 2',
        'Poskod',
        'Daerah',
        'Negeri',
        'Saiz Baju',
        'Status Kerja',
        'Jawatan',
        'Nama Majikan',
        'Nama Waris',
        'Hubungan Waris',
        'Telefon Waris',
    ];

    $csvLines = [];
    $csvLines[] = implode(',', array_map('escapeCSV', $headers));

    foreach ($records as $index => $record) {
        $umur = calculateUmurFromIC($record['no_kp'] ?? '');
        $jantina = strtoupper($record['jantina'] ?? '') === 'LELAKI' ? 'Lelaki' :
                   (strtoupper($record['jantina'] ?? '') === 'PEREMPUAN' ? 'Perempuan' : ($record['jantina'] ?? ''));

        $row = [
            $index + 1,
            $record['nama_penuh'] ?? '',
            $record['no_kp'] ?? '',
            $jantina,
            $umur !== null ? $umur : '',
            $record['jenis_pengadil'] ?? '',
            $record['persatuan'] ?? '',
            $record['emel'] ?? '',
            $record['no_telefon'] ?? '',
            $record['alamat1'] ?? '',
            $record['alamat2'] ?? '',
            $record['poskod'] ?? '',
            $record['daerah'] ?? '',
            $record['negeri'] ?? '',
            $record['saiz_baju'] ?? '',
            $record['status_kerja'] ?? '',
            $record['jawatan'] ?? '',
            $record['nama_majikan'] ?? '',
            $record['nama_waris'] ?? '',
            $record['hubungan_waris'] ?? '',
            $record['telefon_waris'] ?? '',
        ];

        $csvLines[] = implode(',', array_map('escapeCSV', $row));
    }

    return implode("\n", $csvLines);
}

function calculateUmurFromIC(string $noKp): ?int
{
    $ic = preg_replace('/[^0-9]/', '', $noKp);
    if (strlen($ic) < 6) return null;
    $yy = (int) substr($ic, 0, 2);
    $mm = (int) substr($ic, 2, 2);
    $dd = (int) substr($ic, 4, 2);
    $currentYear2d = (int) date('y');
    $fullYear = $yy > $currentYear2d ? 1900 + $yy : 2000 + $yy;
    $age = (int) date('Y') - $fullYear;
    if ((int) date('m') < $mm || ((int) date('m') === $mm && (int) date('d') < $dd)) $age--;
    return $age >= 0 && $age < 150 ? $age : null;
}

function escapeCSV(mixed $value): string
{
    $value = (string) $value;
    if (strpos($value, ',') !== false || strpos($value, '"') !== false || strpos($value, "\n") !== false) {
        return '"' . str_replace('"', '""', $value) . '"';
    }
    return $value;
}
