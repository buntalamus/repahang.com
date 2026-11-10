import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

// Self-recorded matches need the full crew (Pengadil, Penolong Pengadil 1 and 2).
// The same match (same date and both teams) recorded again is refused with a
// notice naming the existing record. A record sharing an official at the same
// date and time is saved but doubtful: the PP Daerah may verify it only after
// confirming the review with a note.
const {refereeMatchManage,districtMatchVerification}=await bundle(
  "export {refereeMatchManage} from '../src/referee-match-manage'; export {districtMatchVerification} from '../src/district-match-verification';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0015_self_reported_match_dedup']);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',BASE_URL:'https://staging.refpahang.example',
  MAIL_PENGESAHAN_USER:'pengesahan@refpahang.example',MAIL_PENGESAHAN_NAME:'PBNP',
  EMAIL:{send:async()=>({messageId:'test'})}};
const url='https://staging.refpahang.example/api/';
const pp=107, district=5, [a,b,c]=[96,97,98];
for (const id of [a,b,c]) {
  assert.deepEqual({...db.prepare('SELECT role,aktif,persatuan_id FROM users WHERE id=?').get(id)},
    {role:'Pengadil',aktif:1,persatuan_id:5});
}
const [d,e,f]=db.prepare(`SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND id NOT IN (96,97,98)
  ORDER BY id LIMIT 3`).all().map(row=>Number(row.id));
const nameOf=(id)=>db.prepare('SELECT nama_penuh FROM users WHERE id=?').get(id).nama_penuh;
const ppCookie=await sessionCookie(db,pp);
const cookies=Object.fromEntries(await Promise.all([a,b,c,d,e,f].map(async id=>[id,await sessionCookie(db,id)])));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

async function send(by,{officials,masa='16:00',tempat='Stadium Darul Makmur',home='Kuantan FA',away='Pekan FC',kejohanan='Liga Daerah'}) {
  const response=await refereeMatchManage(new Request(url+'pengadil-match-manage.php',{method:'POST',
    headers:{Cookie:cookies[by],'Content-Type':'application/json'},
    body:JSON.stringify({action:'add',tarikh:today,masa,jenis:'Liga',nama_kejohanan:kejohanan,tempat,
      home_team:home,away_team:away,daerah_perlawanan_id:district,
      officials:officials.map(([user_id,jawatan])=>({user_id,jawatan}))})}),env);
  return {status:response.status,body:await response.json()};
}
async function record(by,match) {
  const {status,body}=await send(by,match);
  assert.equal(status,200,JSON.stringify(body));
  return body;
}
const crewOf=(p,a1,a2)=>[[p,'Pengadil'],[a1,'Penolong Pengadil 1'],[a2,'Penolong Pengadil 2']];
const rows=()=>db.prepare('SELECT COUNT(*) AS n FROM perlawanan').get().n;
const list=async()=>(await (await districtMatchVerification(new Request(url+'pp-verify-match.php?status=pending&per_page=100',
  {headers:{Cookie:ppCookie}}),env)).json()).matches;
const flagged=async(groupId)=>(await list()).find(match=>match.match_group_id===groupId).pertindihan;
const decide=(groupId,body)=>districtMatchVerification(new Request(url+'pp-verify-match.php',{method:'POST',
  headers:{Cookie:ppCookie,'Content-Type':'application/json'},body:JSON.stringify({match_group_id:groupId,...body})}),env);
const statusOf=(groupId)=>db.prepare('SELECT DISTINCT status_pp,catatan_pp FROM perlawanan WHERE match_group_id=?').all(groupId);

try {
  // Without Pengadil, Penolong Pengadil 1 and 2 the match cannot be recorded.
  const before=rows();
  for (const [officials,missing] of [
    [[[a,'Pengadil'],[b,'Penolong Pengadil 1']],['Penolong Pengadil 2']],
    [[[a,'Pengadil'],[b,'Penolong Pengadil 1'],[c,'Pengadil Ke-4']],['Penolong Pengadil 2']],
    [[[a,'Penolong Pengadil 1'],[b,'Penolong Pengadil 2']],['Pengadil']],
    [[],['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2']],
  ]) {
    const short=await send(a,{officials});
    assert.equal(short.status,400,JSON.stringify(short.body));
    assert.deepEqual(short.body.missing_positions,missing);
    assert.match(short.body.message,/tidak layak direkodkan/);
  }
  assert.equal(rows(),before,'nothing saved for an incomplete crew');

  const first=await record(a,{officials:crewOf(a,b,c)});
  assert.deepEqual(first.pertindihan,[]);

  // The same date and teams is the same match whatever the venue, time, tournament
  // or crew: refused outright, naming the existing record.
  const saved=rows();
  const again=await send(d,{officials:crewOf(d,e,f),masa:'17:00',tempat:'Std. Darulmakmur',
    kejohanan:'LIGA DAERAH KUANTAN',home:'PEKAN F.C.',away:'kuantan  fa '});
  assert.equal(again.status,409,JSON.stringify(again.body));
  assert.match(again.body.message,/^Rekod tidak diterima kerana perlawanan ini sudah direkodkan oleh /);
  assert.ok(again.body.message.includes(nameOf(a)),'names who recorded it');
  assert.ok(again.body.message.includes(`${nameOf(b)} (Penolong Pengadil 1)`),'lists its officials');
  assert.match(again.body.message,/Rekod sedia ada: Kuantan FA lwn Pekan FC, [0-9/]+ jam 16:00 di Stadium Darul Makmur\./);
  assert.match(again.body.message,/hubungi .+ atau PP Daerah untuk pembetulan/);
  assert.equal(again.body.duplicate.sumber,'Rekod pengadil');
  assert.equal(again.body.duplicate.pegawai.length,3);
  // An official already in the record is told no action is needed.
  const listed=await send(b,{officials:crewOf(b,a,c),masa:''});
  assert.equal(listed.status,409);
  assert.match(listed.body.message,/Anda sudah tersenarai dalam rekod tersebut/);
  assert.equal(rows(),saved,'duplicates are not saved');

  // An official recorded at another match at the same time clashes; it is saved for review.
  const elsewhere=await record(d,{officials:crewOf(d,a,e),tempat:'Padang MPK',home:'Bera FC',away:'Rompin FC'});
  assert.equal(elsewhere.pertindihan.length,1);
  assert.equal(elsewhere.pertindihan[0].jenis,'bertembung');
  assert.deepEqual(elsewhere.pertindihan[0].pegawai_sama,[nameOf(a)]);
  assert.match(elsewhere.message,/Pegawai bertembung/);
  assert.equal((await flagged(first.match_group_id))[0].jenis,'bertembung');

  // Verification is blocked until the review is confirmed with a note.
  let response=await decide(elsewhere.match_group_id,{action:'verify'});
  assert.equal(response.status,409);
  assert.equal((await response.json()).pertindihan[0].jenis,'bertembung');
  response=await decide(elsewhere.match_group_id,{action:'verify',sahkan_pertindihan:true,notes:''});
  assert.equal(response.status,409);
  assert.deepEqual(statusOf(elsewhere.match_group_id).map(row=>row.status_pp),['Belum Disahkan']);
  response=await decide(elsewhere.match_group_id,{action:'verify',sahkan_pertindihan:true,notes:'Masa sebenar 18:00'});
  assert.equal(response.status,200);
  assert.deepEqual({...statusOf(elsewhere.match_group_id)[0]},
    {status_pp:'Disahkan',catatan_pp:'Semakan pertindihan: Masa sebenar 18:00'});
  // A record without doubt is verified as before.
  const clean=await record(c,{officials:crewOf(c,e,f),masa:'09:00',tempat:'Padang MPK',home:'Raub FC',away:'Lipis FC'});
  assert.deepEqual(clean.pertindihan,[]);
  assert.equal((await decide(clean.match_group_id,{action:'verify'})).status,200);

  // A rejected record no longer blocks the same match: the corrected record is accepted.
  assert.equal((await decide(first.match_group_id,{action:'reject',notes:'Salah tempat'})).status,200);
  const corrected=await record(b,{officials:crewOf(a,b,c),tempat:'Padang Majlis Kuantan'});
  assert.ok(corrected.match_group_id);

  // A match already on record through an official appointment is refused too.
  db.prepare(`INSERT INTO perlawanan(user_id,lantikan_id,tarikh,masa,jenis,tempat,home_team,away_team,jawatan,status_pp)
    VALUES(?,?,?,'20:30','Liga','Stadium Temerloh','Temerloh FC','Jerantut FC','Pengadil','Disahkan')`).run(f,999001,today);
  const appointed=await send(e,{officials:crewOf(e,d,c),masa:'',home:'jerantut fc',away:'TEMERLOH FC'});
  assert.equal(appointed.status,409,JSON.stringify(appointed.body));
  assert.match(appointed.body.message,/sudah direkodkan melalui lantikan rasmi\./);
  assert.equal(appointed.body.duplicate.sumber,'Lantikan rasmi');

  // Untimed: several matches by the same crew at a venue are normal.
  const untimed={officials:crewOf(c,e,f),masa:'',tempat:'Padang Bandar'};
  await record(c,{...untimed,home:'Maran FC',away:'Jerantut FC'});
  const next=await record(c,{...untimed,home:'Temerloh FC',away:'Bentong FC'});
  assert.deepEqual(next.pertindihan,[]);
  assert.equal((await send(e,{...untimed,home:'Jerantut FC',away:'Maran FC',kejohanan:'Karnival'})).status,409);

  // Only the four match officials are recorded: no RA position and no fifth official.
  const attempt=async(officials)=>(await refereeMatchManage(new Request(url+'pengadil-match-manage.php',{method:'POST',
    headers:{Cookie:cookies[a],'Content-Type':'application/json'},
    body:JSON.stringify({action:'add',tarikh:today,masa:'20:00',jenis:'Liga',tempat:'Padang Uji',home_team:'Uji A',
      away_team:'Uji B',daerah_perlawanan_id:district,officials:officials.map(([user_id,jawatan])=>({user_id,jawatan}))})}),env));
  for (const jawatan of ['Penilai Pengadil','Pengadil Ke-5']) {
    const refused=await attempt([[a,jawatan]]);
    assert.equal(refused.status,400);
    assert.match((await refused.json()).message,/Jawatan mesti Pengadil/);
  }
  const five=await attempt([...crewOf(a,b,c),[d,'Pengadil Ke-4'],[e,'Pengadil']]);
  assert.equal(five.status,400);
  const fourth=await attempt([...crewOf(a,b,c),[d,'pegawai ke4']]);
  assert.equal(fourth.status,200);
  const crew4=(await fourth.json()).match_group_id;
  assert.deepEqual(db.prepare('SELECT jawatan FROM perlawanan WHERE match_group_id=? ORDER BY jawatan').all(crew4)
    .map(row=>row.jawatan),['Pengadil','Pengadil Ke-4','Penolong Pengadil 1','Penolong Pengadil 2']);
  // A match record is for a match already played: no date after today (KL).
  const tomorrow=new Date(Date.parse(`${today}T00:00:00Z`)+86400000).toISOString().slice(0,10);
  const future=await refereeMatchManage(new Request(url+'pengadil-match-manage.php',{method:'POST',
    headers:{Cookie:cookies[a],'Content-Type':'application/json'},
    body:JSON.stringify({action:'add',tarikh:tomorrow,masa:'20:00',jenis:'Liga',tempat:'Padang Masa Depan',home_team:'Esok A',
      away_team:'Esok B',daerah_perlawanan_id:district,officials:crewOf(a,b,c).map(([user_id,jawatan])=>({user_id,jawatan}))})}),env);
  assert.equal(future.status,400);
  assert.match((await future.json()).message,/belum berlangsung/);
  const own=db.prepare(`INSERT INTO perlawanan(user_id,submitted_by,tarikh,jenis,tempat,home_team,away_team,jawatan)
    VALUES(?,?,?,'Liga','Padang Sunting','Sunting A','Sunting B','Pengadil')`).run(a,a,today).lastInsertRowid;
  const moved=await refereeMatchManage(new Request(url+'pengadil-match-manage.php',{method:'POST',
    headers:{Cookie:cookies[a],'Content-Type':'application/json'},
    body:JSON.stringify({action:'edit',match_id:Number(own),tarikh:tomorrow})}),env);
  assert.equal(moved.status,400);
  console.log('match records: full crew required; duplicates refused with notice; clashes flagged and verified after a noted review; future dates refused');
} finally {
  close();
}
