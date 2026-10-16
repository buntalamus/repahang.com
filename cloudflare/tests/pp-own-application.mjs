import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie,testPng} from './_harness.mjs';

// A PP Daerah's own application skips district verification and goes straight
// to Admin; no PP Daerah may verify their own application.
const {submitRefereeApplication,ppVerify}=await bundle(
  "export {submitRefereeApplication} from '../src/application-submit'; export {ppVerify} from '../src/pp-verify';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0011_application_uniqueness']);
const objects=new Map();
const emails=[];
const pdf=new TextEncoder().encode('%PDF-1.7\n% test');
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  BASE_URL:'https://staging.refpahang.example',
  MAIL_DAFTAR_USER:'daftar@refpahang.example',MAIL_DAFTAR_NAME:'PBNP',
  MAIL_ADMIN_USER:'admin@refpahang.example',MAIL_ADMIN_NAME:'PBNP',
  EMAIL:{send:async message=>{emails.push(message);return {messageId:'test'};}},
  MEDIA:{put:async(key,bytes,options)=>objects.set(key,{bytes,options}),
    get:async key=>objects.has(key)?{
      httpMetadata:{contentType:objects.get(key).options.httpMetadata.contentType},
      arrayBuffer:async()=>objects.get(key).bytes.buffer,
    }:null,delete:async key=>objects.delete(key)},
  ASSETS:{fetch:async()=>new Response('missing',{status:404})},
  BROWSER:{quickAction:async()=>new Response(pdf,{headers:{'Content-Type':'application/pdf'}})},
};
const url='https://staging.refpahang.example/api/';
const district=3;
const [applicant,otherPp]=[436,235];
for (const id of [applicant,otherPp]) {
  const user=db.prepare("SELECT role,aktif,COALESCE(NULLIF(persatuan_id,0),district_id) AS district FROM users WHERE id=?").get(id);
  assert.deepEqual({...user},{role:'PP Daerah',aktif:1,district});
}
const applicantCookie=await sessionCookie(db,applicant);
const otherCookie=await sessionCookie(db,otherPp);
const setting=(key,value)=>db.prepare(`INSERT INTO application_settings(setting_key,setting_value) VALUES(?,?)
  ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`).run(key,value);
const verify=(cookie,id,action='approve')=>ppVerify(new Request(url+'pp-verify.php',{method:'POST',
  headers:{Cookie:cookie,'Content-Type':'application/json'},
  body:JSON.stringify({permohonan_id:id,action,notes:action==='reject'?'Tidak lengkap':''})}),env);
const workflow=(id)=>db.prepare('SELECT status_workflow FROM permohonan WHERE id=?').get(id).status_workflow;

try {
  setting('application_year','2027');
  setting('penilai_open','1');
  setting('penilai_open_date','');
  setting('penilai_close_date','');
  const picture=testPng();
  const data=new FormData();
  data.set('jenis_borang','penilai_berdaftar');
  data.set('nama_waris','Waris Ujian');
  data.set('hubungan_waris','Keluarga');
  data.set('telefon_waris','0123456789');
  data.set('saiz_baju','M');
  data.set('resit',new File([picture],'resit.png',{type:'image/png'}));
  data.set('gambar',new File([picture],'gambar.png',{type:'image/png'}));
  const response=await submitRefereeApplication(new Request(url+'pengadil-application.php',{method:'POST',
    headers:{Cookie:applicantCookie},body:data}),env);
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(workflow(body.application_id),'Menunggu Admin');
  assert.match(emails.at(-1).text,/Status: Menunggu Kelulusan Admin/);

  // An own application still waiting at district level (filed before this
  // rule) cannot be verified by its applicant, only by another PP Daerah.
  db.prepare("UPDATE permohonan SET status_workflow='Menunggu PP Daerah',persatuan_id=? WHERE id=?")
    .run(district,body.application_id);
  let result=await verify(applicantCookie,body.application_id);
  assert.equal(result.status,404);
  assert.equal(workflow(body.application_id),'Menunggu PP Daerah');
  result=await verify(otherCookie,body.application_id);
  assert.equal(result.status,200);
  assert.equal(workflow(body.application_id),'Menunggu Admin');

  // Referee applications in the district are verified by the PP Daerah as before.
  const referee=db.prepare(`SELECT p.id FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.persatuan_id=? AND u.role='Pengadil' AND p.jenis_borang='pengadil_berdaftar' LIMIT 1`).get(district);
  db.prepare("UPDATE permohonan SET status_workflow='Menunggu PP Daerah' WHERE id=?").run(referee.id);
  result=await verify(applicantCookie,referee.id);
  assert.equal(result.status,200);
  assert.equal(workflow(referee.id),'Menunggu Admin');

  console.log('pp own application: goes straight to Admin; self-verification refused; district verification unchanged');
} finally {
  close();
}
