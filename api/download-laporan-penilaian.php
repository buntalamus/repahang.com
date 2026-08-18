<?php
/**
 * Download / View Laporan Penilaian Pengadil (RA Report) — printable HTML
 * 
 * GET /api/download-laporan-penilaian.php?id=X                    — session auth
 * GET /api/download-laporan-penilaian.php?id=X&view_token=Y       — read-only signed link
 * 
 * Outputs full HTML page matching FAM RA Report format.
 * User presses Cmd+P / Ctrl+P → "Save as PDF" (A4 portrait).
 */

declare(strict_types=1);
date_default_timezone_set('Asia/Kuala_Lumpur');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/kriteria-penilaian.php';
require_once __DIR__ . '/../config/penilaian-helper.php';

$viewToken = trim($_GET['view_token'] ?? '');
$laporanId = (int) ($_GET['id'] ?? 0);
$autoprint = isset($_GET['print']);
$sessionUserId = 0;
$sessionRole = '';

try {
    $pdo = getDbConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo '<p>Gagal bersambung ke pangkalan data.</p>';
    exit;
}

/* ── Resolve access mode ── */
if ($viewToken !== '' && $laporanId > 0) {
    // Purpose-bound read-only link sent to KUP after admin confirmation.
    $stmt = $pdo->prepare("
        SELECT lp.penilaian_token
        FROM laporan_penilaian laporan
        JOIN lantikan_pengadil lp ON lp.id = laporan.lantikan_id
        WHERE laporan.id = :id
          AND lp.status = 'Diterima'
          AND lp.jawatan = 'Penilai Pengadil'
          AND laporan.status = 'Disahkan'
        LIMIT 1
    ");
    $stmt->execute([':id' => $laporanId]);
    $penilaianToken = (string) ($stmt->fetchColumn() ?: '');
    if (!verifyReportViewToken($laporanId, $penilaianToken, $viewToken)) {
        http_response_code(404);
        echo '<p style="font-family:sans-serif;color:red;padding:20px;">Laporan tidak dijumpai atau belum disahkan.</p>';
        exit;
    }
} elseif ($laporanId) {
    // Session-based auth
    if (session_status() === PHP_SESSION_NONE) {
        session_start([
            'cookie_httponly' => true,
            'cookie_secure'   => env('APP_ENV', 'production') !== 'development',
            'cookie_samesite' => 'Lax',
            'use_strict_mode' => true,
        ]);
    }
    if (empty($_SESSION['user_id'])) {
        http_response_code(403);
        echo '<p style="font-family:sans-serif;color:red;padding:20px;">Sila log masuk terlebih dahulu.</p>';
        exit;
    }
    $sessionUserId = (int) $_SESSION['user_id'];
    $sessionRole = $_SESSION['user_role'] ?? '';
    if (!in_array($sessionRole, ['Admin', 'Penilai', 'PP Daerah', 'Pengadil'], true)) {
        http_response_code(403);
        echo '<p style="font-family:sans-serif;color:red;padding:20px;">Akses tidak dibenarkan untuk peranan anda.</p>';
        exit;
    }
} else {
    http_response_code(400);
    echo '<p style="font-family:sans-serif;color:red;">Parameter id atau token diperlukan.</p>';
    exit;
}

/* ── Fetch report data ── */
$stmt = $pdo->prepare("
    SELECT lp.*,
           jp.no_perlawanan, jp.tarikh, jp.masa, jp.pasukan_home, jp.pasukan_away,
           jp.logo_home, jp.logo_away, jp.tempat,
           k.nama AS nama_kejohanan,
           k.logo_kiri, k.logo_kanan,
           COALESCE(u_pen.nama_penuh, pl_pen.nama) AS nama_penilai,
           COALESCE(u_pen.negeri, 'Pahang') AS penilai_negeri
    FROM laporan_penilaian lp
    JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
    JOIN kejohanan k ON jp.kejohanan_id = k.id
    LEFT JOIN users u_pen ON lp.penilai_id = u_pen.id
    LEFT JOIN lantikan_pengadil lp2 ON lp.lantikan_id = lp2.id
    LEFT JOIN pengadil_luar pl_pen ON lp2.pengadil_luar_id = pl_pen.id
    WHERE lp.id = :id AND lp.status = 'Disahkan'
");
$stmt->execute([':id' => $laporanId]);
$report = $stmt->fetch();

if (!$report) {
    http_response_code(404);
    echo '<p style="font-family:sans-serif;color:red;padding:20px;">Laporan tidak dijumpai atau belum disahkan.</p>';
    exit;
}

// Scope every non-admin role to the report it actually owns or supervises.
if ($viewToken === '' && $sessionRole === 'Pengadil') {
    $accessStmt = $pdo->prepare("
        SELECT 1
        FROM laporan_penilaian_pegawai lpp
        JOIN lantikan_pengadil la ON la.id = lpp.lantikan_pengadil_id
        WHERE lpp.laporan_id = :lid AND la.pengadil_id = :uid
        LIMIT 1
    ");
    $accessStmt->execute([':lid' => $laporanId, ':uid' => $sessionUserId]);
    if (!$accessStmt->fetchColumn()) {
        http_response_code(403);
        echo '<p style="font-family:sans-serif;color:red;padding:20px;">Anda tidak mempunyai akses kepada laporan ini.</p>';
        exit;
    }
} elseif ($viewToken === '' && $sessionRole === 'Penilai') {
    if ((int) ($report['penilai_id'] ?? 0) !== $sessionUserId) {
        http_response_code(403);
        echo '<p style="font-family:sans-serif;color:red;padding:20px;">Anda tidak mempunyai akses kepada laporan ini.</p>';
        exit;
    }
} elseif ($viewToken === '' && $sessionRole === 'PP Daerah') {
    $accessStmt = $pdo->prepare("
        SELECT 1
        FROM users pp
        WHERE pp.id = :uid
          AND (
                :penilai_id = :owner_uid
             OR EXISTS (
                    SELECT 1
                    FROM laporan_penilaian_pegawai lpp
                    JOIN lantikan_pengadil la ON la.id = lpp.lantikan_pengadil_id
                    JOIN users kup ON kup.id = la.pengadil_id
                    WHERE lpp.laporan_id = :lid
                      AND kup.persatuan_id = pp.persatuan_id
                )
          )
        LIMIT 1
    ");
    $accessStmt->execute([
        ':uid' => $sessionUserId,
        ':penilai_id' => (int) ($report['penilai_id'] ?? 0),
        ':owner_uid' => $sessionUserId,
        ':lid' => $laporanId,
    ]);
    if (!$accessStmt->fetchColumn()) {
        http_response_code(403);
        echo '<p style="font-family:sans-serif;color:red;padding:20px;">Anda tidak mempunyai akses kepada laporan ini.</p>';
        exit;
    }
}

/* ── Fetch pegawai data ── */
$stmt = $pdo->prepare("
    SELECT lpp.*,
           COALESCE(u.negeri, 'Pahang') AS negeri
    FROM laporan_penilaian_pegawai lpp
    LEFT JOIN lantikan_pengadil lp ON lpp.lantikan_pengadil_id = lp.id
    LEFT JOIN users u ON lp.pengadil_id = u.id
    WHERE lpp.laporan_id = :lid
    ORDER BY FIELD(lpp.jawatan, 'Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4')
");
$stmt->execute([':lid' => $laporanId]);
$pegawaiList = $stmt->fetchAll();

// Decode JSON columns
foreach ($pegawaiList as &$p) {
    foreach (['kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan','fizikal_kelemahan','kerjasama_kekuatan','kerjasama_kelemahan'] as $col) {
        if (isset($p[$col]) && is_string($p[$col])) {
            $p[$col] = json_decode($p[$col], true) ?: [];
        }
    }
}
unset($p);

/* ── Helper functions ── */
$bulan = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
function fmtDate(string $d): string {
    global $bulan;
    $ts = strtotime($d);
    return $ts ? date('d', $ts) . ' ' . $bulan[(int)date('m', $ts)-1] . ' ' . date('Y', $ts) : '-';
}
function fmtTime(string $t): string {
    $ts = strtotime($t);
    return $ts ? date('H:i', $ts) : '-';
}
function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

function tahapBM(string $tahap): string {
    return match($tahap) {
        'Susah' => 'Sukar',
        'Sangat Susah' => 'Sangat Sukar',
        default => 'Normal',
    };
}

function prestasiBM(?string $p): string {
    return match($p) {
        'Sangat Baik' => 'Cemerlang',
        'Baik' => 'Baik',
        'Memuaskan' => 'Memuaskan',
        'Tidak Memuaskan' => 'Tidak Memuaskan',
        default => '-',
    };
}

function markahColor(?float $m): string {
    if ($m === null) return '#6B7280';
    if ($m >= 8.3) return '#059669';
    if ($m >= 8.0) return '#2563EB';
    if ($m >= 7.5) return '#D97706';
    return '#DC2626';
}

function jawatanBM(string $j): string {
    return match($j) {
        'Pegawai ke4' => 'Pegawai ke-4',
        default => $j,
    };
}

function jawatanShort(string $j): string {
    return match($j) {
        'Pengadil' => 'R',
        'Penolong Pengadil 1' => 'AR1',
        'Penolong Pengadil 2' => 'AR2',
        'Pegawai ke4' => 'P4',
        default => $j,
    };
}

// Label seksyen penilaian
function sectionTitle(string $jawatan, string $sectionKey): string {
    if ($jawatan === 'Pengadil') {
        return match($sectionKey) {
            'kawalan' => '1. Kawalan Perlawanan — Interpretasi dan pemakaian Undang-Undang Permainan yang betul dan konsisten, tindakan disiplin yang sewajarnya, pendekatan taktikal dan pengurusan perlawanan.',
            'fizikal' => '2. Kecergasan Fizikal dan Kedudukan — Stamina, kelajuan, pecutan mengikut keperluan, kedudukan dan pergerakan.',
            'kerjasama' => '3. Kerjasama Berpasukan — Kerjasama dengan Penolong Pengadil dan Pegawai ke-4.',
            default => $sectionKey,
        };
    }
    if (str_contains($jawatan, 'Penolong')) {
        return 'Ketepatan isyarat: Situasi ofsaid, kesalahan, lontaran masuk, sepakan gol, dsb., Kedudukan dan pergerakan, Teknik bendera';
    }
    if (str_contains($jawatan, 'ke4') || str_contains($jawatan, 'Keempat')) {
        return 'Kerjasama dengan pengadil dan penolong pengadil, Kawalan di kawasan teknikal';
    }
    return '';
}

// Logo kejohanan (kiri & kanan)
$logoKiri64 = '';
$logoKanan64 = '';
if (!empty($report['logo_kiri'])) {
    $pathKiri = __DIR__ . '/..' . $report['logo_kiri'];
    if (file_exists($pathKiri)) {
        $ext = strtolower(pathinfo($pathKiri, PATHINFO_EXTENSION));
        $mime = $ext === 'png' ? 'image/png' : ($ext === 'svg' ? 'image/svg+xml' : 'image/jpeg');
        $logoKiri64 = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($pathKiri));
    }
}
if (!empty($report['logo_kanan'])) {
    $pathKanan = __DIR__ . '/..' . $report['logo_kanan'];
    if (file_exists($pathKanan)) {
        $ext = strtolower(pathinfo($pathKanan, PATHINFO_EXTENSION));
        $mime = $ext === 'png' ? 'image/png' : ($ext === 'svg' ? 'image/svg+xml' : 'image/jpeg');
        $logoKanan64 = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($pathKanan));
    }
}

$tarikh = fmtDate($report['tarikh'] ?? '');
$masa   = fmtTime($report['masa'] ?? '');
$tahap  = tahapBM($report['tahap_kesukaran'] ?? 'Normal');
$pasukan_home = e($report['pasukan_home'] ?? '');
$pasukan_away = e($report['pasukan_away'] ?? '');

// Logo pasukan
$logoHome64 = '';
$logoAway64 = '';
foreach (['logo_home' => &$logoHome64, 'logo_away' => &$logoAway64] as $col => &$var) {
    if (!empty($report[$col])) {
        $path = __DIR__ . '/..' . $report[$col];
        if (file_exists($path)) {
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $mime = $ext === 'png' ? 'image/png' : ($ext === 'svg' ? 'image/svg+xml' : 'image/jpeg');
            $var = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($path));
        }
    }
}
unset($var);
$kejohanan    = e($report['nama_kejohanan'] ?? '');
$penilai      = e($report['nama_penilai'] ?? '-');
$penilaiNegeri= e($report['penilai_negeri'] ?? 'Pahang');
$noMatch      = e($report['no_perlawanan'] ?? '-');
$tempat       = e($report['tempat'] ?? '-');
$skorHome     = '-';
$skorAway     = '-';
$skorHTHome   = '-';
$skorHTAway   = '-';

// Calculate 2nd half scores
$skor2H = '-'; $skor2A = '-';

// Populate from DB score columns
$skorHTHome = $report['skor_ht_home'] !== null ? (int)$report['skor_ht_home'] : '-';
$skorHTAway = $report['skor_ht_away'] !== null ? (int)$report['skor_ht_away'] : '-';
$skor2H     = $report['skor_ft_home'] !== null ? (int)$report['skor_ft_home'] : '-';
$skor2A     = $report['skor_ft_away'] !== null ? (int)$report['skor_ft_away'] : '-';
$skorETHome = $report['skor_et_home'] !== null ? (int)$report['skor_et_home'] : '-';
$skorETAway = $report['skor_et_away'] !== null ? (int)$report['skor_et_away'] : '-';
$skorPSHome = $report['skor_ps_home'] !== null ? (int)$report['skor_ps_home'] : '-';
$skorPSAway = $report['skor_ps_away'] !== null ? (int)$report['skor_ps_away'] : '-';

// Calculate final result
if ($skorHTHome !== '-' && $skor2H !== '-') {
    $skorHome = $skorHTHome + $skor2H + ($skorETHome !== '-' ? $skorETHome : 0);
    $skorAway = $skorHTAway + $skor2A + ($skorETAway !== '-' ? $skorETAway : 0);
}

?><!DOCTYPE html>
<html lang="ms">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Laporan Penilai Pengadil — <?= $pasukan_home ?> vs <?= $pasukan_away ?></title>
<style>
  @page { size: A4 portrait; margin: 12mm 15mm; }
  * {
    margin: 0; padding: 0; box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #111; background: #f5f5f5; }
  .page { width: 210mm; min-height: 280mm; margin: 0 auto; background: #fff; padding: 10mm 12mm; }
  @media print {
    body { background: #fff; }
    .page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }
  @media screen {
    .page { box-shadow: 0 2px 12px rgba(0,0,0,.15); margin: 20px auto; }
  }

  /* Header */
  .report-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .report-header img.logo { width: 65px; height: 65px; flex-shrink: 0; object-fit: contain; }
  .report-header .title-block { text-align: center; flex: 1; padding: 0 12px; }
  .report-header .logo-spacer { width: 65px; flex-shrink: 0; }
  .report-header h1 { font-size: 18pt; font-weight: 900; letter-spacing: 1px; margin-bottom: 2px; }
  .report-header .sub { font-size: 9pt; }

  /* Section headers */
  .section-header {
    background: #0066cc; color: #fff; font-weight: 700; font-size: 9pt;
    padding: 4px 8px; margin: 8px 0 4px; border: 1px solid #0066cc;
  }
  .section-header-dark {
    background: #003366; color: #fff; font-weight: 700; font-size: 9.5pt;
    padding: 5px 8px; margin: 12px 0 4px; border: 1px solid #003366;
  }

  /* Tables */
  table { border-collapse: collapse; width: 100%; font-size: 9pt; }
  .info-table td { padding: 3px 8px; border: 1px solid #999; }
  .info-table td.label { font-weight: 700; width: 100px; background: #f0f0f0; }
  .score-table { margin: 6px auto; width: 70%; }
  .score-table td, .score-table th { padding: 3px 8px; border: 1px solid #999; text-align: center; }
  .score-table th { background: #e5e7eb !important; color: #111827; font-weight: 700; }

  .officials-table td, .officials-table th { padding: 3px 6px; border: 1px solid #999; }
  .officials-table th { background: #e5e7eb !important; color: #111827; font-weight: 700; text-align: center; }

  /* Evaluation sections */
  .eval-section { margin: 8px 0; }
  .eval-section h4 { font-size: 9pt; font-weight: 700; margin-bottom: 3px; }
  .eval-points { margin: 4px 0 4px 0; }
  .eval-points table td { padding: 2px 6px; border: 1px solid #ccc; vertical-align: top; }
  .eval-points table td.num { width: 20px; text-align: center; font-weight: 700; }
  .eval-points table td.item { width: auto; }
  .advise-box {
    background: #fef2f2 !important; color: #b91c1c !important;
    border: 1px solid #fecaca; padding: 5px 8px; margin: 2px 0 6px;
    font-size: 8.5pt; font-weight: 700;
  }

  .eval-scale { margin: 10px 0; }
  .eval-scale td { padding: 2px 6px; border: 1px solid #999; font-size: 8pt; }
  .eval-scale td:first-child { font-weight: 700; width: 70px; }
  .table-heading td { background: #e5e7eb !important; color: #111827; font-weight: 700; }
  .scale-excellent td { background: #166534 !important; color: #fff; }
  .scale-very-good td { background: #22c55e !important; color: #052e16; }
  .scale-good td { background: #86efac !important; color: #052e16; }
  .scale-satisfactory td { background: #d9f99d !important; color: #1a2e05; }
  .scale-watch td { background: #fef08a !important; color: #422006; }
  .scale-warning td { background: #fdba74 !important; color: #431407; }
  .scale-low td { background: #fca5a5 !important; color: #450a0a; }
  .scale-critical td { background: #dc2626 !important; color: #fff; }
  .scale-unacceptable td { background: #7f1d1d !important; color: #fff; }

  .difficulty-table td { padding: 2px 8px; border: 1px solid #999; font-size: 8pt; }
  .difficulty-table td:first-child { font-weight: 700; width: 100px; }

  .perf-line { font-weight: 700; text-align: right; font-size: 9pt; margin: 3px 0; border-top: 2px solid #000; padding-top: 3px; }

  .overall-box { background: #003366; color: #fff; padding: 5px 8px; font-weight: 700; font-size: 9.5pt; margin-top: 12px; }
  .overall-content { border: 1px solid #999; padding: 6px 8px; font-size: 9pt; }

  .footer { margin-top: 15px; border-top: 1px solid #999; padding-top: 6px; font-size: 8pt; color: #666; }

  /* Print button */
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    background: #111827; color: #fff; padding: 10px 20px;
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,.3);
  }
  .print-bar button {
    background: #FADA00; color: #111; border: none; padding: 8px 24px;
    font-weight: 700; font-size: 13px; cursor: pointer; border-radius: 4px;
  }
  .print-bar button:hover { background: #e6c800; }
  @media screen { body { padding-top: 56px; } }
</style>
</head>
<body>

<!-- Print toolbar -->
<div class="print-bar no-print">
  <span style="font-size:14px;font-weight:700;">📋 Laporan Penilaian Pengadil (RA Report)</span>
  <div>
    <button onclick="window.print()">🖨️ Cetak / Muat Turun PDF</button>
  </div>
</div>

<div class="page">

<!-- HEADER -->
<div class="report-header">
  <?php if ($logoKiri64): ?>
    <img class="logo" src="<?= $logoKiri64 ?>" alt="Logo Kiri">
  <?php else: ?>
    <div class="logo-spacer"></div>
  <?php endif; ?>
  <div class="title-block">
    <h1>LAPORAN PENILAI PENGADIL</h1>
    <div class="sub"><strong>PERSATUAN BOLA SEPAK NEGERI PAHANG (PBNP)</strong></div>
  </div>
  <?php if ($logoKanan64): ?>
    <img class="logo" src="<?= $logoKanan64 ?>" alt="Logo Kanan">
  <?php else: ?>
    <div class="logo-spacer"></div>
  <?php endif; ?>
</div>

<!-- COMPETITION & RA INFO -->
<table class="info-table" style="margin-bottom:6px;">
  <tr><td class="label">KEJOHANAN</td><td colspan="3"><?= $kejohanan ?></td></tr>
  <tr><td class="label">Penilai Pengadil</td><td><?= $penilai ?></td><td class="label" style="width:90px;">Negeri</td><td style="width:100px;"><?= $penilaiNegeri ?></td></tr>
</table>

<!-- MATCH INFORMATION -->
<div class="section-header">MAKLUMAT PERLAWANAN</div>
<table class="info-table">
  <tr>
    <td class="label">No. Perlawanan</td><td><?= $noMatch ?></td>
    <td class="label">Tarikh</td><td><?= $tarikh ?></td>
  </tr>
  <tr>
    <td class="label">Cuaca</td><td><?= htmlspecialchars($report['cuaca'] ?? '-') ?></td>
    <td class="label">Masa</td><td><?= $masa ?></td>
  </tr>
  <tr>
    <td class="label">Tempat</td><td colspan="3"><?= $tempat ?></td>
  </tr>
</table>

<!-- SCORE TABLE -->
<table class="score-table" style="margin:8px auto;">
  <tr>
    <td style="text-align:center;width:35%;font-weight:700;">
      <?php if ($logoHome64): ?><br><img src="<?= $logoHome64 ?>" style="width:50px;height:50px;object-fit:contain;display:block;margin:0 auto 4px;"><br><?php endif; ?>
      <?= $pasukan_home ?>
    </td>
    <td style="text-align:center;font-weight:700;font-size:14pt;">vs</td>
    <td style="text-align:center;width:35%;font-weight:700;">
      <?php if ($logoAway64): ?><br><img src="<?= $logoAway64 ?>" style="width:50px;height:50px;object-fit:contain;display:block;margin:0 auto 4px;"><br><?php endif; ?>
      <?= $pasukan_away ?>
    </td>
  </tr>
</table>
<table class="score-table" style="margin:4px auto 8px;">
  <tr><th><?= $pasukan_home ?></th><th>-</th><th><?= $pasukan_away ?></th></tr>
  <tr><td><?= $skorHTHome ?></td><td>Separuh Masa Pertama</td><td><?= $skorHTAway ?></td></tr>
  <tr><td><?= $skor2H ?></td><td>Separuh Masa Kedua</td><td><?= $skor2A ?></td></tr>
  <tr><td><?= $skorETHome ?></td><td>Extra Time</td><td><?= $skorETAway ?></td></tr>
  <tr><td><?= $skorPSHome ?></td><td>Penalty Shoot Out</td><td><?= $skorPSAway ?></td></tr>
  <tr style="font-weight:700;"><td><?= $skorHome ?></td><td>Keputusan Akhir</td><td><?= $skorAway ?></td></tr>
</table>

<!-- OFFICIALS TABLE -->
<table class="officials-table">
  <tr>
    <th></th><th style="text-align:left;">Pegawai</th><th>Negeri</th><th>Tahap Kesukaran</th><th>Markah</th>
  </tr>
  <?php foreach ($pegawaiList as $pg): ?>
  <tr>
    <td style="font-weight:700;"><?= e(jawatanBM($pg['jawatan'])) ?></td>
    <td><?= e(strtoupper($pg['nama_pengadil'] ?? '-')) ?></td>
    <td style="text-align:center;"><?= e($pg['negeri'] ?? 'Pahang') ?></td>
    <td style="text-align:center;"><?= $tahap ?></td>
    <td style="text-align:center;font-weight:700;color:<?= markahColor($pg['markah'] !== null ? (float)$pg['markah'] : null) ?>">
      <?= $pg['markah'] !== null ? number_format((float)$pg['markah'], 1) : '-' ?>
    </td>
  </tr>
  <?php endforeach; ?>
  <tr>
    <td style="font-weight:700;">Penilai Pengadil</td>
    <td><?= e(strtoupper($penilai)) ?></td>
    <td style="text-align:center;"><?= $penilaiNegeri ?></td>
    <td colspan="2"></td>
  </tr>
</table>

<!-- EVALUATION SCALE -->
<table class="eval-scale" style="margin:8px 0;">
  <tr class="table-heading"><td colspan="2">Skala Penilaian</td></tr>
  <tr class="scale-excellent"><td>9.0 - 10</td><td>Cemerlang</td></tr>
  <tr class="scale-very-good"><td>8.5 - 8.9</td><td>Sangat Baik</td></tr>
  <tr class="scale-good"><td>8.3 - 8.4</td><td>Baik (tahap yang dijangkakan)</td></tr>
  <tr class="scale-satisfactory"><td>8.2</td><td>Memuaskan dengan beberapa perkara kecil yang perlu diperbaiki</td></tr>
  <tr class="scale-satisfactory"><td>8.0 - 8.1</td><td>Memuaskan dengan beberapa perkara penting yang perlu diperbaiki</td></tr>
  <tr class="scale-watch"><td>7.9</td><td>Kesilapan ketara yang penting, jika tidak 8.3 atau lebih</td></tr>
  <tr class="scale-warning"><td>7.8</td><td>Kesilapan ketara yang penting, jika tidak 8.0 - 8.2</td></tr>
  <tr class="scale-low"><td>7.5 - 7.7</td><td>Di bawah jangkaan, perkara yang jelas perlu diperbaiki</td></tr>
  <tr class="scale-critical"><td>7.0 - 7.4</td><td>Mengecewakan. Di bawah jangkaan dengan satu kesilapan</td></tr>
  <tr class="scale-unacceptable"><td>6.0 - 6.9</td><td>Tidak boleh diterima</td></tr>
</table>

<table class="difficulty-table" style="margin:4px 0 10px;">
  <tr class="table-heading"><td colspan="2">Tahap kesukaran mesti disepadukan dengan markah dan dinilai untuk setiap Pegawai Perlawanan secara individu</td></tr>
  <tr><td style="background:#3CB371;color:#fff;">Normal</td><td>Perlawanan biasa untuk Pegawai Perlawanan, sedikit situasi mencabar</td></tr>
  <tr><td style="background:#FFA500;color:#000;">Sukar</td><td>Perlawanan sukar dengan beberapa keputusan yang sukar untuk pegawai perlawanan</td></tr>
  <tr><td style="background:#DC143C;color:#fff;">Sangat Sukar</td><td>Perlawanan sangat sukar dengan banyak situasi sukar untuk pegawai perlawanan</td></tr>
</table>

<!-- PER-OFFICIAL EVALUATION -->
<?php foreach ($pegawaiList as $idx => $pg):
    $nama = e(strtoupper($pg['nama_pengadil'] ?? '-'));
    $jwtnBM = jawatanBM($pg['jawatan']);
    $markah = $pg['markah'] !== null ? number_format((float)$pg['markah'], 1) : '-';
    $prestasi = prestasiBM($pg['prestasi'] ?? null);

    // Determine sections based on jawatan
    $sections = getSectionsForJawatan($pg['jawatan']);

    // Map section keys to kekuatan/kelemahan/nasihat columns
    $sectionData = [];
    if ($pg['jawatan'] === 'Pengadil') {
        $sectionData = [
            'kawalan'   => ['kekuatan' => $pg['kawalan_kekuatan'] ?? [], 'kelemahan' => $pg['kawalan_kelemahan'] ?? [], 'nasihat' => $pg['kawalan_nasihat'] ?? ''],
            'fizikal'   => ['kekuatan' => $pg['fizikal_kekuatan'] ?? [], 'kelemahan' => $pg['fizikal_kelemahan'] ?? [], 'nasihat' => $pg['fizikal_nasihat'] ?? ''],
            'kerjasama' => ['kekuatan' => $pg['kerjasama_kekuatan'] ?? [], 'kelemahan' => $pg['kerjasama_kelemahan'] ?? [], 'nasihat' => $pg['kerjasama_nasihat'] ?? ''],
        ];
    } else {
        // AR and P4 only have one combined section stored in kawalan_ columns
        $sKey = $sections[0]['key'] ?? 'kawalan';
        $sectionData = [
            $sKey => ['kekuatan' => $pg['kawalan_kekuatan'] ?? [], 'kelemahan' => $pg['kawalan_kelemahan'] ?? [], 'nasihat' => $pg['kawalan_nasihat'] ?? ''],
        ];
    }
?>

<?php if ($idx > 0): ?><div class="page-break"></div><?php endif; ?>

<div class="section-header-dark"><?= $jwtnBM ?> : <?= $nama ?></div>
<div style="font-size:8.5pt;margin:2px 0 6px;">
  <strong>Penilaian bagi <?= $jwtnBM ?> : <?= $nama ?></strong>
  <span style="float:right;">Prestasi : <strong><?= $prestasi ?></strong> &nbsp; Markah : <strong style="color:<?= markahColor($pg['markah'] !== null ? (float)$pg['markah'] : null) ?>"><?= $markah ?></strong></span>
</div>

<?php
  $secNum = 0;
  foreach ($sectionData as $sKey => $sData):
    $secNum++;
    $title = sectionTitle($pg['jawatan'], $sKey);
    $kekuatan  = $sData['kekuatan'];
    $kelemahan = $sData['kelemahan'];
    $nasihat   = $sData['nasihat'];
?>
<div class="eval-section">
  <div style="font-size:8.5pt;font-style:italic;margin:4px 0 3px;color:#333;"><?= e($title) ?></div>

  <!-- Positive points -->
  <div class="eval-points">
    <div style="font-weight:700;font-size:8.5pt;margin:3px 0;">Kekuatan :</div>
    <table>
      <?php if (!empty($kekuatan)): ?>
        <?php foreach ($kekuatan as $i => $item): ?>
        <tr>
          <td class="num"><?= $i + 1 ?></td>
          <td class="item"><?= e($item) ?></td>
        </tr>
        <?php endforeach; ?>
      <?php else: ?>
        <tr><td class="num">1</td><td class="item">-</td></tr>
      <?php endif; ?>
    </table>
  </div>

  <!-- Areas for improvement -->
  <div class="eval-points">
    <div style="font-weight:700;font-size:8.5pt;margin:3px 0;">Aspek Penambahbaikan :</div>
    <table>
      <?php if (!empty($kelemahan)): ?>
        <?php foreach ($kelemahan as $i => $item): ?>
        <tr>
          <td class="num"><?= $i + 1 ?></td>
          <td class="item"><?= e($item) ?></td>
        </tr>
        <?php if ($nasihat && $i === 0): ?>
        <tr>
          <td></td>
          <td class="advise-box"><strong>Nasihat :</strong> <?= nl2br(e($nasihat)) ?></td>
        </tr>
        <?php endif; ?>
        <?php endforeach; ?>
      <?php else: ?>
        <tr><td class="num">1</td><td class="item">-</td></tr>
      <?php endif; ?>
    </table>
  </div>

  <div class="perf-line">
    Penilaian bagi <?= $jwtnBM ?> : <?= $nama ?>
    <span style="float:right;">Prestasi : <?= $prestasi ?></span>
  </div>
</div>
<?php endforeach; // sections ?>

<?php endforeach; // pegawai ?>

<!-- OVERALL REMARKS -->
<?php if (!empty($report['ulasan_keseluruhan'])): ?>
<div class="overall-box">ULASAN KESELURUHAN TAMBAHAN</div>
<div class="overall-content">
  <strong>Ulasan :</strong> <?= nl2br(e($report['ulasan_keseluruhan'])) ?>
</div>
<?php endif; ?>

<?php if (!empty($report['catatan_admin'])): ?>
<div style="margin-top:6px;border:1px solid #ccc;padding:5px 8px;font-size:8.5pt;">
  <strong>Catatan Admin :</strong> <?= nl2br(e($report['catatan_admin'])) ?>
</div>
<?php endif; ?>

<!-- FOOTER -->
<div class="footer">
  <div>Tarikh Sahkan : <?= $report['tarikh_sahkan'] ? fmtDate($report['tarikh_sahkan']) : '-' ?></div>
  <div style="margin-top:3px;">Dijana oleh Sistem Pengadil PBNP — <?= date('d/m/Y H:i') ?></div>
</div>

</div><!-- .page -->

<?php if ($autoprint): ?>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
<?php endif; ?>

</body>
</html>
