import assert from 'node:assert/strict';
import {copyFileSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

function load(file,replacements=[]) {
  let source=readFileSync(new URL(file,import.meta.url),'utf8');
  for (const [before,after] of replacements) {
    assert.ok(source.includes(before),`${file}: ${before}`);
    source=source.replace(before,after);
  }
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext}}).outputText;
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
}
const authStub=`const currentUser=async()=>globalThis.testUser;
  const json=(body,status=200)=>Response.json(body,{status});`;
const {processChairDeliveries}=await load('../src/chair-delivery.ts',[
  ["import {buildRefpahangEmail,sendRefpahangEmail} from '../mail';",
    `const buildRefpahangEmail=(_title,_name,paragraphs,action)=>({html:paragraphs.join(' '),
      text:paragraphs.join('\\n')+' '+action.url});
     const sendRefpahangEmail=async()=>{throw new Error('Unexpected live email');};`],
]);
globalThis.processChairDeliveries=processChairDeliveries;
const dispatch=await load('../src/chair-dispatch.ts',[
  ["import {processChairDeliveries} from './chair-delivery';",
    'const processChairDeliveries=(...args)=>globalThis.processChairDeliveries(...args);'],
]);
globalThis.chairDispatch=dispatch;
globalThis.retryChairNotification=(env,id,adminId)=>
  dispatch.retryChairNotification(env,id,adminId,globalThis.senders);
const {chairConfig}=await load('../src/chair-config.ts',[
  ["import { currentUser, json } from './auth';",authStub],
  ["import { chairDispatchIntegrity, chairDispatchStatements, sendChairJobsNow } from './chair-dispatch';",
    `const chairDispatchIntegrity=(...args)=>globalThis.chairDispatch.chairDispatchIntegrity(...args);
     const chairDispatchStatements=(...args)=>globalThis.chairDispatch.chairDispatchStatements(...args);
     const sendChairJobsNow=(env,nonce)=>globalThis.chairDispatch.sendChairJobsNow(env,nonce,globalThis.senders);`],
  ["import { boundedJson } from './request';",'const boundedJson=async(request)=>request.json();'],
]);
const {submitAssessmentRequest}=await load('../src/report-submission.ts',[
  ["import {currentUser,json} from './auth';",authStub],
  ["import {boundedJson} from './request';",'const boundedJson=async(request)=>request.json();'],
  ["import {overrideAdminReport} from './report-admin-override';",
    "const overrideAdminReport=async()=>'already_processed';"],
  ["import {retryChairNotification} from './chair-dispatch';",
    'const retryChairNotification=(...args)=>globalThis.retryChairNotification(...args);'],
  ["import {processChairDeliveries} from './chair-delivery';",
    'const processChairDeliveries=(...args)=>globalThis.processChairDeliveries(...args);'],
]);

const directory=mkdtempSync(join(tmpdir(),'refpahang-chair-assign-'));
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
const count=(sql,...values)=>db.prepare(sql).get(...values).n;
const approvalOf=(reportId)=>db.prepare(
  'SELECT * FROM laporan_pengesahan_pengerusi WHERE laporan_id=?').get(reportId);
const post=(body)=>chairConfig(new Request(
  'https://staging.example.test/api/kejohanan-pengesah-laporan.php',{method:'POST',
    headers:{'Content-Type':'application/json','User-Agent':'Chair test'},
    body:JSON.stringify(body)}),env);
const put=(body)=>submitAssessmentRequest(new Request(
  'https://staging.example.test/api/laporan-penilaian.php',{method:'PUT',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env);

try {
  for (const file of ['0003_assessment_drafts','0005_report_confirmation_outbox',
    '0007_report_admin_override','0006_report_submission_outbox','0008_chair_assignment_queue']) {
    db.exec(readFileSync(new URL(`../migrations/${file}.sql`,import.meta.url),'utf8'));
  }
  const tournament=16;
  const mapping=db.prepare(`SELECT * FROM kejohanan_pengesah_laporan
    WHERE kejohanan_id=? AND aktif=1`).get(tournament);
  assert.ok(mapping?.pengesah_luar_id,'Tournament 16 starts with an external chair');
  const reports=db.prepare(`SELECT r.id FROM laporan_penilaian r
    JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
    JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id AND ra.jadual_id=r.jadual_id
      AND ra.jawatan='Penilai Pengadil' AND ra.status='Diterima'
    JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=r.id
    WHERE jp.kejohanan_id=? AND r.status='Disahkan' ORDER BY r.id LIMIT 3`).all(tournament);
  assert.equal(reports.length,3);
  const [notified,unprepared,unmapped]=reports.map((row)=>row.id);
  // PHP-era pending reports: notified, without approval state, and prepared
  // while the tournament had no chair.
  db.prepare("UPDATE laporan_penilaian SET status='Dihantar' WHERE id IN (?,?,?)")
    .run(notified,unprepared,unmapped);
  db.prepare(`UPDATE laporan_pengesahan_pengerusi SET status='Menunggu',
    email_sent_at='2026-10-01 10:00:00',telegram_sent_at='2026-10-01 10:00:00'
    WHERE laporan_id=?`).run(notified);
  db.prepare(`UPDATE laporan_pengesahan_pengerusi SET status='Menunggu',
    kejohanan_pengesah_id=NULL,pengesah_user_id=NULL,pengesah_luar_id=NULL,
    approval_token=NULL,email_sent_at=NULL,telegram_sent_at=NULL WHERE laporan_id=?`)
    .run(unmapped);
  db.prepare('DELETE FROM laporan_pengesahan_audit WHERE laporan_id=?').run(unprepared);
  db.prepare('DELETE FROM laporan_pengesahan_pengerusi WHERE laporan_id=?').run(unprepared);
  const notifiedApproval=db.prepare('SELECT * FROM laporan_pengesahan_pengerusi WHERE laporan_id=?')
    .get(notified);
  const oldToken=notifiedApproval.approval_token;
  assert.match(oldToken,/^[a-f0-9]{64}$/);
  db.prepare(`INSERT INTO worker_chair_jobs(delivery_key,approval_id,report_id,token_tag,channel,origin)
    VALUES('stale',?,?,?,'email','submission')`).run(notifiedApproval.id,notified,'f'.repeat(16));

  const eligible=db.prepare(`SELECT id,email,telegram_chat_id FROM users
    WHERE aktif=1 AND (role='Penilai' OR jenis_pengadil='Penilai Pengadil')
      AND trim(COALESCE(email,''))<>'' AND telegram_chat_id IS NOT NULL
    ORDER BY id LIMIT 2`).all();
  assert.equal(eligible.length,2);
  const [chairB,silent]=eligible;
  db.prepare("UPDATE users SET email='',telegram_chat_id=NULL WHERE id=?").run(silent.id);
  const outsider=db.prepare(`SELECT id FROM users WHERE aktif=1 AND role='Pengadil'
    AND COALESCE(jenis_pengadil,'')<>'Penilai Pengadil' LIMIT 1`).get();
  const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
  const admins=count("SELECT count(*) n FROM users WHERE role='Admin' AND aktif=1");
  const assign=(official,extra={})=>post({kejohanan_id:tournament,source:'Berdaftar',
    official_id:official.id,jawatan:'Pengerusi Pengadil',...extra});
  const sent=[];
  globalThis.senders={email:async(_env,to,_name,_subject,_html,text)=>{
    assert.match(text,/laporan-pengesahan-token\.php\?token=[a-f0-9]{64}/);
    assert.match(text,/download-laporan-penilaian\.php\?id=\d+&approval_token=[a-f0-9]{64}/);
    sent.push(to);
  },telegram:async(_env,chatId,_message,url)=>{
    assert.match(url,/laporan-pengesahan-token\.php\?token=/);sent.push(chatId);
  }};

  globalThis.testUser={id:admin.id,role:'Admin'};
  assert.equal((await assign(chairB)).status,503);
  env.STAGING_AUTH_ENABLED='1';env.STAGING_WRITES_ENABLED='1';env.REPORT_DELIVERY_ENABLED='1';
  globalThis.testUser={id:chairB.id,role:'Penilai'};
  assert.equal((await assign(chairB)).status,403);
  globalThis.testUser={id:admin.id,role:'Admin'};
  assert.equal((await assign(chairB,{source:'Lain'})).status,400);
  assert.equal((await assign(chairB,{kejohanan_id:999999})).status,404);
  assert.equal((await assign(outsider)).status,422);
  assert.equal((await assign(silent)).status,422);
  assert.equal(count('SELECT count(*) n FROM worker_chair_assignments'),0);

  // A concurrent change between read and batch aborts everything.
  beforeBatch=()=>db.prepare(`UPDATE kejohanan_pengesah_laporan
    SET updated_at='2026-10-15 00:00:00' WHERE id=?`).run(mapping.id);
  assert.equal((await assign(chairB)).status,409);
  assert.equal(approvalOf(unprepared),undefined);
  assert.equal(count('SELECT count(*) n FROM worker_chair_assignments'),0);
  assert.equal(sent.length,0);

  const notificationsBefore=count('SELECT count(*) n FROM notifications');
  const successBefore=()=>count(`SELECT count(*) n FROM laporan_pengesahan_audit
    WHERE event_type='chair_notification' AND event_status='success'
      AND link_url LIKE '%laporan-pengesahan-token.php?token=%'`);
  const successStart=successBefore();
  const assigned=await assign(chairB);
  assert.equal(assigned.status,200,(await assigned.clone().json()).message);
  const assignedBody=await assigned.json();
  assert.equal(assignedBody.message,'Pengerusi Pengadil berjaya ditetapkan untuk kejohanan ini.');
  assert.equal(assignedBody.data.pending_dispatched,3);
  assert.equal(assignedBody.data.pending_failed,0);
  assert.equal(assignedBody.data.current.pengesah_user_id,chairB.id);
  assert.doesNotMatch(JSON.stringify(assignedBody),/telegram_chat_id/);
  const updated=db.prepare('SELECT * FROM kejohanan_pengesah_laporan WHERE kejohanan_id=?')
    .get(tournament);
  assert.equal(updated.id,mapping.id);
  assert.equal(updated.pengesah_user_id,chairB.id);
  assert.equal(updated.pengesah_luar_id,null);
  assert.equal(updated.created_by,admin.id);
  const chairAudit=db.prepare(`SELECT * FROM kejohanan_pengesah_laporan_audit
    WHERE kejohanan_id=? ORDER BY id DESC LIMIT 1`).get(tournament);
  assert.equal(chairAudit.event_type,'chair_changed');
  assert.equal(JSON.parse(chairAudit.old_identity_json).pengesah_luar_id,mapping.pengesah_luar_id);
  assert.equal(JSON.parse(chairAudit.new_identity_json).official_id,chairB.id);

  // PHP keeps the mapping id, so a new chair person is a contact refresh:
  // same token, new recipients, channels already sent are not repeated.
  const refreshed=approvalOf(notified);
  assert.equal(refreshed.approval_token,oldToken);
  assert.equal(refreshed.email_recipient,chairB.email);
  assert.equal(String(refreshed.telegram_chat_id),String(chairB.telegram_chat_id));
  assert.ok(refreshed.email_sent_at && refreshed.telegram_sent_at);
  const refreshAudit=db.prepare(`SELECT link_url FROM laporan_pengesahan_audit
    WHERE laporan_id=? AND event_type='approver_contact_refreshed'`).get(notified);
  assert.match(refreshAudit.link_url,new RegExp(`token=${oldToken}$`));
  assert.equal(db.prepare("SELECT status,last_error FROM worker_chair_jobs WHERE delivery_key='stale'")
    .get().status,'skipped');

  const prepared=approvalOf(unprepared);
  assert.equal(prepared.status,'Menunggu');
  assert.equal(prepared.kejohanan_pengesah_id,mapping.id);
  assert.match(prepared.approval_token,/^[a-f0-9]{64}$/);
  assert.ok(prepared.admin_copy_at && prepared.email_sent_at && prepared.telegram_sent_at);
  const rotated=approvalOf(unmapped);
  assert.equal(rotated.kejohanan_pengesah_id,mapping.id);
  assert.match(rotated.approval_token,/^[a-f0-9]{64}$/);
  assert.ok(rotated.email_sent_at && rotated.telegram_sent_at);
  assert.equal(count('SELECT count(*) n FROM notifications')-notificationsBefore,admins);
  assert.equal(count(`SELECT count(*) n FROM laporan_pengesahan_audit WHERE laporan_id=?
    AND event_type='approver_changed' AND link_url LIKE '%token=%'`,unmapped),1);
  assert.equal(count(`SELECT count(*) n FROM laporan_pengesahan_audit WHERE laporan_id=?
    AND event_type IN ('approval_prepared','admin_copy_created')`,unprepared),2);
  assert.equal(successBefore()-successStart,4);
  assert.equal(sent.length,4);
  assert.deepEqual([...new Set(sent.map(String))].sort(),
    [chairB.email,String(chairB.telegram_chat_id)].sort());
  assert.equal(count("SELECT count(*) n FROM worker_chair_jobs WHERE status='pending'"),0);
  assert.equal(count('SELECT count(*) n FROM worker_chair_assignments WHERE integrity_checked=1'),1);

  // Saving the same chair again changes nothing and sends nothing.
  sent.length=0;
  const tokens=[notified,unprepared,unmapped].map((id)=>approvalOf(id).approval_token);
  const again=await assign(chairB);
  assert.equal(again.status,200);
  assert.equal((await again.json()).data.pending_dispatched,3);
  assert.deepEqual([notified,unprepared,unmapped].map((id)=>approvalOf(id).approval_token),tokens);
  assert.equal(sent.length,0);

  // Admin retry resends only the channel that never arrived, immediately.
  db.prepare(`UPDATE laporan_pengesahan_pengerusi SET email_sent_at=NULL,
    email_last_error='send_failed' WHERE laporan_id=?`).run(notified);
  globalThis.testUser={id:chairB.id,role:'Penilai'};
  assert.equal((await put({action:'retry_pengerusi_notification',id:notified})).status,403);
  globalThis.testUser={id:admin.id,role:'Admin'};
  const retried=await put({action:'retry_pengerusi_notification',id:notified});
  assert.equal(retried.status,200);
  const retryBody=await retried.json();
  assert.equal(retryBody.pengesahan.configured,true);
  assert.equal(retryBody.pengesahan.email_sent,true);
  assert.match(retryBody.message,/Sekurang-kurangnya satu saluran berjaya/);
  assert.doesNotMatch(JSON.stringify(retryBody),/approval_token/);
  assert.deepEqual(sent,[chairB.email]);
  assert.equal(approvalOf(notified).approval_token,oldToken);

  // A failed provider is logged as failed and stays queued for cron.
  db.prepare(`UPDATE laporan_pengesahan_pengerusi SET email_sent_at=NULL,telegram_sent_at=NULL
    WHERE laporan_id=?`).run(unprepared);
  const failedBefore=count(`SELECT count(*) n FROM laporan_pengesahan_audit
    WHERE laporan_id=? AND event_type='chair_notification' AND event_status='failed'`,unprepared);
  const working=globalThis.senders;
  globalThis.senders={email:async()=>{throw new Error('Synthetic failure');},
    telegram:async()=>{throw new Error('Synthetic failure');}};
  const failed=await (await put({action:'retry_pengerusi_notification',id:unprepared})).json();
  assert.equal(failed.pengesahan.email_sent,false);
  assert.equal(failed.pengesahan.telegram_sent,false);
  assert.match(failed.message,/tiada saluran berjaya/);
  assert.equal(count(`SELECT count(*) n FROM worker_chair_jobs
    WHERE report_id=? AND status='pending' AND attempts=1`,unprepared),2);
  assert.equal(count(`SELECT count(*) n FROM laporan_pengesahan_audit
    WHERE laporan_id=? AND event_type='chair_notification' AND event_status='failed'`,unprepared)
    -failedBefore,2);
  globalThis.senders=working;

  db.prepare("UPDATE laporan_pengesahan_pengerusi SET status='Disahkan' WHERE laporan_id=?")
    .run(notified);
  db.prepare("UPDATE laporan_penilaian SET status='Disahkan' WHERE id=?").run(notified);
  assert.equal((await put({action:'retry_pengerusi_notification',id:notified})).status,409);
  console.log('chair assignment: PHP parity for pending reports, refresh, rotation, inline send, retry and guards passed');
} finally {db.close();rmSync(directory,{recursive:true,force:true});}
