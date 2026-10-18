import assert from 'node:assert/strict';
import { bundle, openDatabase } from './_harness.mjs';
const worker=await bundle(`export {autoTolakLantikanTertunggak} from '../src/php/lantikan-helper';
  export {processNotificationOutbox} from '../src/notify';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests} from '../src/php/telegram';`);
const {db,DB,hooks,close}=openDatabase(['0009_mysql_on_update_triggers','0010_worker_write_guards']);
db.prepare('UPDATE lantikan_pengadil SET notif_hantar=0').run();
const add=(sql,...args)=>Number(db.prepare(sql).run(...args).lastInsertRowid);
const create=(name,role,chat)=>add(`INSERT INTO users(email,password,role,nama_penuh,aktif,password_changed,telegram_chat_id)
  VALUES(?,'unused',?,?,1,1,?)`,name.toLowerCase().replaceAll(' ','.')+'@example.invalid',role,name,chat);
const owner=create('Expiry Owner','PP Daerah',123456789);
const official=create('Expiry Referee','Pengadil',234567890);
const other=create('Unrelated Admin','Admin',345678901);
const emails=[],telegrams=[];
worker.setEmailSenderForTests(async(to,subject,html)=>{emails.push({to,subject,html});return true;});
worker.setTelegramSenderForTests(async(chat,text)=>{telegrams.push({chat:String(chat),text});return true;});
const env={DB:{...DB,prepare(sql){assert.doesNotMatch(sql,/event_key\s+LIKE/i,'D1 prefix queries cannot use LIKE');return DB.prepare(sql);}},
  BASE_URL:'https://refpahang.com',STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1'};
const kl=ms=>new Date(ms+8*3600000).toISOString().slice(0,19).replace('T',' ');
const now=Date.now();
const tournament=kind=>add(`INSERT INTO kejohanan(nama,jenis_kejohanan,status,tarikh_mula,tarikh_akhir,created_by)
  VALUES(?,?,'Aktif','2026-01-01','2099-12-31',?)`,'Expiry '+kind,kind,owner);
const carnival=tournament('Karnival'),league=tournament('Liga');
function appointment(tournament,hoursToKickoff,hoursSinceNotice,status='Disahkan'){
  const kickoff=kl(now+hoursToKickoff*3600000);
  const match=add(`INSERT INTO jadual_perlawanan(kejohanan_id,no_perlawanan,tarikh,masa,pasukan_home,pasukan_away,status)
    VALUES(?,'EXP',?,?,'Home','Away',?)`,tournament,kickoff.slice(0,10),kickoff.slice(11),status);
  const id=add(`INSERT INTO lantikan_pengadil(jadual_id,pengadil_id,jawatan,status,notif_hantar,tarikh_notif,created_by)
    VALUES(?,?,'Pengadil','Belum Jawab',1,?,?)`,match,official,kl(now-hoursSinceNotice*3600000),owner);
  return {id,match};
}
const status=id=>db.prepare('SELECT status FROM lantikan_pengadil WHERE id=?').get(id).status;
try{
  const c=appointment(carnival,2,6),l=appointment(league,47,72);
  const early=appointment(carnival,10,72),late=appointment(carnival,2,0.5),past=appointment(carnival,-24,72);
  const cancelled=appointment(carnival,2,6,'Dibatalkan'),postponed=appointment(carnival,2,6,'Ditangguhkan');
  const unsent=appointment(carnival,2,6);db.prepare('UPDATE lantikan_pengadil SET notif_hantar=0 WHERE id=?').run(unsent.id);
  assert.equal(await worker.autoTolakLantikanTertunggak(env),2);
  assert.equal(status(c.id),'Ditolak');assert.equal(status(l.id),'Ditolak');
  for(const row of [early,late,past,cancelled,postponed,unsent])assert.equal(status(row.id),'Belum Jawab');
  const queued=db.prepare("SELECT channel,recipient_user_id FROM worker_notification_outbox WHERE kind='auto_reject_owner'").all();
  assert.equal(queued.length,4);
  assert.ok(queued.every(row=>row.recipient_user_id===owner));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM worker_notification_outbox WHERE kind='auto_reject_owner' AND recipient_user_id=?").get(other).n,0);
  assert.equal(await worker.autoTolakLantikanTertunggak(env),0);
  await worker.processNotificationOutbox(env,50);
  assert.equal(emails.filter(mail=>mail.to==='expiry.owner@example.invalid').length,2);
  assert.ok(emails.filter(mail=>mail.to==='expiry.owner@example.invalid').every(mail=>/Perlu Lantik Pengganti/.test(mail.subject)&&mail.html.includes('/pp-daerah/lantikan')));
  assert.equal(telegrams.filter(row=>row.chat==='123456789').length,2);
  const raced=appointment(carnival,2,6);
  hooks.beforeBatch=()=>{db.prepare("UPDATE jadual_perlawanan SET tarikh='2099-01-01' WHERE id=?").run(raced.match);};
  assert.equal(await worker.autoTolakLantikanTertunggak(env,{id:raced.id}),0);
  assert.equal(status(raced.id),'Belum Jawab','rescheduled match survives stale expiry calculation');
  const concurrent=appointment(carnival,2,6);
  const outcomes=await Promise.all([worker.autoTolakLantikanTertunggak(env,{id:concurrent.id}),worker.autoTolakLantikanTertunggak(env,{id:concurrent.id})]);
  assert.deepEqual(outcomes.sort(),[0,1]);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM worker_notification_outbox WHERE kind='auto_reject_owner' AND lantikan_id=?").get(concurrent.id).n,2);
  console.log('Expiry policy: 3/48 hours before kickoff, late replacements, historical/cancelled/unsent protection, exact owner email+Telegram, D1-safe prefix, reschedule races and dedupe passed');
}finally{worker.setEmailSenderForTests(null);worker.setTelegramSenderForTests(null);close();}
