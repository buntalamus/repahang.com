<?php
declare(strict_types=1);

require_once __DIR__ . '/email.php';

/** Mulai sesi 2027, keputusan kecergasan menentukan patch/lesen, bukan pendaftaran tahunan. */
function requiresAnnualFitnessResult(array $application): bool
{
    return ($application['jenis_borang'] ?? '') === 'pengadil_berdaftar'
        && (int) ($application['tahun_permohonan'] ?? 0) >= 2027
        && !in_array(($application['jenis_pengadil'] ?? ''), ['Penilai Pengadil', 'Pegawai Pembangunan'], true);
}

function sendAnnualRegistrationStageEmail(array $application, string $stage, string $notes = ''): bool
{
    $name = (string) ($application['nama_penuh'] ?? 'Pemohon');
    $to = (string) (($application['user_email'] ?? '') ?: ($application['emel'] ?? ''));
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $year = (int) ($application['tahun_permohonan'] ?? 0);
    $title = '';
    $accent = '#2563EB';
    $body = emailGreeting($name);
    if ($stage === 'documents') {
        $title = 'Semakan Permohonan Diluluskan';
        $body .= emailPara('Permohonan dan dokumen anda telah disahkan. Anda kini Pengadil Berdaftar bagi sesi ini. Kelayakan patch dan lesen Pengadil Negeri menunggu keputusan ujian kecergasan.');
    } elseif ($stage === 'fitness_pass') {
        $title = 'Keputusan Ujian Kecergasan: Lulus';
        $accent = '#16A34A';
        $body .= emailPara('Tahniah. Anda kekal Pengadil Berdaftar dan layak menerima patch serta lesen Pengadil Negeri bagi sesi ' . $year . '.');
    } elseif ($stage === 'fitness_fail') {
        $title = 'Keputusan Ujian Kecergasan: Tidak Lulus';
        $accent = '#DC2626';
        $body .= emailPara('Anda kekal Pengadil Berdaftar bagi sesi ' . $year . ', tetapi tidak layak menerima patch atau lesen Pengadil Negeri kerana tidak lulus ujian kecergasan.');
    } elseif ($stage === 'fitness_absent') {
        $title = 'Keputusan Ujian Kecergasan: Tidak Hadir';
        $accent = '#B45309';
        $body .= emailPara('Anda kekal Pengadil Berdaftar bagi sesi ' . $year . ', tetapi tidak layak menerima patch atau lesen Pengadil Negeri kerana tidak hadir ujian kecergasan.');
    } elseif ($stage === 'registered') {
        $title = 'Kelayakan Patch Pengadil Negeri';
        $accent = '#16A34A';
        $body .= emailPara('Keputusan ujian kecergasan anda ialah Lulus. Anda layak menerima patch dan lesen Pengadil Negeri bagi sesi ' . $year . '.');
    } else {
        throw new InvalidArgumentException('Peringkat emel tidak sah.');
    }
    $body .= emailInfoTable([
        'No. Permohonan' => '#' . (int) $application['id'],
        'Sesi' => (string) $year,
    ]);
    if ($notes !== '') {
        $body .= emailAlert($accent, '#F9FAFB', 'Catatan Admin', htmlspecialchars($notes, ENT_QUOTES, 'UTF-8'));
    }
    $body .= emailButton((string) env('BASE_URL', 'https://refpahang.com') . '/pengadil', 'Semak Permohonan');
    return sendEmail($to, $title . ' - PBNP', buildEmailTemplate($title, $accent, '', $body), $name, 'daftar');
}
