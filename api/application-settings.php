<?php

/**
 * Application Settings API
 * GET: Retrieve all application settings
 * POST: Update application settings
 */

require_once 'bootstrap.php';

header('Content-Type: application/json');

try {
    // Require Admin role
    requireAuth();

    if ($_SESSION['user_role'] !== 'Admin') {
        http_response_code(403);
        echo json_encode(['error' => true, 'message' => 'Akses ditolak. Hanya admin boleh mengakses.']);
        exit;
    }

    $pdo = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get all settings
        $stmt = $pdo->query("
            SELECT setting_key, setting_value, setting_description, updated_at
            FROM application_settings
            ORDER BY setting_key
        ");

        $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Convert to key-value pairs for easier frontend consumption
        $settingsMap = [];
        foreach ($settings as $setting) {
            $settingsMap[$setting['setting_key']] = [
                'value' => $setting['setting_value'],
                'description' => $setting['setting_description'],
                'updated_at' => $setting['updated_at']
            ];
        }

        echo json_encode([
            'error' => false,
            'settings' => $settingsMap
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Update settings
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || !isset($data['settings'])) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Data tetapan diperlukan.']);
            exit;
        }

        $pdo->beginTransaction();

        try {
            foreach ($data['settings'] as $key => $value) {
                // Validate setting values
                switch ($key) {
                    case 'applications_open':
                        if (!in_array($value, ['0', '1'])) {
                            throw new Exception("Nilai untuk '$key' mestilah 0 atau 1.");
                        }
                        break;
                    case 'min_verified_matches':
                        if (!is_numeric($value) || $value < 0) {
                            throw new Exception("Nilai untuk '$key' mestilah nombor positif.");
                        }
                        break;
                    case 'payment_amount':
                        if (!is_numeric($value) || $value < 0) {
                            throw new Exception("Nilai untuk '$key' mestilah nombor positif.");
                        }
                        break;
                    case 'application_year':
                        if (!is_numeric($value) || $value < 2024 || $value > 2030) {
                            throw new Exception("Nilai untuk '$key' mestilah tahun antara 2024-2030.");
                        }
                        break;
                    case 'max_applications_per_year':
                        if (!is_numeric($value) || $value < 1) {
                            throw new Exception("Nilai untuk '$key' mestilah sekurang-kurangnya 1.");
                        }
                        break;
                    case 'require_profile_complete':
                    case 'auto_link_matches':
                        if (!in_array($value, ['0', '1'])) {
                            throw new Exception("Nilai untuk '$key' mestilah 0 atau 1.");
                        }
                        break;
                }

                // Update or insert setting
                $stmt = $pdo->prepare("
                    INSERT INTO application_settings (setting_key, setting_value)
                    VALUES (:key, :value)
                    ON DUPLICATE KEY UPDATE setting_value = :value
                ");

                $stmt->execute([
                    'key' => $key,
                    'value' => $value
                ]);
            }

            $pdo->commit();

            echo json_encode([
                'error' => false,
                'message' => 'Tetapan berjaya dikemaskini.'
            ]);
            exit;

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    http_response_code(405);
    echo json_encode(['error' => true, 'message' => 'Method not allowed']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => APP_DEBUG ? $e->getMessage() : 'Ralat sistem berlaku.',
        'line' => APP_DEBUG ? $e->getLine() : null
    ]);
}