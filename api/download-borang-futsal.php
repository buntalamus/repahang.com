<?php
// Include bootstrap for session and database
require_once __DIR__ . '/bootstrap.php';

// Check if user is logged in
if (!isset($_SESSION['user_id']) || !in_array($_SESSION['user_role'] ?? '', ['Pengadil', 'PP Daerah', 'Admin'], true)) {
    http_response_code(403);
    echo 'Akses ditolak';
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    $pdo = getDbConnection();

    // Query for approved futsal referee application
    $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                     u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                     u.status_kerja, u.jawatan, u.nama_majikan,
                     u.nama_waris, u.hubungan_waris, u.telefon_waris,
                     u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina
              FROM permohonan p
              JOIN users u ON p.user_id = u.id
              WHERE p.user_id = ? AND p.jenis_borang = 'pengadil_futsal' AND p.status = 'approved'
              ORDER BY p.created_at DESC LIMIT 1";

    $stmt = $pdo->prepare($query);
    $stmt->execute([$user_id]);
    $application = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$application) {
        http_response_code(403);
        echo 'Permohonan pengadil futsal belum diluluskan atau tidak wujud';
        exit;
    }

    // Generate filename
    $filename = 'Borang_Pendaftaran_Pengadil_Futsal_R3_' . date('Y-m-d') . '.pdf';

    // Set headers for PDF download
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');

    // Generate HTML content for the futsal referee form
    $html = generateFutsalRefereeFormHTML($application);

    // For demonstration, we'll output HTML. In production, use a proper PDF library like TCPDF
    echo $html;

} catch (Exception $e) {
    error_log('Download Borang Futsal Error: ' . $e->getMessage());
    http_response_code(500);
    echo 'Ralat dalaman server';
}

function generateFutsalRefereeFormHTML($data) {
    $current_year = date('Y');

    $html = '
<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <title>Borang Pendaftaran Pengadil Futsal R3</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .form-section { margin-bottom: 20px; }
        .form-row { display: flex; margin-bottom: 10px; }
        .form-label { width: 200px; font-weight: bold; }
        .form-value { flex: 1; border-bottom: 1px solid #000; padding: 5px; }
        .signature-section { margin-top: 50px; }
        .signature-box { border: 1px solid #000; width: 300px; height: 100px; margin-top: 20px; }
        .declaration { margin-top: 30px; font-size: 12px; }
    </style>
</head>
<body>

    <div class="header">
        <h1>PERSATUAN BOLASEPAK NEGERI PAHANG</h1>
        <h2>BORANG PENDAFTARAN PENGADIL FUTSAL (R3)</h2>
        <p>Tahun: ' . $current_year . '</p>
    </div>

    <div class="form-section">
        <h3>Maklumat Peribadi</h3>

        <div class="form-row">
            <div class="form-label">Nama Penuh:</div>
            <div class="form-value">' . htmlspecialchars($data['nama_penuh']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">No. Kad Pengenalan:</div>
            <div class="form-value">' . htmlspecialchars($data['no_ic']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Emel:</div>
            <div class="form-value">' . htmlspecialchars($data['email']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">No. Telefon:</div>
            <div class="form-value">' . htmlspecialchars($data['no_telefon']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Jantina:</div>
            <div class="form-value">' . htmlspecialchars($data['jantina']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Jenis Pengadil:</div>
            <div class="form-value">' . htmlspecialchars($data['jenis_pengadil'] ?? 'Pengadil Futsal') . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Tahun Mula Aktif:</div>
            <div class="form-value">' . htmlspecialchars($data['tahun_mula_aktif']) . '</div>
        </div>
    </div>

    <div class="form-section">
        <h3>Alamat Kediaman</h3>

        <div class="form-row">
            <div class="form-label">Alamat 1:</div>
            <div class="form-value">' . htmlspecialchars($data['alamat1']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Alamat 2:</div>
            <div class="form-value">' . htmlspecialchars($data['alamat2'] ?? '') . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Poskod:</div>
            <div class="form-value">' . htmlspecialchars($data['poskod']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Daerah:</div>
            <div class="form-value">' . htmlspecialchars($data['daerah']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Negeri:</div>
            <div class="form-value">' . htmlspecialchars($data['negeri']) . '</div>
        </div>
    </div>

    <div class="form-section">
        <h3>Maklumat Pekerjaan</h3>

        <div class="form-row">
            <div class="form-label">Status Pekerjaan:</div>
            <div class="form-value">' . htmlspecialchars($data['status_kerja']) . '</div>
        </div>';

    if ($data['status_kerja'] !== 'Tidak Bekerja' && $data['status_kerja'] !== 'Pelajar') {
        $html .= '
        <div class="form-row">
            <div class="form-label">Jawatan:</div>
            <div class="form-value">' . htmlspecialchars($data['jawatan'] ?? '') . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Nama Majikan:</div>
            <div class="form-value">' . htmlspecialchars($data['nama_majikan'] ?? '') . '</div>
        </div>';
    }

    $html .= '
    </div>

    <div class="form-section">
        <h3>Waris Terdekat</h3>

        <div class="form-row">
            <div class="form-label">Nama Waris:</div>
            <div class="form-value">' . htmlspecialchars($data['nama_waris']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">Hubungan:</div>
            <div class="form-value">' . htmlspecialchars($data['hubungan_waris']) . '</div>
        </div>

        <div class="form-row">
            <div class="form-label">No. Telefon Waris:</div>
            <div class="form-value">' . htmlspecialchars($data['telefon_waris']) . '</div>
        </div>
    </div>

    <div class="form-section">
        <h3>Maklumat Pengadil Futsal</h3>

        <div class="form-row">
            <div class="form-label">Saiz Baju Rasmi:</div>
            <div class="form-value">' . htmlspecialchars($data['saiz_baju']) . '</div>
        </div>
    </div>

    <div class="signature-section">
        <h3>Tandatangan</h3>
        <p>Saya mengesahkan bahawa semua maklumat di atas adalah benar dan tepat.</p>

        <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div>
                <div class="signature-box"></div>
                <p style="margin-top: 10px;">Tandatangan Pemohon</p>
                <p>Tarikh: ________________</p>
            </div>

            <div>
                <div class="signature-box"></div>
                <p style="margin-top: 10px;">Tandatangan PP Daerah</p>
                <p>Tarikh: ________________</p>
            </div>
        </div>
    </div>

    <div class="declaration">
        <h4>Perakuan</h4>
        <ol>
            <li>Saya mengesahkan bahawa semua maklumat pengadil futsal adalah benar dan tepat.</li>
            <li>Saya faham bahawa sebarang maklumat palsu boleh menyebabkan permohonan pengadil futsal dibatalkan.</li>
            <li>Pengadil telah membuat bayaran sebanyak RM80.00 dan resit telah dimuat naik.</li>
        </ol>
    </div>

</body>
</html>';

    return $html;
}
?>