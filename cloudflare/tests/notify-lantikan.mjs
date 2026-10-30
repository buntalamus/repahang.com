// New appointment notices: match change, acceptance override, auto-reject,
// answer reminders and PP Daerah cancellation copies.
import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {lantikanWrite} from '../src/lantikan-write';
  export {schedule} from '../src/schedule';
  export {appointmentAudit} from '../src/appointment-audit';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests} from '../src/php/telegram';
  export {autoTolakLantikanTertunggak} from '../src/php/lantikan-helper';
  export {processNotificationOutbox} from '../src/notify';
  export {sendAppointmentReminders,reminderWindow} from '../src/lantikan-notify';
`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers',
  '0010_worker_write_guards','0020_match_team_regions','0022_district_appointments']);
const emails=[];
const telegrams=[];
worker.setEmailSenderForTests(async(to,subject,html,name,type)=>{emails.push({to,subject,html,name,type});return true;});
worker.setTelegramSenderForTests(async(chatId,text,markup)=>{telegrams.push({chatId:String(chatId),text,markup});return true;});
const env={DB,BASE_URL:'https://refpahang.com',TELEGRAM_BOT_USERNAME:'refpahang_bot',
  STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1',
  MEDIA:{get:async()=>null}};
const one=(sql,...values)=>db.prepare(sql).get(...values);
const all=(sql,...values)=>db.prepare(sql).all(...values);
const count=(sql,...values)=>Number(Object.values(db.prepare(sql).get(...values))[0]);
const reset=()=>{emails.length=0;telegrams.length=0;};
const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 ORDER BY id LIMIT 1");
const adminUser={id:admin.id,role:'Admin'};
const cookie=await sessionCookie(db,admin.id);
const AUTO='Ditolak automatik - tiada jawapan dalam tempoh';
/** KL local "Y-m-d H:i:s" for a Unix ms timestamp. */
const kl=(ms)=>new Date(ms+8*3600_000).toISOString().slice(0,19).replace('T',' ');

const lantikan=(body)=>worker.lantikanWrite(new Request('https://refpahang.com/api/lantikan.php',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env,adminUser).then((r)=>r.json());
const putMatch=(body)=>worker.schedule(new Request('https://refpahang.com/api/jadual-perlawanan.php',{method:'PUT',
  headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)}),env).then((r)=>r.json());
const audit=(body)=>worker.appointmentAudit(new Request('https://refpahang.com/api/lantikan-audit.php',{method:'POST',
  headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)}),env).then((r)=>r.json());

const tournament=14;
// Pool officials with email + Telegram, from districts that have a PP Daerah with an email.
const kup=all(`SELECT u.id,u.email,u.telegram_chat_id,u.nama_penuh,u.persatuan_id FROM pool_pengadil pp
  JOIN users u ON u.id=pp.pengadil_id WHERE pp.kejohanan_id=? AND u.aktif=1
    AND COALESCE(u.jenis_pengadil,'')<>'Penilai Pengadil'
    AND trim(COALESCE(u.email,''))<>'' AND u.telegram_chat_id IS NOT NULL
    AND EXISTS(SELECT 1 FROM users p WHERE p.role='PP Daerah' AND p.aktif=1 AND p.persatuan_id=u.persatuan_id
      AND trim(COALESCE(p.email,''))<>'')
  ORDER BY u.id`,tournament);
assert.ok(kup.length>=9,'fixture pool');
let matchNo=0;
const insertMatch=(tarikh,masa)=>Number(db.prepare(`INSERT INTO jadual_perlawanan
  (kejohanan_id,no_perlawanan,tarikh,masa,kategori,pasukan_home,pasukan_away,tempat,status,created_at,updated_at)
  VALUES (?,?,?,?,'U12','Home FC','Away FC','Stadium Lama','Belum Lantik','2026-10-01 10:00:00','2026-10-01 10:00:00')`)
  .run(tournament,`N${String(++matchNo).padStart(2,'0')}`,tarikh,masa).lastInsertRowid);
async function appointAndNotify(jadualId,officials) {
  const roles=['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2'];
  const year=Number(one('SELECT substr(tarikh,1,4) AS year FROM jadual_perlawanan WHERE id=?',jadualId).year);
  for (const [index,official] of officials.entries()) {
    // Notification scenarios need eligible annual registrations for their synthetic match year.
    if (!one("SELECT id FROM permohonan WHERE user_id=? AND tahun_permohonan=? AND jenis_borang='pengadil_berdaftar'",official.id,year)) {
      const sample=one("SELECT * FROM permohonan WHERE jenis_borang='pengadil_berdaftar' LIMIT 1");
      const columns=Object.keys(sample).filter(key=>key!=='id');
      const registration={...sample,user_id:official.id,tahun_permohonan:year,status:'Approved',jenis_pengadil:'Pengadil Negeri'};
      db.prepare(`INSERT INTO permohonan(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`)
        .run(...columns.map(key=>registration[key]));
    }
    const result=await lantikan({jadual_id:jadualId,pengadil_id:official.id,jawatan:roles[index]});
    assert.equal(result.error,false,result.message);
  }
  const notified=await lantikan({action:'notify',jadual_id:jadualId});
  assert.equal(notified.error,false,notified.message);
  return all('SELECT * FROM lantikan_pengadil WHERE jadual_id=? ORDER BY id',jadualId);
}
const matchBody=(id,overrides={})=>({id,no_perlawanan:'N01',tarikh:'2099-03-01',masa:'10:00',kategori:'U12',
  peringkat:'',kumpulan:'',pasukan_home:'Home FC',pasukan_away:'Away FC',tempat:'Stadium Lama',...overrides});

try {
  // --- Match details changed after dispatch -------------------------------
  const m1=insertMatch('2099-03-01','10:00:00');
  const rows1=await appointAndNotify(m1,kup.slice(0,3));
  reset();
  const districtMailBefore=count('SELECT count(*) FROM worker_district_appointment_mail');
  let edited=await putMatch(matchBody(m1,{masa:'16:30',tempat:'Stadium Baharu'}));
  assert.deepEqual(edited,{error:false,message:'Perlawanan berjaya dikemaskini.',officials_notified:3});
  // Formal schedule changes always email the three officials.
  assert.equal(emails.length,3);
  for (const message of telegrams) {
    assert.ok(message.text.includes('Stadium Baharu (sebelum ini: Stadium Lama)'));
    assert.ok(message.text.includes('16:30 MYT (sebelum ini: 10:00 MYT)'));
  }
  assert.equal(telegrams.length,3);
  assert.equal(telegrams.find((t)=>t.chatId===String(kup[0].telegram_chat_id)).markup.inline_keyboard[0][0].callback_data,
    `act:accept:token:${rows1[0].tg_token}`);
  assert.equal(count(`SELECT count(*) FROM lantikan_audit_log WHERE jadual_id=? AND event_type='schedule_change_notification'
    AND event_status='success'`,m1),6);
  assert.equal(count('SELECT count(*) FROM worker_district_appointment_mail'),districtMailBefore,'no duplicate district copy');
  assert.equal(count(`SELECT count(*) FROM notifications WHERE user_id=? AND type='Perubahan Perlawanan'`,kup[0].id),1);

  // A change to a field officials do not need (kategori) notifies nobody.
  reset();
  edited=await putMatch(matchBody(m1,{masa:'16:30',tempat:'Stadium Baharu',kategori:'U13'}));
  assert.equal(edited.officials_notified,0);
  assert.equal(emails.length+telegrams.length,0);

  // Accepted officials get the change without answer links; rejected ones are not told.
  db.prepare("UPDATE lantikan_pengadil SET status='Diterima',tg_token=NULL,email_token=NULL WHERE id=?").run(rows1[1].id);
  db.prepare("UPDATE lantikan_pengadil SET status='Ditolak',komen=? WHERE id=?").run(AUTO,rows1[2].id);
  reset();
  edited=await putMatch(matchBody(m1,{tarikh:'2099-03-02',masa:'16:30',tempat:'Stadium Baharu',kategori:'U13'}));
  assert.equal(edited.officials_notified,2);
  assert.deepEqual(emails.map(e=>e.to).sort(),[kup[0],kup[1]].map(o=>o.email).sort());
  assert.deepEqual(telegrams.map((t)=>t.chatId).sort(),[kup[0],kup[1]].map((o)=>String(o.telegram_chat_id)).sort());
  const acceptedTelegram=telegrams.find((t)=>t.chatId===String(kup[1].telegram_chat_id));
  assert.ok(!acceptedTelegram.markup?.inline_keyboard);
  assert.ok(acceptedTelegram.text.includes('kekal diterima'));

  // --- Admin acceptance override: email + Telegram to the official ---------
  reset();
  const override=await audit({action:'admin_override_acceptance',lantikan_id:rows1[2].id});
  assert.equal(override.error,false,override.message);
  assert.ok(emails.some((mail)=>mail.to===kup[2].email),'formal acceptance confirmation always emails');
  assert.ok(telegrams.some((t)=>t.chatId===String(kup[2].telegram_chat_id) && t.text.includes('Penerimaan Lantikan Disahkan')));
  assert.equal(count(`SELECT count(*) FROM lantikan_audit_log WHERE lantikan_id=? AND event_type='override_notification'`,
    rows1[2].id),2);

  // --- Cancellation: PP Daerah of a state tournament hear once per match ----
  const active=all(`SELECT DISTINCT u.persatuan_id FROM lantikan_pengadil lp JOIN users u ON u.id=lp.pengadil_id
    WHERE lp.jadual_id=? AND lp.status IN ('Belum Jawab','Diterima') AND lp.notif_hantar=1`,m1).map((r)=>r.persatuan_id);
  const districtPP=all(`SELECT email,telegram_chat_id FROM users WHERE role='PP Daerah' AND aktif=1 AND trim(COALESCE(email,''))<>''
    AND COALESCE(NULLIF(persatuan_id,0),district_id) IN (SELECT value FROM json_each(?))`,JSON.stringify(active));
  assert.ok(districtPP.length>0);
  // PP with Telegram hear there; email only for PP without Telegram.
  const expectedPP=districtPP.filter((r)=>!String(r.telegram_chat_id ?? '').trim()).map((r)=>r.email).sort();
  const telegramPP=districtPP.filter((r)=>String(r.telegram_chat_id ?? '').trim()).map((r)=>String(r.telegram_chat_id));
  reset();
  const cancelled=await lantikan({action:'batal_jadual',jadual_id:m1,status:'Dibatalkan',sebab:'Padang banjir'});
  assert.equal(cancelled.error,false);
  const ppMails=emails.filter((mail)=>/^Perlawanan Dibatalkan: Home FC lwn Away FC/.test(mail.subject));
  assert.deepEqual(ppMails.map((mail)=>mail.to).sort(),expectedPP);
  for (const official of kup.slice(0,3)) assert.ok(emails.some(e=>e.to===official.email && e.html.includes('Padang banjir')),'formal cancellation email for every affected official');
  if (ppMails.length) assert.ok(ppMails[0].html.includes('Padang banjir'));
  for (const chat of telegramPP) assert.ok(telegrams.some((t)=>t.chatId===chat && t.text.includes('Padang banjir')));
  // A district-owned tournament relies on the district copies instead.
  const districtTournament=Number(db.prepare(`INSERT INTO kejohanan(nama,jenis_kejohanan,peringkat_kejohanan,status,
    tarikh_mula,tarikh_akhir,lantikan_persatuan_id,created_at,updated_at) VALUES('Liga Daerah Ujian','Liga','Daerah',
    'Aktif','2099-04-01','2099-04-30',?,'2026-10-01 10:00:00','2026-10-01 10:00:00')`)
    .run(kup[3].persatuan_id).lastInsertRowid);
  for (const official of kup.slice(3,6)) {
    db.prepare(`INSERT INTO pool_pengadil(kejohanan_id,pengadil_id,created_at) VALUES(?,?,'2026-10-01 10:00:00')`)
      .run(districtTournament,official.id);
  }
  const m2=Number(db.prepare(`INSERT INTO jadual_perlawanan(kejohanan_id,no_perlawanan,tarikh,masa,pasukan_home,
    pasukan_away,tempat,status,created_at,updated_at) VALUES(?,'D01','2099-04-01','10:00:00','Home FC','Away FC',
    'Padang','Belum Lantik','2026-10-01 10:00:00','2026-10-01 10:00:00')`).run(districtTournament).lastInsertRowid);
  await appointAndNotify(m2,kup.slice(3,6));
  reset();
  await lantikan({action:'batal_jadual',jadual_id:m2,status:'Ditangguhkan',sebab:'Cuaca'});
  for (const official of kup.slice(3,6)) assert.ok(emails.some(e=>e.to===official.email && e.html.includes('Cuaca')),'formal postponement email for every affected official');

  // --- Auto-reject: queued with the rejection, delivered by the outbox ------
  db.prepare('UPDATE users SET telegram_chat_id=123456789 WHERE id=?').run(admin.id);
  const m3=insertMatch('2099-05-01','10:00:00');
  const rows3=await appointAndNotify(m3,kup.slice(6,9));
  db.prepare(`UPDATE lantikan_pengadil SET tarikh_notif=? WHERE jadual_id=?`).run(kl(Date.now()-4*3600_000),m3);
  db.prepare("UPDATE jadual_perlawanan SET tarikh=date('now','+8 hours','+2 hours'),masa=time('now','+8 hours','+2 hours') WHERE id=?").run(m3);
  reset();
  assert.equal(await worker.autoTolakLantikanTertunggak(env,{jadual_id:m3}),3);
  assert.equal(emails.length+telegrams.length,0,'nothing is sent inside the request');
  assert.equal(count(`SELECT count(*) FROM worker_notification_outbox WHERE kind='auto_reject_notification'
    AND lantikan_id IN (SELECT id FROM lantikan_pengadil WHERE jadual_id=?)`,m3),6);
  const digestRows=all(`SELECT * FROM worker_notification_outbox WHERE kind='auto_reject_owner'`);
  assert.ok(digestRows.length>0);
  assert.ok(digestRows.some((row)=>row.channel==='email'),'pelantik gets email');
  assert.ok(digestRows.some((row)=>row.channel==='telegram'),'pelantik gets Telegram');
  assert.equal(count(`SELECT count(*) FROM notifications WHERE user_id=? AND type='Lantikan Ditolak'`,kup[6].id),1);
  assert.ok(count(`SELECT count(*) FROM notifications WHERE user_id=? AND type='Lantikan Ditolak'`,admin.id)>=1);
  assert.equal(await worker.autoTolakLantikanTertunggak(env,{jadual_id:m3}),0);
  const drained=await worker.processNotificationOutbox(env,200);
  assert.equal(drained.failed,0);
  // Officials receive formal auto-rejection emails; the owner keeps routine fallback.
  assert.equal(emails.filter(mail=>/^Lantikan Ditolak Automatik: /.test(mail.subject)).length,3);
  assert.equal(kup.slice(6,9).filter(o=>telegrams.some(t=>t.chatId===String(o.telegram_chat_id))).length,3);
  const adminChats=all("SELECT telegram_chat_id FROM users WHERE role='Admin' AND aktif=1 AND telegram_chat_id IS NOT NULL")
    .map((r)=>String(r.telegram_chat_id));
  assert.ok(telegrams.some(t=>t.text.includes('Pengganti Diperlukan')));
  assert.equal(count(`SELECT count(*) FROM worker_notification_outbox WHERE status='pending'`),0);
  assert.equal(count(`SELECT count(*) FROM lantikan_audit_log WHERE lantikan_id=? AND event_type='auto_reject_notification'
    AND event_status='success'`,rows3[0].id),2);

  // A match that already kicked off is tidied up silently (no stale notices).
  const m5=insertMatch('2099-05-02','10:00:00');
  await appointAndNotify(m5,kup.slice(6,9));
  const pastRows=all('SELECT id FROM lantikan_pengadil WHERE jadual_id=?',m5);
  assert.equal(pastRows.length,3);
  {
    db.prepare("UPDATE jadual_perlawanan SET tarikh=date('now','+8 hours','-5 days'),masa='10:00:00' WHERE id=?").run(m5);
    db.prepare(`UPDATE lantikan_pengadil SET status='Belum Jawab',notif_hantar=1,tarikh_notif=datetime('now','+8 hours','-8 days')
      WHERE jadual_id=?`).run(m5);
    const queuedBefore=count('SELECT count(*) FROM worker_notification_outbox');
    assert.equal(await worker.autoTolakLantikanTertunggak(env,{jadual_id:m5}),0);
    assert.equal(count('SELECT count(*) FROM worker_notification_outbox'),queuedBefore,'no notices for past matches');
  }

  // --- Answer reminder: once per dispatch, skipped once answered ------------
  const day=3600_000;
  const league=kl(Date.now()+59*day); const carnival=kl(Date.now()+3.5*day);
  assert.ok(worker.reminderWindow('Liga',kl(Date.now()-37*day),league.slice(0,10),league.slice(11)));
  const far=kl(Date.now()+80*day);
  assert.equal(worker.reminderWindow('Liga',kl(Date.now()-30*day),far.slice(0,10),far.slice(11)),null);
  assert.ok(worker.reminderWindow('Karnival',kl(Date.now()-2.5*day),carnival.slice(0,10),carnival.slice(11)));
  const early=kl(Date.now()+6*day);
  assert.equal(worker.reminderWindow('Karnival',kl(Date.now()-1*day),early.slice(0,10),early.slice(11)),null);
  const m4=insertMatch('2099-06-01','10:00:00');
  db.prepare("UPDATE lantikan_pengadil SET status='Ditolak' WHERE jadual_id=?").run(m1);
  const rows4=await appointAndNotify(m4,kup.slice(0,3));
  db.prepare(`UPDATE lantikan_pengadil SET tarikh_notif=? WHERE jadual_id=?`).run(kl(Date.now()-2.5*day),m4);
  db.prepare("UPDATE jadual_perlawanan SET tarikh=date('now','+8 hours','+210 minutes'),masa=time('now','+8 hours','+210 minutes') WHERE id=?").run(m4);
  reset();
  assert.equal(await worker.sendAppointmentReminders(env),3);
  assert.equal(await worker.sendAppointmentReminders(env),0,'no duplicate reminder');
  db.prepare("UPDATE lantikan_pengadil SET status='Diterima' WHERE id=?").run(rows4[0].id);
  const reminded=await worker.processNotificationOutbox(env,200);
  // 2 for the answered appointment (email and Telegram) + 2 emails not needed after Telegram.
  assert.equal(reminded.skipped,4,'answered appointment skips email and Telegram');
  assert.deepEqual(emails,[]);
  assert.equal(telegrams.length,2);
  assert.ok(telegrams[0].markup.inline_keyboard);
  // A fresh dispatch (new tarikh_notif) allows one new reminder.
  db.prepare(`UPDATE lantikan_pengadil SET tarikh_notif=? WHERE id=?`).run(kl(Date.now()-2.4*day),rows4[1].id);
  assert.equal(await worker.sendAppointmentReminders(env),1);
  console.log('notify-lantikan: ok');
} finally {
  worker.setEmailSenderForTests(null);
  worker.setTelegramSenderForTests(null);
  close();
}
