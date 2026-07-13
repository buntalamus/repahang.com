<?php
/**
 * Taraf Pengadil API (Admin)
 * POST /api/pengadil-taraf.php
 *   user_ids: int[]                          - satu atau banyak (batch)
 *   taraf:    kebangsaan | negeri | daerah
 *   value:    0 | 1
 *
 * Toggle taraf Pengadil Kebangsaan / Negeri / Daerah. Boleh lebih dari satu
 * taraf aktif serentak bagi seorang pengadil (kolum berasingan).
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$currentUser = requireRole(['Admin']);

$TARAF_COLUMNS = [
    'kebangsaan' => 'pengadil_kebangsaan',
    'negeri'     => 'pengadil_negeri',
    'daerah'     => 'pengadil_daerah',
];

try {
    $pdo = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['error' => true, 'message' => 'Kaedah tidak disokong.'], 405);
    }

    $input   = getJsonInput();
    $userIds = array_values(array_filter(array_map('intval', (array) ($input['user_ids'] ?? []))));
    $taraf   = trim($input['taraf'] ?? '');
    $value   = (int) ($input['value'] ?? -1);

    if (empty($userIds) || !isset($TARAF_COLUMNS[$taraf]) || !in_array($value, [0, 1], true)) {
        jsonResponse(['error' => true, 'message' => 'user_ids, taraf (kebangsaan/negeri/daerah) dan value (0/1) diperlukan.'], 400);
    }

    $col = $TARAF_COLUMNS[$taraf];
    $placeholders = implode(',', array_fill(0, count($userIds), '?'));

    $stmt = $pdo->prepare("UPDATE users SET {$col} = ? WHERE id IN ({$placeholders})");
    $stmt->execute(array_merge([$value], $userIds));
    $count = $stmt->rowCount();

    $label  = ['kebangsaan' => 'Pengadil Kebangsaan', 'negeri' => 'Pengadil Negeri', 'daerah' => 'Pengadil Daerah'][$taraf];
    $action = $value === 1 ? 'ditetapkan' : 'dibuang';

    jsonResponse([
        'error'   => false,
        'message' => "Taraf {$label} {$action} untuk {$count} pengadil.",
        'count'   => $count,
    ]);

} catch (Throwable $e) {
    error_log('[pengadil-taraf.php] ' . $e->getMessage());
    $msg = APP_DEBUG ? $e->getMessage() : 'Ralat pelayan.';
    jsonResponse(['error' => true, 'message' => $msg], 500);
}
