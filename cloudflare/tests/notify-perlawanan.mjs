// Self-recorded match and application notices: PP Daerah / Admin decisions and
// deletions reach every official (Telegram first, email fallback); referee edits reach the PP Daerah;
// seminar attendance, Kelas III results and deleted applications reach the applicant.
import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {refereeMatchManage} from '../src/referee-match-manage';
  export {districtMatchVerification} from '../src/district-match-verification';
  export {adminMatches} from '../src/admin-matches';
  export {deleteApplication} from '../src/applications';
  export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0011_application_uniqueness',
  '0015_self_reported_match_dedup','0019_annual_seminar_attendance']);
const sent=[];
const telegrams=[];
worker.setTelegramSenderForTests(async(chatId,text)=>{telegrams.push({chatId:String(chatId),text});return true;});
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',BASE_URL:'https://refpahang.com',
  MAIL_PENGESAHAN_USER:'pengesahan@refpahang.com',MAIL_PENGESAHAN_NAME:'PBNP',
  MAIL_DAFTAR_USER:'daftar@refpahang.com',MAIL_DAFTAR_NAME:'PBNP',
  MAIL_ADMIN_USER:'admin@refpahang.com',MAIL_ADMIN_NAME:'PBNP',
  EMAIL:{send:async(message)=>{sent.push(message);return {messageId:'ok'};}}};
const to=(message)=>typeof message.to==='string'?message.to:message.to.email;
const reset=()=>{sent.length=0;telegrams.length=0;};
const one=(sql,...values)=>db.prepare(sql).get(...values);
const url='https://refpahang.com/api/';
const pp=107, district=5, [a,b,c]=[96,97,98];
const emailOf=(id)=>one('SELECT email FROM users WHERE id=?',id).email;
// Telegram (or the app) comes first; email only for those who have neither.
const hasTelegram=(u)=>String(u.telegram_chat_id ?? '').trim()!=='';
const officialRows=[a,b,c].map((id)=>one('SELECT email,telegram_chat_id FROM users WHERE id=?',id));
const officials=officialRows.filter((u)=>!hasTelegram(u)).map((u)=>u.email).sort();
const ppRows=db.prepare(`SELECT email,telegram_chat_id FROM users WHERE role='PP Daerah' AND aktif=1
  AND COALESCE(NULLIF(persatuan_id,0),district_id)=? AND trim(COALESCE(email,''))<>''`).all(district);
const ppEmails=ppRows.filter((u)=>!hasTelegram(u)).map((u)=>u.email).sort();
const heard=(rows,text)=>rows.filter(hasTelegram).every((u)=>telegrams.some((t)=>t.chatId===String(u.telegram_chat_id) && t.text.includes(text)));
const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1");
const cookie={pp:await sessionCookie(db,pp),admin:await sessionCookie(db,admin.id),a:await sessionCookie(db,a)};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const send=(fn,file,method,who,body)=>fn(new Request(url+file,{method,headers:{Cookie:cookie[who],'Content-Type':'application/json'},
  body:JSON.stringify(body)}),env).then(async(r)=>({status:r.status,...(await r.json())}));
let slot=0;
async function recordGroup() {
  slot+=1;
  const r=await send(worker.refereeMatchManage,'pengadil-match-manage.php','POST','a',{action:'add',tarikh:today,
    masa:`0${slot}:1${slot}`,jenis:'Liga',nama_kejohanan:'Liga Notis',tempat:`Padang Notis ${slot}`,
    home_team:`Notis ${slot} FC`,away_team:'Lawan FC',daerah_perlawanan_id:district,
    officials:[[a,'Pengadil'],[b,'Penolong Pengadil 1'],[c,'Penolong Pengadil 2']].map(([user_id,jawatan])=>({user_id,jawatan}))});
  assert.equal(r.status,200,JSON.stringify(r));
  return r.match_group_id;
}

try {
  // --- PP Daerah decisions: every official gets an email --------------------
  let group=await recordGroup();
  const inAppBefore=one(`SELECT count(*) n FROM notifications WHERE user_id=? AND subject='Perlawanan Disahkan'`,a).n;
  reset();
  let r=await send(worker.districtMatchVerification,'pp-verify-match.php','POST','pp',{match_group_id:group,action:'verify'});
  assert.equal(r.error,false,r.message);
  assert.equal(r.officials_notified,3);
  assert.deepEqual(sent.map(to).sort(),officials);
  assert.ok(sent.every((m)=>/^Perlawanan Disahkan: Notis 1 FC lwn Lawan FC/.test(m.subject)));
  assert.ok(heard(officialRows,'Notis 1 FC'));
  assert.equal(one(`SELECT count(*) n FROM notifications WHERE user_id=? AND subject='Perlawanan Disahkan'`,a).n,inAppBefore+1,
    'the in-app notice is not duplicated');
  reset();
  r=await send(worker.districtMatchVerification,'pp-verify-match.php','POST','pp',
    {match_group_id:group,action:'revert',notes:'Semak skor'});
  assert.ok(sent.every((m)=>/^Perlawanan Dikembalikan: /.test(m.subject)));
  assert.ok(heard(officialRows,'Semak skor'));

  // --- Admin override and deletion -----------------------------------------
  reset();
  r=await send(worker.adminMatches,'admin-matches.php','POST','admin',
    {match_group_id:group,action:'reject',justification:'Rekod berganda'});
  assert.equal(r.error,false,r.message);
  assert.equal(r.officials_notified,3);
  assert.ok(sent.every((m)=>/^Perlawanan Tidak Disahkan: /.test(m.subject)));
  assert.ok(heard(officialRows,'Rekod berganda'));
  reset();
  r=await send(worker.adminMatches,'admin-matches.php','DELETE','admin',{match_group_id:group,justification:'Salah kemasukan'});
  assert.equal(r.error,false,r.message);
  assert.deepEqual(sent.map(to).sort(),officials);
  assert.ok(sent.every((m)=>/^Rekod Perlawanan Dipadam: /.test(m.subject)));
  assert.ok(heard(officialRows,'Salah kemasukan'));
  assert.equal(one(`SELECT count(*) n FROM notifications WHERE user_id=? AND subject='Rekod Perlawanan Dipadam'
    AND message LIKE '%Salah kemasukan%'`,b).n,1);

  // --- PP Daerah deletion -----------------------------------------------------
  group=await recordGroup();
  reset();
  r=await send(worker.districtMatchVerification,'pp-verify-match.php','DELETE','pp',{match_group_id:group});
  assert.equal(r.error,false,r.message);
  assert.deepEqual(sent.map(to).sort(),officials);

  // --- Referee edits or deletes an unverified single record: PP Daerah hears --
  const single=Number(db.prepare(`INSERT INTO perlawanan(user_id,tarikh,masa,jenis,tempat,home_team,away_team,
    status_pp,jawatan,daerah_perlawanan_id,created_at) VALUES(?,?,'09:00','Liga','Padang Asal','Satu FC','Dua FC',
    'Belum Disahkan','Pengadil',?,datetime('now','+8 hours'))`).run(a,today,district).lastInsertRowid);
  reset();
  r=await send(worker.refereeMatchManage,'pengadil-match-manage.php','POST','a',{action:'edit',match_id:single,tempat:'Padang Baharu'});
  assert.equal(r.error,false,r.message);
  assert.deepEqual(sent.map(to).sort(),ppEmails);
  assert.ok(sent.every((m)=>/^Rekod Perlawanan Dikemaskini: Satu FC lwn Dua FC/.test(m.subject)));
  assert.ok(heard(ppRows,'Padang Baharu'));
  reset();
  r=await send(worker.refereeMatchManage,'pengadil-match-manage.php','POST','a',{action:'delete',match_id:single});
  assert.equal(r.error,false,r.message);
  assert.deepEqual(sent.map(to).sort(),ppEmails);
  assert.ok(sent.every((m)=>/^Rekod Perlawanan Dipadam: /.test(m.subject)));
  assert.ok(heard(ppRows,'Satu FC'));

  // --- Seminar attendance: only a real change to Hadir / Tidak Hadir ---------
  const annual=one(`SELECT p.id,COALESCE(u.email,p.emel) AS email FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan IS NOT NULL
      AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')
      AND trim(COALESCE(u.email,''))<>'' ORDER BY p.id LIMIT 1`);
  db.prepare('UPDATE permohonan SET status_seminar=NULL WHERE id=?').run(annual.id);
  const seminar=(status)=>send(worker.deleteApplication,'admin-applications.php','POST','admin',
    {action:'update_status_seminar',id:annual.id,status_seminar:status});
  reset();
  r=await seminar('Hadir');
  assert.equal(r.notification_sent,true);
  const applicant=one('SELECT u.telegram_chat_id FROM permohonan p JOIN users u ON u.id=p.user_id WHERE p.id=?',annual.id);
  if (hasTelegram(applicant)) {
    assert.deepEqual(sent,[]);
    assert.ok(telegrams.some((t)=>t.chatId===String(applicant.telegram_chat_id) && t.text.includes('Hadir')));
  } else {
    assert.deepEqual(sent.map(to),[annual.email]);
    assert.match(sent[0].subject,/^Kehadiran Seminar sesi \d{4}: Hadir/);
  }
  reset();
  assert.equal((await seminar('Hadir')).notification_sent,false);
  assert.equal((await seminar(null)).notification_sent,false);
  assert.equal(sent.length+telegrams.length,0);

  // --- Kelas III result (non-gated path) ------------------------------------
  const kelas3=one(`SELECT p.id,COALESCE(u.email,p.emel) AS email FROM permohonan p LEFT JOIN users u ON u.id=p.user_id
    WHERE p.jenis_borang='kelas3_fam' AND trim(COALESCE(u.email,p.emel,''))<>'' ORDER BY p.id LIMIT 1`);
  db.prepare('UPDATE permohonan SET status_ujian=NULL WHERE id=?').run(kelas3.id);
  reset();
  r=await send(worker.deleteApplication,'admin-applications.php','POST','admin',
    {action:'update_status_ujian',id:kelas3.id,status_ujian:'Lulus'});
  assert.equal(r.error,false,r.message);
  assert.equal(r.email_sent,true);
  assert.deepEqual(sent.map(to),[kelas3.email]);
  assert.match(sent[0].subject,/^Keputusan Kelas III FAM( \d{4})?: Lulus - PBNP$/);

  // --- Deleted application -----------------------------------------------------
  reset();
  r=await send(worker.deleteApplication,'admin-applications.php','POST','admin',{action:'delete_application',id:kelas3.id});
  assert.equal(r.error,false,r.message);
  assert.equal(r.notification_sent,true);
  assert.deepEqual(sent.map(to),[kelas3.email]);
  assert.match(sent[0].subject,/^Permohonan Dipadam: Kelas III FAM/);
  console.log('notify-perlawanan: ok');
} finally {
  worker.setTelegramSenderForTests(null);
  close();
}
