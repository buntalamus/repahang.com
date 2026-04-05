<?php
/**
 * Public Registration Status API
 * GET: Check if new account registration is open (no auth required)
 */
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => true, 'message' => 'Method not allowed'], 405);
}

try {
    $pdo = getDbConnection();
    $stmt = $pdo->prepare("SELECT setting_value FROM application_settings WHERE setting_key = 'registration_open'");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    // Default to open if setting doesn't exist yet
    $isOpen = $row ? ($row['setting_value'] === '1') : true;

    jsonResponse([
        'error' => false,
        'registration_open' => $isOpen
    ]);
} catch (Exception $e) {
    jsonResponse(['error' => true, 'message' => 'Ralat sistem.'], 500);
}
