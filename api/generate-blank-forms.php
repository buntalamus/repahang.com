<?php
/**
 * Script sementara untuk jana borang kosong (preview sahaja)
 * Jalankan: php api/generate-blank-forms.php
 */
declare(strict_types=1);

require_once __DIR__ . '/../vendor/tcpdf.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/templates/r1.php';
require_once __DIR__ . '/templates/r2.php';
require_once __DIR__ . '/templates/r4.php';
require_once __DIR__ . '/templates/r11.php';

// CLI fix: set DOCUMENT_ROOT for logo paths
if (php_sapi_name() === 'cli') {
    $_SERVER['DOCUMENT_ROOT'] = dirname(__DIR__);
}

$outputDir = __DIR__ . '/../storage/preview';
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0755, true);
}

// Data kosong untuk preview
$blankData = [
    'id' => 0,
    'nama_penuh' => '',
    'user_nama_penuh' => '',
    'user_email' => '',
    'no_ic' => '',
    'no_kp' => '',
    'no_telefon' => '',
    'alamat1' => '',
    'alamat2' => '',
    'poskod' => '',
    'daerah' => '',
    'negeri' => '',
    'status_kerja' => '',
    'jawatan' => '',
    'nama_majikan' => '',
    'alamat_majikan1' => '',
    'alamat_majikan2' => '',
    'poskod_majikan' => '',
    'daerah_majikan' => '',
    'negeri_majikan' => '',
    'nama_waris' => '',
    'hubungan_waris' => '',
    'telefon_waris' => '',
    'jenis_pengadil' => '',
    'tahun_mula_aktif' => '',
    'saiz_baju' => '',
    'jantina' => '',
    'umur' => '',
    'tarikh_lahir' => '',
    'tempat_lahir' => '',
    'tahun_permohonan' => date('Y'),
    'tahun_lulus_kelas3' => '',
    'district_id' => 0,
    'district_nama' => '',
    'pp_daerah_nama' => '',
    'pp_telefon' => '',
    'pp_emel' => '',
];

// --- R1 ---
echo "Menjana Borang R1...\n";
$pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
$pdf->AddPage();
generateR1Pdf($pdf, $blankData);
$pdf->Output($outputDir . '/Borang_R1_Kosong.pdf', 'F');
echo "  -> $outputDir/Borang_R1_Kosong.pdf\n";

// --- R2 (perlu $pdo - buat mock PDOStatement) ---
echo "Menjana Borang R2...\n";
// Create a mock PDO that returns empty results
$mockStmt = new class {
    public function execute($params = []) { return true; }
    public function fetchAll($mode = 0) { return []; }
    public function fetch($mode = 0) { return false; }
};
$mockPdo = new class($mockStmt) {
    private $stmt;
    public function __construct($stmt) { $this->stmt = $stmt; }
    public function prepare($query) { return $this->stmt; }
};
$pdf2 = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
$pdf2->AddPage();
generateR2Pdf($pdf2, $blankData, $mockPdo);
$pdf2->Output($outputDir . '/Borang_R2_Kosong.pdf', 'F');
echo "  -> $outputDir/Borang_R2_Kosong.pdf\n";

// --- R4 ---
echo "Menjana Borang Ujian Kecergasan (R4)...\n";
$pdf5 = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
$pdf5->AddPage();
generateR4Pdf($pdf5, $blankData);
$pdf5->Output($outputDir . '/Borang_Kecergasan_Kosong.pdf', 'F');
echo "  -> $outputDir/Borang_Kecergasan_Kosong.pdf\n";

echo "\nSemua borang telah dijana di: $outputDir/\n";

// --- R11 Kelas III ---
echo "Menjana Borang R-11 Kelas III...\n";
$pdf6 = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
$pdf6->AddPage();
generateR11Pdf($pdf6, $blankData, 'III');
$pdf6->Output($outputDir . '/Borang_R11_KelasIII_Kosong.pdf', 'F');
echo "  -> $outputDir/Borang_R11_KelasIII_Kosong.pdf\n";

// --- R11 Kelas I ---
echo "Menjana Borang R-11 Kelas I...\n";
$pdf7 = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
$pdf7->AddPage();
generateR11Pdf($pdf7, $blankData, 'I');
$pdf7->Output($outputDir . '/Borang_R11_KelasI_Kosong.pdf', 'F');
echo "  -> $outputDir/Borang_R11_KelasI_Kosong.pdf\n";

echo "\nSelesai. Semua borang di: $outputDir/\n";
