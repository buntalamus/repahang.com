import assert from 'node:assert/strict';
import { bundle, openDatabase } from './_harness.mjs';

const worker = await bundle(`
  export {lantikanWrite} from '../src/lantikan-write';
  export {telegramWebhook} from '../src/telegram-webhook';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const { db, DB, close } = openDatabase(['0009_mysql_on_update_triggers', '0010_worker_write_guards','0022_district_appointments']);
const sentTelegram = [];
worker.setEmailSenderForTests(async () => true);
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
  assert.equal((await denied.json()).telegram_link_required, true);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM lantikan_pengadil WHERE jadual_id=?').get(matchId).n, 0);

  const oldUserId = Number(db.prepare(`INSERT INTO users(email,password,role,nama_penuh,no_ic,
    jenis_pengadil,aktif,persatuan_id)
    VALUES('old.ref@example.invalid','unused','Pengadil','Pengadil Lama Ujian',
      '990101061237','Pengadil Negeri',1,1)`).run().lastInsertRowid);
  db.prepare('INSERT INTO pool_pengadil(kejohanan_id,pengadil_id) VALUES(14,?)').run(oldUserId);
  const oldDenied = await appointment({ jadual_id: matchId, pengadil_id: oldUserId, jawatan: 'Pengadil' });
  assert.equal(oldDenied.status, 409);
  assert.equal((await oldDenied.json()).telegram_link_required, true);

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
  assert.equal((await waiting.json()).telegram_link_required, true);
  assert.equal(sentTelegram.length, 0);

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
  console.log('Telegram: new and old unlinked referees wait, inactive link preserves account state, then delivery succeeds');
} finally { close(); }
