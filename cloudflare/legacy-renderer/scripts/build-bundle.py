#!/usr/bin/env python3
"""Package original PHP templates and TCPDF; never translate official form layouts."""
import base64,hashlib,io,json,re,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; HERE=ROOT/'cloudflare/legacy-renderer'
files={}; sources={}
def add(target,source):
 b=(ROOT/source).read_bytes();files[target]=b;sources[source]=hashlib.sha256(b).hexdigest()
def functions(source,names):
 raw=subprocess.check_output(['php',str(HERE/'scripts/extract-functions.php'),str(ROOT/source),*names])
 sources[source]=hashlib.sha256((ROOT/source).read_bytes()).hexdigest()
 return json.loads(raw)
for path in (ROOT/'vendor/tecnickcom/tcpdf').glob('*.php'):add('vendor/tcpdf/'+path.name,str(path.relative_to(ROOT)))
for path in (ROOT/'vendor/tecnickcom/tcpdf/include').glob('*.php'):add('vendor/tcpdf/include/'+path.name,str(path.relative_to(ROOT)))
# workerd freezes its clock between I/O. PHP uniqid() busy-waits for a clock tick;
# replace only PDF internal random-seed construction, never template drawing.
static=files['vendor/tcpdf/include/tcpdf_static.php']
static=static.replace(b'uniqid(rand().microtime(true), true)',b'bin2hex(random_bytes(32))')
static=static.replace(b"uniqid('', true)",b'bin2hex(random_bytes(32))')
files['vendor/tcpdf/include/tcpdf_static.php']=static
for name in ['helvetica','helveticab','helveticabi','helveticai','courier','courierb','courierbi','courieri','times','timesb','timesbi','timesi','symbol','zapfdingbats']:
 add('vendor/tcpdf/fonts/'+name+'.php','vendor/tecnickcom/tcpdf/fonts/'+name+'.php')
for name in ['LICENSE.TXT','VERSION']:add('vendor/tcpdf/'+name,'vendor/tecnickcom/tcpdf/'+name)
for name in ['r1','r1_penilai','r2','r3','r3a','r4','r11']:add('templates/'+name+'.php','api/templates/'+name+'.php')
# Preserve the application season when printing a historical/future application.
files['templates/r11.php']=files['templates/r11.php'].replace(b"$year   = date('Y');",b"$year   = (int)($data['tahun_permohonan'] ?? date('Y'));")
add('assets/Pahang_FA_logo.png','assets/Pahang_FA_logo.png')
# Preserve TCPDF's GD-produced image and soft mask exactly; no form layout is translated.
logo=json.loads(subprocess.check_output(['php',str(HERE/'scripts/prepare-logo.php'),str(ROOT/'assets/Pahang_FA_logo.png')]))
for kind,content in logo.items():files['assets/Pahang_FA_logo.png.'+kind+'.png']=base64.b64decode(content)
add('config/kriteria-penilaian.php','config/kriteria-penilaian.php')
# Keep the original RA display section verbatim. Authentication and DB reads stay in the Worker.
s=(ROOT/'api/download-laporan-penilaian.php').read_text();sources['api/download-laporan-penilaian.php']=hashlib.sha256((ROOT/'api/download-laporan-penilaian.php').read_bytes()).hexdigest()
view=s[s.index('/* ── Helper functions'):]; helpers=functions('api/download-laporan-penilaian.php',['fmtDate','fmtTime','e','tahapBM','prestasiBM','markahColor','jawatanBM','jawatanShort','sectionTitle'])
for name,body in helpers.items(): view=view.replace(body,"if (!function_exists('"+name+"')) {\n"+body+"\n}")
files['api/assessment-view.php']=('<?php\n'+view).encode()
s=(ROOT/'api/download-jadual-lantikan.php').read_text();sources['api/download-jadual-lantikan.php']=hashlib.sha256((ROOT/'api/download-jadual-lantikan.php').read_bytes()).hexdigest()
view=s[s.index('// Helpers\n'):]; helpers=functions('api/download-jadual-lantikan.php',['fDate','fTime','escHtml'])
for name,body in helpers.items(): view=view.replace(body,"if (!function_exists('"+name+"')) {\n"+body+"\n}")
files['schedule-view.php']=('<?php\n'+view).encode()
for source,name,target in [('api/download-borang-futsal.php','generateFutsalRefereeFormHTML','futsal.php'),('api/download-borang-ujian-kecergasan.php','generateFitnessTestFormHTML','fitness.php')]:
 text=functions(source,[name])[name]
 text=text.replace("$current_year = date('Y');","$current_year = (int)($data['tahun_permohonan'] ?? date('Y'));")
 text=text.replace('[Tahun/Musim]',"' . htmlspecialchars((string)($data['tahun_permohonan'] ?? date('Y'))) . '")
 files[target]=('<?php\n'+text).encode()
helpers=['buildEmailTemplate','emailGreeting','emailPara','emailAlert','emailInfoTable','emailCredBox','emailButton','emailOrderedList','emailStatusBadge']
chunks=[s.replace('https://upload.wikimedia.org/wikipedia/en/b/b3/Pahang_FA_logo.png','https://refpahang.com/assets/Pahang_FA_logo.png') for s in functions('config/email.php',helpers).values()]
selections={
 'api/register.php':['sendWelcomeEmail'],
 'api/admin-applications.php':['sendWelcomeEmailKelas3'],
 'api/pengadil-application.php':['sendApplicationSuccessEmail'],
 'api/admin-approve.php':['sendApprovalEmail','sendRejectionEmail'],
 'api/admin-test-applications.php':['sendTestApprovalEmail','sendTestRejectionEmail','sendTestAbsentEmail'],
 'api/pp-verify.php':['sendAdminNotification','sendApplicantNotification'],
 'config/pendaftaran-workflow.php':['sendAnnualRegistrationStageEmail'],
 'config/telegram-onboarding.php':['buildExternalTelegramOnboardingEmail'],
 'api/pengadil-match-manage.php':['getNewGroupMatchEmailTemplate'],
 'api/user-utils.php':['notifyPPDaerah'],
}
for source,names in selections.items():
 for name,text in functions(source,names).items():
  # These require only the shared helpers already loaded, never bootstrap/DB credentials.
  text=re.sub(r"require_once\s+__DIR__\s*\.\s*'[^']+'\s*;",'',text)
  if name=='sendWelcomeEmail':
   # Preserve the current channel requirement and role split; keep the original email layout.
   text=text.replace("} else {\n        $nextStepsList", "} elseif ($role === 'Penilai') {\n        $nextStepsList = emailOrderedList(['Log masuk menggunakan emel dan kata laluan di atas.','Lengkapkan profil anda (alamat, maklumat pekerjaan, waris).','Muat naik gambar profil.','Semak permohonan pendaftaran tahunan Penilai Pengadil di portal anda.']);\n    } else {\n        $nextStepsList")
   text=text.replace('Aktifkan notifikasi Telegram untuk menerima maklumat lantikan', 'Untuk menerima lantikan, hubungkan Telegram atau log masuk ke aplikasi mudah alih dan aktifkan notifikasi. Salah satu saluran sudah memadai.')
  chunks.append(text)
# Direct original body blocks without standalone source functions.
s=(ROOT/'api/admin-telegram-blast.php').read_text();sources['api/admin-telegram-blast.php']=hashlib.sha256((ROOT/'api/admin-telegram-blast.php').read_bytes()).hexdigest()
a=s.index("$body  = emailGreeting(");b=s.index("$ok = sendEmail",a)
chunks.append('function originalTelegramBlast(array $user,string $linkUrl,string $botUsername): void {\n'+s[a:b]+"sendEmail($user['email'],$subject,$html,$user['nama_penuh'],'admin');\n}")
s=(ROOT/'api/forgot-password.php').read_text();sources['api/forgot-password.php']=hashlib.sha256((ROOT/'api/forgot-password.php').read_bytes()).hexdigest()
a=s.index('$body = buildEmailTemplate(');b=s.index('$emailSent = _smtpSend(',a)
chunks.append('function originalForgotPassword(array $user,string $resetUrl): void {\n'+s[a:b]+"sendEmail($user['email'],'Tetapan Semula Kata Laluan - Sistem Pengadil Pahang',$body,$user['nama_penuh'],'admin');\n}")
files['email-templates.php']=('<?php\n'+'\n\n'.join(chunks)).encode()
add('entry.php','cloudflare/legacy-renderer/entry.php')
buf=io.BytesIO()
with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,data in sorted(files.items()):
  info=zipfile.ZipInfo(name,(2026,10,18,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,data)
archive=buf.getvalue()
(HERE/'bundle.generated.mjs').write_text('// Generated by scripts/build-bundle.py from original PHP; do not edit.\nexport default '+json.dumps(base64.b64encode(archive).decode())+';\n')
(HERE/'source-manifest.json').write_text(json.dumps({'archiveSha256':hashlib.sha256(archive).hexdigest(),'sourceSha256':sources},indent=2)+'\n')
print(f'Packaged {len(files)} original files; archive {len(archive)} bytes')
