import assert from 'node:assert/strict';
import {compare} from 'bcryptjs';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {deleteApplication}=await bundle(
  "export {deleteApplication} from '../src/applications';"
);
const {db,DB,close}=openDatabase([
  '0001_worker_sessions','0010_worker_write_guards','0012_kelas3_welcome_delivery',
]);
const messages=[];
let failing=null;
const env={DB,BASE_URL:'https://staging.example.test',STAGING_AUTH_ENABLED:'1',
  STAGING_WRITES_ENABLED:'0',BULK_EMAIL_ENABLED:'0',
  MAIL_DAFTAR_USER:'daftar@example.test',MAIL_DAFTAR_NAME:'PBNP',
  EMAIL:{send:async message=>{
    messages.push(message);
    if(message.to.email===failing) throw new Error('synthetic failure');
    return {messageId:'synthetic'};
  }}};
const endpoint='https://staging.example.test/api/admin-applications.php';
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const referee=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 1").get();
const adminCookie=await sessionCookie(db,admin.id);
const refereeCookie=await sessionCookie(db,referee.id);
const post=(cookie)=>new Request(endpoint,{method:'POST',headers:{Cookie:cookie},
  body:JSON.stringify({action:'blast_kelas3_welcome'})});

try {
  assert.equal((await deleteApplication(post(''),env)).status,401);
  assert.equal((await deleteApplication(post(refereeCookie),env)).status,403);
  assert.equal((await deleteApplication(post(adminCookie),env)).status,503);
  env.STAGING_WRITES_ENABLED='1';
  assert.equal((await deleteApplication(post(adminCookie),env)).status,503);
  env.BULK_EMAIL_ENABLED='1';
  const ids=db.prepare(`SELECT u.id FROM users u WHERE u.aktif=1 AND u.password_changed=0
    AND EXISTS(SELECT 1 FROM permohonan p WHERE p.user_id=u.id
      AND p.jenis_borang='kelas3_fam' AND p.tahun_permohonan=2026)
    ORDER BY u.id LIMIT 2`).all().map(row=>row.id);
  assert.equal(ids.length,2);
  db.prepare('UPDATE users SET password_changed=1 WHERE id NOT IN (?,?)').run(...ids);
  const old=ids.map(id=>db.prepare('SELECT password FROM users WHERE id=?').get(id).password);
  for(let i=0;i<ids.length;i++) {
    db.prepare('UPDATE users SET email=? WHERE id=?').run(`kelas3${i+1}@example.test`,ids[i]);
  }
  await sessionCookie(db,ids[0]);
  failing='kelas32@example.test';
  const first=await (await deleteApplication(post(adminCookie),env)).json();
  assert.equal(first.error,false);
  assert.deepEqual([first.sent,first.failed,first.skipped],[1,1,0]);
  assert.equal(messages.length,2);
  assert.equal(messages[0].from.email,'daftar@example.test');
  assert.ok(messages[0].text.includes('https://staging.example.test/login'));
  assert.equal(db.prepare('SELECT password FROM users WHERE id=?').get(ids[1]).password,old[1]);
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_sessions WHERE user_id=?').get(ids[0]).n,0);
  const pw=messages[0].text.match(/Kata laluan sementara: ([A-Za-z0-9]+)/)?.[1];
  assert.ok(pw);
  assert.equal(await compare(pw,db.prepare('SELECT password FROM users WHERE id=?').get(ids[0]).password),true);
  failing=null;
  const second=await (await deleteApplication(post(adminCookie),env)).json();
  assert.deepEqual([second.sent,second.failed,second.skipped],[1,0,1]);
  assert.equal(messages.length,3);
  assert.equal(db.prepare("SELECT count(*) AS n FROM worker_kelas3_welcome_delivery WHERE status='sent'").get().n,2);
  const third=await (await deleteApplication(post(adminCookie),env)).json();
  assert.deepEqual([third.sent,third.failed,third.skipped],[0,0,2]);
  assert.equal(messages.length,3);
  console.log('Kelas III welcome: Admin scope, gates, password rollback, session revocation and idempotence passed');
} finally {close();}
