import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {lantikanWrite} from '../src/lantikan-write';
  export {adminAppointments} from '../src/admin-appointments';
  export {appointments} from '../src/appointments';
  export {portalDashboard} from '../src/portal-dashboard';
  export {appointmentReply} from '../src/appointment-reply';
  export {appointmentEmailLink} from '../src/appointment-email-link';
  export {appointmentAudit} from '../src/appointment-audit';
  export {appointmentLetter} from '../src/appointment-letter';
  export {telegramWebhook} from '../src/telegram-webhook';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests,setTelegramApiForTests} from '../src/php/telegram';
`);
const {db,DB,hooks,close}=openDatabase(['0009_mysql_on_update_triggers','0010_worker_write_guards','0019_annual_seminar_attendance','0022_district_appointments']);
const env={DB,BASE_URL:'https://refpahang.com',TELEGRAM_BOT_USERNAME:'refpahang_bot',
  STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1',MEDIA:{get:async()=>null}};
let delivered=false;
const messages=[],callbacks=[];
worker.setEmailSenderForTests(async(...args)=>{messages.push(['email',...args]);return delivered;});
worker.setTelegramSenderForTests(async(...args)=>{messages.push(['telegram',...args]);return delivered;});
worker.setTelegramApiForTests(async(method,payload)=>{callbacks.push({method,payload});});
const one=(sql,...values)=>db.prepare(sql).get(...values);
const insert=(sql,...values)=>Number(db.prepare(sql).run(...values).lastInsertRowid);
const request=(path,cookie,body)=>new Request(`https://refpahang.com/api/${path}`,{
  method:body===undefined?'GET':'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
});
const json=async(response)=>({status:response.status,body:await response.json()});

try {
  // Private fixtures: no network messages or production writes.
  db.exec("UPDATE jadual_perlawanan SET tarikh='2000-01-01'");
  const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1");
  const pid=one('SELECT id FROM persatuan_bolasepak_daerah LIMIT 1').id;
  const adminCookie=await sessionCookie(db,admin.id);
  const officials=[];
  for(let i=0;i<7;i++) {
    const ra=i===4;
    const id=insert(`INSERT INTO users(email,password,role,nama_penuh,aktif,password_changed,
      jenis_pengadil,persatuan_id,telegram_chat_id) VALUES(?,'unused',?,?,1,1,?,?,?)`,
      `draft-${i}@example.invalid`,ra?'Penilai':'Pengadil',`Calon Ujian ${i}`,
      ra?'Penilai Pengadil':'Pengadil Negeri',pid,990001+i);
    officials.push({id,cookie:await sessionCookie(db,id)});
  }
  const pp=insert(`INSERT INTO users(email,password,role,nama_penuh,aktif,password_changed,persatuan_id)
    VALUES('draft-pp@example.invalid','unused','PP Daerah','PP Ujian',1,1,?)`,pid);
  const ppCookie=await sessionCookie(db,pp);
  const tournament=insert(`INSERT INTO kejohanan(nama,jenis_kejohanan,status,tarikh_mula,tarikh_akhir)
    VALUES('Ujian Draf','Liga','Aktif','2090-01-01','2090-12-31')`);
  for(const o of officials) insert('INSERT INTO pool_pengadil(kejohanan_id,pengadil_id) VALUES(?,?)',tournament,o.id);
  const roles=['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4','Penilai Pengadil'];
  let matchNo=0;
  const match=()=>insert(`INSERT INTO jadual_perlawanan(kejohanan_id,no_perlawanan,tarikh,masa,
    pasukan_home,pasukan_away,tempat,status) VALUES(?,?,'2090-06-01',?,'Ujian Home','Ujian Away','Padang','Belum Lantik')`,
    tournament,`D${++matchNo}`,`${10+matchNo}:00:00`);
  const call=async(body)=>json(await worker.lantikanWrite(request('lantikan.php',adminCookie,body),env,{id:admin.id,role:'Admin'}));
  const assign=async(jid,index,official=officials[index])=>{
    const result=await call({jadual_id:jid,pengadil_id:official.id,jawatan:roles[index]});
    assert.equal(result.status,200,result.body.message);
    return one('SELECT * FROM lantikan_pengadil WHERE jadual_id=? AND jawatan=?',jid,roles[index]);
  };
  const list=async(o)=> (await (await worker.appointments(request('tugasan.php',o.cookie),env)).json());
  const dashboard=async(cookie,view='pengadil')=>(await (await worker.portalDashboard(
    request(`portal-dashboard.php?view=${view}&year=2090`,cookie),env)).json()).data;
  const reply=async(o,id,action='accept')=>json(await worker.appointmentReply(
    request('lantikan-jawab.php',o.cookie,{lantikan_id:id,action,komen:action==='reject'?'Tidak lapang':''}),env));
  const audit=async(id,action,extra={})=>json(await worker.appointmentAudit(
    request('lantikan-audit.php',adminCookie,{lantikan_id:id,action,...extra}),env));
  const link=async(token,method='GET')=>worker.appointmentEmailLink(new Request(
    `https://refpahang.com/api/lantikan-jawab-token.php${method==='GET'?`?token=${token}&action=accept`:''}`,
    method==='GET'?{}:{method,headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({token,action:'accept'})}),env);

  const jid=match();
  const rows=[];
  rows.push(await assign(jid,0));
  assert.equal((await call({action:'notify',jadual_id:jid})).status,409,'incomplete roster cannot publish');
  assert.equal(one('SELECT published_at FROM lantikan_pengadil WHERE id=?',rows[0].id).published_at,null);
  for(let i=1;i<5;i++) rows.push(await assign(jid,i));
  assert.equal(messages.length,0,'saving drafts sends no notices');
  for(const o of officials.slice(0,5)) {
    const data=await list(o);
    assert.equal(data.data.length,0,'draft absent from mobile/web assignment list');
    assert.equal(data.stats.total,0,'draft not included in counters');
    const home=await dashboard(o.cookie,o===officials[4]?'ra':'pengadil');
    assert.equal(home.upcoming.length,0,'draft absent from personal dashboard');
    assert.equal(home.responses.length,0);
  }
  assert.equal((await dashboard(ppCookie,'pp')).upcoming.length,0,'district overview hides candidates');
  const adminView=await (await worker.adminAppointments(request(`lantikan.php?jadual_id=${jid}`,adminCookie),env)).json();
  assert.equal(adminView.data.length,5,'manager retains all draft slots');
  for(const action of ['accept','reject']) {
    const result=await reply(officials[0],rows[0].id,action);
    assert.equal(result.status,409);
    assert.match(result.body.message,/masih draf/);
  }
  assert.equal(one('SELECT COUNT(*) AS n FROM perlawanan WHERE lantikan_id=?',rows[0].id).n,0);

  // Preparing/copying direct links does not publish or start the deadline.
  assert.equal((await audit(rows[0].id,'prepare_links')).status,200);
  const prepared=one('SELECT * FROM lantikan_pengadil WHERE id=?',rows[0].id);
  assert.ok(prepared.email_token);
  assert.equal(prepared.published_at,null);
  assert.equal(prepared.tarikh_notif,null);
  for(const method of ['GET','POST']) {
    const result=await link(prepared.email_token,method);
    assert.equal(result.status,409);
    assert.match(await result.text(),/Lantikan Belum Dihantar/);
  }
  db.prepare("UPDATE lantikan_pengadil SET tg_token='drafttoken' WHERE id=?").run(rows[0].id);
  await worker.telegramWebhook(request('telegram-webhook.php','',{callback_query:{id:'draft',from:{id:990001},
    data:'act:accept:token:drafttoken',message:{message_id:1}}}),env);
  assert.match(callbacks.at(-1).payload.text,/masih draf/);
  assert.equal(one('SELECT status FROM lantikan_pengadil WHERE id=?',rows[0].id).status,'Belum Jawab');

  // A blast publishes all five even if email/Telegram fail; no false deadline.
  const notified=await call({action:'notify',jadual_id:jid});
  assert.equal(notified.status,200,notified.body.message);
  assert.equal(notified.body.delivery_failed,5);
  for(const row of rows) {
    const saved=one('SELECT * FROM lantikan_pengadil WHERE id=?',row.id);
    assert.ok(saved.published_at);
    assert.equal(saved.notif_hantar,0);
    assert.equal(saved.tarikh_notif,null);
    assert.equal(one("SELECT COUNT(*) AS n FROM lantikan_audit_log WHERE lantikan_id=? AND event_type='appointment_published'",row.id).n,1);
  }
  assert.equal((await list(officials[0])).data[0].rakan_tugasan.length,3);
  assert.equal((await dashboard(officials[0].cookie)).responses.length,1,'app-only published appointment is actionable');
  assert.equal((await reply(officials[0],rows[0].id)).body.status,'Diterima');
  assert.equal((await reply(officials[1],rows[1].id,'reject')).body.status,'Ditolak');
  assert.equal(one('SELECT COUNT(*) AS n FROM perlawanan WHERE lantikan_id=?',rows[0].id).n,1);

  // A replacement of the same slot returns to a hidden, unanswerable draft.
  const replacement=await assign(jid,0,officials[5]);
  assert.equal(replacement.id,rows[0].id);
  assert.equal(replacement.published_at,null);
  assert.equal(replacement.tarikh_jawab,null);
  assert.equal((await list(officials[5])).data.length,0);
  const peer=(await list(officials[2])).data[0];
  assert.equal(peer.nama_pengadil_utama,null,'draft replacement name is hidden from peers');
  assert.ok(peer.rakan_tugasan.every(r=>r.id!==replacement.id));
  assert.equal((await reply(officials[5],replacement.id)).status,409);
  assert.equal((await reply(officials[0],replacement.id)).status,404,'previous holder loses access');

  // Confirmed manual delivery is another explicit publication action.
  await audit(replacement.id,'prepare_links');
  assert.equal((await audit(replacement.id,'mark_manual_delivery',{delivery_type:'appointment'})).status,200);
  assert.equal((await list(officials[5])).data.length,1);
  assert.equal((await reply(officials[5],replacement.id)).body.status,'Diterima');
  const nextDraft=await assign(jid,1,officials[6]);
  let letter='';
  const pdf=await worker.appointmentLetter(request(`surat-lantikan.php?id=${replacement.id}`,officials[5].cookie),{
    ...env,ASSETS:{fetch:async()=>new Response(new Uint8Array([137,80,78,71]))},
    BROWSER:{quickAction:async(_kind,options)=>{letter=options.html;
      return new Response('%PDF-test',{headers:{'Content-Type':'application/pdf'}});}},
  });
  assert.equal(pdf.status,200);
  assert.ok(!letter.includes('Calon Ujian 6'),'draft replacement absent from appointment letter roster');

  // Bulk blast publishes only complete, eligible matches.
  const jid2=match();
  for(let i=0;i<3;i++) await assign(jid2,i);
  const incomplete=match();
  await assign(incomplete,0);
  delivered=true;
  const bulk=await call({action:'notify_all',kejohanan_id:tournament,jadual_ids:[jid2,incomplete]});
  assert.equal(bulk.status,200,bulk.body.message);
  assert.equal(bulk.body.matches_processed,1);
  assert.equal(bulk.body.matches_skipped_incomplete,1);
  assert.ok(one('SELECT published_at FROM lantikan_pengadil WHERE jadual_id=?',jid2).published_at);
  assert.equal(one('SELECT published_at FROM lantikan_pengadil WHERE jadual_id=?',incomplete).published_at,null);

  // A changed candidate during publication rolls back the entire publication.
  const race=match();
  for(let i=0;i<3;i++) await assign(race,i);
  const before=messages.length;
  hooks.beforeBatch=()=>db.prepare("UPDATE lantikan_pengadil SET status='Ditolak' WHERE jadual_id=? AND jawatan='Pengadil'").run(race);
  assert.equal((await call({action:'notify',jadual_id:race})).status,409);
  assert.equal(one('SELECT COUNT(*) AS n FROM lantikan_pengadil WHERE jadual_id=? AND published_at IS NOT NULL',race).n,0);
  assert.equal(messages.length,before,'publication race sends nothing');

  // Legacy accepted/notified rows stay visible with their original status.
  const legacy=match();
  const oldAccepted=insert(`INSERT INTO lantikan_pengadil(jadual_id,pengadil_id,jawatan,status,notif_hantar)
    VALUES(?,?,'Pengadil','Diterima',0)`,legacy,officials[0].id);
  const oldNotified=insert(`INSERT INTO lantikan_pengadil(jadual_id,pengadil_id,jawatan,status,notif_hantar)
    VALUES(?,?,'Penolong Pengadil 1','Belum Jawab',1)`,legacy,officials[1].id);
  assert.ok((await list(officials[0])).data.some(a=>a.id===oldAccepted&&a.status==='Diterima'));
  assert.ok((await list(officials[1])).data.some(a=>a.id===oldNotified));
  assert.equal(one('SELECT published_at FROM lantikan_pengadil WHERE id=?',oldAccepted).published_at,null,'legacy status preserved without backfill');
  assert.equal(one('SELECT status FROM lantikan_pengadil WHERE id=?',nextDraft.id).status,'Belum Jawab');

  // A stale client's answer cannot slip through when Admin replaces the holder
  // after the API's ownership/publication read but before its response batch.
  const answeredDuringReplacement=one("SELECT id FROM lantikan_pengadil WHERE jadual_id=? AND jawatan='Pengadil'",jid2).id;
  hooks.beforeBatch=()=>db.prepare(`UPDATE lantikan_pengadil SET pengadil_id=?,published_at=NULL,
    notif_hantar=0,tg_notif_hantar=0,tarikh_notif=NULL,tg_token=NULL,email_token=NULL WHERE id=?`)
    .run(officials[6].id,answeredDuringReplacement);
  assert.equal((await reply(officials[0],answeredDuringReplacement)).status,400);
  const changed=one('SELECT status,published_at FROM lantikan_pengadil WHERE id=?',answeredDuringReplacement);
  assert.deepEqual({...changed},{status:'Belum Jawab',published_at:null});
  assert.equal(one('SELECT COUNT(*) AS n FROM perlawanan WHERE lantikan_id=?',answeredDuringReplacement).n,0);
  console.log('Appointment publication: hidden drafts, server-side response guards, manual links, single/bulk blast, failed delivery, replacement, race rollback and legacy preservation passed.');
} finally {close();}
