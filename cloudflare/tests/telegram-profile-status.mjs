import assert from 'node:assert/strict';
import { bundle, openDatabase, sessionCookie } from './_harness.mjs';
const { registeredReferees, refereeProfile, telegramLinkSelf } = await bundle(`
 export {registeredReferees} from '../src/registered-referees';
 export {refereeProfile} from '../src/profile'; export {telegramLinkSelf} from '../src/telegram-link-self';`);
const { db, DB, close } = openDatabase(['0001_worker_sessions', '0019_annual_seminar_attendance']);
const env = { DB, STAGING_AUTH_ENABLED: '1' };
try {
 const admin = db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
 const cookie = await sessionCookie(db, admin.id);
 const request = path => new Request('https://refpahang.example/api/'+path, { headers:{ Cookie:cookie } });
 for (const type of ['pengadil_berdaftar','penilai_berdaftar']) {
  const path = `referees.php?year=2026&type=${type}`;
  const initial = await (await registeredReferees(request(path),env)).json();
  const target = initial.data.find(row => row.user_id === 80) ?? initial.data[0];
  assert.ok(target, type+' has a test registration');
  for (const [chat,expected] of [['123456789',1],[null,0],['',0],['   ',0]]) {
   db.prepare('UPDATE users SET telegram_chat_id=? WHERE id=?').run(chat,target.user_id);
   const list = await (await registeredReferees(request(path),env)).json();
   const row = list.data.find(item => item.user_id === target.user_id);
   const global = await (await refereeProfile(request(`profil-pengadil.php?id=${target.user_id}`),env)).json();
   assert.equal(row.telegram_linked,expected);
   assert.equal(global.profil.telegram_linked,expected);
   assert.equal(Object.hasOwn(row,'telegram_chat_id'),false);
   assert.equal(Object.hasOwn(global.profil,'telegram_chat_id'),false);
  }
  // A link completed after the list loaded must be reflected by the fresh profile read.
  db.prepare('UPDATE users SET telegram_chat_id=? WHERE id=?').run('234567890',target.user_id);
  assert.equal((await (await refereeProfile(request(`profil-pengadil.php?id=${target.user_id}`),env)).json()).profil.telegram_linked,1);
 }
 const selfRequest=new Request('https://refpahang.example/api/telegram-link-self.php',{method:'POST',headers:{Cookie:cookie}});
 db.prepare("UPDATE users SET telegram_chat_id='',tg_link_token='' WHERE id=?").run(admin.id);
 const link=await(await telegramLinkSelf(selfRequest,{...env,STAGING_WRITES_ENABLED:'1'})).json();
 assert.equal(link.linked,false);assert.match(link.link_url,/^https:\/\/t\.me\/refpahang_bot\?start=[a-f0-9]{32}$/);
 db.prepare('UPDATE users SET telegram_chat_id=? WHERE id=?').run('123456789',admin.id);
 assert.equal((await(await telegramLinkSelf(selfRequest,{...env,STAGING_WRITES_ENABLED:'1'})).json()).linked,true);
 console.log('Telegram profile: referee/RA roster matches fresh profile for linked/null/empty/whitespace values, without exposing chat IDs; refresh sees completed link');
} finally { close(); }
