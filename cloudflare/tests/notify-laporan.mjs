// Chair (Pengerusi) assignment, tournament and pool notices.
import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {chairConfig} from '../src/chair-config';
  export {tournaments} from '../src/tournaments';
  export {refereePool} from '../src/referee-pool';
  export {lantikanWrite} from '../src/lantikan-write';
  export {processNotificationOutbox} from '../src/notify';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers','0010_worker_write_guards',
  '0020_match_team_regions','0022_district_appointments']);
const emails=[];
const telegrams=[];
worker.setEmailSenderForTests(async(to,subject,html,name,type)=>{emails.push({to,subject,html,name,type});return true;});
worker.setTelegramSenderForTests(async(chatId,text)=>{telegrams.push({chatId:String(chatId),text});return true;});
const env={DB,BASE_URL:'https://refpahang.com',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  REPORT_DELIVERY_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1',MEDIA:{get:async()=>null}};
const reset=()=>{emails.length=0;telegrams.length=0;};
const one=(sql,...values)=>db.prepare(sql).get(...values);
const all=(sql,...values)=>db.prepare(sql).all(...values);
const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 ORDER BY id LIMIT 1");
const pp=one("SELECT id,persatuan_id FROM users WHERE role='PP Daerah' AND aktif=1 AND persatuan_id>0 ORDER BY id LIMIT 1");
const cookie={admin:await sessionCookie(db,admin.id),pp:await sessionCookie(db,pp.id)};
const call=(fn,path,method,who,body)=>fn(new Request(`https://refpahang.com/api/${path}`,{method,
  headers:{'Content-Type':'application/json',Cookie:cookie[who]},body:body===undefined?undefined:JSON.stringify(body)}),env)
  .then(async(r)=>({status:r.status,...(await r.json())}));

const hasTelegram=(u)=>String(u.telegram_chat_id ?? '').trim()!=='';
const emailOnly=(users)=>users.filter((u)=>!hasTelegram(u)).map((u)=>u.email).sort();
const reached=(u,text)=>hasTelegram(u)
  ? telegrams.some((t)=>t.chatId===String(u.telegram_chat_id) && t.text.includes(text))
  : emails.some((m)=>m.to===u.email);

try {
  // --- Chair assignment: new chair told; replaced chair told; same chair silent ---
  const assessors=all(`SELECT id,email,telegram_chat_id FROM users WHERE aktif=1 AND (role='Penilai' OR jenis_pengadil='Penilai Pengadil')
    AND trim(COALESCE(email,''))<>'' ORDER BY id LIMIT 2`);
  assert.equal(assessors.length,2);
  const tournamentId=Number(db.prepare(`INSERT INTO kejohanan(nama,jenis_kejohanan,peringkat_kejohanan,tarikh_mula,
    tarikh_akhir,tempat,status,created_at,updated_at) VALUES('Kejohanan Notis','Karnival','Negeri','2099-07-01',
    '2099-07-05','Kuantan','Aktif',datetime('now'),datetime('now'))`).run().lastInsertRowid);
  const assign=(officialId)=>call(worker.chairConfig,'kejohanan-pengesah-laporan.php','POST','admin',
    {kejohanan_id:tournamentId,source:'Berdaftar',official_id:officialId});
  reset();
  let r=await assign(assessors[0].id);
  assert.equal(r.error,false,r.message);
  assert.equal(r.chair_notified,true);
  // Telegram first; email only when the officer has no Telegram.
  assert.deepEqual(emails.map((m)=>m.to),emailOnly([assessors[0]]));
  assert.ok(reached(assessors[0],'Pengerusi Pengadil'));
  reset();
  r=await assign(assessors[0].id);
  assert.equal(r.chair_notified,false);
  assert.equal(emails.length+telegrams.length,0,'saving the same chair again sends nothing');
  reset();
  r=await assign(assessors[1].id);
  assert.deepEqual(emails.map((m)=>m.to).sort(),emailOnly(assessors));
  assert.ok(reached(assessors[0],'Tamat'));
  assert.ok(reached(assessors[1],'Pengerusi Pengadil'));

  // --- Tournament created by PP Daerah: every Admin hears ------------------------
  const admins=all(`SELECT email,telegram_chat_id FROM users WHERE role='Admin' AND aktif=1 AND trim(COALESCE(email,''))<>''`);
  reset();
  r=await call(worker.tournaments,'kejohanan.php','POST','pp',{nama:'Liga Daerah Notis',jenis_kejohanan:'Liga',
    peringkat_kejohanan:'Daerah',tarikh_mula:'2099-08-01',tarikh_akhir:'2099-08-30',tempat:'Padang Daerah',status:'Aktif'});
  assert.equal(r.error,false,r.message);
  assert.deepEqual(emails.map((m)=>m.to).sort(),emailOnly(admins));
  assert.ok(emails.every((m)=>/^Kejohanan Daerah Baharu: Liga Daerah Notis$/.test(m.subject)));
  for (const a of admins.filter(hasTelegram)) assert.ok(reached(a,'Liga Daerah Notis'));
  // Admin-created tournaments notify nobody.
  reset();
  r=await call(worker.tournaments,'kejohanan.php','POST','admin',{nama:'Kejohanan Admin',jenis_kejohanan:'Karnival',
    peringkat_kejohanan:'Negeri',tarikh_mula:'2099-09-01',tarikh_akhir:'2099-09-02',tempat:'Kuantan',status:'Aktif'});
  assert.equal(emails.length+telegrams.length,0);

  // --- Pool add/remove: queued, delivered by the outbox --------------------------
  const officials=all(`SELECT id,email,telegram_chat_id,jenis_pengadil FROM users WHERE role='Pengadil' AND aktif=1
    AND trim(COALESCE(email,''))<>'' AND telegram_chat_id IS NOT NULL
    AND COALESCE(jenis_pengadil,'')<>'Penilai Pengadil' ORDER BY id LIMIT 3`);
  reset();
  r=await call(worker.refereePool,'pool-pengadil.php','POST','admin',
    {kejohanan_id:tournamentId,items:officials.map((o)=>({pengadil_id:o.id}))});
  assert.equal(r.added,3);
  assert.equal(emails.length,0);
  await worker.processNotificationOutbox(env,50);
  // All three are on Telegram: no email.
  assert.deepEqual(emails,[]);
  assert.equal(telegrams.length,3);
  assert.ok(officials.every((o)=>reached(o,'Kejohanan Notis')));
  // Adding the same officials again sends nothing new.
  reset();
  r=await call(worker.refereePool,'pool-pengadil.php','POST','admin',
    {kejohanan_id:tournamentId,items:officials.map((o)=>({pengadil_id:o.id}))});
  assert.equal(r.added,0);
  await worker.processNotificationOutbox(env,50);
  assert.equal(emails.length,0);
  const poolRow=one('SELECT id FROM pool_pengadil WHERE kejohanan_id=? AND pengadil_id=?',tournamentId,officials[2].id);
  reset();
  r=await call(worker.refereePool,`pool-pengadil.php?id=${poolRow.id}`,'DELETE','admin');
  assert.equal(r.error,false,r.message);
  await worker.processNotificationOutbox(env,50);
  assert.deepEqual(emails,[]);
  assert.deepEqual(telegrams.map((t)=>t.chatId),[String(officials[2].telegram_chat_id)]);

  // --- Tournament edit: officials with a notified upcoming appointment hear -----
  const match=Number(db.prepare(`INSERT INTO jadual_perlawanan(kejohanan_id,no_perlawanan,tarikh,masa,pasukan_home,
    pasukan_away,tempat,status,created_at,updated_at) VALUES(?,'K01','2099-07-02','10:00:00','A FC','B FC','Kuantan',
    'Belum Lantik',datetime('now'),datetime('now'))`).run(tournamentId).lastInsertRowid);
  const adminUser={id:admin.id,role:'Admin'};
  const appoint=(body)=>worker.lantikanWrite(new Request('https://refpahang.com/api/lantikan.php',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env,adminUser).then((x)=>x.json());
  await appoint({jadual_id:match,pengadil_id:officials[0].id,jawatan:'Pengadil'});
  await appoint({jadual_id:match,pengadil_id:officials[1].id,jawatan:'Penolong Pengadil 1'});
  const extra=one(`SELECT u.id FROM users u WHERE u.role='Pengadil' AND u.aktif=1 AND u.telegram_chat_id IS NOT NULL
    AND COALESCE(u.jenis_pengadil,'')<>'Penilai Pengadil' AND u.id NOT IN (?,?,?) ORDER BY u.id LIMIT 1`,
  officials[0].id,officials[1].id,officials[2].id);
  db.prepare("INSERT INTO pool_pengadil(kejohanan_id,pengadil_id,created_at) VALUES(?,?,datetime('now'))").run(tournamentId,extra.id);
  await appoint({jadual_id:match,pengadil_id:extra.id,jawatan:'Penolong Pengadil 2'});
  assert.equal((await appoint({action:'notify',jadual_id:match})).error,false);
  await worker.processNotificationOutbox(env,50);
  reset();
  const edit=(overrides)=>call(worker.tournaments,'kejohanan.php','PUT','admin',{id:tournamentId,nama:'Kejohanan Notis',
    jenis_kejohanan:'Karnival',peringkat_kejohanan:'Negeri',tarikh_mula:'2099-07-01',tarikh_akhir:'2099-07-05',
    tempat:'Kuantan',status:'Aktif',...overrides});
  r=await edit({anjuran:'PBNP'});
  assert.equal(r.officials_notified,0,'organiser-only change is not announced');
  r=await edit({tempat:'Temerloh'});
  assert.equal(r.officials_notified,3);
  await worker.processNotificationOutbox(env,50);
  assert.equal(emails.filter((m)=>/^Perubahan Kejohanan: /.test(m.subject)).length,0);
  const changeTelegrams=telegrams.filter((t)=>t.text.includes('Temerloh'));
  assert.equal(changeTelegrams.length,3);
  assert.ok(changeTelegrams[0].text.includes('Kuantan'));
  console.log('notify-laporan: ok');
} finally {
  worker.setEmailSenderForTests(null);
  worker.setTelegramSenderForTests(null);
  close();
}
