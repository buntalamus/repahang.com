import assert from 'node:assert/strict';
import {bundle,openDatabase} from './_harness.mjs';

const worker=await bundle(`
  export {lantikanWrite} from '../src/lantikan-write';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests} from '../src/php/telegram';
  export {autoTolakLantikanTertunggak,processQueuedKupCrewNotifications} from '../src/php/lantikan-helper';
`);
const {db,DB,hooks,close}=openDatabase(['0009_mysql_on_update_triggers','0010_worker_write_guards']);
const emails=[];
const telegrams=[];
worker.setEmailSenderForTests(async(to,subject,html,name,type,images)=>{
  emails.push({to,subject,html,name,type,images});return true;});
worker.setTelegramSenderForTests(async(chatId,text,markup)=>{
  telegrams.push({chatId,text,markup});return true;});
const env={DB,BASE_URL:'https://refpahang.com',TELEGRAM_BOT_USERNAME:'refpahang_bot',
  STAGING_AUTH_ENABLED:'0',STAGING_WRITES_ENABLED:'0',APPOINTMENT_DELIVERY_ENABLED:'0',
  MEDIA:{get:async(key)=>key==='logos/home.png'
    ? {arrayBuffer:async()=>new Uint8Array([137,80,78,71]).buffer} : null}};
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const user={id:admin.id,role:'Admin'};
const call=(body,method='POST',query='')=>worker.lantikanWrite(new Request(
  `https://refpahang.com/api/lantikan.php${query}`,{method,
    headers:{'Content-Type':'application/json','User-Agent':'Lantikan test','CF-Connecting-IP':'203.0.113.9'},
    ...(method==='POST'?{body:JSON.stringify(body)}:{})}),env,user);
const read=async(response)=>({status:response.status,body:await response.json()});
const one=(sql,...values)=>db.prepare(sql).get(...values);
const count=(sql,...values)=>Number(Object.values(db.prepare(sql).get(...values))[0]);

try {
  const tournament=14;
  const pool=db.prepare(`SELECT u.id,u.email,u.telegram_chat_id,u.jenis_pengadil FROM pool_pengadil pp
    JOIN users u ON u.id=pp.pengadil_id WHERE pp.kejohanan_id=? AND u.aktif=1
      AND trim(COALESCE(u.email,''))<>'' AND u.telegram_chat_id IS NOT NULL ORDER BY u.id`).all(tournament);
  const kup=pool.filter((row)=>row.jenis_pengadil!=='Penilai Pengadil');
  const ra=pool.find((row)=>row.jenis_pengadil==='Penilai Pengadil');
  assert.ok(kup.length>=6 && ra,'fixture pool');
  const outsider=one(`SELECT id FROM users WHERE aktif=1 AND id NOT IN
    (SELECT pengadil_id FROM pool_pengadil WHERE kejohanan_id=? AND pengadil_id IS NOT NULL) LIMIT 1`,tournament);
  const insertMatch=(tarikh,masa,no)=>Number(db.prepare(`INSERT INTO jadual_perlawanan
    (kejohanan_id,no_perlawanan,tarikh,masa,pasukan_home,pasukan_away,logo_home,tempat,status,created_at,updated_at)
    VALUES (?,?,?,?,'Home FC','Away FC','/uploads/logos/home.png','Stadium Ujian','Belum Lantik',
      '2026-10-01 10:00:00','2026-10-01 10:00:00')`).run(tournament,no,tarikh,masa,).lastInsertRowid);
  const future=insertMatch('2026-12-01','09:13:00','U01');
  const past=insertMatch('2026-09-01','08:17:00','U02');

  assert.equal((await call({jadual_id:future,pengadil_id:kup[0].id,jawatan:'Pengadil'})).status,503);
  env.STAGING_AUTH_ENABLED='1';env.STAGING_WRITES_ENABLED='1';env.APPOINTMENT_DELIVERY_ENABLED='1';

  // Validation mirrors lantikan.php.
  assert.equal((await call({jadual_id:future,jawatan:'Pengadil'})).status,400);
  assert.equal((await call({jadual_id:future,pengadil_id:kup[0].id,pengadil_luar_id:5,jawatan:'Pengadil'})).status,400);
  assert.equal((await call({jadual_id:future,pengadil_id:kup[0].id,jawatan:'Juru'})).status,400);
  assert.equal((await call({jadual_id:999999,pengadil_id:kup[0].id,jawatan:'Pengadil'})).status,404);
  assert.deepEqual((await read(await call({jadual_id:future,pengadil_id:outsider.id,jawatan:'Pengadil'}))).body.message,
    'Pegawai yang dipilih tiada dalam pool kejohanan ini.');
  assert.equal((await read(await call({jadual_id:future,pengadil_id:ra.id,jawatan:'Pengadil'}))).body.message,
    'Penilai Pengadil tidak boleh ditempatkan dalam slot KUP.');
  assert.equal((await read(await call({jadual_id:future,pengadil_id:kup[0].id,jawatan:'Penilai Pengadil'}))).body.message,
    'Slot Penilai Pengadil hanya boleh diberikan kepada pegawai berjenis Penilai Pengadil.');

  // New pre-kickoff appointment: MySQL defaults, audit and match status.
  const created=await read(await call({jadual_id:future,pengadil_id:String(kup[0].id),jawatan:'Pengadil'}));
  assert.deepEqual(created,{status:200,body:{error:false,message:'Pengadil berjaya dilantik.'}});
  const r1=one("SELECT * FROM lantikan_pengadil WHERE jadual_id=? AND jawatan='Pengadil'",future);
  assert.deepEqual([r1.status,r1.notif_hantar,r1.tg_notif_hantar,r1.created_by],['Belum Jawab',0,0,admin.id]);
  assert.ok(r1.created_at && r1.updated_at);
  const createdAudit=one("SELECT * FROM lantikan_audit_log WHERE lantikan_id=? ORDER BY id DESC",r1.id);
  assert.equal(createdAudit.event_type,'appointment_created');
  assert.equal(createdAudit.ip_address,'203.0.113.9');
  assert.deepEqual(JSON.parse(createdAudit.details_json),{previous_pengadil_id:null,
    previous_pengadil_luar_id:null,previous_status:null,match_started:false,notification_sent:false});
  assert.equal(one('SELECT status FROM jadual_perlawanan WHERE id=?',future).status,'Menunggu Pengesahan');
  assert.equal((await read(await call({jadual_id:future,pengadil_id:kup[0].id,jawatan:'Pengadil'}))).body.message,
    'Lantikan dikemaskini.');
  assert.equal(one("SELECT event_type FROM lantikan_audit_log WHERE lantikan_id=? ORDER BY id DESC",r1.id).event_type,
    'appointment_reviewed');
  assert.equal(count('SELECT count(*) FROM worker_write_guards'),2);

  // A slot changed between read and batch aborts everything.
  hooks.beforeBatch=()=>db.prepare("UPDATE lantikan_pengadil SET status='Ditolak' WHERE id=?").run(r1.id);
  assert.equal((await call({jadual_id:future,pengadil_id:kup[1].id,jawatan:'Pengadil'})).status,409);
  assert.equal(one('SELECT pengadil_id FROM lantikan_pengadil WHERE id=?',r1.id).pengadil_id,kup[0].id);
  db.prepare("UPDATE lantikan_pengadil SET status='Belum Jawab' WHERE id=?").run(r1.id);

  // Same time slot conflict.
  const twin=insertMatch('2026-12-01','09:13:00','U03');
  assert.equal((await read(await call({jadual_id:twin,pengadil_id:kup[0].id,jawatan:'Pengadil'}))).body.message,
    'Pegawai ini sudah dilantik sebagai Pengadil pada tarikh dan masa yang sama.');

  // Notify before the trio is complete is refused.
  const incomplete=await read(await call({action:'notify',jadual_id:future}));
  assert.equal(incomplete.status,409);
  assert.deepEqual(incomplete.body.missing_positions,['Penolong Pengadil 1','Penolong Pengadil 2']);
  await call({jadual_id:future,pengadil_id:kup[1].id,jawatan:'Penolong Pengadil 1'});
  await call({jadual_id:future,pengadil_id:kup[2].id,jawatan:'Penolong Pengadil 2'});

  const notified=await read(await call({action:'notify',jadual_id:future}));
  assert.equal(notified.status,200);
  assert.deepEqual(notified.body,{error:false,
    message:'Notifikasi berjaya dihantar kepada 3 pegawai. 3 emel dihantar. 3 notifikasi Telegram dihantar.',
    tg_sent:3,tg_skipped:0,email_sent:3,delivery_failed:0,appointment_complete:true,renotify_count:0});
  const rows=db.prepare("SELECT * FROM lantikan_pengadil WHERE jadual_id=? ORDER BY id").all(future);
  for (const row of rows) {
    assert.equal(row.notif_hantar,1);assert.equal(row.tg_notif_hantar,1);
    assert.match(row.email_token,/^[a-f0-9]{32}$/);assert.match(row.tg_token,/^[a-f0-9]{32}$/);
    assert.ok(row.tarikh_notif);
  }
  assert.equal(one('SELECT status FROM jadual_perlawanan WHERE id=?',future).status,'Disahkan');
  const firstEmail=emails.find((mail)=>mail.to===kup[0].email);
  assert.equal(firstEmail.type,'lantikan');
  assert.match(firstEmail.subject,/^Lantikan Perlawanan: .+ \(No: PU01\) — Home FC vs Away FC — 01 Dec 2026$/);
  assert.ok(firstEmail.html.includes(`token=${rows[0].email_token}&amp;action=accept`));
  assert.ok(firstEmail.html.includes('src="cid:logo_home"'));
  assert.equal(firstEmail.images[0].cid,'logo_home');
  assert.match(firstEmail.html,/Krew KUP Perlawanan/);
  const firstTelegram=telegrams.find((message)=>Number(message.chatId)===Number(kup[0].telegram_chat_id));
  assert.match(firstTelegram.text,/^<b>🏟 Lantikan Pengadil<\/b>/);
  assert.equal(firstTelegram.markup.inline_keyboard[0][0].callback_data,`act:accept:token:${rows[0].tg_token}`);
  assert.equal(count(`SELECT count(*) FROM lantikan_audit_log WHERE jadual_id=?
    AND event_type IN ('appointment_links_prepared','appointment_notification','appointment_dispatched')`,future),12);
  const portal=one("SELECT * FROM notifications WHERE user_id=? AND type='Lantikan' ORDER BY id DESC",kup[0].id);
  assert.deepEqual([portal.is_read,portal.email_sent],[0,0]);
  assert.equal(portal.message,
    `Anda telah dilantik sebagai Pengadil untuk perlawanan Home FC lwn Away FC (${one('SELECT nama FROM kejohanan WHERE id=?',tournament).nama}) pada 01 Dec 2026. Sila semak menu Tugasan untuk terima atau tolak.`);

  // Re-send keeps tokens and reports the renotify count.
  const tokens=rows.map((row)=>row.email_token);
  const resent=await read(await call({action:'notify',jadual_id:future}));
  assert.equal(resent.body.renotify_count,3);
  assert.deepEqual(db.prepare('SELECT email_token FROM lantikan_pengadil WHERE jadual_id=? ORDER BY id').all(future)
    .map((row)=>row.email_token),tokens);

  // Replacement before kickoff resets the response state.
  emails.length=0;telegrams.length=0;
  assert.equal((await read(await call({jadual_id:future,pengadil_id:kup[3].id,jawatan:'Pengadil'}))).body.message,
    'Lantikan dikemaskini.');
  const replaced=one('SELECT * FROM lantikan_pengadil WHERE id=?',r1.id);
  assert.deepEqual([replaced.pengadil_id,replaced.status,replaced.notif_hantar,replaced.email_token,replaced.tg_token],
    [kup[3].id,'Belum Jawab',0,null,null]);
  assert.equal(one("SELECT event_type FROM lantikan_audit_log WHERE lantikan_id=? ORDER BY id DESC",r1.id).event_type,
    'appointment_reassigned');
  assert.equal(one('SELECT status FROM jadual_perlawanan WHERE id=?',future).status,'Menunggu Pengesahan');

  // Delete a notified appointment: audit, cancellation messages, match status.
  const ar2=one("SELECT id FROM lantikan_pengadil WHERE jadual_id=? AND jawatan='Penolong Pengadil 2'",future);
  assert.deepEqual(await read(await call(null,'DELETE',`?id=${ar2.id}`)),
    {status:200,body:{error:false,message:'Lantikan dibuang.'}});
  assert.equal(count('SELECT count(*) FROM lantikan_pengadil WHERE id=?',ar2.id),0);
  assert.equal(count(`SELECT count(*) FROM lantikan_audit_log WHERE lantikan_id=?
    AND event_type IN ('appointment_deleted','cancellation_notification')`,ar2.id),3);
  assert.equal(emails.at(-1).to,kup[2].email);
  assert.match(emails.at(-1).subject,/^Pembatalan Perlawanan: /);
  assert.match(telegrams.at(-1).text,/Pembatalan Perlawanan/);
  assert.equal(one('SELECT status FROM jadual_perlawanan WHERE id=?',future).status,'Belum Lantik');

  // Cancel the match: rows keep history, tokens revoked, notified officials told.
  emails.length=0;telegrams.length=0;
  assert.equal((await call({action:'batal_jadual',jadual_id:future,status:'Ditangguhkan',sebab:''})).status,400);
  const cancelled=await read(await call({action:'batal_jadual',jadual_id:future,status:'Ditangguhkan',sebab:'Hujan lebat'}));
  assert.deepEqual(cancelled.body,{error:false,
    message:'2 lantikan ditanda Ditangguhkan untuk 1 perlawanan. 1 notifikasi pembatalan dihantar.'});
  assert.deepEqual(db.prepare('SELECT DISTINCT status,email_token,penilaian_token FROM lantikan_pengadil WHERE jadual_id=?')
    .all(future).map((row)=>({...row})),[{status:'Ditangguhkan',email_token:null,penilaian_token:null}]);
  assert.equal(one('SELECT status,sebab_status FROM jadual_perlawanan WHERE id=?',future).sebab_status,'Hujan lebat');
  assert.match(emails[0].subject,/^Penangguhan Perlawanan: /);
  assert.ok(emails[0].html.includes('<strong>Sebab:</strong> Hujan lebat'));
  assert.equal(one("SELECT type FROM notifications WHERE user_id=? ORDER BY id DESC",kup[1].id).type,'Status Perlawanan');
  assert.equal((await read(await call({action:'batal_bulk',jadual_ids:[0],status:'Dibatalkan',sebab:'x'}))).body.message,
    'Tiada perlawanan.');

  // After kickoff the Admin confirms directly; a complete crew is notified.
  emails.length=0;telegrams.length=0;
  for (const [index,role] of ['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2'].entries()) {
    const result=await read(await call({jadual_id:past,pengadil_id:kup[index+3].id,jawatan:role}));
    assert.equal(result.status,200);
    if (index<2) assert.equal(result.body.message,'Lantikan rekod lama disahkan terus dan sejarah pengadil dikemaskini.');
    else assert.equal(result.body.message,'Lantikan rekod lama disahkan terus dan sejarah pengadil dikemaskini.'
      +' Krew KUP lengkap dimaklumkan melalui 3 Telegram dan 3 emel.');
  }
  assert.equal(count("SELECT count(*) FROM lantikan_pengadil WHERE jadual_id=? AND status='Diterima'",past),3);
  assert.equal(count('SELECT count(*) FROM perlawanan WHERE lantikan_id IN (SELECT id FROM lantikan_pengadil WHERE jadual_id=?)',past),3);
  const history=one(`SELECT * FROM perlawanan WHERE lantikan_id=(SELECT id FROM lantikan_pengadil
    WHERE jadual_id=? AND jawatan='Pengadil')`,past);
  assert.deepEqual([history.head_referee_id,history.assistant_referee_2_id,history.status_pp,history.home_team],
    [kup[3].id,kup[5].id,'Disahkan','Home FC']);
  assert.equal(count("SELECT count(*) FROM kup_crew_notifications WHERE jadual_id=? AND completed_at IS NOT NULL",past),3);
  assert.match(emails[0].subject,/^Krew KUP Lengkap: Home FC vs Away FC — 01 Sep 2026$/);
  assert.equal(one('SELECT status FROM jadual_perlawanan WHERE id=?',past).status,'Disahkan');

  // RA after kickoff receives the form link (PHP sends it from the admin identity).
  emails.length=0;telegrams.length=0;
  const raResult=await read(await call({jadual_id:past,pengadil_id:ra.id,jawatan:'Penilai Pengadil'}));
  assert.equal(raResult.body.message,
    'Lantikan rekod lama disahkan terus dan sejarah pengadil dikemaskini. Pautan borang Penilai Pengadil telah dihantar.');
  const raRow=one("SELECT * FROM lantikan_pengadil WHERE jadual_id=? AND jawatan='Penilai Pengadil'",past);
  assert.match(raRow.penilaian_token,/^[a-f0-9]{64}$/);
  assert.equal(emails[0].type,'admin');
  assert.ok(emails[0].html.includes(`penilaian-borang.html?token=${raRow.penilaian_token}`));
  assert.equal(count(`SELECT count(*) FROM lantikan_audit_log WHERE lantikan_id=?
    AND event_type IN ('ra_form_notification','ra_form_dispatched')`,raRow.id),3);

  // Auto-reject: an expired answer window before kickoff, as on every PHP view.
  const lazy=insertMatch('2026-12-02','10:21:00','U04');
  await call({jadual_id:lazy,pengadil_id:kup[0].id,jawatan:'Pengadil'});
  const lazyRow=one('SELECT id FROM lantikan_pengadil WHERE jadual_id=?',lazy);
  db.prepare(`UPDATE lantikan_pengadil SET notif_hantar=1,tarikh_notif=datetime('now','+8 hours','-4 hours')
    WHERE id=?`).run(lazyRow.id);
  assert.equal(await worker.autoTolakLantikanTertunggak(env,{jadual_id:lazy}),1);
  const rejected=one('SELECT * FROM lantikan_pengadil WHERE id=?',lazyRow.id);
  assert.deepEqual([rejected.status,rejected.komen,rejected.email_token],
    ['Ditolak','Ditolak automatik - tiada jawapan dalam tempoh',null]);
  assert.equal(one("SELECT event_type FROM lantikan_audit_log WHERE lantikan_id=? ORDER BY id DESC",lazyRow.id).event_type,
    'appointment_auto_rejected');
  assert.equal(await worker.autoTolakLantikanTertunggak(env,{jadual_id:lazy}),0);

  // MySQL ON UPDATE CURRENT_TIMESTAMP is restored by triggers.
  assert.notEqual(one('SELECT updated_at FROM jadual_perlawanan WHERE id=?',past).updated_at,'2026-10-01 10:00:00');
  console.log('lantikan.php writes: assign, replace, notify, delete, cancel, after-kickoff crew/RA and auto-reject passed');
} finally {close();}
