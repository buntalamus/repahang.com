import assert from 'node:assert/strict';
import {copyFileSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

async function load(file,replacements=[]) {
  let source=readFileSync(new URL(file,import.meta.url),'utf8');
  for (const [from,to] of replacements) source=source.replace(from,to);
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext}}).outputText;
  return import(`data:text/javascript,${encodeURIComponent(compiled)}`);
}
const {overrideAdminReport}=await load('../src/report-admin-override.ts');
const {submitAssessmentRequest}=await load('../src/report-submission.ts',[
  ["import {currentUser,json} from './auth';",`const currentUser=async()=>globalThis.testAdmin;
    const json=(body,status=200)=>Response.json(body,{status});`],
  ["import {boundedJson} from './request';",'const boundedJson=async(request)=>request.json();'],
  ["import {overrideAdminReport} from './report-admin-override';",
    'const overrideAdminReport=(...args)=>globalThis.realOverride(...args);'],
]);
globalThis.realOverride=overrideAdminReport;
const {processReportDeliveries}=await load('../src/report-delivery.ts',[
  ["import {buildRefpahangEmail,sendRefpahangEmail} from '../mail';",
    `const buildRefpahangEmail=(_title,_name,paragraphs,action)=>({html:paragraphs.join(' '),
      text:paragraphs.join('\\n')+' '+action.url});
     const sendRefpahangEmail=async()=>{throw new Error('Unexpected live email');};`],
]);
const directory=mkdtempSync(join(tmpdir(),'refpahang-admin-override-'));
const path=join(directory,'db.sqlite');
copyFileSync(new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51.sqlite',import.meta.url),path);
const db=new DatabaseSync(path);
class Statement {
  constructor(sql,values=[]){this.sql=sql;this.values=values;}
  bind(...values){return new Statement(this.sql,values);}
  first(){return db.prepare(this.sql).get(...this.values)??null;}
  all(){return {results:db.prepare(this.sql).all(...this.values)};}
  run(){const result=db.prepare(this.sql).run(...this.values);return {meta:{changes:result.changes}};}
}
const env={BASE_URL:'https://staging.example.test',STAGING_AUTH_ENABLED:'0',
  STAGING_WRITES_ENABLED:'0',REPORT_DELIVERY_ENABLED:'0',
  DB:{prepare:(sql)=>new Statement(sql),batch:async(statements)=>{
    db.exec('BEGIN');
    try {const result=statements.map((statement)=>statement.run());db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }}};
try {
  db.exec(readFileSync(new URL('../migrations/0005_report_confirmation_outbox.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0007_report_admin_override.sql',import.meta.url),'utf8'));
  const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
  const state=db.prepare(`SELECT a.id,a.laporan_id,r.jadual_id FROM laporan_pengesahan_pengerusi a
    JOIN laporan_penilaian r ON r.id=a.laporan_id WHERE r.status='Disahkan'
    AND (SELECT count(*) FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id)
      BETWEEN 3 AND 4
    AND NOT EXISTS(SELECT 1 FROM laporan_penilaian_pegawai p
      LEFT JOIN lantikan_pengadil lp ON lp.id=p.lantikan_pengadil_id
      WHERE p.laporan_id=r.id AND (p.markah IS NULL OR trim(p.markah)=''
        OR lp.status<>'Diterima' OR lp.jadual_id<>r.jadual_id))
    ORDER BY a.id LIMIT 1`).get();
  assert.ok(admin && state);
  const request=new Request('https://staging.example.test/api/laporan-penilaian.php',{
    method:'PUT',headers:{'User-Agent':'Migration test'},
  });
  assert.equal(await overrideAdminReport(env,999999,admin.id,'Sebab','',request),'already_processed');
  db.prepare("UPDATE laporan_pengesahan_pengerusi SET status='Menunggu' WHERE id=?")
    .run(state.id);
  db.prepare("UPDATE laporan_penilaian SET status='Dihantar' WHERE id=?")
    .run(state.laporan_id);
  const beforeAudit=db.prepare('SELECT count(*) n FROM laporan_pengesahan_audit').get().n;
  const reason='Pengerusi tidak tersedia; laporan lengkap disemak oleh Admin.';
  const comment='Disahkan selepas semakan.';
  const put=(body)=>new Request('https://staging.example.test/api/laporan-penilaian.php',{
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
  });
  const payload={action:'sahkan',id:state.laporan_id,override_reason:reason,
    catatan_admin:comment};
  globalThis.testAdmin={id:admin.id,role:'Admin'};
  assert.equal((await submitAssessmentRequest(put(payload),env)).status,503);
  env.STAGING_AUTH_ENABLED='1';env.STAGING_WRITES_ENABLED='1';env.REPORT_DELIVERY_ENABLED='1';
  globalThis.testAdmin={id:admin.id,role:'Penilai'};
  assert.equal((await submitAssessmentRequest(put(payload),env)).status,403);
  globalThis.testAdmin={id:admin.id,role:'Admin'};
  assert.equal((await submitAssessmentRequest(put({...payload,override_reason:''}),env)).status,400);
  assert.equal((await submitAssessmentRequest(put(payload),env)).status,200);
  const approval=db.prepare(`SELECT status,admin_override_user_id,alasan_override,
    catatan_pengerusi FROM laporan_pengesahan_pengerusi WHERE id=?`).get(state.id);
  assert.equal(approval.status,'Override Admin');
  assert.equal(approval.admin_override_user_id,admin.id);
  assert.equal(approval.alasan_override,reason);
  assert.equal(approval.catatan_pengerusi,comment);
  assert.equal(db.prepare('SELECT status FROM laporan_penilaian WHERE id=?')
    .get(state.laporan_id).status,'Disahkan');
  assert.equal(db.prepare('SELECT status FROM jadual_perlawanan WHERE id=?')
    .get(state.jadual_id).status,'Selesai');
  assert.equal(db.prepare('SELECT source,integrity_checked FROM worker_report_confirmations')
    .get().source,'admin');
  assert.equal(db.prepare('SELECT integrity_checked FROM worker_report_confirmations')
    .get().integrity_checked,1);
  const crew=db.prepare('SELECT count(*) n FROM laporan_penilaian_pegawai WHERE laporan_id=?')
    .get(state.laporan_id).n;
  assert.equal(db.prepare('SELECT count(*) n FROM worker_report_deliveries').get().n,crew*2);
  assert.equal(db.prepare('SELECT count(*) n FROM laporan_pengesahan_audit').get().n,beforeAudit+1);
  assert.equal(await overrideAdminReport(env,state.laporan_id,admin.id,reason,comment,request),
    'already_processed');
  env.REPORT_DELIVERY_ENABLED='0';
  assert.equal((await processReportDeliveries(env)).processed,0);
  env.REPORT_DELIVERY_ENABLED='1';
  const delivered=await processReportDeliveries(env,20,{email:async(_env,_to,_name,_subject,_html,text)=>{
    assert.match(text,/Catatan Override Admin/);
  },telegram:async(_env,_chat,_message,url)=>{assert.match(url,/view_token=/);}});
  assert.equal(delivered.processed,crew*2);
  assert.equal(delivered.failed,0);
  assert.equal(delivered.sent+delivered.skipped,crew*2);
  assert.equal((await processReportDeliveries(env)).processed,0);
  console.log('Admin override: reason, atomic state, audit, KUP queue and delivery passed');
} finally {db.close();rmSync(directory,{recursive:true,force:true});}
