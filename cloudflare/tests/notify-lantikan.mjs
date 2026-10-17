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
  for (const [index,official] of officials.entries()) {
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
  assert.deepEqual(emails.map((mail)=>mail.to).sort(),kup.slice(0,3).map((o)=>o.email).sort());
  for (const mail of emails) {
    assert.match(mail.subject,/^Perubahan Perlawanan: .+ — Home FC lwn Away FC — 01 Mar 2099$/);
    assert.equal(mail.type,'lantikan');
    assert.ok(mail.html.includes('Stadium Baharu (sebelum ini: Stadium Lama)'));
    assert.ok(mail.html.includes('16:30 MYT (sebelum ini: 10:00 MYT)'));
  }
  const firstMail=emails.find((mail)=>mail.to===kup[0].email);
  assert.ok(firstMail.html.includes(`token=${rows1[0].email_token}&amp;action=accept`),'answer links for pending officials');
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
  assert.deepEqual(emails.map((mail)=>mail.to).sort(),[kup[0].email,kup[1].email].sort());
  const acceptedMail=emails.find((mail)=>mail.to===kup[1].email);
  assert.ok(!acceptedMail.html.includes('action=accept'));
  assert.ok(acceptedMail.html.includes('kekal diterima'));

  // --- Admin acceptance override: email + Telegram to the official ---------
  reset();
  const override=await audit({action:'admin_override_acceptance',lantikan_id:rows1[2].id});
  assert.equal(override.error,false,override.message);
  const overrideMail=emails.find((mail)=>mail.to===kup[2].email);
  assert.match(overrideMail.subject,/^Lantikan Diterima \(Pengesahan Admin\): /);
  assert.ok(telegrams.some((t)=>t.chatId===String(kup[2].telegram_chat_id) && t.text.includes('Penerimaan Lantikan Disahkan')));
  assert.equal(count(`SELECT count(*) FROM lantikan_audit_log WHERE lantikan_id=? AND event_type='override_notification'`,
    rows1[2].id),2);

  // --- Cancellation: PP Daerah of a state tournament hear once per match ----
  const active=all(`SELECT DISTINCT u.persatuan_id FROM lantikan_pengadil lp JOIN users u ON u.id=lp.pengadil_id
    WHERE lp.jadual_id=? AND lp.status IN ('Belum Jawab','Diterima') AND lp.notif_hantar=1`,m1).map((r)=>r.persatuan_id);
  const expectedPP=all(`SELECT email FROM users WHERE role='PP Daerah' AND aktif=1 AND trim(COALESCE(email,''))<>''
    AND COALESCE(NULLIF(persatuan_id,0),district_id) IN (SELECT value FROM json_each(?))`,JSON.stringify(active))
    .map((r)=>r.email).sort();
  assert.ok(expectedPP.length>0);
  reset();
  const cancelled=await lantikan({action:'batal_jadual',jadual_id:m1,status:'Dibatalkan',sebab:'Padang banjir'});
  assert.equal(cancelled.error,false);
  const ppMails=emails.filter((mail)=>/^Perlawanan Dibatalkan: Home FC lwn Away FC/.test(mail.subject));
  assert.deepEqual(ppMails.map((mail)=>mail.to).sort(),expectedPP);
  assert.ok(ppMails[0].html.includes('Padang banjir'));
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
  assert.equal(emails.filter((mail)=>/^Perlawanan Ditangguhkan: /.test(mail.subject)).length,0);

  // --- Auto-reject: queued with the rejection, delivered by the outbox ------
  const m3=insertMatch('2099-05-01','10:00:00');
  const rows3=await appointAndNotify(m3,kup.slice(6,9));
  db.prepare(`UPDATE lantikan_pengadil SET tarikh_notif=? WHERE jadual_id=?`).run(kl(Date.now()-4*3600_000),m3);
  reset();
  assert.equal(await worker.autoTolakLantikanTertunggak(env,{jadual_id:m3}),3);
  assert.equal(emails.length+telegrams.length,0,'nothing is sent inside the request');
  assert.equal(count(`SELECT count(*) FROM worker_notification_outbox WHERE kind='auto_reject_notification'
    AND lantikan_id IN (SELECT id FROM lantikan_pengadil WHERE jadual_id=?)`,m3),6);
  const digestRows=all(`SELECT * FROM worker_notification_outbox WHERE kind='auto_reject_digest'`);
  assert.ok(digestRows.length>0);
  assert.ok(digestRows.every((row)=>row.channel==='telegram'),'digests never email Admin or PP Daerah');
  assert.equal(count(`SELECT count(*) FROM notifications WHERE user_id=? AND type='Lantikan Ditolak'`,kup[6].id),1);
  assert.ok(count(`SELECT count(*) FROM notifications WHERE user_id=? AND type='Lantikan Ditolak'`,admin.id)>=1);
  assert.equal(await worker.autoTolakLantikanTertunggak(env,{jadual_id:m3}),0);
  const drained=await worker.processNotificationOutbox(env,200);
  assert.equal(drained.failed,0);
  assert.deepEqual(emails.map((mail)=>mail.to).sort(),kup.slice(6,9).map((o)=>o.email).sort());
  assert.ok(emails.every((mail)=>/^Lantikan Ditolak Automatik: /.test(mail.subject)));
  const adminChats=all("SELECT telegram_chat_id FROM users WHERE role='Admin' AND aktif=1 AND telegram_chat_id IS NOT NULL")
    .map((r)=>String(r.telegram_chat_id));
  assert.ok(adminChats.every((chat)=>telegrams.some((t)=>t.chatId===chat && t.text.includes('3 lantikan'))));
  assert.equal(count(`SELECT count(*) FROM worker_notification_outbox WHERE status='pending'`),0);
  assert.equal(count(`SELECT count(*) FROM lantikan_audit_log WHERE lantikan_id=? AND event_type='auto_reject_notification'
    AND event_status='success'`,rows3[0].id),2);

  // --- Answer reminder: once per dispatch, skipped once answered ------------
  const day=3600_000;
  assert.ok(worker.reminderWindow('Liga',kl(Date.now()-37*day),'2099-01-01','10:00:00'));
  assert.equal(worker.reminderWindow('Liga',kl(Date.now()-30*day),'2099-01-01','10:00:00'),null);
  assert.ok(worker.reminderWindow('Karnival',kl(Date.now()-2.5*day),'2099-01-01','10:00:00'));
  assert.equal(worker.reminderWindow('Karnival',kl(Date.now()-1*day),'2099-01-01','10:00:00'),null);
  const m4=insertMatch('2099-06-01','10:00:00');
  db.prepare("UPDATE lantikan_pengadil SET status='Ditolak' WHERE jadual_id=?").run(m1);
  const rows4=await appointAndNotify(m4,kup.slice(0,3));
  db.prepare(`UPDATE lantikan_pengadil SET tarikh_notif=? WHERE jadual_id=?`).run(kl(Date.now()-2.5*day),m4);
  reset();
  assert.equal(await worker.sendAppointmentReminders(env),3);
  assert.equal(await worker.sendAppointmentReminders(env),0,'no duplicate reminder');
  db.prepare("UPDATE lantikan_pengadil SET status='Diterima' WHERE id=?").run(rows4[0].id);
  const reminded=await worker.processNotificationOutbox(env,200);
  assert.equal(reminded.skipped,2,'answered appointment skips email and Telegram');
  assert.deepEqual(emails.map((mail)=>mail.to).sort(),[kup[1].email,kup[2].email].sort());
  assert.ok(emails.every((mail)=>/^Peringatan Lantikan: /.test(mail.subject)));
  assert.ok(emails.find((mail)=>mail.to===kup[1].email).html.includes(`token=${rows4[1].email_token}&amp;action=accept`));
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
