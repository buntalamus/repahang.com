import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const criteria=JSON.parse(readFileSync(new URL('../src/kriteria-penilaian.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../src/assessment-token.ts',import.meta.url),'utf8')
  .replace("import { json } from './auth';",
    'const json=(body,status=200)=>Response.json(body,{status});')
  .replace("import criteria from './kriteria-penilaian.json';",
    `const criteria=${JSON.stringify(criteria)};`);
const compiled=ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const {assessmentToken}=await import(`data:text/javascript,${encodeURIComponent(compiled)}`);
const db=new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users(id INTEGER PRIMARY KEY,nama_penuh TEXT);
  CREATE TABLE pengadil_luar(id INTEGER PRIMARY KEY,nama TEXT);
  CREATE TABLE kejohanan(id INTEGER PRIMARY KEY,nama TEXT,anjuran TEXT);
  CREATE TABLE jadual_perlawanan(id INTEGER PRIMARY KEY,kejohanan_id INTEGER,no_perlawanan TEXT,
    tarikh TEXT,masa TEXT,hari TEXT,pasukan_home TEXT,pasukan_away TEXT,tempat TEXT,
    kumpulan_tahap TEXT);
  CREATE TABLE lantikan_pengadil(id INTEGER PRIMARY KEY,jadual_id INTEGER,pengadil_id INTEGER,
    pengadil_luar_id INTEGER,jawatan TEXT,status TEXT,penilaian_token TEXT);
  CREATE TABLE laporan_penilaian(id INTEGER PRIMARY KEY,lantikan_id INTEGER,status TEXT,
    tahap_kesukaran TEXT,cuaca TEXT,ulasan_keseluruhan TEXT,skor_ht_home INTEGER,
    skor_ht_away INTEGER,skor_ft_home INTEGER,skor_ft_away INTEGER,skor_et_home INTEGER,
    skor_et_away INTEGER,skor_ps_home INTEGER,skor_ps_away INTEGER);
  CREATE TABLE laporan_penilaian_pegawai(id INTEGER PRIMARY KEY,laporan_id INTEGER,
    lantikan_pengadil_id INTEGER,kawalan_kekuatan TEXT,kawalan_kelemahan TEXT,
    fizikal_kekuatan TEXT,fizikal_kelemahan TEXT,kerjasama_kekuatan TEXT,
    kerjasama_kelemahan TEXT);
  INSERT INTO users VALUES(1,'Penilai RA'),(2,'Pengadil R');
  INSERT INTO pengadil_luar VALUES(3,'Pengadil AR');
  INSERT INTO kejohanan VALUES(1,'Kejohanan Ujian','PBSNP');
  INSERT INTO jadual_perlawanan VALUES(1,1,'101','2027-01-01','16:00:00','Jumaat',
    'A','B','Padang','A');
  INSERT INTO lantikan_pengadil VALUES
    (1,1,1,NULL,'Penilai Pengadil','Diterima','${'a'.repeat(64)}'),
    (2,1,2,NULL,'Pengadil','Diterima',NULL),
    (3,1,NULL,3,'Penolong Pengadil 1','Diterima',NULL),
    (4,1,2,NULL,'Penolong Pengadil 2','Ditolak',NULL);
`);
const env={STAGING_AUTH_ENABLED:'0',DB:{prepare:(sql)=>({bind:(...params)=>({
  first:async()=>db.prepare(sql).get(...params)??null,
  all:async()=>({results:db.prepare(sql).all(...params)}),
})})}};
const url=`https://staging.example.test/api/penilaian-token.php?token=${'a'.repeat(64)}`;
assert.equal((await assessmentToken(new Request(url),env)).status,503);
env.STAGING_AUTH_ENABLED='1';
assert.equal((await assessmentToken(new Request(url,{method:'POST'}),env)).status,503);
assert.equal((await assessmentToken(new Request(url,{method:'PUT'}),env)).status,405);
assert.equal((await assessmentToken(new Request(url.replace('a'.repeat(64),'bad')),env)).status,401);
const response=await assessmentToken(new Request(url),env);
assert.equal(response.status,200);
const body=await response.json();
assert.equal(body.match.kejohanan,'Kejohanan Ujian');
assert.equal(body.penilai_nama,'Penilai RA');
assert.deepEqual(body.officials.map((row)=>row.jawatan),['Pengadil','Penolong Pengadil 1']);
assert.equal(body.officials[1].sections[0].key,'penolong');
assert.deepEqual(body.kriteria,criteria);
assert.equal(body.existing,null);
assert.equal(JSON.stringify(body).includes('a'.repeat(64)),false,'RA token must not echo in JSON');
db.exec(`
  INSERT INTO laporan_penilaian(id,lantikan_id,status,tahap_kesukaran)
    VALUES(5,1,'Draf','Normal');
  INSERT INTO laporan_penilaian_pegawai(id,laporan_id,lantikan_pengadil_id,kawalan_kekuatan)
    VALUES(6,5,2,'["Baik"]');
`);
const draft=await (await assessmentToken(new Request(url),env)).json();
assert.equal(draft.existing.status,'Draf');
assert.deepEqual(draft.existing.pegawai[0].kawalan_kekuatan,['Baik']);
const snapshotPath=new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51.sqlite',import.meta.url);
if (existsSync(snapshotPath)) {
  const snapshot=new DatabaseSync(snapshotPath.pathname,{readOnly:true});
  const snapshotEnv={...env,DB:{prepare:(sql)=>({bind:(...params)=>({
    first:async()=>snapshot.prepare(sql).get(...params)??null,
    all:async()=>({results:snapshot.prepare(sql).all(...params)}),
  })})}};
  const samples=snapshot.prepare(`
    SELECT lp.penilaian_token AS token
    FROM lantikan_pengadil lp
    LEFT JOIN laporan_penilaian l ON l.lantikan_id=lp.id
    WHERE lp.jawatan='Penilai Pengadil' AND lp.status='Diterima'
      AND lp.penilaian_token GLOB '[0-9a-fA-F]*'
      AND length(lp.penilaian_token)=64
    GROUP BY l.id IS NULL ORDER BY l.id IS NULL LIMIT 2
  `).all();
  assert.equal(samples.length,2,'snapshot needs both saved and unsaved RA reports');
  for (const sample of samples) {
    const result=await assessmentToken(new Request(
      `https://staging.example.test/api/penilaian-token.php?token=${sample.token}`),snapshotEnv);
    assert.equal(result.status,200,'snapshot RA token must resolve against imported schema');
    const payload=await result.json();
    assert.equal(payload.error,false);
    assert.ok(Array.isArray(payload.officials));
    assert.equal(JSON.stringify(payload).includes(sample.token),false);
  }
  snapshot.close();
}
console.log('assessment token: staging gate, RA ownership, accepted KUP and draft read passed');
