<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/../vendor/tcpdf.php');

// Get application ID from query string
$application_id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$type = isset($_GET['type']) ? $_GET['type'] : 'r1';

error_log("Download referee form: id=$application_id, type=$type");

if ($application_id === 0) {
    header("HTTP/1.1 400 Bad Request");
    die('Invalid application ID.');
}

$pdo = getDbConnection();

// Fetch application data from the database
// This query joins permohonan with users to get all necessary data
$stmt = $pdo->prepare(
    "SELECT p.*, u.nama_penuh as user_nama_penuh, u.email as user_email, u.url_gambar_profil as user_gambar_profil, \n"
    . "u.no_ic, u.no_telefon, u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri, u.status_kerja, u.jawatan, \n"
    . "u.nama_majikan, u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan, \n"
    . "u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina, u.district_id\n"
    . "FROM permohonan p\n"
    . "LEFT JOIN users u ON p.user_id = u.id\n"
    . "WHERE p.id = ?"
);
$stmt->execute([$application_id]);
$data = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$data) {
    header("HTTP/1.1 404 Not Found");
    die('Application not found.');
}

// For R2 forms, also fetch the district name
if ($type === 'r2' && isset($data['district_id'])) {
    $stmt_district = $pdo->prepare("SELECT nama_persatuan FROM persatuan_bolasepak_daerah WHERE id = ?");
    $stmt_district->execute([$data['district_id']]);
    $district_data = $stmt_district->fetch(PDO::FETCH_ASSOC);
    if ($district_data) {
        $data['district_nama'] = $district_data['nama_persatuan'];
    }
}

// Set the filename based on type
if ($type === 'r1' || $type === 'pendaftaran') {
    $filename = 'Borang_Pendaftaran_' . preg_replace('/[^A-Za-z0-9_\-]/ ', '_', $data['nama_penuh']) . '.pdf';
} elseif ($type === 'r2') {
    $filename = 'Borang_R2_' . preg_replace('/[^A-Za-z0-9_\-]/ ', '_', $data['nama_penuh']) . '.pdf';
} elseif ($type === 'r11') {
    $filename = 'Borang_R11_' . preg_replace('/[^A-Za-z0-9_\-]/ ', '_', $data['nama_penuh']) . '.pdf';
} elseif ($type === 'r4') {
    $filename = 'Borang_R4_' . preg_replace('/[^A-Za-z0-9_\-]/ ', '_', $data['nama_penuh']) . '.pdf';
} else {
    $filename = 'Borang_' . preg_replace('/[^A-Za-z0-9_\-]/ ', '_', $data['nama_penuh']) . '.pdf';
}

// Set headers for PDF download
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: private, max-age=0, must-revalidate');
header('Pragma: public');

// Create new PDF document
$pdf = new TCPDF(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);

// remove default header/footer
$pdf->setPrintHeader(false);
$pdf->setPrintFooter(false);

// Set default monospaced font
$pdf->SetDefaultMonospacedFont(PDF_FONT_MONOSPACED);

// Set margins
$pdf->SetMargins(PDF_MARGIN_LEFT, 12, PDF_MARGIN_RIGHT);
$pdf->SetHeaderMargin(0);
$pdf->SetFooterMargin(PDF_MARGIN_FOOTER);

// Set auto page breaks
$pdf->SetAutoPageBreak(TRUE, PDF_MARGIN_BOTTOM);

// Set image scale factor
$pdf->setImageScale(PDF_IMAGE_SCALE_RATIO);

// Add a page
$pdf->AddPage();

if ($type === 'r1' || $type === 'pendaftaran') {
    // Include the R1 template file
    require_once(__DIR__ . '/templates/r1.php');
    // Call a function from r1.php to generate the PDF
    generateR1Pdf($pdf, $data);
} elseif ($type === 'r2') {
    // Include the R2 template file
    require_once(__DIR__ . '/templates/r2.php');
    // Call a function from r2.php to generate the PDF
    generateR2Pdf($pdf, $data, $pdo);
} elseif ($type === 'r11') {
    error_log("Loading r11 template");
    // Include the R11 template file
    require_once(__DIR__ . '/templates/r11.php');
    // Call a function from r11.php to generate the PDF
    generateR11Pdf($pdf, $data);
} elseif ($type === 'r4') {
    // Include the R4 template file
    require_once(__DIR__ . '/templates/r4.php');
    // Call a function from r4.php to generate the PDF
    generateR4Pdf($pdf, $data);
} else {
    // Logic for other form types is not implemented yet.
    error_log("Type not implemented: $type");
    header("HTTP/1.1 501 Not Implemented");
    die("Form type '" . htmlspecialchars($type) . "' is not yet implemented.");
}

// Close and output PDF document
$pdf->Output($filename, 'I');

?>
