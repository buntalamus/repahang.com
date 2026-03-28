<?php

/**

 * Admin Settings API

 * Manage application settings

 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';



// Check if user is admin
if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
    jsonResponse(['error' => true, 'message' => 'Akses ditolak. Hanya admin dibenarkan.'], 403);
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDbConnection();

    switch ($method) {
        case 'GET':
            // Get all settings
            $stmt = $pdo->query('SELECT setting_key, setting_value FROM application_settings ORDER BY setting_key');
            $settings = [];
            while ($row = $stmt->fetch()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
            
            // Check maintenance mode from file
            $maintenanceFlag = __DIR__ . '/../storage/maintenance.flag';
            $settings['maintenance_mode'] = file_exists($maintenanceFlag) ? '1' : '0';

            jsonResponse([
                'error' => false,
                'settings' => $settings
            ]);
            break;

        case 'POST':
            // Update settings
            $input = getJsonInput();

            if (empty($input)) {
                jsonResponse(['error' => true, 'message' => 'Data tetapan diperlukan.'], 400);
            }

            $pdo->beginTransaction();

            try {
                foreach ($input as $key => $value) {
                    // Validate and sanitize input
                    $sanitizedValue = trim((string)$value);

                    // Special handling for maintenance mode
                    if ($key === 'maintenance_mode') {
                        $maintenanceFlag = __DIR__ . '/../storage/maintenance.flag';
                        
                        if ($sanitizedValue === '1') {
                            // Create maintenance flag file
                            if (!file_exists(dirname($maintenanceFlag))) {
                                mkdir(dirname($maintenanceFlag), 0755, true);
                            }
                            file_put_contents($maintenanceFlag, date('Y-m-d H:i:s'));
                        } else {
                            // Remove maintenance flag file
                            if (file_exists($maintenanceFlag)) {
                                unlink($maintenanceFlag);
                            }
                        }
                    }

                    // Update or insert setting
                    $stmt = $pdo->prepare('
                        INSERT INTO application_settings (setting_key, setting_value)
                        VALUES (:key, :value)
                        ON DUPLICATE KEY UPDATE setting_value = :value
                    ');
                    $stmt->execute([':key' => $key, ':value' => $sanitizedValue]);
                }

                $pdo->commit();

                jsonResponse([
                    'error' => false,
                    'message' => 'Tetapan berjaya dikemaskini.'
                ]);

            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            break;

        case 'DELETE':
            // Reset settings to defaults
            $defaultSettings = [
                'applications_open' => '1',
                'min_verified_matches' => '20',
                'payment_amount' => '80.00',
                'application_year' => date('Y') + 1,
                'max_applications_per_year' => '1',
                'require_profile_complete' => '1',
                'auto_link_matches' => '1'
            ];

            $pdo->beginTransaction();

            try {
                // Delete all existing settings
                $pdo->exec('DELETE FROM application_settings');

                // Insert default settings
                foreach ($defaultSettings as $key => $value) {
                    $stmt = $pdo->prepare('
                        INSERT INTO application_settings (setting_key, setting_value, setting_description)
                        VALUES (:key, :value, :description)
                    ');

                    $description = match($key) {
                        'applications_open' => 'Whether applications are currently open (1 = open, 0 = closed)',
                        'min_verified_matches' => 'Minimum number of verified matches required for application',
                        'payment_amount' => 'Application fee amount in RM',
                        'application_year' => 'Current application year',
                        'max_applications_per_year' => 'Maximum applications allowed per user per year',
                        'require_profile_complete' => 'Whether profile must be complete before applying (1 = yes, 0 = no)',
                        'auto_link_matches' => 'Whether to automatically link verified matches to new applications (1 = yes, 0 = no)',
                        default => ''
                    };

                    $stmt->execute([':key' => $key, ':value' => $value, ':description' => $description]);
                }

                $pdo->commit();

                jsonResponse([
                    'error' => false,
                    'message' => 'Tetapan telah direset kepada nilai lalai.'
                ]);

            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            break;

        default:
            jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
    }

} catch (PDOException $e) {
    error_log('Settings API error: ' . $e->getMessage());
    jsonResponse(['error' => true, 'message' => 'Ralat pangkalan data.'], 500);
}
?>