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
    $pdf->setFillColor(0, 0, 0);

    // Borang R4 label in top right corner
    $pdf->setFont('helvetica', 'I', 7);
    $pdf->Cell(0, 5, 'Borang R4', 0, 1, 'R');
    $pdf->ln(2);

    // Set default font
    $pdf->setFont('helvetica', '', 10);

    // --- START of PDF Content ---

    // Header Section with Logo
    $logoPath = $_SERVER['DOCUMENT_ROOT'] . '/assets/Pahang_FA_logo.png';
    if (file_exists($logoPath)) {
        $pdf->Image($logoPath, 15, 15, 25, 25);
    }
    $pdf->setFont('helvetica', 'B', 14);
    $pdf->Cell(0, 8, 'PERSATUAN BOLASEPAK NEGERI PAHANG', 0, 1, 'C');
    $pdf->setFont('helvetica', 'B', 12);
    $pdf->Cell(0, 7, 'BORANG UJIAN KECERGASAN PENGADIL', 0, 1, 'C');
    $pdf->ln(7);

    // Form Number and Date
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(100, 6, 'No. Rujukan: PBNP/R4/' . ($data['tahun_permohonan'] ?? date('Y')) . '/' . str_pad($data['id'] ?? 0, 4, '0', STR_PAD_LEFT), 0, 0);
    $pdf->Cell(80, 6, 'Tarikh: ' . date('d/m/Y'), 0, 1, 'R');
    $pdf->ln(3);

    // === MAKLUMAT PERIBADI SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'MAKLUMAT PERIBADI', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    // Setiap baris mengukur teks terpanjang sebelum kedua-dua sempadan dilukis.
    // Ini memastikan garisan label dan isi selari walaupun alamat berbilang baris.
    $drawRow = static function (array $cells) use ($pdf): void {
        $rowHeight = 7.0;
        foreach ($cells as [$width, $text]) {
            $rowHeight = max($rowHeight, ceil($pdf->getStringHeight($width - 4, (string) $text) + 2));
        }
        if ($pdf->GetY() + $rowHeight > $pdf->getPageHeight() - 20) {
            $pdf->AddPage();
        }
        $x = $pdf->getMargins()['left'];
        $y = $pdf->GetY();
        foreach ($cells as [$width, $text, $border]) {
            $pdf->MultiCell($width, $rowHeight, (string) $text, $border, 'L', false, 0,
                $x, $y, true, 0, false, true, $rowHeight, 'M', true);
            $x += $width;
        }
        $pdf->SetXY($pdf->getMargins()['left'], $y + $rowHeight);
    };

    $drawRow([
        [30, 'Nama Penuh:', 'LTB'], [90, strtoupper((string) ($data['nama_penuh'] ?? '')), 'TB'],
        [30, 'No. KP:', 'LTB'], [30, strtoupper((string) ($data['no_kp'] ?? '')), 'TRB'],
    ]);
    $drawRow([
        [30, 'Alamat Emel:', 'LTB'], [90, strtoupper((string) ($data['user_email'] ?? '')), 'TB'],
        [30, 'No. Telefon:', 'LTB'], [30, strtoupper((string) ($data['no_telefon'] ?? '')), 'TRB'],
    ]);
    $drawRow([
        [30, 'Jantina:', 'LTB'], [60, strtoupper((string) ($data['jantina'] ?? '-')), 'TB'],
        [30, 'Jenis Pengadil:', 'LTB'], [60, strtoupper((string) ($data['jenis_pengadil'] ?? 'Pengadil')), 'TRB'],
    ]);

    $addressParts = array_filter([
        trim((string) ($data['alamat1'] ?? '')),
        trim((string) ($data['alamat2'] ?? '')),
        trim((string) (($data['poskod'] ?? '') . ' ' . ($data['daerah'] ?? ''))),
        trim((string) ($data['negeri'] ?? '')),
    ], static fn($part) => $part !== '');
    $address = strtoupper(implode(', ', $addressParts)) ?: '-';
    $drawRow([[30, 'Alamat:', 'LTB'], [150, $address, 'TRB']]);
    $pdf->ln(5);

    // === MAKLUMAT TEMPAT KERJA SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'MAKLUMAT TEMPAT KERJA', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    $drawRow([
        [30, 'Status Kerja:', 'LTB'], [60, strtoupper((string) ($data['status_kerja'] ?? 'TIADA')), 'TB'],
        [30, 'Jawatan:', 'LTB'], [60, strtoupper((string) ($data['jawatan'] ?? 'TIADA')), 'TRB'],
    ]);
    $drawRow([
        [30, 'Nama Majikan:', 'LTB'], [150, strtoupper((string) ($data['nama_majikan'] ?? 'TIADA')), 'TRB'],
    ]);

    $employerParts = array_filter([
        trim((string) ($data['alamat_majikan1'] ?? '')),
        trim((string) ($data['alamat_majikan2'] ?? '')),
        trim((string) (($data['poskod_majikan'] ?? '') . ' ' . ($data['daerah_majikan'] ?? ''))),
        trim((string) ($data['negeri_majikan'] ?? '')),
    ], static fn($part) => $part !== '');
    $employerAddress = strtoupper(implode(', ', $employerParts)) ?: 'TIADA';
    $drawRow([[30, 'Alamat Majikan:', 'LTB'], [150, $employerAddress, 'TRB']]);
    $pdf->ln(5);
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'MAKLUMAT WARIS TERDEKAT', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);

    $drawRow([
        [30, 'Nama Waris:', 'LTB'], [60, strtoupper((string) ($data['nama_waris'] ?? '')), 'TB'],
        [30, 'Hubungan:', 'LTB'], [60, strtoupper((string) ($data['hubungan_waris'] ?? '')), 'TRB'],
    ]);
    $drawRow([
        [30, 'No. Telefon Waris:', 'LTB'], [150, strtoupper((string) ($data['telefon_waris'] ?? '')), 'TRB'],
    ]);
    $pdf->ln(3);


    // Ukur seluruh perakuan bersama ruang tandatangan supaya kedua-duanya
    // berada pada halaman yang sama apabila butiran pemohon memanjangkan borang.
    $declarations = [
        '[ ] Saya seperti nama di atas, dengan ini secara sukarela bersetuju untuk mengambil bahagian dalam Ujian Kecergasan Fizikal anjuran Persatuan Bolasepak Negeri Pahang (PBNP) bagi melayakkan saya berdaftar dan bergiat aktif sebagai Pengadil Bolasepak untuk musim ' . ($data['tahun_permohonan'] ?? date('Y')) . '.',
        '[ ] Saya berada dalam keadaan kesihatan fizikal dan mental yang baik. Saya tidak menghidap sebarang penyakit kronik, kecederaan, atau masalah perubatan yang boleh memudaratkan diri saya jika melakukan aktiviti fizikal berintensiti tinggi.',
        '[ ] Saya telah menjalani pemeriksaan kesihatan/perubatan dan disahkan "Lulus" atau "Fit to Participate" oleh Pegawai Perubatan bertauliah untuk menyertai ujian ini.',
        '[ ] Saya sedar dan memahami bahawa ujian kecergasan ini melibatkan aktiviti fizikal yang berat dan mempunyai risiko kecederaan atau kejadian yang tidak diingini.',
        '[ ] Saya dan waris/keluarga saya bersetuju untuk TIDAK AKAN mengambil sebarang tindakan undang-undang atau membuat sebarang tuntutan terhadap Persatuan Bolasepak Negeri Pahang (PBNP), pegawai bertugas, atau wakil mereka sekiranya berlaku sebarang kecederaan, kemalangan, kehilangan upaya, atau kematian ke atas diri saya semasa atau selepas ujian ini dijalankan, yang berpunca daripada penyertaan saya.',
        '[ ] Saya membenarkan pihak penganjur untuk memberikan bantuan kecemasan awal sekiranya perlu.',
    ];
    $pdf->setFont('helvetica', '', 8);
    $declarationHeight = 0;
    foreach ($declarations as $declaration) {
        $declarationHeight += max(5, $pdf->getStringHeight(178, $declaration));
    }
    $signatureNameHeight = max(5, $pdf->getStringHeight(155, strtoupper((string) ($data['nama_penuh'] ?? ''))));
    $remainingHeight = 8 + 3 + $declarationHeight + 3 + 6 + 8 + 1 + $signatureNameHeight + 5 + 4;
    if ($pdf->GetY() + $remainingHeight > $pdf->getPageHeight() - 20) {
        $pdf->AddPage();
    }

    // === PERAKUAN KESIHATAN DAN PELEPASAN TANGGUNGAN (INDEMNITI) SECTION ===
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->setTextColor(255, 255, 255);
    $pdf->Cell(0, 8, 'PERAKUAN KESIHATAN DAN PELEPASAN TANGGUNGAN (INDEMNITI)', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 8);

    foreach ($declarations as $declaration) {
        $pdf->MultiCell(180, 5, $declaration, 'LTRB', 'L', false, 1);
    }

    $pdf->ln(3);

    // Applicant's Signature
    $pdf->setFont('helvetica', '', 9);
    // Signature block styled like the R-11 form example
    // "Tandatangan Pemohon" on the left and "Tarikh" on the right
    $pdf->Cell(120, 6, 'Tandatangan Pemohon', 0, 0, 'L');
    $pdf->Cell(60, 6, 'Tarikh: ____________________', 0, 1, 'L');

    // Add vertical space for the actual signature
    $pdf->Ln(8);

    // Signature line
    $pdf->Cell(70, 0, '', 'T', 1, 'L');
    $pdf->Ln(1);

    // Name and MyKad details below the signature line
    $pdf->Cell(20, 5, 'Nama', 0, 0, 'L');
    $pdf->Cell(5, 5, ':', 0, 0, 'C');
    $pdf->MultiCell(155, 5, strtoupper((string) ($data['nama_penuh'] ?? '')), 0, 'L', false, 1);

    $pdf->Cell(20, 5, 'Mykad', 0, 0, 'L');
    $pdf->Cell(5, 5, ':', 0, 0, 'C');
    $pdf->MultiCell(155, 5, strtoupper((string) ($data['no_kp'] ?? '')), 0, 'L', false, 1);

    // Footer
    $pdf->setFont('helvetica', 'I', 7);
    $pdf->Cell(0, 4, 'Borang ini adalah untuk kegunaan rasmi Unit Pengadil Persatuan Bolasepak Negeri Pahang sahaja. Cetakan komputer pada ' . date('d/m/Y H:i:s'), 0, 1, 'C');

    // --- END of PDF Content ---
}
?>
