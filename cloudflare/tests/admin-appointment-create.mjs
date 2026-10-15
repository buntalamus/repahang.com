import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const source=readFileSync(new URL('../src/admin-appointment-create.ts',import.meta.url),'utf8')
  .replace("import {currentUser,json} from './auth';",`
    const currentUser=async()=>globalThis.actor;
    const json=(body,status=200)=>Response.json(body,{status});`)
  .replace("import {boundedJson} from './request';",`const boundedJson=async(request)=>request.json();`);
const compiled=ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const {adminAppointmentCreate}=await import(`data:text/javascript,${encodeURIComponent(compiled)}`);
const db=new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users(id INTEGER PRIMARY KEY,nama_penuh TEXT,email TEXT,no_telefon TEXT,
    jenis_pengadil TEXT);
  CREATE TABLE pengadil_luar(id INTEGER PRIMARY KEY,nama TEXT,emel TEXT,no_tel TEXT,
    jenis_pengadil TEXT);
  CREATE TABLE jadual_perlawanan(id INTEGER PRIMARY KEY,kejohanan_id INTEGER,tarikh TEXT,
    masa TEXT,status TEXT,updated_at TEXT);
  CREATE TABLE pool_pengadil(id INTEGER PRIMARY KEY,kejohanan_id INTEGER,
    pengadil_id INTEGER,pengadil_luar_id INTEGER);
  CREATE TABLE lantikan_pengadil(id INTEGER PRIMARY KEY,jadual_id INTEGER,pengadil_id INTEGER,
    pengadil_luar_id INTEGER,jawatan TEXT,status TEXT,created_by INTEGER,
    created_at TEXT,updated_at TEXT);
  CREATE UNIQUE INDEX unique_match_role ON lantikan_pengadil(jadual_id,jawatan);
  CREATE TABLE laporan_penilaian(id INTEGER PRIMARY KEY,jadual_id INTEGER);
  CREATE TABLE penilaian_pengadil(id INTEGER PRIMARY KEY,perlawanan_id INTEGER);
  CREATE TABLE perlawanan(id INTEGER PRIMARY KEY,lantikan_id INTEGER);
  CREATE TABLE lantikan_audit_log(id INTEGER PRIMARY KEY,event_key TEXT UNIQUE,
    lantikan_id INTEGER,jadual_id INTEGER,kejohanan_id INTEGER,pengadil_id INTEGER,
    pengadil_luar_id INTEGER,jawatan TEXT,nama_pegawai TEXT,emel_pegawai TEXT,
    no_telefon_pegawai TEXT,event_type TEXT,channel TEXT,event_status TEXT,
    details_json TEXT,actor_type TEXT,actor_user_id INTEGER,ip_address TEXT,
    user_agent TEXT,created_at TEXT);
  INSERT INTO users VALUES(1,'Admin A','admin@example.test','010','Penilai Pengadil'),
    (2,'Ref A','ref@example.test','011','Pengadil'),
    (4,'Ref B','ref-b@example.test','013','Pengadil');
  INSERT INTO pengadil_luar VALUES(3,'RA A','ra@example.test','012','Penilai Pengadil');
  INSERT INTO jadual_perlawanan VALUES(10,7,'2027-12-01','15:00:00','Belum Lantik',NULL),
    (11,7,'2027-12-01','15:00:00','Belum Lantik',NULL),
    (12,7,'2027-12-02','15:00:00','Dibatalkan',NULL),
    (13,8,'2027-12-03','15:00:00','Belum Lantik',NULL),
    (14,7,'2027-12-04','15:00:00','Belum Lantik',NULL);
  INSERT INTO pool_pengadil VALUES(1,7,2,NULL),(2,7,NULL,3),(3,7,4,NULL);
`);
db.exec(readFileSync(new URL('../migrations/0004_admin_appointment_create.sql',import.meta.url),'utf8'));
let beforeBatch=null;
const env={STAGING_AUTH_ENABLED:'0',STAGING_WRITES_ENABLED:'0',DB:{
  prepare:(sql)=>({bind:(...values)=>({sql,values,
    first:async()=>db.prepare(sql).get(...values)??null,
  })}),
  batch:async(statements)=>{
    if(beforeBatch){const callback=beforeBatch;beforeBatch=null;callback();}
    db.exec('BEGIN');
    try{
      const result=statements.map(({sql,values})=>({meta:{
        changes:Number(db.prepare(sql).run(...values).changes)}}));
      db.exec('COMMIT');return result;
    }catch(error){db.exec('ROLLBACK');throw error;}
  },
}};
const url='https://staging.example.test/api/lantikan.php';
const post=(body)=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(body)});
globalThis.actor=null;
assert.equal((await adminAppointmentCreate(post({}),env)).status,401);
globalThis.actor={id:2,role:'Pengadil'};
assert.equal((await adminAppointmentCreate(post({}),env)).status,403);
globalThis.actor={id:1,role:'Admin'};
const input={jadual_id:10,pengadil_id:2,jawatan:'Pengadil'};
assert.equal((await adminAppointmentCreate(post(input),env)).status,503);
env.STAGING_AUTH_ENABLED='1';env.STAGING_WRITES_ENABLED='1';
assert.equal((await adminAppointmentCreate(post({...input,action:'notify'}),env)).status,503);
assert.equal((await adminAppointmentCreate(post({...input,pengadil_luar_id:3}),env)).status,400);
assert.equal((await adminAppointmentCreate(post({...input,jadual_id:13}),env)).status,409);
assert.equal((await adminAppointmentCreate(post({...input,jadual_id:12}),env)).status,409);
assert.equal((await adminAppointmentCreate(post({...input,jawatan:'Penilai Pengadil'}),env)).status,409);
const created=await adminAppointmentCreate(post(input),env);
assert.equal(created.status,200);
const saved=db.prepare('SELECT * FROM lantikan_pengadil WHERE jadual_id=10').get();
assert.equal(saved.status,'Belum Jawab');
assert.equal(saved.pengadil_id,2);
assert.ok(saved.worker_assignment_key);
assert.equal(db.prepare('SELECT status FROM jadual_perlawanan WHERE id=10').get().status,'Menunggu Pengesahan');
const audit=db.prepare('SELECT * FROM lantikan_audit_log').get();
assert.equal(audit.lantikan_id,saved.id);
assert.equal(audit.event_type,'appointment_created');
assert.equal(audit.actor_user_id,1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM perlawanan').get().n,0);
assert.equal((await adminAppointmentCreate(post(input),env)).status,503,
  'Replacement stays blocked');
assert.equal((await adminAppointmentCreate(post({...input,jadual_id:11}),env)).status,409,
  'Official cannot occupy simultaneous active match');
assert.equal((await adminAppointmentCreate(post({jadual_id:10,pengadil_luar_id:3,
  jawatan:'Penilai Pengadil'}),env)).status,200);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM lantikan_audit_log').get().n,2);
assert.equal((await adminAppointmentCreate(post({jadual_id:11,pengadil_luar_id:3,
  jawatan:'Penilai Pengadil'}),env)).status,409);
db.prepare("INSERT INTO laporan_penilaian VALUES(1,13)").run();
db.prepare("INSERT INTO pool_pengadil VALUES(4,8,4,NULL)").run();
assert.equal((await adminAppointmentCreate(post({jadual_id:13,pengadil_id:4,
  jawatan:'Pengadil'}),env)).status,409,'Existing RA report blocks a new slot');
beforeBatch=()=>db.prepare(`INSERT INTO lantikan_pengadil
  (jadual_id,pengadil_id,jawatan,status) VALUES(14,2,'Pengadil','Diterima')`).run();
assert.equal((await adminAppointmentCreate(post({jadual_id:14,pengadil_id:4,
  jawatan:'Pengadil'}),env)).status,409,'Concurrent slot insertion must block stale write');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM lantikan_audit_log').get().n,2);
assert.equal(db.prepare('SELECT status FROM jadual_perlawanan WHERE id=14').get().status,
  'Belum Lantik','Failed insert must not move match status');
db.close();
console.log('admin appointment create: pool, role, clash, audit and guarded batch passed');
