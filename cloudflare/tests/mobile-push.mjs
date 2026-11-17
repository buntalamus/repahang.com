import assert from 'node:assert/strict';
import {hash} from 'bcryptjs';
import {bundle,openDatabase} from './_harness.mjs';

const {mobileLogin,mobileLogout,currentUser,pushRegister,processPushQueue,pushScreen,mobileBroadcast}=await bundle(
  "export {mobileLogin,mobileLogout,currentUser} from '../src/auth';"
  +"export {pushRegister,processPushQueue,pushScreen,mobileBroadcast} from '../src/push';");
const {db,DB,close}=openDatabase(['0001_worker_sessions','0028_push_devices']);

const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const pkcs8=Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64');
const serviceAccount=JSON.stringify({project_id:'refpahang-test',client_email:'push@refpahang-test.iam.gserviceaccount.com',
  private_key:`-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`});

const password='mobile-test-password';
const testId=Number(db.prepare('SELECT max(id) AS id FROM users').get().id)+1;
for (const [offset,email] of [[0,'mobile-referee@example.invalid'],[1,'mobile-other@example.invalid']]) {
  db.prepare(`INSERT INTO users(id,email,password,role,nama_penuh,aktif,password_changed)
    VALUES(?,?,?,'Pengadil','Pengadil Mobile',1,1)`).run(testId+offset,email,await hash(password,10));
}
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',PUSH_ENABLED:'1',FCM_SERVICE_ACCOUNT:serviceAccount};
const base='https://refpahang.com/api/';
const post=(path,body,headers={})=>new Request(base+path,{method:'POST',headers,body:JSON.stringify(body)});
const notify=(userId,type,subject,message)=>Number(db.prepare(`INSERT INTO notifications(user_id,type,subject,message,email_sent,is_read,created_at)
  VALUES(?,?,?,?,0,0,datetime('now','+8 hours'))`).run(userId,type,subject,message).lastInsertRowid);

const sent=[];
let fcmStatus=200;
let fcmBody='{}';
globalThis.fetch=async(url,init)=>{
  if (String(url)==='https://oauth2.googleapis.com/token') {
    const assertion=new URLSearchParams(init.body).get('assertion');
    const [header,claims,signature]=assertion.split('.');
    assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(signature,'base64url'),
      new TextEncoder().encode(`${header}.${claims}`)));
    assert.equal(JSON.parse(Buffer.from(claims,'base64url')).scope,'https://www.googleapis.com/auth/firebase.messaging');
    return Response.json({access_token:'fcm-access',expires_in:3600});
  }
  assert.equal(String(url),'https://fcm.googleapis.com/v1/projects/refpahang-test/messages:send');
  assert.equal(init.headers.Authorization,'Bearer fcm-access');
  sent.push(JSON.parse(init.body).message);
  return new Response(fcmBody,{status:fcmStatus});
};

try {
  // Existing notices are never pushed: the cursor starts at the current maximum.
  const cursor=db.prepare("SELECT state_value FROM worker_push_state WHERE state_key='notifications_cursor'").get().state_value;
  assert.equal(cursor,db.prepare('SELECT max(id) AS id FROM notifications').get().id);

  const login=await mobileLogin(post('mobile-login.php',{email:'MOBILE-referee@example.invalid',password}),env);
  assert.equal(login.status,200);
  assert.equal(login.headers.get('Set-Cookie'),null);
  const {token,expires_in,data}=await login.json();
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(expires_in,90*24*3600);
  assert.equal(data.id,testId);
  assert.equal((await mobileLogin(post('mobile-login.php',{email:'mobile-referee@example.invalid',password:'wrong'}),env)).status,401);
  const auth={Authorization:`Bearer ${token}`};
  assert.equal((await currentUser(new Request(base+'session.php',{headers:auth}),env))?.id,testId);
  assert.equal(await currentUser(new Request(base+'session.php',{headers:{Authorization:'Bearer nope'}}),env),null);

  assert.equal((await pushRegister(post('push-register.php',{token:'device-a',platform:'web'},auth),env)).status,422);
  assert.equal((await pushRegister(post('push-register.php',{token:'device-a',platform:'android'}),env)).status,401);
  assert.equal((await pushRegister(post('push-register.php',{token:'device-a',platform:'android',app_version:'1.0.0'},auth),env)).status,200);
  assert.equal((await pushRegister(post('push-register.php',{token:'device-b',platform:'ios'},auth),env)).status,200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_push_devices WHERE user_id=?').get(testId).n,2);

  // A notice for the device owner reaches both devices; another user's notice reaches none.
  const own=notify(testId,'Lantikan','Lantikan: Pahang lwn Kedah','Anda dilantik sebagai <b>Pengadil</b> &amp; sila jawab.');
  notify(testId+1,'Lantikan','Lantikan lain','Bukan untuk peranti ini.');
  const first=await processPushQueue(env);
  assert.deepEqual(first,{sent:2,failed:0,removed:0});
  assert.deepEqual(sent.map((m)=>m.token).sort(),['device-a','device-b']);
  assert.equal(sent[0].notification.title,'Lantikan: Pahang lwn Kedah');
  assert.equal(sent[0].notification.body,'Anda dilantik sebagai Pengadil & sila jawab.');
  assert.deepEqual(sent[0].data,{notification_id:String(own),type:'Lantikan',screen:'lantikan'});
  assert.equal(sent[0].apns.payload.aps.badge,db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id=? AND is_read=0').get(testId).n);
  assert.deepEqual(await processPushQueue(env),{sent:0,failed:0,removed:0});

  // Concurrent runs claim the cursor once.
  sent.length=0;
  notify(testId,'Keputusan Ujian','Keputusan: Lulus','Tahniah.');
  const both=await Promise.all([processPushQueue(env),processPushQueue(env)]);
  assert.equal(both[0].sent+both[1].sent,2);
  assert.equal(sent[0].data.screen,'permohonan');

  // A token FCM no longer knows is removed.
  sent.length=0;
  fcmStatus=404;fcmBody='{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}';
  notify(testId,'Sistem','Notis','Ujian.');
  assert.deepEqual(await processPushQueue(env),{sent:0,failed:0,removed:2});
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_push_devices').get().n,0);
  fcmStatus=200;fcmBody='{}';

  // While push is disabled the cursor still moves, so nothing is sent late.
  await pushRegister(post('push-register.php',{token:'device-c',platform:'android'},auth),env);
  env.PUSH_ENABLED='0';
  sent.length=0;
  notify(testId,'Sistem','Lewat','Tidak dihantar.');
  await processPushQueue(env);
  env.PUSH_ENABLED='1';
  assert.deepEqual(await processPushQueue(env),{sent:0,failed:0,removed:0});
  assert.equal(sent.length,0);

  // DELETE unregisters only the caller's device.
  const remove=new Request(base+'push-register.php',{method:'DELETE',headers:auth,body:JSON.stringify({token:'device-c'})});
  assert.equal((await pushRegister(remove,env)).status,200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_push_devices').get().n,0);

  // Logout ends the session and its devices.
  await pushRegister(post('push-register.php',{token:'device-d',platform:'ios'},auth),env);
  assert.equal((await mobileLogout(post('mobile-logout.php',{},auth),env)).status,200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_push_devices').get().n,0);
  assert.equal(await currentUser(new Request(base+'session.php',{headers:auth}),env),null);

  // An expired session's device is not pushed even if the row remains.
  const relogin=await (await mobileLogin(post('mobile-login.php',{email:'mobile-referee@example.invalid',password}),env)).json();
  await pushRegister(post('push-register.php',{token:'device-e',platform:'android'},{Authorization:`Bearer ${relogin.token}`}),env);
  db.prepare('UPDATE worker_sessions SET expires_at=0 WHERE user_id=?').run(testId);
  sent.length=0;
  notify(testId,'Lantikan','Tamat','Sesi tamat.');
  assert.deepEqual(await processPushQueue(env),{sent:0,failed:0,removed:0});

  // Release broadcast: secret-guarded, reaches live devices only.
  const live=await (await mobileLogin(post('mobile-login.php',{email:'mobile-other@example.invalid',password}),env)).json();
  await pushRegister(post('push-register.php',{token:'device-f',platform:'android'},{Authorization:`Bearer ${live.token}`}),env);
  env.MOBILE_BROADCAST_TOKEN='x'.repeat(40);
  assert.equal((await mobileBroadcast(post('mobile-broadcast.php',{},{'X-Refpahang-Broadcast-Token':'wrong'}),env)).status,403);
  delete env.MOBILE_BROADCAST_TOKEN;
  assert.equal((await mobileBroadcast(post('mobile-broadcast.php',{},{'X-Refpahang-Broadcast-Token':''}),env)).status,403);
  env.MOBILE_BROADCAST_TOKEN='x'.repeat(40);
  sent.length=0;
  const broadcast=await (await mobileBroadcast(post('mobile-broadcast.php',{},{'X-Refpahang-Broadcast-Token':'x'.repeat(40)}),env)).json();
  assert.deepEqual({sent:broadcast.sent,removed:broadcast.removed,next:broadcast.next_offset},{sent:1,removed:0,next:null});
  assert.deepEqual(sent.map((m)=>m.token),['device-f']);
  assert.equal(sent[0].data.screen,'update');

  assert.equal(pushScreen('Lantikan Diterima'),'lantikan');
  assert.equal(pushScreen('Perubahan Perlawanan'),'lantikan');
  assert.equal(pushScreen('PP Disahkan'),'permohonan');
  assert.equal(pushScreen('Pengesahan Perlawanan'),'sejarah');
  assert.equal(pushScreen('Profil Dikemaskini'),'notifikasi');
  console.log('Mobile push: bearer login, device registration, cursor delivery, invalid-token cleanup, logout and update broadcast passed');
} finally {close();}
