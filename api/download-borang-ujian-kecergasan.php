<?php
/**
 * Download Borang Ujian Kecergasan PDF
 * Generates PDF for approved fitness test applications
 */

require_once 'bootstrap.php';

// Check if user is logged in as Pengadil
if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'Pengadil') {
    http_response_code(403);
    echo 'Akses ditolak - hanya Pengadil sahaja';
    exit;
}

$user_id = $_SESSION['user_id'];
$application_id = $_GET['id'] ?? null;

if (!$application_id) {
    http_response_code(400);
    echo 'ID permohonan diperlukan';
    exit;
}

try {
    $pdo = getDbConnection();
    
    // Get application details from permohonan table
    $query = "SELECT p.* 
              FROM permohonan p
              WHERE p.id = :id 
                AND p.user_id = :user_id 
                AND p.jenis_borang = 'ujian_kecergasan'
              LIMIT 1";

    $stmt = $pdo->prepare($query);
    $stmt->execute(['id' => $application_id, 'user_id' => $user_id]);
    $application = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$application) {
        http_response_code(404);
        echo 'Permohonan tidak dijumpai';
        exit;
    }

    // Generate HTML content for the form (ready for browser print to PDF)
    $html = generateFitnessTestFormHTML($application);
    
    // Output HTML directly - user will use browser Print to PDF
    header('Content-Type: text/html; charset=utf-8');
    echo $html;

} catch (Exception $e) {
    error_log('Download Borang Ujian Kecergasan Error: ' . $e->getMessage());
    http_response_code(500);
    echo 'Ralat dalaman server';
}

function generateFitnessTestFormHTML($data) {
    $current_year = date('Y');

    $html = '
<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <title>Borang Ujian Kecergasan R4 - ' . htmlspecialchars($data['nama_penuh']) . '</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
            @page { margin: 1cm; }
        }
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .form-section { margin-bottom: 20px; page-break-inside: avoid; }
        .form-row { display: flex; margin-bottom: 10px; }
        .form-label { width: 200px; font-weight: bold; }
        .form-value { flex: 1; border-bottom: 1px solid #000; padding: 5px; }
        .declaration { margin-top: 30px; font-size: 12px; }
        .declaration-item { margin-bottom: 15px; page-break-inside: avoid; }
        .checkbox { display: inline-block; width: 20px; height: 20px; border: 1px solid #000; margin-right: 10px; vertical-align: middle; }
        .signature-section { margin-top: 50px; page-break-inside: avoid; }
        .signature-box { border: 1px solid #000; width: 300px; height: 100px; margin-top: 20px; }
        .print-button { 
            position: fixed; 
            top: 20px; 
            right: 20px; 
            padding: 15px 30px; 
            background: #2563eb; 
            color: white; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        .print-button:hover { background: #1d4ed8; }
    </style>
    <script>
        window.onload = function() {
            // Show print dialog after 500ms delay
            setTimeout(function() {
                window.print();
            }, 500);
        }
    </script>
</head>
<body>
    <button onclick="window.print()" class="print-button no-print">🖨️ Cetak / Simpan PDF</button>

    <div class="header">
        <h1>PERSATUAN BOLASEPAK NEGERI PAHANG</h1>
        <h2>BORANG PERMOHONAN UJIAN KECERGASAN (R4)</h2>
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
            <div class="form-value">' . htmlspecialchars($data['no_kp']) . '</div>
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
        <h3>DEKLARASI KESIHATAN DAN PELEPASAN TANGGUNGAN (INDEMNITI) PENGADIL</h3>
        <p>Saya seperti nama di atas, dengan ini secara sukarela bersetuju untuk mengambil bahagian dalam Ujian Kecergasan Fizikal anjuran Persatuan Bolasepak Negeri Pahang (PBNP) bagi melayakkan saya berdaftar dan bergiat aktif sebagai Pengadil Bolasepak untuk musim [Tahun/Musim].</p>

        <div class="declaration-item">
            <div class="checkbox"></div>
            <strong>Status Kesihatan:</strong> Saya berada dalam keadaan kesihatan fizikal dan mental yang baik. Saya tidak menghidap sebarang penyakit kronik, kecederaan, atau masalah perubatan yang boleh memudaratkan diri saya jika melakukan aktiviti fizikal berintensiti tinggi.
        </div>

        <div class="declaration-item">
            <div class="checkbox"></div>
            <strong>Pemeriksaan Perubatan:</strong> Saya telah menjalani pemeriksaan kesihatan/perubatan dan disahkan "Lulus" atau "Fit to Participate" oleh Pegawai Perubatan bertauliah untuk menyertai ujian ini.
        </div>

        <div class="declaration-item">
            <div class="checkbox"></div>
            <strong>Risiko:</strong> Saya sedar dan memahami bahawa ujian kecergasan ini melibatkan aktiviti fizikal yang berat dan mempunyai risiko kecederaan atau kejadian yang tidak diingini.
        </div>

        <div class="declaration-item">
            <div class="checkbox"></div>
            <strong>Pelepasan Tanggungan:</strong> Saya dan waris/keluarga saya bersetuju untuk TIDAK AKAN mengambil sebarang tindakan undang-undang atau membuat sebarang tuntutan terhadap Persatuan Bolasepak Negeri Pahang (PBNP), pegawai bertugas, atau wakil mereka sekiranya berlaku sebarang kecederaan, kemalangan, kehilangan upaya, atau kematian ke atas diri saya semasa atau selepas ujian ini dijalankan, yang berpunca daripada penyertaan saya.
        </div>

        <div class="declaration-item">
            <div class="checkbox"></div>
            <strong>Kebenaran Rawatan:</strong> Saya membenarkan pihak penganjur untuk memberikan bantuan kecemasan awal sekiranya perlu.
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
                <p style="margin-top: 10px;">Tandatangan Saksi</p>
                <p>Tarikh: ________________</p>
            </div>

            <div>
                <div class="signature-box"></div>
                <p style="margin-top: 10px;">Tandatangan Doktor</p>
                <p>Tarikh: ________________</p>
            </div>
        </div>
    </div>

    <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #666;">
        <p>Nota: Sila bawa borang ini yang telah ditandatangani ke ujian kecergasan</p>
    </div>

</body>
</html>';

    return $html;
}
?>