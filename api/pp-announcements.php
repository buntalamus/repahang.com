<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // Check authentication for all methods
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode([
            'error' => true,
            'message' => 'Sesi tidak sah'
        ]);
        exit;
    }

    // Check if user is PP Daerah
    if ($_SESSION['user_role'] !== 'PP Daerah') {
        http_response_code(403);
        echo json_encode([
            'error' => true,
            'message' => 'Akses tidak dibenarkan'
        ]);
        exit;
    }

    switch ($method) {
        case 'GET':
            // Get announcements for PP users (latest 10)
            $stmt = $pdo->prepare("
                SELECT id, title, content, created_at
                FROM announcements
                ORDER BY created_at DESC
                LIMIT 10
            ");
            $stmt->execute();
            $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'error' => false,
                'announcements' => $announcements
            ]);
            break;

        default:
            http_response_code(405);
            echo json_encode([
                'error' => true,
                'message' => 'Kaedah tidak dibenarkan'
            ]);
            break;
    }

} catch (Exception $e) {
    error_log('PP Announcements API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Ralat dalaman server'
    ]);
}
?>