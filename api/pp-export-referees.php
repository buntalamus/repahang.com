<?php

/**

 * PP Daerah Export Referees to Excel

 * Export referees in PP's district to CSV

 */



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



// Require PP Daerah role

$currentUser = requireRole(['PP Daerah']);



$method = $_SERVER['REQUEST_METHOD'];



if ($method !== 'GET') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



handleDownload();



function handleDownload(): void

{

    global $currentUser;



    try {

        $pdo = getDbConnection();



        // Check if PP has persatuan assigned

        if (!isset($currentUser['persatuan_id']) || !$currentUser['persatuan_id']) {

            jsonResponse(['error' => true, 'message' => 'Persatuan not assigned to your account.'], 403);

        }

        
        $type = $_GET['type'] ?? '';
        // Map tab key to jenis_borang
        $typeMap = [
            'berdaftar' => 'pengadil_berdaftar',
            'futsal' => 'pengadil_futsal',
            'kecergasan' => 'ujian_kecergasan',
            'bertulis' => 'ujian_bertulis',
            'kelas1' => 'ujian_kelas1_fam',
        ];
        $jenisBorang = $typeMap[$type] ?? '';

        $persatuanId = $currentUser['persatuan_id'];

        // Get referees in district with application stats

        $refereesStmt = $pdo->prepare("

            SELECT

                u.id,

                u.email,

                u.nama_penuh,

                u.no_ic,

                u.no_telefon,

                u.jenis_pengadil,

                u.aktif,

                u.created_at,

                u.last_login,

                COUNT(p.id) as total_permohonan,

                COUNT(CASE WHEN p.status = 'Approved' OR p.status_workflow = 'Lengkap' THEN 1 END) as permohonan_lulus,

                COUNT(CASE WHEN p.status_workflow = 'Lengkap' THEN 1 END) as permohonan_lengkap,

                MAX(p.tarikh_hantar) as permohonan_terakhir

            FROM users u

            LEFT JOIN permohonan p ON u.id = p.user_id AND (:jenis_borang = '' OR p.jenis_borang = :jenis_borang2)

            WHERE u.role = 'Pengadil'

            AND u.persatuan_id = :persatuan_id

            GROUP BY u.id

            ORDER BY u.nama_penuh ASC

        ");



        $refereesStmt->execute([':persatuan_id' => $persatuanId, ':jenis_borang' => $jenisBorang, ':jenis_borang2' => $jenisBorang]);

        $referees = $refereesStmt->fetchAll(PDO::FETCH_ASSOC);



        // Generate CSV content

        $csvContent = generateCSV($referees);



        // Set headers for file download

        header('Content-Type: text/csv; charset=utf-8');

        header('Content-Disposition: attachment; filename="pengadil-daerah-' . date('Y-m-d') . '.csv"');

        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

        header('Pragma: public');



        // Output CSV content

        echo $csvContent;

        exit;



    } catch (Throwable $e) {

        error_log('[pp-export-referees.php Line ' . $e->getLine() . '] Error: ' . $e->getMessage());

        $message = APP_DEBUG ? 'Error: ' . $e->getMessage() . ' (Line: ' . $e->getLine() . ')' : 'Failed to export referees.';

        jsonResponse(['error' => true, 'message' => $message], 500);

    }

}



function generateCSV(array $referees): string

{

    // CSV headers

    $headers = [

        'Bil',

        'Nama Penuh',

        'Email',

        'No. IC',

        'No. Telefon',

        'Jenis Pengadil',

        'Status',

        'Tarikh Daftar',

        'Log Masuk Terakhir',

        'Jumlah Permohonan',

        'Permohonan Lulus',

        'Permohonan Lengkap'

    ];



    $csvLines = [];

    $csvLines[] = implode(',', array_map('escapeCSV', $headers));



    foreach ($referees as $index => $referee) {

        $row = [

            $index + 1,

            $referee['nama_penuh'] ?? '',

            $referee['email'] ?? '',

            $referee['no_ic'] ?? '',

            $referee['no_telefon'] ?? '',

            $referee['jenis_pengadil'] ?? '',

            $referee['aktif'] == 1 ? 'Aktif' : 'Tidak Aktif',

            $referee['created_at'] ? date('d/m/Y', strtotime($referee['created_at'])) : '',

            $referee['last_login'] ? date('d/m/Y H:i', strtotime($referee['last_login'])) : '',

            $referee['total_permohonan'] ?? 0,

            $referee['permohonan_lulus'] ?? 0,

            $referee['permohonan_lengkap'] ?? 0

        ];



        $csvLines[] = implode(',', array_map('escapeCSV', $row));

    }



    return implode("\n", $csvLines);

}



function escapeCSV(mixed $value): string

{

    $value = (string) $value;

    // Escape quotes and wrap in quotes if contains comma, quote, or newline

    if (strpos($value, ',') !== false || strpos($value, '"') !== false || strpos($value, "\n") !== false) {

        return '"' . str_replace('"', '""', $value) . '"';

    }

    return $value;

}