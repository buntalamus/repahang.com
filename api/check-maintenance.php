<?php
/**
 * Check Maintenance Mode API
 * Returns maintenance status
 */

session_start();

header('Content-Type: application/json');

// Check if user is admin
$isAdmin = isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'Admin';

// Check maintenance flag file
$maintenanceFlag = __DIR__ . '/../storage/maintenance.flag';
$isMaintenanceMode = file_exists($maintenanceFlag);

echo json_encode([
    'maintenance_mode' => $isMaintenanceMode,
    'is_admin' => $isAdmin,
    'can_access' => !$isMaintenanceMode || $isAdmin
]);
