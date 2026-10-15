import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminTelegramBlastPreview,externalTelegramBlastPreview}=await bundle(
  "export {adminTelegramBlastPreview,externalTelegramBlastPreview} from '../src/telegram-blast-preview';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions']);
const messages=[];
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'0',BULK_EMAIL_ENABLED:'0',
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
const post=(cookie)=>new Request(main,{method:'POST',headers:cookie?{Cookie:cookie}:{}});

try {
  assert.equal((await adminTelegramBlastPreview(get(main),env)).status,401);
  assert.equal((await externalTelegramBlastPreview(get(`${external}?kejohanan_id=16`),env)).status,401);
  assert.equal((await adminTelegramBlastPreview(get(main,refereeCookie),env)).status,403);
  assert.equal((await externalTelegramBlastPreview(get(`${external}?kejohanan_id=16`,refereeCookie),env)).status,403);
  const stats=await (await adminTelegramBlastPreview(get(main,adminCookie),env)).json();
  const expected=db.prepare(`SELECT count(*) AS total,sum(CASE WHEN telegram_chat_id IS NOT NULL
    AND trim(telegram_chat_id)<>'' THEN 1 ELSE 0 END) AS linked
    FROM users WHERE aktif=1 AND email IS NOT NULL AND email<>''`).get();
  assert.deepEqual({total:stats.total,linked:stats.linked,not_linked:stats.not_linked},
    {total:expected.total,linked:expected.linked,not_linked:expected.total-expected.linked});
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
    AND id<>? ORDER BY id LIMIT 2`).all(admin.id);
  assert.equal(invitees.length,2);
  db.prepare('UPDATE users SET aktif=0 WHERE id NOT IN (?,?,?)')
    .run(admin.id,invitees[0].id,invitees[1].id);
  db.prepare('UPDATE users SET telegram_chat_id=123456 WHERE id=?').run(admin.id);
  env.STAGING_WRITES_ENABLED='1';
  assert.equal((await adminTelegramBlastPreview(post(adminCookie),env)).status,503);
  env.BULK_EMAIL_ENABLED='1';
  globalThis.failRecipient=invitees[1].email;
  const first=await (await adminTelegramBlastPreview(post(adminCookie),env)).json();
  assert.equal(first.error,false);
  assert.deepEqual([first.sent,first.failed],[1,1]);
  assert.deepEqual(first.errors,[invitees[1].email]);
  assert.equal(messages.length,2);
  assert.ok(messages.every(message=>message.from.email==='admin@refpahang.example'));
  for(const invitee of invitees){
    const token=db.prepare('SELECT tg_link_token FROM users WHERE id=?').get(invitee.id).tg_link_token;
    assert.match(token,/^[a-f0-9]{32}$/);
    const message=messages.find(row=>row.to.email===invitee.email);
    assert.ok(message.html.includes(`https://t.me/refpahang_bot?start=${token}`));
  }
  globalThis.failRecipient=null;
  const second=await (await adminTelegramBlastPreview(post(adminCookie),env)).json();
  assert.deepEqual([second.sent,second.failed],[2,0]);
  assert.equal(messages.length,4);
  console.log('Telegram blast: Admin scope, preview, write/delivery gates, token reuse and email failures passed');
} finally {close();}
