<?php
/**
 * Admin Applications API (Standalone - no bootstrap)
 * GET: List all applications by jenis_borang
 */

ini_set('display_errors', 0);
error_reporting(E_ALL);

// Manual session start
session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
    'use_strict_mode' => true,
]);

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Check if user is admin
$isAdmin = false;
if (isset($_SESSION['user_id']) && isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'Admin') {
    $isAdmin = true;
} elseif (isset($_SESSION['admin_email'])) {
    $isAdmin = true;
}

if (!$isAdmin) {
    http_response_code(401);
    echo json_encode(['error' => true, 'message' => 'Unauthorized']);
    exit;
}

// Load database config
if (file_exists(__DIR__ . '/../db-local.php')) {
    require_once __DIR__ . '/../db-local.php';
} else {
    require_once __DIR__ . '/../db.php';
}

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    
    // Handle POST request for updating status_ujian
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';
        
        if ($action === 'update_status_ujian') {
            $applicationId = $input['id'] ?? 0;
            $statusUjian = $input['status_ujian'] ?? '';
            
            if (!$applicationId || !in_array($statusUjian, ['Lulus', 'Tidak Lulus', 'Tidak Hadir'])) {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'Parameter tidak sah.']);
                exit;
            }
            
            // Update status_ujian in permohonan table
            try {
                $updateStmt = $pdo->prepare("
                    UPDATE permohonan
                    SET status_ujian = :status_ujian
                    WHERE id = :id
                ");
                
                $result = $updateStmt->execute([
                    'status_ujian' => $statusUjian,
                    'id' => $applicationId
                ]);
                
                echo json_encode([
                    'error' => false,
                    'message' => 'Status ujian berjaya dikemaskini.',
                    'affected_rows' => $updateStmt->rowCount()
                ]);
                exit;
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode([
                    'error' => true,
                    'message' => 'Gagal mengemaskini status ujian: ' . $e->getMessage(),
                    'code' => $e->getCode()
                ]);
                exit;
            }
        }
        
        http_response_code(400);
        echo json_encode(['error' => true, 'message' => 'Tindakan tidak sah.']);
        exit;
    }
    
    // Handle GET request for listing applications
    $jenis_borang = $_GET['jenis_borang'] ?? 'pengadil_berdaftar';
    
    // Query applications based on jenis_borang
    $sql = "
        SELECT
            p.id,
            p.user_id,
            p.nama_penuh,
            p.no_kp,
            p.no_telefon,
            p.emel,
            COALESCE(
                pbd.nama_persatuan,
                pbd2.nama_persatuan,
                CASE 
                    WHEN p.daerah IS NOT NULL AND p.daerah != '' THEN p.daerah
                    ELSE u.daerah
                END,
                '-'
            ) as daerah,
            p.jenis_borang,
            p.status,
            p.status_workflow,
            p.status_ujian,
            p.tarikh_hantar,
            p.tahun_permohonan,
            CASE 
                WHEN p.jenis_borang = 'pengadil_futsal' THEN 'Pengadil Futsal'
                WHEN p.jenis_borang = 'pengadil_berdaftar' THEN 'Pengadil Berdaftar'
                WHEN p.jenis_borang = 'ujian_kecergasan' THEN 'Ujian Kecergasan'
                WHEN p.jenis_borang = 'ujian_bertulis' THEN 'Ujian Kelas III FAM'
                WHEN p.jenis_borang = 'ujian_kelas1_fam' THEN 'Ujian Kelas 1 FAM'
                ELSE 'Pendaftaran Pengadil'
            END as jenis_permohonan,
            DATE_FORMAT(p.tarikh_hantar, '%d/%m/%Y %H:%i') as tarikh_hantar_formatted
        FROM permohonan p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN persatuan_bolasepak_daerah pbd ON p.persatuan_id = pbd.id
        LEFT JOIN persatuan_bolasepak_daerah pbd2 ON u.persatuan_id = pbd2.id
        WHERE p.jenis_borang = ?
        ORDER BY p.tarikh_hantar DESC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$jenis_borang]);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Standard 12 daerah Pahang
    $standardDaerah = [
        'bentong' => 'Bentong',
        'bera' => 'Bera',
        'cameron highlands' => 'Cameron Highlands',
        'jerantut' => 'Jerantut',
        'kuantan' => 'Kuantan',
        'lipis' => 'Lipis',
        'kuala lipis' => 'Lipis',  // normalize to Lipis
        'maran' => 'Maran',
        'muadzam shah' => 'Muadzam Shah',
        'pbd muadzam shah' => 'Muadzam Shah',  // normalize PBD reference
        'pekan' => 'Pekan',
        'raub' => 'Raub',
        'rompin' => 'Rompin',
        'temerloh' => 'Temerloh'
    ];
    
    // Normalize daerah
    foreach ($applications as &$app) {
        if (!empty($app['daerah']) && $app['daerah'] !== '-') {
            $daerahLower = strtolower(trim($app['daerah']));
            
            // Check if it matches a standard daerah
            if (isset($standardDaerah[$daerahLower])) {
                $app['daerah'] = $standardDaerah[$daerahLower];
            } else {
                // Try to find partial match (e.g., "kuala lipis" should become "Lipis")
                foreach ($standardDaerah as $key => $value) {
                    if (strpos($daerahLower, $key) !== false || strpos($key, $daerahLower) !== false) {
                        $app['daerah'] = $value;
                        break;
                    }
                }
                // If no match, just capitalize properly
                if (!isset($standardDaerah[$daerahLower])) {
                    $app['daerah'] = ucwords(strtolower($app['daerah']));
                }
            }
        }
    }
    
    echo json_encode([
        'error' => false,
        'applications' => $applications,
        'total' => count($applications),
        'jenis_borang' => $jenis_borang
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'ERROR: ' . $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
        'code' => $e->getCode()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'EXCEPTION: ' . $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ]);
}
