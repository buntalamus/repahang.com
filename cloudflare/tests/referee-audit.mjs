import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminUsers,registeredReferees,statistics,currentUser,refereeMatches,assessorDashboard,deleteApplication}=await bundle(
  "export {adminUsers} from '../src/admin-users'; export {registeredReferees} from '../src/registered-referees'; export {statistics} from '../src/statistics'; export {currentUser} from '../src/auth'; export {refereeMatches} from '../src/referee'; export {assessorDashboard} from '../src/role-dashboards'; export {deleteApplication} from '../src/applications';"
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
      AND status='Approved' AND COALESCE(jenis_pengadil,'')
        NOT IN ('Penilai Pengadil','Pegawai Pembangunan')`).get().total;
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
  assert.ok(ra.every((user)=>user.user_role!=='PP Daerah' || user.jenis_pengadil==='Penilai Pengadil'));

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
  console.log('referee audit: annual categories, RA/PP separation, statistics and full match counts passed');
} finally {close();}
