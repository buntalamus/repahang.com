<?php
// Include bootstrap for session and database
require_once __DIR__ . '/bootstrap.php';

// Check if user is logged in and is PP Daerah
if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'PP Daerah') {
    http_response_code(403);
    echo 'Akses ditolak - hanya PP Daerah sahaja';
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    $pdo = getDbConnection();

    // Get application_id parameter
    $application_id = isset($_GET['application_id']) ? (int)$_GET['application_id'] : null;

    // Check if written test application is approved
    if ($application_id) {
        $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.no_telefon,
                         u.nama_waris, u.hubungan_waris, u.telefon_waris
                  FROM permohonan_ujian_bertulis p
                  JOIN users u ON p.user_id = u.id
                  WHERE p.id = ? AND p.user_id = ? AND p.jenis_permohonan = 'ujian_bertulis' AND p.status = 'approved'";
        $stmt = $pdo->prepare($query);
        $stmt->execute([$application_id, $user_id]);
    } else {
        $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.no_telefon,
                         u.nama_waris, u.hubungan_waris, u.telefon_waris
                  FROM permohonan_ujian_bertulis p
                  JOIN users u ON p.user_id = u.id
                  WHERE p.user_id = ? AND p.jenis_permohonan = 'ujian_bertulis' AND p.status = 'approved'
                  ORDER BY p.created_at DESC LIMIT 1";
        $stmt = $pdo->prepare($query);
        $stmt->execute([$user_id]);
    }

    $application = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$application) {
        http_response_code(403);
        echo 'Permohonan ujian bertulis belum diluluskan atau tidak wujud';
        exit;
    }

    // Set headers for PDF download
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="Borang_Ujian_Bertulis_' . date('Y-m-d') . '.pdf"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');

    // Generate HTML content for the form
    $html = generateWrittenTestFormHTML($application);

    // For demonstration, we'll output HTML. In production, use a proper PDF library like TCPDF
    echo $html;

} catch (Exception $e) {
    error_log('Download Borang Ujian Bertulis Error: ' . $e->getMessage());
    http_response_code(500);
    echo 'Ralat dalaman server';
}

function generateWrittenTestFormHTML($data) {
    $current_year = date('Y');

    $html = '
<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <title>Borang Ujian Bertulis</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .form-section { margin-bottom: 20px; }
        .form-row { display: flex; margin-bottom: 10px; }
        .form-label { width: 200px; font-weight: bold; }
        .form-value { flex: 1; border-bottom: 1px solid #000; padding: 5px; }
        .declaration { margin-top: 30px; font-size: 12px; }
        .declaration-item { margin-bottom: 15px; }
        .checkbox { display: inline-block; width: 20px; height: 20px; border: 1px solid #000; margin-right: 10px; }
        .signature-section { margin-top: 50px; }
        .signature-box { border: 1px solid #000; width: 300px; height: 100px; margin-top: 20px; }
        .exam-info { background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-left: 4px solid #007bff; }
    </style>
</head>
<body>

    <div class="header">
        <h1>PERSATUAN BOLASEPAK NEGERI PAHANG</h1>
        <h2>BORANG PERMOHONAN UJIAN BERTULIS</h2>
        <p>Tahun: ' . $current_year . '</p>
    </div>

    <div class="exam-info">
        <h3>Maklumat Ujian</h3>
        <p><strong>Tarikh Ujian:</strong> ________________</p>
        <p><strong>Masa:</strong> ________________</p>
        <p><strong>Tempat:</strong> ________________</p>
        <p><strong>Format:</strong> Ujian bertulis meliputi peraturan permainan, undang-undang, dan pengetahuan pengadilan bolasepak</p>
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
            <div class="form-label">No. Telefon:</div>
            <div class="form-value">' . htmlspecialchars($data['no_telefon']) . '</div>
        </div>
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

    <div class="declaration">
        <h3>Perakuan</h3>

        <div class="declaration-item">
            <div class="checkbox"></div>
            <strong>Pemahaman Peraturan:</strong> Saya telah mempelajari dan memahami peraturan-peraturan permainan bolasepak serta undang-undang yang berkaitan dengan pengadilan.
        </div>

        <div class="declaration-item">
            <div class="checkbox"></div>
            <strong>Komitmen:</strong> Saya komited untuk mengikuti ujian bertulis ini dengan jujur dan memberikan jawapan terbaik mengikut pengetahuan saya.
        </div>

        <div class="declaration-item">
            <div class="checkbox"></div>
            <strong>Risiko:</strong> Saya sedar dan memahami bahawa ujian bertulis ini adalah sebahagian daripada proses pensijilan pengadil dan keputusan akan mempengaruhi status pengadilan saya.
        </div>
    </div>

    <div class="signature-section">
        <h3>Tandatangan</h3>

        <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div>
                <div class="signature-box"></div>
                <p style="margin-top: 10px;">Tandatangan Pemohon</p>
                <p>Tarikh: ________________</p>
            </div>

            <div>
                <div class="signature-box"></div>
                <p style="margin-top: 10px;">Tandatangan Pemeriksa</p>
                <p>Tarikh: ________________</p>
            </div>
        </div>
    </div>

    <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #666;">
        <p>Nota: Sila bawa borang ini yang telah ditandatangani ke ujian bertulis</p>
        <p>Pastikan anda membawa pen dan kad pengenalan pada hari ujian</p>
    </div>

</body>
</html>';

    return $html;
}
?>