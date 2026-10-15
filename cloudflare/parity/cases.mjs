// Read-only requests the Angular frontend makes, per role. IDs come from the
// 2026-10-13 snapshot (kejohanan 16/17, jadual 1169, laporan 103, lantikan 1431).
const get=(name,role,path)=>({name,role,method:'GET',path});

export const cases=[
  // Public
  get('public registration-status','',`/api/registration-status.php`),
  get('public public-persatuan','',`/api/public-persatuan.php`),
  get('public public-announcements','',`/api/public-announcements.php`),
  get('public check-maintenance','',`/api/check-maintenance.php`),
  get('public districts','',`/api/districts.php`),
  get('public session','',`/api/session.php`),
  get('anon admin-users 401','',`/api/admin-users.php`),

  // Admin
  get('admin session','Admin','/api/session.php'),
  get('admin admin-profile','Admin','/api/admin-profile.php'),
  get('admin admin-dashboard-tasks','Admin','/api/admin-dashboard-tasks.php'),
  get('admin admin-dashboard-stats','Admin','/api/admin-dashboard-stats.php'),
  get('admin announcements','Admin','/api/announcements.php'),
  get('admin admin-applications pending','Admin','/api/admin-applications.php?status=Menunggu%20Admin&limit=6'),
  get('admin admin-applications all','Admin','/api/admin-applications.php?status=all'),
  get('admin admin-users','Admin','/api/admin-users.php'),
  get('admin admin-users id','Admin','/api/admin-users.php?id=55'),
  get('admin admin-settings','Admin','/api/admin-settings.php'),
  get('admin admin-telegram-blast','Admin','/api/admin-telegram-blast.php'),
  get('admin statistics','Admin','/api/statistics.php?year=2026'),
  get('admin referees','Admin','/api/referees.php?year=2026&type=all'),
  get('admin admin-test-applications','Admin','/api/admin-test-applications.php?type=bertulis'),
  get('admin admin-matches','Admin','/api/admin-matches.php'),
  get('admin kejohanan','Admin','/api/kejohanan.php'),
  get('admin jadual-perlawanan','Admin','/api/jadual-perlawanan.php?kejohanan_id=16'),
  get('admin jadual-lantikan-report','Admin','/api/jadual-lantikan-report.php?kejohanan_id=16'),
  get('admin lantikan','Admin','/api/lantikan.php?jadual_id=1169'),
  get('admin lantikan-audit','Admin','/api/lantikan-audit.php?lantikan_id=1431'),
  get('admin pool-pengadil','Admin','/api/pool-pengadil.php?kejohanan_id=16'),
  get('admin kejohanan-pengesah-laporan','Admin','/api/kejohanan-pengesah-laporan.php?kejohanan_id=16'),
  get('admin pengadil-luar','Admin','/api/pengadil-luar.php'),
  get('admin pengadil-luar-telegram-blast','Admin','/api/pengadil-luar-telegram-blast.php?kejohanan_id=16'),
  get('admin get-active-referees','Admin','/api/get-active-referees.php'),
  get('admin laporan-penilaian list','Admin','/api/laporan-penilaian.php'),
  get('admin laporan-penilaian id','Admin','/api/laporan-penilaian.php?id=103'),
  get('admin profil-pengadil','Admin','/api/profil-pengadil.php?id=55'),
  get('admin get-user-profile','Admin','/api/get-user-profile.php'),
  get('admin notifications','Admin','/api/notifications.php'),
  get('admin application-settings','Admin','/api/application-settings.php'),

  // PP Daerah
  get('pp session','PP Daerah','/api/session.php'),
  get('pp pp-dashboard-overview','PP Daerah','/api/pp-dashboard-overview.php'),
  get('pp pp-announcements','PP Daerah','/api/pp-announcements.php'),
  get('pp pp-applications','PP Daerah','/api/pp-applications.php?type=kelas3'),
  get('pp pp-referees','PP Daerah','/api/pp-referees.php'),
  get('pp pp-referees penilai','PP Daerah','/api/pp-referees.php?role=Penilai'),
  get('pp pp-verify-match','PP Daerah','/api/pp-verify-match.php'),
  get('pp pp-penilaian','PP Daerah','/api/pp-penilaian.php'),
  get('pp notifications','PP Daerah','/api/notifications.php'),
  get('pp admin-users 403','PP Daerah','/api/admin-users.php'),

  // Pengadil
  get('pengadil session','Pengadil','/api/session.php'),
  get('pengadil get-user-profile','Pengadil','/api/get-user-profile.php'),
  get('pengadil pengadil-matches','Pengadil','/api/pengadil-matches.php'),
  get('pengadil pengadil-matches 200','Pengadil','/api/pengadil-matches.php?per_page=200'),
  get('pengadil notifications','Pengadil','/api/notifications.php'),
  get('pengadil announcements','Pengadil','/api/announcements.php'),
  get('pengadil tugasan','Pengadil','/api/tugasan.php'),
  get('pengadil pengadil-penilaian','Pengadil','/api/pengadil-penilaian.php'),
  get('pengadil pengadil-application-history','Pengadil','/api/pengadil-application-history.php?type=kelas3'),
  get('pengadil application-settings','Pengadil','/api/application-settings.php'),
  get('pengadil districts','Pengadil','/api/districts.php'),

  // Penilai (RA)
  get('penilai penilai-dashboard','Penilai','/api/penilai-dashboard.php'),
  get('penilai tugasan','Penilai','/api/tugasan.php'),
  get('penilai laporan-penilaian mine','Penilai','/api/laporan-penilaian.php?penilai=1'),
  get('penilai laporan-penilaian officials','Penilai','/api/laporan-penilaian.php?officials=1169'),
];

// Authentication matrix: every endpoint without parameters, anonymous and per role.
import {readFileSync} from 'node:fs';
const endpoints=JSON.parse(readFileSync(new URL('./endpoints.json',import.meta.url),'utf8'));
for (const role of ['','Admin','PP Daerah','Pengadil','Penilai']) {
  for (const endpoint of endpoints) {
    if (endpoint==='telegram-webhook.php') continue;
    cases.push(get(`auth[${role||'anon'}] ${endpoint}`,role,`/api/${endpoint}`));
  }
}
