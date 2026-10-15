import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const source=readFileSync(new URL('../src/admin-appointments.ts',import.meta.url),'utf8')
  .replace("import {currentUser,json} from './auth';",`
    const currentUser=async()=>globalThis.appointmentUser;
    const json=(body,status=200)=>Response.json(body,{status});`)
  .replace("import {adminAppointmentCreate} from './admin-appointment-create';",
    'const adminAppointmentCreate=async()=>Response.json({error:true},{status:503});');
const compiled=ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const {adminAppointments}=await import(`data:text/javascript,${encodeURIComponent(compiled)}`);
const db=new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE kejohanan(id INTEGER PRIMARY KEY,peringkat_kejohanan TEXT);
  CREATE TABLE jadual_perlawanan(id INTEGER PRIMARY KEY,kejohanan_id INTEGER);
  CREATE TABLE users(id INTEGER PRIMARY KEY,nama_penuh TEXT,no_telefon TEXT,email TEXT,
    jenis_pengadil TEXT,daerah TEXT,negeri TEXT,telegram_chat_id INTEGER);
  CREATE TABLE pengadil_luar(id INTEGER PRIMARY KEY,nama TEXT,no_tel TEXT,emel TEXT,
    jenis_pengadil TEXT,daerah TEXT,negeri TEXT,telegram_chat_id INTEGER);
  CREATE TABLE lantikan_pengadil(id INTEGER PRIMARY KEY,jadual_id INTEGER,jawatan TEXT,
    status TEXT,komen TEXT,tarikh_jawab TEXT,notif_hantar INTEGER,tg_notif_hantar INTEGER,
    tarikh_notif TEXT,created_at TEXT,pengadil_id INTEGER,pengadil_luar_id INTEGER);
  CREATE TABLE pool_pengadil(id INTEGER PRIMARY KEY,kejohanan_id INTEGER,
    pengadil_id INTEGER,pengadil_luar_id INTEGER);
  INSERT INTO kejohanan VALUES(7,'Negeri');
  INSERT INTO jadual_perlawanan VALUES(10,7),(11,7);
  INSERT INTO users VALUES(3,'Ahmad','011','a@example.test','Pengadil','Bera','Pahang',NULL);
  INSERT INTO pengadil_luar VALUES(8,'Zain','012',NULL,'Penilai Pengadil','Kuantan','Pahang',12345);
  INSERT INTO lantikan_pengadil VALUES
    (5,10,'Penilai Pengadil','Belum Jawab',NULL,NULL,0,0,NULL,NULL,NULL,8),
    (4,10,'Pengadil','Diterima',NULL,NULL,1,1,NULL,NULL,3,NULL),
    (6,11,'Pengadil','Ditolak','Ditolak automatik - tiada jawapan dalam tempoh',NULL,1,0,NULL,NULL,3,NULL);
  INSERT INTO pool_pengadil VALUES(1,7,3,NULL),(2,7,NULL,8);
`);
let reads=0;
const env={DB:{prepare:(sql)=>{
  assert.match(sql,/^\s*SELECT\s/i,'GET must not mutate appointments');
  return {bind:(...values)=>({
    first:async()=>{reads++;return db.prepare(sql).get(...values)??null;},
    all:async()=>{reads++;return {results:db.prepare(sql).all(...values)};},
  })};
}}};
const url='https://staging.example.test/api/lantikan.php?jadual_id=10';
globalThis.appointmentUser=null;
assert.equal((await adminAppointments(new Request(url),env)).status,401);
globalThis.appointmentUser={id:3,role:'Pengadil'};
assert.equal((await adminAppointments(new Request(url),env)).status,403);
assert.equal(reads,0);
globalThis.appointmentUser={id:1,role:'Admin'};
assert.equal((await adminAppointments(new Request(url,{method:'POST'}),env)).status,503);
assert.equal((await adminAppointments(new Request(url.replace('=10','=bad')),env)).status,400);
assert.equal((await adminAppointments(new Request(url.replace('=10','=99')),env)).status,404);
const response=await adminAppointments(new Request(url),env);
assert.equal(response.status,200);
const payload=await response.json();
assert.equal(payload.region_label,'Daerah');
assert.deepEqual(payload.data.map((item)=>item.id),[4,5]);
assert.equal(payload.data[0].email_available,1);
assert.equal(payload.data[1].telegram_linked,1);
assert.equal(payload.referees.length,2);
assert.equal(payload.referees.find((item)=>item.pengadil_id===3).jumlah_lantikan_kejohanan,2);
assert.equal(payload.referees.find((item)=>item.pengadil_luar_id===8).wilayah,'Kuantan');
assert.doesNotMatch(JSON.stringify(payload),/12345/);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM lantikan_pengadil').get().n,3);
db.close();
const snapshotPath=new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51.sqlite',import.meta.url);
if (existsSync(snapshotPath)) {
  const snapshot=new DatabaseSync(snapshotPath.pathname,{readOnly:true});
  const match=snapshot.prepare(`SELECT lp.jadual_id FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    WHERE EXISTS (SELECT 1 FROM pool_pengadil WHERE kejohanan_id=jp.kejohanan_id)
    GROUP BY lp.jadual_id HAVING COUNT(*)>=3 LIMIT 1`).get();
  assert.ok(match,'Imported D1 snapshot must have an appointed match with a pool');
  const snapshotEnv={DB:{prepare:(sql)=>{
    assert.match(sql,/^\s*SELECT\s/i);
    return {bind:(...values)=>({
      first:async()=>snapshot.prepare(sql).get(...values)??null,
      all:async()=>({results:snapshot.prepare(sql).all(...values)}),
    })};
  }}};
  const result=await adminAppointments(new Request(url.replace('=10',`=${match.jadual_id}`)),snapshotEnv);
  assert.equal(result.status,200,'Imported D1 schema must support the Worker GET query');
  const data=await result.json();
  assert.ok(data.data.length>=3);
  assert.ok(data.referees.length>0);
  snapshot.close();
}
console.log('admin appointments: role guard, match scope, pool counts, region and read-only contract passed');
