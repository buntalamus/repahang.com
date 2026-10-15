import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {submitAssessmentRequest} from '../src/report-submission';
  export {assessmentDraft} from '../src/assessment-draft';
  export {chairApprovalLink} from '../src/chair-approval-link';
  export {chairConfig} from '../src/chair-config';
  export {setEmailSenderForTests} from '../src/php/email';
  export {setTelegramSenderForTests} from '../src/php/telegram';
`);
const {db,DB,close}=openDatabase(['0003_assessment_drafts','0009_mysql_on_update_triggers','0010_worker_write_guards']);
const emails=[];
const telegrams=[];
worker.setEmailSenderForTests(async(to,subject,html,name,type)=>{emails.push({to,subject,html,name,type});return true;});
worker.setTelegramSenderForTests(async(chatId,text,markup)=>{telegrams.push({chatId:String(chatId),text,markup});return true;});
const env={DB,BASE_URL:'https://refpahang.com',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  REPORT_DELIVERY_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1',MEDIA:{get:async()=>null}};
const one=(sql,...values)=>db.prepare(sql).get(...values);
const count=(sql,...values)=>Number(Object.values(db.prepare(sql).get(...values))[0]);
const put=async(cookie,body)=>{const response=await worker.submitAssessmentRequest(new Request(
  'https://refpahang.com/api/laporan-penilaian.php',{method:'PUT',
    headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)}),env);
  return {status:response.status,body:await response.json()};};
const chairPage=async(method,fields)=>{
  const url=new URL('https://refpahang.com/api/laporan-pengesahan-token.php');
  const init={method};
  if (method==='GET') url.searchParams.set('token',fields.token);
  else {init.body=new URLSearchParams(fields);init.headers={'Content-Type':'application/x-www-form-urlencoded'};}
  const response=await worker.chairApprovalLink(new Request(url,init),env);
  return {status:response.status,html:await response.text()};
};

try {
  const candidates=db.prepare(`SELECT ra.id,ra.jadual_id,ra.pengadil_id,jp.kejohanan_id,ra_user.role
    FROM lantikan_pengadil ra JOIN jadual_perlawanan jp ON jp.id=ra.jadual_id
    JOIN kejohanan_pengesah_laporan kp ON kp.kejohanan_id=jp.kejohanan_id AND kp.aktif=1
    JOIN users ra_user ON ra_user.id=ra.pengadil_id AND ra_user.aktif=1
    WHERE ra.jawatan='Penilai Pengadil' AND ra.status='Diterima' AND ra.pengadil_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM laporan_penilaian r WHERE r.lantikan_id=ra.id)
      AND (SELECT count(*) FROM lantikan_pengadil lp WHERE lp.jadual_id=ra.jadual_id AND lp.status='Diterima'
        AND lp.jawatan IN ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2')) = 3
    ORDER BY ra_user.role='Admin',ra.id LIMIT 2`).all();
  assert.equal(candidates.length,2,'two RA appointments with a configured chair');
  assert.notEqual(candidates[0].role,'Admin','the session RA must not be an Admin');
  const kupOf=(jadualId)=>db.prepare(`SELECT lp.id,lp.jawatan,COALESCE(u.nama_penuh,pl.nama,'Pegawai') AS nama
    FROM lantikan_pengadil lp LEFT JOIN users u ON u.id=lp.pengadil_id LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.jadual_id=? AND lp.status='Diterima' AND lp.jawatan IN
      ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')`).all(jadualId);

  // Session RA: a Draf report submitted with PUT hantar.
  const first=candidates[0];
  const reportId=Number(db.prepare(`INSERT INTO laporan_penilaian (jadual_id,lantikan_id,penilai_id,status,
      created_at,updated_at) VALUES (?,?,?,'Draf',datetime('now'),datetime('now'))`)
    .run(first.jadual_id,first.id,first.pengadil_id).lastInsertRowid);
  for (const person of kupOf(first.jadual_id)) db.prepare(`INSERT INTO laporan_penilaian_pegawai
    (laporan_id,lantikan_pengadil_id,jawatan,nama_pengadil,markah,kawalan_kekuatan)
    VALUES (?,?,?,?,'8.4','["Tegas"]')`).run(reportId,person.id,person.jawatan,person.nama);
  const raCookie=await sessionCookie(db,first.pengadil_id);
  const chair=one(`SELECT kp.*,COALESCE(u.email,pl.emel,'') AS email,COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS chat
    FROM kejohanan_pengesah_laporan kp LEFT JOIN users u ON u.id=kp.pengesah_user_id
    LEFT JOIN pengadil_luar pl ON pl.id=kp.pengesah_luar_id WHERE kp.kejohanan_id=? AND kp.aktif=1`,first.kejohanan_id);
  const admins=count("SELECT count(*) FROM users WHERE role='Admin' AND aktif=1");
  const copiesBefore=count(`SELECT count(*) FROM notifications WHERE type='Laporan RA'
    AND subject='Salinan Laporan RA — Menunggu Pengesahan Pengerusi' AND is_read=0`);
  const submitted=await put(raCookie,{action:'hantar',id:reportId});
  assert.equal(submitted.status,200);
  assert.equal(submitted.body.message,'Laporan berjaya dihantar kepada Pengerusi Pengadil. Admin menerima salinan.');
  assert.equal(submitted.body.pengesahan.configured,true);
  assert.equal('approval_token' in submitted.body.pengesahan.state,false);
  const approval=one('SELECT * FROM laporan_pengesahan_pengerusi WHERE laporan_id=?',reportId);
  assert.match(approval.approval_token,/^[a-f0-9]{64}$/);
  assert.ok(approval.admin_copy_at);
  assert.equal(count(`SELECT count(*) FROM notifications WHERE type='Laporan RA'
    AND subject='Salinan Laporan RA — Menunggu Pengesahan Pengerusi' AND is_read=0`)-copiesBefore,admins);
  const chairMail=emails.find((mail)=>mail.subject.startsWith('Pengesahan Laporan RA — '));
  if (String(chair.email).trim()) {
    assert.equal(chairMail.to,String(chair.email));
    assert.equal(chairMail.type,'lantikan');
    assert.ok(chairMail.html.includes(`laporan-pengesahan-token.php?token=${approval.approval_token}`));
    assert.ok(chairMail.html.includes('Lihat laporan penuh dalam mod baca sahaja'));
  }
  if (chair.chat) assert.equal(telegrams.at(-1).markup.inline_keyboard[0][0].text,'📋 Semak & Sahkan');
  assert.equal(count(`SELECT count(*) FROM laporan_pengesahan_audit WHERE laporan_id=?
    AND event_type IN ('approval_prepared','admin_copy_created')`,reportId),2);
  assert.deepEqual((await put(raCookie,{action:'hantar',id:reportId})).status,409);

  // Admin tools: link copy and retry (nothing left to resend).
  const admin=one("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1");
  const adminCookie=await sessionCookie(db,admin.id);
  assert.equal((await put(adminCookie,{action:'log_pengerusi_link_copy',id:reportId})).body.message,'Salinan pautan direkodkan.');
  const sentBefore=emails.length+telegrams.length;
  const retried=await put(adminCookie,{action:'retry_pengerusi_notification',id:reportId});
  assert.match(retried.body.message,/Sekurang-kurangnya satu saluran berjaya|tiada saluran berjaya/);
  assert.equal(emails.length+telegrams.length,sentBefore);
  assert.equal((await put(raCookie,{action:'sahkan',id:reportId,override_reason:'x'})).body.message,'Action tidak sah.');

  // Chair page: GET only reviews, POST confirms and notifies every official.
  const review=await chairPage('GET',{token:approval.approval_token});
  assert.match(review.html,/Semak &amp; Sahkan Laporan RA|Semak & Sahkan Laporan RA/);
  assert.equal(one('SELECT status FROM laporan_penilaian WHERE id=?',reportId).status,'Dihantar');
  assert.equal((await chairPage('GET',{token:'z'})).status,404);
  emails.length=0;telegrams.length=0;
  const confirmed=await chairPage('POST',{token:approval.approval_token,catatan_pengerusi:'Baik\nTeruskan'});
  assert.equal(confirmed.status,200);
  assert.match(confirmed.html,/Laporan Berjaya Disahkan/);
  assert.match(confirmed.html,/Baik<br \/>\nTeruskan/);
  assert.equal(one('SELECT status FROM laporan_penilaian WHERE id=?',reportId).status,'Disahkan');
  assert.equal(one('SELECT status FROM jadual_perlawanan WHERE id=?',first.jadual_id).status,'Selesai');
  const kupMail=emails.find((mail)=>mail.subject.startsWith('Laporan Penilaian — '));
  assert.match(kupMail.subject,/ vs .+ — \d{2} (Jan|Feb|Mac|Apr|Mei|Jun|Jul|Ogo|Sep|Okt|Nov|Dis) \d{4}$/);
  assert.ok(kupMail.html.includes('Catatan Pengerusi Pengadil'));
  assert.ok(kupMail.html.includes('view_token='));
  assert.ok(kupMail.html.includes('Tegas'));
  assert.equal(count(`SELECT count(*) FROM laporan_pengesahan_audit WHERE laporan_id=?
    AND event_type='kup_report_notification'`,reportId),kupOf(first.jadual_id).length*2);
  const again=await chairPage('POST',{token:approval.approval_token});
  assert.equal(again.status,409);
  assert.match(again.html,/Laporan ini telah disahkan atau di-override sebelum ini/);

  // Token form: save and submit in one step, then an Admin override.
  const second=candidates[1];
  const raToken='b'.repeat(64);
  db.prepare('UPDATE lantikan_pengadil SET penilaian_token=? WHERE id=?').run(raToken,second.id);
  const tokenPost=(body)=>worker.assessmentDraft(new Request('https://refpahang.com/api/penilaian-token.php',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env,'token');
  const crew=kupOf(second.jadual_id);
  const draft=await (await tokenPost({token:raToken,tahap_kesukaran:'Normal',cuaca:'Cerah',
    pegawai:crew.map((p)=>({lantikan_pengadil_id:p.id,markah:'',prestasi:''}))})).json();
  assert.deepEqual([draft.error,draft.message,draft.pengesahan],[false,'Draf disimpan.',null]);
  const missing=await (await tokenPost({token:raToken,hantar:true,tahap_kesukaran:'Normal',cuaca:'Cerah',
    pegawai:crew.map((p)=>({lantikan_pengadil_id:p.id,markah:'',prestasi:''}))})).json();
  assert.equal(missing.message,'Markah untuk semua pegawai perlu diisi.');
  const sentByToken=await (await tokenPost({token:raToken,hantar:true,tahap_kesukaran:'Normal',cuaca:'Cerah',
    pegawai:crew.map((p)=>({lantikan_pengadil_id:p.id,markah:'7.8',prestasi:'Baik'}))})).json();
  assert.equal(sentByToken.message,'Laporan berjaya dihantar kepada Pengerusi Pengadil. Admin menerima salinan.');
  const secondReport=sentByToken.id;
  assert.equal(one('SELECT status FROM laporan_penilaian WHERE id=?',secondReport).status,'Dihantar');
  assert.ok(one('SELECT tarikh_hantar FROM laporan_penilaian WHERE id=?',secondReport).tarikh_hantar);
  assert.equal((await put(adminCookie,{action:'sahkan',id:secondReport,override_reason:''})).body.message,
    'Sebab override Admin diperlukan.');
  emails.length=0;
  const overridden=await put(adminCookie,{action:'sahkan',id:secondReport,override_reason:'Pengerusi bercuti',
    catatan_admin:'Disemak Admin'});
  assert.deepEqual(overridden,{status:200,body:{error:false,message:'Override Admin direkodkan dan laporan disahkan.'}});
  const overrideAudit=one(`SELECT details_json FROM laporan_pengesahan_audit WHERE laporan_id=?
    AND event_type='report_admin_override'`,secondReport);
  assert.equal(JSON.parse(overrideAudit.details_json).reason,'Pengerusi bercuti');
  assert.ok(emails.some((mail)=>mail.html.includes('Catatan Override Admin')));
  assert.equal((await put(adminCookie,{action:'sahkan',id:secondReport,override_reason:'x'})).status,409);
  console.log('RA report flow: submit, chair dispatch, confirm page, KUP notices, token submit and override follow PHP');
} finally {close();}
