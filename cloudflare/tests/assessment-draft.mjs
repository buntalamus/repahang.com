import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const source=readFileSync(new URL('../src/assessment-draft.ts',import.meta.url),'utf8')
  .replace("import {currentUser,json} from './auth';",`
    const currentUser=async()=>globalThis.assessmentUser;
    const json=(body,status=200)=>Response.json(body,{status});`)
  .replace("import {boundedJson} from './request';",`const boundedJson=async(request)=>request.json();`);
const linkedSource=source.replace("import {dispatchAfterSubmission,publicDispatch,submissionMessage} from './report-submission';",
  `const dispatchAfterSubmission=async()=>null;const publicDispatch=(value)=>value;
   const submissionMessage=()=>'Submitted';`)
  .replace("import {auditMetaFrom} from './php/lantikan-audit';",'const auditMetaFrom=()=>({});');
const compiled=ts.transpileModule(linkedSource,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const {assessmentDraft}=await import(`data:text/javascript,${encodeURIComponent(compiled)}`);
let db=new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users(id INTEGER PRIMARY KEY,nama_penuh TEXT);
  CREATE TABLE pengadil_luar(id INTEGER PRIMARY KEY,nama TEXT);
  CREATE TABLE lantikan_pengadil(id INTEGER PRIMARY KEY,jadual_id INTEGER,pengadil_id INTEGER,
    pengadil_luar_id INTEGER,jawatan TEXT,status TEXT,penilaian_token TEXT);
  CREATE TABLE laporan_penilaian(id INTEGER PRIMARY KEY,jadual_id INTEGER,lantikan_id INTEGER,
    penilai_id INTEGER,status TEXT,tahap_kesukaran TEXT,cuaca TEXT,ulasan_keseluruhan TEXT,
    skor_ht_home INTEGER,skor_ht_away INTEGER,skor_ft_home INTEGER,skor_ft_away INTEGER,
    skor_et_home INTEGER,skor_et_away INTEGER,skor_ps_home INTEGER,skor_ps_away INTEGER,
    created_at TEXT,updated_at TEXT);
  CREATE TABLE laporan_penilaian_pegawai(id INTEGER PRIMARY KEY,laporan_id INTEGER,
    lantikan_pengadil_id INTEGER,jawatan TEXT,nama_pengadil TEXT,markah TEXT,prestasi TEXT,
    kawalan_kekuatan TEXT,kawalan_kelemahan TEXT,kawalan_nasihat TEXT,
    fizikal_kekuatan TEXT,fizikal_kelemahan TEXT,fizikal_nasihat TEXT,
    kerjasama_kekuatan TEXT,kerjasama_kelemahan TEXT,kerjasama_nasihat TEXT);
  INSERT INTO users VALUES(1,'RA Asal'),(2,'Pengadil Asal'),(3,'AR1 Asal'),(4,'AR2 Asal');
  INSERT INTO lantikan_pengadil VALUES
    (10,50,1,NULL,'Penilai Pengadil','Diterima','${'a'.repeat(64)}'),
    (11,50,2,NULL,'Pengadil','Diterima',NULL),
    (12,50,3,NULL,'Penolong Pengadil 1','Diterima',NULL),
    (13,50,4,NULL,'Penolong Pengadil 2','Diterima',NULL);
`);
db.exec(readFileSync(new URL('../migrations/0003_assessment_drafts.sql',import.meta.url),'utf8'));
let beforeBatch=null;
const env={STAGING_AUTH_ENABLED:'0',STAGING_WRITES_ENABLED:'0',DB:{
  prepare:(sql)=>({
    bind:(...values)=>({
      sql,values,
      first:async()=>db.prepare(sql).get(...values)??null,
      all:async()=>({results:db.prepare(sql).all(...values)}),
    }),
  }),
  batch:async(statements)=>{
    if (beforeBatch) { const callback=beforeBatch; beforeBatch=null; callback(); }
    db.exec('BEGIN');
    try {
      const results=statements.map(({sql,values})=>{
        const info=db.prepare(sql).run(...values);
        return {meta:{changes:Number(info.changes)}};
      });
      db.exec('COMMIT');
      return results;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  },
}};
const payload={jadual_id:50,lantikan_id:10,tahap_kesukaran:'Normal',cuaca:'Cerah',
  ulasan_keseluruhan:'Laporan ujian',pegawai:[11,12,13].map((id)=>({
    lantikan_pengadil_id:id,jawatan:'Palsu',nama_pengadil:'Nama palsu',
    markah:'8.2',prestasi:'Baik',kawalan_kekuatan:['Baik'],
  }))};
const url='https://staging.example.test/api/laporan-penilaian.php';
const req=(body)=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(body)});
globalThis.assessmentUser={id:1,role:'Penilai'};
assert.equal((await assessmentDraft(req(payload),env,'session')).status,503);
env.STAGING_AUTH_ENABLED='1';
env.STAGING_WRITES_ENABLED='1';
globalThis.assessmentUser={id:2,role:'Pengadil'};
assert.equal((await assessmentDraft(req(payload),env,'session')).status,403);
globalThis.assessmentUser={id:9,role:'Penilai'};
assert.equal((await assessmentDraft(req(payload),env,'session')).status,403);
globalThis.assessmentUser={id:1,role:'Penilai'};
assert.equal((await assessmentDraft(req({...payload,pegawai:payload.pegawai.slice(0,2)}),env,'session')).status,400);
assert.equal((await assessmentDraft(req({...payload,pegawai:payload.pegawai.map((p)=>({...p,markah:11}))}),env,'session')).status,400);
const first=await assessmentDraft(req(payload),env,'session');
assert.equal(first.status,200);
const reportId=(await first.json()).id;
assert.ok(reportId>0);
assert.equal(db.prepare('SELECT count(*) AS n FROM laporan_penilaian').get().n,1);
assert.equal(db.prepare('SELECT count(*) AS n FROM laporan_penilaian_pegawai').get().n,3);
assert.equal(db.prepare('SELECT nama_pengadil FROM laporan_penilaian_pegawai WHERE lantikan_pengadil_id=11').get().nama_pengadil,'Pengadil Asal');
const second=await assessmentDraft(req({...payload,ulasan_keseluruhan:'Draf kedua'}),env,'session');
assert.equal(second.status,200);
assert.equal((await second.json()).id,reportId);
assert.equal(db.prepare('SELECT ulasan_keseluruhan FROM laporan_penilaian').get().ulasan_keseluruhan,'Draf kedua');
assert.equal(db.prepare('SELECT count(*) AS n FROM laporan_penilaian_pegawai').get().n,3);
beforeBatch=()=>db.prepare("UPDATE laporan_penilaian SET worker_revision='concurrent' WHERE id=?").run(reportId);
assert.equal((await assessmentDraft(req(payload),env,'session')).status,409);
assert.equal(db.prepare('SELECT worker_revision FROM laporan_penilaian').get().worker_revision,'concurrent');
assert.equal(db.prepare('SELECT count(*) AS n FROM laporan_penilaian_pegawai').get().n,3);
beforeBatch=()=>db.prepare("UPDATE lantikan_pengadil SET status='Ditolak' WHERE id=13").run();
assert.equal((await assessmentDraft(req(payload),env,'session')).status,409);
assert.equal(db.prepare('SELECT count(*) AS n FROM laporan_penilaian_pegawai').get().n,3);
db.prepare("UPDATE lantikan_pengadil SET status='Diterima' WHERE id=13").run();
const tokenReq=()=>req({...payload,token:'a'.repeat(64)});
assert.equal((await assessmentDraft(tokenReq(),env,'token')).status,200);
assert.equal((await assessmentDraft(req({...payload,token:'bad'}),env,'token')).status,401);
db.prepare("UPDATE laporan_penilaian SET status='Dihantar' WHERE id=?").run(reportId);
assert.equal((await assessmentDraft(req(payload),env,'session')).status,409);
assert.equal((await assessmentDraft(tokenReq(),env,'token')).status,409);
db.close();
const scratchPath=process.env.REFPAHANG_DRAFT_SQLITE;
if (scratchPath && existsSync(scratchPath)) {
  db=new DatabaseSync(scratchPath);
  const ra=db.prepare(`
    SELECT ra.id,ra.jadual_id,ra.penilaian_token FROM lantikan_pengadil ra
    WHERE ra.jawatan='Penilai Pengadil' AND ra.status='Diterima'
      AND length(ra.penilaian_token)=64
      AND NOT EXISTS (SELECT 1 FROM laporan_penilaian l WHERE l.lantikan_id=ra.id)
      AND (SELECT count(*) FROM lantikan_pengadil kup WHERE kup.jadual_id=ra.jadual_id
        AND kup.status='Diterima' AND kup.jawatan IN
          ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')) BETWEEN 3 AND 4
      AND (SELECT count(DISTINCT kup.jawatan) FROM lantikan_pengadil kup
        WHERE kup.jadual_id=ra.jadual_id AND kup.status='Diterima'
          AND kup.jawatan IN ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2'))=3
    LIMIT 1
  `).get();
  assert.ok(ra,'scratch dump needs one eligible RA with a full accepted KUP crew');
  const crew=db.prepare(`SELECT id FROM lantikan_pengadil WHERE jadual_id=? AND status='Diterima'
    AND jawatan IN ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')`).all(ra.jadual_id);
  const input={token:ra.penilaian_token,pegawai:crew.map((official)=>({
    lantikan_pengadil_id:official.id,markah:'8.0',prestasi:'Baik',
  }))};
  const response=await assessmentDraft(req(input),env,'token');
  assert.equal(response.status,200,'scratch D1 draft must save against imported schema');
  const saved=db.prepare('SELECT id FROM laporan_penilaian WHERE lantikan_id=?').get(ra.id);
  assert.ok(saved);
  assert.equal(db.prepare('SELECT count(*) AS n FROM laporan_penilaian_pegawai WHERE laporan_id=?').get(saved.id).n,
    crew.length);
  db.close();
}
console.log('assessment draft: atomic insert/update, RA and KUP guards, stale conflict and token parity passed');
