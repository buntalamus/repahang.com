import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {lantikanWrite} from '../src/lantikan-write';
  export {appointmentReply} from '../src/appointment-reply';
  export {appointmentEmailLink} from '../src/appointment-email-link';
  export {appointmentAudit} from '../src/appointment-audit';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const {db,DB,close}=openDatabase(['0009_mysql_on_update_triggers','0010_worker_write_guards','0022_district_appointments']);
const emails=[];
const telegrams=[];
worker.setEmailSenderForTests(async(to,subject,html,name,type)=>{emails.push({to,subject,html,name,type});return true;});
worker.setTelegramSenderForTests(async(chatId,text,markup)=>{telegrams.push({chatId:String(chatId),text,markup});return true;});
const env={DB,BASE_URL:'https://refpahang.com',TELEGRAM_BOT_USERNAME:'refpahang_bot',
  STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1',
  MEDIA:{get:async()=>null}};
const one=(sql,...values)=>db.prepare(sql).get(...values);
const count=(sql,...values)=>Number(Object.values(db.prepare(sql).get(...values))[0]);
const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1");
const adminCall=(body)=>worker.lantikanWrite(new Request('https://refpahang.com/api/lantikan.php',
  {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env,{id:admin.id,role:'Admin'});
const portal=async(cookie,body)=>{const response=await worker.appointmentReply(new Request(
  'https://refpahang.com/api/lantikan-jawab.php',{method:'POST',
    headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)}),env);
  return {status:response.status,body:await response.json()};};
const link=async(method,fields)=>{
  const url=new URL('https://refpahang.com/api/lantikan-jawab-token.php');
  const init={method};
  if (method==='GET') for (const [key,value] of Object.entries(fields)) url.searchParams.set(key,value);
  else if (method==='POST') {init.body=new URLSearchParams(fields);
    init.headers={'Content-Type':'application/x-www-form-urlencoded'};}
  const response=await worker.appointmentEmailLink(new Request(url,init),env);
  return {status:response.status,html:await response.text()};
};

try {
  const tournament=14;
  const pool=db.prepare(`SELECT u.id,u.email,u.telegram_chat_id,u.jenis_pengadil,u.persatuan_id FROM pool_pengadil pp
    JOIN users u ON u.id=pp.pengadil_id WHERE pp.kejohanan_id=? AND u.aktif=1
      AND trim(COALESCE(u.email,''))<>'' AND u.telegram_chat_id IS NOT NULL ORDER BY u.id`).all(tournament);
  const kup=pool.filter((row)=>row.jenis_pengadil!=='Penilai Pengadil');
  const ra=pool.find((row)=>row.jenis_pengadil==='Penilai Pengadil');
  const match=Number(db.prepare(`INSERT INTO jadual_perlawanan (kejohanan_id,no_perlawanan,tarikh,masa,
      pasukan_home,pasukan_away,tempat,status,created_at,updated_at)
    VALUES (?,'R01','2026-12-03','11:07:00','Home FC','Away FC','Stadium','Belum Lantik',
      '2026-10-01 10:00:00','2026-10-01 10:00:00')`).run(tournament).lastInsertRowid);
  const roles=['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2'];
  for (const [index,role] of roles.entries()) {
    assert.equal((await adminCall({jadual_id:match,pengadil_id:kup[index].id,jawatan:role})).status,200);
  }
  assert.equal((await adminCall({jadual_id:match,pengadil_id:ra.id,jawatan:'Penilai Pengadil'})).status,200);
  assert.equal((await adminCall({action:'notify',jadual_id:match})).status,200);
  const rowOf=(role)=>one('SELECT * FROM lantikan_pengadil WHERE jadual_id=? AND jawatan=?',match,role);
  emails.length=0;telegrams.length=0;

  // Portal answer (lantikan-jawab.php).
  const ar1Cookie=await sessionCookie(db,kup[1].id);
  const foreign=await portal(ar1Cookie,{action:'accept',lantikan_id:rowOf('Pengadil').id});
  assert.deepEqual(foreign,{status:404,body:{error:true,message:'Lantikan tidak dijumpai atau bukan milik anda.'}});
  assert.equal((await portal(ar1Cookie,{action:'reject',lantikan_id:rowOf('Penolong Pengadil 1').id})).body.message,
    'Sila berikan sebab penolakan.');
  const accepted=await portal(ar1Cookie,{action:'accept',lantikan_id:rowOf('Penolong Pengadil 1').id});
  assert.deepEqual(accepted,{status:200,body:{error:false,
    message:'Tugasan berjaya diterima. Sila bawa kelengkapan penuh pengadil.',status:'Diterima'}});
  const ar1=rowOf('Penolong Pengadil 1');
  assert.deepEqual([ar1.status,ar1.komen,ar1.email_token,ar1.tg_token],['Diterima','',null,null]);
  const audit=one("SELECT * FROM lantikan_audit_log WHERE lantikan_id=? ORDER BY id DESC",ar1.id);
  assert.deepEqual([audit.event_type,audit.channel,audit.actor_type,audit.actor_user_id],
    ['appointment_response','portal','official',kup[1].id]);
  assert.deepEqual(JSON.parse(audit.details_json),{action:'accept',new_status:'Diterima',comment:''});
  const own=one("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC",kup[1].id);
  assert.deepEqual([own.type,own.subject,own.is_read],['Lantikan Diterima','Lantikan Home FC lwn Away FC',0]);
  const officialName=one('SELECT nama_penuh FROM users WHERE id=?',kup[1].id).nama_penuh;
  const admins=db.prepare("SELECT id,email,telegram_chat_id FROM users WHERE role='Admin' AND aktif=1").all();
  assert.equal(count(`SELECT count(*) FROM notifications WHERE type='Lantikan Diterima' AND subject=?`,
    `✅ ${officialName} — Home FC lwn Away FC`),admins.length);
  const adminChats=admins.filter((row)=>row.telegram_chat_id).map((row)=>String(row.telegram_chat_id));
  assert.equal(telegrams.filter((message)=>adminChats.includes(message.chatId)).length,adminChats.length);
  // PHP never e-mails Admin about an answer.
  assert.equal(emails.filter((mail)=>admins.some((row)=>row.email===mail.to)).length,0);
  assert.equal((await portal(ar1Cookie,{action:'accept',lantikan_id:ar1.id})).body.message,'Lantikan ini sudah dijawab.');

  // Email link: GET only confirms, POST answers (lantikan-jawab-token.php).
  const head=rowOf('Pengadil');
  const confirm=await link('GET',{token:head.email_token,action:'accept'});
  assert.equal(confirm.status,200);
  assert.match(confirm.html,/Sahkan Jawapan Lantikan/);
  assert.ok(confirm.html.includes(`name="token" value="${head.email_token}"`));
  assert.equal(rowOf('Pengadil').status,'Belum Jawab');
  const done=await link('POST',{token:head.email_token,action:'accept'});
  assert.match(done.html,/Tugasan Diterima/);
  assert.match(done.html,/03 Dec 2026/);
  assert.equal(rowOf('Pengadil').status,'Diterima');
  const linkAudit=one("SELECT * FROM lantikan_audit_log WHERE lantikan_id=? ORDER BY id DESC",head.id);
  assert.equal(linkAudit.channel,'email_link');
  assert.equal(linkAudit.link_url,
    `https://refpahang.com/api/lantikan-jawab-token.php?token=${head.email_token}&action=accept`);
  assert.match((await link('POST',{token:head.email_token,action:'accept'})).html,/tidak dapat dikenal pasti/);
  assert.match((await link('GET',{token:'',action:'accept'})).html,/tidak sah atau tidak lengkap/);
  assert.equal((await link('PUT',{})).status,405);

  // The last KUP acceptance completes the crew and notifies all three.
  emails.length=0;
  const ar2=rowOf('Penolong Pengadil 2');
  await link('POST',{token:ar2.email_token,action:'accept'});
  assert.equal(count("SELECT count(*) FROM kup_crew_notifications WHERE jadual_id=? AND completed_at IS NOT NULL",match),3);
  assert.equal(emails.filter((mail)=>mail.subject.startsWith('Krew KUP Lengkap:')).length,3);

  // RA acceptance sends the assessment form from the admin identity.
  emails.length=0;
  const raRow=rowOf('Penilai Pengadil');
  await link('POST',{token:raRow.email_token,action:'accept'});
  assert.match(rowOf('Penilai Pengadil').penilaian_token,/^[a-f0-9]{64}$/);
  const raMail=emails.find((mail)=>mail.subject.startsWith('Borang Penilaian Pengadil'));
  assert.equal(raMail.type,'admin');

  // An expired window: GET explains, POST auto-rejects like PHP.
  const late=Number(db.prepare(`INSERT INTO jadual_perlawanan (kejohanan_id,no_perlawanan,tarikh,masa,
      pasukan_home,pasukan_away,tempat,status,created_at,updated_at)
    VALUES (?,'R02','2026-12-04','12:07:00','A','B','C','Belum Lantik','2026-10-01 10:00:00','2026-10-01 10:00:00')`)
    .run(tournament).lastInsertRowid);
  await adminCall({jadual_id:late,pengadil_id:kup[3].id,jawatan:'Pengadil'});
  db.prepare(`UPDATE lantikan_pengadil SET notif_hantar=1,email_token='e1e1',
    tarikh_notif=datetime('now','+8 hours','-4 hours') WHERE jadual_id=?`).run(late);
  assert.match((await link('GET',{token:'e1e1',action:'accept'})).html,/Tempoh menjawab telah tamat pada/);
  assert.match((await link('POST',{token:'e1e1',action:'accept'})).html,/DITOLAK secara automatik/);
  assert.equal(one('SELECT status FROM lantikan_pengadil WHERE jadual_id=?',late).status,'Ditolak');

  // Admin override of the timeout rejection (lantikan-audit.php).
  const adminCookie=await sessionCookie(db,admin.id);
  const lateRow=one('SELECT id FROM lantikan_pengadil WHERE jadual_id=?',late);
  const override=await worker.appointmentAudit(new Request('https://refpahang.com/api/lantikan-audit.php',{
    method:'POST',headers:{'Content-Type':'application/json',Cookie:adminCookie},
    body:JSON.stringify({action:'admin_override_acceptance',lantikan_id:lateRow.id})}),env);
  const overrideBody=await override.json();
  const lateName=one('SELECT nama_penuh FROM users WHERE id=?',kup[3].id).nama_penuh;
  assert.equal(overrideBody.message,`Penerimaan ${lateName} sebagai Pengadil berjaya disahkan oleh Admin.`);
  assert.equal(overrideBody.data.lantikan.status,'Diterima');
  const overridden=one('SELECT * FROM lantikan_pengadil WHERE id=?',lateRow.id);
  assert.deepEqual([overridden.status,overridden.komen],['Diterima','Diterima melalui override Admin selepas tempoh tamat']);
  assert.equal(one("SELECT subject FROM notifications WHERE user_id=? ORDER BY id DESC",kup[3].id).subject,
    'Penerimaan lantikan A lwn B disahkan Admin');
  assert.equal(count(`SELECT count(*) FROM perlawanan WHERE lantikan_id=?`,lateRow.id),1);
  console.log('appointment responses: portal and email link follow PHP, including notifications and expiry');
} finally {close();}
