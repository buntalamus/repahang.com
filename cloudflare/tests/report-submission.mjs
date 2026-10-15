import assert from 'node:assert/strict';
import {copyFileSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

function load(file,replacements=[]) {
  let source=readFileSync(new URL(file,import.meta.url),'utf8');
  for (const [before,after] of replacements) source=source.replace(before,after);
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext}}).outputText;
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
}
const {submitAssessment,submitAssessmentRequest}=await load('../src/report-submission.ts',[
  ["import {currentUser,json} from './auth';",`const currentUser=async()=>globalThis.testUser;
    const json=(body,status=200)=>Response.json(body,{status});`],
  ["import {boundedJson} from './request';",'const boundedJson=async(request)=>request.json();'],
  ["import {overrideAdminReport} from './report-admin-override';",
    "const overrideAdminReport=async()=> 'already_processed';"],
  ["import {retryChairNotification} from './chair-dispatch';",
    'const retryChairNotification=(...args)=>globalThis.retryChairNotification(...args);'],
  ["import {processChairDeliveries} from './chair-delivery';",
    'const processChairDeliveries=async()=>({processed:0,sent:0,skipped:0,failed:0});'],
]);
const {processChairDeliveries}=await load('../src/chair-delivery.ts',[
  ["import {buildRefpahangEmail,sendRefpahangEmail} from '../mail';",
    `const buildRefpahangEmail=(_title,_name,paragraphs,action)=>({html:paragraphs.join(' '),
      text:paragraphs.join('\\n')+' '+action.url});
     const sendRefpahangEmail=async()=>{throw new Error('Unexpected live email');};`],
]);
const {assessmentDraft}=await load('../src/assessment-draft.ts',[
  ["import {currentUser,json} from './auth';",`const currentUser=async()=>globalThis.testUser;
    const json=(body,status=200)=>Response.json(body,{status});`],
  ["import {boundedJson} from './request';",'const boundedJson=async(request)=>request.json();'],
  ["import {submitAssessment} from './report-submission';",
    'const submitAssessment=(...args)=>globalThis.submitAssessmentReal(...args);'],
]);
globalThis.submitAssessmentReal=submitAssessment;
const directory=mkdtempSync(join(tmpdir(),'refpahang-ra-submit-'));
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
let beforeBatch=null;
const env={BASE_URL:'https://staging.example.test',STAGING_AUTH_ENABLED:'0',
  STAGING_WRITES_ENABLED:'0',REPORT_DELIVERY_ENABLED:'0',
  DB:{prepare:(sql)=>new Statement(sql),batch:async(statements)=>{
    if (beforeBatch) {const callback=beforeBatch;beforeBatch=null;callback();}
    db.exec('BEGIN');
    try {const result=statements.map((statement)=>statement.run());db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }}};
try {
  db.exec(readFileSync(new URL('../migrations/0003_assessment_drafts.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0005_report_confirmation_outbox.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0007_report_admin_override.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0006_report_submission_outbox.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0008_chair_assignment_queue.sql',import.meta.url),'utf8'));
  const candidates=db.prepare(`SELECT ra.id,ra.jadual_id,ra.pengadil_id
    FROM lantikan_pengadil ra JOIN jadual_perlawanan jp ON jp.id=ra.jadual_id
    JOIN kejohanan_pengesah_laporan kp ON kp.kejohanan_id=jp.kejohanan_id AND kp.aktif=1
    WHERE ra.jawatan='Penilai Pengadil' AND ra.status='Diterima' AND ra.pengadil_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM laporan_penilaian r WHERE r.lantikan_id=ra.id)
      AND (SELECT count(*) FROM lantikan_pengadil lp WHERE lp.jadual_id=ra.jadual_id
        AND lp.status='Diterima' AND lp.jawatan IN
          ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')) BETWEEN 3 AND 4
      AND EXISTS(SELECT 1 FROM lantikan_pengadil lp WHERE lp.jadual_id=ra.jadual_id
        AND lp.status='Diterima' AND lp.jawatan='Pengadil')
      AND EXISTS(SELECT 1 FROM lantikan_pengadil lp WHERE lp.jadual_id=ra.jadual_id
        AND lp.status='Diterima' AND lp.jawatan='Penolong Pengadil 1')
      AND EXISTS(SELECT 1 FROM lantikan_pengadil lp WHERE lp.jadual_id=ra.jadual_id
        AND lp.status='Diterima' AND lp.jawatan='Penolong Pengadil 2')
    ORDER BY ra.id LIMIT 3`).all();
  assert.ok(candidates.length>=2);
  function createDraft(candidate) {
    const info=db.prepare(`INSERT INTO laporan_penilaian
      (jadual_id,lantikan_id,penilai_id,status,created_at,updated_at)
      VALUES(?,?,?,'Draf',datetime('now'),datetime('now'))`)
      .run(candidate.jadual_id,candidate.id,candidate.pengadil_id);
    const reportId=Number(info.lastInsertRowid);
    const kup=db.prepare(`SELECT lp.id,lp.jawatan,
      COALESCE(u.nama_penuh,pl.nama,'Pegawai') AS nama
      FROM lantikan_pengadil lp LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
      WHERE lp.jadual_id=? AND lp.status='Diterima' AND lp.jawatan IN
        ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')`)
      .all(candidate.jadual_id);
    for (const person of kup) db.prepare(`INSERT INTO laporan_penilaian_pegawai
      (laporan_id,lantikan_pengadil_id,jawatan,nama_pengadil,markah)
      VALUES(?,?,?,?,?)`).run(reportId,person.id,person.jawatan,person.nama,'8.0');
    return {reportId,kup};
  }
  const first=createDraft(candidates[0]);
  const request=(body)=>new Request('https://staging.example.test/api/laporan-penilaian.php',{
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload={action:'hantar',id:first.reportId};
  globalThis.testUser={id:candidates[0].pengadil_id,role:'Penilai'};
  assert.equal((await submitAssessmentRequest(request(payload),env)).status,503);
  env.STAGING_AUTH_ENABLED='1';env.STAGING_WRITES_ENABLED='1';env.REPORT_DELIVERY_ENABLED='1';
  globalThis.testUser={id:candidates[0].pengadil_id+99999,role:'Penilai'};
  assert.equal((await submitAssessmentRequest(request(payload),env)).status,409);
  globalThis.testUser={id:candidates[0].pengadil_id,role:'Penilai'};
  const before={notifications:db.prepare('SELECT count(*) n FROM notifications').get().n,
    audit:db.prepare('SELECT count(*) n FROM laporan_pengesahan_audit').get().n};
  beforeBatch=()=>db.prepare(`UPDATE laporan_penilaian_pegawai SET markah=NULL WHERE laporan_id=?
    AND id=(SELECT min(id) FROM laporan_penilaian_pegawai WHERE laporan_id=?)`)
    .run(first.reportId,first.reportId);
  assert.equal((await submitAssessmentRequest(request(payload),env)).status,409);
  assert.equal(db.prepare('SELECT status FROM laporan_penilaian WHERE id=?')
    .get(first.reportId).status,'Draf');
  assert.equal(db.prepare('SELECT count(*) n FROM worker_report_submissions').get().n,0);
  db.prepare('UPDATE laporan_penilaian_pegawai SET markah=? WHERE laporan_id=?')
    .run('8.0',first.reportId);
  const response=await submitAssessmentRequest(request(payload),env);
  assert.equal(response.status,200,(await response.clone().json()).message);
  const result=await response.json();
  assert.equal(result.pengesahan.configured,1);
  assert.equal(db.prepare('SELECT status FROM laporan_penilaian WHERE id=?')
    .get(first.reportId).status,'Dihantar');
  const approval=db.prepare('SELECT * FROM laporan_pengesahan_pengerusi WHERE laporan_id=?')
    .get(first.reportId);
  assert.equal(approval.status,'Menunggu');
  assert.match(approval.approval_token,/^[a-f0-9]{64}$/);
  assert.equal(db.prepare('SELECT integrity_checked FROM worker_report_submissions WHERE report_id=?')
    .get(first.reportId).integrity_checked,1);
  const admins=db.prepare("SELECT count(*) n FROM users WHERE role='Admin' AND aktif=1").get().n;
  assert.equal(db.prepare('SELECT count(*) n FROM notifications').get().n-before.notifications,admins);
  assert.equal(db.prepare('SELECT count(*) n FROM laporan_pengesahan_audit').get().n-before.audit,2);
  assert.equal(db.prepare('SELECT count(*) n FROM worker_chair_jobs WHERE report_id=?')
    .get(first.reportId).n,2);
  const adminId=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get().id;
  globalThis.testUser={id:adminId,role:'Admin'};
  assert.equal((await submitAssessmentRequest(request({action:'log_pengerusi_link_copy',
    id:first.reportId}),env)).status,200);
  assert.equal(db.prepare(`SELECT count(*) n FROM laporan_pengesahan_audit
    WHERE laporan_id=? AND event_type='direct_link_copied' AND actor_user_id=?`)
    .get(first.reportId,adminId).n,1);
  globalThis.testUser={id:candidates[0].pengadil_id,role:'Penilai'};
  assert.equal((await submitAssessmentRequest(request(payload),env)).status,409);
  assert.equal(db.prepare('SELECT count(*) n FROM worker_chair_jobs WHERE report_id=?')
    .get(first.reportId).n,2);
  env.REPORT_DELIVERY_ENABLED='0';
  assert.equal((await processChairDeliveries(env)).processed,0);
  env.REPORT_DELIVERY_ENABLED='1';
  const sent=[];
  const senders={email:async(_env,to,_name,_subject,_html,text)=>{
    assert.match(text,/laporan-pengesahan-token\.php\?token=/);sent.push(to);
  },telegram:async(_env,chatId,_message,url)=>{
    assert.match(url,/laporan-pengesahan-token\.php\?token=/);sent.push(chatId);
  }};
  const delivered=await processChairDeliveries(env,20,senders);
  assert.equal(delivered.processed,2);
  assert.equal(delivered.failed,0);
  assert.equal(delivered.sent+delivered.skipped,2);
  assert.equal(sent.length,delivered.sent);
  assert.equal((await processChairDeliveries(env,20,senders)).processed,0);
  const second=createDraft(candidates[1]);
  db.prepare('UPDATE laporan_penilaian_pegawai SET markah=NULL WHERE laporan_id=?')
    .run(second.reportId);
  assert.equal((await submitAssessment(env,second.reportId,candidates[1].pengadil_id)).status,400);
  assert.equal(db.prepare('SELECT count(*) n FROM worker_report_submissions WHERE report_id=?')
    .get(second.reportId).n,0);
  db.prepare('UPDATE laporan_penilaian_pegawai SET markah=? WHERE laporan_id=?')
    .run('8.0',second.reportId);
  const secondToken=db.prepare('SELECT penilaian_token FROM lantikan_pengadil WHERE id=?')
    .get(candidates[1].id).penilaian_token;
  assert.equal((await submitAssessment(env,second.reportId,null,'0'.repeat(64))).status,409);
  db.prepare('DELETE FROM laporan_penilaian_pegawai WHERE laporan_id=?').run(second.reportId);
  db.prepare('DELETE FROM laporan_penilaian WHERE id=?').run(second.reportId);
  const tokenPost=new Request('https://staging.example.test/api/penilaian-token.php',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      token:secondToken,hantar:true,tahap_kesukaran:'Normal',cuaca:'Cerah',
      pegawai:second.kup.map((official)=>({lantikan_pengadil_id:official.id,
        markah:'8.0',prestasi:'Baik'})),
    }),
  });
  const posted=await assessmentDraft(tokenPost,env,'token');
  assert.equal(posted.status,200);
  const tokenResult=await posted.json();
  assert.equal(tokenResult.error,false);
  assert.equal(db.prepare('SELECT status FROM laporan_penilaian WHERE id=?')
    .get(tokenResult.id).status,'Dihantar');
  const retry=await processChairDeliveries(env,1,{...senders,
    email:async()=>{throw new Error('Synthetic provider failure');}});
  assert.equal(retry.failed,1);
  assert.equal(db.prepare(`SELECT count(*) n FROM worker_chair_jobs
    WHERE report_id=? AND channel='email' AND status='pending' AND attempts=1`)
    .get(tokenResult.id).n,1);
  const withoutChair=db.prepare(`SELECT ra.id,ra.jadual_id,ra.pengadil_id
    FROM lantikan_pengadil ra JOIN jadual_perlawanan jp ON jp.id=ra.jadual_id
    LEFT JOIN kejohanan_pengesah_laporan kp ON kp.kejohanan_id=jp.kejohanan_id AND kp.aktif=1
    WHERE ra.jawatan='Penilai Pengadil' AND ra.status='Diterima'
      AND ra.pengadil_id IS NOT NULL AND kp.id IS NULL
      AND NOT EXISTS(SELECT 1 FROM laporan_penilaian r WHERE r.lantikan_id=ra.id)
      AND (SELECT count(*) FROM lantikan_pengadil lp WHERE lp.jadual_id=ra.jadual_id
        AND lp.status='Diterima' AND lp.jawatan IN
          ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')) BETWEEN 3 AND 4
      AND EXISTS(SELECT 1 FROM lantikan_pengadil lp WHERE lp.jadual_id=ra.jadual_id
        AND lp.status='Diterima' AND lp.jawatan='Pengadil')
      AND EXISTS(SELECT 1 FROM lantikan_pengadil lp WHERE lp.jadual_id=ra.jadual_id
        AND lp.status='Diterima' AND lp.jawatan='Penolong Pengadil 1')
      AND EXISTS(SELECT 1 FROM lantikan_pengadil lp WHERE lp.jadual_id=ra.jadual_id
        AND lp.status='Diterima' AND lp.jawatan='Penolong Pengadil 2')
    ORDER BY ra.id LIMIT 1`).get();
  assert.ok(withoutChair);
  const noChairDraft=createDraft(withoutChair);
  const noChair=await submitAssessment(env,noChairDraft.reportId,withoutChair.pengadil_id);
  assert.equal(noChair.status,200);
  assert.equal((await noChair.json()).pengesahan.configured,0);
  assert.equal(db.prepare('SELECT approval_token FROM laporan_pengesahan_pengerusi WHERE laporan_id=?')
    .get(noChairDraft.reportId).approval_token,null);
  assert.equal(db.prepare('SELECT count(*) n FROM worker_chair_jobs WHERE report_id=?')
    .get(noChairDraft.reportId).n,0);
  console.log('RA submission: imported D1 atomicity, chair queue, Admin copy, delivery and guards passed');
} finally {db.close();rmSync(directory,{recursive:true,force:true});}
