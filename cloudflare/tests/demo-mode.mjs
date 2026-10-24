import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {sendRefpahangEmail} from '../mail';
  export {tgSend,setTelegramSenderForTests,setTelegramApiForTests} from '../src/php/telegram';
  export {demoInfo,adminDemoOutbox} from '../src/demo-routes';
  export {changePassword} from '../src/change-password';
  export {updateProfile} from '../src/profile-write';
  export {forgotPassword} from '../src/password-reset';
  export {adminUsersWrite} from '../src/admin-users-write';
  export {enforceAccountPolicy} from '../src/account-policy';
  export {telegramWebhook} from '../src/telegram-webhook';
  export {setEmailSenderForTests} from '../src/php/email';
  export {DEMO_FAKE_CHAT_CEILING} from '../src/demo';
`);
const {db,DB,close}=openDatabase(['0009_mysql_on_update_triggers','0010_worker_write_guards','0034_demo_outbox']);
const sent=[];
const telegrams=[];
const api=[];
worker.setEmailSenderForTests(async()=>true);
worker.setTelegramSenderForTests(async(chatId,text,markup)=>{telegrams.push({chatId:String(chatId),text,markup});return true;});
worker.setTelegramApiForTests(async(method,payload)=>{api.push({method,payload});});
const mailEnv={MAIL_ADMIN_USER:'admin@refpahang.com',MAIL_ADMIN_NAME:'Admin',MAIL_DAFTAR_USER:'daftar@refpahang.com',
  MAIL_DAFTAR_NAME:'Daftar',MAIL_LANTIKAN_USER:'lantikan@refpahang.com',MAIL_LANTIKAN_NAME:'Lantikan',
  MAIL_SUPPORT_USER:'support@refpahang.com',MAIL_SUPPORT_NAME:'Support',MAIL_PENGESAHAN_USER:'pengesahan@refpahang.com',
  MAIL_PENGESAHAN_NAME:'Pengesahan',EMAIL:{send:async(message)=>{sent.push(message);return {messageId:'m1'};}}};
const base={DB,...mailEnv,BASE_URL:'https://demo.refpahang.com',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  APPOINTMENT_DELIVERY_ENABLED:'1',REPORT_DELIVERY_ENABLED:'1',MEDIA:{get:async()=>null}};
const demo={...base,DEMO_MODE:'1',DEMO_RELAY_SECRET:'relay-secret'};
const outbox=()=>db.prepare('SELECT channel,recipient,subject,body FROM demo_outbox ORDER BY id').all();
const call=async(handler,url,init,env,...extra)=>{
  const response=await handler(new Request(url,init),env,...extra);
  return {status:response.status,body:response.status===200||response.headers.get('Content-Type')?.includes('json')
    ? await response.json().catch(()=>null) : null};
};
const jsonInit=(method,cookie,body)=>({method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
  body:JSON.stringify(body)});

try {
  // Email: fictional recipients are kept, real ones go out marked [DEMO].
  assert.equal(await worker.sendRefpahangEmail(demo,'lantikan','ali@demo.invalid','Ali','Lantikan Baru','<p>x</p>','x'),'demo-outbox');
  assert.equal(await worker.sendRefpahangEmail(demo,'lantikan','pp@demo.refpahang.com','','Notis','<p>y</p>','y'),'demo-outbox');
  assert.equal(sent.length,0,'nothing reaches a fictional address');
  assert.deepEqual(outbox().map(r=>[r.channel,r.recipient,r.subject]),
    [['email','Ali <ali@demo.invalid>','[DEMO] Lantikan Baru'],['email','pp@demo.refpahang.com','[DEMO] Notis']]);
  await worker.sendRefpahangEmail(demo,'lantikan','penguji@gmail.com','Penguji','Lantikan Baru','<p>x</p>','x');
  assert.equal(sent.length,1);
  assert.equal(sent[0].subject,'[DEMO] Lantikan Baru');
  assert.equal(sent[0].to.email,'penguji@gmail.com');
  // Production is untouched.
  await worker.sendRefpahangEmail(base,'lantikan','ali@demo.invalid','Ali','Lantikan Baru','<p>x</p>','x');
  assert.equal(sent.length,2);
  assert.equal(sent[1].subject,'Lantikan Baru');
  assert.equal(outbox().length,2);

  // Telegram: fictional chats are kept (and count as delivered), real chats get the DEMO banner.
  const fake=worker.DEMO_FAKE_CHAT_CEILING-5;
  assert.equal(await worker.tgSend(demo,fake,'<b>Lantikan Baru</b>\nPerlawanan A lwn B',{inline_keyboard:[]}),true);
  assert.equal(telegrams.length,0);
  const kept=outbox().at(-1);
  assert.equal(kept.channel,'telegram');
  assert.equal(kept.recipient,String(fake));
  assert.equal(kept.subject,'Lantikan Baru');
  assert.match(kept.body,/DEMO — sistem latihan/);
  assert.match(kept.body,/\[Butang: /);
  await worker.tgSend(demo,123456,'Halo');
  assert.equal(telegrams.length,1);
  assert.match(telegrams[0].text,/^🧪 <b>DEMO — sistem latihan<\/b>\n\nHalo$/);
  await worker.tgSend(base,123456,'Halo');
  assert.equal(telegrams[1].text,'Halo');

  // demo-info is public in the demo and absent elsewhere.
  const info=await call(worker.demoInfo,'https://demo.refpahang.com/api/demo-info.php',{method:'GET'},demo);
  assert.equal(info.status,200);
  assert.equal(info.body.demo,true);
  assert.deepEqual(info.body.accounts.map(a=>a.peranan),
    ['Admin','PP Daerah','PP Daerah + Penilai','PP Daerah + Pengadil','Pengadil','Penilai']);
  assert.equal((await worker.demoInfo(new Request('https://refpahang.com/api/demo-info.php'),base)).status,404);

  // Shared demo accounts cannot be locked by one tester.
  const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 ORDER BY id LIMIT 1").get().id;
  const shared=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 ORDER BY id LIMIT 1").get().id;
  db.prepare("UPDATE users SET email='pengadil@demo.refpahang.com' WHERE id=?").run(shared);
  const sharedCookie=await sessionCookie(db,shared);
  const adminCookie=await sessionCookie(db,admin);
  const before=db.prepare('SELECT password,aktif,email FROM users WHERE id=?').get(shared);
  const pw=await call(worker.changePassword,'https://demo.refpahang.com/api/change-password.php',
    jsonInit('POST',sharedCookie,{current_password:'x',new_password:'abcdefgh1',confirm_password:'abcdefgh1'}),demo);
  assert.equal(pw.status,403);
  assert.match(pw.body.message,/Akaun demo kongsi/);
  const profile=await call(worker.updateProfile,'https://demo.refpahang.com/api/update-profile.php',
    jsonInit('POST',sharedCookie,{nama_penuh:'X',email:'saya@gmail.com'}),demo);
  assert.equal(profile.status,403);
  const reset=await call(worker.adminUsersWrite,'https://demo.refpahang.com/api/admin-users.php',
    jsonInit('PATCH',adminCookie,{userId:shared,action:'reset_password'}),demo);
  assert.equal(reset.status,403);
  const off=await call(worker.adminUsersWrite,'https://demo.refpahang.com/api/admin-users.php',
    jsonInit('PATCH',adminCookie,{userId:shared,action:'set_account_status',aktif:0,reason:'uji'}),demo);
  assert.equal(off.status,403);
  const edit=await call(worker.adminUsersWrite,'https://demo.refpahang.com/api/admin-users.php',
    jsonInit('PUT',adminCookie,{userId:shared,nama_penuh:'X',email:'lain@gmail.com',user_role:'Admin'}),demo);
  assert.equal(edit.status,403);
  const tokens=Number(db.prepare('SELECT count(*) AS n FROM password_reset_tokens WHERE user_id=?').get(shared).n);
  const forgot=await call(worker.forgotPassword,'https://demo.refpahang.com/api/forgot-password.php',
    jsonInit('POST',null,{email:'pengadil@demo.refpahang.com'}),demo);
  assert.equal(forgot.status,200);
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM password_reset_tokens WHERE user_id=?').get(shared).n),tokens);
  assert.deepEqual(db.prepare('SELECT password,aktif,email FROM users WHERE id=?').get(shared),before);
  // Outside the demo the same account is an ordinary one.
  const plainOff=await call(worker.adminUsersWrite,'https://refpahang.com/api/admin-users.php',
    jsonInit('PATCH',adminCookie,{userId:shared,action:'set_account_status',aktif:0,reason:'uji'}),base);
  assert.equal(plainOff.status,200);
  db.prepare('UPDATE users SET aktif=1,inactive_reason=NULL,inactive_source=NULL WHERE id=?').run(shared);

  // The demo never ages accounts out.
  const idle=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND id<>? ORDER BY id LIMIT 1").get(shared).id;
  db.prepare("UPDATE users SET last_activity_at=1,last_login='2020-01-01 00:00:00',created_at='2020-01-01 00:00:00' WHERE id=?").run(idle);
  db.prepare("DELETE FROM activity_log WHERE user_id=?").run(idle);
  await worker.enforceAccountPolicy(demo,idle);
  assert.equal(db.prepare('SELECT aktif FROM users WHERE id=?').get(idle).aktif,1);

  // Outbox listing: Admin only, demo only.
  const list=await call(worker.adminDemoOutbox,'https://demo.refpahang.com/api/admin-demo-outbox.php?channel=telegram',
    {method:'GET'},demo,{role:'Admin'});
  assert.equal(list.status,200);
  assert.equal(list.body.total,1);
  assert.equal((await worker.adminDemoOutbox(new Request('https://demo.refpahang.com/api/admin-demo-outbox.php'),demo,{role:'Pengadil'})).status,403);
  assert.equal((await worker.adminDemoOutbox(new Request('https://refpahang.com/api/admin-demo-outbox.php'),base,{role:'Admin'})).status,404);

  // Telegram relay: the demo only accepts production's signed relay and
  // reports tokens it does not know, so production can reply as before.
  const update=JSON.stringify({message:{chat:{id:555001},text:'/start nosuchtoken',from:{first_name:'A'}}});
  const unsigned=await worker.telegramWebhook(new Request('https://demo.refpahang.com/api/telegram-webhook.php',
    {method:'POST',body:update}),demo);
  assert.equal(unsigned.status,403);
  const quiet=telegrams.length;
  const unknown=await worker.telegramWebhook(new Request('https://demo.refpahang.com/api/telegram-webhook.php',
    {method:'POST',body:update,headers:{'X-Demo-Relay-Secret':'relay-secret'}}),demo);
  assert.equal(unknown.status,404);
  assert.equal(telegrams.length,quiet,'the demo stays silent about unknown tokens');
  db.prepare("UPDATE users SET telegram_chat_id=NULL,tg_link_token='demotok' WHERE id=?").run(idle);
  const linked=await worker.telegramWebhook(new Request('https://demo.refpahang.com/api/telegram-webhook.php',
    {method:'POST',body:JSON.stringify({message:{chat:{id:555001},text:'/start demotok'}}),
      headers:{'X-Demo-Relay-Secret':'relay-secret'}}),demo);
  assert.equal(linked.status,200);
  assert.equal(Number(db.prepare('SELECT telegram_chat_id FROM users WHERE id=?').get(idle).telegram_chat_id),555001);
  assert.match(telegrams.at(-1).text,/DEMO — sistem latihan[\s\S]*Akaun berjaya dihubungkan/);

  // Production side: known tokens never leave; unknown ones are offered to the demo.
  const relayed=[];
  const realFetch=globalThis.fetch;
  let demoAnswer=200;
  globalThis.fetch=async(url,init)=>{relayed.push({url:String(url),init});return new Response(null,{status:demoAnswer});};
  const prod={...base,DEMO_RELAY_URL:'https://demo.refpahang.com/api/telegram-webhook.php',DEMO_RELAY_SECRET:'relay-secret'};
  const hook=(body)=>worker.telegramWebhook(new Request('https://refpahang.com/api/telegram-webhook.php',
    {method:'POST',body:JSON.stringify(body)}),prod);
  try {
    const prodUser=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND id NOT IN (?,?) ORDER BY id LIMIT 1").get(shared,idle).id;
    db.prepare("UPDATE users SET telegram_chat_id=NULL,tg_link_token='prodtok' WHERE id=?").run(prodUser);
    assert.equal((await hook({message:{chat:{id:555002},text:'/start prodtok'}})).status,200);
    assert.equal(relayed.length,0);
    assert.equal(Number(db.prepare('SELECT telegram_chat_id FROM users WHERE id=?').get(prodUser).telegram_chat_id),555002);

    const sentBefore=telegrams.length;
    assert.equal((await hook({message:{chat:{id:555003},text:'/start demoonly'}})).status,200);
    assert.equal(relayed.length,1);
    assert.equal(relayed[0].url,'https://demo.refpahang.com/api/telegram-webhook.php');
    assert.equal(relayed[0].init.headers['X-Demo-Relay-Secret'],'relay-secret');
    assert.equal(JSON.parse(relayed[0].init.body).message.text,'/start demoonly');
    assert.equal(telegrams.length,sentBefore,'the demo answered, production stays quiet');

    demoAnswer=404;
    assert.equal((await hook({message:{chat:{id:555003},text:'/start stale'}})).status,200);
    assert.equal(relayed.length,2);
    assert.match(telegrams.at(-1).text,/Pautan Pendaftaran Tidak Aktif/);
    assert.doesNotMatch(telegrams.at(-1).text,/DEMO/);

    demoAnswer=200;
    assert.equal((await hook({callback_query:{id:'cb9',from:{id:555003},data:'act:accept:token:demobutton',
      message:{message_id:9}}})).status,200);
    assert.equal(relayed.length,3);
    assert.equal(api.length,0,'production did not answer the relayed button');

    // Without relay settings production behaves exactly as before.
    const plain=await worker.telegramWebhook(new Request('https://refpahang.com/api/telegram-webhook.php',
      {method:'POST',body:JSON.stringify({message:{chat:{id:555004},text:'/start whatever'}})}),base);
    assert.equal(plain.status,200);
    assert.equal(relayed.length,3);
  } finally {
    globalThis.fetch=realFetch;
  }
  console.log('demo-mode: ok');
} finally {
  close();
}
