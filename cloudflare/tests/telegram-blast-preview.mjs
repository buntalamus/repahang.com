import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminTelegramBlastPreview,externalTelegramBlastPreview,processMailboxCampaigns:run}=await bundle(
  "export {adminTelegramBlastPreview,externalTelegramBlastPreview} from '../src/telegram-blast-preview'; export {processMailboxCampaigns} from '../src/mailbox-campaigns';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0013_mailbox','0021_mailbox_imap',
  '0023_mailbox_campaigns','0025_telegram_blast_queue']);
const messages=[],objects=new Map();
const MEDIA={async put(key,value){objects.set(key,value);},async delete(key){objects.delete(key);}};
let now=Date.now();const originalNow=Date.now;Date.now=()=>now;
const tick=()=>{now+=301000;};
const env={DB,MEDIA,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'0',BULK_EMAIL_ENABLED:'0',
  TELEGRAM_BOT_USERNAME:'refpahang_bot',MAIL_ADMIN_USER:'admin@refpahang.example',
  MAIL_ADMIN_NAME:'PBNP',EMAIL:{send:async message=>{
    messages.push(message);
    if (globalThis.failRecipient===message.to.email) throw new Error('simulated delivery failure');
    return {messageId:'test'};
  }}};
const main='https://staging.example.test/api/admin-telegram-blast.php';
const external='https://staging.example.test/api/pengadil-luar-telegram-blast.php';
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const referee=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 1").get();
const adminCookie=await sessionCookie(db,admin.id);
const refereeCookie=await sessionCookie(db,referee.id);
const get=(url,cookie)=>new Request(url,{headers:cookie?{Cookie:cookie}:{}});
const post=(cookie,body={action:'start'})=>new Request(main,{method:'POST',headers:cookie?{Cookie:cookie}:{},
  body:JSON.stringify(body)});
const call=async(body)=>{const response=await adminTelegramBlastPreview(post(adminCookie,body),env);
  return {status:response.status,...await response.json()};};
const status=async()=>(await (await adminTelegramBlastPreview(get(main,adminCookie),env)).json()).batch;

try {
  assert.equal((await adminTelegramBlastPreview(get(main),env)).status,401);
  assert.equal((await externalTelegramBlastPreview(get(`${external}?kejohanan_id=16`),env)).status,401);
  assert.equal((await adminTelegramBlastPreview(get(main,refereeCookie),env)).status,403);
  assert.equal((await externalTelegramBlastPreview(get(`${external}?kejohanan_id=16`,refereeCookie),env)).status,403);
  const stats=await (await adminTelegramBlastPreview(get(main,adminCookie),env)).json();
  const expected=db.prepare(`SELECT count(*) AS total,sum(CASE WHEN telegram_chat_id IS NOT NULL
    AND trim(telegram_chat_id)<>'' THEN 1 ELSE 0 END) AS linked,
    sum(CASE WHEN aktif=1 AND trim(COALESCE(telegram_chat_id,''))='' THEN 1 ELSE 0 END) AS active_not_linked,
    sum(CASE WHEN aktif<>1 AND trim(COALESCE(telegram_chat_id,''))='' THEN 1 ELSE 0 END) AS inactive_not_linked
    FROM users WHERE email IS NOT NULL AND trim(email)<>''`).get();
  assert.deepEqual({total:stats.total,linked:stats.linked,not_linked:stats.not_linked,
    active_not_linked:stats.active_not_linked,inactive_not_linked:stats.inactive_not_linked},
    {total:expected.total,linked:expected.linked,not_linked:expected.total-expected.linked,
      active_not_linked:expected.active_not_linked,inactive_not_linked:expected.inactive_not_linked});
  assert.equal((await adminTelegramBlastPreview(post(adminCookie),env)).status,503);
  assert.equal(messages.length,0);
  assert.equal((await externalTelegramBlastPreview(get(external,adminCookie),env)).status,400);
  assert.equal((await externalTelegramBlastPreview(get(`${external}?kejohanan_id=999999`,adminCookie),env)).status,404);
  const response=await externalTelegramBlastPreview(get(`${external}?kejohanan_id=16`,adminCookie),env);
  assert.equal(response.status,200);
  const preview=(await response.json()).data;
  assert.equal(preview.counts.total_external,76);
  assert.equal(preview.recipients.length,76);
  assert.equal(preview.recent_batches.length<=10,true);
  assert.equal(preview.counts.total_external,
    ['linked','no_email','invalid_email','ready','failed','emailed_waiting']
      .reduce((n,key)=>n+preview.counts[key],0));
  for(const recipient of preview.recipients){
    assert.equal('tg_link_token' in recipient,false);
    assert.equal('telegram_chat_id' in recipient,false);
  }
  assert.equal((await externalTelegramBlastPreview(new Request(`${external}?kejohanan_id=16`,
    {method:'POST',headers:{Cookie:adminCookie}}),env)).status,503);

  const invitees=db.prepare(`SELECT id,email FROM users WHERE aktif=1 AND email IS NOT NULL
    AND trim(email)<>'' AND (telegram_chat_id IS NULL OR trim(telegram_chat_id)='')
    AND id<>? ORDER BY id LIMIT 3`).all(admin.id);
  assert.equal(invitees.length,3);
  db.prepare('UPDATE users SET telegram_chat_id=123456 WHERE id NOT IN (?,?,?)')
    .run(invitees[0].id,invitees[1].id,invitees[2].id);
  db.prepare('UPDATE users SET aktif=0,tg_link_token=NULL WHERE id=?').run(invitees[2].id);
  db.prepare('UPDATE users SET tg_link_token=NULL WHERE id IN (?,?)')
    .run(invitees[0].id,invitees[1].id);
  db.prepare('UPDATE users SET telegram_chat_id=123456 WHERE id=?').run(admin.id);
  const filtered=await (await adminTelegramBlastPreview(get(main,adminCookie),env)).json();
  assert.equal(filtered.not_linked,3);
  assert.equal(filtered.active_not_linked,2);
  assert.equal(filtered.inactive_not_linked,1);
  assert.equal(filtered.batch,null);
  env.STAGING_WRITES_ENABLED='1';
  assert.equal((await adminTelegramBlastPreview(post(adminCookie),env)).status,503);
  env.BULK_EMAIL_ENABLED='1';
  db.exec('UPDATE worker_sessions SET expires_at=expires_at+86400');
  ['A SATU','B DUA','C TIGA'].forEach((name,i)=>db.prepare('UPDATE users SET nama_penuh=? WHERE id=?').run(name,invitees[i].id));

  // Starting a blast freezes the list and creates links, but never sends from the request.
  const first=await call({action:'start'});
  assert.equal(first.error,false,first.message);
  assert.equal(first.batch.total,3);
  assert.equal(first.batch.counts.pending,3);
  assert.equal(messages.length,0);
  for(const invitee of invitees){
    assert.match(db.prepare('SELECT tg_link_token FROM users WHERE id=?').get(invitee.id).tg_link_token,/^[a-f0-9]{32}$/);
  }
  assert.equal((await call({action:'start'})).status,409,'one blast at a time');

  // The cron sends in name order and pauses at the first delivery error.
  globalThis.failRecipient=invitees[1].email;
  await run(env);
  assert.deepEqual(messages.map(message=>message.to.email),[invitees[0].email,invitees[1].email]);
  tick();await run(env);
  assert.equal(messages.length,3);
  let batch=await status();
  assert.equal(batch.status,'completed');
  assert.deepEqual([batch.counts.sent,batch.counts.uncertain],[2,1]);
  assert.ok(messages.every(message=>message.from.email==='admin@refpahang.example'));
  for(const invitee of invitees){
    const token=db.prepare('SELECT tg_link_token FROM users WHERE id=?').get(invitee.id).tg_link_token;
    const message=messages.find(row=>row.to.email===invitee.email);
    assert.ok(message.html.includes(`https://t.me/refpahang_bot?start=${token}`));
  }
  // Every attempt keeps a Peti Emel "Dihantar" copy.
  const copies=db.prepare(`SELECT recipient,delivery_status FROM mailbox_messages
    WHERE folder='sent' AND request_id LIKE 'telegram-blast:%' ORDER BY recipient`).all();
  assert.equal(copies.length,3);
  assert.equal(copies.filter(row=>row.delivery_status==='sent').length,2);
  assert.equal(objects.size,3);

  // Retry resends the uncertain address once the next batch window opens.
  globalThis.failRecipient=null;
  const retry=await call({action:'retry-failed',id:batch.id});
  assert.equal(retry.error,false);
  assert.equal(retry.batch.status,'queued');
  await run(env);assert.equal(messages.length,3,'the shared five-minute window still applies');
  tick();await run(env);
  assert.equal(messages.length,4);
  assert.equal(messages[3].to.email,invitees[1].email);
  batch=await status();
  assert.deepEqual([batch.status,batch.counts.sent,batch.counts.uncertain],['completed',3,0]);

  // An account linked after the start is skipped without using the budget.
  const second=await call({action:'start'});
  assert.equal(second.batch.total,3);
  db.prepare('UPDATE users SET telegram_chat_id=777 WHERE id=?').run(invitees[0].id);
  tick();await run(env);
  batch=await status();
  assert.deepEqual([batch.counts.skipped,batch.counts.sent,batch.status],[1,2,'completed']);
  assert.equal(batch.linked_since,0);
  assert.equal(messages.length,6);

  // Cancelling stops every email that has not been sent.
  const third=await call({action:'start'});
  assert.equal(third.batch.total,2);
  assert.equal((await call({action:'cancel',id:third.batch.id})).error,false);
  tick();await run(env);
  assert.equal(messages.length,6);
  assert.equal((await status()).counts.cancelled,2);

  // Ten addresses per five minutes, shared with the mailbox campaigns.
  const extra=db.prepare(`SELECT id FROM users WHERE id NOT IN (?,?,?,?) ORDER BY id LIMIT 12`)
    .all(admin.id,...invitees.map(row=>row.id));
  for(const [i,row] of extra.entries()){
    db.prepare("UPDATE users SET telegram_chat_id=NULL,email=?,nama_penuh=? WHERE id=?")
      .run(`blast${i}@example.test`,`D PENGGUNA ${String(i).padStart(2,'0')}`,row.id);
  }
  const fourth=await call({action:'start'});
  assert.equal(fourth.batch.total,14);
  tick();await Promise.all([run(env),run(env)]);
  assert.equal(messages.length,16,'one lease, ten emails');
  tick();await run(env);
  assert.equal(messages.length,20);
  assert.equal((await status()).status,'completed');
  console.log('Telegram blast: Admin scope, preview, gates, queued delivery, Sent copies, retry, skip, cancel and budget passed');
} finally {Date.now=originalNow;close();}
