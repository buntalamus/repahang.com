<?php
// Test-only adapter. The production Worker never invokes an external PHP host.
ini_set('display_errors','0');error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);
define('ORIGINAL_NATIVE_TEST',true);
require $argv[1].'/entry.php';
$payload=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
echo json_encode(renderOriginal($payload),JSON_THROW_ON_ERROR|JSON_INVALID_UTF8_SUBSTITUTE);
