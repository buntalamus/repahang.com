import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

// Self-recorded matches: a record sharing an official at the same date and
// time, or an untimed full duplicate, is doubtful. The PP Daerah may verify it
// only after confirming the review with a note.
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
const ppCookie=await sessionCookie(db,pp);
const cookies=Object.fromEntries(await Promise.all([a,b,c].map(async id=>[id,await sessionCookie(db,id)])));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

async function record(by,{officials,masa='16:00',tempat='Stadium Darul Makmur',home='Kuantan FA',away='Pekan FC',kejohanan='Liga Daerah'}) {
  const response=await refereeMatchManage(new Request(url+'pengadil-match-manage.php',{method:'POST',
    headers:{Cookie:cookies[by],'Content-Type':'application/json'},
    body:JSON.stringify({action:'add',tarikh:today,masa,jenis:'Liga',nama_kejohanan:kejohanan,tempat,
      home_team:home,away_team:away,daerah_perlawanan_id:district,
      officials:officials.map(([user_id,jawatan])=>({user_id,jawatan}))})}),env);
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  return body;
}
const list=async()=>(await (await districtMatchVerification(new Request(url+'pp-verify-match.php?status=pending&per_page=100',
  {headers:{Cookie:ppCookie}}),env)).json()).matches;
const flagged=async(groupId)=>(await list()).find(match=>match.match_group_id===groupId).pertindihan;
const decide=(groupId,body)=>districtMatchVerification(new Request(url+'pp-verify-match.php',{method:'POST',
  headers:{Cookie:ppCookie,'Content-Type':'application/json'},body:JSON.stringify({match_group_id:groupId,...body})}),env);
const statusOf=(groupId)=>db.prepare('SELECT DISTINCT status_pp,catatan_pp FROM perlawanan WHERE match_group_id=?').all(groupId);

try {
  const crew=[[a,'Pengadil'],[b,'Penolong Pengadil 1']];
  const first=await record(a,{officials:crew});
  assert.deepEqual(first.pertindihan,[]);

  // The same match entered again with the tournament spelt differently is a likely duplicate.
  const again=await record(b,{officials:crew,kejohanan:'LIGA DAERAH KUANTAN',home:'kuantan fa ',away:'PEKAN FC'});
  assert.equal(again.pertindihan.length,1);
  assert.equal(again.pertindihan[0].jenis,'berganda');
  assert.equal(again.pertindihan[0].sumber,'Rekod pengadil');
  assert.match(again.message,/Kemungkinan rekod berganda/);
  assert.equal((await flagged(first.match_group_id))[0].jenis,'berganda');

  // An official recorded at another venue at the same time clashes.
  const elsewhere=await record(c,{officials:[[c,'Pengadil'],[a,'Penolong Pengadil 1']],tempat:'Padang MPK',home:'Bera FC',away:'Rompin FC'});
  // Official A already has two records at 16:00: the original and its duplicate.
  assert.equal(elsewhere.pertindihan.length,2);
  assert.ok(elsewhere.pertindihan.every(item=>item.jenis==='bertembung'));
  assert.deepEqual(elsewhere.pertindihan[0].pegawai_sama,
    [db.prepare('SELECT nama_penuh FROM users WHERE id=?').get(a).nama_penuh]);

  // Verification is blocked until the review is confirmed with a note.
  let response=await decide(again.match_group_id,{action:'verify'});
  assert.equal(response.status,409);
  assert.equal((await response.json()).pertindihan[0].jenis,'berganda');
  response=await decide(again.match_group_id,{action:'verify',sahkan_pertindihan:true,notes:''});
  assert.equal(response.status,409);
  assert.deepEqual(statusOf(again.match_group_id).map(row=>row.status_pp),['Belum Disahkan']);
  response=await decide(again.match_group_id,{action:'verify',sahkan_pertindihan:true,notes:'Dua perlawanan berasingan, padang A dan B'});
  assert.equal(response.status,200);
  assert.deepEqual({...statusOf(again.match_group_id)[0]},
    {status_pp:'Disahkan',catatan_pp:'Semakan pertindihan: Dua perlawanan berasingan, padang A dan B'});
  // A record without doubt is verified as before.
  const clean=await record(c,{officials:[[c,'Pengadil']],masa:'09:00',tempat:'Padang MPK',home:'Raub FC',away:'Lipis FC'});
  assert.equal((await decide(clean.match_group_id,{action:'verify'})).status,200);

  // A rejected record no longer counts against others.
  assert.equal((await decide(elsewhere.match_group_id,{action:'reject',notes:'Salah masa'})).status,200);
  assert.ok(!(await flagged(first.match_group_id)).some(item=>item.jenis==='bertembung'));

  // Untimed: several matches by the same crew at a venue are normal; only a full duplicate is doubtful.
  const untimed={officials:[[c,'Pengadil']],masa:'',tempat:'Padang Bandar'};
  const opening=await record(c,{...untimed,home:'Maran FC',away:'Jerantut FC'});
  const next=await record(c,{...untimed,home:'Temerloh FC',away:'Bentong FC'});
  assert.deepEqual(next.pertindihan,[]);
  const reversed=await record(c,{...untimed,home:'Jerantut FC',away:'Maran FC',kejohanan:'Karnival'});
  assert.equal(reversed.pertindihan.length,1);
  assert.equal(reversed.pertindihan[0].jenis,'berganda');
  assert.equal((await flagged(opening.match_group_id)).length,1);
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
  const fourth=await attempt([[a,'Pengadil'],[b,'pegawai ke4']]);
  assert.equal(fourth.status,200);
  const saved=(await fourth.json()).match_group_id;
  assert.deepEqual(db.prepare('SELECT jawatan FROM perlawanan WHERE match_group_id=? ORDER BY jawatan').all(saved)
    .map(row=>row.jawatan),['Pengadil','Pengadil Ke-4']);
  const five=await attempt([[a,'Pengadil'],[b,'Penolong Pengadil 1'],[c,'Penolong Pengadil 2'],[96,'Pengadil Ke-4'],[97,'Pengadil']]);
  assert.equal(five.status,400);
  // A match record is for a match already played: no date after today (KL).
  const tomorrow=new Date(Date.parse(`${today}T00:00:00Z`)+86400000).toISOString().slice(0,10);
  const future=await refereeMatchManage(new Request(url+'pengadil-match-manage.php',{method:'POST',
    headers:{Cookie:cookies[a],'Content-Type':'application/json'},
    body:JSON.stringify({action:'add',tarikh:tomorrow,masa:'20:00',jenis:'Liga',tempat:'Padang Masa Depan',home_team:'Esok A',
      away_team:'Esok B',daerah_perlawanan_id:district,officials:[{user_id:a,jawatan:'Pengadil'}]})}),env);
  assert.equal(future.status,400);
  assert.match((await future.json()).message,/belum berlangsung/);
  const own=db.prepare(`INSERT INTO perlawanan(user_id,submitted_by,tarikh,jenis,tempat,home_team,away_team,jawatan)
    VALUES(?,?,?,'Liga','Padang Sunting','Sunting A','Sunting B','Pengadil')`).run(a,a,today).lastInsertRowid;
  const moved=await refereeMatchManage(new Request(url+'pengadil-match-manage.php',{method:'POST',
    headers:{Cookie:cookies[a],'Content-Type':'application/json'},
    body:JSON.stringify({action:'edit',match_id:Number(own),tarikh:tomorrow})}),env);
  assert.equal(moved.status,400);
  console.log('match conflicts: duplicates and clashes flagged; PP verifies only after a noted review; future dates refused');
} finally {
  close();
}
