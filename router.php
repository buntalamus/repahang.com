<?php
// Router for PHP built-in development server
// Serves Angular SPA from frontend/dist/frontend/browser/
// Routes /api/* to api/*.php

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// API requests
if (preg_match('#^/api/(.+)$#', $uri, $matches)) {
    $apiFile = __DIR__ . '/api/' . basename($matches[1]);
    if (file_exists($apiFile)) {
        require $apiFile;
        return true;
    }
    http_response_code(404);
    echo json_encode(['error' => true, 'message' => 'API not found']);
    return true;
}

// Serve uploaded files (profile images, receipts)
if (preg_match('#^/uploads/(.+)$#', $uri, $matches)) {
    // Normalize and prevent path traversal
    $safePath = str_replace('\\', '/', $matches[1]);
    $uploadFile = realpath(__DIR__ . '/uploads/' . $safePath);
    $uploadsDir = realpath(__DIR__ . '/uploads');
    if ($uploadFile && $uploadsDir && strncmp($uploadFile, $uploadsDir, strlen($uploadsDir)) === 0 && file_exists($uploadFile)) {
        return false; // Let PHP serve the static file
    }
    http_response_code(404);
    echo 'File not found';
    return true;
}

// Standalone token-based pages (no Angular)
if ($uri === '/penilaian-borang' || $uri === '/penilaian-borang.html') {
    readfile(__DIR__ . '/penilaian-borang.html');
    return true;
}

// Static files from Angular build
$browserDir = __DIR__ . '/frontend/dist/frontend/browser';
$filePath = $browserDir . $uri;

if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    return false; // Let PHP serve the static file
}

// SPA fallback - serve index.html for all other routes
$indexFile = $browserDir . '/index.html';
if (file_exists($indexFile)) {
    readfile($indexFile);
    return true;
}

http_response_code(404);
echo 'index.html not found';
