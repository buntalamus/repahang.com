import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {submitRefereeApplication,deleteApplication}=await bundle(
  "export {submitRefereeApplication} from '../src/application-submit'; export {deleteApplication} from '../src/applications';"
);
const {db,DB,hooks,close}=openDatabase(['0001_worker_sessions','0011_application_uniqueness']);
const objects=new Map();
const emails=[];
const pdf=new TextEncoder().encode('%PDF-1.7\n% test');
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  BASE_URL:'https://staging.refpahang.example',
  MAIL_DAFTAR_USER:'daftar@refpahang.example',MAIL_DAFTAR_NAME:'PBNP',
  EMAIL:{send:async message=>{emails.push(message);return {messageId:'test'};}},
  MEDIA:{put:async(key,bytes,options)=>objects.set(key,{bytes,options}),
    get:async key=>objects.has(key)?{
      httpMetadata:{contentType:objects.get(key).options.httpMetadata.contentType},
      arrayBuffer:async()=>objects.get(key).bytes.buffer,
    }:null,delete:async key=>objects.delete(key)},
  ASSETS:{fetch:async()=>new Response('missing',{status:404})},
  BROWSER:{quickAction:async()=>new Response(pdf,{headers:{'Content-Type':'application/pdf'}})},
};
const png=Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlU5YQAAAAASUVORK5CYII=',
  'base64'));
const cookie=await sessionCookie(db,80);
function form(type='pengadil_berdaftar') {
  const data=new FormData();
  data.set('jenis_borang',type);
  data.set('nama_waris','Waris Ujian');
  data.set('hubungan_waris','Keluarga');
  data.set('telefon_waris','0123456789');
  data.set('saiz_baju','M');
  data.set('resit',new File([png],'resit.png',{type:'image/png'}));
  data.set('gambar',new File([png],'gambar.png',{type:'image/png'}));
  return data;
}
async function post(data=form(),withCookie=true,session=cookie) {
  return submitRefereeApplication(new Request('https://staging.refpahang.example/api/pengadil-application.php',{
    method:'POST',headers:withCookie?{Cookie:session}:{},body:data,
  }),env);
}
try {
  assert.equal((await post(form(),false)).status,401);
  env.STAGING_WRITES_ENABLED='0';
  assert.equal((await post()).status,503);
  env.STAGING_WRITES_ENABLED='1';
  const missing=form();missing.delete('resit');
  assert.equal((await post(missing)).status,400);
  const forged=form();forged.set('resit',new File([new TextEncoder().encode('invalid')],'resit.pdf',{type:'application/pdf'}));
  assert.equal((await post(forged)).status,400);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM permohonan WHERE user_id=80 AND tahun_permohonan=2027").get().n,0);
  hooks.beforeBatch=()=>{throw new Error('simulated database failure');};
  await assert.rejects(()=>post());
  assert.equal(objects.size,0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM permohonan WHERE user_id=80 AND tahun_permohonan=2027").get().n,0);
  const response=await post();
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.error,false);
  assert.equal(result.linked_matches,51);
  assert.equal(result.email_sent,true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM perlawanan WHERE user_id=80 AND permohonan_id=?").get(result.application_id).n,51);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM perlawanan WHERE user_id=80 AND status_pp='Disahkan' AND substr(tarikh,1,4)='2026'").get().n,51);
  assert.equal(emails.length,1);
  assert.equal(emails[0].attachments.length,1);
  assert.match(emails[0].attachments[0].filename,/R1_R2_R4/);
  assert.equal(emails[0].attachments[0].type,'application/pdf');
  assert.equal((await post()).status,400);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM permohonan WHERE user_id=80 AND tahun_permohonan=2027").get().n,1);
  assert.equal(emails.length,1);
  assert.equal(objects.size,2);
  const ra=db.prepare("SELECT id FROM users WHERE role='Penilai' AND aktif=1 AND id NOT IN (SELECT user_id FROM permohonan WHERE jenis_borang='penilai_berdaftar' AND tahun_permohonan=2027) LIMIT 1").get();
  assert.ok(ra);
  const raCookie=await sessionCookie(db,ra.id);
  const raResponse=await post(form('penilai_berdaftar'),true,raCookie);
  assert.equal(raResponse.status,200);
  const raResult=await raResponse.json();
  assert.equal(raResult.error,false);
  assert.equal(raResult.email_sent,true);
  assert.match(emails.at(-1).attachments[0].filename,/RA_R1/);
  assert.equal(emails.at(-1).attachments.length,1);
  const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
  const adminCookie=await sessionCookie(db,admin.id);
  const allMatchesBefore=db.prepare('SELECT COUNT(*) n FROM perlawanan WHERE user_id=80').get().n;
  const deletion=await deleteApplication(new Request('https://staging.refpahang.example/api/admin-applications.php',{
    method:'POST',headers:{Cookie:adminCookie,'Content-Type':'application/json'},
    body:JSON.stringify({action:'delete_application',id:result.application_id}),
  }),env);
  assert.equal(deletion.status,200);
  assert.equal((await deletion.json()).unlinked_matches,51);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM perlawanan WHERE user_id=80 AND substr(tarikh,1,4)='2026' AND permohonan_id IS NULL").get().n,51);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM perlawanan WHERE user_id=80').get().n,allMatchesBefore);
  console.log('application submit/delete: auth/write gates, uploads, PDF mail, duplicate guard and 51 preserved matches passed');
} finally {close();}
