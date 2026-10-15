import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminUsers,registeredReferees,statistics,currentUser,refereeMatches,assessorDashboard,
  districtOverview,districtApplications,adminDashboardStats,adminApplications,
  applicationHistory,adminRefereeExport,districtRefereeExport,deleteApplication}=await bundle(
  "export {adminUsers} from '../src/admin-users'; export {registeredReferees} from '../src/registered-referees'; export {statistics} from '../src/statistics'; export {currentUser} from '../src/auth'; export {refereeMatches} from '../src/referee'; export {assessorDashboard,districtOverview} from '../src/role-dashboards'; export {districtApplications} from '../src/district-applications'; export {adminDashboardStats} from '../src/admin-dashboard'; export {adminApplications,applicationHistory,deleteApplication} from '../src/applications'; export {adminRefereeExport,districtRefereeExport} from '../src/referee-exports';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions']);
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const cookie=await sessionCookie(db,admin.id);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1'};
const request=(route)=>new Request(`https://refpahang.example/api/${route}`,{headers:{Cookie:cookie}});

try {
  const usersResponse=await adminUsers(request('admin-users.php?year=2026'),env);
  assert.equal(usersResponse.status,200);
  const users=(await usersResponse.json()).users;
  const expected=db.prepare(`SELECT COUNT(DISTINCT user_id) AS total FROM permohonan
    WHERE jenis_borang='pengadil_berdaftar' AND tahun_permohonan=2026
      AND status='Approved' AND UPPER(TRIM(COALESCE(jenis_pengadil,'')))
        NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')`).get().total;
  assert.equal(users.filter((user)=>user.current_approved===1).length,expected);
  const failedClassThree=db.prepare(`SELECT p.user_id FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.jenis_borang='kelas3_fam' AND p.status_ujian='Tidak Lulus'
      AND u.tahun_lulus_kelas3 IS NULL AND NOT EXISTS
        (SELECT 1 FROM permohonan passed WHERE passed.user_id=p.user_id
          AND passed.jenis_borang IN ('kelas3_fam','ujian_bertulis')
          AND passed.status_ujian='Lulus') LIMIT 1`).get();
  assert.ok(failedClassThree);
  assert.equal(users.find((user)=>user.id===failedClassThree.user_id).class3_passed,0);

  const statsResponse=await statistics(request('statistics.php?year=2026'),env);
  assert.equal(statsResponse.status,200);
  const stats=(await statsResponse.json()).data;
  assert.equal(stats.total,expected);
  assert.equal(stats.matches.total,db.prepare(
    "SELECT COUNT(*) AS total FROM perlawanan WHERE substr(tarikh,1,4)='2026'"
  ).get().total);
  assert.equal(stats.applications.total,Object.values(stats.applications.types)
    .reduce((sum,count)=>sum+count,0));
  assert.equal(stats.applications.byType.pengadil_berdaftar.total,219);
  assert.equal(stats.applications.byType.penilai_berdaftar.total,17);
  assert.equal(stats.applications.byType.kelas3_fam.total,42);
  assert.equal(stats.applications.byType.ujian_kelas1_fam.total,0);
  assert.equal(stats.applications.byType.ujian_kecergasan.total,116);
  assert.equal(stats.applications.byType.pegawai_pembangunan.total,9);
  for (const item of Object.values(stats.applications.byType)) {
    assert.equal(item.total,item.pending+item.approved+item.rejected);
    assert.equal(item.total,Object.values(item.monthlyTrend).reduce((sum,count)=>sum+count,0));
  }
  const adminDashboard=(await (await adminDashboardStats(request('admin-dashboard-stats.php'),env)).json()).stats;
  assert.equal(adminDashboard.applications_by_type.penilai_berdaftar.total,17);
  assert.equal(adminDashboard.applications_by_type.pengadil_berdaftar.total,219);
  for (const [type,count] of [['berdaftar',219],['penilai',17],['kelas3',42],['kelas1',0]]) {
    const response=await adminApplications(request(`admin-applications.php?type=${type}&year=2026`),env);
    assert.equal(response.status,200);
    const rows=(await response.json()).applications;
    assert.equal(rows.length,count);
    const category={berdaftar:'pengadil_berdaftar',penilai:'penilai_berdaftar',
      kelas3:'kelas3_fam',kelas1:'ujian_kelas1_fam'}[type];
    assert.ok(rows.every((row)=>row.application_category===category));
  }
  const classThreeUser=db.prepare(`SELECT p.user_id FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.jenis_borang='kelas3_fam' AND u.aktif=1 LIMIT 1`).get();
  assert.ok(classThreeUser);
  const ownCookie=await sessionCookie(db,classThreeUser.user_id);
  const ownHistory=await applicationHistory(new Request(
    'https://refpahang.example/api/pengadil-application-history.php?type=kelas3',
    {headers:{Cookie:ownCookie}}),env);
  assert.equal(ownHistory.status,200);
  const ownRows=(await ownHistory.json()).data;
  assert.ok(ownRows.length>0);
  assert.ok(ownRows.every((row)=>['kelas3_fam','ujian_bertulis'].includes(row.jenis_borang)));
  const appointmentCounts=db.prepare(`SELECT lp.status,COUNT(*) AS total
    FROM lantikan_pengadil lp JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    WHERE substr(jp.tarikh,1,4)='2026' GROUP BY lp.status`).all();
  assert.equal(stats.lantikan.total,appointmentCounts.reduce((sum,row)=>sum+row.total,0));
  assert.equal(stats.lantikan.diterima,appointmentCounts.find((row)=>row.status==='Diterima')?.total??0);
  assert.equal(stats.lantikan.ditolak,appointmentCounts.find((row)=>row.status==='Ditolak')?.total??0);
  assert.equal(stats.lantikan.dibatalkan,appointmentCounts.find((row)=>row.status==='Dibatalkan')?.total??0);
  assert.equal(stats.lantikan.total,stats.lantikan.diterima+stats.lantikan.ditolak+
    stats.lantikan.belum+stats.lantikan.dibatalkan);

  const refereeResponse=await registeredReferees(request('referees.php?year=2026'),env);
  assert.equal(refereeResponse.status,200);
  assert.equal((await refereeResponse.json()).data.length,expected);

  const raResponse=await registeredReferees(request('referees.php?year=2026&type=penilai_berdaftar'),env);
  assert.equal(raResponse.status,200);
  const ra=(await raResponse.json()).data;
  assert.equal(ra.length,17);
  assert.ok(ra.every((user)=>user.id != null));
  assert.ok(ra.every((user)=>user.user_role!=='PP Daerah' || user.jenis_pengadil==='Penilai Pengadil'));
  const raCsv=await adminRefereeExport(request('download-referees-excel.php?year=2026&type=penilai_berdaftar'),env);
  assert.equal(raCsv.status,200);
  assert.match(raCsv.headers.get('Content-Disposition'),/penilai-pengadil-2026/);
  assert.equal((await raCsv.text()).trim().split('\r\n').length,18);

  const ppRef=db.prepare("SELECT id FROM users WHERE role='PP Daerah' AND jenis_pengadil='Pengadil Negeri' LIMIT 1").get();
  const ppRa=db.prepare("SELECT id FROM users WHERE role='PP Daerah' AND jenis_pengadil='Penilai Pengadil' LIMIT 1").get();
  const ppOther=db.prepare("SELECT id FROM users WHERE role='PP Daerah' AND jenis_pengadil='Pegawai Pembangunan' LIMIT 1").get();
  assert.ok(ppRef && ppRa && ppOther);
  assert.equal(users.find((user)=>user.id===ppRef.id).is_referee,1);
  assert.equal(users.find((user)=>user.id===ppRa.id).is_referee,0);
  const actor=async(id)=>currentUser(new Request('https://refpahang.example/api/session.php',{
    headers:{Cookie:await sessionCookie(db,id)}
  }),env);
  assert.equal((await actor(ppRef.id)).can_referee,1);
  assert.equal((await actor(ppRa.id)).can_ra,1);
  assert.equal((await actor(ppOther.id)).can_referee,0);
  const ppRefCookie=await sessionCookie(db,ppRef.id);
  const ppEnv={...env};
  const ppRequest=(route)=>new Request(`https://refpahang.example/api/${route}`,
    {headers:{Cookie:ppRefCookie}});
  const ppOverview=(await (await districtOverview(ppRequest('pp-dashboard-overview.php'),ppEnv)).json()).overview;
  assert.equal(Object.values(ppOverview.applications_by_type)
    .reduce((sum,item)=>sum+item.total,0),
    db.prepare(`SELECT COUNT(*) AS total FROM permohonan p JOIN users u ON u.id=p.user_id
      WHERE u.persatuan_id=(SELECT persatuan_id FROM users WHERE id=?)
        AND p.tahun_permohonan=2026`).get(ppRef.id).total);
  const districtRa=(await (await districtApplications(ppRequest('pp-applications.php?type=berdaftar'),ppEnv)).json()).applications;
  assert.ok(districtRa.length>0);
  assert.ok(districtRa.every((application)=>application.application_category==='penilai_berdaftar'));
  const districtCsv=await districtRefereeExport(ppRequest('pp-export-referees.php?type=pengadil'),ppEnv);
  assert.equal(districtCsv.status,200);
  assert.match(await districtCsv.text(),/Jumlah Permohonan Pengadil Berdaftar/);
  assert.equal((await refereeMatches(new Request('https://refpahang.example/api/pengadil-matches.php',{
    headers:{Cookie:ppRefCookie}
  }),env)).status,200);
  const ppRaCookie=await sessionCookie(db,ppRa.id);
  assert.equal((await assessorDashboard(new Request('https://refpahang.example/api/penilai-dashboard.php',{
    headers:{Cookie:ppRaCookie}
  }),env)).status,200);

  const linked=db.prepare(`SELECT p.permohonan_id,p.id AS match_id,p.user_id
    FROM perlawanan p WHERE p.permohonan_id IS NOT NULL LIMIT 1`).get();
  assert.ok(linked);
  const beforeMatches=db.prepare('SELECT COUNT(*) AS total FROM perlawanan WHERE user_id=?').get(linked.user_id).total;
  const deleted=await deleteApplication(new Request('https://refpahang.example/api/admin-applications.php',{
    method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},
    body:JSON.stringify({action:'delete_application',id:linked.permohonan_id})
  }),env);
  assert.equal(deleted.status,200);
  assert.equal(db.prepare('SELECT permohonan_id FROM perlawanan WHERE id=?').get(linked.match_id).permohonan_id,null);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM perlawanan WHERE user_id=?').get(linked.user_id).total,beforeMatches);

  const previous=db.prepare(`SELECT p.id,p.user_id FROM permohonan p
    WHERE p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan=2026
      AND p.status='Approved'
      AND COALESCE(p.jenis_pengadil,'') NOT IN ('Penilai Pengadil','Pegawai Pembangunan')
      AND NOT EXISTS
        (SELECT 1 FROM permohonan older WHERE older.user_id=p.user_id
          AND older.jenis_borang='pengadil_berdaftar' AND older.tahun_permohonan=2025)
    LIMIT 1`).get();
  assert.ok(previous);
  db.prepare('UPDATE permohonan SET tahun_permohonan=2025 WHERE id=?').run(previous.id);
  const after=(await (await adminUsers(request('admin-users.php?year=2026'),env)).json()).users
    .find((user)=>user.id===previous.user_id);
  assert.equal(after.current_approved,0);
  assert.equal(after.prior_approved,1);
  console.log('referee audit: four application categories, RA legacy records, annual roles and match integrity passed');
} finally {close();}
