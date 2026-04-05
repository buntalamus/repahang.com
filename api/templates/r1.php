<?php
/**
 * R1 - PERMOHONAN PENDAFTARAN TAHUNAN PENGADIL NEGERI
 * Format mengikut Borang R1 rasmi FAM/PBNP
 */
function generateR1Pdf($pdf, $data) {
    $pdf->setCreator(PDF_CREATOR);
    $pdf->setAuthor('Persatuan Bolasepak Negeri Pahang');
    $pdf->setTitle('Borang R1 - Permohonan Pendaftaran Tahunan Pengadil - ' . strtoupper($data['nama_penuh'] ?? $data['user_nama_penuh'] ?? ''));
    $pdf->setSubject('Borang R1');
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);

    $nama = strtoupper($data['nama_penuh'] ?? $data['user_nama_penuh'] ?? '');
    $no_ic = str_replace('-', '', strtoupper($data['no_ic'] ?? $data['no_kp'] ?? ''));
    $tahun = $data['tahun_permohonan'] ?? date('Y');
    $district_nama = strtoupper($data['district_nama'] ?? '');
    $pp_daerah_nama = strtoupper($data['pp_daerah_nama'] ?? '');
    $tahun_lulus = $data['tahun_lulus_kelas3'] ?? '';
    $tahun_mula_aktif = $data['tahun_mula_aktif'] ?? '';
    $no_telefon = $data['no_telefon'] ?? '';

    $boxW = 7;
    $boxH = 6;

    // --- Top row: No. Rujukan (left) + R1 label (right) ---
    $no_rujukan_r1 = 'PBNP/R1/' . $tahun . '/' . str_pad($data['id'] ?? 0, 4, '0', STR_PAD_LEFT);
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->Cell(0, 5, 'R1', 0, 1, 'R');

    $startY = $pdf->GetY();

    // --- Logo top left ---
    $logoPath = $_SERVER['DOCUMENT_ROOT'] . '/assets/Pahang_FA_logo.png';
    if (file_exists($logoPath)) {
        $pdf->Image($logoPath, 15, $startY, 20, 20);
    }

    // --- Photo box dimensions ---
    // Photo box spans the header block height (same as title block)
    // Title: line1=7mm, line2=6mm, line3=6mm → total ~20mm from startY+1
    // No. Rujukan: 5mm, Permohonan: 5mm → header ends at ~startY+32
    $photoW = 33;
    $photoH = 32;
    $pageW  = $pdf->getPageWidth();
    $lMargin = $pdf->getMargins()['left'];
    $rMargin = $pdf->getMargins()['right'];
    $photoX = $pageW - $rMargin - $photoW;
    $leftContentW = $photoX - $lMargin - 1; // max width for left-side cells

    // --- Photo box top right ---
    $profilePhotoPath = null;
    $rawUrl = $data['url_gambar_profil'] ?? '';
    if (!empty($rawUrl)) {
        $urlPath = parse_url($rawUrl, PHP_URL_PATH) ?: $rawUrl;
        $candidate = $_SERVER['DOCUMENT_ROOT'] . '/' . ltrim($urlPath, '/');
        if (file_exists($candidate)) {
            $profilePhotoPath = $candidate;
        }
    }
    if ($profilePhotoPath) {
        $pdf->Image($profilePhotoPath, $photoX, $startY, $photoW, $photoH, '', '', '', true);
    } else {
        $pdf->Rect($photoX, $startY, $photoW, $photoH);
        $pdf->setFont('helvetica', '', 6);
        // Placeholder text in lower portion of box
        $textY = $startY + $photoH - 11;
        $pdf->SetXY($photoX, $textY);
        $pdf->Cell($photoW, 3.5, 'Lekat Gambar Passport', 0, 1, 'C');
        $pdf->SetXY($photoX, $textY + 4);
        $pdf->Cell($photoW, 3.5, '[Uniform Pengadil - Hitam]', 0, 0, 'C');
    }

    // --- Title centered (logo at left 20mm, photo at right, title in between) ---
    $titleX = 38;
    $titleW = $photoX - $titleX - 2;
    $pdf->SetXY($titleX, $startY + 1);
    $pdf->setFont('helvetica', 'B', 14);
    $pdf->Cell($titleW, 7, 'PERSATUAN BOLASEPAK NEGERI PAHANG', 0, 1, 'C');
    $pdf->SetX($titleX);
    $pdf->setFont('helvetica', 'B', 10);
    $pdf->Cell($titleW, 6, 'PERMOHONAN PENDAFTARAN TAHUNAN', 0, 1, 'C');
    $pdf->SetX($titleX);
    $pdf->Cell($titleW, 6, 'PENGADIL NEGERI', 0, 1, 'C');
    // Y is now ~startY+20 (after 3 title lines)

    // --- No. Rujukan (left of photo, below title) ---
    $pdf->setFont('helvetica', '', 8);
    $pdf->Cell($leftContentW, 5, 'No. Rujukan : ' . $no_rujukan_r1, 0, 1, 'L');

    // --- Permohonan: year (left of photo, below rujukan) ---
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(22, 5, 'Permohonan :', 0, 0, 'L');
    $pdf->setFont('helvetica', 'B', 12);
    $pdf->Cell($leftContentW - 22, 5, $tahun, 0, 1, 'L');

    // --- Move cursor past photo block ---
    $pdf->SetY($startY + $photoH + 2);

    // --- Addressed to ---
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(0, 5, 'Setiausaha Kehormat/Agung/Eksekutif', 0, 1, 'L');
    $pdf->Cell(48, 5, 'Persatuan Bolasepak Daerah', 0, 0, 'L');
    $pdf->Cell(80, 5, $district_nama, 'B', 1, 'C');

    $pdf->ln(2);

    // ========== PERIBADI ==========
    $pdf->setFont('helvetica', 'B', 10);
    $pdf->Cell(0, 6, 'PERIBADI', 1, 1, 'C');
    $pdf->ln(1);

    $pdf->setFont('helvetica', '', 9);

    // 1. Saya memohon...
    $pdf->Cell(125, $boxH, '1.  Saya memohon untuk menjadi Pengadil Berdaftar untuk Tahun', 0, 0, 'L');
    $pdf->Cell(25, $boxH, $tahun, 1, 1, 'C');
    $pdf->ln(1);

    // 2. Nama Penuh
    $pdf->Cell(28, $boxH, '2.  Nama Penuh:', 0, 0, 'L');
    $pdf->setFont('helvetica', 'B', 9);
    $pdf->Cell(152, $boxH, '  ' . $nama, 0, 1, 'L');
    $pdf->ln(1);

    // 3. No Kad Pengenalan Baru (digit boxes)
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(55, $boxH, '3.  No Kad Pengenalan Baru:', 0, 0, 'L');
    $pdf->setFont('helvetica', 'B', 9);
    for ($i = 0; $i < 12; $i++) {
        if ($i == 6 || $i == 8) {
            $pdf->Cell(4, $boxH, '-', 0, 0, 'C');
        }
        $char = isset($no_ic[$i]) ? $no_ic[$i] : '';
        $pdf->Cell($boxW, $boxH, $char, 1, 0, 'C');
    }
    $pdf->ln($boxH + 2);

    // 4. Tahun Lulus Ujian Praktikal Pengadil Negeri
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(80, $boxH, '4.  Tahun Lulus Ujian Praktikal Pengadil Negeri:', 0, 0, 'L');
    $pdf->Cell(25, $boxH, $tahun_lulus, 1, 1, 'C');

    $pdf->ln(1);

    // ========== ALAMAT & TELEFON ==========
    $pdf->setFont('helvetica', 'B', 10);
    $pdf->Cell(0, 6, 'ALAMAT & TELEFON', 1, 1, 'C');
    $pdf->ln(1);

    $pdf->setFont('helvetica', '', 9);

    // Alamat Surat-Menyurat with bordered box
    $labelW = 42;
    $pdf->Cell($labelW, 5, 'Alamat Surat-Menyurat :', 0, 0, 'L');

    $addrBoxX = $pdf->GetX();
    $addrBoxY = $pdf->GetY();
    $addrBoxW = 195 - $addrBoxX;
    $addrBoxH = 18;
    $pdf->Rect($addrBoxX, $addrBoxY, $addrBoxW, $addrBoxH);

    $alamat1 = strtoupper($data['alamat1'] ?? '');
    $alamat2 = strtoupper($data['alamat2'] ?? '');
    $poskod = $data['poskod'] ?? '';
    $daerah = strtoupper($data['daerah'] ?? '');
    $negeri = strtoupper($data['negeri'] ?? '');
    $fullAddr = $alamat1;
    if (!empty($alamat2)) $fullAddr .= "\n" . $alamat2;
    if (!empty($poskod) || !empty($daerah)) $fullAddr .= "\n" . trim($poskod . ' ' . $daerah . ', ' . $negeri, ', ');

    $pdf->SetXY($addrBoxX + 2, $addrBoxY + 1);
    $pdf->MultiCell($addrBoxW - 4, 5, trim($fullAddr), 0, 'L');
    $pdf->SetY($addrBoxY + $addrBoxH + 2);

    // --- Phone digit boxes ---
    $phoneLabelW = 30;
    $phoneBoxStartX = 15 + $phoneLabelW + 15;

    // Telefon Rumah (empty - field not stored in system)
    $pdf->Cell($phoneLabelW, $boxH, 'Telefon Rumah', 0, 0, 'L');
    $pdf->SetX($phoneBoxStartX);
    for ($i = 0; $i < 2; $i++) { $pdf->Cell($boxW, $boxH, '', 1, 0, 'C'); }
    $pdf->Cell(5, $boxH, '-', 0, 0, 'C');
    for ($i = 0; $i < 7; $i++) { $pdf->Cell($boxW, $boxH, '', 1, 0, 'C'); }
    $pdf->ln($boxH + 2);

    // Pejabat (empty - field not stored in system)
    $pdf->Cell($phoneLabelW, $boxH, 'Pejabat', 0, 0, 'L');
    $pdf->SetX($phoneBoxStartX);
    for ($i = 0; $i < 2; $i++) { $pdf->Cell($boxW, $boxH, '', 1, 0, 'C'); }
    $pdf->Cell(5, $boxH, '-', 0, 0, 'C');
    for ($i = 0; $i < 7; $i++) { $pdf->Cell($boxW, $boxH, '', 1, 0, 'C'); }
    $pdf->ln($boxH + 2);

    // Bimbit (from no_telefon)
    $pdf->Cell($phoneLabelW, $boxH, 'Bimbit', 0, 0, 'L');
    $pdf->SetX($phoneBoxStartX);

    $phone = str_replace([' ', '+60'], ['', '0'], $no_telefon);
    if (strpos($phone, '-') !== false) {
        $parts = explode('-', $phone, 2);
        $phoneLeft = $parts[0];
        $phoneRight = $parts[1];
    } elseif (strlen($phone) >= 10 && substr($phone, 0, 2) === '01') {
        $phoneLeft = substr($phone, 0, 3);
        $phoneRight = substr($phone, 3);
    } elseif (strlen($phone) >= 9) {
        $phoneLeft = substr($phone, 0, 2);
        $phoneRight = substr($phone, 2);
    } else {
        $phoneLeft = $phone;
        $phoneRight = '';
    }

    $leftCount = max(3, strlen($phoneLeft));
    for ($i = 0; $i < $leftCount; $i++) {
        $char = isset($phoneLeft[$i]) ? $phoneLeft[$i] : '';
        $pdf->Cell($boxW, $boxH, $char, 1, 0, 'C');
    }
    $pdf->Cell(5, $boxH, '-', 0, 0, 'C');
    $rightCount = max(7, strlen($phoneRight));
    for ($i = 0; $i < $rightCount; $i++) {
        $char = isset($phoneRight[$i]) ? $phoneRight[$i] : '';
        $pdf->Cell($boxW, $boxH, $char, 1, 0, 'C');
    }
    $pdf->ln($boxH + 3);

    $pdf->ln(2);

    // ========== LAIN-LAIN ==========
    $pdf->setFont('helvetica', 'B', 10);
    $pdf->Cell(0, 6, 'LAIN-LAIN', 1, 1, 'C');
    $pdf->ln(1);

    $pdf->setFont('helvetica', '', 9);

    // 1. Mula aktif
    $pdf->Cell(60, $boxH, '1.  Mula aktif sebagai Pengadil:', 0, 0, 'L');
    $pdf->Cell(15, $boxH, 'Tahun', 0, 0, 'L');
    $pdf->Cell(25, $boxH, $tahun_mula_aktif, 1, 1, 'C');
    $pdf->ln(1);

    // 2. Butir-butir perlawanan
    $pdf->MultiCell(0, 5, '2.  Butir-butir perlawanan, saya sebagai pengadil pada tahun semasa seperti disenaraikan' . "\n" . '     di Lampiran R2', 0, 'L', false, 1);

    $pdf->ln(8);

    // ========== TANDATANGAN (two columns) ==========
    $colW = 85;
    $gap = 10;

    $pdf->setFont('helvetica', '', 8);
    $pdf->Cell($colW, 5, '........................................................', 0, 0, 'C');
    $pdf->Cell($gap, 5, '', 0, 0, 'L');
    $pdf->Cell($colW, 5, '........................................................', 0, 1, 'C');

    $pdf->Cell($colW, 5, 'Nama pemohon :  ' . $nama, 0, 0, 'L');
    $pdf->Cell($gap, 5, '', 0, 0, 'L');
    $pdf->Cell(28, 5, 'Nama PP Daerah:', 0, 0, 'L');
    $pdf->Cell($colW - 28, 5, $pp_daerah_nama, 0, 1, 'L');

    $pdf->Cell(14, 5, 'Tarikh:', 0, 0, 'L');
    $pdf->Cell($colW - 14, 5, date('d/m/Y'), 0, 0, 'L');
    $pdf->Cell($gap, 5, '', 0, 0, 'L');
    $pdf->Cell(14, 5, 'Tarikh:', 0, 0, 'L');
    $pdf->Cell($colW - 14, 5, date('d/m/Y'), 0, 1, 'L');

    $pdf->ln(4);

    // ========== PENGESAHAN (Setiausaha Agung) ==========
    // Double line separator between the two sections
    $sepY = $pdf->GetY() + 1;
    $sepX1 = $pdf->getMargins()['left'];
    $sepX2 = $pdf->getPageWidth() - $pdf->getMargins()['right'];
    $pdf->SetLineWidth(0.5);
    $pdf->Line($sepX1, $sepY, $sepX2, $sepY);
    $pdf->Line($sepX1, $sepY + 2, $sepX2, $sepY + 2);
    $pdf->SetLineWidth(0.2);
    $pdf->SetY($sepY + 6);

    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(0, 5, 'Setiausaha Agung,', 0, 1, 'L');
    $pdf->Cell(0, 5, 'Persatuan Bolasepak Daerah ' . $district_nama, 0, 1, 'L');
    $pdf->ln(1);
    $pdf->Cell(0, 5, "Tuan'", 0, 1, 'L');
    $pdf->ln(1);

    $pdf->setFont('helvetica', 'B', 9);
    $pdf->Cell(0, 5, 'PERMOHONAN PENDAFTARAN TAHUNAN PENGADIL NEGERI', 0, 1, 'L');
    $pdf->ln(1);

    $pdf->setFont('helvetica', '', 8);
    $pdf->MultiCell(0, 4, 'Saya akui Pengadil di atas aktif dalam pengadilan di peringkat negeri sepanjang tahun ' . $tahun . ' dan butir-butir perlawanan yang dinyatakan di Lampiran R2 adalah benar.', 0, 'L', false, 1);

    $pdf->ln(5);

    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(14, 5, 'Tarikh:', 0, 0, 'L');
    $pdf->Cell(40, 5, '', 'B', 0, 'L');
    $pdf->Cell(20, 5, '', 0, 0, 'L');
    $pdf->Cell(25, 5, 'Tandatangan:', 0, 0, 'L');
    $pdf->Cell(0, 5, '', 'B', 1, 'L');

    $pdf->ln(2);
    $pdf->setFont('helvetica', '', 7);
    $pdf->Cell(90, 4, '', 0, 0, 'L');
    $pdf->Cell(0, 4, 'Setiausaha Kehormat/Agung/Eksekutif Persatuan Bolasepak Negeri', 0, 1, 'R');
    $pdf->Cell(90, 4, '', 0, 0, 'L');
    $pdf->Cell(0, 4, 'Cop Rasmi PB Negeri', 0, 1, 'R');

    $pdf->ln(5);
    $pdf->setFont('helvetica', 'BI', 7);
    $pdf->Cell(0, 4, '*    Sila potong yang tidak berkenaan', 0, 1, 'L');
}
?>
