<?php
/**
 * R-11 - PERMOHONAN MENGIKUTI KURSUS PENGADIL BOLASEPAK / PENGADIL FUTSAL
 * Format mengikut Borang R-11 rasmi FAM/PBNP
 * @param string $kelas  'III' untuk Kelas III FAM, 'I' untuk Kelas I FAM
 */
function generateR11Pdf($pdf, $data, string $kelas = 'III') {
    $year   = date('Y');
    $nama   = strtoupper($data['nama_penuh'] ?? '');
    $no_kp  = $data['no_ic'] ?? $data['no_kp'] ?? '';
    $emel   = $data['email'] ?? $data['user_email'] ?? $data['emel'] ?? '';
    $telefon  = $data['no_telefon'] ?? '';
    $jantina  = strtoupper($data['jantina'] ?? '');

    $alamat1 = strtoupper($data['alamat1'] ?? '');
    $alamat2 = strtoupper($data['alamat2'] ?? '');
    $poskod  = $data['poskod'] ?? '';
    $daerah  = strtoupper($data['daerah'] ?? '');
    $negeri  = strtoupper($data['negeri'] ?? '');
    $aParts  = array_filter([$alamat1, $alamat2, trim($poskod . ' ' . $daerah . ', ' . $negeri, ' ,')]);
    $fullAlamat = implode(', ', $aParts);

    $status_kerja   = strtoupper($data['status_kerja'] ?? '');
    $jawatan        = strtoupper($data['jawatan'] ?? '');
    $nama_majikan   = strtoupper($data['nama_majikan'] ?? '');
    $mParts         = array_filter([strtoupper($data['alamat_majikan1'] ?? ''), strtoupper($data['alamat_majikan2'] ?? '')]);
    $alamat_majikan = implode(', ', $mParts);

    $nama_waris    = strtoupper($data['nama_waris'] ?? '');
    $telefon_waris = $data['telefon_waris'] ?? '';
    $hubungan      = strtoupper($data['hubungan_waris'] ?? '');

    $district_nama = strtoupper($data['district_nama'] ?? '');
    $pp_nama       = strtoupper($data['pp_daerah_nama'] ?? '');
    $pp_telefon    = $data['pp_telefon'] ?? '';
    $pp_emel       = $data['pp_emel'] ?? '';

    $no_rujukan        = 'PBNP/KELAS ' . $kelas . '/' . $year . '/' . str_pad($data['id'] ?? 0, 4, '0', STR_PAD_LEFT);
    $tarikh_borang     = isset($data['tarikh_hantar']) ? date('d/m/Y', strtotime((string)$data['tarikh_hantar'])) : date('d/m/Y');
    $jenis_peperiksaan = 'BOLA SEPAK KELAS ' . $kelas . ' FAM';

    $pdf->setCreator(PDF_CREATOR);
    $pdf->setAuthor('Persatuan Bolasepak Negeri Pahang');
    $pdf->setTitle('Borang R-11 Permohonan Kelas ' . $kelas . ' - ' . $nama);
    $pdf->setSubject('Borang R-11');

    // Remove default header/footer
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);

      // Borang R11 label in top right corner
    $pdf->setFont('helvetica', 'I', 7);
    $pdf->Cell(0, 5, 'Borang R11', 0, 1, 'R');
    $pdf->ln(2);

    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);

    $pageW = $pdf->getPageWidth() - $pdf->getMargins()['left'] - $pdf->getMargins()['right'];
    $rowH  = 7;

    // ── HEADER ──────────────────────────────────────────────────────────────
    $logoPath = $_SERVER['DOCUMENT_ROOT'] . '/assets/Pahang_FA_logo.png';
    $logoW    = 17;
    $headerY  = $pdf->GetY();

    if (file_exists($logoPath)) {
        $pdf->Image($logoPath,
            $pdf->getMargins()['left'],
            $headerY, $logoW, $logoW);
    }

    $pdf->setFont('helvetica', 'B', 13);
    $pdf->Cell(0, 7, 'PERSATUAN BOLASEPAK NEGERI PAHANG', 0, 1, 'C');
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->Cell(0, 6, 'PAHANG FOOTBALL ASSOCIATION', 0, 1, 'C');
    $pdf->setFont('helvetica', 'I', 7.5);
    $pdf->Cell(0, 5, '(Ahli gabungan Persatuan Bolasepak Malaysia dan berdaftar dengan Pesurujaya Sukan Malaysia 0077/98)', 0, 1, 'C');

    $pdf->ln(3);
    $lY = $pdf->GetY();
    $pdf->Line($pdf->getMargins()['left'], $lY, $pdf->getPageWidth() - $pdf->getMargins()['right'], $lY);
    $pdf->ln(4);

    // ── R-11 label + tajuk kursus ───────────────────────────────────────────
    $pdf->setFont('helvetica', 'BI', 30);
    $pdf->Cell(28, 18, 'R-11', 0, 0, 'L');
    $pdf->setFont('helvetica', 'I', 11);
    $pdf->MultiCell(0, 6, "PERMOHONAN MENGIKUTI KURSUS\nPENGADIL BOLASEPAK\nPENGADIL FUTSAL", 0, 'L', false, 1);

    $pdf->ln(2);
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(100, 5, 'No. Rujukan: ' . $no_rujukan, 0, 0, 'L');
    $pdf->Cell(0, 5, 'Tarikh: ' . $tarikh_borang, 0, 1, 'R');
    $pdf->ln(2);

    // ── Helper: dark section header ─────────────────────────────────────────
    $mkHdr = function(string $text) use ($pdf) {
        $pdf->setFillColor(0, 0, 0);
        $pdf->setTextColor(255, 255, 255);
        $pdf->setFont('helvetica', 'BI', 10);
        $pdf->Cell(0, 8, '    ' . $text, 'LRTB', 1, 'L', true);
        $pdf->setTextColor(0, 0, 0);
        $pdf->setFont('helvetica', '', 9);
    };

    $half = $pageW / 2;

    // ── MAKLUMAT PEMOHON ────────────────────────────────────────────────────
    $mkHdr('MAKLUMAT PEMOHON');
    $pdf->Cell($half, $rowH, 'Nama Penuh: ' . $nama, 1, 0, 'L');
    $pdf->Cell(0,    $rowH, 'No. KP: ' . $no_kp, 1, 1, 'L');
    $pdf->Cell($half, $rowH, 'Alamat Emel: ' . $emel, 1, 0, 'L');
    $pdf->Cell(0,    $rowH, 'No. Telefon: ' . $telefon, 1, 1, 'L');
    $pdf->Cell($half, $rowH, 'Jantina: ' . $jantina, 1, 0, 'L');
    $pdf->Cell(0,    $rowH, 'Jenis Peperiksaan: ' . $jenis_peperiksaan, 1, 1, 'L');
    $pdf->Cell(0,    $rowH, 'Alamat : ' . $fullAlamat, 1, 1, 'L');
    $pdf->ln(2);

    // ── MAKLUMAT TEMPAT KERJA ───────────────────────────────────────────────
    $mkHdr('MAKLUMAT TEMPAT KERJA');
    $pdf->Cell($half, $rowH, 'Status Kerja: ' . $status_kerja, 1, 0, 'L');
    $pdf->Cell(0,    $rowH, 'Jawatan: ' . $jawatan, 1, 1, 'L');
    $pdf->Cell(0,    $rowH, 'Nama Majikan: ' . $nama_majikan, 1, 1, 'L');
    $pdf->Cell(0,    $rowH, 'Alamat : ' . $alamat_majikan, 1, 1, 'L');
    $pdf->ln(2);

    // ── MAKLUMAT WARIS TERDEKAT ─────────────────────────────────────────────
    $mkHdr('MAKLUMAT WARIS TERDEKAT');
    $pdf->Cell(0,    $rowH, 'Nama Waris: ' . $nama_waris, 1, 1, 'L');
    $pdf->Cell($half, $rowH, 'No. Telefon Waris: ' . $telefon_waris, 1, 0, 'L');
    $pdf->Cell(0,    $rowH, 'Hubungan: ' . $hubungan, 1, 1, 'L');
    $pdf->ln(2);

    // ── MAKLUMAT PERSATUAN BOLA SEPAK DAERAH ───────────────────────────────
    $mkHdr('MAKLUMAT PERSATUAN BOLA SEPAK DAERAH ' . $district_nama);
    $pdf->Cell(0,    $rowH, 'Nama Pegawai Pembangunan : ' . $pp_nama, 1, 1, 'L');
    $pdf->Cell($half, $rowH, 'No, Telefon : ' . $pp_telefon, 1, 0, 'L');
    $pdf->Cell(0,    $rowH, 'Alamat Emel : ' . $pp_emel, 1, 1, 'L');
    $pdf->ln(2);

    // ── PENGAKUAN ───────────────────────────────────────────────────────────
    $mkHdr('PENGAKUAN');
    $pdf->setFont('helvetica', '', 9);
    $pdf->MultiCell(0, $rowH - 1,
        'Saya mengaku bahawa saya tidak akan menuntut sebarang ganti rugi daripada PBNP / Pengelola jika berlaku apa-apa kemalangan pada saya, sebelum, semasa, selepas penyertaan di dalam kursus ini.',
        1, 'L', false, 1);

    $pdf->ln(4);
    $pdf->Cell(0, 5, 'Terima kasih', 0, 1, 'L');
    $pdf->ln(2);
    $pdf->Cell(0, 5, 'Saya yang benar', 0, 1, 'L');
    $pdf->ln(10);

    // Tandatangan pemohon
    $sigW = ($pageW - 10) / 2;
    $pdf->Cell($sigW, 5, '', 'B', 0, 'C');
    $pdf->Cell(10,   5, '', 0,   0, 'C');
    $pdf->Cell(0,    5, '', 'B', 1, 'C');
    $pdf->Cell($sigW, 5, 'Tandatangan pemohon', 0, 0, 'C');
    $pdf->Cell(10,   5, '', 0,   0, 'C');
    $pdf->Cell(0,    5, 'Tarikh', 0, 1, 'C');
    $pdf->ln(3);
    $pdf->Cell(0, 5, 'Nama   ' . $nama, 0, 1, 'L');
    $pdf->Cell(0, 5, 'MYKad  ' . $no_kp, 0, 1, 'L');
    $pdf->ln(4);

    // ── UNTUK KEGUNAAN PBNP ────────────────────────────────────────────────
    $mkHdr('UNTUK KEGUNAAN PERSATUAN BOLASEPAK NEGERI PAHANG');
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(0,  $rowH, 'Permohonan dilulus / ditolak', 0, 1, 'L');
    $pdf->Cell(50, $rowH, 'No. Pendaftaran', 0, 0, 'L');
    $pdf->Cell(0,  $rowH, '', 'B', 1, 'L');
}
?>