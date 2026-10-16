import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';
const w=await bundle(`
 export {GATES} from '../src/php/gates';
 export {tournaments} from '../src/tournaments';
 export {schedule} from '../src/schedule';
 export {scheduleUpload} from '../src/schedule-upload';
 export {refereePool} from '../src/referee-pool';
 export {adminAppointments} from '../src/admin-appointments';
 export {activeReferees} from '../src/referee';
 export {scheduleReport} from '../src/schedule-report';
 export {printSchedule} from '../src/print-schedule';
 export {appointmentReply} from '../src/appointment-reply';
 export {appointmentAudit} from '../src/appointment-audit';
 export {processDistrictAppointmentMail} from '../src/district-appointment-mail';
 export {setEmailSenderForTests} from '../src/php/email';
 export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const {db,DB,hooks,close}=openDatabase(['0009_mysql_on_update_triggers','0010_worker_write_guards','0020_match_team_regions','0022_district_appointments']);
const env={DB,BASE_URL:'https://refpahang.com',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1',MEDIA:{get:async()=>null}};
const emails=[];let failRecipient='';
w.setEmailSenderForTests(async(to,subject,html)=>{emails.push({to,subject,html});return to!==failRecipient;});
w.setTelegramSenderForTests(async()=>true);
const one=(sql,...values)=>db.prepare(sql).get(...values);
const n=(sql,...values)=>Number(Object.values(one(sql,...values))[0]);
try {
 const pp=one("SELECT id,COALESCE(NULLIF(persatuan_id,0),district_id) AS district FROM users WHERE role='PP Daerah' AND aktif=1 AND persatuan_id=2 LIMIT 1");
 const other=one("SELECT id,persatuan_id AS district FROM users WHERE role='PP Daerah' AND aktif=1 AND persatuan_id<>? LIMIT 1",pp.district);
 const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1");
 const officials=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 5").all();
 // Deterministic synthetic district assignments in this private DB copy only.
 for(const r of officials.slice(0,4)) db.prepare("UPDATE users SET persatuan_id=?,district_id=?,telegram_chat_id=12345 WHERE id=?").run(pp.district,pp.district,r.id);
 db.prepare('UPDATE users SET persatuan_id=?,district_id=? WHERE id=?').run(other.district,other.district,officials[4].id);
 for(const file of ['lantikan.php','pool-pengadil.php','jadual-perlawanan.php','jadual-lantikan-report.php','jadual-upload.php','kejohanan.php']) {
   assert.equal(w.GATES[file]({role:'PP Daerah'}),null,file+' PP router gate');
   assert.equal(w.GATES[file]({role:'Pengadil'}).status,403,file+' referee router gate');
 }
 const cookies={pp:await sessionCookie(db,pp.id),other:await sessionCookie(db,other.id),admin:await sessionCookie(db,admin.id),referee:await sessionCookie(db,officials[0].id)};
 const call=async(fn,file,method='GET',body,actor='pp')=>{
  const response=await w[fn](new Request(`https://refpahang.com/api/${file}`,{method,headers:{Cookie:cookies[actor],'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
  return {status:response.status,body:await response.json()};
 };
 const tournament={nama:'QA District Tournament',jenis_kejohanan:'Liga',peringkat_kejohanan:'Daerah',tarikh_mula:'2099-01-01',tarikh_akhir:'2099-01-02',status:'Draf'};
 let r=await call('tournaments','kejohanan.php','POST',{...tournament,lantikan_persatuan_id:other.district});
 assert.equal(r.status,200,JSON.stringify(r));const tid=r.body.id;
 assert.equal(one('SELECT lantikan_persatuan_id FROM kejohanan WHERE id=?',tid).lantikan_persatuan_id,pp.district,'owner set on server');
 assert.equal((await call('tournaments','kejohanan.php','POST',{...tournament,peringkat_kejohanan:'Negeri'})).status,422);
 r=await call('tournaments','kejohanan.php','POST',tournament,'other');const foreignTid=r.body.id;
 r=await call('tournaments','kejohanan.php');assert.ok(r.body.data.some(t=>t.id===tid));assert.ok(!r.body.data.some(t=>t.id===foreignTid));
 assert.ok(r.body.data.every(t=>t.lantikan_persatuan_id===pp.district));
 assert.equal((await call('tournaments',`kejohanan.php?id=${foreignTid}`)).status,403);
 assert.equal((await call('tournaments','kejohanan.php','PUT',{...tournament,id:foreignTid})).status,403);
 r=await call('tournaments','kejohanan.php','PUT',{...tournament,id:tid,lantikan_persatuan_id:other.district});assert.equal(r.status,200);
 assert.equal(one('SELECT lantikan_persatuan_id FROM kejohanan WHERE id=?',tid).lantikan_persatuan_id,pp.district);
 r=await call('tournaments','kejohanan.php','GET',undefined,'admin');assert.ok(r.body.data.some(t=>t.id===tid && t.lantikan_daerah_nama));assert.ok(r.body.data.some(t=>t.id===foreignTid));
 const fixture={no_perlawanan:'QA-01',tarikh:'2099-01-01',masa:'12:13',pasukan_home:'QA Home',pasukan_away:'QA Away',tempat:'QA Padang'};
 r=await call('schedule','jadual-perlawanan.php','POST',{...fixture,kejohanan_id:tid});assert.equal(r.status,200,JSON.stringify(r));const mid=r.body.id;
 r=await call('schedule','jadual-perlawanan.php','POST',{...fixture,kejohanan_id:foreignTid},'other');const foreignMid=r.body.id;
 for(const [fn,file] of [['schedule',`jadual-perlawanan.php?id=${foreignMid}`],['schedule',`jadual-perlawanan.php?kejohanan_id=${foreignTid}`],['refereePool',`pool-pengadil.php?kejohanan_id=${foreignTid}`],['adminAppointments',`lantikan.php?jadual_id=${foreignMid}`],['scheduleReport',`jadual-lantikan-report.php?kejohanan_id=${foreignTid}`]]) assert.equal((await call(fn,file)).status,403,file);
 r=await call('schedule','jadual-perlawanan.php?action=bulk_delete','POST',{ids:[mid,foreignMid]});assert.equal(r.status,403);assert.equal(n('SELECT COUNT(*) FROM jadual_perlawanan WHERE id IN (?,?)',mid,foreignMid),2);
 assert.equal((await call('scheduleUpload','jadual-upload.php','POST',{kejohanan_id:foreignTid,data:[fixture]})).status,403);
 r=await call('scheduleUpload','jadual-upload.php','POST',{kejohanan_id:tid,data:[{...fixture,no_perlawanan:'QA-02',masa:'15:13'}]});assert.equal(r.status,200,JSON.stringify(r));
 r=await call('activeReferees','get-active-referees.php');assert.ok(r.body.data.some(x=>x.id===officials[0].id));assert.ok(!r.body.data.some(x=>x.id===officials[4].id));
 const outside=one('SELECT id FROM pengadil_luar LIMIT 1');
 for(const items of [[{pengadil_luar_id:outside.id}],[{pengadil_id:officials[0].id},{pengadil_id:officials[4].id}]]) assert.equal((await call('refereePool','pool-pengadil.php','POST',{kejohanan_id:tid,items})).status,403);
 assert.equal(n('SELECT COUNT(*) FROM pool_pengadil WHERE kejohanan_id=?',tid),0,'no partial bulk pool insertion');
 r=await call('refereePool','pool-pengadil.php','POST',{kejohanan_id:tid,items:officials.slice(0,4).map(x=>({pengadil_id:x.id}))});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.added,4);
 const assign=(ref,jawatan='Pengadil',match=mid,actor='pp')=>call('adminAppointments','lantikan.php','POST',{jadual_id:match,pengadil_id:ref,jawatan},actor);
 assert.equal((await assign(officials[4].id)).status,403);
 assert.equal((await call('adminAppointments','lantikan.php','POST',{jadual_id:mid,pengadil_luar_id:outside.id,jawatan:'Pengadil'})).status,403);
 assert.equal((await assign(officials[0].id,'Pengadil',foreignMid)).status,403);
 for(const [i,position] of ['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2'].entries()) {r=await assign(officials[i].id,position);assert.equal(r.status,200,JSON.stringify(r));}
 assert.equal(one("SELECT actor_type FROM lantikan_audit_log WHERE jadual_id=? AND event_type='appointment_created' LIMIT 1",mid).actor_type,'pp_daerah');
 const aid=one("SELECT id FROM lantikan_pengadil WHERE jadual_id=? AND jawatan='Pengadil'",mid).id;
 assert.equal((await call('appointmentAudit',`lantikan-audit.php?lantikan_id=${aid}`)).status,403,'bearer response links stay admin-only');
 assert.equal((await call('appointmentAudit','lantikan-audit.php','POST',{lantikan_id:aid,action:'override_acceptance'})).status,403);
 const rowsBefore=n('SELECT COUNT(*) FROM lantikan_audit_log');
 assert.equal((await call('adminAppointments','lantikan.php','POST',{action:'batal_bulk',jadual_ids:[mid,foreignMid],sebab:'QA',status:'Dibatalkan'})).status,403);
 assert.equal(n('SELECT COUNT(*) FROM lantikan_audit_log'),rowsBefore);
 r=await call('adminAppointments','lantikan.php','POST',{action:'notify',jadual_id:mid});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.email_sent,3);
 // Admin replaces a PP assignment, with actor identity retained and district copies queued.
 r=await assign(officials[3].id,'Pengadil',mid,'admin');assert.equal(r.status,200,JSON.stringify(r));
 assert.equal(one('SELECT pengadil_id FROM lantikan_pengadil WHERE id=?',aid).pengadil_id,officials[3].id);
 assert.equal(one("SELECT actor_user_id FROM lantikan_audit_log WHERE jadual_id=? AND event_type='appointment_reassigned' ORDER BY id DESC LIMIT 1",mid).actor_user_id,admin.id);
 // A real referee response also queues copies via the same transactional audit trigger.
 const ar1=one("SELECT id FROM lantikan_pengadil WHERE jadual_id=? AND jawatan='Penolong Pengadil 1'",mid).id;
 cookies.responding=await sessionCookie(db,officials[1].id);
 r=await call('appointmentReply','lantikan-jawab.php','POST',{lantikan_id:ar1,action:'reject',komen:'QA tidak lapang'},'responding');assert.equal(r.status,200,JSON.stringify(r));
 const responseEvent=one("SELECT id FROM lantikan_audit_log WHERE lantikan_id=? AND event_type='appointment_response' ORDER BY id DESC LIMIT 1",ar1).id;
 assert.ok(n('SELECT COUNT(*) FROM worker_district_appointment_mail WHERE audit_id=?',responseEvent)>0);
 const expected=db.prepare("SELECT DISTINCT lower(trim(email)) email FROM users WHERE aktif=1 AND (role='Admin' OR (role='PP Daerah' AND COALESCE(NULLIF(persatuan_id,0),district_id)=?)) AND trim(COALESCE(email,''))<>''").all(pp.district).map(x=>x.email).sort();
 const received=db.prepare('SELECT DISTINCT recipient_email FROM worker_district_appointment_mail').all().map(x=>x.recipient_email).sort();assert.deepEqual(received,expected);
 assert.ok(!received.includes(one('SELECT lower(trim(email)) email FROM users WHERE id=?',other.id).email));
 db.prepare("UPDATE jadual_perlawanan SET pasukan_home='NAMA DITUKAR SELEPAS PERISTIWA' WHERE id=?").run(mid);
 const totalCopies=n('SELECT COUNT(*) FROM worker_district_appointment_mail');
 assert.ok(totalCopies>=expected.length*8);
 const pendingRows=db.prepare('SELECT id,recipient_email FROM worker_district_appointment_mail ORDER BY id').all();
 // Only one first delivery fails; the other copies succeed and cannot be repeated.
 const failedId=pendingRows[0].id;let shouldFail=true;
 emails.length=0;
 w.setEmailSenderForTests(async(to,subject,html)=>{emails.push({to,subject,html});if(shouldFail){shouldFail=false;return false;}return true;});
 r=await w.processDistrictAppointmentMail(env,100);assert.equal(r.failed,1);assert.equal(r.sent,totalCopies-1);
 assert.equal(n('SELECT COUNT(*) FROM worker_district_appointment_mail WHERE completed_at IS NULL'),1);
 for(const e of emails) {assert.ok(e.subject.startsWith('[Salinan Daerah]'));assert.match(e.html,/QA Home/,'mail context frozen at event');assert.doesNotMatch(e.html,/NAMA DITUKAR SELEPAS PERISTIWA/);assert.doesNotMatch(e.html,/lantikan-jawab-token|email_token|penilaian_token|tg_token/);}
 const sentBefore=emails.length;await w.processDistrictAppointmentMail(env,100);assert.equal(emails.length,sentBefore,'retry waits until due');
 db.prepare('UPDATE worker_district_appointment_mail SET next_attempt_at=NULL WHERE id=?').run(failedId);
 const parallel=await Promise.all([w.processDistrictAppointmentMail(env,100),w.processDistrictAppointmentMail(env,100)]);
 assert.equal(parallel.reduce((v,x)=>v+x.sent,0),1,'concurrent claims send only one copy');
 assert.equal(emails.length,sentBefore+1);assert.equal(n('SELECT COUNT(*) FROM worker_district_appointment_mail WHERE completed_at IS NULL'),0);
 // Move a referee between validation and transaction: complete pool addition rolls back.
 const raceRef=officials[0].id;
 const poolId=one('SELECT id FROM pool_pengadil WHERE kejohanan_id=? AND pengadil_id=?',tid,raceRef).id;
 db.prepare('DELETE FROM pool_pengadil WHERE id=?').run(poolId);
 hooks.beforeBatch=()=>db.prepare('UPDATE users SET persatuan_id=? WHERE id=?').run(other.district,raceRef);
 r=await call('refereePool','pool-pengadil.php','POST',{kejohanan_id:tid,items:[{pengadil_id:raceRef}]});assert.equal(r.status,409);assert.equal(n('SELECT COUNT(*) FROM pool_pengadil WHERE id=?',poolId),0);
 // Admin-only competitions never start a new district email fanout.
 assert.equal(n('SELECT COUNT(*) FROM worker_district_appointment_mail WHERE audit_id IN (SELECT id FROM lantikan_audit_log WHERE kejohanan_id IS NULL)'),0);
 console.log('district appointments: real sessions, immutable ownership, cross-district/bulk denial, local picker, external denial, Admin override, response copies, retry/idempotent claims and transaction guard passed');
} finally {close();}
