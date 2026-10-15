<?php
declare(strict_types=1);

/** Borang R1 pendaftaran tahunan Penilai Pengadil (RA). */
function generateR1PenilaiPdf(TCPDF $pdf, array $data): void
{
    $year = (int) ($data['tahun_permohonan'] ?? date('Y'));
    $name = strtoupper((string) ($data['nama_penuh'] ?? ''));
    $pdf->setCreator(PDF_CREATOR);
    $pdf->setAuthor('Persatuan Bolasepak Negeri Pahang');
    $pdf->setTitle('Borang R1 - Pendaftaran Tahunan Penilai Pengadil - ' . $name);
    $pdf->setSubject('Pendaftaran Tahunan Penilai Pengadil');
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);
    $pdf->setFillColor(0, 0, 0);

    $pdf->setFont('helvetica', 'B', 10);
    $pdf->Cell(0, 5, 'R1', 0, 1, 'R');
    $top = $pdf->GetY();
    $logo = ($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2)) . '/assets/Pahang_FA_logo.png';
    if (is_file($logo)) {
        $pdf->Image($logo, 15, $top, 18, 18);
    }
    $photoX = $pdf->getPageWidth() - $pdf->getMargins()['right'] - 27;
    $photo = (string) ($data['url_gambar_profil'] ?? '');
    $photoPath = ($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2)) . '/' . ltrim((string) (parse_url($photo, PHP_URL_PATH) ?: $photo), '/');
    if ($photo !== '' && is_file($photoPath)) {
        $pdf->Image($photoPath, $photoX, $top, 27, 29, '', '', '', true);
    } else {
        $pdf->Rect($photoX, $top, 27, 29);
        $pdf->setFont('helvetica', '', 7);
        $pdf->SetXY($photoX, $top + 22);
        $pdf->Cell(27, 4, 'Gambar Pemohon', 0, 0, 'C');
    }

    $pdf->SetXY(35, $top + 2);
    $pdf->setFont('helvetica', 'B', 12);
    $pdf->Cell($photoX - 37, 7, 'PERSATUAN BOLASEPAK NEGERI PAHANG', 0, 1, 'C');
    $pdf->SetX(35);
    $pdf->setFont('helvetica', 'B', 11);
    $pdf->Cell($photoX - 37, 6, 'PENDAFTARAN TAHUNAN', 0, 1, 'C');
    $pdf->SetX(35);
    $pdf->Cell($photoX - 37, 6, 'PENILAI PENGADIL', 0, 1, 'C');
    $pdf->SetY($top + 31);

    $pdf->setFont('helvetica', '', 9);
    $pdf->Cell(120, 6, 'No. Rujukan: PBNP/R1/RA/' . $year . '/' . str_pad((string) ($data['id'] ?? 0), 4, '0', STR_PAD_LEFT), 0, 0);
    $pdf->Cell(60, 6, 'Sesi: ' . $year, 0, 1, 'R');
    $pdf->Ln(2);

    $section = static function (string $title) use ($pdf): void {
        if ($pdf->GetY() + 11 > $pdf->getPageHeight() - 20) {
            $pdf->AddPage();
        }
        $pdf->setFont('helvetica', 'B', 10);
        $pdf->setTextColor(255, 255, 255);
        $pdf->Cell(180, 7, '  ' . $title, 0, 1, 'L', true);
        $pdf->setTextColor(0, 0, 0);
        $pdf->Ln(2);
        $pdf->setFont('helvetica', '', 9);
    };
    $row = static function (array $cells) use ($pdf): void {
        $height = 7.0;
        foreach ($cells as [$width, $value]) {
            $height = max($height, ceil($pdf->getStringHeight($width - 4, (string) $value) + 2));
        }
        if ($pdf->GetY() + $height > $pdf->getPageHeight() - 20) {
            $pdf->AddPage();
        }
        $x = $pdf->getMargins()['left'];
        $y = $pdf->GetY();
        foreach ($cells as [$width, $value, $border]) {
            $pdf->MultiCell($width, $height, (string) $value, $border, 'L', false, 0,
                $x, $y, true, 0, false, true, $height, 'M', true);
            $x += $width;
        }
        $pdf->SetXY($pdf->getMargins()['left'], $y + $height);
    };
    $address = static function (array $parts): string {
        $filled = array_filter(array_map(static fn($part) => trim((string) $part), $parts), static fn($part) => $part !== '');
        return strtoupper(implode(', ', $filled)) ?: '-';
    };

    $section('MAKLUMAT PEMOHON');
    $row([[35, 'Nama Penuh:', 'LTB'], [145, $name, 'TRB']]);
    $row([[35, 'No. KP:', 'LTB'], [55, (string) ($data['no_kp'] ?? ''), 'TB'], [35, 'No. Telefon:', 'LTB'], [55, (string) ($data['no_telefon'] ?? ''), 'TRB']]);
    $row([[35, 'Alamat Emel:', 'LTB'], [145, (string) ($data['emel'] ?? $data['user_email'] ?? ''), 'TRB']]);
    $row([[35, 'Daerah:', 'LTB'], [55, strtoupper((string) ($data['district_nama'] ?? $data['daerah'] ?? '')), 'TB'], [35, 'Jenis:', 'LTB'], [55, 'PENILAI PENGADIL', 'TRB']]);
    $row([[35, 'Alamat:', 'LTB'], [145, $address([
        $data['alamat1'] ?? '', $data['alamat2'] ?? '',
        trim((string) (($data['poskod'] ?? '') . ' ' . ($data['daerah'] ?? ''))), $data['negeri'] ?? '',
    ]), 'TRB']]);
    $pdf->Ln(4);

    $section('MAKLUMAT PEKERJAAN');
    $row([[35, 'Status Kerja:', 'LTB'], [55, strtoupper((string) ($data['status_kerja'] ?? '-')), 'TB'], [35, 'Jawatan:', 'LTB'], [55, strtoupper((string) ($data['jawatan'] ?? '-')), 'TRB']]);
    $row([[35, 'Majikan:', 'LTB'], [145, strtoupper((string) ($data['nama_majikan'] ?? '-')), 'TRB']]);
    $row([[35, 'Alamat Majikan:', 'LTB'], [145, $address([
        $data['alamat_majikan1'] ?? '', $data['alamat_majikan2'] ?? '',
        trim((string) (($data['poskod_majikan'] ?? '') . ' ' . ($data['daerah_majikan'] ?? ''))), $data['negeri_majikan'] ?? '',
    ]), 'TRB']]);
    $pdf->Ln(4);

    $section('MAKLUMAT WARIS');
    $row([[35, 'Nama Waris:', 'LTB'], [55, strtoupper((string) ($data['nama_waris'] ?? '-')), 'TB'], [35, 'Hubungan:', 'LTB'], [55, strtoupper((string) ($data['hubungan_waris'] ?? '-')), 'TRB']]);
    $row([[35, 'Telefon Waris:', 'LTB'], [145, (string) ($data['telefon_waris'] ?? '-'), 'TRB']]);
    $pdf->Ln(5);

    $declaration = 'Saya memohon pendaftaran tahunan sebagai Penilai Pengadil bagi sesi ' . $year
        . '. Saya mengesahkan maklumat yang diberikan adalah benar dan bersetuju mematuhi peraturan serta etika pengadilan PBNP.';
    $reserve = 9 + $pdf->getStringHeight(178, $declaration) + 8 + 20 + 8;
    if ($pdf->GetY() + $reserve > $pdf->getPageHeight() - 20) {
        $pdf->AddPage();
    }
    $section('PERAKUAN PEMOHON');
    $pdf->MultiCell(180, 6, $declaration, 1, 'L', false, 1);
    $pdf->Ln(8);
    $pdf->Cell(88, 5, 'Tandatangan Pemohon: ______________________', 0, 0);
    $pdf->Cell(92, 5, 'Tarikh: ____________________', 0, 1);
    $pdf->Ln(7);
    $pdf->Cell(88, 5, 'Pengesahan PP Daerah: _____________________', 0, 0);
    $pdf->Cell(92, 5, 'Tarikh: ____________________', 0, 1);
    if (!empty($data['pp_daerah_nama'])) {
        $pdf->setFont('helvetica', '', 8);
        $pdf->MultiCell(180, 5, 'Nama PP Daerah: ' . strtoupper((string) $data['pp_daerah_nama']), 0, 'L');
    }
}
