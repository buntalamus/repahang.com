import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';
const worker=await bundle(`export {adminTestApplications} from '../src/admin-test-applications';export {adminApprove} from '../src/admin-approve';`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers']);
const messages=[];
const env={DB,BASE_URL:'https://refpahang.com',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
 MAIL_DAFTAR_USER:'daftar@example.invalid',MAIL_DAFTAR_NAME:'Ujian',EMAIL:{send:async message=>{messages.push(message);return {messageId:'mock-only'};}}};
try{
 const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
 const cookie=await sessionCookie(db,admin.id);
 const sample=db.prepare("SELECT * FROM permohonan WHERE jenis_permohonan='ujian_kecergasan' LIMIT 1").get();
 assert.ok(sample,'Legacy test fixture');
 db.prepare("UPDATE users SET email='pemohon@example.invalid' WHERE id=?").run(sample.user_id);
 const post=(fn,body)=>fn(new Request('https://refpahang.com/api/qa.php',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}),env);
 for(const [type,kind] of [['fitness','ujian_kecergasan'],['written','ujian_bertulis'],['kelas1','ujian_kelas1_fam']]){
  for(const action of ['approve','reject','absent']){
   db.prepare("UPDATE permohonan SET workflow_status='Pending',jenis_permohonan=?,nama_penuh='NAMA CONTOH' WHERE id=?").run(kind,sample.id);
   messages.length=0;
   const response=await post(worker.adminTestApplications,{id:sample.id,type,action,notes:'CATATAN CONTOH'});
   const result=await response.json();assert.equal(response.status,200);assert.equal(result.email_sent,true);assert.equal(messages.length,1);
   const html=messages[0].html;
   assert.ok(html.includes('CATATAN CONTOH'),'Admin notes retained');
   assert.ok(html.includes('Jenis Ujian'),'Original identity table retained');
   if(action==='approve'){
    assert.ok(html.includes('DILULUSKAN'),'Application approved, not exam passed');
    assert.ok(!messages[0].subject.includes(': Lulus'),'No false pass announcement');
    assert.ok(html.includes('Langkah Seterusnya'),'Next steps retained');
   }else if(action==='absent')assert.ok(html.includes('7 hari'),'Seven-day contact instruction retained');
   else assert.ok(html.includes('support@refpahang.com'),'Appeal contact retained');
  }
 }
 const assessor=db.prepare("SELECT id FROM users WHERE role='Penilai' AND aktif=1 LIMIT 1").get();
 assert.ok(assessor,'Assessor fixture');
 const values={...sample,user_id:assessor.id,jenis_borang:'penilai_berdaftar',tahun_permohonan:2098,
  nama_penuh:'RA CONTOH',no_kp:'990101060001',emel:'ra@example.invalid'};delete values.id;
 const columns=Object.keys(values);
 const ra={id:Number(db.prepare(`INSERT INTO permohonan(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`)
  .run(...Object.values(values)).lastInsertRowid),user_id:assessor.id};
 db.prepare("UPDATE permohonan SET status_workflow='Menunggu Admin',nama_penuh='RA CONTOH' WHERE id=?").run(ra.id);
 db.prepare("UPDATE users SET email='ra@example.invalid' WHERE id=?").run(ra.user_id);messages.length=0;
 const response=await post(worker.adminApprove,{permohonan_id:ra.id,action:'approve',notes:'CATATAN CONTOH'});
 assert.equal(response.status,200);assert.equal((await response.json()).email_sent,true);
 assert.ok(messages[0].html.includes('/penilai/permohonan/tahunan'),'RA link follows its portal');
 assert.ok(messages[0].html.includes('No. Kad Pengenalan'),'Original registration identity table retained');
 db.prepare("UPDATE permohonan SET status_workflow='Menunggu Admin',jenis_borang='pengadil_berdaftar',jenis_pengadil='Penilai Pengadil' WHERE id=?").run(ra.id);messages.length=0;
 const legacyRaResponse=await post(worker.adminApprove,{permohonan_id:ra.id,action:'approve',notes:'CATATAN CONTOH'});
 assert.equal(legacyRaResponse.status,200);assert.equal((await legacyRaResponse.json()).email_sent,true);
 assert.ok(messages[0].html.includes('/penilai/permohonan/tahunan'),'Legacy RA registration link follows its portal');
 console.log('Original email decisions: all 9 test decisions and RA approval link/copy passed; no mail sent');
}finally{close();}
