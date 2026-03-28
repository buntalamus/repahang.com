<?php
/**
 * Download Jadual Lantikan as printable HTML (for PDF via browser print)
 * GET /api/download-jadual-lantikan.php?kejohanan_id=X
 *
 * Outputs full HTML page with print styles.
 * User presses Cmd+P / Ctrl+P → Save as PDF (A4 landscape).
 */

declare(strict_types=1);

// Use session auth only (no JSON headers — outputs HTML)
date_default_timezone_set('Asia/Kuala_Lumpur');
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../config/env.php';

// Start session using same settings as bootstrap.php
if (!defined('APP_DEBUG')) {
    define('APP_DEBUG', env('APP_DEBUG', 'false') === 'true');
}
if (session_status() === PHP_SESSION_NONE) {
    session_start([
        'cookie_httponly' => true,
        'cookie_secure'   => !APP_DEBUG,
        'cookie_samesite' => 'Lax',
        'use_strict_mode' => true,
    ]);
}

// Auth check — session stores user_id + user_role (see bootstrap.php)
if (empty($_SESSION['user_id']) || ($_SESSION['user_role'] ?? '') !== 'Admin') {
    http_response_code(403);
    echo '<p style="font-family:sans-serif;color:red;padding:20px;">Akses tidak dibenarkan. Sila log masuk sebagai Admin terlebih dahulu.</p>';
    exit;
}

$kejohananId = (int) ($_GET['kejohanan_id'] ?? 0);
if (!$kejohananId) {
    http_response_code(400);
    echo '<p style="font-family:sans-serif;color:red;">kejohanan_id diperlukan.</p>';
    exit;
}

$generatedBy = $_SESSION['user_nama_penuh'] ?? $_SESSION['user_nama'] ?? $_SESSION['user_email'] ?? 'Admin';

try {
    $pdo = getDbConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo '<p>Gagal bersambung ke pangkalan data.</p>';
    exit;
}

$JAWATAN_SHORT = [
    'Pengadil Utama'       => 'Pengadil Utama',
    'Pembantu Pengadil 1'  => 'PP 1',
    'Pembantu Pengadil 2'  => 'PP 2',
    'Pengadil Keempat'     => 'P. Keempat',
    'Penilai Pengadil'     => 'Penilai',
];
$JAWATAN_LIST = array_keys($JAWATAN_SHORT);

// ── Fetch data ───────────────────────────────────────────────────────────────

$stmt = $pdo->prepare("SELECT * FROM kejohanan WHERE id = ?");
$stmt->execute([$kejohananId]);
$kejohanan = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$kejohanan) {
    http_response_code(404);
    echo '<p>Kejohanan tidak dijumpai.</p>';
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM jadual_lantikan_pengesahan WHERE kejohanan_id = ?");
$stmt->execute([$kejohananId]);
$pengesahan = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
$kodVerifikasi = null;
if ($pengesahan) {
    $kodVerifikasi = strtoupper(
        substr(hash('sha256', $pengesahan['kejohanan_id'] . '|' . $pengesahan['tarikh_sahkan'] . '|RFPHG2025'), 0, 12)
    );
}

$stmt = $pdo->prepare("
    SELECT id, no_perlawanan, tarikh, hari, masa, kategori, peringkat, kumpulan,
           pasukan_home, pasukan_away, tempat, status
    FROM jadual_perlawanan
    WHERE kejohanan_id = ?
    ORDER BY tarikh ASC, masa ASC, no_perlawanan ASC
");
$stmt->execute([$kejohananId]);
$jadualList = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("
    SELECT lp.jadual_id, lp.jawatan, lp.status AS status_lantikan,
           COALESCE(p.nama_penuh, pl.nama) AS nama_penuh,
           COALESCE(p.jenis_pengadil, pl.jenis_pengadil) AS jenis_pengadil,
           COALESCE(p.negeri, pl.negeri) AS negeri,
           COALESCE(p.no_telefon, pl.no_tel) AS no_telefon,
           CASE WHEN lp.pengadil_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber
    FROM lantikan_pengadil lp
    LEFT JOIN users p ON lp.pengadil_id = p.id
    LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id = pl.id
    JOIN jadual_perlawanan jp ON lp.jadual_id = jp.id
    WHERE jp.kejohanan_id = ?
");
$stmt->execute([$kejohananId]);
$allAssignments = $stmt->fetchAll(PDO::FETCH_ASSOC);

$assignmentMap = [];
foreach ($allAssignments as $a) {
    $assignmentMap[(int)$a['jadual_id']][$a['jawatan']] = $a;
}

// Attach assignments
foreach ($jadualList as &$j) {
    $j['assignments'] = [];
    foreach ($JAWATAN_LIST as $jaw) {
        $j['assignments'][$jaw] = $assignmentMap[(int)$j['id']][$jaw] ?? null;
    }
}
unset($j);

// Stats
$totalPerlawanan = count($jadualList);
$lengkap = 0;
$totalLantikan = count($allAssignments);
$totalTerima = count(array_filter($allAssignments, fn($a) => $a['status_lantikan'] === 'Diterima'));
foreach ($jadualList as $j) {
    $c = count(array_filter($j['assignments']));
    if ($c === count($JAWATAN_LIST)) $lengkap++;
}

// Helpers
function fDate(string $d): string {
    return date('d/m/Y', strtotime($d));
}
function fTime(string $t): string {
    return substr($t, 0, 5);
}
function escHtml(mixed $v): string {
    return htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8');
}

$now = date('d/m/Y H:i:s');

// Date range
$tarikhMula  = $kejohanan['tarikh_mula']  ? fDate($kejohanan['tarikh_mula'])  : '-';
$tarikhTamat = $kejohanan['tarikh_akhir'] ? fDate($kejohanan['tarikh_akhir']) : '-';

?><!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jadual Lantikan – <?= escHtml($kejohanan['nama']) ?></title>
  <style>
    /* ── Base ── */
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #111;
      margin: 0;
      padding: 20px;
      background: #fff;
    }

    /* ── Screen-only toolbar ── */
    .toolbar {
      display: flex;
      gap: 10px;
      align-items: center;
      background: #1a1a1a;
      color: #FFD700;
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .toolbar h2 { margin: 0; font-size: 13pt; flex: 1; }
    .btn {
      padding: 7px 16px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 9pt;
      font-weight: bold;
    }
    .btn-print { background: #FFD700; color: #1a1a1a; }
    .btn-close  { background: #555; color: #fff; }
    .btn:hover { opacity: 0.85; }

    /* ── Document header ── */
    .doc-header {
      text-align: center;
      border-bottom: 2.5px solid #1a1a1a;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .doc-header .org { font-size: 11pt; font-weight: bold; letter-spacing: 0.5px; }
    .doc-header .sub { font-size: 9.5pt; }
    .doc-header .title { font-size: 15pt; font-weight: bold; margin: 6px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
    .doc-header .noj { font-size: 10pt; font-weight: bold; }
    .doc-header .meta { font-size: 8.5pt; color: #444; margin-top: 3px; }

    /* ── Stats bar ── */
    .stats-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .stat-box {
      flex: 1;
      min-width: 100px;
      border: 1px solid #ccc;
      border-radius: 5px;
      padding: 6px 10px;
      text-align: center;
    }
    .stat-box .sv { font-size: 16pt; font-weight: bold; line-height: 1.1; }
    .stat-box .sl { font-size: 7.5pt; color: #555; }
    .stat-green .sv { color: #15803d; }
    .stat-amber .sv  { color: #b45309; }
    .stat-red .sv    { color: #dc2626; }
    .stat-blue .sv   { color: #1d4ed8; }

    /* ── Main table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 14px;
    }
    thead tr th {
      background: #1a1a1a;
      color: #FFD700;
      padding: 5px 6px;
      text-align: center;
      border: 1px solid #333;
      font-size: 7.5pt;
      white-space: nowrap;
    }
    tbody tr td {
      border: 1px solid #ccc;
      padding: 4px 6px;
      vertical-align: top;
    }
    tbody tr:nth-child(even) { background: #f9f9f9; }
    .center { text-align: center; }
    .bold { font-weight: bold; }

    /* Jawatan cells */
    .ref-cell { font-size: 7.5pt; }
    .ref-name  { font-weight: bold; display: block; }
    .ref-jenis { font-size: 6.5pt; color: #555; }
    .ref-negeri { font-size: 6.5pt; color: #666; }
    .ref-empty  { color: #aaa; text-align: center; font-style: italic; }

    /* Status chips */
    .chip {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 6.5pt;
      font-weight: bold;
    }
    .chip-terima  { background: #dcfce7; color: #15803d; }
    .chip-tolak   { background: #fee2e2; color: #dc2626; }
    .chip-menunggu { background: #fef9c3; color: #854d0e; }
    .chip-luar    { background: #fef3c7; color: #92400e; }

    /* ── Pengesahan section ── */
    .pengesahan-section {
      border: 1.5px solid #1a1a1a;
      border-radius: 6px;
      padding: 14px 18px;
      margin-bottom: 14px;
    }
    .pengesahan-section h3 {
      margin: 0 0 10px;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 6px;
    }
    .pengesahan-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 12px;
    }
    .sig-line { border-top: 1.5px solid #111; margin-top: 30px; padding-top: 4px; font-size: 7.5pt; color: #444; }
    .verif-box {
      border: 1px dashed #aaa;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 7.5pt;
      color: #555;
      margin-top: 10px;
    }
    .verif-code { font-family: 'Courier New', monospace; font-size: 11pt; font-weight: bold; color: #1a1a1a; letter-spacing: 2px; }

    /* ── Footer ── */
    .doc-footer {
      font-size: 7pt;
      color: #888;
      text-align: right;
      border-top: 1px solid #ddd;
      padding-top: 6px;
      margin-top: 8px;
    }

    /* ── Print overrides ── */
    @media print {
      @page { size: A4 landscape; margin: 1.5cm 1.2cm; }
      body  { padding: 0; font-size: 8pt; }
      .toolbar { display: none !important; }
      table { font-size: 7.5pt; page-break-inside: auto; }
      tr    { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Screen toolbar (hidden on print) -->
  <div class="toolbar">
    <h2>Jadual Lantikan Pengadil</h2>
    <button class="btn btn-print" onclick="window.print()">🖨 Cetak / Simpan PDF</button>
    <button class="btn btn-close"  onclick="window.close()">✕ Tutup</button>
  </div>

  <!-- Document header -->
  <div class="doc-header">
    <p class="org">PERSATUAN BOLA SEPAK PAHANG (PFAHANG)</p>
    <p class="sub">JAWATANKUASA PENGADIL</p>
    <p class="title">Jadual Lantikan Pengadil Kejohanan</p>
    <p class="noj"><?= escHtml($kejohanan['nama']) ?></p>
    <p class="meta">
      <?= escHtml($tarikhMula) ?> – <?= escHtml($tarikhTamat) ?>
      <?php if ($kejohanan['tempat']): ?>  ·  <?= escHtml($kejohanan['tempat']) ?><?php endif; ?>
    </p>
  </div>

  <!-- Stats bar -->
  <div class="stats-bar">
    <div class="stat-box">
      <div class="sv"><?= $totalPerlawanan ?></div>
      <div class="sl">Jumlah Perlawanan</div>
    </div>
    <div class="stat-box stat-green">
      <div class="sv"><?= $lengkap ?></div>
      <div class="sl">Lantikan Lengkap</div>
    </div>
    <div class="stat-box stat-amber">
      <div class="sv"><?= ($totalPerlawanan - $lengkap) ?></div>
      <div class="sl">Belum / Separa</div>
    </div>
    <div class="stat-box stat-blue">
      <div class="sv"><?= $totalLantikan ?></div>
      <div class="sl">Jumlah Lantikan</div>
    </div>
    <div class="stat-box stat-green">
      <div class="sv"><?= $totalTerima ?></div>
      <div class="sl">Diterima</div>
    </div>
    <div class="stat-box">
      <div class="sv"><?= ($totalLantikan > 0 ? round($totalTerima / $totalLantikan * 100) : 0) ?>%</div>
      <div class="sl">Kadar Terima</div>
    </div>
  </div>

  <!-- Main schedule table -->
  <table>
    <thead>
      <tr>
        <th style="width:5%">No. Perl.</th>
        <th style="width:8%">Tarikh</th>
        <th style="width:5%">Masa</th>
        <th style="width:8%">Kategori</th>
        <th style="width:16%">Pasukan</th>
        <th style="width:5%">Tempat</th>
        <?php foreach ($JAWATAN_SHORT as $jaw => $short): ?>
          <th style="width:9%"><?= escHtml($short) ?></th>
        <?php endforeach; ?>
      </tr>
    </thead>
    <tbody>
      <?php if (empty($jadualList)): ?>
        <tr>
          <td colspan="<?= 6 + count($JAWATAN_LIST) ?>" style="text-align:center;padding:14px;color:#888;">
            Tiada perlawanan dalam jadual.
          </td>
        </tr>
      <?php endif; ?>
      <?php foreach ($jadualList as $j): ?>
        <tr>
          <td class="center bold"><?= escHtml($j['no_perlawanan']) ?></td>
          <td class="center">
            <?= escHtml(fDate($j['tarikh'])) ?><br>
            <span style="font-size:6.5pt;color:#666;"><?= escHtml($j['hari'] ?? '') ?></span>
          </td>
          <td class="center"><?= escHtml(fTime($j['masa'])) ?></td>
          <td class="center">
            <?php if ($j['kategori']): ?>
              <span class="chip" style="background:#e0e7ff;color:#3730a3;"><?= escHtml($j['kategori']) ?></span><br>
            <?php endif; ?>
            <span style="font-size:6.5pt;"><?= escHtml($j['peringkat'] ?? '') ?><?= $j['kumpulan'] ? ' ' . escHtml($j['kumpulan']) : '' ?></span>
          </td>
          <td>
            <span class="bold"><?= escHtml($j['pasukan_home'] ?? '-') ?></span>
            <span style="color:#888; margin: 0 3px;">vs</span>
            <span class="bold"><?= escHtml($j['pasukan_away'] ?? '-') ?></span>
          </td>
          <td class="center" style="font-size:7pt;"><?= escHtml($j['tempat'] ?? '-') ?></td>
          <?php foreach ($JAWATAN_LIST as $jaw):
            $a = $j['assignments'][$jaw];
          ?>
            <td class="ref-cell">
              <?php if ($a): ?>
                <span class="ref-name"><?= escHtml($a['nama_penuh']) ?></span>
                <?php
                  $chipClass = match($a['status_lantikan']) {
                    'Diterima' => 'chip-terima',
                    'Ditolak'  => 'chip-tolak',
                    default    => 'chip-menunggu',
                  };
                ?>
                <span class="chip <?= $chipClass ?>"><?= escHtml($a['status_lantikan']) ?></span>
                <?php if ($a['jenis_sumber'] === 'Luar'): ?>
                  <span class="chip chip-luar">Luar</span>
                <?php endif; ?>
                <span class="ref-jenis"><?= escHtml($a['jenis_pengadil'] ?? '') ?></span>
                <span class="ref-negeri"><?= escHtml($a['negeri'] ?? '') ?></span>
              <?php else: ?>
                <span class="ref-empty">—</span>
              <?php endif; ?>
            </td>
          <?php endforeach; ?>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>

  <!-- Pengesahan / Signature section -->
  <div class="pengesahan-section">
    <h3>Pengesahan &amp; Tandatangan</h3>

    <?php if ($pengesahan): ?>
      <div style="display:flex; gap:20px; align-items:flex-start; margin-bottom:10px;">
        <div style="flex:1;">
          <div class="pengesahan-grid">
            <div>
              <div style="font-size:7.5pt; color:#555; margin-bottom:2px;">NAMA KETUA PENGADIL / PEGAWAI BERTANGGUNGJAWAB</div>
              <div style="font-weight:bold; font-size:9pt;"><?= escHtml($pengesahan['nama_penyahkan']) ?></div>
              <div class="sig-line">Tandatangan / <em>Signature</em></div>
            </div>
            <div>
              <div style="font-size:7.5pt; color:#555; margin-bottom:2px;">JAWATAN</div>
              <div style="font-weight:bold; font-size:9pt;"><?= escHtml($pengesahan['jawatan_penyahkan']) ?></div>
              <div style="font-size:7.5pt; color:#555; margin-top:6px;">TARIKH PENGESAHAN</div>
              <div style="font-size:8.5pt;"><?= escHtml(date('d/m/Y H:i', strtotime($pengesahan['tarikh_sahkan']))) ?></div>
            </div>
            <div>
              <?php if ($pengesahan['nota']): ?>
                <div style="font-size:7.5pt; color:#555; margin-bottom:2px;">NOTA</div>
                <div style="font-size:8pt; font-style:italic;"><?= escHtml($pengesahan['nota']) ?></div>
              <?php endif; ?>
            </div>
          </div>
          <div class="verif-box">
            <div style="margin-bottom:4px;font-weight:bold;">KOD VERIFIKASI DOKUMEN</div>
            <div class="verif-code"><?= escHtml($kodVerifikasi) ?></div>
            <div style="margin-top:4px;">Dokumen ini dijana secara digital oleh Sistem Pengurusan Pengadil Pahang (SPPP) pada <?= escHtml($now) ?>. Kod verifikasi adalah unik kepada kejohanan dan tarikh pengesahan.</div>
          </div>
        </div>
      </div>
    <?php else: ?>
      <!-- Blank signature blocks if not yet verified -->
      <div class="pengesahan-grid">
        <div>
          <div style="font-size:7.5pt; color:#555; margin-bottom:2px;">NAMA KETUA PENGADIL / PEGAWAI BERTANGGUNGJAWAB</div>
          <div class="sig-line">Tandatangan / <em>Signature</em></div>
        </div>
        <div>
          <div style="font-size:7.5pt; color:#555; margin-bottom:2px;">TARIKH / <em>Date</em></div>
          <div class="sig-line">&nbsp;</div>
        </div>
        <div>
          <div style="font-size:7.5pt; color:#555; margin-bottom:2px;">COP RASMI / <em>Official Stamp</em></div>
          <div style="border: 1.5px dashed #bbb; height: 55px; border-radius: 4px; margin-top: 8px;"></div>
        </div>
      </div>
      <div class="verif-box" style="color:#aaa;">
        ⚠ Jadual ini belum disahkan secara digital. Sila log masuk ke sistem dan sahkan jadual lantikan untuk mendapatkan kod verifikasi.
      </div>
    <?php endif; ?>
  </div>

  <!-- Document footer -->
  <div class="doc-footer">
    Dicetak oleh: <?= escHtml($generatedBy) ?> &nbsp;·&nbsp; Tarikh cetak: <?= escHtml($now) ?> &nbsp;·&nbsp; Sistem Pengurusan Pengadil Pahang (SPPP)
  </div>

</body>
</html>
