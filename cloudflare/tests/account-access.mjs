import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {enforceAccountPolicy,recordAccountActivity,policyClock,setAccountStatus,login,mobileLogin,currentUser}=await bundle(`
 export {enforceAccountPolicy,recordAccountActivity,policyClock} from '../src/account-policy';
 export {setAccountStatus} from '../src/account-access';
 export {login,mobileLogin,currentUser} from '../src/auth';
`);
const {db,DB,hooks,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers']);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',BASE_URL:'https://refpahang.com',MAIL_ADMIN_USER:'admin@example.invalid',MAIL_ADMIN_NAME:'Admin Fixture',EMAIL:{send:async()=>({messageId:'fixture'})}};
const now=new Date('2026-10-20T04:00:00Z');
const epoch=Math.floor(now.getTime()/1000);
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get().id;
const template=db.prepare('SELECT * FROM permohonan LIMIT 1').get();
let seq=90000;
const user=(overrides={})=>{
 const id=++seq;
 db.prepare(`INSERT INTO users(id,email,password,role,nama_penuh,created_at,last_activity_at,aktif,password_changed)
 VALUES(?,?,?,'Pengadil','AKAUN UJIAN','2023-01-01 00:00:00',?,1,1)`)
 .run(id,`account${id}@example.invalid`,bcrypt.hashSync('test-password',4),epoch);
 for(const [key,value] of Object.entries(overrides)) db.prepare(`UPDATE users SET ${key}=? WHERE id=?`).run(value,id);
 return id;
};
const application=(id,year,extra={})=>{
 const row={...template,id:++seq,user_id:id,jenis_borang:'pengadil_berdaftar',tahun_permohonan:year,
 status:'Pending',status_workflow:'Menunggu PP Daerah',workflow_status:null,tarikh_hantar:`${year}-06-01 12:00:00`,...extra};
 const keys=Object.keys(row);
 db.prepare(`INSERT INTO permohonan(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));
};
const state=id=>db.prepare('SELECT aktif,inactive_reason,inactive_source,last_activity_at,registration_review_year FROM users WHERE id=?').get(id);
const request=id=>new Request('https://refpahang.com/api/login.php',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({email:`account${id}@example.invalid`,password:'test-password'})});
try {
 assert.equal(policyClock(new Date('2026-10-31T03:00:00Z')).idleCutoff,Date.parse('2026-02-28T03:00:00Z')/1000);
 const absent=user(); await enforceAccountPolicy(env,absent,now);
 assert.deepEqual([state(absent).aktif,state(absent).inactive_source],[0,'registration']);
 assert.match(state(absent).inactive_reason,/2024 dan 2025/);
 for(const year of [2024,2025]) {
  const submitted=user(); application(submitted,year); await enforceAccountPolicy(env,submitted,now);
  assert.equal(state(submitted).aktif,1,'Pending submitted application counts in either year');
 }
 const rejected=user(); application(rejected,2024,{status:'Rejected',status_workflow:'Ditolak'});
 await enforceAccountPolicy(env,rejected,now); assert.equal(state(rejected).aktif,1);
 for(const extra of [{tarikh_hantar:''},{status_workflow:'Draf'},{workflow_status:'Draf'},{jenis_borang:'ujian_kecergasan'}]) {
  const draft=user(); application(draft,2025,extra); await enforceAccountPolicy(env,draft,now); assert.equal(state(draft).aktif,0);
 }
 const currentOnly=user(); application(currentOnly,2026); await enforceAccountPolicy(env,currentOnly,now);
 assert.equal(state(currentOnly).aktif,0,'Only last two complete years count');
 const newAccount=user({created_at:'2025-01-01 00:00:01'});
 await enforceAccountPolicy(env,newAccount,now); assert.equal(state(newAccount).aktif,1,'Must span two complete calendar years');
 const adminAccount=user({role:'Admin',last_activity_at:1});
 await enforceAccountPolicy(env,adminAccount,now); assert.equal(state(adminAccount).aktif,1);
 const cutoff=policyClock(now).idleCutoff;
 for(const role of ['Pengadil','Penilai','PP Daerah']) {
  const idle=user({role,last_activity_at:cutoff}); application(idle,2025);
  await enforceAccountPolicy(env,idle,now); assert.equal(state(idle).inactive_source,'inactivity',role);
 }
 const autoSession=user({role:'Penilai',last_activity_at:1});
 await sessionCookie(db,autoSession);
 db.prepare('UPDATE users SET last_activity_at=1 WHERE id=?').run(autoSession);
 db.prepare("INSERT INTO worker_push_devices(user_id,token,session_token_hash,platform) VALUES(?,'auto-device','auto-session','android')").run(autoSession);
 db.prepare("INSERT INTO worker_webpush_subscriptions(user_id,endpoint,p256dh,auth) VALUES(?,'https://push.example.invalid/auto','key','auth')").run(autoSession);
 await enforceAccountPolicy(env,autoSession,now);
 for(const table of ['worker_sessions','worker_push_devices','worker_webpush_subscriptions']) {
  assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id=?`).get(autoSession).n,0);
 }
 const audits=db.prepare("SELECT count(*) AS n FROM activity_log WHERE user_id=? AND action='auto_deactivate_account'").get(autoSession).n;
 await enforceAccountPolicy(env,autoSession,now);
 assert.equal(db.prepare("SELECT count(*) AS n FROM activity_log WHERE user_id=? AND action='auto_deactivate_account'").get(autoSession).n,audits);
 const recentLogin=user({role:'Penilai',last_activity_at:1,last_login:'2026-10-19 12:00:00'});
 await enforceAccountPolicy(env,recentLogin,now); assert.equal(state(recentLogin).aktif,1);
 const recentLog=user({role:'Penilai',last_activity_at:1});
 db.prepare("INSERT INTO activity_log(user_id,action,created_at) VALUES(?,'submit_report','2026-10-19 12:00:00')").run(recentLog);
 await enforceAccountPolicy(env,recentLog,now); assert.equal(state(recentLog).aktif,1);
 const justInside=user({role:'Penilai',last_activity_at:cutoff+1});
 await enforceAccountPolicy(env,justInside,now); assert.equal(state(justInside).aktif,1);
 // Editing someone else's profile must not reset that user's inactivity or
 // acknowledge an annual review merely because a legacy form repeats aktif=1.
 for (const role of ['Penilai','Pengadil']) {
  const edited=user({role}); await sessionCookie(db,edited);
  db.prepare('UPDATE users SET last_activity_at=1 WHERE id=?').run(edited);
  const response=await setAccountStatus(env,admin,edited,1,null,{nama_penuh:'PROFIL DIKEMAS KINI'});
  assert.equal(response.status,200);
  assert.equal(state(edited).last_activity_at,1);
  assert.equal(state(edited).registration_review_year,null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_sessions WHERE user_id=?').get(edited).n,1);
  await enforceAccountPolicy(env,edited,now);
  assert.equal(state(edited).inactive_source,role==='Penilai'?'inactivity':'registration');
 }
 const race=user({role:'Penilai',last_activity_at:1});
 hooks.beforeBatch=()=>db.prepare('UPDATE users SET last_activity_at=? WHERE id=?').run(epoch,race);
 await enforceAccountPolicy(env,race,now); assert.equal(state(race).aktif,1,'Recent activity wins race');
 const reactivated=await setAccountStatus(env,admin,absent,1,null);
 assert.equal(reactivated.status,200); assert.equal(state(absent).inactive_source,null);
 await enforceAccountPolicy(env,absent,now); assert.equal(state(absent).aktif,1,'Admin acknowledges this annual cycle');
 await enforceAccountPolicy(env,absent,new Date('2027-01-01T00:00:00Z'));
 assert.equal(state(absent).inactive_source,'registration','Next annual cycle is evaluated');
 const raceLogin=user({created_at:'2026-01-01 00:00:00'});
 hooks.beforeBatch=()=>db.prepare("UPDATE users SET aktif=0,inactive_reason='Sekatan serentak',inactive_source='manual' WHERE id=?").run(raceLogin);
 let raced=await mobileLogin(request(raceLogin),env);
 assert.equal(raced.status,403,'Disable between password check and session issuance wins');
 assert.equal(db.prepare('SELECT count(*) AS n FROM worker_sessions WHERE user_id=?').get(raceLogin).n,0);
 const target=user({created_at:'2026-01-01 00:00:00'});
 const cookie=await sessionCookie(db,target);
 db.prepare(`INSERT INTO worker_push_devices(user_id,token,session_token_hash,platform,created_at,last_seen_at)
 VALUES(?,'fake-device','fake-session','android',datetime('now'),datetime('now'))`).run(target);
 db.prepare("INSERT INTO worker_webpush_subscriptions(user_id,endpoint,p256dh,auth) VALUES(?,'https://push.example.invalid/manual','key','auth')").run(target);
 const history=db.prepare('SELECT count(*) AS n FROM permohonan WHERE user_id=?').get(target).n;
 assert.equal((await setAccountStatus(env,admin,target,0,'  ')).status,400);
 assert.equal((await setAccountStatus(env,admin,target,0,'x'.repeat(1001))).status,400);
 assert.equal((await setAccountStatus(env,admin,admin,0,'test')).status,400);
 assert.equal((await setAccountStatus(env,target,adminAccount,0,'test')).status,409,'Nonadmin cannot mutate');
 let r=await setAccountStatus(env,admin,target,0,'  Digantung oleh pentadbir.  ');
 assert.equal(r.status,200); assert.equal(state(target).inactive_reason,'Digantung oleh pentadbir.');
 assert.equal(state(target).inactive_source,'manual');
 assert.equal(db.prepare('SELECT count(*) AS n FROM worker_sessions WHERE user_id=?').get(target).n,0);
 assert.equal(db.prepare('SELECT count(*) AS n FROM worker_push_devices WHERE user_id=?').get(target).n,0);
 assert.equal(db.prepare('SELECT count(*) AS n FROM worker_webpush_subscriptions WHERE user_id=?').get(target).n,0);
 assert.equal(db.prepare('SELECT count(*) AS n FROM permohonan WHERE user_id=?').get(target).n,history);
 assert.equal(await currentUser(new Request('https://refpahang.com/api/session.php',{headers:{Cookie:cookie}}),env),null);
 for(const fn of [login,mobileLogin]) {
  r=await fn(request(target),env); assert.equal(r.status,403); const body=await r.json();
  assert.equal(body.code,'ACCOUNT_INACTIVE'); assert.equal(body.reason,'Digantung oleh pentadbir.');
  assert.equal(body.token,undefined); assert.equal(r.headers.get('Set-Cookie'),null);
 }
 const wrong=request(target); const wrongBody=await wrong.json();wrongBody.password='wrong';
 r=await login(new Request(wrong.url,{method:'POST',body:JSON.stringify(wrongBody)}),env);
 assert.equal(r.status,401); assert.equal((await r.json()).reason,undefined);
 await setAccountStatus(env,admin,target,1,null);
 assert.equal(await currentUser(new Request('https://refpahang.com/api/session.php',{headers:{Cookie:cookie}}),env),null,'Reactivation does not restore old sessions');
 r=await mobileLogin(request(target),env); assert.equal(r.status,200); assert.ok((await r.json()).token);
 const tracked=user({role:'Penilai',last_activity_at:1});await recordAccountActivity(env,tracked);
 assert.ok(state(tracked).last_activity_at>1);
 const actorRace=user({created_at:'2026-01-01 00:00:00'});
 hooks.beforeBatch=()=>db.prepare('UPDATE users SET aktif=0 WHERE id=?').run(admin);
 assert.equal((await setAccountStatus(env,admin,actorRace,0,'Sekatan')).status,409);
 assert.equal(state(actorRace).aktif,1,'Disabled Admin cannot mutate through an in-flight request');
 db.prepare('UPDATE users SET aktif=1 WHERE id=?').run(admin);
 const before=state(tracked).last_activity_at;await recordAccountActivity(env,tracked);assert.equal(state(tracked).last_activity_at,before);
 // The scheduled scan must drain a backlog over bounded invocations.
 db.prepare('UPDATE users SET last_activity_at=? WHERE aktif=1').run(epoch);
 const backlog=Array.from({length:26},()=>user({role:'Penilai',last_activity_at:1}));
 await enforceAccountPolicy(env,undefined,now);
 assert.equal(backlog.filter(id=>state(id).aktif===0).length,25);
 await enforceAccountPolicy(env,undefined,now);
 assert.equal(backlog.filter(id=>state(id).aktif===0).length,26);
 console.log('PASS: annual submission/full-year rules; 8 calendar months/all nonadmins; race; Admin restore; manual reason; session/device revocation; website/mobile denial; password privacy; activity tracking.');
} finally {close();}
