import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminUserMasterData,adminUsers}=await bundle(`
  export {adminUserMasterData} from '../src/user-master-data';
  export {adminUsers} from '../src/admin-users';
`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0019_annual_seminar_attendance']);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1'};
const endpoint='https://refpahang.example/api/admin-users-master-data.php';
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const adminCookie=await sessionCookie(db,admin.id);
const get=(cookie=adminCookie,query='')=>new Request(endpoint+query,{headers:{Cookie:cookie}});
try {
  assert.equal((await adminUserMasterData(get(''),env)).status,401);
  for(const role of ['Pengadil','PP Daerah','Penilai']){
    const row=db.prepare('SELECT id FROM users WHERE role=? AND aktif=1 LIMIT 1').get(role);
    assert.equal((await adminUserMasterData(get(await sessionCookie(db,row.id)),env)).status,403);
  }
  assert.equal((await adminUserMasterData(new Request(endpoint,{method:'POST'}),env)).status,405);
  assert.equal((await adminUserMasterData(get(adminCookie,'?year=2026x'),env)).status,422);
  let queries=0;
  const metered={...env,DB:{...DB,prepare(sql){queries++;return DB.prepare(sql);}}};
  const response=await adminUserMasterData(get(adminCookie,'?year=2026&search=nobody&role=Admin&page=99'),metered);
  assert.ok(queries<=40,`query budget exceeded: ${queries}`);
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  const result=await response.json();assert.equal(result.data.year,2026);
  const sheet=key=>result.data.sheets.find(sheet=>sheet.key===key);
  assert.equal(sheet('users').rows.length,db.prepare('SELECT COUNT(*) n FROM users').get().n);
  assert.equal(sheet('users').rows.filter(row=>row.aktif===0).length,db.prepare('SELECT COUNT(*) n FROM users WHERE aktif=0').get().n);
  const overview=(await (await adminUsers(new Request('https://refpahang.example/api/admin-users.php?year=2026',{headers:{Cookie:adminCookie}}),env)).json()).users;
  for(const row of sheet('users').rows){
    const original=overview.find(user=>user.id===row.id);
    for(const key of ['is_referee','is_ra','current_applied','current_approved','prior_approved','current_fitness_status','current_license','class3_passed','class1_passed']){
      assert.equal(row[key],original[key]??null,`${row.id}: ${key}`);
    }
  }
  for(const [key,table] of [['applications','permohonan'],['matches','perlawanan'],['reports','laporan_penilaian'],['report_officials','laporan_penilaian_pegawai']]){
    assert.equal(sheet(key).rows.length,db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n);
    assert.equal(new Set(sheet(key).rows.map(row=>row.id)).size,sheet(key).rows.length);
  }
  assert.equal(sheet('appointments').rows.length,db.prepare('SELECT COUNT(*) n FROM lantikan_pengadil WHERE pengadil_id IS NOT NULL').get().n);
  for(const item of result.data.sheets){
    assert.equal(new Set(item.columns.map(column=>column.key)).size,item.columns.length,`${item.key} column keys`);
    assert.equal(new Set(item.columns.map(column=>column.label)).size,item.columns.length,`${item.key} header labels`);
    assert.ok(item.columns.every(column=>column.label&&column.width>=12));
    assert.ok(!item.columns.some(column=>/password|token|worker_|claim/i.test(column.key)),item.key);
    for(const row of item.rows)assert.deepEqual(Object.keys(row).sort(),item.columns.map(column=>column.key).sort(),item.key);
  }
  // All stored profile/application fields are accounted for, apart from explicit auth metadata.
  const excluded={users:['password','tg_link_token','password_changed'],applications:[]};
  for(const [key,table] of [['users','users'],['applications','permohonan']]){
    const keys=new Set(sheet(key).columns.map(column=>column.key));
    const missing=db.prepare(`PRAGMA table_info(${table})`).all().map(column=>column.name).filter(name=>!keys.has(name)).sort();
    assert.deepEqual(missing,excluded[key].sort(),`${key}: source field coverage`);
  }
  // IDs and original text survive the JSON payload, rather than being converted to numbers/formulas.
  const target=sheet('users').rows[0].id;
  db.prepare('UPDATE users SET no_ic=?,no_telefon=?,poskod=?,nama_penuh=? WHERE id=?')
    .run('001234567890','0123456789','00001','=HYPERLINK("https://invalid.test","test")',target);
  const raw=await (await adminUserMasterData(get(adminCookie,'?year=2026'),env)).json();
  const updated=raw.data.sheets[0].rows.find(row=>row.id===target);
  assert.equal(updated.no_ic,'001234567890');assert.equal(updated.no_telefon,'0123456789');assert.equal(updated.poskod,'00001');
  assert.ok(updated.nama_penuh.startsWith('='));
  console.log(`Master data: Admin isolation, all ${sheet('users').rows.length} users, inactive/filter independence, historical counts, annual parity, allowlist and identity fidelity passed`);
} finally {close();}
