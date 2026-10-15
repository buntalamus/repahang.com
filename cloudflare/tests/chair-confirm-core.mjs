import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {copyFileSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const source=readFileSync(new URL('../src/chair-confirm-core.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
}}).outputText;
const {confirmChairReport}=await import(`data:text/javascript,${encodeURIComponent(compiled)}`);
const deliverySource=readFileSync(new URL('../src/report-delivery.ts',import.meta.url),'utf8')
  .replace("import {buildRefpahangEmail,sendRefpahangEmail} from '../mail';",
    `const buildRefpahangEmail=(_title,_name,paragraphs,action)=>({html:paragraphs.join(' '),
      text:paragraphs.join('\\n')+' '+action.url});
     const sendRefpahangEmail=async()=>{throw new Error('Unexpected live email');};`);
const deliveryCompiled=ts.transpileModule(deliverySource,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
}}).outputText;
const {processReportDeliveries}=await import(`data:text/javascript,${encodeURIComponent(deliveryCompiled)}`);
const dir=mkdtempSync(join(tmpdir(),'refpahang-confirm-'));
const path=join(dir,'database.sqlite');
copyFileSync(new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51.sqlite',
  import.meta.url),path);
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
const request=new Request('https://staging.example.test/api/laporan-pengesahan-token.php',{
  headers:{'User-Agent':'Migration test'},
});
try {
  db.exec(readFileSync(new URL('../migrations/0005_report_confirmation_outbox.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0007_report_admin_override.sql',import.meta.url),'utf8'));
  const candidate=db.prepare(`SELECT a.id,a.laporan_id,a.approval_token,r.jadual_id
    FROM laporan_pengesahan_pengerusi a JOIN laporan_penilaian r ON r.id=a.laporan_id
    WHERE length(a.approval_token)=64 AND r.status='Disahkan'
    ORDER BY a.id LIMIT 1`).get();
  assert.ok(candidate);
  assert.equal(await confirmChairReport(env,'0'.repeat(64),'',request),'invalid');
  assert.equal(await confirmChairReport(env,candidate.approval_token,'',request),'already_processed');
  db.prepare("UPDATE laporan_pengesahan_pengerusi SET status='Menunggu' WHERE id=?").run(candidate.id);
  db.prepare("UPDATE laporan_penilaian SET status='Dihantar' WHERE id=?").run(candidate.laporan_id);
  const beforeAudit=db.prepare('SELECT count(*) n FROM laporan_pengesahan_audit').get().n;
  const comment='Semakan lengkap. Teruskan prestasi.';
  assert.equal(await confirmChairReport(env,candidate.approval_token,comment,request),'confirmed');
  assert.equal(db.prepare('SELECT status,catatan_pengerusi FROM laporan_pengesahan_pengerusi WHERE id=?')
    .get(candidate.id).catatan_pengerusi,comment);
  assert.equal(db.prepare('SELECT status FROM laporan_penilaian WHERE id=?')
    .get(candidate.laporan_id).status,'Disahkan');
  assert.equal(db.prepare('SELECT status FROM jadual_perlawanan WHERE id=?')
    .get(candidate.jadual_id).status,'Selesai');
  assert.equal(db.prepare('SELECT count(*) n FROM laporan_pengesahan_audit').get().n,beforeAudit+1);
  assert.equal(db.prepare('SELECT count(*) n FROM worker_report_confirmations').get().n,1);
  const crew=db.prepare('SELECT count(*) n FROM laporan_penilaian_pegawai WHERE laporan_id=?')
    .get(candidate.laporan_id).n;
  assert.equal(db.prepare('SELECT count(*) n FROM worker_report_deliveries').get().n,crew*2);
  assert.equal(db.prepare('SELECT integrity_checked FROM worker_report_confirmations').get()
    .integrity_checked,1);
  assert.equal(await confirmChairReport(env,candidate.approval_token,comment,request),'already_processed');
  assert.equal(db.prepare('SELECT count(*) n FROM worker_report_deliveries').get().n,crew*2);
  assert.equal((await processReportDeliveries(env)).processed,0);
  env.STAGING_AUTH_ENABLED='1';env.STAGING_WRITES_ENABLED='1';env.REPORT_DELIVERY_ENABLED='1';
  const recipients=[];
  const urls=[];
  const sends={email:async(_env,to,_name,_subject,_html,text)=>{
      assert.match(text,/view_token=/);recipients.push(to);
      urls.push(text.match(/https:\/\/[^\s]+view_token=[a-f0-9]{64}/)?.[0]);
    },telegram:async(_env,chatId,message,url)=>{
      assert.match(message,/Laporan Penilaian Disahkan/);
      assert.match(url,/view_token=/);recipients.push(String(chatId));urls.push(url);
    }};
  const delivered=await processReportDeliveries(env,20,sends);
  assert.equal(delivered.processed,crew*2);
  assert.equal(delivered.failed,0);
  assert.equal(delivered.sent+delivered.skipped,crew*2);
  assert.equal(recipients.length,delivered.sent);
  assert.equal(db.prepare('SELECT count(*) n FROM laporan_pengesahan_audit').get().n,
    beforeAudit+1+crew*2);
  const secret=db.prepare(`SELECT la.penilaian_token FROM laporan_penilaian r
    JOIN lantikan_pengadil la ON la.id=r.lantikan_id WHERE r.id=?`).get(candidate.laporan_id)
    .penilaian_token;
  const signature=createHmac('sha256',secret)
    .update(`laporan-penilaian:view:${candidate.laporan_id}`).digest('hex');
  assert.ok(urls.every((url)=>url?.includes(`view_token=${signature}`)));
  assert.equal(db.prepare("SELECT count(*) n FROM worker_report_deliveries WHERE status='pending'").get().n,0);
  assert.equal((await processReportDeliveries(env,20,sends)).processed,0);
  const retryJob=db.prepare("SELECT delivery_key FROM worker_report_deliveries WHERE channel='email' LIMIT 1").get();
  db.prepare(`UPDATE worker_report_deliveries SET status='pending',attempts=0,
    completed_at=NULL,next_attempt_at=NULL,last_error=NULL WHERE delivery_key=?`)
    .run(retryJob.delivery_key);
  const failed=await processReportDeliveries(env,1,{...sends,
    email:async()=>{throw new Error('Synthetic provider failure');}});
  assert.equal(failed.failed,1);
  assert.equal(db.prepare(`SELECT status,attempts FROM worker_report_deliveries
    WHERE delivery_key=?`).get(retryJob.delivery_key).status,'pending');
  assert.equal(db.prepare(`SELECT attempts FROM worker_report_deliveries
    WHERE delivery_key=?`).get(retryJob.delivery_key).attempts,1);

  // A missing crew record blocks the entire confirmation before any mutation.
  const next=db.prepare(`SELECT a.id,a.laporan_id,a.approval_token FROM laporan_pengesahan_pengerusi a
    JOIN laporan_penilaian r ON r.id=a.laporan_id WHERE a.id<>? AND r.status='Disahkan'
    AND length(a.approval_token)=64 ORDER BY a.id LIMIT 1`).get(candidate.id);
  db.prepare("UPDATE laporan_pengesahan_pengerusi SET status='Menunggu' WHERE id=?").run(next.id);
  db.prepare("UPDATE laporan_penilaian SET status='Dihantar' WHERE id=?").run(next.laporan_id);
  db.prepare('DELETE FROM laporan_penilaian_pegawai WHERE laporan_id=?').run(next.laporan_id);
  assert.equal(await confirmChairReport(env,next.approval_token,'',request),'already_processed');
  assert.equal(db.prepare('SELECT status FROM laporan_pengesahan_pengerusi WHERE id=?')
    .get(next.id).status,'Menunggu');
  assert.equal(db.prepare('SELECT count(*) n FROM worker_report_confirmations').get().n,1);
  console.log('Chair confirmation: atomic imported D1 state, audit, queue, duplicate and invalid crew passed');
} finally {db.close();rmSync(dir,{recursive:true,force:true});}
