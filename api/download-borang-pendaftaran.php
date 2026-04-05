<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../vendor/tcpdf.php';
require_once __DIR__ . '/templates/r1.php';
require_once __DIR__ . '/templates/r2.php';
require_once __DIR__ . '/templates/r11.php';
require_once __DIR__ . '/templates/r4.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
}

// Check if user is logged in and is PP Daerah
$user = requireAuth();

if ($user['role'] !== 'PP Daerah') {
    jsonResponse(['error' => true, 'message' => 'Akses ditolak - hanya PP Daerah sahaja'], 403);
}

$user_id = $user['id'];

try {
    // Get the type and application_id parameters
    $type = isset($_GET['type']) ? $_GET['type'] : 'pengadil_berdaftar';
    $application_id = isset($_GET['application_id']) ? (int)$_GET['application_id'] : null;
    $form = isset($_GET['form']) ? $_GET['form'] : null;

    // Define the query based on type
    $query = "";
    $params = [];

    switch ($type) {
        case 'pengadil_berdaftar':
            if ($application_id) {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina, u.url_gambar_profil
                          FROM permohonan p
                          JOIN users u ON p.user_id = u.id
                          WHERE p.id = ? AND (p.user_id = ? OR p.district_id = ?) AND p.jenis_borang = ? AND LOWER(p.status) = 'approved'";
                $params = [$application_id, $user_id, $user['persatuan_id'], 'pengadil_berdaftar'];
            } else {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina, u.url_gambar_profil
                          FROM permohonan p
                          JOIN users u ON p.user_id = u.id
                          WHERE (p.user_id = ? OR p.district_id = ?) AND p.jenis_borang = ? AND LOWER(p.status) = 'approved'
                          ORDER BY p.tarikh_hantar DESC LIMIT 1";
                $params = [$user_id, $user['persatuan_id'], 'pengadil_berdaftar'];
            }
            break;

        case 'pengadil_futsal':
            if ($application_id) {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina
                          FROM permohonan p
                          JOIN users u ON p.user_id = u.id
                          WHERE p.id = ? AND (p.user_id = ? OR p.district_id = ?) AND p.jenis_borang = ? AND LOWER(p.status) = 'approved'";
                $params = [$application_id, $user_id, $user['persatuan_id'], 'pengadil_futsal'];
            } else {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina
                          FROM permohonan p
                          JOIN users u ON p.user_id = u.id
                          WHERE (p.user_id = ? OR p.district_id = ?) AND p.jenis_borang = ? AND LOWER(p.status) = 'approved'
                          ORDER BY p.tarikh_hantar DESC LIMIT 1";
                $params = [$user_id, $user['persatuan_id'], 'pengadil_futsal'];
            }
            break;

        case 'ujian_kecergasan':
            if ($application_id) {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.saiz_baju, u.jantina
                          FROM permohonan p
                          JOIN users u ON p.user_id = u.id
                          WHERE p.id = ? AND (p.user_id = ? OR p.district_id = ?) AND p.jenis_permohonan = ? AND p.workflow_status = 'Approved'";
                $params = [$application_id, $user_id, $user['persatuan_id'], 'ujian_kecergasan'];
            } else {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.saiz_baju, u.jantina
                          FROM permohonan p
                          JOIN users u ON p.user_id = u.id
                          WHERE (p.user_id = ? OR p.district_id = ?) AND p.jenis_permohonan = ? AND p.workflow_status = 'Approved'
                          ORDER BY p.tarikh_hantar DESC LIMIT 1";
                $params = [$user_id, $user['persatuan_id'], 'ujian_kecergasan'];
            }
            break;

        case 'ujian_bertulis':
            if ($application_id) {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina, u.umur,
                                 u.tarikh_lahir, u.tempat_lahir
                          FROM permohonan_ujian_bertulis p
                          JOIN users u ON p.user_id = u.id
                          WHERE p.id = ? AND (p.user_id = ? OR p.persatuan_id = ?) AND p.status = 'Approved'";
                $params = [$application_id, $user_id, $user['persatuan_id']];
            } else {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina, u.umur,
                                 u.tarikh_lahir, u.tempat_lahir
                          FROM permohonan_ujian_bertulis p
                          JOIN users u ON p.user_id = u.id
                          WHERE (p.user_id = ? OR p.persatuan_id = ?) AND p.status = 'Approved'
                          ORDER BY p.id DESC LIMIT 1";
                $params = [$user_id, $user['persatuan_id']];
            }
            break;

        case 'ujian_kelas1':
            if ($application_id) {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina, u.umur,
                                 u.tarikh_lahir, u.tempat_lahir
                          FROM permohonan_ujian_bertulis p
                          JOIN users u ON p.user_id = u.id
                          WHERE p.id = ? AND (p.user_id = ? OR p.persatuan_id = ?) AND p.jenis_permohonan = 'kelas1' AND p.status = 'Approved'";
                $params = [$application_id, $user_id, $user['persatuan_id']];
            } else {
                $query = "SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
                                 u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
                                 u.status_kerja, u.jawatan, u.nama_majikan,
                                 u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan, u.negeri_majikan,
                                 u.nama_waris, u.hubungan_waris, u.telefon_waris,
                                 u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju, u.jantina, u.umur,
                                 u.tarikh_lahir, u.tempat_lahir
                          FROM permohonan_ujian_bertulis p
                          JOIN users u ON p.user_id = u.id
                          WHERE (p.user_id = ? OR p.persatuan_id = ?) AND p.jenis_permohonan = 'kelas1' AND p.status = 'Approved'
                          ORDER BY p.id DESC LIMIT 1";
                $params = [$user_id, $user['persatuan_id']];
            }
            break;

        default:
            jsonResponse(['error' => true, 'message' => 'Jenis borang tidak sah'], 400);
    }

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $application = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$application) {
        jsonResponse(['error' => true, 'message' => 'Permohonan belum diluluskan atau tidak wujud'], 403);
    }

    // Get district info
    $district_id = $application['district_id'] ?? $application['persatuan_id'] ?? $user['persatuan_id'];
    $district_stmt = $pdo->prepare("SELECT nama_persatuan FROM persatuan_bolasepak_daerah WHERE id = ?");
    $district_stmt->execute([$district_id]);
    $district = $district_stmt->fetch(PDO::FETCH_ASSOC);
    $district_nama = $district ? $district['nama_persatuan'] : '';

    // Get PP Daerah info (for R-11 / R-1 sections)
    $pp_stmt = $pdo->prepare("SELECT nama_penuh, no_telefon, email FROM users WHERE role = 'PP Daerah' AND persatuan_id = ? LIMIT 1");
    $pp_stmt->execute([$district_id]);
    $pp_user = $pp_stmt->fetch(PDO::FETCH_ASSOC);
    $pp_daerah_nama = $pp_user['nama_penuh'] ?? ($user['role'] === 'PP Daerah' ? $user['nama_penuh'] : '');
    $pp_telefon     = $pp_user['no_telefon'] ?? ($user['role'] === 'PP Daerah' ? $user['no_telefon'] : '');
    $pp_emel        = $pp_user['email'] ?? ($user['role'] === 'PP Daerah' ? $user['email'] : '');

    // Generate filename based on type
    $filename = "";
    switch ($type) {
        case 'pengadil_berdaftar':
            if ($form === 'r1') {
                $filename = 'Borang_Pendaftaran_Pengadil_R1_' . date('Y-m-d') . '.pdf';
            } elseif ($form === 'r2') {
                $filename = 'Borang_Pendaftaran_Pengadil_R2_' . date('Y-m-d') . '.pdf';
            } else {
                $filename = 'Borang_Pendaftaran_Pengadil_R1_R2_' . date('Y-m-d') . '.pdf';
            }
            break;
        case 'pengadil_futsal':
            $filename = 'Borang_Pendaftaran_Pengadil_Futsal_R11_' . date('Y-m-d') . '.pdf';
            break;
        case 'ujian_kecergasan':
            $filename = 'Borang_Permohonan_Ujian_Kecergasan_R4_' . date('Y-m-d') . '.pdf';
            break;
        case 'ujian_bertulis':
            $filename = 'Borang_R11_KelasIII_' . date('Y-m-d') . '.pdf';
            break;
        case 'ujian_kelas1':
            $filename = 'Borang_R11_KelasI_' . date('Y-m-d') . '.pdf';
            break;
    }

    // Create new PDF document
    $pdf = new TCPDF(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);

    // Set document information
    $pdf->setCreator(PDF_CREATOR);
    $pdf->setAuthor('Persatuan Bolasepak Negeri Pahang');
    $pdf->setTitle('Borang Permohonan');
    $pdf->setSubject('Borang Permohonan');

    // Remove default header/footer
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);

    // Set margins
    $pdf->setMargins(15, 15, 15);

    // Add a page
    $pdf->AddPage();

    // Set font
    $pdf->setFont('helvetica', '', 10);

    // Generate PDF content based on type
    switch ($type) {
        case 'pengadil_berdaftar':
            // Map data to match R1 template expectations
            $mappedData = [
                'id' => $application['id'],
                'nama_penuh' => $application['nama_penuh'],
                'user_nama_penuh' => $application['nama_penuh'],
                'user_email' => $application['email'],
                'no_ic' => $application['no_ic'],
                'no_telefon' => $application['no_telefon'],
                'alamat1' => $application['alamat1'],
                'alamat2' => $application['alamat2'],
                'poskod' => $application['poskod'],
                'daerah' => $application['daerah'],
                'negeri' => $application['negeri'],
                'status_kerja' => $application['status_kerja'],
                'jawatan' => $application['jawatan'],
                'nama_majikan' => $application['nama_majikan'],
                'alamat_majikan1' => $application['alamat_majikan1'],
                'alamat_majikan2' => $application['alamat_majikan2'],
                'poskod_majikan' => $application['poskod_majikan'],
                'daerah_majikan' => $application['daerah_majikan'],
                'negeri_majikan' => $application['negeri_majikan'],
                'nama_waris' => $application['nama_waris'],
                'hubungan_waris' => $application['hubungan_waris'],
                'telefon_waris' => $application['telefon_waris'],
                'jenis_pengadil' => $application['jenis_pengadil'],
                'tahun_mula_aktif' => $application['tahun_mula_aktif'],
                'saiz_baju' => $application['saiz_baju'],
                'jantina' => $application['jantina'],
                'district_id' => $district_id,
                'district_nama' => $district_nama,
                'pp_daerah_nama' => $pp_daerah_nama,
                'pp_telefon'    => $pp_telefon,
                'pp_emel'       => $pp_emel,
            ];

            if ($form === 'r1') {
                generateR1Pdf($pdf, $mappedData);
            } elseif ($form === 'r2') {
                generateR2Pdf($pdf, $mappedData, $pdo);
            } else {
                // Generate both R1 and R2
                generateR1Pdf($pdf, $mappedData);
                $pdf->AddPage(); // Add new page for R2
                generateR2Pdf($pdf, $mappedData, $pdo);
            }
            break;
        case 'pengadil_futsal':
            // Map data to match R11 template expectations
            $mappedData = [
                'id' => $application['id'],
                'nama_penuh' => $application['nama_penuh'],
                'emel' => $application['email'],
                'no_kp' => $application['no_ic'],
                'no_telefon' => $application['no_telefon'],
                'alamat1' => $application['alamat1'],
                'alamat2' => $application['alamat2'],
                'poskod' => $application['poskod'],
                'daerah' => $application['daerah'],
                'negeri' => $application['negeri'],
                'status_kerja' => $application['status_kerja'],
                'jawatan' => $application['jawatan'],
                'nama_majikan' => $application['nama_majikan'],
                'alamat_majikan1' => $application['alamat_majikan1'],
                'alamat_majikan2' => $application['alamat_majikan2'],
                'poskod_majikan' => $application['poskod_majikan'],
                'daerah_majikan' => $application['daerah_majikan'],
                'negeri_majikan' => $application['negeri_majikan'],
                'nama_waris' => $application['nama_waris'],
                'hubungan_waris' => $application['hubungan_waris'],
                'telefon_waris' => $application['telefon_waris'],
                'jenis_pengadil_referee' => $application['jenis_pengadil'],
                'tahun_mula_aktif' => $application['tahun_mula_aktif'],
                'saiz_baju' => $application['saiz_baju'],
                'jantina' => $application['jantina']
            ];
            generateR11Pdf($pdf, $mappedData);
            break;
        case 'ujian_kecergasan':
            // Map data to match R4 template expectations
            $mappedData = [
                'id' => $application['id'],
                'nama_penuh' => $application['nama_penuh'],
                'user_email' => $application['email'],
                'no_kp' => $application['no_ic'],
                'no_telefon' => $application['no_telefon'],
                'alamat1' => $application['alamat1'],
                'alamat2' => $application['alamat2'],
                'poskod' => $application['poskod'],
                'daerah' => $application['daerah'],
                'negeri' => $application['negeri'],
                'status_kerja' => $application['status_kerja'],
                'jawatan' => $application['jawatan'],
                'nama_majikan' => $application['nama_majikan'],
                'alamat_majikan1' => $application['alamat_majikan1'],
                'alamat_majikan2' => $application['alamat_majikan2'],
                'poskod_majikan' => $application['poskod_majikan'],
                'daerah_majikan' => $application['daerah_majikan'],
                'negeri_majikan' => $application['negeri_majikan'],
                'nama_waris' => $application['nama_waris'],
                'hubungan_waris' => $application['hubungan_waris'],
                'telefon_waris' => $application['telefon_waris'],
                'jenis_pengadil' => $application['jenis_pengadil'],
                'tahun_permohonan' => date('Y'),
                'saiz_baju' => $application['saiz_baju'],
                'jantina' => $application['jantina']
            ];
            generateR4Pdf($pdf, $mappedData);
            break;

        case 'ujian_bertulis':
            // Map data for R3 template (Data Diri Pegawai Perlawanan - Kelas 3 FAM)
            $mappedData = [
                'id' => $application['id'],
                'nama_penuh' => $application['nama_penuh'],
                'user_email' => $application['email'],
                'no_ic' => $application['no_ic'],
                'no_telefon' => $application['no_telefon'],
                'alamat1' => $application['alamat1'],
                'alamat2' => $application['alamat2'],
                'poskod' => $application['poskod'],
                'daerah' => $application['daerah'],
                'negeri' => $application['negeri'],
                'status_kerja' => $application['status_kerja'],
                'jawatan' => $application['jawatan'],
                'nama_majikan' => $application['nama_majikan'],
                'alamat_majikan1' => $application['alamat_majikan1'],
                'alamat_majikan2' => $application['alamat_majikan2'],
                'poskod_majikan' => $application['poskod_majikan'],
                'daerah_majikan' => $application['daerah_majikan'],
                'negeri_majikan' => $application['negeri_majikan'],
                'jenis_pengadil' => $application['jenis_pengadil'],
                'tahun_mula_aktif' => $application['tahun_mula_aktif'] ?? '',
                'saiz_baju' => $application['saiz_baju'],
                'jantina' => $application['jantina'],
                'umur' => $application['umur'] ?? '',
                'tarikh_lahir' => $application['tarikh_lahir'] ?? '',
                'tempat_lahir' => $application['tempat_lahir'] ?? '',
                'tahun_permohonan' => $application['tahun_permohonan'] ?? date('Y'),
                'tahun_lulus_kelas3' => $application['tahun_lulus_kelas3'] ?? '',
                'tarikh_hantar'    => $application['tarikh_hantar'] ?? null,
                'district_nama'    => $district_nama,
                'pp_daerah_nama'   => $pp_daerah_nama,
                'pp_telefon'       => $pp_telefon,
                'pp_emel'          => $pp_emel,
            ];
            generateR11Pdf($pdf, $mappedData, 'III');
            break;

        case 'ujian_kelas1':
            // Map data for R3-A template (Data Diri Penilai Pengadil - Kelas 1 FAM)
            $mappedData = [
                'id' => $application['id'],
                'nama_penuh' => $application['nama_penuh'],
                'user_email' => $application['email'],
                'no_ic' => $application['no_ic'],
                'no_telefon' => $application['no_telefon'],
                'alamat1' => $application['alamat1'],
                'alamat2' => $application['alamat2'],
                'poskod' => $application['poskod'],
                'daerah' => $application['daerah'],
                'negeri' => $application['negeri'],
                'status_kerja' => $application['status_kerja'],
                'jawatan' => $application['jawatan'],
                'nama_majikan' => $application['nama_majikan'],
                'alamat_majikan1' => $application['alamat_majikan1'],
                'alamat_majikan2' => $application['alamat_majikan2'],
                'poskod_majikan' => $application['poskod_majikan'],
                'daerah_majikan' => $application['daerah_majikan'],
                'negeri_majikan' => $application['negeri_majikan'],
                'jenis_pengadil' => $application['jenis_pengadil'],
                'tahun_mula_aktif' => $application['tahun_mula_aktif'] ?? '',
                'saiz_baju' => $application['saiz_baju'],
                'jantina' => $application['jantina'],
                'umur' => $application['umur'] ?? '',
                'tarikh_lahir' => $application['tarikh_lahir'] ?? '',
                'tempat_lahir' => $application['tempat_lahir'] ?? '',
                'tahun_permohonan' => $application['tahun_permohonan'] ?? date('Y'),
                'tahun_lulus_kelas3' => $application['tahun_lulus_kelas3'] ?? '',
                'tarikh_hantar'    => $application['tarikh_hantar'] ?? null,
                'district_nama'    => $district_nama,
                'pp_daerah_nama'   => $pp_daerah_nama,
                'pp_telefon'       => $pp_telefon,
                'pp_emel'          => $pp_emel,
            ];
            generateR11Pdf($pdf, $mappedData, 'I');
            break;
    }

    // Set headers for PDF download
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');

    // Output PDF
    $pdf->Output($filename, 'D');
    exit;

} catch (Exception $e) {
    jsonResponse([
        'error' => true,
        'message' => 'Ralat dalaman server: ' . $e->getMessage()
    ], 500);
}
?>