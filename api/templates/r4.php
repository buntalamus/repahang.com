<?php
function generateR4Pdf($pdf, $data) {
    // Set document information
    $pdf->setCreator(PDF_CREATOR);
    $pdf->setAuthor('Persatuan Bolasepak Negeri Pahang');
    $pdf->setTitle('Borang Ujian Kecergasan Pengadil - ' . strtoupper($data['nama_penuh']));
    $pdf->setSubject('Borang Ujian Kecergasan Pengadil');

    // Remove default header/footer
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);

    // Borang R4 label in top right corner
    $pdf->setFont('helvetica', 'I', 7);
    $pdf->Cell(0, 5, 'Borang R4', 0, 1, 'R');
    $pdf->ln(2);

    // Set default font
    $pdf->setFont('helvetica', '', 10);

    // --- START of PDF Content ---

    // Header Section with Logo
    $pdf->Image($_SERVER['DOCUMENT_ROOT'] . '/assets/Pahang_FA_logo.png', 15, 15, 25, 25);
    $pdf->setFont('helvetica', 'B', 14);
    $pdf->Cell(0, 8, 'PERSATUAN BOLASEPAK NEGERI PAHANG', 0, 1, 'C');
    $pdf->setFont('helvetica', 'B', 12);
    $pdf->Cell(0, 7, 'BORANG UJIAN KECERGASAN PENGADIL', 0, 1, 'C');
    $pdf->ln(7);

    // Form Number and Date
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(100, 6, 'No. Rujukan: PBNP/R4/' . date('Y') . '/' . str_pad($data['id'] ?? 0, 4, '0', STR_PAD_LEFT), 0, 0);
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
    $pdf->Cell(90, 7, strtoupper($data['nama_penuh']), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'No. KP:', 'LTB', 0, 'L', false);
    $pdf->Cell(30, 7, strtoupper($data['no_kp']), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 7, 'Alamat Emel:', 'LTB', 0, 'L', false);
    $pdf->Cell(90, 7, strtoupper($data['user_email']), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'No. Telefon:', 'LTB', 0, 'L', false);
    $pdf->Cell(30, 7, strtoupper($data['no_telefon']), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 7, 'Jantina:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['jantina'] ?? '-'), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'Jenis Pengadil:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['jenis_pengadil'] ?? 'Pengadil'), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 8.1, 'Alamat:', 'LTB', 0, 'L', false);
    $address = strtoupper($data['alamat1']);
    if (!empty($data['alamat2'])) $address .= ", " . strtoupper($data['alamat2']);
    $address .= ", " . strtoupper($data['poskod']) . " " . strtoupper($data['daerah']) . ", " . strtoupper($data['negeri']);
    $pdf->MultiCell(150, 7, $address, 'TRB', 'L', false, 1);
    $pdf->ln(5);

    // === MAKLUMAT TEMPAT KERJA SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'MAKLUMAT TEMPAT KERJA', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    $pdf->Cell(30, 7, 'Status Kerja:', 'LTB', 0, 'L', false);
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
    if (empty($employerAddress)) $employerAddress = 'TIADA';
    $pdf->MultiCell(150, 7, $employerAddress, 'TRB', 'L', false, 1);
    $pdf->ln(5);
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'MAKLUMAT WARIS TERDEKAT', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    $pdf->Cell(30, 7, 'Nama Waris:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['nama_waris']), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'Hubungan:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['hubungan_waris']), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 7, 'No. Telefon Waris:', 'LTB', 0, 'L', false);
    $pdf->Cell(150, 7, strtoupper($data['telefon_waris']), 'TRB', 1, 'L', false);
    $pdf->ln(3);


    // === PERAKUAN KESIHATAN DAN PELEPASAN TANGGUNGAN (INDEMNITI) SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'PERAKUAN KESIHATAN DAN PELEPASAN TANGGUNGAN (INDEMNITI)', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 8);

    $pdf->MultiCell(180, 5, '[ ] Saya seperti nama di atas, dengan ini secara sukarela bersetuju untuk mengambil bahagian dalam Ujian Kecergasan Fizikal anjuran Persatuan Bolasepak Negeri Pahang (PBNP) bagi melayakkan saya berdaftar dan bergiat aktif sebagai Pengadil Bolasepak untuk musim ' . date('Y') . '.', 'LTRB', 'L', false, 1);

    $pdf->MultiCell(180, 5, '[ ] Saya berada dalam keadaan kesihatan fizikal dan mental yang baik. Saya tidak menghidap sebarang penyakit kronik, kecederaan, atau masalah perubatan yang boleh memudaratkan diri saya jika melakukan aktiviti fizikal berintensiti tinggi.', 'LTRB', 'L', false, 1);

    $pdf->MultiCell(180, 5, '[ ] Saya telah menjalani pemeriksaan kesihatan/perubatan dan disahkan "Lulus" atau "Fit to Participate" oleh Pegawai Perubatan bertauliah untuk menyertai ujian ini.', 'LTRB', 'L', false, 1);

    $pdf->MultiCell(180, 5, '[ ] Saya sedar dan memahami bahawa ujian kecergasan ini melibatkan aktiviti fizikal yang berat dan mempunyai risiko kecederaan atau kejadian yang tidak diingini.', 'LTRB', 'L', false, 1);

    $pdf->MultiCell(180, 5, '[ ] Saya dan waris/keluarga saya bersetuju untuk TIDAK AKAN mengambil sebarang tindakan undang-undang atau membuat sebarang tuntutan terhadap Persatuan Bolasepak Negeri Pahang (PBNP), pegawai bertugas, atau wakil mereka sekiranya berlaku sebarang kecederaan, kemalangan, kehilangan upaya, atau kematian ke atas diri saya semasa atau selepas ujian ini dijalankan, yang berpunca daripada penyertaan saya.', 'LTRB', 'L', false, 1);

    $pdf->MultiCell(180, 5, '[ ] Saya membenarkan pihak penganjur untuk memberikan bantuan kecemasan awal sekiranya perlu.', 'LTRB', 'L', false, 1);

    $pdf->ln(3);

    // Applicant's Signature
    $pdf->setFont('helvetica', '', 9);
    $pdf->Ln(3);

    // Signature block styled like the R-11 form example
    // "Tandatangan Pemohon" on the left and "Tarikh" on the right
    $pdf->Cell(120, 6, 'Tandatangan Pemohon', 0, 0, 'L');
    $pdf->Cell(60, 6, 'Tarikh: ____________________', 0, 1, 'L');

    // Add vertical space for the actual signature
    $pdf->Ln(10);

    // Signature line
    $pdf->Cell(70, 0, '', 'T', 1, 'L');
    $pdf->Ln(1);

    // Name and MyKad details below the signature line
    $pdf->Cell(20, 5, 'Nama', 0, 0, 'L');
    $pdf->Cell(5, 5, ':', 0, 0, 'C');
    $pdf->Cell(100, 5, strtoupper($data['nama_penuh']), 0, 1, 'L');

    $pdf->Cell(20, 5, 'Mykad', 0, 0, 'L');
    $pdf->Cell(5, 5, ':', 0, 0, 'C');
    $pdf->Cell(100, 5, strtoupper($data['no_kp']), 0, 1, 'L');

    $pdf->ln(2);

    // Footer
    $pdf->ln(1);
    $pdf->setFont('helvetica', 'I', 8);
    $pdf->Cell(0, 4, 'Borang ini adalah untuk kegunaan rasmi Unit Pengadil Persatuan Bolasepak Negeri Pahang sahaja.', 0, 1, 'C');
    $pdf->Cell(0, 4, 'Cetakan komputer pada ' . date('d/m/Y H:i:s'), 0, 1, 'C');

    // --- END of PDF Content ---
}
?>