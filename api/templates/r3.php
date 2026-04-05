<?php
/**
 * R3 - DATA DIRI PEGAWAI PERLAWANAN (BUTIRAN PERIBADI PENGADIL)
 * Borang Ujian Kelas 3 FAM
 * Format mengikut Borang R3 rasmi FAM
 */
function generateR3Pdf($pdf, $data) {
    $pdf->setCreator(PDF_CREATOR);
    $pdf->setAuthor('Persatuan Bolasepak Negeri Pahang');
    $pdf->setTitle('Borang R3 - Data Diri Pegawai Perlawanan - ' . strtoupper($data['nama_penuh'] ?? ''));
    $pdf->setSubject('Borang R3');
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);

    $nama = strtoupper($data['nama_penuh'] ?? '');
    $no_ic = strtoupper($data['no_ic'] ?? $data['no_kp'] ?? '');
    $email = strtolower($data['user_email'] ?? $data['emel'] ?? '');
    $tahun = $data['tahun_permohonan'] ?? date('Y');

    // Calculate age and DOB from IC if available
    $tarikh_lahir = $data['tarikh_lahir'] ?? '';
    $umur = $data['umur'] ?? '';
    $tempat_lahir = strtoupper($data['tempat_lahir'] ?? '');
    if (empty($tarikh_lahir) && !empty($no_ic)) {
        $ic = str_replace('-', '', $no_ic);
        if (strlen($ic) >= 6) {
            $yy = substr($ic, 0, 2);
            $mm = substr($ic, 2, 2);
            $dd = substr($ic, 4, 2);
            $year = ((int)$yy > 30) ? '19' . $yy : '20' . $yy;
            $tarikh_lahir = $dd . '/' . $mm . '/' . $year;
            if (empty($umur)) {
                $umur = (int)$tahun - (int)$year;
            }
        }
    }

    // Label widths
    $lbl = 38;  // label column
    $val = 50;  // value column
    $lbl2 = 35; // second label
    $val2 = 57; // second value (total = 180)
    $fullVal = 142; // full width value
    $rowH = 6;

    // --- R3 label top right ---
    $pdf->setFont('helvetica', 'B', 10);
    $pdf->Cell(0, 5, 'R3', 0, 1, 'R');
    $pdf->ln(1);

    // --- No. Rujukan & Tarikh ---
    $no_rujukan_r3 = 'PBNP/R3/' . $tahun . '/' . str_pad($data['id'] ?? 0, 4, '0', STR_PAD_LEFT);
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(100, 5, 'No. Rujukan: ' . $no_rujukan_r3, 0, 0, 'L');
    $pdf->Cell(0, 5, 'Tarikh: ' . date('d/m/Y'), 0, 1, 'R');
    $pdf->ln(1);

    // --- Title ---
    $pdf->setFont('helvetica', 'B', 12);
    $pdf->Cell(0, 7, 'DATA DIRI PEGAWAI PERLAWANAN ' . $tahun, 0, 1, 'L');
    $pdf->setFont('helvetica', 'I', 8);
    $pdf->Cell(0, 5, '( BUTIR-BUTIR HENDAKLAH DITAIP DALAM KOMPUTER)', 0, 1, 'L');
    $pdf->ln(3);

    // --- Negeri & Kategori ---
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(20, $rowH, 'NEGERI  :', 0, 0, 'L');
    $pdf->setFont('helvetica', 'B', 9);
    $pdf->Cell(70, $rowH, 'PAHANG', 'B', 0, 'L');
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(25, $rowH, 'KATEGORI', 0, 0, 'L');
    $pdf->setFont('helvetica', 'B', 9);
    $pdf->Cell(65, $rowH, strtoupper($data['jenis_pengadil'] ?? 'PENGADIL'), 'B', 1, 'L');
    $pdf->ln(5);

    // === BUTIR-BUTIR PERIBADI ===
    $pdf->setFont('helvetica', 'B', 10);
    $pdf->Cell(0, 7, 'BUTIR-BUTIR PERIBADI', 0, 1, 'L');
    $pdf->ln(2);

    $pdf->setFont('helvetica', '', 8);

    // Row: Nama Penuh
    $pdf->Cell($lbl, $rowH, 'Nama Penuh', 'LTB', 0, 'L');
    $pdf->setFont('helvetica', 'B', 8);
    $pdf->Cell($fullVal, $rowH, $nama, 'TRB', 1, 'L');
    $pdf->setFont('helvetica', '', 8);

    // Row: No KP
    $pdf->Cell($lbl, $rowH, 'No. Kad Pengenalan Baru', 'LTB', 0, 'L');
    $pdf->setFont('helvetica', 'B', 8);
    $pdf->Cell($fullVal, $rowH, $no_ic, 'TRB', 1, 'L');
    $pdf->setFont('helvetica', '', 8);

    // Row: Tarikh Lahir | Umur
    $pdf->Cell($lbl, $rowH, 'Tarikh Lahir', 'LTB', 0, 'L');
    $pdf->Cell($val, $rowH, $tarikh_lahir, 'TB', 0, 'L');
    $pdf->Cell($lbl2, $rowH, 'Umur Pada Tahun ' . $tahun, 'LTB', 0, 'L');
    $pdf->setFont('helvetica', 'B', 8);
    $pdf->Cell($val2, $rowH, $umur, 'TRB', 1, 'L');
    $pdf->setFont('helvetica', '', 8);

    // Row: Tempat Lahir
    $pdf->Cell($lbl, $rowH, 'Tempat Lahir', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $tempat_lahir, 'TRB', 1, 'L');

    // Row: Pekerjaan
    $pekerjaan = strtoupper($data['jawatan'] ?? $data['status_kerja'] ?? '');
    $pdf->Cell($lbl, $rowH, 'Pekerjaan', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $pekerjaan, 'TRB', 1, 'L');

    // Row: Hobi
    $pdf->Cell($lbl, $rowH, 'Hobi', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, '', 'TRB', 1, 'L');

    // Row: Taraf Perkahwinan | Bilangan Anak
    $pdf->Cell($lbl, $rowH, 'Taraf Perkahwinan', 'LTB', 0, 'L');
    $pdf->Cell($val, $rowH, '', 'TB', 0, 'L');
    $pdf->Cell($lbl2, $rowH, 'Bilangan Anak', 'LTB', 0, 'L');
    $pdf->Cell($val2, $rowH, '', 'TRB', 1, 'L');

    // Row: Lapangan Terbang Terdekat
    $pdf->Cell($lbl, $rowH, 'Lapangan Terbang Terdekat', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, '', 'TRB', 1, 'L');

    // Row: Bandar/Pekan Paling Hampir
    $pdf->Cell($lbl, $rowH, 'Bandar/Pekan Paling Hampir', 'LTB', 0, 'L');
    $daerah = strtoupper($data['daerah'] ?? '');
    $pdf->Cell($fullVal, $rowH, $daerah, 'TRB', 1, 'L');

    // Row: Nama Bank | No Akaun Bank
    $pdf->Cell($lbl, $rowH, 'Nama Bank', 'LTB', 0, 'L');
    $pdf->Cell($val, $rowH, '', 'TB', 0, 'L');
    $pdf->Cell($lbl2, $rowH, 'No Akaun Bank', 'LTB', 0, 'L');
    $pdf->Cell($val2, $rowH, '', 'TRB', 1, 'L');

    // Row: Akademik
    $pdf->Cell($lbl, $rowH, 'Akademik : SRP/LCE/MCE/', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, '', 'TRB', 1, 'L');
    $pdf->Cell($lbl, $rowH, 'STPM/Diploma/Ijazah/Sarjana/Phd', 'LB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, '', 'RB', 1, 'L');

    // Row: Alamat Rumah (3 lines)
    $alamat_rumah = strtoupper($data['alamat1'] ?? '');
    $alamat_rumah2 = strtoupper($data['alamat2'] ?? '');
    $alamat_negeri = strtoupper($data['negeri'] ?? 'PAHANG');
    $poskod_rumah = $data['poskod'] ?? '';

    $pdf->Cell($lbl, $rowH, 'Alamat Rumah', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $alamat_rumah, 'TRB', 1, 'L');
    $pdf->Cell($lbl, $rowH, '', 'LB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $alamat_rumah2, 'RB', 1, 'L');
    $pdf->Cell($lbl, $rowH, '', 'LB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $alamat_negeri, 'RB', 1, 'L');

    // Poskod Rumah
    $pdf->Cell($lbl, $rowH, 'Poskod', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $poskod_rumah, 'TRB', 1, 'L');

    // Row: Alamat Pejabat (3 lines)
    $alamat_pejabat1 = strtoupper($data['alamat_majikan1'] ?? '');
    $alamat_pejabat2 = strtoupper($data['alamat_majikan2'] ?? '');
    $negeri_majikan = strtoupper($data['negeri_majikan'] ?? '');
    $poskod_pejabat = $data['poskod_majikan'] ?? '';

    $pdf->Cell($lbl, $rowH, 'Alamat Pejabat', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $alamat_pejabat1, 'TRB', 1, 'L');
    $pdf->Cell($lbl, $rowH, '', 'LB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $alamat_pejabat2, 'RB', 1, 'L');
    $pdf->Cell($lbl, $rowH, '', 'LB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $negeri_majikan, 'RB', 1, 'L');

    // Poskod Pejabat
    $pdf->Cell($lbl, $rowH, 'Poskod', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $poskod_pejabat, 'TRB', 1, 'L');

    // Surat Menyurat
    $pdf->Cell(0, $rowH, 'Surat Menyurat Dialamatkan Ke Rumah * / Pejabat', 'LTRB', 1, 'L');
    $pdf->ln(3);

    // === TELEFON & PASPORT ===
    $pdf->setFont('helvetica', 'B', 9);
    $pdf->Cell(90, $rowH, 'TELEFON', 'LTB', 0, 'L');
    $pdf->Cell(90, $rowH, 'PASPORT ANTARABANGSA', 'TRB', 1, 'L');
    $pdf->setFont('helvetica', '', 8);

    // Telefon rows | Pasport rows
    $pdf->Cell(25, $rowH, 'Rumah', 'LTB', 0, 'L');
    $pdf->Cell(65, $rowH, '', 'TB', 0, 'L');
    $pdf->Cell(35, $rowH, 'No. Pasport', 'LTB', 0, 'L');
    $pdf->Cell(55, $rowH, '', 'TRB', 1, 'L');

    $pdf->Cell(25, $rowH, 'Pejabat', 'LTB', 0, 'L');
    $pdf->Cell(65, $rowH, '', 'TB', 0, 'L');
    $pdf->Cell(35, $rowH, 'Tarikh Dikeluarkan', 'LTB', 0, 'L');
    $pdf->Cell(55, $rowH, '', 'TRB', 1, 'L');

    $no_telefon = strtoupper($data['no_telefon'] ?? '');
    $pdf->Cell(25, $rowH, 'Bimbit', 'LTB', 0, 'L');
    $pdf->Cell(65, $rowH, $no_telefon, 'TB', 0, 'L');
    $pdf->Cell(35, $rowH, 'Tempat Dikeluarkan', 'LTB', 0, 'L');
    $pdf->Cell(55, $rowH, '', 'TRB', 1, 'L');

    $pdf->Cell(25, $rowH, 'No. Faksimili', 'LTB', 0, 'L');
    $pdf->Cell(65, $rowH, '', 'TB', 0, 'L');
    $pdf->Cell(35, $rowH, 'Tarikh Tamat Tempoh', 'LTB', 0, 'L');
    $pdf->Cell(55, $rowH, '', 'TRB', 1, 'L');

    $pdf->Cell(25, $rowH, 'E-Mail', 'LTB', 0, 'L');
    $pdf->Cell(65, $rowH, $email, 'TB', 0, 'L');
    $pdf->Cell(90, $rowH, 'Sila Sertakan Salinan Pasport', 'LTRB', 1, 'L');
    $pdf->ln(3);

    // === UKURAN ===
    $pdf->setFont('helvetica', 'B', 9);
    $pdf->Cell(0, $rowH, 'UKURAN - * 3, 4, 5, 6, 7, 8, 9, 10', 0, 1, 'L');

    $pdf->setFont('helvetica', '', 8);
    $pdf->Cell(25, $rowH, 'Tinggi (cm)', 1, 0, 'C');
    $pdf->Cell(25, $rowH, 'Berat (kg)', 1, 0, 'C');
    $pdf->Cell(35, $rowH, 'Tracksuit *', 1, 0, 'C');
    $pdf->Cell(30, $rowH, 'Baju T *', 1, 0, 'C');
    $pdf->Cell(30, $rowH, 'Seluar *', 1, 0, 'C');
    $pdf->Cell(35, $rowH, 'Kasut *', 1, 1, 'C');

    // Values row
    $saiz = strtoupper($data['saiz_baju'] ?? '');
    $pdf->Cell(25, $rowH, '', 1, 0, 'C');
    $pdf->Cell(25, $rowH, '', 1, 0, 'C');
    $pdf->Cell(35, $rowH, $saiz, 1, 0, 'C');
    $pdf->Cell(30, $rowH, $saiz, 1, 0, 'C');
    $pdf->Cell(30, $rowH, '', 1, 0, 'C');
    $pdf->Cell(35, $rowH, '', 1, 1, 'C');
    $pdf->ln(3);

    // === MAJIKAN ===
    $pdf->setFont('helvetica', 'B', 9);
    $pdf->Cell(0, $rowH, 'MAJIKAN - Urusan Cuti Tanpa Rekod', 0, 1, 'L');
    $pdf->setFont('helvetica', '', 8);

    $nama_majikan = strtoupper($data['nama_majikan'] ?? '');
    $jawatan = strtoupper($data['jawatan'] ?? '');
    $majikan_jawatan = $nama_majikan;
    if (!empty($jawatan)) $majikan_jawatan .= ' / ' . $jawatan;

    $pdf->Cell($lbl, $rowH, 'Majikan / Jawatan', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $majikan_jawatan, 'TRB', 1, 'L');

    $pdf->Cell($lbl, $rowH, 'Alamat Majikan', 'LTB', 0, 'L');
    $alamat_majikan_full = $alamat_pejabat1;
    if (!empty($alamat_pejabat2)) $alamat_majikan_full .= ', ' . $alamat_pejabat2;
    if (!empty($negeri_majikan)) $alamat_majikan_full .= ', ' . $negeri_majikan;
    $pdf->Cell($fullVal, $rowH, $alamat_majikan_full, 'TRB', 1, 'L');

    $pdf->Cell($lbl, $rowH, 'Poskod', 'LTB', 0, 'L');
    $pdf->Cell($fullVal, $rowH, $poskod_pejabat, 'TRB', 1, 'L');
    $pdf->ln(3);

    // === LAIN-LAIN (Kelayakan/Peperiksaan) ===
    $pdf->setFont('helvetica', 'B', 9);
    $pdf->Cell(0, $rowH, 'LAIN-LAIN', 0, 1, 'L');
    $pdf->setFont('helvetica', '', 8);

    $tahunKelas3 = $data['tahun_lulus_kelas3'] ?? '';

    // Row 1: Lulus Peperiksaan Bertulis - Pengadil Kebangsaan
    $pdf->Cell(40, $rowH, 'Lulus Peperiksaan Bertulis', 'LTB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(45, $rowH, '', 'TB', 0, 'L');
    $pdf->Cell(30, $rowH, 'Pengadil Kebangsaan', 'TB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Tahun', 'TB', 0, 'L');
    $pdf->Cell(20, $rowH, '', 'TB', 0, 'C');
    $pdf->Cell(12, $rowH, 'No. Sijil', 'TB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(3, $rowH, '', 'TRB', 1, 'L');

    // Row 2: Kelas II FAM | Kelas III FAM
    $pdf->Cell(20, $rowH, 'Kelas II FAM', 'LTB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Tahun', 'TB', 0, 'L');
    $pdf->Cell(15, $rowH, '', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'No. Sijil', 'TB', 0, 'L');
    $pdf->Cell(20, $rowH, '', 'TB', 0, 'L');
    $pdf->setFont('helvetica', 'B', 8);
    $pdf->Cell(20, $rowH, 'Kelas III FAM', 'TB', 0, 'L');
    $pdf->setFont('helvetica', '', 8);
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Tahun', 'TB', 0, 'L');
    $pdf->setFont('helvetica', 'B', 8);
    $pdf->Cell(15, $rowH, $tahunKelas3, 'TB', 0, 'C');
    $pdf->setFont('helvetica', '', 8);
    $pdf->Cell(12, $rowH, 'No. Sijil', 'TB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(3, $rowH, '', 'TRB', 1, 'L');

    $pdf->ln(1);

    // Row 3: Pengadil Kebangsaan | Pengadil FIFA
    $pdf->Cell(30, $rowH, 'Pengadil Kebangsaan', 'LTB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Tahun', 'TB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, '', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Hingga', 'TB', 0, 'L');
    $pdf->Cell(15, $rowH, '', 'TB', 0, 'C');
    $pdf->Cell(25, $rowH, 'Pengadil FIFA', 'TB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Tahun', 'TB', 0, 'L');
    $pdf->Cell(35, $rowH, 'Hingga', 'TRB', 1, 'L');

    $pdf->ln(1);

    // Row 4: Penolong Pengadil FIFA | Pengadil FIFA Futsal
    $pdf->Cell(30, $rowH, 'Penolong Pengadil FIFA', 'LTB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Tahun', 'TB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, '', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Hingga', 'TB', 0, 'L');
    $pdf->Cell(15, $rowH, '', 'TB', 0, 'C');
    $pdf->Cell(30, $rowH, 'Pengadil FIFA Futsal:', 'TB', 0, 'L');
    $pdf->Cell(15, $rowH, 'Tahun', 'TB', 0, 'L');
    $pdf->Cell(40, $rowH, 'Hingga', 'TRB', 1, 'L');

    $pdf->ln(1);

    // Row 5: Pengadil B/Sepak Pantai
    $pdf->Cell(30, $rowH, 'Pengadil B/Sepak Pantai', 'LTB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Tahun', 'TB', 0, 'L');
    $pdf->Cell(5, $rowH, ':', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, '', 'TB', 0, 'C');
    $pdf->Cell(15, $rowH, 'Hingga', 'TB', 0, 'L');
    $pdf->Cell(95, $rowH, '', 'TRB', 1, 'L');

    $pdf->ln(8);

    // --- Tandatangan ---
    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(20, 7, 'Tarikh', 0, 0, 'L');
    $pdf->Cell(5, 7, ':', 0, 0, 'C');
    $pdf->Cell(50, 7, '', 'B', 0, 'L');
    $pdf->Cell(20, 7, '', 0, 0, 'L');
    $pdf->Cell(25, 7, 'Tandatangan', 0, 0, 'L');
    $pdf->Cell(60, 7, '', 'B', 1, 'L');
    $pdf->ln(1);
    $pdf->setFont('helvetica', '', 7);
    $pdf->Cell(95, 5, '', 0, 0, 'L');
    $pdf->Cell(85, 5, '(' . $nama . ')', 0, 1, 'L');
    $pdf->ln(3);

    $pdf->setFont('helvetica', 'I', 7);
    $pdf->Cell(0, 4, '* Sila Potong Yang Tidak Berkenaan', 0, 1, 'L');

    // Footer
    $pdf->ln(2);
    $pdf->setFont('helvetica', 'I', 7);
    $pdf->Cell(0, 4, 'Borang ini adalah untuk kegunaan rasmi Unit Pengadil Persatuan Bolasepak Negeri Pahang sahaja.', 0, 1, 'C');
    $pdf->Cell(0, 4, 'Cetakan komputer pada ' . date('d/m/Y H:i:s'), 0, 1, 'C');
}
?>
