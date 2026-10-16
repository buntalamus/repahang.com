import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminUsers,registeredReferees,adminApplications,deleteApplication}=await bundle(
  "export {adminUsers} from '../src/admin-users'; export {registeredReferees} from '../src/registered-referees'; export {adminApplications,deleteApplication} from '../src/applications';"
);
const {db,DB,close}=openDatabase([
  '0001_worker_sessions','0009_mysql_on_update_triggers','0019_annual_seminar_attendance',
]);
const emails=[];
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  BASE_URL:'https://staging.refpahang.example',
  MAIL_DAFTAR_USER:'daftar@refpahang.example',MAIL_DAFTAR_NAME:'PBNP',
  EMAIL:{send:async message=>{emails.push(message);return {messageId:'test'};}}};
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const cookie=await sessionCookie(db,admin.id);
const annual=db.prepare(`SELECT p.id,p.user_id,p.tahun_permohonan,p.status,p.status_workflow,
    p.status_ujian,p.status_seminar,p.final_approved_at,p.status_kemaskini,p.updated_at
  FROM permohonan p JOIN users u ON u.id=p.user_id
  WHERE p.jenis_borang='pengadil_berdaftar' AND u.aktif=1
    AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')
  ORDER BY p.id LIMIT 1`).get();
assert.ok(annual);
const original={...annual};
const endpoint='https://staging.refpahang.example/api/admin-applications.php';
const get=(path)=>new Request(`https://staging.refpahang.example/api/${path}`,{headers:{Cookie:cookie}});
let createdLegacyId=null,existingLegacy=null;
const post=(body)=>deleteApplication(new Request(endpoint,{method:'POST',headers:{Cookie:cookie},body:JSON.stringify(body)}),env);

try {
  // The snapshot contains only 2026 annual rows; move a private test-copy row
  // to the newer workflow and restore every changed field in finally.
  db.prepare(`UPDATE permohonan SET tahun_permohonan=2027,status='Approved',
    status_workflow='Admin Diluluskan',status_ujian=NULL,status_seminar=NULL,
    final_approved_at=NULL,status_kemaskini=datetime('now','+8 hours') WHERE id=?`).run(annual.id);

  const seminar=await post({action:'update_status_seminar',id:annual.id,status_seminar:'Hadir'});
  assert.equal(seminar.status,200);
  const afterSeminar=db.prepare(`SELECT status,status_workflow,status_ujian,status_seminar,final_approved_at
    FROM permohonan WHERE id=?`).get(annual.id);
  assert.deepEqual({...afterSeminar},{status:'Approved',status_workflow:'Admin Diluluskan',
    status_ujian:null,status_seminar:'Hadir',final_approved_at:null});

  const appList=await adminApplications(get('admin-applications.php?type=berdaftar&year=2027'),env);
  assert.equal((await appList.json()).applications.find(row=>row.id===annual.id).status_seminar,'Hadir');

  const fail=await post({action:'update_status_ujian',id:annual.id,status_ujian:'Tidak Lulus'});
  assert.equal(fail.status,200);
  let row=db.prepare('SELECT status,status_workflow,status_ujian,status_seminar,final_approved_at FROM permohonan WHERE id=?').get(annual.id);
  assert.deepEqual({...row},{status:'Approved',status_workflow:'Lengkap',status_ujian:'Tidak Lulus',
    status_seminar:'Hadir',final_approved_at:null});
  let users=(await (await adminUsers(get('admin-users.php?year=2027'),env)).json()).users;
  let referee=users.find(user=>user.id===annual.user_id);
  assert.equal(referee.current_approved,1);
  assert.equal(referee.current_license,0);
  assert.equal(referee.current_fitness_status,'Tidak Lulus');
  let roster=(await (await registeredReferees(get('registered-referees.php?year=2027'),env)).json()).data;
  let registration=roster.find(item=>item.id===annual.id);
  assert.equal(registration.status_seminar,'Hadir');
  assert.equal(registration.patch_eligible,0);

  await post({action:'update_status_seminar',id:annual.id,status_seminar:'Tidak Hadir'});
  row=db.prepare('SELECT status,status_workflow,status_ujian,status_seminar,final_approved_at FROM permohonan WHERE id=?').get(annual.id);
  assert.deepEqual({...row},{status:'Approved',status_workflow:'Lengkap',status_ujian:'Tidak Lulus',
    status_seminar:'Tidak Hadir',final_approved_at:null});
  referee=(await (await adminUsers(get('admin-users.php?year=2027'),env)).json()).users.find(user=>user.id===annual.user_id);
  assert.equal(referee.current_license,0);

  const pass=await post({action:'update_status_ujian',id:annual.id,status_ujian:'Lulus'});
  assert.equal(pass.status,200);
  row=db.prepare('SELECT status,status_workflow,status_ujian,status_seminar,final_approved_at FROM permohonan WHERE id=?').get(annual.id);
  assert.equal(row.status,'Approved');
  assert.equal(row.status_workflow,'Lengkap');
  assert.equal(row.status_ujian,'Lulus');
  assert.equal(row.status_seminar,'Tidak Hadir');
  assert.ok(row.final_approved_at);
  referee=(await (await adminUsers(get('admin-users.php?year=2027'),env)).json()).users.find(user=>user.id===annual.user_id);
  assert.equal(referee.current_approved,1);
  assert.equal(referee.current_license,1);
  assert.equal(referee.current_fitness_status,'Lulus');
  roster=(await (await registeredReferees(get('registered-referees.php?year=2027'),env)).json()).data;
  registration=roster.find(item=>item.id===annual.id);
  assert.equal(registration.patch_eligible,1);
  assert.equal(registration.status_seminar,'Tidak Hadir');

  const clear=await post({action:'update_status_seminar',id:annual.id,status_seminar:null});
  assert.equal(clear.status,200);
  row=db.prepare('SELECT status,status_workflow,status_ujian,status_seminar,final_approved_at FROM permohonan WHERE id=?').get(annual.id);
  assert.deepEqual({...row},{status:'Approved',status_workflow:'Lengkap',status_ujian:'Lulus',
    status_seminar:null,final_approved_at:row.final_approved_at});
  assert.ok(row.final_approved_at);
  console.log('annual licensing: seminar attendance is independent; fitness alone controls patch/license');

  // Before 2027 the result lives on a separate 'ujian_kecergasan' row; the
  // Admin button records it there, creating the row when the referee has none.
  const legacyRow=(userId)=>db.prepare(`SELECT id,status,status_workflow,workflow_status,status_ujian,
      nama_penuh,tahun_permohonan FROM permohonan
    WHERE user_id=? AND tahun_permohonan=2026 AND jenis_borang='ujian_kecergasan' ORDER BY id DESC`).all(userId);
  const annual2026=`SELECT b.id,b.user_id,b.nama_penuh FROM permohonan b JOIN users u ON u.id=b.user_id
    WHERE b.jenis_borang='pengadil_berdaftar' AND b.tahun_permohonan=2026 AND b.status='Approved'
      AND b.status_workflow='Lengkap' AND u.aktif=1 AND b.id<>?
      AND UPPER(TRIM(COALESCE(b.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')`;
  const missing=db.prepare(`${annual2026} AND NOT EXISTS (SELECT 1 FROM permohonan f WHERE f.user_id=b.user_id
    AND f.tahun_permohonan=2026 AND f.jenis_borang='ujian_kecergasan') ORDER BY b.id LIMIT 1`).get(annual.id);
  const existing=db.prepare(`${annual2026} AND EXISTS (SELECT 1 FROM permohonan f WHERE f.user_id=b.user_id
    AND f.tahun_permohonan=2026 AND f.jenis_borang='ujian_kecergasan') ORDER BY b.id LIMIT 1`).get(annual.id);
  assert.ok(missing&&existing);
  const emailCount=emails.length;
  const notificationCount=()=>db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n;
  const notificationsBefore=notificationCount();

  const created=await post({action:'update_status_ujian',id:missing.id,status_ujian:'Lulus'});
  assert.equal(created.status,200);
  let legacy=legacyRow(missing.user_id);
  assert.equal(legacy.length,1);
  createdLegacyId=legacy[0].id;
  assert.deepEqual({...legacy[0],id:0},{id:0,status:'Approved',status_workflow:'Lengkap',
    workflow_status:'Approved',status_ujian:'Lulus',nama_penuh:missing.nama_penuh,tahun_permohonan:2026});
  roster=(await (await registeredReferees(get('registered-referees.php?year=2026'),env)).json()).data;
  registration=roster.find(item=>item.id===missing.id);
  assert.equal(registration.fitness_status,'Lulus');
  assert.equal(registration.patch_eligible,1);
  const list2026=(await (await adminApplications(get('admin-applications.php?type=berdaftar&year=2026'),env)).json()).applications;
  assert.equal(list2026.find(item=>item.id===missing.id).status_ujian,'Lulus');

  const failed=await post({action:'update_status_ujian',id:missing.id,status_ujian:'Tidak Lulus'});
  assert.equal(failed.status,200);
  legacy=legacyRow(missing.user_id);
  assert.equal(legacy.length,1);
  assert.equal(legacy[0].id,createdLegacyId);
  assert.equal(legacy[0].status_ujian,'Tidak Lulus');
  roster=(await (await registeredReferees(get('registered-referees.php?year=2026'),env)).json()).data;
  assert.equal(roster.find(item=>item.id===missing.id).patch_eligible,0);
  const same=await (await post({action:'update_status_ujian',id:missing.id,status_ujian:'Tidak Lulus'})).json();
  assert.equal(same.message,'Keputusan ujian tidak berubah.');

  const before=legacyRow(existing.user_id);
  const next=before[0].status_ujian==='Tidak Hadir'?'Lulus':'Tidak Hadir';
  existingLegacy={id:before[0].id,status_ujian:before[0].status_ujian};
  assert.equal((await post({action:'update_status_ujian',id:existing.id,status_ujian:next})).status,200);
  const after=legacyRow(existing.user_id);
  assert.equal(after.length,before.length);
  assert.equal(after[0].id,before[0].id);
  assert.equal(after[0].status_ujian,next);

  assert.equal(emails.length,emailCount);
  assert.equal(notificationCount(),notificationsBefore);
  console.log('annual licensing: pre-2027 fitness results are recorded on the legacy row without email');
} finally {
  if (createdLegacyId) db.prepare('DELETE FROM permohonan WHERE id=?').run(createdLegacyId);
  if (existingLegacy) db.prepare('UPDATE permohonan SET status_ujian=? WHERE id=?')
    .run(existingLegacy.status_ujian,existingLegacy.id);
  db.prepare(`UPDATE permohonan SET tahun_permohonan=?,status=?,status_workflow=?,status_ujian=?,
    status_seminar=?,final_approved_at=?,status_kemaskini=?,updated_at=? WHERE id=?`)
    .run(original.tahun_permohonan,original.status,original.status_workflow,original.status_ujian,
      original.status_seminar,original.final_approved_at,original.status_kemaskini,original.updated_at,annual.id);
  close();
}
