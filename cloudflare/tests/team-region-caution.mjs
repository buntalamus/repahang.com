import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {schedule,scheduleUpload,scheduleReport,adminAppointments,teamRegionCaution}=await bundle(`
  export {schedule} from '../src/schedule';
  export {scheduleUpload} from '../src/schedule-upload';
  export {scheduleReport} from '../src/schedule-report';
  export {adminAppointments} from '../src/admin-appointments';
  export {teamRegionCaution} from '../../frontend/src/app/features/admin/lantikan-pengadil/team-region-caution';
`);
const match={pasukan_home:'Kelab A',pasukan_away:'Kelab B',
  pasukan_home_daerah:'Kuantan',pasukan_home_negeri:'Pahang',
  pasukan_away_daerah:'Temerloh',pasukan_away_negeri:'Pahang'};
const local={daerah:'Kuantan',negeri:'Pahang'};
assert.match(teamRegionCaution(local,match,'Negeri'),/Daerah Kuantan sama dengan Kelab A/);
assert.doesNotMatch(teamRegionCaution(local,match,'Negeri'),/Kelab B/);
assert.match(teamRegionCaution(local,match,'Daerah'),/Kelab A/);
assert.match(teamRegionCaution(local,match,'Kebangsaan'),/Negeri Pahang.*Kelab A;.*Kelab B/);
assert.equal(teamRegionCaution({daerah:'Bera',negeri:'Pahang'},match,'Negeri'),'');
assert.equal(teamRegionCaution({daerah:'Kuantan',negeri:'Selangor'},match,'Negeri'),'');
assert.match(teamRegionCaution({daerah:'  KUANTAN ',negeri:' pahang '},match,'Negeri'),/Kelab A/);
assert.equal(teamRegionCaution({daerah:'Kuan',negeri:'Pahang'},match,'Negeri'),'');
assert.equal(teamRegionCaution(local,{pasukan_home:'Kuantan FC'},'Negeri'),'','Names never infer origin');
assert.equal(teamRegionCaution({daerah:'-',negeri:''},match,'Negeri'),'');
assert.equal(teamRegionCaution(local,null,'Negeri'),'');
assert.equal(teamRegionCaution(null,match,'Negeri'),'');
assert.equal(teamRegionCaution(local,match,'Asia'),'','No invented rule for other levels');
assert.match(teamRegionCaution({daerah:'Temerloh',negeri:'Pahang'},match,'Negeri'),/Kelab B/);

const {db,DB,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers','0020_match_team_regions','0022_district_appointments']);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'0'};
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const referee=db.prepare("SELECT id,daerah,negeri FROM users WHERE role='Pengadil' AND aktif=1 AND trim(daerah)<>'' LIMIT 1").get();
const external=db.prepare("SELECT id,daerah,negeri FROM pengadil_luar WHERE trim(negeri)<>'' LIMIT 1").get();
const adminCookie=await sessionCookie(db,admin.id);
const refereeCookie=await sessionCookie(db,referee.id);
const countBefore=db.prepare('SELECT count(*) AS n FROM lantikan_pengadil').get().n;
const call=(fn,file,method='GET',body,cookie=adminCookie)=>fn(new Request(`https://refpahang.test/api/${file}`,{
  method,headers:{Cookie:cookie,'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
}),env);
const read=async(response)=>({status:response.status,...await response.json()});
const fields=['pasukan_home_daerah','pasukan_home_negeri','pasukan_away_daerah','pasukan_away_negeri'];
const fixture={no_perlawanan:'TEST-01',tarikh:'2099-01-01',masa:'20:00',kategori:'B18',
  peringkat:'Kumpulan',kumpulan:'A',tempat:'Padang Ujian',...match};
try {
  assert.equal(db.prepare("SELECT count(*) AS n FROM jadual_perlawanan WHERE pasukan_home_daerah<>'' OR pasukan_home_negeri<>''").get().n,0,
    'Migration leaves historical origins unknown');
  const tournament=db.prepare(`INSERT INTO kejohanan(nama,peringkat_kejohanan,tarikh_mula,tarikh_akhir)
    VALUES('UJIAN WILAYAH','Negeri','2099-01-01','2099-01-02')`).run();
  const kejohanan_id=Number(tournament.lastInsertRowid);
  assert.equal((await call(schedule,'jadual-perlawanan.php','POST',{kejohanan_id,...fixture},refereeCookie)).status,403);
  let response=await read(await call(schedule,'jadual-perlawanan.php','POST',{
    kejohanan_id,...fixture,pasukan_home_daerah:'  Kuantan  ',
  }));
  assert.equal(response.status,200,JSON.stringify(response));
  const id=response.id;
  let row=await read(await call(schedule,`jadual-perlawanan.php?id=${id}`));
  for(const field of fields) assert.equal(row.perlawanan[field],match[field]);
  response=await read(await call(schedule,'jadual-perlawanan.php','PUT',{
    id,...fixture,pasukan_home_daerah:'Bera',
  }));
  assert.equal(response.status,200,JSON.stringify(response));
  const legacy={id,...fixture};
  for(const field of fields) delete legacy[field];
  assert.equal((await call(schedule,'jadual-perlawanan.php','PUT',legacy)).status,200);
  assert.equal(db.prepare('SELECT pasukan_home_daerah AS daerah FROM jadual_perlawanan WHERE id=?').get(id).daerah,'Bera',
    'Older clients retain metadata they omit');
  assert.equal((await call(schedule,'jadual-perlawanan.php','PUT',{...legacy,pasukan_home_daerah:''})).status,200);
  assert.equal(db.prepare('SELECT pasukan_home_daerah AS daerah FROM jadual_perlawanan WHERE id=?').get(id).daerah,'');
  for(const invalid of [42,{},'x'.repeat(256)]) {
    assert.equal((await call(schedule,'jadual-perlawanan.php','PUT',{id,...fixture,pasukan_home_daerah:invalid})).status,400);
  }
  // Both registered and external assignment origins are available, including
  // officials no longer in the pool. Existing appointment rules are unchanged.
  db.prepare("INSERT INTO lantikan_pengadil(jadual_id,pengadil_id,jawatan) VALUES(?,?,'Pengadil')").run(id,referee.id);
  db.prepare("INSERT INTO lantikan_pengadil(jadual_id,pengadil_luar_id,jawatan) VALUES(?,?,'Penilai Pengadil')").run(id,external.id);
  const assignments=await read(await call(adminAppointments,`lantikan.php?jadual_id=${id}`));
  assert.equal(assignments.status,200,JSON.stringify(assignments));
  assert.equal(assignments.data.find(a=>a.pengadil_id===referee.id).daerah,referee.daerah);
  assert.equal(assignments.data.find(a=>a.pengadil_luar_id===external.id).negeri,external.negeri);
  const report=await read(await call(scheduleReport,`jadual-lantikan-report.php?kejohanan_id=${kejohanan_id}`));
  assert.equal(report.status,200,JSON.stringify(report));
  assert.equal(report.jadual[0].pasukan_away_daerah,'Temerloh');
  assert.equal(report.jadual[0].assignments.Pengadil.daerah,referee.daerah);
  const upload=await read(await call(scheduleUpload,'jadual-upload.php','POST',{kejohanan_id,data:[
    {...fixture,no_perlawanan:'TEST-02'},
    {...legacy,no_perlawanan:'TEST-03'},
  ]}));
  assert.equal(upload.status,200,JSON.stringify(upload));
  assert.equal(upload.inserted,2);
  const imported=db.prepare("SELECT * FROM jadual_perlawanan WHERE kejohanan_id=? AND no_perlawanan='TEST-02'").get(kejohanan_id);
  for(const field of fields) assert.equal(imported[field],fixture[field]);
  const oldImport=db.prepare("SELECT * FROM jadual_perlawanan WHERE kejohanan_id=? AND no_perlawanan='TEST-03'").get(kejohanan_id);
  for(const field of fields) assert.equal(oldImport[field],'');
  const invalidUpload=await read(await call(scheduleUpload,'jadual-upload.php','POST',{
    kejohanan_id,data:[{...fixture,pasukan_home_daerah:{name:'Kuantan'}}],
  }));
  assert.equal(invalidUpload.inserted,0);
  assert.equal(invalidUpload.skipped,1);
  assert.equal((await call(schedule,'jadual-perlawanan.php','PUT',{...legacy,pasukan_home:'Kelab C'})).status,200);
  const renamed=db.prepare('SELECT * FROM jadual_perlawanan WHERE id=?').get(id);
  assert.equal(renamed.pasukan_home_negeri,'','Replacing a team without origins must not retain the old affiliation');
  assert.equal(renamed.pasukan_away_negeri,'Pahang','Other team is unaffected');
  assert.equal(db.prepare('SELECT count(*) AS n FROM lantikan_pengadil').get().n,countBefore+2);
  console.log('team regions: tier matching, no false state/district/name matches, migration, CRUD, legacy compatibility, import and both assignment sources passed');
} finally {close();}
