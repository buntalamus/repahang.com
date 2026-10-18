import assert from 'node:assert/strict';
import {createECDH,randomBytes} from 'node:crypto';
import ece from 'http_ece';
import {hash} from 'bcryptjs';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {webPushSubscribe,webPushKey,processPushQueue,webPushUrl}=await bundle(
  "export {webPushSubscribe,webPushKey,webPushUrl} from '../src/webpush';"
  +"export {processPushQueue} from '../src/push';");
const {db,DB,close}=openDatabase(['0001_worker_sessions','0028_push_devices','0029_webpush_subscriptions']);

// VAPID key pair as the Worker stores it: raw public point and JWK `d`.
const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const vapidPublic=Buffer.from(await crypto.subtle.exportKey('raw',vapid.publicKey)).toString('base64url');
const vapidPrivate=(await crypto.subtle.exportKey('jwk',vapid.privateKey)).d;

const userId=Number(db.prepare('SELECT max(id) AS id FROM users').get().id)+1;
db.prepare(`INSERT INTO users(id,email,password,role,nama_penuh,aktif,password_changed)
  VALUES(?,?,?,'Pengadil','Pengadil Web',1,1)`).run(userId,'web-push@example.invalid',await hash('x',4));
const cookie=await sessionCookie(db,userId);
const env={DB,STAGING_AUTH_ENABLED:'1',PUSH_ENABLED:'1'};
const base='https://refpahang.com/api/';
const call=(method,body)=>new Request(base+'webpush-subscribe.php',{method,headers:{Cookie:cookie},body:JSON.stringify(body)});
const notify=(type,subject,message)=>db.prepare(`INSERT INTO notifications(user_id,type,subject,message,email_sent,is_read,created_at)
  VALUES(?,?,?,?,0,0,datetime('now','+8 hours'))`).run(userId,type,subject,message);

// The phone's (user agent's) subscription keys.
const ua=createECDH('prime256v1');ua.generateKeys();
const authSecret=randomBytes(16);
const subscription={endpoint:'https://web.push.apple.com/QGuQyavXutnMHB0AvZ8JiYw',
  keys:{p256dh:ua.getPublicKey().toString('base64url'),auth:authSecret.toString('base64url')}};

const sent=[];
let status=201;
globalThis.fetch=async(url,init)=>{sent.push({url:String(url),init});return new Response(null,{status});};

try {
  // Disabled until the VAPID keys exist.
  assert.equal((await (await webPushKey(new Request(base+'webpush-key.php'),env)).json()).public_key,null);
  assert.equal((await webPushSubscribe(call('POST',subscription),env)).status,503);
  env.VAPID_PUBLIC_KEY=vapidPublic;env.VAPID_PRIVATE_KEY=vapidPrivate;
  assert.equal((await (await webPushKey(new Request(base+'webpush-key.php'),env)).json()).public_key,vapidPublic);

  // Only known push services and well-formed keys are accepted.
  assert.equal((await webPushSubscribe(new Request(base+'webpush-subscribe.php',{method:'POST',body:JSON.stringify(subscription)}),env)).status,401);
  assert.equal((await webPushSubscribe(call('POST',{...subscription,endpoint:'https://evil.example/push'}),env)).status,422);
  assert.equal((await webPushSubscribe(call('POST',{...subscription,endpoint:'http://web.push.apple.com/x'}),env)).status,422);
  assert.equal((await webPushSubscribe(call('POST',{...subscription,keys:{p256dh:'AAAA',auth:subscription.keys.auth}}),env)).status,422);
  assert.equal((await webPushSubscribe(call('POST',subscription),env)).status,200);
  assert.equal((await webPushSubscribe(call('POST',subscription),env)).status,200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_webpush_subscriptions WHERE user_id=?').get(userId).n,1);

  // A new in-app notice is pushed, encrypted so only this phone can read it.
  const id=Number(notify('Lantikan','Lantikan: Pahang lwn Kedah','Anda dilantik sebagai <b>Pengadil</b> &amp; sila jawab.').lastInsertRowid);
  assert.deepEqual(await processPushQueue(env),{sent:1,failed:0,removed:0});
  assert.equal(sent.length,1);
  const {url,init}=sent[0];
  assert.equal(url,subscription.endpoint);
  assert.equal(init.headers['Content-Encoding'],'aes128gcm');
  assert.equal(init.headers.TTL,'86400');
  const [,token,key]=init.headers.Authorization.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(key,vapidPublic);
  const [header,claims,signature]=token.split('.');
  assert.ok(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},vapid.publicKey,Buffer.from(signature,'base64url'),
    new TextEncoder().encode(`${header}.${claims}`)));
  const jwt=JSON.parse(Buffer.from(claims,'base64url'));
  assert.equal(jwt.aud,'https://web.push.apple.com');
  assert.ok(jwt.exp>Date.now()/1000 && jwt.exp<=Date.now()/1000+24*3600);
  // Decrypted with an independent RFC 8291 implementation (http_ece).
  const plain=JSON.parse(ece.decrypt(Buffer.from(init.body),{version:'aes128gcm',privateKey:ua,authSecret}).toString());
  assert.deepEqual(plain,{title:'Lantikan: Pahang lwn Kedah',body:'Anda dilantik sebagai Pengadil & sila jawab.',
    url:'/pengadil/tugasan',tag:`n${id}`,badge:1});

  // A subscription the push service no longer knows is removed.
  sent.length=0;status=410;
  notify('Sistem','Notis','Ujian.');
  assert.deepEqual(await processPushQueue(env),{sent:0,failed:0,removed:1});
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_webpush_subscriptions').get().n,0);
  status=201;

  // Unsubscribing (e.g. on logout) stops pushes for this browser only.
  await webPushSubscribe(call('POST',subscription),env);
  assert.equal((await webPushSubscribe(call('DELETE',{endpoint:subscription.endpoint}),env)).status,200);
  sent.length=0;
  notify('Sistem','Lagi','Tiada penerima.');
  await processPushQueue(env);
  assert.equal(sent.length,0);

  assert.equal(webPushUrl('PP Daerah','sejarah'),'/pp-daerah/pengesahan-perlawanan');
  assert.equal(webPushUrl('Admin','permohonan'),'/admin/permohonan');
  assert.equal(webPushUrl('Penilai','notifikasi'),'/penilai');
  console.log('Web push: VAPID key gating, endpoint allowlist, RFC 8291 payload, invalid cleanup and unsubscribe passed');
} finally {close();}
