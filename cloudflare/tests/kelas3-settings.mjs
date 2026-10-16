import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

// Kelas III FAM and Ujian Kelas I FAM follow the Admin Settings page: the
// Kelas III switch (bertulis_open), its age range and each form's own fee.
const {submitRefereeApplication,applicationSettings}=await bundle(
  "export {submitRefereeApplication} from '../src/application-submit'; export {applicationSettings} from '../src/applications';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0011_application_uniqueness']);
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
const userId=80;
const cookie=await sessionCookie(db,userId);
const setting=(key,value)=>db.prepare(`INSERT INTO application_settings(setting_key,setting_value) VALUES(?,?)
  ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`).run(key,value);
function form(type) {
  const data=new FormData();
  data.set('jenis_borang',type);
  data.set('nama_waris','Waris Ujian');
  data.set('hubungan_waris','Keluarga');
  data.set('telefon_waris','0123456789');
  data.set('resit',new File([png],'resit.png',{type:'image/png'}));
  return data;
}
const post=(type)=>submitRefereeApplication(new Request('https://staging.refpahang.example/api/pengadil-application.php',{
  method:'POST',headers:{Cookie:cookie},body:form(type)}),env);
const saved=(type)=>db.prepare(`SELECT payment_amount FROM permohonan
  WHERE user_id=? AND jenis_borang=? AND tahun_permohonan=2027`).get(userId,type);

try {
  // These tests are about other rules; the snapshot's past open/close dates would close the forms.
  db.prepare(`UPDATE application_settings SET setting_value='' WHERE setting_key LIKE '%\\_open\\_date' ESCAPE '\\'
    OR setting_key LIKE '%\\_close\\_date' ESCAPE '\\'`).run();
  for (const [key,value] of Object.entries({application_year:'2027',bertulis_open:'0',
    bertulis_min_age:'15',bertulis_max_age:'30',bertulis_fee:'180',kelas1_open:'0',kelas1_fee:'300.00'})) {
    setting(key,value);
  }
  // A stale kelas3_open key must not open the form; only the Settings switch does.
  setting('kelas3_open','1');
  let response=await post('kelas3_fam');
  assert.equal(response.status,400);
  assert.match((await response.json()).message,/Kelas III FAM tidak dibuka/);

  setting('bertulis_open','1');
  const settings=(await (await applicationSettings(new Request('https://staging.refpahang.example/api/application-settings.php',
    {headers:{Cookie:cookie}}),env)).json()).settings;
  assert.equal(settings.bertulis_open,'1');
  assert.equal(settings.bertulis_fee,'180');
  assert.equal(settings.bertulis_max_age,'30');

  // Born 1996: 31 in 2027, above the Settings maximum of 30 (the old code allowed up to 40).
  db.prepare("UPDATE users SET no_ic='960101061234' WHERE id=?").run(userId);
  response=await post('kelas3_fam');
  assert.equal(response.status,400);
  assert.match((await response.json()).message,/antara 15 hingga 30 tahun pada tahun 2027/);

  setting('bertulis_fee','');
  db.prepare("UPDATE users SET no_ic='070101061234' WHERE id=?").run(userId);
  response=await post('kelas3_fam');
  assert.equal(response.status,500);
  assert.match((await response.json()).message,/Tetapan yuran/);
  setting('bertulis_fee','180');

  // Born 2007: 20 in 2027. The Kelas III fee, not the annual RM80, is recorded and emailed.
  response=await post('kelas3_fam');
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  assert.equal(saved('kelas3_fam').payment_amount,'180.00');
  assert.match(emails.at(-1).text,/Yuran permohonan: RM 180\.00/);

  setting('kelas1_open','1');
  db.prepare("UPDATE users SET tahun_lulus_kelas3='2020' WHERE id=?").run(userId);
  response=await post('ujian_kelas1_fam');
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  assert.equal(saved('ujian_kelas1_fam').payment_amount,'300.00');
  assert.match(emails.at(-1).text,/Yuran permohonan: RM 300\.00/);
  console.log('kelas3 settings: open switch, age range and per-form fee follow Admin Settings');
} finally {
  close();
}
