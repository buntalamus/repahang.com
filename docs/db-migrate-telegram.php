<?php
/**
 * One-time DB migration: add Telegram columns
 * Run: php docs/db-migrate-telegram.php
 */
declare(strict_types=1);
require_once __DIR__ . '/../api/bootstrap.php';

$pdo = getDbConnection();

$tasks = [
    'users.telegram_chat_id' => [
        'check' => 'SHOW COLUMNS FROM users LIKE "telegram_chat_id"',
        'sql'   => 'ALTER TABLE users ADD COLUMN telegram_chat_id BIGINT NULL DEFAULT NULL AFTER no_telefon',
    ],
    'pengadil_luar.telegram_chat_id' => [
        'check' => 'SHOW COLUMNS FROM pengadil_luar LIKE "telegram_chat_id"',
        'sql'   => 'ALTER TABLE pengadil_luar ADD COLUMN telegram_chat_id BIGINT NULL DEFAULT NULL AFTER emel',
    ],
    'lantikan_pengadil.tg_token' => [
        'check' => 'SHOW COLUMNS FROM lantikan_pengadil LIKE "tg_token"',
        'sql'   => 'ALTER TABLE lantikan_pengadil ADD COLUMN tg_token VARCHAR(64) NULL DEFAULT NULL AFTER notif_hantar',
    ],
    'lantikan_pengadil.tg_notif_hantar' => [
        'check' => 'SHOW COLUMNS FROM lantikan_pengadil LIKE "tg_notif_hantar"',
        'sql'   => 'ALTER TABLE lantikan_pengadil ADD COLUMN tg_notif_hantar TINYINT(1) NOT NULL DEFAULT 0 AFTER tg_token',
    ],
    'users.tg_link_token' => [
        'check' => 'SHOW COLUMNS FROM users LIKE "tg_link_token"',
        'sql'   => 'ALTER TABLE users ADD COLUMN tg_link_token VARCHAR(64) NULL DEFAULT NULL AFTER telegram_chat_id',
    ],
    'pengadil_luar.tg_link_token' => [
        'check' => 'SHOW COLUMNS FROM pengadil_luar LIKE "tg_link_token"',
        'sql'   => 'ALTER TABLE pengadil_luar ADD COLUMN tg_link_token VARCHAR(64) NULL DEFAULT NULL AFTER telegram_chat_id',
    ],
    'lantikan_pengadil.email_token' => [
        'check' => 'SHOW COLUMNS FROM lantikan_pengadil LIKE "email_token"',
        'sql'   => 'ALTER TABLE lantikan_pengadil ADD COLUMN email_token VARCHAR(64) NULL DEFAULT NULL AFTER tg_token',
    ],
];

foreach ($tasks as $name => $task) {
    $exists = $pdo->query($task['check'])->fetch();
    if ($exists) {
        echo "SKIP  $name (already exists)\n";
    } else {
        $pdo->exec($task['sql']);
        echo "ADDED $name\n";
    }
}

echo "\nDone.\n";
