<?php
header('Content-Type: application/json');

// Include bootstrap for session and database setup
require_once 'bootstrap.php';

// Check if user is logged in and is PP Daerah
if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'PP Daerah') {
    http_response_code(401);
    echo json_encode(['error' => true, 'message' => 'Unauthorized access']);
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    // Get referee registration application status
    $referee_query = "SELECT status, tarikh_hantar, status_kemaskini, admin_notes
                     FROM permohonan
                     WHERE user_id = ? AND jenis_borang = 'pengadil_berdaftar'
                     ORDER BY tarikh_hantar DESC LIMIT 1";

    $stmt = $pdo->prepare($referee_query);
    $stmt->execute([$user_id]);
    $referee_result = $stmt->fetch(PDO::FETCH_ASSOC);

    $referee_status = null;
    if ($referee_result) {
        $referee_status = [
            'status' => $referee_result['status'],
            'description' => getStatusDescription($referee_result['status'], $referee_result['admin_notes']),
            'created_at' => $referee_result['tarikh_hantar'],
            'updated_at' => $referee_result['status_kemaskini']
        ];
    }

    // Get futsal referee application status
    $futsal_query = "SELECT status, tarikh_hantar, status_kemaskini, admin_notes
                    FROM permohonan
                    WHERE user_id = ? AND jenis_borang = 'pengadil_futsal'
                    ORDER BY tarikh_hantar DESC LIMIT 1";

    $stmt = $pdo->prepare($futsal_query);
    $stmt->execute([$user_id]);
    $futsal_result = $stmt->fetch(PDO::FETCH_ASSOC);

    $futsal_status = null;
    if ($futsal_result) {
        $futsal_status = [
            'status' => $futsal_result['status'],
            'description' => getStatusDescription($futsal_result['status'], $futsal_result['admin_notes']),
            'created_at' => $futsal_result['tarikh_hantar'],
            'updated_at' => $futsal_result['status_kemaskini']
        ];
    }

    // Get fitness test application status
    $fitness_query = "SELECT status, created_at as tarikh_hantar, updated_at as status_kemaskini, NULL as admin_notes
                     FROM permohonan_ujian_kecergasan
                     WHERE user_id = ?
                     ORDER BY created_at DESC LIMIT 1";

    $stmt = $pdo->prepare($fitness_query);
    $stmt->execute([$user_id]);
    $fitness_result = $stmt->fetch(PDO::FETCH_ASSOC);

    $fitness_status = null;
    if ($fitness_result) {
        $fitness_status = [
            'status' => $fitness_result['status'],
            'description' => getStatusDescription($fitness_result['status'], $fitness_result['admin_notes']),
            'created_at' => $fitness_result['tarikh_hantar'],
            'updated_at' => $fitness_result['status_kemaskini']
        ];
    }

    // Get written test application status
    $written_query = "SELECT status, created_at as tarikh_hantar, updated_at as status_kemaskini, NULL as admin_notes
                     FROM permohonan_ujian_bertulis
                     WHERE user_id = ?
                     ORDER BY created_at DESC LIMIT 1";

    $stmt = $pdo->prepare($written_query);
    $stmt->execute([$user_id]);
    $written_result = $stmt->fetch(PDO::FETCH_ASSOC);

    $written_status = null;
    if ($written_result) {
        $written_status = [
            'status' => $written_result['status'],
            'description' => getStatusDescription($written_result['status'], $written_result['admin_notes']),
            'created_at' => $written_result['tarikh_hantar'],
            'updated_at' => $written_result['status_kemaskini']
        ];
    }

    // Return combined status data
    echo json_encode([
        'error' => false,
        'status' => [
            'referee_registration' => $referee_status,
            'futsal_referee' => $futsal_status,
            'fitness_test' => $fitness_status,
            'written_test' => $written_status
        ]
    ]);

} catch (Exception $e) {
    error_log('PP Application Status Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => 'Internal server error']);
}

// Helper function to get status description
function getStatusDescription($status, $catatan_admin = null) {
    $status = strtolower($status); // Convert to lowercase for consistency
    switch ($status) {
        case 'pending':
            return 'Permohonan sedang diproses oleh admin';
        case 'approved':
            return 'Permohonan telah diluluskan - borang sedia dimuat turun';
        case 'rejected':
            return $catatan_admin ? 'Permohonan ditolak: ' . $catatan_admin : 'Permohonan telah ditolak';
        default:
            return 'Status tidak diketahui';
    }
}
?>