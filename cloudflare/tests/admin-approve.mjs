import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminApprove,adminApplications,deleteApplication}=await bundle(
  "export {adminApprove} from '../src/admin-approve'; export {adminApplications,deleteApplication} from '../src/applications';");
const {db,DB,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers','0019_annual_seminar_attendance']);
const sent=[];
const env={DB,BASE_URL:'https://refpahang.com',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  MAIL_DAFTAR_USER:'daftar@refpahang.com',MAIL_DAFTAR_NAME:'Pendaftaran Pengadil Pahang',
  EMAIL:{send:async(message)=>{sent.push(message);return {messageId:'ok'};}}};
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const cookie=await sessionCookie(db,admin.id);
const post=(body)=>adminApprove(new Request('https://refpahang.com/api/admin-approve.php',
  {method:'POST',headers:{Cookie:cookie},body:JSON.stringify(body)}),env);

try {
  // permohonan has an ON UPDATE trigger, so D1 reports 2 changes for one row.
  const application=db.prepare(`SELECT p.id FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.jenis_borang<>'pengadil_berdaftar' AND trim(COALESCE(u.email,''))<>'' LIMIT 1`).get();
  db.prepare(`UPDATE permohonan SET status_workflow='Menunggu Admin' WHERE id=?`).run(application.id);
  const before=db.prepare('SELECT count(*) AS n FROM notifications').get().n;
  const response=await post({permohonan_id:application.id,action:'approve'});
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.deepEqual([body.error,body.email_sent],[false,true]);
  assert.equal(db.prepare('SELECT status_workflow FROM permohonan WHERE id=?').get(application.id).status_workflow,'Lengkap');
  assert.equal(db.prepare('SELECT count(*) AS n FROM notifications').get().n,before+1);
  assert.equal(sent.length,1);
  // A second decision on the same application is refused without side effects.
  assert.equal((await post({permohonan_id:application.id,action:'approve'})).status,404);
  assert.equal(sent.length,1);

  // Ujian Kelas I FAM: awaiting Admin is listed as such even without workflow_status,
  // and its exam result is only recorded once the application is approved.
  const classOne=db.prepare(`SELECT p.id FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.id<>? AND trim(COALESCE(u.email,''))<>'' LIMIT 1`).get(application.id);
  db.prepare(`UPDATE permohonan SET jenis_borang='ujian_kelas1_fam',status='Pending',status_workflow='Menunggu Admin',
    workflow_status=NULL,status_ujian=NULL,tahun_permohonan=2026 WHERE id=?`).run(classOne.id);
  const pending=await (await adminApplications(new Request(
    'https://refpahang.com/api/admin-applications.php?status=Menunggu%20Admin&type=kelas1&year=2026',
    {headers:{Cookie:cookie}}),env)).json();
  assert.ok(pending.applications.some(item=>Number(item.id)===classOne.id),'Kelas I awaiting Admin is listed');
  const result=()=>deleteApplication(new Request('https://refpahang.com/api/admin-applications.php',
    {method:'POST',headers:{Cookie:cookie},body:JSON.stringify({action:'update_status_ujian',id:classOne.id,status_ujian:'Lulus'})}),env);
  assert.equal((await result()).status,409);
  assert.equal((await post({permohonan_id:classOne.id,action:'approve'})).status,200);
  assert.deepEqual({...db.prepare('SELECT status_workflow,workflow_status FROM permohonan WHERE id=?').get(classOne.id)},
    {status_workflow:'Lengkap',workflow_status:'Approved'});
  assert.equal((await result()).status,200);
  assert.equal(db.prepare('SELECT status_ujian FROM permohonan WHERE id=?').get(classOne.id).status_ujian,'Lulus');
  console.log('admin approve: D1 trigger-counted update, notification and decision email passed');
} finally {
  close();
}
