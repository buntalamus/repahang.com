import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const criteria=JSON.parse(readFileSync(new URL('../src/kriteria-penilaian.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../src/assessment-reports.ts',import.meta.url),'utf8')
  .replace("import { currentUser, json } from './auth';",`
    const currentUser=async()=>globalThis.assessmentUser;
    const json=(body,status=200)=>Response.json(body,{status});`)
  .replace("import criteria from './kriteria-penilaian.json';",`const criteria=${JSON.stringify(criteria)};`);
const compiled=ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const {assessmentReports}=await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

function d1(db) {
  return {DB:{prepare:(sql)=>({bind:(...params)=>({
    first:async()=>db.prepare(sql).get(...params)??null,
    all:async()=>({results:db.prepare(sql).all(...params)}),
  })})},BASE_URL:'https://staging.example.test'};
}
const db=new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users(id INTEGER PRIMARY KEY,nama_penuh TEXT);
  CREATE TABLE pengadil_luar(id INTEGER PRIMARY KEY,nama TEXT);
  CREATE TABLE kejohanan(id INTEGER PRIMARY KEY,nama TEXT);
  CREATE TABLE jadual_perlawanan(id INTEGER PRIMARY KEY,kejohanan_id INTEGER,
    no_perlawanan TEXT,tarikh TEXT,masa TEXT,pasukan_home TEXT,pasukan_away TEXT,tempat TEXT);
  CREATE TABLE lantikan_pengadil(id INTEGER PRIMARY KEY,jadual_id INTEGER,pengadil_id INTEGER,
    pengadil_luar_id INTEGER,jawatan TEXT,status TEXT);
  CREATE TABLE laporan_penilaian(id INTEGER PRIMARY KEY,jadual_id INTEGER,lantikan_id INTEGER,
    penilai_id INTEGER,status TEXT,tahap_kesukaran TEXT,ulasan_keseluruhan TEXT,
    tarikh_hantar TEXT,catatan_admin TEXT,created_at TEXT);
  CREATE TABLE laporan_penilaian_pegawai(id INTEGER PRIMARY KEY,laporan_id INTEGER,
    lantikan_pengadil_id INTEGER,jawatan TEXT,nama_pengadil TEXT,markah TEXT,
    kawalan_kekuatan TEXT,kawalan_kelemahan TEXT,fizikal_kekuatan TEXT,
    fizikal_kelemahan TEXT,kerjasama_kekuatan TEXT,kerjasama_kelemahan TEXT);
  CREATE TABLE laporan_pengesahan_pengerusi(id INTEGER PRIMARY KEY,laporan_id INTEGER,
    status TEXT,pengesah_nama TEXT,pengesah_jawatan TEXT,pengesah_negeri TEXT,
    email_sent_at TEXT,telegram_sent_at TEXT,email_recipient TEXT,telegram_chat_id TEXT,
    catatan_pengerusi TEXT,tarikh_sahkan TEXT,alasan_override TEXT,
    admin_override_user_id INTEGER,approval_token TEXT);
  CREATE TABLE laporan_pengesahan_audit(id INTEGER PRIMARY KEY,laporan_id INTEGER,
    event_type TEXT,channel TEXT,event_status TEXT,actor_type TEXT,actor_user_id INTEGER,
    actor_luar_id INTEGER,link_url TEXT,details_json TEXT,created_at TEXT);
  INSERT INTO users VALUES(1,'RA A'),(2,'Pengadil R'),(3,'RA B');
  INSERT INTO kejohanan VALUES(1,'Kejohanan A');
  INSERT INTO jadual_perlawanan VALUES(10,1,'101','2027-01-01','16:00','A','B','Padang');
  INSERT INTO lantikan_pengadil VALUES
    (20,10,1,NULL,'Penilai Pengadil','Diterima'),
    (21,10,2,NULL,'Pengadil','Diterima'),
    (22,10,3,NULL,'Penolong Pengadil 1','Ditolak');
  INSERT INTO laporan_penilaian VALUES
    (30,10,20,1,'Dihantar','Normal','Baik',NULL,NULL,'2027-01-02');
  INSERT INTO laporan_penilaian_pegawai VALUES
    (40,30,21,'Pengadil','Pengadil R','8','["Baik"]','[]','[]','[]','[]','[]');
  INSERT INTO laporan_pengesahan_pengerusi VALUES
    (50,30,'Menunggu','Pengerusi A','Pengerusi','Pahang',NULL,NULL,
     'pengerusi@example.test','123',NULL,NULL,NULL,NULL,'${'b'.repeat(64)}');
  INSERT INTO laporan_pengesahan_audit VALUES
    (60,30,'sent','email','success','system',NULL,NULL,NULL,'{"test":true}','2027-01-02');
`);
const env=d1(db);
const base='https://staging.example.test/api/laporan-penilaian.php';
globalThis.assessmentUser=null;
assert.equal((await assessmentReports(new Request(base),env)).status,401);
globalThis.assessmentUser={id:2,role:'Pengadil'};
assert.equal((await assessmentReports(new Request(base),env)).status,403);
globalThis.assessmentUser={id:3,role:'Penilai'};
assert.equal((await assessmentReports(new Request(`${base}?officials=10`),env)).status,403);
assert.equal((await assessmentReports(new Request(`${base}?id=30`),env)).status,404);
globalThis.assessmentUser={id:1,role:'Penilai'};
assert.equal((await assessmentReports(new Request(base,{method:'POST'}),env)).status,503);
const officials=await (await assessmentReports(new Request(`${base}?officials=10`),env)).json();
assert.deepEqual(officials.data.map((row)=>row.jawatan),['Pengadil']);
assert.equal(officials.data[0].sections[0].key,'kawalan');
const mine=await (await assessmentReports(new Request(`${base}?penilai=1`),env)).json();
assert.equal(mine.data.length,1);
assert.deepEqual(mine.data[0].pegawai[0].kawalan_kekuatan,['Baik']);
assert.equal(mine.data[0].pengesahan.email_applicable,1);
assert.equal(mine.data[0].pengesahan.approval_url,undefined);
assert.equal(mine.data[0].pengesahan.approval_token,undefined);
assert.equal(JSON.stringify(mine).includes('b'.repeat(64)),false,'chair token must stay private');
assert.equal((await (await assessmentReports(new Request(`${base}?jadual_id=10`),env)).json()).data.length,1);
assert.equal((await (await assessmentReports(new Request(`${base}?id=30`),env)).json()).laporan.id,30);
globalThis.assessmentUser={id:9,role:'Admin'};
const all=await (await assessmentReports(new Request(base),env)).json();
assert.equal(all.data.length,1);
assert.equal(all.data[0].pengesahan.approval_url,
  `https://staging.example.test/api/laporan-pengesahan-token.php?token=${'b'.repeat(64)}`);
assert.equal(all.data[0].pengesahan.approval_token,undefined);
assert.deepEqual(all.data[0].pengesahan.audit[0].details,{test:true});
assert.equal((await (await assessmentReports(new Request(`${base}?kriteria=1`),env)).json()).data.Pengadil.kawalan.label,
  criteria.Pengadil.kawalan.label);
db.close();

const snapshotPath=new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51.sqlite',import.meta.url);
if (existsSync(snapshotPath)) {
  const snapshot=new DatabaseSync(snapshotPath.pathname,{readOnly:true});
  const snapshotEnv=d1(snapshot);
  const report=snapshot.prepare('SELECT id,penilai_id,jadual_id FROM laporan_penilaian WHERE penilai_id IS NOT NULL LIMIT 1').get();
  assert.ok(report,'snapshot should contain a registered RA report');
  globalThis.assessmentUser={id:report.penilai_id,role:'Penilai'};
  for (const query of [`?id=${report.id}`,`?jadual_id=${report.jadual_id}`,'?penilai=1']) {
    const response=await assessmentReports(new Request(base+query),snapshotEnv);
    assert.equal(response.status,200,'snapshot report read must match imported schema');
  }
  globalThis.assessmentUser={id:9,role:'Admin'};
  const admin=await assessmentReports(new Request(base),snapshotEnv);
  assert.equal(admin.status,200);
  assert.equal((await admin.json()).data.length,91);
  snapshot.close();
}
console.log('assessment reports: role scoping, token redaction, GET modes and write gate passed');
