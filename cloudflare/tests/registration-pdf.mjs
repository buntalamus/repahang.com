import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {registrationPdf}=await bundle(
  `export {registrationPdf} from '../src/registration-pdf';`
);
const {db,DB,close}=openDatabase(['0001_worker_sessions']);
function pdfText(bytes){
  assert.ok(bytes.length>100,'Original PDF has content');
  const dir=mkdtempSync(join(tmpdir(),'refpahang-pdf-text-'));
  try {const file=join(dir,'document.pdf');writeFileSync(file,bytes,{mode:0o600});return execFileSync('pdftotext',[file,'-'],{timeout:15000}).toString();}
  finally{rmSync(dir,{recursive:true,force:true});}
}
const pdf=new TextEncoder().encode('%PDF-1.7\n% test');
const captured=[];
const env={DB,STAGING_AUTH_ENABLED:'1',MEDIA:{get:async()=>null},
  ASSETS:{fetch:async()=>new Response('missing',{status:404})},
  BROWSER:{quickAction:async(action,options)=>{
    assert.equal(action,'pdf');
    assert.equal(options.cacheTTL,0);
    captured.push(options.html);
    return new Response(pdf,{headers:{'Content-Type':'application/pdf'}});
  }}};

async function call(path,ownerId=null) {
  const cookie=ownerId ? await sessionCookie(db,ownerId) : '';
  return registrationPdf(new Request(`https://refpahang.example/api/download-borang-pendaftaran.php${path}`,
    {headers:cookie?{Cookie:cookie}:{}}),env);
}

try {
  const annual=db.prepare("SELECT id,user_id,persatuan_id FROM permohonan WHERE jenis_borang='pengadil_berdaftar' AND status='Approved' AND district_id IS NULL AND persatuan_id IS NOT NULL ORDER BY id DESC LIMIT 1").get();
  const ra=db.prepare("SELECT id,user_id FROM permohonan WHERE jenis_borang='penilai_berdaftar' ORDER BY id DESC LIMIT 1").get();
  assert.equal((await call(`?type=pengadil_berdaftar&application_id=${annual.id}`)).status,401);
  const own=await call(`?type=pengadil_berdaftar&application_id=${annual.id}`,annual.user_id);
  assert.equal(own.status,200);
  assert.equal(own.headers.get('Content-Type'),'application/pdf');
  assert.match(own.headers.get('Content-Disposition'),/R1_R2_R4/);
  const ownBytes=Buffer.from(await own.arrayBuffer());
  assert.equal(ownBytes.subarray(0,5).toString(),'%PDF-');
  const ownText=pdfText(ownBytes);
  assert.match(ownText,/SENARAI PERLAWANAN/);
  assert.match(ownText,/PERAKUAN KESIHATAN/);
  assert.equal((await call(`?type=pengadil_berdaftar&application_id=${annual.id}`,ra.user_id)).status,403);
  const ppId=Number(db.prepare('SELECT MAX(id) AS id FROM users').get().id)+1;
  db.prepare(`INSERT INTO users(id,email,password,role,nama_penuh,persatuan_id,aktif,password_changed)
    VALUES(?,?,'unused','PP Daerah','PP Ujian PDF',?,1,1)`).run(ppId,'pp-pdf@example.invalid',annual.persatuan_id);
  assert.equal((await call(`?type=pengadil_berdaftar&application_id=${annual.id}`,ppId)).status,200);
  db.prepare('UPDATE users SET persatuan_id=? WHERE id=?').run(Number(annual.persatuan_id)+1,ppId);
  assert.equal((await call(`?type=pengadil_berdaftar&application_id=${annual.id}`,ppId)).status,403);
  const raPdf=await call(`?type=penilai_berdaftar&application_id=${ra.id}`,ra.user_id);
  assert.equal(raPdf.status,200);
  const raText=pdfText(Buffer.from(await raPdf.arrayBuffer()));
  assert.match(raText,/PENDAFTARAN TAHUNAN\s+PENILAI PENGADIL/);
  assert.doesNotMatch(raText,/SENARAI PERLAWANAN/);
  assert.equal((await call(`?type=penilai_berdaftar&application_id=${ra.id}&form=r4`,ra.user_id)).status,400);
  assert.equal((await call('?type=kelas3_fam',annual.user_id)).status,400);
  assert.equal((await call('?type=ujian_kelas1',annual.user_id)).status,403);

  const classOneData={...db.prepare('SELECT * FROM permohonan WHERE id=?').get(annual.id),
    jenis_borang:'ujian_kelas1_fam',tahun_permohonan:2098,nama_penuh:'NAMA CONTOH',
    emel:'contoh@example.invalid',no_kp:'990101060001'};
  delete classOneData.id;
  const columns=Object.keys(classOneData);
  const classOne=Number(db.prepare(`INSERT INTO permohonan(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`)
    .run(...Object.values(classOneData)).lastInsertRowid);
  const r11=await call(`?type=ujian_kelas1&application_id=${classOne}`,annual.user_id);
  assert.equal(r11.status,200,'Current Class I application uses its original R11');
  const r11Text=pdfText(Buffer.from(await r11.arrayBuffer()));
  assert.match(r11Text,/BOLA SEPAK KELAS I FAM/);
  assert.equal((await call(`?type=ujian_kelas1&application_id=${classOne}`,ra.user_id)).status,403);
  console.log('registration PDF route: ownership, RA R1, original TCPDF contents and binary MIME passed');
} finally { close(); }
