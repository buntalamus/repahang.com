import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {processMatchReminders,reminderText,appointmentGaps}=await bundle(
  "export {processMatchReminders,reminderText} from '../src/match-reminders';"
  +"export {appointmentGaps} from '../src/appointment-gaps';");
const {db,DB,close}=openDatabase(['0001_worker_sessions','0022_district_appointments','0028_push_devices',
  '0029_webpush_subscriptions','0030_match_reminders']);

// Malaysia wall clock offset from now, as the server compares it.
const kl=(hours)=>new Date(Date.now()+8*3600_000+hours*3600_000).toISOString();
const day=(hours)=>kl(hours).slice(0,10);
const time=(hours)=>kl(hours).slice(11,16);

const referee=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 1").get().id;
const pp=db.prepare("SELECT id,COALESCE(NULLIF(persatuan_id,0),district_id) AS d FROM users WHERE role='PP Daerah' AND aktif=1 LIMIT 1").get();
const otherDistrict=db.prepare('SELECT id FROM persatuan_bolasepak_daerah WHERE id<>? LIMIT 1').get(pp.d).id;
const tournament=(district)=>Number(db.prepare(`INSERT INTO kejohanan(nama,jenis_kejohanan,peringkat_kejohanan,tarikh_mula,tarikh_akhir,status,lantikan_persatuan_id)
  VALUES('Ujian Peringatan','Liga','Daerah',date('now'),date('now','+30 days'),'Aktif',?)`).run(district).lastInsertRowid);
const match=(k,hours,status='Belum Lantik')=>Number(db.prepare(`INSERT INTO jadual_perlawanan(kejohanan_id,no_perlawanan,tarikh,masa,pasukan_home,pasukan_away,tempat,status)
  VALUES(?,?,?,?,'HOME','AWAY','PADANG',?)`).run(k,`T-${hours}`,day(hours),time(hours),status).lastInsertRowid);
const appoint=(jadual,jawatan,status='Diterima',who=referee)=>Number(db.prepare(`INSERT INTO lantikan_pengadil(jadual_id,pengadil_id,jawatan,status,tg_notif_hantar)
  VALUES(?,?,?,?,0)`).run(jadual,who,jawatan,status).lastInsertRowid);

const mine=tournament(pp.d), theirs=tournament(otherDistrict);
const in20h=match(mine,20), in90m=match(mine,1.5), in3d=match(mine,72), cancelled=match(mine,1,'Dibatalkan'), past=match(mine,-3);
const a20=appoint(in20h,'Pengadil'), a90=appoint(in90m,'Pengadil');
appoint(in3d,'Pengadil'); appoint(cancelled,'Pengadil'); appoint(past,'Pengadil');
appoint(in20h,'Penolong Pengadil 1','Ditolak');
const full=match(mine,30);
for (const j of ['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2']) appoint(full,j,j==='Pengadil'?'Belum Jawab':'Diterima');
const elsewhere=match(theirs,30);

// The official has one phone with the app and one with Web Push.
const cookie=await sessionCookie(db,referee);
const hash=db.prepare('SELECT token_hash FROM worker_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(referee).token_hash;
db.prepare("INSERT INTO worker_push_devices(user_id,session_token_hash,token,platform) VALUES(?,?,'fcm-1','android')").run(referee,hash);
db.prepare("INSERT INTO worker_webpush_subscriptions(user_id,endpoint,p256dh,auth) VALUES(?,'https://web.push.apple.com/x','k','a')").run(referee);

try {
  const sent=[];
  globalThis.fetch=async(url,init)=>{sent.push(String(url));return new Response(JSON.stringify({access_token:'t',expires_in:3600,name:'m'}),{status:200});};
  // Without push configured nothing is claimed.
  assert.deepEqual(await processMatchReminders({DB}),{sent:0,reminders:0});
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_match_reminders').get().n,0);

  const reminded=[];
  const env={DB,PUSH_ENABLED:'1',FCM_SERVICE_ACCOUNT:'x'};
  // Count claims through the table (FCM itself is not exercised here).
  await processMatchReminders(env);
  for (const r of db.prepare('SELECT lantikan_id,kind FROM worker_match_reminders ORDER BY lantikan_id').all()) reminded.push(`${r.lantikan_id}:${r.kind}`);
  assert.deepEqual(reminded.sort(),[`${a20}:24h`,`${a90}:2h`].sort());
  // A second cron run sends nothing again.
  assert.equal((await processMatchReminders(env)).reminders,0);

  const text=reminderText({jawatan:'Pengadil',masa:'17:00:00',tempat:'Stadium',pasukan_home:'A',pasukan_away:'B',kind:'2h'});
  assert.deepEqual(text,{title:'2 jam lagi: A vs B',body:'Pengadil · 17:00 · Stadium'});

  // Gaps: PP sees own district's upcoming matches missing required officials.
  const ppCookie=await sessionCookie(db,pp.id);
  const gaps=await (await appointmentGaps(new Request('https://refpahang.com/api/lantikan-perlu-tindakan.php',{headers:{Cookie:ppCookie}}),{DB,STAGING_AUTH_ENABLED:'1'})).json();
  const ids=gaps.data.map((g)=>g.id);
  assert.ok(ids.includes(in20h) && ids.includes(in3d));
  assert.ok(!ids.includes(full),'complete crew is not listed');
  assert.ok(!ids.includes(cancelled) && !ids.includes(past),'cancelled and past matches are not listed');
  assert.ok(!ids.includes(elsewhere),'other districts are not listed');
  const row=gaps.data.find((g)=>g.id===in20h);
  assert.deepEqual(row.slot_kosong,['Penolong Pengadil 1','Penolong Pengadil 2']);
  assert.equal(Number(row.jumlah_ditolak),1);
  assert.equal((await appointmentGaps(new Request('https://refpahang.com/api/lantikan-perlu-tindakan.php',{headers:{Cookie:cookie}}),{DB,STAGING_AUTH_ENABLED:'1'})).status,403);
  console.log('Match reminders (24h/2h, once, skip cancelled/past) and appointment gaps (scope, slots) passed');
} finally {close();}
