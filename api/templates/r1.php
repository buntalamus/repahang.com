<?php
function generateR1Pdf($pdf, $data) {
    // Set document information
    $pdf->setCreator(PDF_CREATOR);
    $pdf->setAuthor('Persatuan Bolasepak Negeri Pahang');
    $pdf->setTitle('Borang Pendaftaran Pengadil - ' . strtoupper($data['nama_penuh']));
    $pdf->setSubject('Borang Pendaftaran Pengadil');

    // Remove default header/footer
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);

    // Borang R1 label in top right corner
    $pdf->setFont('helvetica', 'I', 7);
    $pdf->Cell(0, 5, 'Borang R1', 0, 1, 'R');
    $pdf->ln(2);

    // Set default font
    $pdf->setFont('helvetica', '', 10);

    // --- START of PDF Content ---

    // Header Section with Logo
    $pdf->Image($_SERVER['DOCUMENT_ROOT'] . '/assets/Pahang_FA_logo.png', 15, 15, 25, 25);
    $pdf->setFont('helvetica', 'B', 14);
    $pdf->Cell(0, 8, 'PERSATUAN BOLASEPAK NEGERI PAHANG', 0, 1, 'C');
    $pdf->setFont('helvetica', 'B', 12);
    $pdf->Cell(0, 7, 'BORANG PENDAFTARAN PENGADIL TAHUNAN', 0, 1, 'C');
    $pdf->ln(7);

    // Form Number and Date
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(100, 6, 'No. Rujukan: PBND/PENGADIL/' . date('Y') . '/' . str_pad(strtoupper($data['id']), 4, '0', STR_PAD_LEFT), 0, 0);
    $pdf->Cell(80, 6, 'Tarikh: ' . date('d/m/Y'), 0, 1, 'R');
    $pdf->ln(3);

    // === MAKLUMAT PERIBADI SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'MAKLUMAT PERIBADI', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    // 2-column layout with better spacing
    $pdf->Cell(30, 7, 'Nama Penuh:', 'LTB', 0, 'L', false);
    $pdf->Cell(90, 7, strtoupper($data['user_nama_penuh']), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'No. KP:', 'LTB', 0, 'L', false);
    $pdf->Cell(30, 7, strtoupper($data['no_ic']), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 7, 'Alamat Emel:', 'LTB', 0, 'L', false);
    $pdf->Cell(90, 7, strtoupper($data['user_email']), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'No. Telefon:', 'LTB', 0, 'L', false);
    $pdf->Cell(30, 7, strtoupper($data['no_telefon']), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 8.1, 'Alamat Tetap:', 'LTB', 0, 'L', false);
    $address = strtoupper($data['alamat1']);
    if (!empty($data['alamat2'])) $address .= ", " . strtoupper($data['alamat2']);
    $address .= ", " . strtoupper($data['poskod']) . " " . strtoupper($data['daerah']) . ", " . strtoupper($data['negeri']);
    $pdf->MultiCell(150, 7, $address, 'TRB', 'L', false, 1);
    $pdf->ln(5);

    // === MAKLUMAT PEKERJAAN SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'MAKLUMAT PEKERJAAN', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    $pdf->Cell(30, 7, 'Status Pekerjaan:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['status_kerja'] ?? 'TIADA'), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'Jawatan:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['jawatan'] ?? 'TIADA'), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 7, 'Nama Majikan:', 'LTB', 0, 'L', false);
    $pdf->Cell(150, 7, strtoupper($data['nama_majikan'] ?? 'TIADA'), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 8.1, 'Alamat Majikan:', 'LTB', 0, 'L', false);
    $employerAddress = '';
    if (!empty($data['alamat_majikan1'])) $employerAddress .= strtoupper($data['alamat_majikan1']);
    if (!empty($data['alamat_majikan2'])) $employerAddress .= ", " . strtoupper($data['alamat_majikan2']);
    if (!empty($data['poskod_majikan'])) $employerAddress .= ", " . strtoupper($data['poskod_majikan']) . " " . strtoupper($data['daerah_majikan']) . ", " . strtoupper($data['negeri_majikan']);
    $pdf->MultiCell(150, 7, $employerAddress, 'TRB', 'L', false, 1);
    $pdf->ln(5);

    // === MAKLUMAT PENGADIL SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'MAKLUMAT PENGADIL', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    $pdf->Cell(30, 7, 'Jenis Pengadil:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['jenis_pengadil'] ?? 'Pengadil'), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'Tahun Mula Aktif:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['tahun_mula_aktif'] ?? date('Y')), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 7, 'Saiz Baju:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['saiz_baju'] ?? '-'), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'Jantina:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['jantina'] ?? '-'), 'TRB', 1, 'L', false);
    $pdf->ln(3);

    // === PENGAKUAN SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'PENGAKUAN', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 8);

    $pdf->Cell(5, 7, '[ ]', 'LTB', 0, 'C', false);
    $pdf->MultiCell(175, 7, 'Saya mengesahkan bahawa semua maklumat yang diberikan adalah benar dan tepat. Saya bertanggungjawab sepenuhnya terhadap kesahihan maklumat ini.', 'TRB', 'L', false, 1);

    $pdf->Cell(5, 5, '[ ]', 'LTB', 0, 'C', false);
    $pdf->MultiCell(175, 5, 'Saya bersetuju untuk mematuhi semua peraturan dan undang-undang yang ditetapkan oleh Persatuan Bolasepak Negeri Pahang.', 'TRB', 'L', false, 1);

    $pdf->Cell(5, 5, '[ ]', 'LTB', 0, 'C', false);
    $pdf->MultiCell(175, 5, 'Saya sedia menerima sebarang tindakan tatatertib jika didapati melakukan kesalahan semasa bertugas sebagai pengadil.', 'TRB', 'L', false, 1);

    $pdf->ln(3);

    // Applicant's Signature
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(90, 6, 'Tandatangan Pemohon:', 'LTB', 0, 'L', false);
    $pdf->Cell(90, 6, 'Tarikh: _______________', 'TRB', 1, 'R', false);

    $pdf->Cell(90, 15, '', 'LRB', 0, 'C', false);
    $pdf->Cell(90, 15, '', 'RB', 1, 'C', false);

    $pdf->Cell(90, 6, '(Nama: ' . strtoupper($data['user_nama_penuh']) . ')', 'LB', 0, 'C', false);
    $pdf->Cell(90, 6, '', 'RB', 1, 'C', false);
    $pdf->ln(3);

    // === PENGESAHAN SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'PENGESAHAN', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 8);
    $pdf->MultiCell(0, 4, 'Saya akui Pengadil di atas aktif dalam pengadilan di peringkat negeri sepanjang tahun ' . date('Y') . ' dan butir-butir perlawanan yang dinyatakan di Lampiran R2 adalah benar.', 0, 'L', false, 1);

    $pdf->ln(3);

    // Confirmation signatures
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(90, 6, 'Penolong Pegawai Pembangunan Daerah:', 'LTB', 0, 'L', false);
    $pdf->Cell(90, 6, 'Setiausaha Kehormat/Agung/Eksekutif Daerah', 'TRB', 1, 'L', false);

    $pdf->Cell(90, 15, '', 'LRB', 0, 'C', false);
    $pdf->Cell(90, 15, '', 'RB', 1, 'C', false);

    $pdf->Cell(90, 6, '(Nama & Cop: ......................)', 'LB', 0, 'C', false);
    $pdf->Cell(90, 6, '(Nama & Cop: ......................)', 'RB', 1, 'C', false);

    // Footer
    $pdf->ln(1);
    $pdf->setFont('helvetica', 'I', 8);
    $pdf->Cell(0, 4, 'Borang ini adalah untuk kegunaan rasmi Unit Pengadil Persatuan Bolasepak Negeri Pahang sahaja.', 0, 1, 'C');
    $pdf->Cell(0, 4, 'Cetakan komputer pada ' . date('d/m/Y H:i:s'), 0, 1, 'C');

    // --- END of PDF Content ---
}
?>
