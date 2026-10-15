<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../api/templates/r1.php';
require_once __DIR__ . '/../api/templates/r1_penilai.php';
require_once __DIR__ . '/../api/templates/r2.php';
require_once __DIR__ . '/../api/templates/r4.php';

/** Jana salinan R1, R2 dan R4 daripada rekod permohonan tahunan. */
function buildPendaftaranTahunanPdf(PDO $pdo, int $applicationId, ?string $form = null): string
{
    if ($form !== null && !in_array($form, ['r1', 'r2', 'r4'], true)) {
        throw new InvalidArgumentException('Jenis borang tidak sah.');
    }
    $stmt = $pdo->prepare("
        SELECT p.*, u.tahun_mula_aktif AS user_tahun_mula_aktif,
               u.tahun_lulus_kelas3, u.url_gambar_profil AS user_gambar_profil,
               u.persatuan_id AS user_persatuan_id
        FROM permohonan p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = ? AND p.jenis_borang IN ('pengadil_berdaftar', 'penilai_berdaftar')
        LIMIT 1
    ");
    $stmt->execute([$applicationId]);
    $data = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$data) {
        throw new RuntimeException('Permohonan pendaftaran tahunan tidak dijumpai.');
    }

    $isPenilai = $data['jenis_borang'] === 'penilai_berdaftar';
    if ($isPenilai && $form !== null && $form !== 'r1') {
        throw new InvalidArgumentException('Pendaftaran RA hanya mempunyai borang R1.');
    }

    $data['no_ic'] = $data['no_kp'];
    $data['user_email'] = $data['emel'];
    $data['tahun_mula_aktif'] = $data['tahun_mula_aktif'] ?: $data['user_tahun_mula_aktif'];
    $data['url_gambar_profil'] = $data['url_gambar_profil'] ?: $data['user_gambar_profil'];
    $districtId = $data['district_id'] ?: ($data['persatuan_id'] ?: $data['user_persatuan_id']);
    $data['district_id'] = $districtId;
    $data['district_nama'] = '';
    $data['pp_daerah_nama'] = '';
    $data['pp_telefon'] = '';
    $data['pp_emel'] = '';
    if ($districtId) {
        $districtStmt = $pdo->prepare('SELECT nama_persatuan FROM persatuan_bolasepak_daerah WHERE id = ?');
        $districtStmt->execute([$districtId]);
        $data['district_nama'] = (string) ($districtStmt->fetchColumn() ?: '');

        $ppStmt = $pdo->prepare("SELECT nama_penuh, no_telefon, email FROM users WHERE role = 'PP Daerah' AND persatuan_id = ? LIMIT 1");
        $ppStmt->execute([$districtId]);
        $pp = $ppStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $data['pp_daerah_nama'] = $pp['nama_penuh'] ?? '';
        $data['pp_telefon'] = $pp['no_telefon'] ?? '';
        $data['pp_emel'] = $pp['email'] ?? '';
    }

    $pdf = new TCPDF(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);
    $pdf->setMargins(15, 15, 15);
    $pdf->AddPage();
    if ($isPenilai) {
        generateR1PenilaiPdf($pdf, $data);
        return $pdf->Output('', 'S');
    }
    if ($form === null || $form === 'r1') {
        generateR1Pdf($pdf, $data);
    }
    if ($form === null || $form === 'r2') {
        if ($form === null) {
            $pdf->AddPage();
        }
        generateR2Pdf($pdf, $data, $pdo);
    }
    // R4 mengandungi perakuan kesihatan dan ruang tandatangan pemohon.
    if ($form === null || $form === 'r4') {
        if ($form === null) {
            $pdf->AddPage();
        }
        generateR4Pdf($pdf, $data);
    }
    return $pdf->Output('', 'S');
}

/** Pemohon Kelas III FAM menerima R4 untuk perakuan kesihatan bertandatangan. */
function buildBorangKecergasanKelas3Pdf(PDO $pdo, int $applicationId): string
{
    $stmt = $pdo->prepare("SELECT p.*, COALESCE(NULLIF(p.emel, ''), u.email) AS user_email
        FROM permohonan p JOIN users u ON u.id = p.user_id
        WHERE p.id = ? AND p.jenis_borang = 'kelas3_fam' LIMIT 1");
    $stmt->execute([$applicationId]);
    $data = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$data) {
        throw new RuntimeException('Permohonan Kelas III FAM tidak dijumpai.');
    }
    $pdf = new TCPDF(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);
    $pdf->setMargins(15, 15, 15);
    $pdf->AddPage();
    generateR4Pdf($pdf, $data);
    return $pdf->Output('', 'S');
}
