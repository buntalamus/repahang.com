import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';
const {adminMatches}=await bundle("export {adminMatches} from '../src/admin-matches';");
const {db,DB,close}=openDatabase([]);
try {
  const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
  const officials=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 3").all();
  const cookie=await sessionCookie(db,admin.id);
  const env={DB,STAGING_AUTH_ENABLED:'1'};
  const call=async(query='')=>{
    const r=await adminMatches(new Request(`https://refpahang.com/api/admin-matches.php?${query}`,{headers:{Cookie:cookie}}),env);
    return {status:r.status,body:await r.json()};
  };
  db.prepare("UPDATE users SET nama_penuh='QA UNIK FILTER 8031' WHERE id=?").run(officials[1].id);
  const add=(id,group,date,home,kind,tournament,status,user)=>db.prepare(`INSERT INTO perlawanan
    (id,user_id,match_group_id,tarikh,home_team,away_team,jenis,nama_kejohanan,tempat,jawatan,status_pp,daerah_perlawanan_id)
    VALUES(?,?,?,?,?,'QA AWAY',?,?,?,'Pengadil',?,1)`)
    .run(id,user,group,date,home,kind,tournament,'QA STADIUM',status);
  add(990001,'QA-FILTER-GROUP','2031-05-10','QA HOME','QA Liga','QA Piala','Disahkan',officials[0].id);
  add(990002,'QA-FILTER-GROUP','2031-05-10','QA HOME','QA Liga','QA Piala','Disahkan',officials[1].id);
  add(990003,null,'2031-06-10','QA LAIN','QA Friendly','QA Persahabatan','Belum Disahkan',officials[2].id);
  let r=await call('year=2031&per_page=1');
  assert.equal(r.status,200);assert.equal(r.body.pagination.total_items,2);assert.equal(r.body.matches.length,1);
  const page1=r.body.matches[0].id;
  r=await call('year=2031&per_page=1&page=2');assert.notEqual(r.body.matches[0].id,page1);
  r=await call('year=2031&search=QA+UNIK+FILTER+8031&per_page=1');
  assert.equal(r.body.pagination.total_items,1);assert.equal(r.body.matches[0].officials.length,2,'search keeps full crew');
  assert.equal(r.body.matches[0].id,990001);
  r=await call('year=2031&jenis=QA+Liga&nama_kejohanan=QA+Piala&daerah_id=1&status=verified&date_from=2031-05-01&date_to=2031-05-31');
  assert.equal(r.body.matches.length,1);assert.equal(r.body.statistics.total,1);assert.equal(r.body.statistics.verified,1);
  assert.ok(r.body.filters.years.includes('2031'));assert.ok(r.body.filters.tournaments.includes('QA Piala'));
  r=await call('year=2031&status=pending');assert.equal(r.body.matches.length,1);assert.equal(r.body.statistics.total,2,'status counters respect other filters');
  r=await call('year=2031&search=%25');assert.equal(r.body.pagination.total_items,0,'literal SQL wildcard');
  r=await call('year=2031&page=999999');assert.equal(r.body.pagination.page,1);
  // Doubtful: waiting records that duplicate (same date and teams, any venue,
  // time or crew) or clash (shared official at the same time) with another record.
  const legacy=(id,group,date,masa,home,away,venue,status,user)=>db.prepare(`INSERT INTO perlawanan
    (id,user_id,match_group_id,tarikh,masa,home_team,away_team,jenis,tempat,jawatan,status_pp,daerah_perlawanan_id)
    VALUES(?,?,?,?,?,?,?,'QA Liga',?,'Pengadil',?,1)`).run(id,user,group,date,masa,home,away,venue,status);
  legacy(990101,'QA-DUP-A','2032-03-01','17:00','Alwosto','PIBG C.P.','Padang Caruk Puting','Disahkan',officials[0].id);
  legacy(990102,'QA-DUP-B','2032-03-01','17:30','pibg cp','ALWOSTO','Padang Kg Charuk Puting','Belum Disahkan',officials[1].id);
  legacy(990103,'QA-CLASH','2032-03-01','17:30','Bera FC','Rompin FC','Padang MPK',null,officials[1].id);
  legacy(990104,'QA-CLEAN','2032-03-01','17:30','Raub FC','Lipis FC','Padang Milo','Belum Disahkan',officials[2].id);
  legacy(990105,'QA-OLD-REJECT','2032-03-02','09:00','Maran FC','Jerantut FC','Padang A','Tidak Disahkan',officials[0].id);
  legacy(990106,'QA-AFTER-REJECT','2032-03-02','10:00','Jerantut FC','Maran FC','Padang B','Belum Disahkan',officials[2].id);
  r=await call('year=2032');
  assert.equal(r.body.statistics.doubtful,2,'duplicate and clash are counted; rejected records do not count');
  r=await call('year=2032&status=doubtful');
  assert.equal(r.status,200);
  const doubtful=Object.fromEntries(r.body.matches.map(m=>[m.match_group_id,m.pertindihan]));
  assert.deepEqual(Object.keys(doubtful).sort(),['QA-CLASH','QA-DUP-B']);
  assert.equal(doubtful['QA-DUP-B'].find(c=>c.jenis==='berganda').status_pp,'Disahkan');
  assert.deepEqual(doubtful['QA-DUP-B'].map(c=>c.jenis).sort(),['berganda','bertembung']);
  assert.deepEqual(doubtful['QA-CLASH'].map(c=>c.jenis),['bertembung']);
  assert.equal(r.body.pagination.total_items,2);
  r=await call('year=2032&status=pending');
  assert.deepEqual(r.body.matches.find(m=>m.match_group_id==='QA-CLEAN').pertindihan,[]);
  assert.equal(r.body.matches.find(m=>m.match_group_id==='QA-DUP-B').pertindihan.length,2,'pending list shows the flags too');
  r=await call('year=2032&status=doubtful&search=Rompin');
  assert.deepEqual(r.body.matches.map(m=>m.match_group_id),['QA-CLASH'],'doubtful combines with other filters');
  for(const query of ['year=abc','date_from=2031-02-30','date_from=2031-06-01&date_to=2031-05-01']) assert.equal((await call(query)).status,422);
  assert.equal((await adminMatches(new Request('https://refpahang.com/api/admin-matches.php'),env)).status,401);
  console.log('admin match filters: global search, full crews, combined filters, SQL pagination, counters and validation passed');
} finally {close();}
