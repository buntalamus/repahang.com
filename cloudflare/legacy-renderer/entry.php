<?php
declare(strict_types=1);
// Data-only bridge: the original PHP owns every form coordinate and email markup.
date_default_timezone_set('Asia/Kuala_Lumpur');
$_SERVER['DOCUMENT_ROOT'] = __DIR__;
define('K_PATH_CACHE', '/tmp/');
define('K_TCPDF_THROW_EXCEPTION_ERROR', true);
// TCPDF declares optional cURL defaults even when all images are local.
// Constants do not enable networking; no cURL functions exist in this runtime.
foreach (["CURLOPT_CONNECTTIMEOUT"=> 78, "CURLOPT_FAILONERROR"=> 45, "CURLOPT_FOLLOWLOCATION"=> 52, "CURLOPT_MAXREDIRS"=> 68, "CURLOPT_RETURNTRANSFER"=> 19913, "CURLOPT_SSL_VERIFYHOST"=> 81, "CURLOPT_SSL_VERIFYPEER"=> 64, "CURLOPT_TIMEOUT"=> 13, "CURLOPT_URL"=> 10002, "CURLOPT_USERAGENT"=> 10018, "CURLOPT_PROTOCOLS"=> 181, "CURLPROTO_FTP"=> 4, "CURLPROTO_FTPS"=> 8, "CURLPROTO_HTTP"=> 1, "CURLPROTO_HTTPS"=> 2] as $name=>$value) if (!defined($name)) define($name,$value);
require_once __DIR__.'/vendor/tcpdf/tcpdf.php';
foreach (['r1','r1_penilai','r2','r3','r3a','r4','r11'] as $template) require_once __DIR__.'/templates/'.$template.'.php';
require_once __DIR__.'/email-templates.php';
require_once __DIR__.'/futsal.php';
require_once __DIR__.'/fitness.php';
require_once __DIR__.'/config/kriteria-penilaian.php';

function env(string $name, string $fallback = ''): string {
    return $GLOBALS['renderContext'][$name] ?? ['BASE_URL'=>'https://refpahang.com','TELEGRAM_BOT_USERNAME'=>'refpahang_bot'][$name] ?? $fallback;
}
function sendEmail($to,$subject,$html,$name=null,$type='admin',$images=[],$attachments=[]): bool {
    $GLOBALS['renderedEmail'] = ['subject'=>$subject,'html'=>$html,'type'=>$type];
    return true;
}
final class OriginalStatement extends PDOStatement {
    public function __construct(private array $rows) {}
    public function execute(?array $params = null): bool {return true;}
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array {return $this->rows;}
    public function fetch(int $mode = PDO::FETCH_DEFAULT,int $orientation = PDO::FETCH_ORI_NEXT,int $offset = 0): mixed {return $this->rows[0] ?? false;}
    public function fetchColumn(int $column = 0): mixed {return array_values($this->rows[0] ?? [])[$column] ?? false;}
}
final class OriginalPDO extends PDO {
    public function __construct(private array $rows = []) {}
    public function prepare(string $query,array $options=[]): PDOStatement|false {return new OriginalStatement($this->rows);}
}

final class OriginalTCPDF extends TCPDF {
    // GD is optional in the edge PHP runtime. Use its precomputed, unmodified
    // TCPDF image/soft-mask output; all template drawing still runs in TCPDF.
    protected function ImagePngAlpha($file,$x,$y,$wpx,$hpx,$w,$h,$type,$link,$align,$resize,$dpi,$palign,$filehash='') {
        if (!is_file($file.'.mask.png') || !is_file($file.'.rgb.png')) {
            return parent::ImagePngAlpha($file,$x,$y,$wpx,$hpx,$w,$h,$type,$link,$align,$resize,$dpi,$palign,$filehash);
        }
        $mask=$this->Image($file.'.mask.png',$x,$y,$w,$h,'PNG','','',$resize,$dpi,'',true,false);
        return $this->Image($file.'.rgb.png',$x,$y,$w,$h,$type,$link,$align,$resize,$dpi,$palign,false,$mask);
    }
}
function originalRegistration(array $p): string {
    $data=$p['data'];$data['no_ic']=$data['no_ic'] ?? $data['no_kp'] ?? '';
    $data['user_email']=$data['emel'] ?? $data['user_email'] ?? '';
    // The original templates read local files. The bridge only writes validated image bytes.
    if (!empty($p['photo'])) {
        $ext=writeImage($p['photo'],'photo');$data['url_gambar_profil']='/request/photo.'.$ext;
        if (!empty($p['photo_rgb']) && !empty($p['photo_mask'])) {
            writeImage($p['photo_rgb'],'photo.'.$ext.'.rgb');writeImage($p['photo_mask'],'photo.'.$ext.'.mask');
        }
    }
    $class=defined('ORIGINAL_NATIVE_TEST')?'TCPDF':'OriginalTCPDF';
    $pdf=new $class(PDF_PAGE_ORIENTATION,PDF_UNIT,PDF_PAGE_FORMAT,true,'UTF-8',false);
    $pdf->setPrintHeader(false);$pdf->setPrintFooter(false);$pdf->setMargins(15,15,15);$pdf->AddPage();
    $type=$p['type'];$form=$p['form'] ?? null;
    if ($type==='penilai_berdaftar') generateR1PenilaiPdf($pdf,$data);
    elseif ($type==='pengadil_berdaftar') {
        $first=true;
        foreach (['r1','r2','r4'] as $kind) {
            if ($form!==null && $form!==$kind) continue;
            if (!$first) $pdf->AddPage();$first=false;
            if ($kind==='r1') generateR1Pdf($pdf,$data);
            elseif ($kind==='r2') generateR2Pdf($pdf,$data,new OriginalPDO($p['matches'] ?? []));
            else generateR4Pdf($pdf,$data);
        }
    } elseif (in_array($type,['kelas3_fam','ujian_kecergasan'],true)) generateR4Pdf($pdf,$data);
    else generateR11Pdf($pdf,$data,$type==='ujian_kelas1'?'I':'III');
    return $pdf->Output('','S');
}
function writeImage(string $url,string $name): string {
    if (!preg_match('#^data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)$#D',$url,$m)) throw new RuntimeException('Invalid image');
    $bytes=base64_decode($m[2],true);if ($bytes===false || strlen($bytes)>2000000) throw new RuntimeException('Image limit');
    $ext=$m[1]==='png'?'png':'jpg';file_put_contents(__DIR__.'/request/'.$name.'.'.$ext,$bytes);return $ext;
}
function originalAssessment(array $p): string {
    $report=$p['report'];$pegawaiList=$p['officials'];$autoprint=$p['autoprint'] ?? false;
    foreach ($pegawaiList as &$official) foreach (['kawalan','fizikal','kerjasama'] as $section) foreach (['kekuatan','kelemahan'] as $kind) {
        $key=$section.'_'.$kind;
        if (!is_array($official[$key] ?? null)) $official[$key]=json_decode((string)($official[$key] ?? ''),true) ?: [];
    }
    unset($official);
    foreach (['logo_kiri','logo_kanan','logo_home','logo_away'] as $name) {
        if (!empty($report[$name.'_data'])) $report[$name]='/request/'.$name.'.'.writeImage($report[$name.'_data'],$name);
        else $report[$name]='';
    }
    $GLOBALS['bulan']=['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
    ob_start();include __DIR__.'/api/assessment-view.php';return ob_get_clean();
}
function originalSchedule(array $p): string {
    $kejohanan=$p['document']['kejohanan'];$pengesahan=$p['document']['pengesahan'];
    $regionLabel=$p['document']['region_label'];$generatedBy=$p['printedBy'];
    $JAWATAN_SHORT=['Pengadil'=>'R','Penolong Pengadil 1'=>'AR1','Penolong Pengadil 2'=>'AR2','Pegawai ke4'=>'P4','Penilai Pengadil'=>'RA'];
    $JAWATAN_LIST=array_keys($JAWATAN_SHORT);$jadualList=$p['document']['jadual'];$assignmentMap=[];
    foreach ($jadualList as $match) foreach (($match['assignments'] ?? []) as $role=>$assignment) if ($assignment) $assignmentMap[$match['id']][$role]=$assignment;
    $stats=$p['document']['stats'];$totalPerlawanan=$stats['total_perlawanan'];$lengkap=$stats['lantikan_lengkap'];
    $totalLantikan=$stats['jumlah_lantikan'];$totalTerima=$stats['jumlah_terima'];$tolak=$stats['jumlah_tolak'] ?? 0;
    $belumJawab=$stats['jumlah_belum_jawab'] ?? 0;$kadarTerima=$stats['kadar_terima'];
    $kodVerifikasi=$pengesahan['kod_verifikasi'] ?? null;
    ob_start();include __DIR__.'/schedule-view.php';return ob_get_clean();
}
function originalEmail(array $p): array {
    $a=$p['args'] ?? [];unset($GLOBALS['renderedEmail']);
    $pdo=new OriginalPDO($p['rows'] ?? []);
    switch ($p['template']) {
        case 'welcome': sendWelcomeEmail(...$a);break;
        case 'kelas3Welcome': sendWelcomeEmailKelas3(...$a);break;
        case 'receipt': sendApplicationSuccessEmail(...$a);break;
        case 'approval': sendApprovalEmail(...$a);break;
        case 'rejection': sendRejectionEmail(...$a);break;
        case 'testApproval': sendTestApprovalEmail(...$a);break;
        case 'testRejection': sendTestRejectionEmail(...$a);break;
        case 'testAbsent': sendTestAbsentEmail(...$a);break;
        case 'annualStage': sendAnnualRegistrationStageEmail(...$a);break;
        case 'ppApplicant': sendApplicantNotification($pdo,...$a);break;
        case 'ppAdmin': sendAdminNotification($pdo,...$a);break;
        case 'reviewer': notifyPPDaerah($pdo,...$a);break;
        case 'telegramBlast': originalTelegramBlast(...$a);break;
        case 'forgotPassword': originalForgotPassword(...$a);break;
        case 'externalTelegram': return ['html'=>buildExternalTelegramOnboardingEmail(...$a)];
        case 'groupMatch': return ['html'=>getNewGroupMatchEmailTemplate(...$a)];
        default: throw new RuntimeException('Unknown email template');
    }
    $result=$GLOBALS['renderedEmail'] ?? throw new RuntimeException('Email was not rendered');
    if ($p['template']==='receipt' && ($p['context']['APPLICATION_STATUS'] ?? '')==='Menunggu Semakan PP Daerah') {
        $result['html']=str_replace(['Menunggu Kelulusan Admin','disemak oleh pentadbir','Tunggu pengesahan daripada pentadbir sistem.'],
            ['Menunggu Semakan PP Daerah','disemak oleh PP Daerah','Tunggu pengesahan daripada PP Daerah.'],$result['html']);
    }
    if ($p['template']==='reviewer' && ($p['context']['REVIEWER_ROLE'] ?? '')==='Admin') {
        $result['html']=str_replace('dashboard PP Daerah','dashboard Admin',$result['html']);
    }
    return $result;
}
function renderOriginal(array $p): array {
    $GLOBALS['renderContext']=$p['context'] ?? [];
    $bufferLevel=ob_get_level();
    try {
        return match ($p['kind']) {
            'registration'=>['mime'=>'application/pdf','base64'=>base64_encode(originalRegistration($p))],
            'assessment'=>['mime'=>'text/html','html'=>originalAssessment($p)],
            'schedule'=>['mime'=>'text/html','html'=>originalSchedule($p)],
            'fitness'=>['mime'=>'text/html','html'=>generateFitnessTestFormHTML($p['data'])],
            'futsal'=>['mime'=>'text/html','html'=>generateFutsalRefereeFormHTML($p['data'])],
            'email'=>['mime'=>'application/json','email'=>originalEmail($p)],
            default=>throw new RuntimeException('Unknown document'),
        };
    } finally {
        while (ob_get_level()>$bufferLevel) ob_end_clean();
        foreach (glob(__DIR__.'/request/*') as $file) unlink($file);
        unset($GLOBALS['renderedEmail'],$GLOBALS['renderContext']);
    }
}
