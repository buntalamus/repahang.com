import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {externalTelegramBlastPreview}=await bundle(
  "export {externalTelegramBlastPreview} from '../src/telegram-blast-preview';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0010_worker_write_guards']);
const sent=[];
let failAll=false;
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'0',
  BULK_EMAIL_ENABLED:'0',TELEGRAM_BOT_USERNAME:'refpahang_bot',
  MAIL_LANTIKAN_USER:'lantikan@example.test',MAIL_LANTIKAN_NAME:'PBNP',
  EMAIL:{send:async message=>{
    sent.push(message);
    if (failAll) throw new Error('synthetic provider failure');
    return {messageId:'synthetic'};
  }}};
const endpoint='https://staging.example.test/api/pengadil-luar-telegram-blast.php';
const request=(cookie,body)=>new Request(endpoint,{method:'POST',headers:{Cookie:cookie},
  body:JSON.stringify(body)});
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const referee=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 1").get();
const adminCookie=await sessionCookie(db,admin.id);
const refereeCookie=await sessionCookie(db,referee.id);
const initial={kejohanan_id:16,mode:'initial'};

try {
  assert.equal((await externalTelegramBlastPreview(request('',initial),env)).status,401);
  assert.equal((await externalTelegramBlastPreview(request(refereeCookie,initial),env)).status,403);
  assert.equal((await externalTelegramBlastPreview(request(adminCookie,initial),env)).status,503);
  env.STAGING_WRITES_ENABLED='1';
  assert.equal((await externalTelegramBlastPreview(request(adminCookie,initial),env)).status,503);
  env.BULK_EMAIL_ENABLED='1';
  assert.equal((await externalTelegramBlastPreview(request(adminCookie,{kejohanan_id:0}),env)).status,400);
  assert.equal((await externalTelegramBlastPreview(request(adminCookie,{kejohanan_id:16,mode:'other'}),env)).status,400);
  assert.equal((await externalTelegramBlastPreview(request(adminCookie,{kejohanan_id:999999}),env)).status,404);
  const ids=db.prepare(`SELECT pl.id FROM pool_pengadil pp JOIN pengadil_luar pl
    ON pl.id=pp.pengadil_luar_id WHERE pp.kejohanan_id=16
    ORDER BY pl.id LIMIT 4`).all().map(row=>row.id);
  assert.equal(ids.length,4);
  db.prepare(`DELETE FROM pool_pengadil WHERE kejohanan_id=16
    AND (pengadil_luar_id IS NULL OR pengadil_luar_id NOT IN (?,?,?,?))`).run(...ids);
  for(let i=0;i<ids.length;i++){
    db.prepare(`UPDATE pengadil_luar SET emel=?,telegram_chat_id=NULL,tg_link_token=NULL
      WHERE id=?`).run(`referee${i+1}@example.test`,ids[i]);
    db.prepare(`INSERT OR IGNORE INTO telegram_onboarding_state
      (kejohanan_id,pengadil_luar_id) VALUES (16,?)`).run(ids[i]);
    db.prepare(`UPDATE telegram_onboarding_state SET first_sent_at=NULL,claimed_at=NULL,
      claim_token=NULL WHERE kejohanan_id=16 AND pengadil_luar_id=?`).run(ids[i]);
  }
  const beforeAppointments=db.prepare('SELECT count(*) AS total FROM lantikan_pengadil').get().total;
  const before=db.prepare('SELECT count(*) AS total FROM telegram_onboarding_batch').get().total;
  const first=await externalTelegramBlastPreview(request(adminCookie,initial),env);
  assert.equal(first.status,200);
  const result=await first.json();
  assert.equal(result.error,false);
  assert.equal(result.mode,'initial');
  assert.equal(result.sent,4);
  assert.equal(result.failed,0);
  assert.equal(result.data.counts.total_external,4);
  assert.equal(sent.length,4);
  assert.equal(db.prepare('SELECT count(*) AS total FROM telegram_onboarding_batch').get().total,before+1);
  assert.equal(db.prepare('SELECT count(*) AS total FROM lantikan_pengadil').get().total,beforeAppointments);
  for(let i=0;i<ids.length;i++){
    const state=db.prepare(`SELECT first_sent_at,last_sent_at,claim_token,attempts
      FROM telegram_onboarding_state WHERE kejohanan_id=16 AND pengadil_luar_id=?`).get(ids[i]);
    assert.ok(state.first_sent_at);
    assert.ok(state.last_sent_at);
    assert.equal(state.claim_token,null);
    assert.match(db.prepare('SELECT tg_link_token FROM pengadil_luar WHERE id=?').get(ids[i]).tg_link_token,
      /^[a-f0-9]{32}$/);
    assert.ok(sent[i].html.includes('INI BUKAN LANTIKAN PERLAWANAN'));
    assert.equal(sent[i].from.email,'lantikan@example.test');
  }
  const repeat=await (await externalTelegramBlastPreview(request(adminCookie,initial),env)).json();
  assert.equal(repeat.sent,0);
  assert.equal(sent.length,4);
  assert.equal(repeat.skipped,4);
  const resend=await (await externalTelegramBlastPreview(request(adminCookie,
    {kejohanan_id:16,mode:'resend'}),env)).json();
  assert.equal(resend.sent,4);
  assert.equal(sent.length,8);
  failAll=true;
  const failed=await (await externalTelegramBlastPreview(request(adminCookie,
    {kejohanan_id:16,mode:'resend'}),env)).json();
  assert.equal(failed.failed,3);
  assert.equal(failed.smtp_circuit_open,true);
  assert.ok(failed.skipped>=1);
  assert.equal(db.prepare(`SELECT count(*) AS total FROM telegram_onboarding_log
    WHERE batch_id=? AND event_status='failed'`).get(failed.batch_id).total,3);
  assert.equal(db.prepare('SELECT count(*) AS total FROM lantikan_pengadil').get().total,beforeAppointments);
  console.log('External Telegram onboarding: roles, gates, claims, logs, retries and circuit passed');
} finally {close();}
