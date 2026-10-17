// Account and security notices: created/updated/deactivated users, password
// changes, profile edits by Admin or PP Daerah, and referee grade (taraf) changes.
import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {adminUsersWrite} from '../src/admin-users-write';
  export {refereeProfileWrite} from '../src/profile-admin-write';
  export {deactivateReferee} from '../src/registered-referees';
  export {changePassword} from '../src/change-password';
  export {resetPassword} from '../src/password-reset';
  export {refereeGrades} from '../src/referee-grades';
  export {processNotificationOutbox} from '../src/notify';
  export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers']);
const sent=[];
const telegrams=[];
worker.setTelegramSenderForTests(async(chatId,text)=>{telegrams.push({chatId:String(chatId),text});return true;});
const env={DB,BASE_URL:'https://refpahang.com',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  MAIL_ADMIN_USER:'admin@refpahang.com',MAIL_ADMIN_NAME:'Admin RefPahang',
  MAIL_DAFTAR_USER:'daftar@refpahang.com',MAIL_DAFTAR_NAME:'Pendaftaran',
  EMAIL:{send:async(message)=>{sent.push(message);return {messageId:'ok'};}}};
const to=(message)=>typeof message.to==='string'?message.to:message.to.email;
const reset=()=>{sent.length=0;telegrams.length=0;};
const one=(sql,...values)=>db.prepare(sql).get(...values);
const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1");
const pp=one("SELECT id,persatuan_id FROM users WHERE role='PP Daerah' AND aktif=1 AND persatuan_id>0 LIMIT 1");
const adminCookie=await sessionCookie(db,admin.id);
const ppCookie=await sessionCookie(db,pp.id);
const base='https://refpahang.com/api/';
const call=(fn,file,method,cookie,body,search='')=>{
  const init={method,headers:{Cookie:cookie,'Content-Type':'application/json'}};
  if (body instanceof FormData) {init.body=body;delete init.headers['Content-Type'];}
  else if (body!==undefined) init.body=JSON.stringify(body);
  return fn(new Request(base+file+search,init),env).then(async(r)=>({status:r.status,...(await r.json())}));
};
const form=(fields)=>{const f=new FormData();for (const [k,v] of Object.entries(fields)) f.append(k,v);return f;};

try {
  // --- Admin creates a user: welcome email with the password ----------------
  let r=await call(worker.adminUsersWrite,'admin-users.php','POST',adminCookie,form({nama_penuh:'Ujian Notis',
    email:'ujian.notis@example.invalid',no_telefon:'0123',user_role:'Pengadil',persatuan_id:String(pp.persatuan_id)}));
  assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(r.email_sent,true);
  assert.equal(r.message,'Pengguna berjaya ditambah.');
  assert.deepEqual(sent.map(to),['ujian.notis@example.invalid']);
  assert.match(sent[0].subject,/^Akaun Berjaya Didaftarkan/);
  assert.ok(sent[0].html.includes(r.generatedPassword));
  const created=one("SELECT * FROM users WHERE email='ujian.notis@example.invalid'");
  db.prepare("UPDATE users SET telegram_chat_id='777001' WHERE id=?").run(created.id);
  const body=(overrides)=>({userId:created.id,nama_penuh:'UJIAN NOTIS',email:'ujian.notis@example.invalid',
    user_role:'Pengadil',persatuan_id:pp.persatuan_id,no_telefon:'0123',...overrides});

  // --- Admin edit: nothing account-related changed -> no notice -------------
  reset();
  r=await call(worker.adminUsersWrite,'admin-users.php','PUT',adminCookie,body({no_telefon:'0199'}));
  assert.equal(r.status,200);
  assert.equal(r.notification_sent,false);
  assert.equal(sent.length+telegrams.length,0);

  // --- Admin sets a password: reset email with the new password ------------
  reset();
  r=await call(worker.adminUsersWrite,'admin-users.php','PUT',adminCookie,body({password:'BaruSangat123'}));
  assert.equal(r.notification_sent,true);
  assert.deepEqual(sent.map(to),['ujian.notis@example.invalid']);
  assert.match(sent[0].subject,/^Reset Kata Laluan/);
  assert.ok(sent[0].html.includes('BaruSangat123'));

  // --- Role and email change: new address + Telegram, old address warned ----
  reset();
  r=await call(worker.adminUsersWrite,'admin-users.php','PUT',adminCookie,
    body({email:'ujian.baru@example.invalid',user_role:'Penilai'}));
  assert.equal(r.notification_sent,true);
  assert.deepEqual(sent.map(to).sort(),['ujian.baru@example.invalid','ujian.notis@example.invalid']);
  const updatedMail=sent.find((m)=>to(m)==='ujian.baru@example.invalid');
  assert.match(updatedMail.subject,/^Akaun Dikemaskini/);
  assert.ok(updatedMail.html.includes('Penilai Pengadil'));
  assert.match(sent.find((m)=>to(m)==='ujian.notis@example.invalid').subject,/^Alamat Emel Akaun Ditukar/);
  assert.deepEqual(telegrams.map((t)=>t.chatId),['777001']);
  assert.equal(one(`SELECT count(*) n FROM notifications WHERE user_id=? AND type='Akaun Dikemaskini'`,created.id).n,1);

  // --- Deactivation (admin-users.php DELETE): email + Telegram --------------
  reset();
  r=await call(worker.adminUsersWrite,'admin-users.php','DELETE',adminCookie,{userId:created.id});
  assert.equal(r.notification_sent,true);
  assert.deepEqual(sent.map(to),['ujian.baru@example.invalid']);
  assert.match(sent[0].subject,/^Akaun Dinyahaktifkan/);
  assert.equal(telegrams.length,1);
  // A second deactivation of an inactive account sends nothing.
  reset();
  r=await call(worker.adminUsersWrite,'admin-users.php','DELETE',adminCookie,{userId:created.id});
  assert.equal(r.notification_sent,false);
  assert.equal(sent.length,0);

  // --- Deactivation (admin-delete-referee.php) -----------------------------
  const referee=one(`SELECT id,email FROM users WHERE role='Pengadil' AND aktif=1 AND trim(COALESCE(email,''))<>''
    ORDER BY id DESC LIMIT 1`);
  reset();
  r=await call(worker.deactivateReferee,'admin-delete-referee.php','DELETE',adminCookie,undefined,`?id=${referee.id}`);
  assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(r.notification_sent,true);
  assert.deepEqual(sent.map(to),[referee.email]);
  assert.match(sent[0].subject,/^Akaun Dinyahaktifkan/);

  // --- Own password change: security confirmation --------------------------
  const self=one(`SELECT id,email FROM users WHERE role='Pengadil' AND aktif=1 AND trim(COALESCE(email,''))<>''
    AND id<>? ORDER BY id LIMIT 1`,referee.id);
  const bcrypt=(await import('bcryptjs')).default;
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync('LamaLama123',4),self.id);
  const selfCookie=await sessionCookie(db,self.id);
  reset();
  r=await call(worker.changePassword,'change-password.php','POST',selfCookie,
    {current_password:'LamaLama123',new_password:'BaharuBaharu1',confirm_password:'BaharuBaharu1'});
  assert.equal(r.error,false,r.message);
  assert.deepEqual(sent.map(to),[self.email]);
  assert.match(sent[0].subject,/^Kata Laluan Ditukar/);
  assert.ok(sent[0].html.includes('/lupa-kata-laluan'));
  assert.ok(!sent[0].html.includes('BaharuBaharu1'),'never include the password');

  // --- Password reset by token: security confirmation ----------------------
  const token='ab'.repeat(32);
  const hashHex=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
  db.prepare(`INSERT INTO password_reset_tokens(user_id,token,expires_at,used,created_at)
    VALUES(?,?,datetime('now','+8 hours','+1 hour'),0,datetime('now','+8 hours'))`).run(self.id,hashHex);
  reset();
  r=await call(worker.resetPassword,'reset-password.php','POST',selfCookie,
    {token,password:'TokenBaharu12',confirm_password:'TokenBaharu12'});
  assert.equal(r.error,false,r.message);
  assert.deepEqual(sent.map(to),[self.email]);
  assert.ok(sent[0].html.includes('pautan lupa kata laluan'));

  // --- Profile edited by PP Daerah: field names only, both addresses on email change
  const local=one(`SELECT id,email,no_ic FROM users WHERE role='Pengadil' AND aktif=1 AND persatuan_id=?
    AND trim(COALESCE(email,''))<>'' ORDER BY id LIMIT 1`,pp.persatuan_id);
  reset();
  r=await call(worker.refereeProfileWrite,'profil-pengadil.php','PUT',ppCookie,{id:local.id,no_ic:local.no_ic});
  assert.equal(r.status,200);
  assert.equal(r.notification_sent,false,'unchanged values send nothing');
  assert.equal(sent.length,0);
  reset();
  r=await call(worker.refereeProfileWrite,'profil-pengadil.php','PUT',ppCookie,
    {id:local.id,no_telefon:'0170000000',email:'profil.baru@example.invalid'});
  assert.equal(r.notification_sent,true);
  assert.deepEqual(sent.map(to).sort(),[local.email,'profil.baru@example.invalid'].sort());
  const profileMail=sent.find((m)=>to(m)==='profil.baru@example.invalid');
  assert.match(profileMail.subject,/^Profil Dikemaskini/);
  assert.ok(profileMail.html.includes('No. telefon'));
  assert.ok(profileMail.html.includes('Pegawai Pembangunan Daerah'));
  assert.ok(!profileMail.html.includes('0170000000'),'values are not repeated in email');
  assert.match(sent.find((m)=>to(m)===local.email).subject,/^Alamat Emel Akaun Ditukar/);

  // --- Taraf: queued for referees whose grade changes, then delivered -------
  const targets=db.prepare(`SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND trim(COALESCE(email,''))<>''
    AND COALESCE(pengadil_negeri,0)=0 ORDER BY id LIMIT 3`).all().map((row)=>row.id);
  db.prepare('UPDATE users SET pengadil_negeri=1 WHERE id=?').run(targets[0]);
  reset();
  r=await call(worker.refereeGrades,'pengadil-taraf.php','POST',adminCookie,{user_ids:targets,taraf:'negeri',value:1});
  assert.equal(r.error,false,r.message);
  assert.equal(sent.length,0,'delivery happens from the outbox');
  assert.equal(one(`SELECT count(*) n FROM worker_notification_outbox WHERE kind='taraf_notification'
    AND channel='email'`).n,2);
  assert.equal(one(`SELECT count(*) n FROM notifications WHERE type='Taraf Pengadil' AND user_id=?`,targets[1]).n,1);
  assert.equal(one(`SELECT count(*) n FROM notifications WHERE type='Taraf Pengadil' AND user_id=?`,targets[0]).n,0);
  await worker.processNotificationOutbox(env,50);
  assert.equal(sent.filter((m)=>/^Taraf Pengadil Negeri Ditetapkan/.test(m.subject)).length,2);
  console.log('notify-akaun: ok');
} finally {
  worker.setTelegramSenderForTests(null);
  close();
}
