<?php
/**
 * Check Maintenance Mode API
 * Returns maintenance status
 */

session_start();

header('Content-Type: application/json');

// Check if user is admin
$isAdmin = ($_SESSION['user_role'] ?? null) === 'Admin' || isset($_SESSION['admin_id']);

// Check maintenance flag file
$maintenanceFlag = __DIR__ . '/../storage/maintenance.flag';
$isMaintenanceMode = file_exists($maintenanceFlag);

echo json_encode([
    'maintenance_mode' => $isMaintenanceMode,
    'is_admin' => $isAdmin,
    'can_access' => !$isMaintenanceMode || $isAdmin
]);
