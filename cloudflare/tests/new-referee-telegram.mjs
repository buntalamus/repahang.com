import assert from 'node:assert/strict';
import { bundle, openDatabase, sessionCookie } from './_harness.mjs';

const worker = await bundle(`
  export {lantikanWrite} from '../src/lantikan-write';
  export {telegramWebhook} from '../src/telegram-webhook';
  export {appointmentAudit} from '../src/appointment-audit';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const { db, DB, hooks, close } = openDatabase(['0009_mysql_on_update_triggers', '0010_worker_write_guards','0022_district_appointments']);
const sentTelegram = [];
let emailAccepted = true;
worker.setEmailSenderForTests(async () => emailAccepted);
worker.setTelegramSenderForTests(async (chatId, message) => {
  sentTelegram.push({ chatId: Number(chatId), message });
  return true;
});
const env = {
  DB, BASE_URL: 'https://refpahang.example', TELEGRAM_BOT_USERNAME: 'refpahang_bot',
  STAGING_AUTH_ENABLED: '1', STAGING_WRITES_ENABLED: '1', APPOINTMENT_DELIVERY_ENABLED: '1',
  MEDIA: { get: async () => null },
};
const admin = db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const actor = { id: admin.id, role: 'Admin' };
const appointment = body => worker.lantikanWrite(new Request('https://refpahang.example/api/lantikan.php', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}), env, actor);

try {
  const userId = Number(db.prepare(`INSERT INTO users(email,password,role,nama_penuh,no_ic,
    jenis_pengadil,aktif,tg_link_token,persatuan_id)
    VALUES('new.ref@example.invalid','unused','Pengadil','Pengadil Baharu Ujian',
      '990101061236','Pengadil Baharu',1,'newref-link-token',1)`).run().lastInsertRowid);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM permohonan WHERE user_id=?').get(userId).n, 0);
  db.prepare('INSERT INTO pool_pengadil(kejohanan_id,pengadil_id) VALUES(14,?)').run(userId);
  const matchId = Number(db.prepare(`INSERT INTO jadual_perlawanan(kejohanan_id,no_perlawanan,tarikh,
    masa,pasukan_home,pasukan_away,tempat,status)
    VALUES(14,'TG-NEW','2026-12-11','16:00:00','Home','Away','Padang','Belum Lantik')`).run().lastInsertRowid);

  const denied = await appointment({ jadual_id: matchId, pengadil_id: userId, jawatan: 'Pengadil' });
  assert.equal(denied.status, 409);
  assert.equal((await denied.json()).contact_channel_required, true);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM lantikan_pengadil WHERE jadual_id=?').get(matchId).n, 0);

  const oldUserId = Number(db.prepare(`INSERT INTO users(email,password,role,nama_penuh,no_ic,
    jenis_pengadil,aktif,persatuan_id)
    VALUES('old.ref@example.invalid','unused','Pengadil','Pengadil Lama Ujian',
      '990101061237','Pengadil Negeri',1,1)`).run().lastInsertRowid);
  db.prepare('INSERT INTO pool_pengadil(kejohanan_id,pengadil_id) VALUES(14,?)').run(oldUserId);
  const oldDenied = await appointment({ jadual_id: matchId, pengadil_id: oldUserId, jawatan: 'Pengadil' });
  assert.equal(oldDenied.status, 409);
  assert.equal((await oldDenied.json()).contact_channel_required, true);

  // A registered app device must belong to a live session for the same user.
  db.prepare('INSERT INTO worker_sessions VALUES (?,?,unixepoch(),unixepoch()+3600)').run('app-session',oldUserId);
  db.prepare(`INSERT INTO worker_push_devices(user_id,session_token_hash,platform,token)
    VALUES(?,'app-session','android','test-device-token')`).run(oldUserId);
  db.prepare("UPDATE worker_sessions SET expires_at=unixepoch()-1 WHERE token_hash='app-session'").run();
  assert.equal((await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Pengadil'})).status,409);
  db.prepare("UPDATE worker_sessions SET expires_at=unixepoch()+3600,user_id=? WHERE token_hash='app-session'").run(userId);
  assert.equal((await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Pengadil'})).status,409);
  db.prepare("UPDATE worker_sessions SET user_id=? WHERE token_hash='app-session'").run(oldUserId);
  assert.equal((await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Pengadil'})).status,200);
  db.prepare('DELETE FROM lantikan_pengadil WHERE jadual_id=?').run(matchId);

  // Account inactivity blocks both Telegram and app users, including historical assignment.
  db.prepare('UPDATE users SET aktif=0,telegram_chat_id=991234 WHERE id=?').run(oldUserId);
  assert.equal((await (await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Pengadil'})).json()).inactive_official,true);
  db.prepare("UPDATE jadual_perlawanan SET tarikh='2020-01-01' WHERE id=?").run(matchId);
  assert.equal((await (await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Pengadil'})).json()).inactive_official,true);
  db.prepare("UPDATE jadual_perlawanan SET tarikh='2026-12-11' WHERE id=?").run(matchId);
  db.prepare('UPDATE users SET aktif=1,telegram_chat_id=NULL WHERE id=?').run(oldUserId);

  // Match-year inactivity is distinct from account activity. Clone only a test fixture application.
  const sample=db.prepare("SELECT * FROM permohonan WHERE jenis_borang='pengadil_berdaftar' LIMIT 1").get();
  const cols=Object.keys(sample).filter(k=>k!=='id');
  const annual={...sample,user_id:oldUserId,tahun_permohonan:2025,status:'Approved',jenis_pengadil:'Pengadil Negeri'};
  const annualId=Number(db.prepare(`INSERT INTO permohonan(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`)
    .run(...cols.map(k=>annual[k])).lastInsertRowid);
  assert.equal((await (await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Pengadil'})).json()).inactive_official,true);
  // RA is separate from annual referee status.
  db.prepare("UPDATE users SET jenis_pengadil='Penilai Pengadil' WHERE id=?").run(oldUserId);
  assert.equal((await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Penilai Pengadil'})).status,200);
  db.prepare('DELETE FROM lantikan_pengadil WHERE jadual_id=?').run(matchId);
  db.prepare("UPDATE users SET jenis_pengadil='Pengadil Negeri' WHERE id=?").run(oldUserId);
  db.prepare('UPDATE permohonan SET tahun_permohonan=2026 WHERE id=?').run(annualId);
  assert.equal((await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Pengadil'})).status,200);
  const overrideId=db.prepare('SELECT id FROM lantikan_pengadil WHERE jadual_id=?').get(matchId).id;
  db.prepare("UPDATE lantikan_pengadil SET status='Ditolak',komen='Tersilap tolak' WHERE id=?").run(overrideId);
  const adminCookie=await sessionCookie(db,admin.id);
  const override=()=>worker.appointmentAudit(new Request('https://refpahang.example/api/lantikan-audit.php',{
    method:'POST',headers:{Cookie:adminCookie,'Content-Type':'application/json'},
    body:JSON.stringify({action:'admin_override_acceptance',lantikan_id:overrideId}),
  }),env);
  db.prepare('UPDATE users SET aktif=0 WHERE id=?').run(oldUserId);
  assert.equal((await (await override()).json()).inactive_official,true);
  db.prepare('UPDATE users SET aktif=1 WHERE id=?').run(oldUserId);
  db.prepare('UPDATE permohonan SET tahun_permohonan=2025 WHERE id=?').run(annualId);
  assert.equal((await (await override()).json()).inactive_official,true);
  assert.equal(db.prepare('SELECT status FROM lantikan_pengadil WHERE id=?').get(overrideId).status,'Ditolak');
  db.prepare('UPDATE permohonan SET tahun_permohonan=2026 WHERE id=?').run(annualId);
  db.prepare('DELETE FROM lantikan_pengadil WHERE jadual_id=?').run(matchId);

  // The atomic guard catches deactivation and app logout after the initial read.
  hooks.beforeBatch=()=>db.prepare('UPDATE users SET aktif=0 WHERE id=?').run(oldUserId);
  assert.equal((await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Pengadil'})).status,409);
  db.prepare('UPDATE users SET aktif=1 WHERE id=?').run(oldUserId);
  hooks.beforeBatch=()=>db.prepare("DELETE FROM worker_sessions WHERE token_hash='app-session'").run();
  assert.equal((await appointment({jadual_id:matchId,pengadil_id:oldUserId,jawatan:'Pengadil'})).status,409);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM lantikan_pengadil WHERE jadual_id=?').get(matchId).n,0);

  // A pending appointment made before this gate must also wait for linking.
  const others = db.prepare(`SELECT u.id FROM pool_pengadil pp JOIN users u ON u.id=pp.pengadil_id
    WHERE pp.kejohanan_id=14 AND u.id<>? AND u.aktif=1
      AND u.jenis_pengadil<>'Penilai Pengadil' AND u.telegram_chat_id IS NOT NULL
    ORDER BY u.id LIMIT 2`).all(userId);
  assert.equal(others.length, 2);
  for (const [id, position] of [[userId, 'Pengadil'],
    [others[0].id, 'Penolong Pengadil 1'], [others[1].id, 'Penolong Pengadil 2']]) {
    db.prepare(`INSERT INTO lantikan_pengadil(jadual_id,pengadil_id,jawatan,status)
      VALUES(?,?,?,'Belum Jawab')`).run(matchId, id, position);
  }
  const waiting = await appointment({ action: 'notify', jadual_id: matchId });
  assert.equal(waiting.status, 409);
  assert.equal((await waiting.json()).contact_channel_required, true);
  assert.equal(sentTelegram.length, 0);

  // Web Push (including the iPhone home-screen app) also satisfies the app route.
  db.prepare(`INSERT INTO worker_webpush_subscriptions(user_id,endpoint,p256dh,auth)
    VALUES(?,'https://push.example.invalid/test','test-key','test-auth')`).run(userId);
  db.prepare('UPDATE users SET aktif=0 WHERE id=?').run(userId);
  assert.equal((await (await appointment({action:'notify',jadual_id:matchId})).json()).inactive_official,true);
  const inactiveBulk=await (await appointment({action:'notify_all',kejohanan_id:14,jadual_ids:[matchId]})).json();
  assert.equal(inactiveBulk.matches_skipped_inactive,1);
  assert.equal(inactiveBulk.total_assignments,0);
  db.prepare('UPDATE users SET aktif=1 WHERE id=?').run(userId);
  emailAccepted=false;
  const appNotice=await (await appointment({action:'notify',jadual_id:matchId})).json();
  emailAccepted=true;
  assert.equal(appNotice.error,false);
  assert.ok(db.prepare("SELECT id FROM notifications WHERE user_id=? AND type='Lantikan'").get(userId));
  const appPending=db.prepare('SELECT notif_hantar,tarikh_notif FROM lantikan_pengadil WHERE jadual_id=? AND pengadil_id=?').get(matchId,userId);
  assert.equal(appPending.notif_hantar,0,'app binding/queued notice alone is not proof of delivery');
  assert.equal(appPending.tarikh_notif,null,'do not start the deadline on failed email and unproven push');
  const appBulk=await (await appointment({action:'notify_all',kejohanan_id:14,jadual_ids:[matchId]})).json();
  assert.equal(appBulk.matches_processed,1);
  assert.equal(appBulk.matches_skipped_channel,0);
  db.prepare('DELETE FROM worker_webpush_subscriptions WHERE user_id=?').run(userId);
  const unlinkedBulk=await (await appointment({action:'notify_all',kejohanan_id:14,jadual_ids:[matchId]})).json();
  assert.equal(unlinkedBulk.matches_skipped_channel,1);

  db.prepare('UPDATE users SET aktif=0 WHERE id=?').run(userId);
  const linked = await worker.telegramWebhook(new Request('https://refpahang.example/api/telegram-webhook.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { chat: { id: 778899001 }, text: '/start newref-link-token' } }),
  }), env);
  assert.equal(linked.status, 200);
  assert.equal(db.prepare('SELECT telegram_chat_id FROM users WHERE id=?').get(userId).telegram_chat_id, 778899001);
  assert.equal(db.prepare('SELECT aktif FROM users WHERE id=?').get(userId).aktif, 0);
  db.prepare('UPDATE users SET aktif=1 WHERE id=?').run(userId);

  const created = await appointment({ jadual_id: matchId, pengadil_id: userId, jawatan: 'Pengadil' });
  assert.equal(created.status, 200);
  const notified = await appointment({ action: 'notify', jadual_id: matchId });
  assert.equal(notified.status, 200);
  assert.ok(sentTelegram.some(item => item.chatId === 778899001 &&
    item.message.includes('Lantikan Pengadil')));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM permohonan WHERE user_id=?').get(userId).n, 0);
  console.log('Appointment eligibility: inactive account/year, Telegram OR app, expired/wrong sessions, atomic guards, individual/bulk notices passed');
} finally { close(); }
