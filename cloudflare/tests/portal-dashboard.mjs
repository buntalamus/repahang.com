import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';
const {portalDashboard,refereeMatches,districtMatchVerification}=await bundle("export {portalDashboard} from '../src/portal-dashboard'; export {refereeMatches} from '../src/referee'; export {districtMatchVerification} from '../src/district-match-verification';");
const {db,DB,close}=openDatabase(['0019_annual_seminar_attendance','0022_district_appointments']);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'0'};
let checks=0;
const check=(value,expected,label)=>{assert.deepEqual(value,expected,label);checks++;};
const add=(sql,...params)=>Number(db.prepare(sql).run(...params).lastInsertRowid);
try {
  db.exec("UPDATE jadual_perlawanan SET tarikh='2000-01-01'");
  const pids=db.prepare('SELECT id FROM persatuan_bolasepak_daerah ORDER BY id LIMIT 2').all().map(r=>r.id);
  const create=(name,role,type,pid)=>add(`INSERT INTO users(email,password,role,nama_penuh,aktif,password_changed,jenis_pengadil,persatuan_id)
    VALUES(?,'unused',?,?,1,1,?,?)`,name+'@example.invalid',role,name,type,pid);
  const pp=create('Audit PP','PP Daerah','Penilai Pengadil',pids[0]);
  const ref=create('Audit Ref','Pengadil','Pengadil Negeri',pids[0]);
  const other=create('Other Ref','Pengadil','Pengadil Negeri',pids[1]);
  const ra=create('Audit RA','Penilai','Penilai Pengadil',pids[0]);
  const k=add("INSERT INTO kejohanan(nama,jenis_kejohanan,status,lantikan_persatuan_id,tarikh_mula,tarikh_akhir) VALUES('Audit','Liga','Aktif',?,'2090-01-01','2090-12-31')",pids[0]);
  const match=(num,pid=pids[0])=>add(`INSERT INTO jadual_perlawanan(kejohanan_id,no_perlawanan,tarikh,masa,pasukan_home,pasukan_away,tempat,status)
    VALUES(?,?,'2090-01-01','17:00','Home','Away','Field','Disahkan')`,k,String(num));
  const appointment=(jid,uid,position,status='Diterima')=>add(`INSERT INTO lantikan_pengadil(jadual_id,pengadil_id,jawatan,status,notif_hantar)
    VALUES(?,?,?,?,1)`,jid,uid,position,status);
  const j1=match(1),j2=match(2),j3=match(3),j4=match(4);
  const a1=appointment(j1,ra,'Penilai Pengadil'),a2=appointment(j2,ra,'Penilai Pengadil'),a3=appointment(j3,ra,'Penilai Pengadil');
  appointment(j4,ra,'Penilai Pengadil','Belum Jawab');
  const kup=appointment(j1,ref,'Pengadil');
  const report=(jid,aid,status)=>add('INSERT INTO laporan_penilaian(jadual_id,lantikan_id,penilai_id,status) VALUES(?,?,?,?)',jid,aid,ra,status);
  const confirmed=report(j1,a1,'Disahkan');report(j2,a2,'Dihantar');
  for(const name of ['One spelling','Different spelling']) add(`INSERT INTO laporan_penilaian_pegawai(laporan_id,lantikan_pengadil_id,jawatan,nama_pengadil,markah)
    VALUES(?,?,'Pengadil',?,'8.0')`,confirmed,kup,name);
  add("INSERT INTO laporan_penilaian_pegawai(laporan_id,jawatan,nama_pengadil,markah) VALUES(?,'Penolong Pengadil 1','Legacy without identity','8.0')",confirmed);
  for(const [date,status]of [['2090-01-01','Disahkan'],['2090-02-01','Belum Disahkan'],['2090-03-01','Tidak Disahkan'],['2089-01-01','Tidak Disahkan']]) {
    add('INSERT INTO perlawanan(user_id,tarikh,status_pp,home_team,away_team) VALUES(?,?,?,\'Same Home\',\'Same Away\')',ref,date,status);
  }
  add("INSERT INTO perlawanan(user_id,tarikh,status_pp,home_team,away_team) VALUES(?,'2090-01-01','Tidak Disahkan','Other','District')",other);
  const cookies={pp:await sessionCookie(db,pp),ref:await sessionCookie(db,ref),ra:await sessionCookie(db,ra)};
  const request=(role,path)=>new Request('https://audit.example/api/'+path,{headers:{Cookie:cookies[role]}});
  const call=async(role,query)=>{const response=await portalDashboard(request(role,'portal-dashboard.php?year=2090&'+query),env);return {response,data:(await response.json()).data};};
  const raData=(await call('ra','view=ra')).data;
  check([raData.totals.accepted,raData.totals.confirmed,raData.totals.submitted,raData.totals.no_report,raData.totals.needs_report],[3,1,1,1,1],'submitted is not confirmed; missing report is an explicit relationship');
  check([raData.totals.assessed,raData.totals.unlinked],[1,1],'identity count survives spelling variations and separates unlinked legacy');
  check(raData.monthly[0].verified,1,'year-scoped confirmed report trend');
  check((await call('pp','view=ra')).response.status,200,'PP can use own RA dashboard');
  check((await call('ra','view=pp')).response.status,403,'RA cannot inspect district management');
  check((await call('ref','view=ra')).response.status,403,'referee without RA capability cannot inspect RA data');
  check((await call('pp','view=pengadil')).response.status,403,'PP role alone is not a referee qualification');
  const refData=(await call('ref','view=pengadil')).data;
  check([refData.totals.records,refData.totals.verified,refData.totals.pending,refData.totals.rejected],[3,1,1,1],'rejected is not pending and other years are excluded');
  const ppData=(await call('pp','view=pp')).data;
  check([ppData.totals.records,ppData.totals.legacy_records,ppData.totals.identified_matches],[3,3,0],'unlinked legacy rows are not silently merged on team names');
  check(new Set(ppData.upcoming.map(r=>r.id)).size,ppData.upcoming.length,'future schedule is one entry per match');
  const filtered=await refereeMatches(request('ref','pengadil-matches.php?year=2090&status=Tidak%20Disahkan'),env);
  const list=await filtered.json();check([list.pagination.total_items,list.matches.length,list.statistics.pending_year],[1,1,1],'action destination filters on server before pagination');
  check(list.statistics.all_time_total,4,'all-time total remains independent of year/status action filter');
  const ppList=await districtMatchVerification(request('pp','pp-match-verification.php?year=2090&status=pending'),env);
  const ppBody=await ppList.json();
  check([ppBody.pagination.total_items,ppBody.statistics.pending],[ppData.totals.pending_units,ppData.totals.pending_units],'district action and dashboard agree on year and pending units');
  check((await districtMatchVerification(request('pp','pp-match-verification.php?year=invalid'),env)).status,422,'district filter rejects invalid year');
  check((await portalDashboard(new Request('https://audit.example/api/portal-dashboard.php'),env)).status,401,'anonymous blocked');
  check((await portalDashboard(request('ref','portal-dashboard.php?year=2090%20OR%201=1'),env)).status,422,'invalid year blocked');
  check((await portalDashboard(request('ref','portal-dashboard.php?view=unknown'),env)).status,422,'invalid view blocked');
  console.log('Portal dashboards:',checks,'checks passed: role/capability scope, status partitions, stable identity, legacy units, year and action filters.');
}finally{close();}
