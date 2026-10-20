import assert from 'node:assert/strict';
import {bundle,openDatabase} from './_harness.mjs';

const w=await bundle(`
  export {notifyUser,enqueueNoticeStatements,processNotificationOutbox} from '../src/notify';
  export {processDistrictAppointmentMail} from '../src/district-appointment-mail';
  export {processWeeklyDigest,weekKey} from '../src/weekly-digest';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0022_district_appointments','0028_push_devices',
  '0029_webpush_subscriptions','0031_district_copies_rejections_only','0032_weekly_digest']);

const emails=[],telegrams=[];
let telegramOk=true;
w.setEmailSenderForTests(async(to,subject)=>{emails.push({to,subject});return true;});
w.setTelegramSenderForTests(async(chatId,text)=>{telegrams.push({chatId:String(chatId),text});return telegramOk;});
const env={DB,BASE_URL:'https://refpahang.com',STAGING_WRITES_ENABLED:'1'};
const reset=()=>{emails.length=0;telegrams.length=0;telegramOk=true;};
const notice=(extra={})=>({subject:'Ujian',title:'Ujian',paragraphs:['x'],portal:{type:'Ujian',subject:'Ujian',message:'x'},...extra});

const users=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 4").all().map((r)=>r.id);
const [tgUser,appUser,plainUser,alwaysUser]=users;
const now=Math.floor(Date.now()/1000);
db.prepare('INSERT INTO worker_sessions VALUES (?,?,?,?)').run('app-hash',appUser,now,now+90*86400);
db.prepare("INSERT INTO worker_push_devices(user_id,session_token_hash,token,platform) VALUES(?,'app-hash','fcm','android')").run(appUser);

try {
  // notifyUser: Telegram or the app replace email; email stays the fallback and for 'always'.
  reset();
  let r=await w.notifyUser(env,{userId:tgUser,name:'A',email:'a@example.invalid',telegramChatId:'111'},notice());
  assert.deepEqual([r.telegram,r.portal,r.email],['sent','sent','skipped']);
  r=await w.notifyUser(env,{userId:appUser,name:'B',email:'b@example.invalid'},notice());
  assert.deepEqual([r.portal,r.email],['sent','skipped'],'app user is reached by the push');
  r=await w.notifyUser(env,{userId:plainUser,name:'C',email:'c@example.invalid'},notice());
  assert.equal(r.email,'sent','no Telegram and no app: email');
  telegramOk=false;
  r=await w.notifyUser(env,{userId:plainUser,name:'C',email:'c@example.invalid',telegramChatId:'333'},notice());
  assert.equal(r.email,'sent','Telegram failed: email');
  telegramOk=true;
  r=await w.notifyUser(env,{userId:alwaysUser,name:'D',email:'d@example.invalid',telegramChatId:'444'},notice({email:'always'}));
  assert.deepEqual([r.telegram,r.email],['sent','sent'],'formal notices always email');

  // Outbox: Telegram first, email skipped once it is sent, deferred while it retries.
  reset();
  await DB.batch(w.enqueueNoticeStatements(env,'p1',{userId:tgUser,name:'A',email:'a@example.invalid',telegramChatId:'111'},notice(),{kind:'t'}));
  await DB.batch(w.enqueueNoticeStatements(env,'p2',{userId:plainUser,name:'C',email:'c@example.invalid'},notice(),{kind:'t'}));
  await w.processNotificationOutbox(env);
  assert.deepEqual(emails.map((e)=>e.to),['c@example.invalid']);
  assert.equal(telegrams.length,1);
  reset();telegramOk=false;
  await DB.batch(w.enqueueNoticeStatements(env,'p3',{userId:plainUser,name:'C',email:'c3@example.invalid',telegramChatId:'333'},notice(),{kind:'t'}));
  await w.processNotificationOutbox(env);
  assert.equal(emails.length,0,'email waits while Telegram is retried');
  assert.equal(db.prepare("SELECT status FROM worker_notification_outbox WHERE dedupe_key='p3:email'").get().status,'pending');
  db.prepare("UPDATE worker_notification_outbox SET status='failed' WHERE dedupe_key='p3:telegram'").run();
  db.prepare("UPDATE worker_notification_outbox SET next_attempt_at=NULL WHERE dedupe_key='p3:email'").run();
  await w.processNotificationOutbox(env);
  assert.deepEqual(emails.map((e)=>e.to),['c3@example.invalid'],'Telegram failed for good: email goes out');

  // District copies: only PP Daerah, only rejections, via Telegram/app first.
  reset();
  const pp=db.prepare("SELECT id,COALESCE(NULLIF(persatuan_id,0),district_id) AS d FROM users WHERE role='PP Daerah' AND aktif=1 AND trim(COALESCE(email,''))<>'' LIMIT 1").get();
  db.prepare("UPDATE users SET telegram_chat_id='999' WHERE id=?").run(pp.id);
  const k=Number(db.prepare(`INSERT INTO kejohanan(nama,jenis_kejohanan,peringkat_kejohanan,tarikh_mula,tarikh_akhir,status,lantikan_persatuan_id)
    VALUES('Ujian Daerah','Liga','Daerah',date('now'),date('now','+9 days'),'Aktif',?)`).run(pp.d).lastInsertRowid);
  const j=Number(db.prepare(`INSERT INTO jadual_perlawanan(kejohanan_id,no_perlawanan,tarikh,masa,pasukan_home,pasukan_away,tempat,status)
    VALUES(?,'D-1',date('now','+3 days'),'17:00','HOME','AWAY','PADANG','Belum Lantik')`).run(k).lastInsertRowid);
  const audit=(type,details)=>db.prepare(`INSERT INTO lantikan_audit_log(event_key,lantikan_id,jadual_id,kejohanan_id,jawatan,nama_pegawai,
    event_type,channel,event_status,details_json,actor_type,created_at) VALUES(?,1,?,?, 'Pengadil','PEGAWAI X',?,'portal','success',?,'system',datetime('now'))`)
    .run(`e-${type}-${Math.random()}`,j,k,type,JSON.stringify(details));
  audit('appointment_created',{});
  audit('appointment_response',{new_status:'Diterima'});
  audit('appointment_response',{new_status:'Ditolak',comment:'Sakit'});
  const queued=db.prepare(`SELECT u.role FROM worker_district_appointment_mail m JOIN users u ON u.id=m.recipient_user_id
    WHERE m.audit_id IN (SELECT id FROM lantikan_audit_log WHERE jadual_id=?)`).all(j);
  assert.ok(queued.length>=1 && queued.every((q)=>q.role==='PP Daerah'),'only PP Daerah rejections are queued');
  await w.processDistrictAppointmentMail(env);
  assert.ok(!emails.some((e)=>e.to===String(db.prepare('SELECT lower(trim(email)) AS e FROM users WHERE id=?').get(pp.id).e)),'PP with Telegram gets no email: '+JSON.stringify(emails));
  assert.ok(telegrams.some((t)=>t.chatId==='999' && t.text.includes('Sakit')));
  assert.equal(db.prepare("SELECT count(*) AS n FROM notifications WHERE user_id=? AND type='Pengganti Diperlukan'").get(pp.id).n,1);

  // Weekly digest: Monday 08:00+ Malaysia time, once per week, only with something to act on.
  reset();
  const monday=Date.parse('2026-10-19T00:30:00Z'); // Monday 08:30 MYT
  const sunday=Date.parse('2026-10-18T02:00:00Z');
  assert.deepEqual(await w.processWeeklyDigest(env,sunday),{sent:0,skipped:0});
  const first=await w.processWeeklyDigest(env,monday,500);
  assert.ok(first.sent>=1,'digest sent to at least one Admin/PP with pending work');
  assert.ok(emails.every((e)=>e.subject==='Ringkasan Mingguan RefPahang — 2026-10-19'));
  const again=await w.processWeeklyDigest(env,monday,500);
  assert.deepEqual(again,{sent:0,skipped:0},'once per week');
  assert.equal(w.weekKey(Date.parse('2026-10-25T15:00:00Z')),'2026-10-19','Sunday night still belongs to that week');
  assert.deepEqual(await w.processWeeklyDigest({...env,STAGING_WRITES_ENABLED:'0'},Date.parse('2026-10-26T01:00:00Z')),{sent:0,skipped:0});
  console.log('Email policy: Telegram/app first, email fallback/always, outbox ordering, district copies, weekly digest passed');
} finally {close();}
