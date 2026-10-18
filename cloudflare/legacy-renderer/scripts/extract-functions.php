<?php
// Build-time only: preserve complete function tokens, including their original markup.
$source = file_get_contents($argv[1]);
$wanted = array_flip(array_slice($argv, 2));
$tokens = token_get_all($source); $out = [];
for ($i=0; $i<count($tokens); $i++) {
    if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) continue;
    $start = $i; $name = null;
    for ($j=$i+1; $j<count($tokens); $j++) {
        if (is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) {$name=$tokens[$j][1];break;}
        if ($tokens[$j] === '(') break;
    }
    if (!$name || !isset($wanted[$name])) continue;
    $depth=0; $begun=false; $text='';
    for ($j=$start; $j<count($tokens); $j++) {
        $t=$tokens[$j];$text.=is_array($t)?$t[1]:$t;
        if ($t === '{' || (is_array($t) && in_array($t[0],[T_CURLY_OPEN,T_DOLLAR_OPEN_CURLY_BRACES],true))) {$depth++;$begun=true;}
        if ($t === '}') { $depth--; if ($begun && $depth===0) break; }
    }
    $out[$name]=$text;
}
if (count($out)!==count($wanted)) throw new RuntimeException('Missing source function');
echo json_encode($out,JSON_THROW_ON_ERROR);
