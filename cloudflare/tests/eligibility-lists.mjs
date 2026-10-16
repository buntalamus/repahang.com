import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie,testPng} from './_harness.mjs';

// Statistik eligibility lists use the submission's own rules: whoever is listed
// passes the eligibility checks when applying, and whoever is not is refused.
const {eligibilityLists,submitRefereeApplication,statistics}=await bundle(
  "export {eligibilityLists} from '../src/application-eligibility';"
  +" export {submitRefereeApplication} from '../src/application-submit';"
  +" export {statistics} from '../src/statistics';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0011_application_uniqueness','0019_annual_seminar_attendance']);
const pdf=new TextEncoder().encode('%PDF-1.7\n% test');
const objects=new Map();
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',BASE_URL:'https://staging.refpahang.example',
  MAIL_DAFTAR_USER:'daftar@refpahang.example',MAIL_DAFTAR_NAME:'PBNP',
  EMAIL:{send:async()=>({messageId:'test'})},
  MEDIA:{put:async(key,bytes,options)=>objects.set(key,{bytes,options}),
    get:async key=>objects.has(key)?{httpMetadata:{contentType:objects.get(key).options.httpMetadata.contentType},
      arrayBuffer:async()=>objects.get(key).bytes.buffer}:null,delete:async key=>objects.delete(key)},
  ASSETS:{fetch:async()=>new Response('missing',{status:404})},
  BROWSER:{quickAction:async()=>new Response(pdf,{headers:{'Content-Type':'application/pdf'}})}};
const setting=(key,value)=>db.prepare(`INSERT INTO application_settings(setting_key,setting_value) VALUES(?,?)
  ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`).run(key,value);
const picture=testPng();
async function apply(userId,type) {
  const data=new FormData();
  data.set('jenis_borang',type);
  data.set('nama_waris','Waris Ujian');data.set('hubungan_waris','Keluarga');
  data.set('telefon_waris','0123456789');data.set('saiz_baju','M');
  data.set('resit',new File([picture],'resit.png',{type:'image/png'}));
  data.set('gambar',new File([picture],'gambar.png',{type:'image/png'}));
  const response=await submitRefereeApplication(new Request('https://staging.refpahang.example/api/pengadil-application.php',
    {method:'POST',headers:{Cookie:await sessionCookie(db,userId)},body:data}),env);
  return {status:response.status,...await response.json()};
}
const ids=(list)=>new Set(list.map(item=>item.id));
const icFor=(age)=>`${String((2027-age)%100).padStart(2,'0')}0101061234`;

try {
  db.prepare(`UPDATE application_settings SET setting_value='' WHERE setting_key LIKE '%\\_open\\_date' ESCAPE '\\'
    OR setting_key LIKE '%\\_close\\_date' ESCAPE '\\'`).run();
  for (const [key,value] of Object.entries({application_year:'2027',berdaftar_open:'1',bertulis_open:'1',kelas1_open:'1',
    min_verified_matches:'20',bertulis_min_age:'15',bertulis_max_age:'30',kelas1_max_age:'32'})) setting(key,value);
  let lists=await eligibilityLists(env);
  assert.equal(lists.year,2027);
  assert.equal(lists.rules.match_year,2026);
  assert.ok(lists.berdaftar.length>0);
  assert.ok(lists.berdaftar.every(item=>item.perlawanan>=20 || db.prepare('SELECT role FROM users WHERE id=?').get(item.id).role==='PP Daerah'));

  // Annual registration: a listed referee passes the match check; an unlisted one is refused for it.
  const listed=lists.berdaftar.find(item=>item.profil_lengkap && !item.permohonan
    && db.prepare('SELECT role FROM users WHERE id=?').get(item.id).role==='Pengadil');
  let result=await apply(listed.id,'pengadil_berdaftar');
  assert.equal(result.status,200,result.message);
  lists=await eligibilityLists(env);
  assert.equal(lists.berdaftar.find(item=>item.id===listed.id).permohonan,'Menunggu PP Daerah');
  const unlisted=db.prepare(`SELECT u.id FROM users u WHERE u.role='Pengadil' AND u.aktif=1
    AND COALESCE(u.jenis_pengadil,'') NOT IN ('Penilai Pengadil','Pegawai Pembangunan')
    AND (SELECT COUNT(*) FROM perlawanan m WHERE m.user_id=u.id AND m.status_pp='Disahkan' AND substr(m.tarikh,1,4)='2026')<20
    AND NOT EXISTS (SELECT 1 FROM permohonan p WHERE p.user_id=u.id AND p.tahun_permohonan=2027) LIMIT 1`).get();
  assert.ok(!ids(lists.berdaftar).has(unlisted.id));
  result=await apply(unlisted.id,'pengadil_berdaftar');
  assert.equal(result.status,400);
  if (!result.missing_fields) assert.match(result.message,/Minimum 20 perlawanan/);

  // Kelas III FAM: the age range from Settings decides; a Kelas III holder is not listed.
  const young=db.prepare(`SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND jenis_pengadil='Pengadil Negeri'
    AND (tahun_lulus_kelas3 IS NULL OR tahun_lulus_kelas3='') AND id<>? LIMIT 2`).all(unlisted.id).map(row=>row.id);
  db.prepare('UPDATE users SET no_ic=? WHERE id=?').run(icFor(20),young[0]);
  db.prepare('UPDATE users SET no_ic=? WHERE id=?').run(icFor(31),young[1]);
  lists=await eligibilityLists(env);
  assert.ok(ids(lists.kelas3).has(young[0]));
  assert.ok(!ids(lists.kelas3).has(young[1]));
  assert.equal((await apply(young[0],'kelas3_fam')).status,200);
  assert.match((await apply(young[1],'kelas3_fam')).message,/antara 15 hingga 30 tahun/);
  const holder=db.prepare("SELECT id FROM users WHERE jenis_pengadil='Kelas III FAM' AND aktif=1 LIMIT 1").get();
  assert.ok(!ids(lists.kelas3).has(holder.id));

  // Ujian Kelas I FAM: Kelas III held by 2025 (two years before 2027) and age within the limit.
  db.prepare("UPDATE users SET tahun_lulus_kelas3='2024',no_ic=? WHERE id=?").run(icFor(28),young[1]);
  db.prepare("UPDATE users SET tahun_lulus_kelas3='2026' WHERE id=?").run(young[0]);
  lists=await eligibilityLists(env);
  assert.deepEqual(lists.kelas1.find(item=>item.id===young[1])?.tahun_lulus_kelas3,2024);
  assert.ok(!ids(lists.kelas1).has(young[0]));
  assert.equal((await apply(young[1],'ujian_kelas1_fam')).status,200);
  assert.match((await apply(young[0],'ujian_kelas1_fam')).message,/pada tahun 2025 atau sebelumnya/);
  assert.ok(lists.kelas1_missing_kelas3_year>0);

  // Statistik returns the lists for the application year whatever year is browsed.
  const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
  const data=(await (await statistics(new Request('https://staging.refpahang.example/api/statistics.php?year=2025',
    {headers:{Cookie:await sessionCookie(db,admin.id)}}),env)).json()).data;
  assert.equal(data.kelayakan.year,2027);
  console.log('eligibility lists: berdaftar, Kelas III and Kelas I lists match the submission rules');
} finally {
  close();
}
