import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie,testPng} from './_harness.mjs';

const worker=await bundle(`export {originRecords} from '../src/origin-records';
  export {refereeMatches} from '../src/referee';
  export {districtMatchVerification} from '../src/district-match-verification';
  export {adminMatches} from '../src/admin-matches';
  export {refereeMatchManage} from '../src/referee-match-manage';
  export {eligibilityLists} from '../src/application-eligibility';
  export {submitRefereeApplication} from '../src/application-submit';
  export {districtOverview} from '../src/role-dashboards';`);
const {db,DB,hooks,close}=openDatabase(['0011_application_uniqueness','0019_annual_seminar_attendance',
  '0015_self_reported_match_dedup','0016_match_fingerprint_delete_trigger','0017_match_fingerprint_update_trigger','0018_match_fingerprint_promote_trigger']);
const objects=new Map();
const pdf=new TextEncoder().encode('%PDF-1.7\n% test evidence');
const png=testPng();
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',BASE_URL:'https://refpahang.example',
  MEDIA:{put:async(key,bytes,options)=>objects.set(key,{bytes,options}),
    delete:async key=>objects.delete(key),get:async key=>objects.has(key)?{body:objects.get(key).bytes,
      httpMetadata:{contentType:objects.get(key).options.httpMetadata.contentType},arrayBuffer:async()=>objects.get(key).bytes}:null},
  EMAIL:{send:async()=>({messageId:'test'})},MAIL_DAFTAR_USER:'daftar@refpahang.example',MAIL_DAFTAR_NAME:'PBNP',
  ASSETS:{fetch:async()=>new Response('missing',{status:404})},
  BROWSER:{quickAction:async()=>new Response(pdf,{headers:{'Content-Type':'application/pdf'}})}};
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const year=Number(day.slice(0,4));
const prior=String(year-1);
const yesterday=new Date(Date.parse(day)-86400000).toISOString().slice(0,10);
const expiry=new Date(Date.parse(day)+30*86400000).toISOString().slice(0,10);
const owner=80;
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get().id;
const pp=db.prepare("SELECT id FROM users WHERE role='PP Daerah' AND aktif=1 AND persatuan_id=(SELECT persatuan_id FROM users WHERE id=?) LIMIT 1").get(owner).id;
const other=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND id<>? LIMIT 1").get(owner).id;
const cookies=new Map();
for(const userId of [owner,admin,pp,other]) cookies.set(userId,await sessionCookie(db,userId));
const url='https://refpahang.example/api/rekod-negeri-asal.php';
const headers=(userId)=>userId?{Cookie:cookies.get(userId)}:{};
const state=(requestId)=>db.prepare('SELECT * FROM referee_origin_requests WHERE id=?').get(requestId);
const setting=(key,value)=>db.prepare(`INSERT INTO application_settings(setting_key,setting_value) VALUES(?,?)
  ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`).run(key,value);
const get=(userId,params={})=>worker.originRecords(new Request(`${url}?${new URLSearchParams(params)}`,{headers:headers(userId)}),env);
const post=(userId,body)=>worker.originRecords(new Request(url,{method:'POST',headers:headers(userId),body:JSON.stringify(body)}),env);
const act=(userId,requestId,action,fields={})=>post(userId,{id:requestId,revision:state(requestId).revision,action,...fields});
async function expect(responsePromise,status) {
  const response=await responsePromise;
  const body=await response.json();
  assert.equal(response.status,status,JSON.stringify(body));return body;
}
function requestForm(fields={},proof=pdf) {
  const form=new FormData();
  for(const [key,value] of Object.entries({action:'request',origin_state:'Selangor',transfer_date:day,
    date_from:`${prior}-01-01`,date_to:yesterday,verifier_name:'PP Negeri Asal Ujian',notes:'Buku log disahkan',...fields})) form.set(key,String(value));
  if(proof) form.set('proof',new File([proof],'buku-log.pdf',{type:'application/pdf'}));
  return form;
}
const upload=(userId,form=requestForm())=>worker.originRecords(new Request(url,{method:'POST',headers:headers(userId),body:form}),env);
const grant=(requestId,fields={})=>act(admin,requestId,'grant',{date_from:`${prior}-01-01`,date_to:yesterday,expires_on:expiry,...fields});
const add=(requestId,fields={})=>act(owner,requestId,'add_record',{tarikh:`${year}-01-01`,masa:'16:30',jenis:'Liga',
  nama_kejohanan:'Liga Selangor',tempat:'Padang Selangor',home_team:'Selangor FC',away_team:'Lawan FC',jawatan:'Pengadil',...fields});
const verified=()=>db.prepare("SELECT COUNT(*) n FROM perlawanan WHERE user_id=? AND status_pp='Disahkan' AND substr(tarikh,1,4)=?").get(owner,String(year)).n;
function annualForm() { const form=new FormData(); for(const [k,v] of Object.entries({jenis_borang:'pengadil_berdaftar',
  nama_waris:'Waris Ujian',hubungan_waris:'Keluarga',telefon_waris:'0123456789',saiz_baju:'M'})) form.set(k,v);
  form.set('gambar',new File([png],'gambar.png',{type:'image/png'}));form.set('resit',new File([png],'resit.png',{type:'image/png'}));return form; }
const apply=()=>worker.submitRefereeApplication(new Request('https://refpahang.example/api/pengadil-application.php',{
  method:'POST',headers:headers(owner),body:annualForm()}),env);

try {
  // Live eligibility is exercised through both listing and actual annual submission.
  db.prepare("UPDATE perlawanan SET status_pp='Tidak Disahkan' WHERE user_id=?").run(owner);
  db.prepare("UPDATE users SET alamat1='Alamat Ujian' WHERE id=?").run(owner);
  db.prepare("UPDATE application_settings SET setting_value='' WHERE setting_key LIKE '%\\_open\\_date' ESCAPE '\\' OR setting_key LIKE '%\\_close\\_date' ESCAPE '\\'").run();
  setting('application_year',String(year+1));setting('berdaftar_open','1');setting('min_verified_matches','20');
  for(let i=0;i<19;i++) db.prepare(`INSERT INTO perlawanan(user_id,tarikh,jenis,tempat,jawatan,home_team,away_team,status_pp)
    VALUES(?,?,'Liga','Pahang','Pengadil',?,'Lawan Pahang','Disahkan')`).run(owner,`${year}-01-01`,`Pahang ${i}`);
  const districtFeed=()=>worker.districtOverview(new Request('https://refpahang.example/api/pp-overview.php',{headers:headers(pp)}),env);
  const districtBaseline=await (await districtFeed()).json();
  assert.equal(verified(),19);
  await expect(get(null),401);
  env.STAGING_WRITES_ENABLED='0';await expect(upload(owner),503);env.STAGING_WRITES_ENABLED='1';
  await expect(upload(owner,requestForm({},null)),422);
  await expect(upload(owner,requestForm({},new TextEncoder().encode('fake PDF'))),422);
  await expect(upload(owner,requestForm({date_to:day})),422);
  await expect(upload(owner,requestForm({origin_state:'Pahang'})),422);
  await expect(upload(owner,requestForm({},new Uint8Array(5*1024*1024+1))),422);
  assert.equal(objects.size,0);
  await expect(upload(owner),200);
  const requestId=db.prepare('SELECT MAX(id) AS id FROM referee_origin_requests').get().id;
  assert.equal(state(requestId).status,'requested');
  assert.equal(objects.size,1);
  assert.ok(db.prepare("SELECT payload_json FROM worker_notification_outbox WHERE kind='origin_records'").all()
    .every(row=>JSON.parse(row.payload_json).email==='always'));
  await expect(upload(owner),409);assert.equal(objects.size,1,'failed request must remove uploaded object');
  await expect(get(other,{id:String(requestId)}),404);
  await expect(get(other,{id:String(requestId),action:'proof'}),404);
  assert.ok([403,404].includes((await get(pp,{id:String(requestId),action:'proof'})).status));
  const proof=await get(owner,{id:String(requestId),action:'proof'});
  assert.equal(proof.status,200);assert.equal(proof.headers.get('Cache-Control'),'private, no-store');
  assert.deepEqual(new Uint8Array(await proof.arrayBuffer()),pdf);
  const detail=await expect(get(owner,{id:String(requestId)}),200);
  assert.equal(detail.request.proof_key,undefined);
  assert.equal(detail.request.last_operation,undefined);
  const replacement=requestForm({action:'replace_proof',id:requestId,revision:state(requestId).revision});
  const oldProof=state(requestId).proof_key;
  await expect(upload(owner,replacement),200);
  assert.equal(objects.size,1);assert.equal(objects.has(oldProof),false);
  await expect(add(requestId),409);
  await expect(act(owner,requestId,'grant'),403);
  for(const action of ['grant','accept','reject','revoke']) assert.ok([403,404].includes((await act(pp,requestId,action)).status));
  await expect(grant(requestId,{date_to:day}),422);
  await expect(grant(requestId,{expires_on:`${year+1}-12-31`}),422);
  await expect(grant(requestId),200);
  assert.equal((await expect(get(owner,{id:String(requestId)}),200)).request.access_active,true);
  const rev=state(requestId).revision;
  await expect(post(admin,{id:requestId,revision:rev-1,action:'revoke',notes:'stale'}),409);
  await expect(add(requestId,{tarikh:day}),422);
  const ordinaryOld=await expect(worker.refereeMatchManage(new Request('https://refpahang.example/api/pengadil-match-manage.php',{
    method:'POST',headers:headers(owner),body:JSON.stringify({action:'add',tarikh:`${prior}-01-01`})}),env),400);
  assert.match(ordinaryOld.message,/14 hari/);
  await expect(add(requestId,{jawatan:'Penilai Pengadil'}),422);
  await expect(add(requestId),200);
  await expect(add(requestId,{home_team:'Lawan F.C.',away_team:'Selangor FC'}),409);
  await expect(add(requestId,{tarikh:`${prior}-12-31`,home_team:'Sejarah Lama'}),200);
  await expect(add(requestId,{tarikh:`${year}-01-02`,home_team:'Selangor Kedua'}),200);
  assert.equal(verified(),19,'drafts cannot count');
  assert.ok(!(await worker.eligibilityLists(env)).berdaftar.some(r=>r.id===owner));
  await expect(apply(),400);
  // Changing or replacing data after a concurrent Admin revoke must do nothing.
  const before=db.prepare('SELECT COUNT(*) n FROM referee_origin_records WHERE request_id=?').get(requestId).n;
  hooks.beforeBatch=()=>db.prepare("UPDATE referee_origin_requests SET status='revoked',revision=revision+1 WHERE id=?").run(requestId);
  await expect(add(requestId,{home_team:'Concurrent'}),409);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM referee_origin_records WHERE request_id=?').get(requestId).n,before);
  await expect(grant(requestId),200);
  db.prepare('UPDATE referee_origin_requests SET expires_on=? WHERE id=?').run(yesterday,requestId);
  await expect(add(requestId,{home_team:'Expired'}),409);
  await expect(act(owner,requestId,'submit'),409);
  assert.equal((await expect(get(owner,{id:String(requestId)}),200)).request.access_active,false);
  await expect(grant(requestId),200);
  await expect(act(owner,requestId,'submit'),200);
  assert.equal(state(requestId).status,'submitted');assert.equal(verified(),19);
  await expect(add(requestId,{home_team:'After submit'}),409);
  await expect(act(owner,requestId,'accept',{notes:'Forged'}),403);
  await expect(upload(owner,requestForm({action:'replace_proof',id:requestId,revision:state(requestId).revision})),409);
  await expect(act(admin,requestId,'accept'),422);
  // Reject/reopen allows correction; rejected drafts never affect eligibility.
  await expect(act(admin,requestId,'reject',{notes:'Semak semula buku log'}),200);
  assert.equal(verified(),19);
  await expect(grant(requestId),200);
  await expect(act(owner,requestId,'submit'),200);
  // A failed/competing Admin decision must not promote records or send a notice.
  const notices=db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=?').get(owner).n;
  hooks.beforeBatch=()=>db.prepare("UPDATE referee_origin_requests SET revision=revision+1 WHERE id=?").run(requestId);
  await expect(act(admin,requestId,'accept',{notes:'Semakan bertindih'}),409);
  assert.equal(verified(),19);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=?').get(owner).n,notices);
  // Acceptance is atomic if a duplicate appeared after preflight.
  hooks.beforeBatch=()=>db.prepare(`INSERT INTO perlawanan(user_id,tarikh,home_team,away_team,status_pp)
    VALUES(?,?,?,?,'Belum Disahkan')`).run(owner,`${year}-01-02`,'Selangor Kedua','Lawan FC');
  await expect(act(admin,requestId,'accept',{notes:'Semak bukti'}),409);
  assert.equal(state(requestId).status,'submitted');assert.equal(verified(),19);
  db.prepare("DELETE FROM perlawanan WHERE user_id=? AND home_team='Selangor Kedua'").run(owner);
  await expect(act(admin,requestId,'accept',{notes:'Buku log dan pengesahan PP negeri asal telah disemak.'}),200);
  assert.equal(state(requestId).status,'accepted');assert.equal(verified(),21);
  const districtAfter=await (await districtFeed()).json();
  assert.equal(districtAfter.overview.total_matches,districtBaseline.overview.total_matches);
  assert.deepEqual(districtAfter.top_referees,districtBaseline.top_referees,'origin history cannot inflate district ranking');
  const accepted=db.prepare('SELECT * FROM perlawanan WHERE user_id=? AND origin_record_id IS NOT NULL ORDER BY tarikh').all(owner);
  assert.equal(accepted.length,3);assert.ok(accepted.every(r=>r.verified_by===admin && r.status_pp==='Disahkan'));
  await expect(act(admin,requestId,'accept',{notes:'Replay'}),409);assert.equal(verified(),21);
  const originMatch=accepted.at(-1).id;
  // PP generic verify/revert/delete routes cannot change accepted external history.
  for(const [method,action] of [['POST','verify'],['POST','reject'],['POST','revert'],['DELETE','delete']]) {
    const response=await worker.districtMatchVerification(new Request('https://refpahang.example/api/pp-verify-match.php',{
      method,headers:headers(pp),body:JSON.stringify({match_id:originMatch,action})}),env);
    assert.ok([403,404].includes(response.status));
  }
  const ppList=await worker.districtMatchVerification(new Request('https://refpahang.example/api/pp-verify-match.php',{headers:headers(pp)}),env);
  assert.ok(!(await ppList.json()).matches.some(m=>accepted.some(r=>r.id===m.id)));
  await expect(worker.adminMatches(new Request('https://refpahang.example/api/admin-matches.php',{
    method:'POST',headers:headers(admin),body:JSON.stringify({match_id:originMatch,action:'revert',justification:'Generic bypass'})}),env),409);
  assert.throws(()=>db.prepare("UPDATE perlawanan SET status_pp='Belum Disahkan' WHERE id=?").run(originMatch),/origin_record_locked/);
  assert.throws(()=>db.prepare('DELETE FROM perlawanan WHERE id=?').run(originMatch),/origin_record_locked/);
  assert.throws(()=>db.prepare(`INSERT INTO perlawanan(user_id,tarikh,home_team,away_team) VALUES(?,?,?,?)`)
    .run(owner,`${year}-01-02`,'Lawan FC','Selangor Kedua'),/origin_record_duplicate/);
  const history=await worker.refereeMatches(new Request('https://refpahang.example/api/pengadil-matches.php?per_page=100',{headers:headers(owner)}),env);
  const historyBody=await history.json();
  assert.equal(historyBody.statistics.origin_verified_year,2);
  assert.equal(historyBody.statistics.pahang_verified_year,19);
  assert.ok(historyBody.matches.some(r=>r.origin_state==='Selangor' && r.origin_admin_name));
  assert.ok((await worker.eligibilityLists(env)).berdaftar.some(r=>r.id===owner && r.perlawanan===21));
  const application=await expect(apply(),200);
  assert.equal(application.linked_matches,21);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM perlawanan WHERE permohonan_id=? AND origin_record_id IS NOT NULL').get(application.application_id).n,2);
  assert.equal(db.prepare('SELECT permohonan_id FROM perlawanan WHERE id=?').get(accepted[0].id).permohonan_id,null);
  // Annual linking is explicitly allowed by the immutable-record trigger.
  assert.equal(db.prepare('SELECT COUNT(*) n FROM activity_log WHERE action=?').get('origin_accept').n,1);
  console.log('Origin records: owner/private proof, Admin-only access/acceptance, expiry/revocation, immutable history, duplicates and concurrent decisions, annual N-1 eligibility and application linking passed.');
} finally { close(); }
