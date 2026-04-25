<?php

/**
 * Environment Variable Loader
 * Loads .env file and provides helper function to access values safely.
 */

declare(strict_types=1);

/**
 * Load .env file into environment variables (only if not already set).
 */
function loadEnv(string $path): void
{
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);

        // Skip comments
        if ($line === '' || $line[0] === '#') {
            continue;
        }

        $eqPos = strpos($line, '=');
        if ($eqPos === false) {
            continue;
        }

        $key = trim(substr($line, 0, $eqPos));
        $value = trim(substr($line, $eqPos + 1));

        // Remove surrounding quotes
        if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) {
            $value = substr($value, 1, -1);
        }

        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

/**
 * Get environment variable with optional default.
 */
function env(string $key, string $default = ''): string
{
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

// Auto-load config from project root
if (is_readable(__DIR__ . '/../.env')) {
    loadEnv(__DIR__ . '/../.env');
} elseif (is_readable(__DIR__ . '/../config.ini')) {
    loadEnv(__DIR__ . '/../config.ini');
} elseif (is_readable(__DIR__ . '/../env.ini')) {
    loadEnv(__DIR__ . '/../env.ini');
}
