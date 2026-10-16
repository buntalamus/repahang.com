import assert from 'node:assert/strict';
import {bundle,openDatabase} from './_harness.mjs';

const worker=await bundle(`
  export {lantikanWrite} from '../src/lantikan-write';
  export {telegramWebhook} from '../src/telegram-webhook';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests,setTelegramApiForTests} from '../src/php/telegram';
`);
const {db,DB,close}=openDatabase(['0009_mysql_on_update_triggers','0010_worker_write_guards','0022_district_appointments']);
const sent=[];
const api=[];
worker.setEmailSenderForTests(async()=>true);
worker.setTelegramSenderForTests(async(chatId,text,markup)=>{sent.push({chatId:String(chatId),text,markup});return true;});
worker.setTelegramApiForTests(async(method,payload)=>{api.push({method,payload});});
const env={DB,BASE_URL:'https://refpahang.com',TELEGRAM_BOT_USERNAME:'refpahang_bot',
  STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1',
  MEDIA:{get:async()=>null}};
const one=(sql,...values)=>db.prepare(sql).get(...values);
const count=(sql,...values)=>Number(Object.values(db.prepare(sql).get(...values))[0]);
const hook=async(update)=>{
  const response=await worker.telegramWebhook(new Request('https://refpahang.com/api/telegram-webhook.php',
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(update)}),env);
  assert.equal(response.status,200);
};
const start=(chatId,text)=>hook({message:{chat:{id:chatId},text,from:{first_name:'A'}}});
const press=(chatId,data,messageId=55)=>hook({callback_query:{id:'cb1',from:{id:chatId},data,
  message:{message_id:messageId}}});

try {
  // /start links an external official once and audits each appointment.
  const tournament=16;
  const luar=one(`SELECT pl.id,pl.nama FROM pool_pengadil pp JOIN pengadil_luar pl ON pl.id=pp.pengadil_luar_id
    WHERE pp.kejohanan_id=? AND pl.jenis_pengadil<>'Penilai Pengadil' ORDER BY pl.id LIMIT 1`,tournament);
  db.prepare("UPDATE pengadil_luar SET telegram_chat_id=NULL,tg_link_token='linktok' WHERE id=?").run(luar.id);
  const appointments=count('SELECT count(*) FROM lantikan_pengadil WHERE pengadil_luar_id=?',luar.id);
  const linkedAudits=()=>count(`SELECT count(*) FROM lantikan_audit_log WHERE pengadil_luar_id=?
    AND event_type='telegram_account_linked'`,luar.id);
  const linkedBefore=linkedAudits();
  await start(777001,'/start');
  assert.match(sent.at(-1).text,/Sila minta pentadbir untuk menghantar pautan pendaftaran/);
  await start(777001,'/start wrongtoken');
  assert.match(sent.at(-1).text,/Pautan Pendaftaran Tidak Aktif/);
  await start(777001,'/start linktok');
  assert.match(sent.at(-1).text,/Akaun berjaya dihubungkan!/);
  assert.deepEqual({...one('SELECT telegram_chat_id,tg_link_token FROM pengadil_luar WHERE id=?',luar.id)},
    {telegram_chat_id:777001,tg_link_token:null});
  assert.equal(linkedAudits()-linkedBefore,appointments);
  await start(777001,'/start linktok');
  assert.match(sent.at(-1).text,/Pautan pendaftaran itu sudah digunakan/);

  // Buttons answer an appointment like the PHP webhook.
  const pool=db.prepare(`SELECT u.id,u.telegram_chat_id FROM pool_pengadil pp JOIN users u ON u.id=pp.pengadil_id
    WHERE pp.kejohanan_id=14 AND u.aktif=1 AND u.jenis_pengadil<>'Penilai Pengadil'
      AND u.telegram_chat_id IS NOT NULL ORDER BY u.id LIMIT 1`).get();
  const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1");
  const match=Number(db.prepare(`INSERT INTO jadual_perlawanan (kejohanan_id,no_perlawanan,tarikh,masa,
      pasukan_home,pasukan_away,tempat,status,created_at,updated_at)
    VALUES (14,'T01','2026-12-05','16:23:00','Home FC','Away FC','Stadium','Belum Lantik',
      '2026-10-01 10:00:00','2026-10-01 10:00:00')`).run().lastInsertRowid);
  await worker.lantikanWrite(new Request('https://refpahang.com/api/lantikan.php',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({jadual_id:match,pengadil_id:pool.id,jawatan:'Pengadil'})}),
    env,{id:admin.id,role:'Admin'});
  db.prepare("UPDATE lantikan_pengadil SET tg_token='tgtok',notif_hantar=1,tarikh_notif=datetime('now','+8 hours') WHERE jadual_id=?")
    .run(match);
  api.length=0;
  await press(pool.telegram_chat_id,'bad data');
  assert.deepEqual(api.at(-1),{method:'answerCallbackQuery',
    payload:{callback_query_id:'cb1',text:'Format tidak sah.',show_alert:true}});
  await press(999,'act:accept:token:tgtok');
  assert.equal(api.at(-1).payload.text,'Anda tidak dibenarkan untuk tugasan ini.');
  await press(pool.telegram_chat_id,'act:accept:token:tgtok');
  const row=one('SELECT * FROM lantikan_pengadil WHERE jadual_id=?',match);
  assert.deepEqual([row.status,row.tg_token],['Diterima',null]);
  const answer=api.find((call)=>call.method==='answerCallbackQuery'&&call.payload.text.startsWith('✅ Tugasan Diterima!'));
  assert.equal(answer.payload.text,'✅ Tugasan Diterima!\n\nPengadil\nHome FC lwn Away FC\n05 Dec 2026, 16:23 MYT');
  const edit=api.find((call)=>call.method==='editMessageText');
  assert.match(edit.payload.text,/^✅ <b>Tugasan Diterima<\/b>/);
  assert.match(edit.payload.text,/https:\/\/refpahang\.com\/pengadil-dashboard"/);
  assert.equal(edit.payload.reply_markup,'{"inline_keyboard":[]}');
  const audit=one("SELECT * FROM lantikan_audit_log WHERE lantikan_id=? ORDER BY id DESC",row.id);
  assert.equal(audit.channel,'telegram');
  assert.deepEqual(JSON.parse(audit.details_json),
    {action:'accept',new_status:'Diterima',telegram_chat_id:Number(pool.telegram_chat_id)});
  api.length=0;
  await press(pool.telegram_chat_id,'act:accept:token:tgtok');
  assert.match(api[0].payload.text,/Butang ini sudah tidak aktif/);
  assert.match(api[1].payload.text,/Notifikasi Lapuk/);
  console.log('telegram webhook: /start linking and callbacks follow PHP');
} finally {close();}
