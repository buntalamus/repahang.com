import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';
const w=await bundle(`export {schedule} from '../src/schedule';`);
const {db,DB,close}=openDatabase([]);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',MEDIA:{get:async()=>null}};
const one=(sql,...values)=>db.prepare(sql).get(...values);
const n=(sql,...values)=>Number(Object.values(one(sql,...values))[0]);
try {
 const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1");
 const cookie=await sessionCookie(db,admin.id);
 const tid=one('SELECT id FROM kejohanan LIMIT 1').id;
 const call=async(path,method,body)=>{
  const response=await w.schedule(new Request(`https://refpahang.com/api/jadual-perlawanan.php${path}`,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
  return {status:response.status,body:await response.json()};
 };
 const match=()=>Number(db.prepare("INSERT INTO jadual_perlawanan (kejohanan_id,no_perlawanan,tarikh,masa,pasukan_home,pasukan_away,tempat) VALUES (?,'',?,'17:00','TBC','TBC','QA Padang')")
  .run(tid,'2099-01-01').lastInsertRowid);
 const audit=(id)=>db.prepare("INSERT INTO lantikan_audit_log (jadual_id,kejohanan_id,event_type) VALUES (?,?,'appointment_deleted')").run(id,tid);
 const exists=(id)=>n('SELECT COUNT(*) FROM jadual_perlawanan WHERE id=?',id)===1;

 // A match whose appointments were all removed keeps its audit trail and can be deleted, as in PHP.
 const removed=match();audit(removed);audit(removed);
 let r=await call(`?id=${removed}`,'DELETE');
 assert.equal(r.status,200,JSON.stringify(r));assert.ok(!exists(removed));
 assert.equal(n('SELECT COUNT(*) FROM lantikan_audit_log WHERE jadual_id=?',removed),2,'audit history kept');

 // A match that still has an appointment stays blocked.
 const appointed=one('SELECT jadual_id FROM lantikan_pengadil WHERE jadual_id IN (SELECT id FROM jadual_perlawanan) LIMIT 1').jadual_id;
 r=await call(`?id=${appointed}`,'DELETE');
 assert.equal(r.status,409);assert.ok(exists(appointed));

 // Bulk deletion is all-or-nothing when one selected match is still appointed.
 const a=match(),b=match();audit(a);
 r=await call('?action=bulk_delete','POST',{ids:[a,b,appointed]});
 assert.equal(r.status,409);assert.ok(exists(a)&&exists(b)&&exists(appointed));
 r=await call('?action=bulk_delete','POST',{ids:[a,b]});
 assert.equal(r.status,200,JSON.stringify(r));assert.ok(!exists(a)&&!exists(b));
 console.log('schedule delete: audit-only matches deletable with history kept, appointed matches blocked, bulk all-or-nothing passed');
} finally {close();}
