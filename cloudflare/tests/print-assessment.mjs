import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const source=readFileSync(new URL('../src/print-assessment.ts',import.meta.url),'utf8')
  .replace("import {currentUser} from './auth';",`const currentUser=async()=>globalThis.actor;`);
const compiled=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
}}).outputText;
const {printAssessment,renderAssessmentReport}=await import(
  `data:text/javascript,${encodeURIComponent(compiled)}`);
const db=new DatabaseSync(new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51_v2.sqlite',
  import.meta.url).pathname,{readOnly:true});
const env={STAGING_AUTH_ENABLED:'0',DB:{
  prepare:(sql)=>({bind:(...params)=>({
    first:async()=>db.prepare(sql).get(...params)??null,
    all:async()=>({results:db.prepare(sql).all(...params)}),
  })}),
}};
const report=db.prepare(`SELECT r.id,r.penilai_id,r.jadual_id,la.penilaian_token
  FROM laporan_penilaian r JOIN lantikan_pengadil la ON la.id=r.lantikan_id
  WHERE r.status='Disahkan' AND la.status='Diterima'
    AND la.jawatan='Penilai Pengadil' AND la.penilaian_token IS NOT NULL
  ORDER BY r.id LIMIT 1`).get();
assert.ok(report);
const url=(query='')=>new Request(`https://staging.example.test/api/download-laporan-penilaian.php?id=${report.id}${query}`);
globalThis.actor={id:1,role:'Admin'};
assert.equal((await printAssessment(url(),env)).status,503);
env.STAGING_AUTH_ENABLED='1';
globalThis.actor=null;
assert.equal((await printAssessment(url(),env)).status,403);
assert.equal((await printAssessment(new Request('https://staging.example.test/api/download-laporan-penilaian.php?id=x'),env)).status,400);
globalThis.actor={id:1,role:'Admin'};
const admin=await printAssessment(url(),env);
assert.equal(admin.status,200);
assert.match(admin.headers.get('Content-Type'),/text\/html/);
assert.match(await admin.text(),/LAPORAN PENILAI PENGADIL/);
assert.equal((await printAssessment(url('&view_token=bad'),env)).status,404,
  'A bad view token never falls back to an Admin session');
globalThis.actor={id:report.penilai_id,role:'Penilai'};
assert.equal((await printAssessment(url(),env)).status,200);
globalThis.actor={id:999999,role:'Penilai'};
assert.equal((await printAssessment(url(),env)).status,403);
const ppAllowed=db.prepare(`SELECT pp.id FROM users pp WHERE pp.role='PP Daerah'
  AND (pp.id=? OR EXISTS (SELECT 1 FROM laporan_penilaian_pegawai p
    JOIN lantikan_pengadil la ON la.id=p.lantikan_pengadil_id
    JOIN users kup ON kup.id=la.pengadil_id
    WHERE p.laporan_id=? AND kup.persatuan_id=pp.persatuan_id)) LIMIT 1`)
  .get(report.penilai_id,report.id);
if(ppAllowed){
  globalThis.actor={id:ppAllowed.id,role:'PP Daerah'};
  assert.equal((await printAssessment(url(),env)).status,200);
}
globalThis.actor={id:999999,role:'PP Daerah'};
assert.equal((await printAssessment(url(),env)).status,403);
const kup=db.prepare(`SELECT la.pengadil_id FROM laporan_penilaian_pegawai p
  JOIN lantikan_pengadil la ON la.id=p.lantikan_pengadil_id
  WHERE p.laporan_id=? AND la.pengadil_id IS NOT NULL LIMIT 1`).get(report.id);
if(kup){
  globalThis.actor={id:kup.pengadil_id,role:'Pengadil'};
  assert.equal((await printAssessment(url(),env)).status,200);
  globalThis.actor={id:999999,role:'Pengadil'};
  assert.equal((await printAssessment(url(),env)).status,403);
}
globalThis.actor=null;
const approval=db.prepare('SELECT approval_token FROM laporan_pengesahan_pengerusi WHERE laporan_id=?').get(report.id);
if(approval?.approval_token){
  const chair=await printAssessment(url(`&approval_token=${approval.approval_token}`),env);
  assert.equal(chair.status,200);
  assert.equal((await chair.text()).includes(approval.approval_token),false);
  assert.equal((await printAssessment(url(`&approval_token=${'0'.repeat(64)}`),env)).status,404);
}
const signature=createHmac('sha256',report.penilaian_token)
  .update(`laporan-penilaian:view:${report.id}`).digest('hex');
assert.equal((await printAssessment(url(`&view_token=${signature}`),env)).status,200);
assert.equal((await printAssessment(url(`&view_token=${'0'.repeat(64)}`),env)).status,404);
const malicious=renderAssessmentReport({pasukan_home:'<script>alert(1)</script>',
  pasukan_away:'A',nama_kejohanan:'K',tarikh:'2027-01-01',skor_ht_home:0,
  skor_ht_away:0,skor_ft_home:1,skor_ft_away:0},[]);
assert.equal(malicious.includes('<script>alert(1)</script>'),false);
assert.equal(malicious.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),true);
db.close();
console.log('RA print: imported D1 access modes, token scope, owner roles and escaped HTML passed');
