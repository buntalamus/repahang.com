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
  for(const query of ['year=abc','date_from=2031-02-30','date_from=2031-06-01&date_to=2031-05-01']) assert.equal((await call(query)).status,422);
  assert.equal((await adminMatches(new Request('https://refpahang.com/api/admin-matches.php'),env)).status,401);
  console.log('admin match filters: global search, full crews, combined filters, SQL pagination, counters and validation passed');
} finally {close();}
