import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {mobileUsage}=await bundle("export {mobileUsage} from '../src/mobile-usage';");
const {db,DB,close}=openDatabase(['0001_worker_sessions','0028_push_devices','0029_webpush_subscriptions']);
const env={DB,STAGING_AUTH_ENABLED:'1',MOBILE_LATEST_VERSION:'1.3.0'};
const url='https://refpahang.com/api/mobile-usage.php';
const district=(id)=>db.prepare('SELECT COALESCE(NULLIF(persatuan_id,0),district_id) AS d FROM users WHERE id=?').get(id).d;

const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get().id;
const pp=db.prepare("SELECT id FROM users WHERE role='PP Daerah' AND aktif=1 AND COALESCE(NULLIF(persatuan_id,0),district_id)>0 LIMIT 1").get().id;
const local=db.prepare(`SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND COALESCE(NULLIF(persatuan_id,0),district_id)=? LIMIT 3`)
  .all(district(pp)).map((r)=>r.id);
const outside=db.prepare(`SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND COALESCE(NULLIF(persatuan_id,0),district_id)<>? LIMIT 1`)
  .get(district(pp)).id;
assert.equal(local.length,3);

// A long (app) session, an old Android app, and an iPhone Web Push subscription.
const appSession=(user)=>{
  const now=Math.floor(Date.now()/1000);
  const hash=`h${user}${Math.random()}`;
  db.prepare('INSERT INTO worker_sessions VALUES (?,?,?,?)').run(hash,user,now,now+90*86400);
  return hash;
};
appSession(local[0]);
const hash=appSession(local[1]);
db.prepare("INSERT INTO worker_push_devices(user_id,session_token_hash,token,platform,app_version) VALUES(?,?,'t1','android','1.2.0')").run(local[1],hash);
db.prepare("INSERT INTO worker_webpush_subscriptions(user_id,endpoint,p256dh,auth) VALUES(?,'https://web.push.apple.com/u','k','a')").run(local[2]);
appSession(outside);

try {
  const get=async(user)=>(await mobileUsage(new Request(url,{headers:{Cookie:await sessionCookie(db,user)}}),env));
  const ppBody=await (await get(pp)).json();
  const byId=new Map(ppBody.users.map((u)=>[u.id,u]));
  assert.equal(byId.get(local[0]).status,'log_masuk');
  assert.equal(byId.get(local[1]).status,'notifikasi');
  assert.equal(byId.get(local[1]).versi_lama,true);
  assert.equal(byId.get(local[2]).status,'notifikasi');
  assert.equal(byId.get(local[2]).web_push,true);
  assert.ok(!byId.has(outside),'PP sees only their district');
  const pengadil=ppBody.summary.find((s)=>s.role==='Pengadil');
  assert.ok(pengadil.notifikasi>=2 && pengadil.log_masuk>=1 && pengadil.versi_lama>=1);

  const adminBody=await (await get(admin)).json();
  assert.equal(adminBody.users.find((u)=>u.id===outside).status,'log_masuk');
  assert.equal(adminBody.users.length,db.prepare('SELECT count(*) AS n FROM users WHERE aktif=1').get().n);

  assert.equal((await get(local[0])).status,403);
  assert.equal((await mobileUsage(new Request(url),env)).status,401);
  console.log('Mobile usage: statuses, old version, PP district scope and access passed');
} finally {close();}
