import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {announcementsWrite} from '../src/announcements-write';
  export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const {db,DB,close}=openDatabase([]);
const delivered=[];
worker.setTelegramSenderForTests(async(chatId,text,replyMarkup)=>{
  delivered.push({chatId:String(chatId),text,replyMarkup});
  return true;
});
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const cookie=await sessionCookie(db,admin.id);
const userIds=db.prepare('SELECT id FROM users ORDER BY id LIMIT 2').all().map(row=>row.id);
const externalIds=db.prepare('SELECT id FROM pengadil_luar ORDER BY id LIMIT 2').all().map(row=>row.id);
assert.equal(userIds.length,2);
assert.equal(externalIds.length,2);

// Linked active and inactive accounts both receive announcements. Duplicate
// chat IDs across internal/external records are sent only once.
db.prepare('UPDATE users SET telegram_chat_id=NULL').run();
db.prepare('UPDATE pengadil_luar SET telegram_chat_id=NULL').run();
db.prepare('UPDATE users SET telegram_chat_id=?, aktif=1 WHERE id=?').run('10001',userIds[0]);
db.prepare('UPDATE users SET telegram_chat_id=?, aktif=0 WHERE id=?').run('10001',userIds[1]);
db.prepare('UPDATE pengadil_luar SET telegram_chat_id=? WHERE id=?').run('10002',externalIds[0]);
db.prepare('UPDATE pengadil_luar SET telegram_chat_id=? WHERE id=?').run('10001',externalIds[1]);

const env={DB,BASE_URL:'https://refpahang.example',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1'};
let delivery;
const ctx={waitUntil(promise){delivery=promise;}};
const request=new Request('https://refpahang.example/api/announcements.php',{
  method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},
  body:JSON.stringify({title:'Jadual <Pengadil> & Makluman',content:'Sila baca <b>maklumat penting</b> sebelum bertugas.'}),
});

try {
  const response=await worker.announcementsWrite(request,env,ctx);
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.error,false);
  assert.match(result.message,/sedang dihantar/);
  assert.ok(delivery);
  await delivery;
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM announcements WHERE id=?').get(Number(result.id)).n,1);
  assert.deepEqual(delivered.map(item=>item.chatId).sort(),['10001','10002']);
  assert.ok(delivered.every(item=>item.text.includes('📢 <b>HEBAHAN RASMI</b>')));
  assert.ok(delivered.every(item=>item.text.includes('<b>PORTAL PENGADIL PAHANG</b>')));
  assert.ok(delivered.every(item=>item.text.includes('Jadual &lt;Pengadil&gt; &amp; Makluman')));
  assert.ok(delivered.every(item=>item.text.includes('Sila baca &lt;b&gt;maklumat penting&lt;/b&gt;')));
  assert.ok(delivered.every(item=>item.replyMarkup.inline_keyboard[0][0].url==='https://refpahang.example/login'));
  assert.ok(delivered.every(item=>item.replyMarkup.inline_keyboard[0][0].text==='📖 Baca pengumuman di portal'));
  console.log('Announcement Telegram: admin create, active/inactive recipients, deduplication, HTML escaping and portal button passed');
} finally {
  worker.setTelegramSenderForTests(null);
  close();
}
