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

    switch ($method) {
        case 'GET':
            // Get all announcements (for all users) or specific announcement
            $id = isset($_GET['id']) ? (int)$_GET['id'] : null;

            if ($id) {
                // Get specific announcement
                $stmt = $pdo->prepare("
                    SELECT id, title, content, created_by, created_at
                    FROM announcements
                    WHERE id = ?
                ");
                $stmt->execute([$id]);
                $announcement = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$announcement) {
                    http_response_code(404);
                    echo json_encode([
                        'error' => true,
                        'message' => 'Pengumuman tidak ditemui'
                    ]);
                    exit;
                }

                $announcement['created_at_formatted'] = date('d/m/Y H:i', strtotime($announcement['created_at']));

                echo json_encode([
                    'error' => false,
                    'announcement' => $announcement
                ]);
            } else {
                // Get all announcements
                $stmt = $pdo->prepare("
                    SELECT id, title, content, created_by, created_at
                    FROM announcements
                    ORDER BY created_at DESC
                ");
                $stmt->execute();
                $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // Format dates
                foreach ($announcements as &$announcement) {
                    $announcement['created_at_formatted'] = date('d/m/Y H:i', strtotime($announcement['created_at']));
                }

                echo json_encode([
                    'error' => false,
                    'announcements' => $announcements
                ]);
            }
            break;

        case 'POST':
            // Create new announcement (admin only)
            if ($_SESSION['user_role'] !== 'Admin') {
                http_response_code(403);
                echo json_encode([
                    'error' => true,
                    'message' => 'Hanya admin boleh membuat pengumuman'
                ]);
                exit;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $title = trim($input['title'] ?? '');
            $content = trim($input['content'] ?? '');

            if (empty($title) || empty($content)) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Tajuk dan kandungan diperlukan'
                ]);
                exit;
            }

            $stmt = $pdo->prepare("
                INSERT INTO announcements (title, content, created_by)
                VALUES (?, ?, ?)
            ");
            $stmt->execute([$title, $content, $_SESSION['user_id']]);

            echo json_encode([
                'error' => false,
                'message' => 'Pengumuman berjaya dibuat',
                'id' => $pdo->lastInsertId()
            ]);
            break;

        case 'PUT':
            // Update announcement (admin only)
            if ($_SESSION['user_role'] !== 'Admin') {
                http_response_code(403);
                echo json_encode([
                    'error' => true,
                    'message' => 'Hanya admin boleh mengedit pengumuman'
                ]);
                exit;
            }

            $id = isset($_GET['id']) ? (int)$_GET['id'] : null;

            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'ID pengumuman diperlukan'
                ]);
                exit;
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $title = trim($input['title'] ?? '');
            $content = trim($input['content'] ?? '');

            if (empty($title) || empty($content)) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Tajuk dan kandungan diperlukan'
                ]);
                exit;
            }

            $stmt = $pdo->prepare("
                UPDATE announcements
                SET title = ?, content = ?
                WHERE id = ?
            ");
            $stmt->execute([$title, $content, $id]);

            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode([
                    'error' => true,
                    'message' => 'Pengumuman tidak ditemui'
                ]);
                exit;
            }

            echo json_encode([
                'error' => false,
                'message' => 'Pengumuman berjaya dikemaskini'
            ]);
            break;

        case 'DELETE':
            // Delete announcement (admin only)
            if ($_SESSION['user_role'] !== 'Admin') {
                http_response_code(403);
                echo json_encode([
                    'error' => true,
                    'message' => 'Hanya admin boleh memadam pengumuman'
                ]);
                exit;
            }

            $id = isset($_GET['id']) ? (int)$_GET['id'] : null;

            if (!$id) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'ID pengumuman diperlukan'
                ]);
                exit;
            }

            $stmt = $pdo->prepare("DELETE FROM announcements WHERE id = ?");
            $stmt->execute([$id]);

            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode([
                    'error' => true,
                    'message' => 'Pengumuman tidak ditemui'
                ]);
                exit;
            }

            echo json_encode([
                'error' => false,
                'message' => 'Pengumuman berjaya dipadam'
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
    error_log('Announcements API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Ralat dalaman server'
    ]);
}
?>