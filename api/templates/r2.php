<?php
/**
 * R2 - SENARAI PERLAWANAN PENGADIL
 * Format sistem lama PBNP
 */
function generateR2Pdf($pdf, $data, $pdo) {
    $pdf->setCreator(PDF_CREATOR);
    $pdf->setAuthor('Persatuan Bolasepak Negeri Pahang');
    $pdf->setTitle('Senarai Perlawanan Pengadil - ' . strtoupper($data['nama_penuh'] ?? $data['user_nama_penuh'] ?? ''));
    $pdf->setSubject('Senarai Perlawanan Pengadil');
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);

    $nama     = strtoupper($data['nama_penuh'] ?? $data['user_nama_penuh'] ?? '');
    $no_ic    = $data['no_ic'] ?? $data['no_kp'] ?? '';
    $tahun    = $data['tahun_permohonan'] ?? date('Y');
    $app_id   = $data['id'] ?? 0;

    // --- Borang R2 label top right ---
    $pdf->setFont('helvetica', 'I', 7);
    $pdf->Cell(0, 5, 'Borang R2', 0, 1, 'R');
    $pdf->ln(2);

    // --- Header with logo ---
    $logoPath = $_SERVER['DOCUMENT_ROOT'] . '/assets/Pahang_FA_logo.png';
    $headerY = $pdf->GetY();
    if (file_exists($logoPath)) {
        $pdf->Image($logoPath, 15, $headerY, 20, 20);
    }
    $pdf->setFont('helvetica', 'B', 14);
    $pdf->Cell(0, 8, 'PERSATUAN BOLASEPAK NEGERI PAHANG', 0, 1, 'C');
    $pdf->setFont('helvetica', 'B', 12);
    $pdf->Cell(0, 7, 'SENARAI PERLAWANAN PENGADIL', 0, 1, 'C');
    $pdf->ln(7);

    // --- No Rujukan & Tarikh ---
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(100, 6, 'No. Rujukan: PBNP/R2/' . $tahun . '/' . str_pad($app_id, 4, '0', STR_PAD_LEFT), 0, 0);
    $pdf->Cell(80, 6, 'Tarikh: ' . date('d/m/Y'), 0, 1, 'R');
    $pdf->ln(3);

    // === MAKLUMAT PENGADIL ===
    $pdf->setFillColor(0, 0, 0);
    $pdf->setTextColor(255, 255, 255);
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->Cell(0, 8, '  MAKLUMAT PENGADIL', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(30, 7, 'Nama Penuh:', 'LTB', 0, 'L');
    $pdf->Cell(90, 7, $nama, 'TB', 0, 'L');
    $pdf->Cell(30, 7, 'No. KP:', 'LTB', 0, 'L');
    $pdf->Cell(30, 7, $no_ic, 'TRB', 1, 'L');

    $pdf->Cell(30, 7, 'Jenis Pengadil:', 'LTB', 0, 'L');
    $pdf->Cell(60, 7, strtoupper($data['jenis_pengadil'] ?? 'Pengadil'), 'TB', 0, 'L');
    $pdf->Cell(30, 7, 'Tahun Mula Aktif:', 'LTB', 0, 'L');
    $pdf->Cell(60, 7, strtoupper($data['tahun_mula_aktif'] ?? ''), 'TRB', 1, 'L');
    $pdf->ln(5);

    // Get match records
    $stmt = $pdo->prepare(
        "SELECT p.tarikh, p.jenis, p.tempat, p.jawatan
         FROM perlawanan p
         WHERE p.permohonan_id = ?
         ORDER BY p.tarikh ASC"
    );
    $stmt->execute([$app_id]);
    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // === SENARAI PERLAWANAN ===
    $pdf->setFillColor(0, 0, 0);
    $pdf->setTextColor(255, 255, 255);
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->Cell(0, 8, '  SENARAI PERLAWANAN', 0, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    if (empty($matches)) {
        $pdf->setFont('helvetica', '', 9);
        $pdf->Cell(0, 10, 'Tiada rekod perlawanan dijumpai.', 0, 1, 'L');
    } else {
        $pdf->setFont('helvetica', 'B', 9);
        $pdf->setFillColor(240, 240, 240);
        $pdf->Cell(25, 8, 'Tarikh', 1, 0, 'C', true);
        $pdf->Cell(40, 8, 'Jenis Perlawanan', 1, 0, 'C', true);
        $pdf->Cell(65, 8, 'Tempat', 1, 0, 'C', true);
        $pdf->Cell(50, 8, 'Jawatan', 1, 1, 'C', true);

        $pdf->setFont('helvetica', '', 8);
        $fill = false;
        foreach ($matches as $match) {
            if ($pdf->GetY() > 255) {
                $pdf->AddPage();
                $pdf->setFont('helvetica', 'B', 9);
                $pdf->setFillColor(240, 240, 240);
                $pdf->Cell(25, 8, 'Tarikh', 1, 0, 'C', true);
                $pdf->Cell(40, 8, 'Jenis Perlawanan', 1, 0, 'C', true);
                $pdf->Cell(65, 8, 'Tempat', 1, 0, 'C', true);
                $pdf->Cell(50, 8, 'Jawatan', 1, 1, 'C', true);
                $pdf->setFont('helvetica', '', 8);
                $fill = false;
            }
            $tarikh = !empty($match['tarikh']) ? date('d/m/Y', strtotime($match['tarikh'])) : '-';
            $pdf->Cell(25, 7, $tarikh, 1, 0, 'C', $fill);
            $pdf->Cell(40, 7, strtoupper($match['jenis'] ?: '-'), 1, 0, 'L', $fill);
            $pdf->Cell(65, 7, strtoupper($match['tempat'] ?: '-'), 1, 0, 'L', $fill);
            $pdf->Cell(50, 7, strtoupper($match['jawatan'] ?: '-'), 1, 1, 'L', $fill);
            $fill = !$fill;
        }

        $pdf->ln(5);
        $pdf->setFont('helvetica', 'B', 10);
        $pdf->Cell(0, 10, 'Jumlah Perlawanan: ' . count($matches), 0, 1, 'L');
    }
    $pdf->ln(5);

    // === PENGESAHAN ===
    $pdf->AddPage();
    $pdf->setFillColor(0, 0, 0);
    $pdf->setTextColor(255, 255, 255);
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->Cell(0, 8, '  PENGESAHAN', 1, 1, 'L', true);
    $pdf->setTextColor(0, 0, 0);
    $pdf->ln(3);

    $pdf->setFont('helvetica', '', 8);
    $pdf->MultiCell(0, 4, 'Saya akui Pengadil di atas aktif dalam pengadilan di peringkat negeri sepanjang tahun ' . $tahun . ' dan butir-butir perlawanan yang dinyatakan di atas adalah benar.', 0, 'L', false, 1);
    $pdf->ln(3);

    // PP Daerah name
    $pp_daerah_name = strtoupper($data['pp_daerah_nama'] ?? '');
    if (empty($pp_daerah_name) && !empty($data['district_id'] ?? $data['persatuan_id'] ?? null)) {
        $did = $data['district_id'] ?? $data['persatuan_id'];
        $stmt_pp = $pdo->prepare("SELECT nama_penuh FROM users WHERE role = 'PP Daerah' AND persatuan_id = ? LIMIT 1");
        $stmt_pp->execute([$did]);
        $pp_row = $stmt_pp->fetch(PDO::FETCH_ASSOC);
        if ($pp_row) $pp_daerah_name = strtoupper($pp_row['nama_penuh']);
    }
    if (empty($pp_daerah_name)) $pp_daerah_name = '...........................................';

    $district_nama = strtoupper($data['district_nama'] ?? '');
    $daerah_label  = !empty($district_nama) ? 'Daerah ' . $district_nama : '.....................';

    $pdf->Cell(0, 6, 'Tandatangan Pengerusi Pembangunan Pengadil:  ' . $daerah_label . ':', 'LTB', 1, 'L');
    $pdf->Cell(0, 20, '', 'LRB', 1, 'C');
    $pdf->Cell(0, 6, '(Nama: ' . $pp_daerah_name . ')', 'LB', 1, 'C');

    $pdf->ln(3);
    $pdf->setFont('helvetica', 'I', 8);
    $pdf->Cell(0, 4, 'Borang ini adalah untuk kegunaan rasmi Unit Pengadil Persatuan Bolasepak Negeri Pahang sahaja.', 0, 1, 'C');
    $pdf->Cell(0, 4, 'Cetakan komputer pada ' . date('d/m/Y H:i:s'), 0, 1, 'C');
}