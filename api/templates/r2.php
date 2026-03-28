<?php

function generateR2Pdf($pdf, $data, $pdo) {
    // Set document information
    $pdf->setCreator(PDF_CREATOR);
    $pdf->setAuthor('Persatuan Bolasepak Negeri Pahang');
    $pdf->setTitle('Senarai Perlawanan Pengadil - ' . strtoupper($data['user_nama_penuh']));
    $pdf->setSubject('Senarai Perlawanan Pengadil');

    // Remove default header/footer
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);

      // Borang R2 label in top right corner
    $pdf->setFont('helvetica', 'I', 7);
    $pdf->Cell(0, 5, 'Borang R2', 0, 1, 'R');
    $pdf->ln(2);

    // Set default font
    $pdf->setFont('helvetica', '', 10);

    // --- START of PDF Content ---

    // Header Section with Logo
    $pdf->Image($_SERVER['DOCUMENT_ROOT'] . '/assets/Pahang_FA_logo.png', 15, 15, 25, 25);
    $pdf->setFont('helvetica', 'B', 14);
    $pdf->Cell(0, 8, 'PERSATUAN BOLASEPAK NEGERI PAHANG', 0, 1, 'C');
    $pdf->setFont('helvetica', 'B', 12);
    $pdf->Cell(0, 7, 'SENARAI PERLAWANAN PENGADIL', 0, 1, 'C');
    $pdf->ln(7);

    // Form Number and Date
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(100, 6, 'No. Rujukan: PBND/PENGADIL/' . date('Y') . '/' . str_pad(strtoupper($data['id']), 4, '0', STR_PAD_LEFT), 0, 0);
    $pdf->Cell(80, 6, 'Tarikh: ' . date('d/m/Y'), 0, 1, 'R');
    $pdf->ln(3);



    // === MAKLUMAT PENGADIL SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'MAKLUMAT PENGADIL', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    // 2-column layout with better spacing
    $pdf->Cell(30, 7, 'Nama Penuh:', 'LTB', 0, 'L', false);
    $pdf->Cell(90, 7, strtoupper($data['user_nama_penuh']), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'No. KP:', 'LTB', 0, 'L', false);
    $pdf->Cell(30, 7, strtoupper($data['no_ic']), 'TRB', 1, 'L', false);

    $pdf->Cell(30, 7, 'Jenis Pengadil:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['jenis_pengadil'] ?? 'Pengadil'), 'TB', 0, 'L', false);
    $pdf->Cell(30, 7, 'Tahun Mula Aktif:', 'LTB', 0, 'L', false);
    $pdf->Cell(60, 7, strtoupper($data['tahun_mula_aktif'] ?? date('Y')), 'TRB', 1, 'L', false);
    $pdf->ln(5);



    // Get match records for this application

    $stmt = $pdo->prepare(

        "SELECT p.tarikh, p.jenis, p.tempat, p.jawatan

         FROM perlawanan p

         WHERE p.permohonan_id = ?

         ORDER BY p.tarikh DESC"

    );

    $stmt->execute([$data['id']]);

    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);



    // === SENARAI PERLAWANAN SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'SENARAI PERLAWANAN', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    if (empty($matches)) {
        $pdf->Cell(0, 10, 'Tiada rekod perlawanan dijumpai.', 0, 1, 'L');
    } else {
        // Table header
        $pdf->setFont('helvetica', 'B', 9);
        $pdf->setFillColor(240, 240, 240);
        $pdf->Cell(25, 8, 'Tarikh', 1, 0, 'C', true);
        $pdf->Cell(40, 8, 'Jenis Perlawanan', 1, 0, 'C', true);
        $pdf->Cell(65, 8, 'Tempat', 1, 0, 'C', true);
        $pdf->Cell(50, 8, 'Jawatan', 1, 1, 'C', true);

        // Table data
        $pdf->setFont('helvetica', '', 8);
        $fill = false;

        foreach ($matches as $match) {
            $pdf->Cell(25, 7, date('d/m/Y', strtotime($match['tarikh'])), 1, 0, 'C', $fill);
            $pdf->Cell(40, 7, strtoupper($match['jenis'] ?: '-'), 1, 0, 'L', $fill);
            $pdf->Cell(65, 7, strtoupper($match['tempat'] ?: '-'), 1, 0, 'L', $fill);
            $pdf->Cell(50, 7, strtoupper($match['jawatan'] ?: '-'), 1, 1, 'L', $fill);
            $fill = !$fill;
        }

        // Summary
        $pdf->ln(5);
        $pdf->setFont('helvetica', 'B', 10);
        $pdf->Cell(0, 10, 'Jumlah Perlawanan: ' . count($matches), 0, 1, 'L');
    }
    $pdf->ln(5);

    // Add new page for PENGESAHAN section
    $pdf->AddPage();

    // === PENGESAHAN SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->setFillColor(0, 0, 0); // Black background
    $pdf->Cell(0, 8, 'PENGESAHAN', 1, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 8);
    $pdf->MultiCell(0, 4, 'Saya akui Pengadil di atas aktif dalam pengadilan di peringkat negeri sepanjang tahun ' . date('Y') . ' dan butir-butir perlawanan yang dinyatakan di atas adalah benar.', 0, 'L', false, 1);

    $pdf->ln(3);

    // Get PP Daerah name for this referee's district
    $pp_daerah_name = '...........................................';
    if (isset($data['district_id'])) {
        $stmt_pp = $pdo->prepare("SELECT nama_penuh FROM users WHERE role = 'PP Daerah' AND district_id = ? LIMIT 1");
        $stmt_pp->execute([$data['district_id']]);
        $pp_data = $stmt_pp->fetch(PDO::FETCH_ASSOC);
        if ($pp_data) {
            $pp_daerah_name = strtoupper($pp_data['nama_penuh']);
        }
    }

    // Get district name for Setiausaha Agung
    $daerah_name = '...........................................';
    if (isset($data['district_nama']) && !empty($data['district_nama'])) {
        $daerah_name = 'Daerah ' . strtoupper($data['district_nama']);
    }

    // Setiausaha Agung signature box below
    $pdf->Cell(0, 6, 'Tandatangan Pengerusi Pembangunan Pengadil:  ' . $daerah_name . ':', 'LTB', 1, 'L', false);
    $pdf->Cell(0, 20, '', 'LRB', 1, 'C', false);
    $pdf->Cell(0, 6, '(Nama: ' . $pp_daerah_name . ')', 'LB', 1, 'C', false);

    // Footer
    $pdf->ln(3);
    $pdf->setFont('helvetica', 'I', 8);
    $pdf->Cell(0, 4, 'Borang ini adalah untuk kegunaan rasmi Unit Pengadil Persatuan Bolasepak Negeri Pahang sahaja.', 0, 1, 'C');
    $pdf->Cell(0, 4, 'Cetakan komputer pada ' . date('d/m/Y H:i:s'), 0, 1, 'C');



    // --- END of PDF Content ---

}

?>