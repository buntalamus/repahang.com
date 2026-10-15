import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminApprove}=await bundle("export {adminApprove} from '../src/admin-approve';");
const {db,DB,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers']);
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
  console.log('admin approve: D1 trigger-counted update, notification and decision email passed');
} finally {
  close();
}
