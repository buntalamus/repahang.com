<?php
// Match TCPDF's original GD alpha and gamma processing, without changing the logo.
$img=imagecreatefrompng($argv[1]);$w=imagesx($img);$h=imagesy($img);
$mask=imagecreate($w,$h);for($c=0;$c<256;$c++)imagecolorallocate($mask,$c,$c,$c);
for($x=0;$x<$w;$x++)for($y=0;$y<$h;$y++){
    $color=imagecolorsforindex($img,imagecolorat($img,$x,$y));
    $a=(int)(((127-$color['alpha'])/127)*255);
    imagesetpixel($mask,$x,$y,(int)(pow($a/255,2.2)*255));
}
$plain=imagecreatetruecolor($w,$h);imagecopy($plain,$img,0,0,0,0,$w,$h);
ob_start();imagepng($plain);$rgb=ob_get_clean();ob_start();imagepng($mask);$alpha=ob_get_clean();
echo json_encode(['rgb'=>base64_encode($rgb),'mask'=>base64_encode($alpha)]);
