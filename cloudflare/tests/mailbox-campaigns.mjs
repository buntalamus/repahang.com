import assert from 'node:assert/strict';
import PostalMime from 'postal-mime';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';
const {adminMailboxCampaigns:api,processMailboxCampaigns:run,SmtpRejection,mailboxDirectory,directoryRecipients}=await bundle(
  "export {SmtpRejection} from '../smtp'; export {adminMailboxCampaigns,processMailboxCampaigns} from '../src/mailbox-campaigns'; export {mailboxDirectory,directoryRecipients} from '../src/mailbox-directory';"
);
const {db,DB,hooks,close}=openDatabase(['0001_worker_sessions','0013_mailbox','0021_mailbox_imap','0023_mailbox_campaigns']);
const objects=new Map(),sent=[];
const MEDIA={async put(key,value){objects.set(key,value);},async delete(key){objects.delete(key);}};
const env={DB,MEDIA,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',BULK_EMAIL_ENABLED:'1',MAILBOX_SEND_ENABLED:'1',
  MAIL_SUPPORT_USER:'support@refpahang.com',MAIL_SUPPORT_NAME:'RefPahang',EMAIL:{send:async message=>{sent.push(message);return {messageId:'provider-'+sent.length};}}};
let now=Date.now();const originalNow=Date.now;Date.now=()=>now;
const tick=()=>{now+=301000;};
try {
  const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get().id;
  const otherAdmin=db.prepare('SELECT id FROM users WHERE id!=? LIMIT 1').get(admin).id;
  const ids=db.prepare('SELECT id FROM users WHERE id NOT IN (?,?) ORDER BY id LIMIT 16').all(admin,otherAdmin).map(row=>row.id);
  db.exec('UPDATE users SET aktif=0,jenis_pengadil=NULL');
  db.prepare("UPDATE users SET aktif=1,role='Admin',jenis_pengadil=NULL WHERE id IN (?,?)").run(admin,otherAdmin);
  db.prepare('DELETE FROM permohonan WHERE user_id IN (?,?)').run(admin,otherAdmin);
  const district=db.prepare('SELECT id FROM persatuan_bolasepak_daerah ORDER BY id LIMIT 1').get().id;
  for (const [i,id] of ids.entries()) {
    db.prepare("UPDATE users SET aktif=1,email=?,nama_penuh=?,role='Pengadil',jenis_pengadil='Kelas III FAM',persatuan_id=?,tahun_lulus_kelas3=NULL WHERE id=?")
      .run(`group${i}@example.test`,`Pengguna Ujian ${i}`,district,id);
    db.prepare('DELETE FROM permohonan WHERE user_id=?').run(id);
  }
  db.prepare("UPDATE users SET role='PP Daerah',jenis_pengadil='Penilai Pengadil' WHERE id=?").run(ids[0]);
  db.prepare("UPDATE users SET role='Penilai',jenis_pengadil='Penilai Pengadil' WHERE id=?").run(ids[1]);
  db.prepare('UPDATE users SET aktif=0 WHERE id=?').run(ids[15]);
  const addAnnual=(id,year,status)=>db.prepare("INSERT INTO permohonan(user_id,jenis_borang,tahun_permohonan,status,jenis_pengadil,nama_penuh,no_kp,emel,no_telefon,jantina,alamat1,poskod,daerah,negeri,status_kerja,nama_waris,hubungan_waris,telefon_waris) VALUES(?,'pengadil_berdaftar',?,?,'Kelas III FAM','Ujian','000000000000','test@example.test','000','L','Ujian','00000','Ujian','Pahang','Ujian','Ujian','Ujian','000')").run(id,year,status);
  addAnnual(ids[2],2026,'Approved');addAnnual(ids[3],2025,'Approved');addAnnual(ids[4],2026,'Pending');
  db.prepare('INSERT INTO mailbox_contacts(id,name,email) VALUES(?,?,?)').run(crypto.randomUUID(),'Salinan PP','GROUP0@EXAMPLE.TEST');
  const cookie=await sessionCookie(db,admin),other=await sessionCookie(db,otherAdmin),ref=await sessionCookie(db,ids[2]);
  db.exec('UPDATE worker_sessions SET expires_at=expires_at+86400');
  const get=(search='',auth=cookie)=>api(new Request('https://test/api/admin-mail-campaigns.php'+search,{headers:{Cookie:auth}}),env);
  const post=(body,auth=cookie)=>api(new Request('https://test/api/admin-mail-campaigns.php',{method:'POST',headers:{Cookie:auth},body:JSON.stringify(body)}),env);
  const data=async response=>{const value=await response.json();assert.equal(value.error,false,JSON.stringify(value));return value.data;};
  assert.equal((await get('?view=directory&year=2026','')).status,401);
  assert.equal((await get('?view=directory&year=2026',ref)).status,403);
  assert.equal((await get('?view=directory&year=no')).status,422);
  const directory=await data(await get('?view=directory&year=2026'));
  const find=index=>directory.contacts.find(contact=>contact.id==='user:'+ids[index]);
  assert.ok(find(0).groups.includes('pp') && find(0).groups.includes('ra'));
  assert.ok(!find(0).groups.includes('registered'));
  assert.ok(find(2).groups.includes('registered'));
  assert.ok(!find(3).groups.includes('registered') && find(3).groups.includes('inactive-referees'));
  assert.ok(find(4).groups.includes('pending'));
  assert.ok(find(5).groups.includes('class3') && !find(5).groups.includes('class3-passed'));
  assert.deepEqual(Object.keys(find(2)).sort(),['id','name','email','role','district_id','district','active','groups'].sort());
  const filter={groups:['pp','ra','contacts'],include_inactive:false,district_id:null,exclude:[]};
  assert.equal(directoryRecipients(directory.contacts,filter).length,2);
  assert.equal(directoryRecipients(directory.contacts,{...filter,exclude:['group0@example.test']}).length,1);
  assert.equal(directoryRecipients(directory.contacts,{...filter,groups:['class3'],district_id:district}).length,13);
  assert.equal(directoryRecipients(directory.contacts,{...filter,groups:['class3'],district_id:district,include_inactive:true}).length,14);
  const payload={action:'preview',id:crypto.randomUUID(),year:2026,groups:['class3'],district_id:district,
    exclude:[],from:'support@refpahang.com',subject:'Makluman ujian',text:'Salam.\n\nMesej kumpulan.'};
  assert.equal((await post(payload,ref)).status,403);
  env.BULK_EMAIL_ENABLED='0';assert.equal((await post(payload)).status,503);env.BULK_EMAIL_ENABLED='1';
  const preview=await data(await post(payload));assert.equal(preview.total,13);assert.equal(sent.length,0);
  await run(env);assert.equal(sent.length,0);tick();
  // A preview replay and later confirmation use the frozen list, even after new membership.
  addAnnual(ids[3],2026,'Approved');
  db.prepare("UPDATE users SET aktif=1 WHERE id=?").run(ids[15]);
  assert.equal((await data(await post(payload))).total,13);
  assert.equal((await post({...payload,subject:'changed'})).status,409);
  assert.equal((await post({action:'confirm',id:preview.id},other)).status,403);
  await data(await post({action:'confirm',id:preview.id}));await data(await post({action:'confirm',id:preview.id}));
  await Promise.all([run(env),run(env)]);
  assert.equal(sent.length,10,'one shared lease, ten addresses per five minutes');
  await run(env);assert.equal(sent.length,10);tick();await run(env);assert.equal(sent.length,13);
  const completed=await data(await get('?id='+preview.id));assert.equal(completed.status,'completed');assert.equal(completed.sent,13);
  assert.equal(new Set(sent.map(message=>message.to.email)).size,13);
  for(const message of sent){assert.ok(!Array.isArray(message.to));assert.ok(!message.cc && !message.bcc);}
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM mailbox_messages WHERE folder='sent' AND delivery_status='sent'").get().n,13);
  const mime=await PostalMime.parse([...objects.values()][0]);assert.equal(mime.to.length,1);assert.match(mime.text,/Mesej kumpulan/);
  // Confirmation can never requeue a completed campaign.
  await data(await post({action:'confirm',id:preview.id}));tick();await run(env);assert.equal(sent.length,13);
  const cancelPayload={...payload,id:crypto.randomUUID(),groups:['pp','ra','contacts']};
  const cancelled=await data(await post(cancelPayload));await data(await post({action:'confirm',id:cancelled.id}));
  await data(await post({action:'cancel',id:cancelled.id}));tick();await run(env);assert.equal(sent.length,13);
  assert.equal((await post({action:'confirm',id:cancelled.id})).status,409);
  // Preparation errors are safe to retry; uncertain SMTP acceptance is never retried automatically.
  const failure=await data(await post({...cancelPayload,id:crypto.randomUUID()}));await data(await post({action:'confirm',id:failure.id}));
  env.MEDIA={...MEDIA,async put(){throw new Error('synthetic storage outage');}};tick();await run(env);
  let state=await data(await get('?id='+failure.id));assert.equal(state.failed,1);assert.equal(sent.length,13);
  await data(await post({action:'retry-failed',id:failure.id}));env.MEDIA=MEDIA;
  env.EMAIL.send=async()=>{throw new Error('ambiguous SMTP timeout');};tick();await run(env);
  state=await data(await get('?id='+failure.id));assert.equal(state.uncertain,1);
  env.EMAIL.send=async message=>{sent.push(message);return {messageId:'provider-last'};};tick();await run(env);
  state=await data(await get('?id='+failure.id));assert.equal(state.uncertain,1);assert.equal(state.sent,1);assert.equal(sent.length,14);
  await data(await post({action:'retry-failed',id:failure.id}));tick();await run(env);assert.equal(sent.length,14);
  // A worker terminated during SMTP is reconciled to uncertain, not reclaimed for a resend.
  const stale=await data(await post({...cancelPayload,id:crypto.randomUUID(),groups:['pp']}));
  await data(await post({action:'confirm',id:stale.id}));
  db.prepare("UPDATE mailbox_campaign_recipients SET status='processing',message_id=?,started_at=? WHERE campaign_id=?").run(crypto.randomUUID(),Math.floor(now/1000)-1300,stale.id);
  tick();await run(env);assert.equal((await data(await get('?id='+stale.id))).uncertain,1);assert.equal(sent.length,14);
  // Concurrent equal previews must not append newly eligible addresses to the first snapshot.
  const race={...cancelPayload,id:crypto.randomUUID(),groups:['registered']};
  const raceFirst=await data(await post(race));const originalCount=raceFirst.total;
  const raceFingerprint=db.prepare('SELECT fingerprint FROM mailbox_campaigns WHERE id=?').get(race.id).fingerprint;
  assert.ok(originalCount>=2);
  // Simulate a first writer between the pre-read and INSERT batch of the second writer.
  db.prepare('DELETE FROM mailbox_campaign_recipients WHERE campaign_id=?').run(race.id);
  db.prepare('DELETE FROM mailbox_campaigns WHERE id=?').run(race.id);
  hooks.beforeBatch=()=>{
    db.prepare(`INSERT INTO mailbox_campaigns(id,created_by,fingerprint,snapshot_token,mailbox,subject,content,selection_json,total)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(race.id,admin,raceFingerprint,'other-token',race.from,race.subject,race.text,'{}',1);
    db.prepare('INSERT INTO mailbox_campaign_recipients(campaign_id,email,name) VALUES(?,?,?)').run(race.id,raceFirst.recipients[0].email,raceFirst.recipients[0].name);
  };
  assert.equal((await data(await post(race))).total,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mailbox_campaign_recipients WHERE campaign_id=?').get(race.id).n,1);
  // SMTP acceptance followed by a D1 outage must not cause a duplicate send.
  const accepted=await data(await post({...cancelPayload,id:crypto.randomUUID(),groups:['pp']}));
  await data(await post({action:'confirm',id:accepted.id}));
  env.EMAIL.send=async message=>{sent.push(message);hooks.beforeBatch=()=>{throw new Error('synthetic post-SMTP D1 outage');};return {messageId:'accepted-but-unrecorded'};};
  tick();await run(env);assert.equal(sent.length,15);
  assert.equal((await data(await get('?id='+accepted.id))).uncertain,1);
  tick();await run(env);assert.equal(sent.length,15);
  const rejected=await data(await post({...cancelPayload,id:crypto.randomUUID(),groups:['pp']}));
  await data(await post({action:'confirm',id:rejected.id}));env.EMAIL.send=async()=>{throw new SmtpRejection('recipient',550);};
  tick();await run(env);assert.equal((await data(await get('?id='+rejected.id))).failed,1);
  await data(await post({action:'retry-failed',id:rejected.id}));env.EMAIL.send=async message=>{sent.push(message);return {messageId:'retry-accepted'};};
  tick();await run(env);assert.equal((await data(await get('?id='+rejected.id))).sent,1);assert.equal(sent.length,16);
  console.log('Mailbox groups/campaigns: role and annual scope, allowlist, dedupe, frozen review, Admin gates, cancellation, shared pacing, retries and uncertain SMTP passed');
} finally {Date.now=originalNow;close();}
