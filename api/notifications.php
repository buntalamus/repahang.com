<?php
/**
 * Notifications API
 * Get notifications for logged-in user
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json');

try {
    $currentUser = requireAuth();
    $pdo = getDbConnection();
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get all notifications for user
        $stmt = $pdo->prepare("
            SELECT 
                id,
                type,
                subject,
                message,
                is_read,
                created_at
            FROM notifications
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 50
        ");
        
        $stmt->execute([':user_id' => $currentUser['id']]);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Count unread
        $unreadStmt = $pdo->prepare("
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = :user_id
            AND is_read = 0
        ");
        
        $unreadStmt->execute([':user_id' => $currentUser['id']]);
        $unreadRow = $unreadStmt->fetch(PDO::FETCH_ASSOC);
        $unreadCount = (int) ($unreadRow['count'] ?? 0);
        
        jsonResponse([
            'error' => false,
            'notifications' => $notifications,
            'unread_count' => $unreadCount
        ]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Mark as read
        $input = getJsonInput();
        $action = $input['action'] ?? '';
        
        if ($action === 'mark_read') {
            $notifId = (int) ($input['notification_id'] ?? 0);
            
            if ($notifId) {
                // Mark single notification as read
                $stmt = $pdo->prepare("
                    UPDATE notifications
                    SET is_read = 1
                    WHERE id = :id
                    AND user_id = :user_id
                ");
                
                $stmt->execute([
                    ':id' => $notifId,
                    ':user_id' => $currentUser['id']
                ]);
                
                jsonResponse([
                    'error' => false,
                    'message' => 'Notification marked as read'
                ]);
            } else {
                throw new Exception('Invalid notification ID');
            }
            
        } elseif ($action === 'mark_all_read') {
            // Mark all notifications as read
            $stmt = $pdo->prepare("
                UPDATE notifications
                SET is_read = 1
                WHERE user_id = :user_id
                AND is_read = 0
            ");
            
            $stmt->execute([':user_id' => $currentUser['id']]);
            
            jsonResponse([
                'error' => false,
                'message' => 'All notifications marked as read'
            ]);
            
        } else {
            throw new Exception('Invalid action');
        }
        
    } else {
        throw new Exception('Method not allowed');
    }
    
} catch (Throwable $e) {
    error_log('[notifications.php] Error: ' . $e->getMessage());
    jsonResponse([
        'error' => true,
        'message' => APP_DEBUG ? $e->getMessage() : 'Failed to load notifications'
    ], 500);
}
