import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {registrationPdf,renderRegistrationHtml}=await bundle(
  `export {registrationPdf,renderRegistrationHtml} from '../src/registration-pdf';`
);
const {db,DB,close}=openDatabase(['0001_worker_sessions']);
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
  const annual=db.prepare("SELECT id,user_id FROM permohonan WHERE jenis_borang='pengadil_berdaftar' ORDER BY id DESC LIMIT 1").get();
  const ra=db.prepare("SELECT id,user_id FROM permohonan WHERE jenis_borang='penilai_berdaftar' ORDER BY id DESC LIMIT 1").get();
  assert.equal((await call(`?type=pengadil_berdaftar&application_id=${annual.id}`)).status,401);
  const own=await call(`?type=pengadil_berdaftar&application_id=${annual.id}`,annual.user_id);
  assert.equal(own.status,200);
  assert.equal(own.headers.get('Content-Type'),'application/pdf');
  assert.match(own.headers.get('Content-Disposition'),/R1_R2_R4/);
  assert.deepEqual(new Uint8Array(await own.arrayBuffer()),pdf);
  assert.match(captured.at(-1),/SENARAI PERLAWANAN/);
  assert.match(captured.at(-1),/PERAKUAN KESIHATAN/);
  assert.equal((await call(`?type=pengadil_berdaftar&application_id=${annual.id}`,ra.user_id)).status,403);
  const raPdf=await call(`?type=penilai_berdaftar&application_id=${ra.id}`,ra.user_id);
  assert.equal(raPdf.status,200);
  assert.match(captured.at(-1),/PENDAFTARAN TAHUNAN<br>PENILAI PENGADIL/);
  assert.doesNotMatch(captured.at(-1),/SENARAI PERLAWANAN/);
  assert.equal((await call(`?type=penilai_berdaftar&application_id=${ra.id}&form=r4`,ra.user_id)).status,400);
  assert.equal((await call('?type=kelas3_fam',annual.user_id)).status,400);
  assert.equal((await call('?type=ujian_kelas1',annual.user_id)).status,403);

  const synthetic={id:9001,tahun_permohonan:2027,nama_penuh:'CONTOH NAMA PANJANG',no_kp:'000000000000',
    emel:'contoh@example.test',alamat1:'NO. 123 JALAN YANG PANJANG DENGAN NAMA TAMAN YANG PANJANG',
    alamat2:'BLOK DAN UNIT YANG JUGA PANJANG',poskod:'25000',daerah:'KUANTAN',negeri:'PAHANG',
    alamat_majikan1:'PEJABAT DI JALAN YANG PANJANG',nama_waris:'CONTOH WARIS'};
  const matches=Array.from({length:51},(_,i)=>({tarikh:`2026-01-${String(i%28+1).padStart(2,'0')}`,
    jenis:`KEJOHANAN CONTOH ${i} DENGAN NAMA PERLAWANAN YANG SANGAT PANJANG`,
    tempat:'PADANG CONTOH',jawatan:i%2?'PENGADIL':'PENOLONG PENGADIL 1'}));
  const html=renderRegistrationHtml(synthetic,'pengadil_berdaftar',null,matches);
  assert.equal((html.match(/<tbody>/g)||[]).length,1);
  assert.equal((html.match(/<tr><td>/g)||[]).length,51);
  assert.match(html,/Jumlah Perlawanan: 51/);
  assert.match(html,/NO\. 123 JALAN YANG PANJANG/);
  assert.match(html,/overflow-wrap:anywhere/);
  assert.match(html,/break-inside:avoid/);
  console.log('registration PDF route: ownership, RA R1, binary MIME and dynamic 51-match layout passed');
} finally { close(); }
