import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';
const api=await bundle(`export {userProfile} from '../src/self-profile';export {updateProfile} from '../src/profile-write';
 export {refereeProfile} from '../src/profile';export {refereeProfileWrite} from '../src/profile-admin-write';
 export {adminUsers} from '../src/admin-users';export {adminUsersWrite} from '../src/admin-users-write';
 export {registeredReferees} from '../src/registered-referees';
 export {setEmailSenderForTests} from '../src/php/email';export {setTelegramSenderForTests} from '../src/php/telegram';`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers','0019_annual_seminar_attendance']);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1'};
api.setEmailSenderForTests(async()=>true);api.setTelegramSenderForTests(async()=>true);
const first=Number(db.prepare('SELECT id FROM persatuan_bolasepak_daerah ORDER BY id LIMIT 1').get().id);
const other=Number(db.prepare('SELECT id FROM persatuan_bolasepak_daerah ORDER BY id LIMIT 1 OFFSET 1').get().id);
const ids={};const cookies={};
for(const [key,role,pbd] of [['admin','Admin',first],['ref','Pengadil',first],['ra','Penilai',first],['pp','PP Daerah',first],['outside','Pengadil',other]]){
 ids[key]=Number(db.prepare(`INSERT INTO users(email,password,role,nama_penuh,persatuan_id,aktif,password_changed)
 VALUES(?,'unused',?,?,?,1,1)`).run(`${key}.profile@example.invalid`,role,`QA PROFILE ${key}`,pbd).lastInsertRowid);
 cookies[key]=await sessionCookie(db,ids[key]);
}
const request=(key,path,body,method='POST')=>new Request('https://audit.example/api/'+path,{method:body?method:'GET',headers:{Cookie:cookies[key]},...(body?{body:JSON.stringify(body)}:{})});
const read=async(key='ref')=>(await(await api.userProfile(request(key,'get-user-profile.php'),env)).json()).user;
const body=key=>({nama_penuh:`QA PROFILE ${key}`,email:`${key}.profile@example.invalid`,no_ic:'000101060001',no_telefon:'0100000000',jantina:'Lelaki',umur:26,
 alamat1:'Ujian 1',alamat2:'Ujian 2',poskod:'25000',daerah:'Kuantan',negeri:'Pahang',status_kerja:'Bekerja (Swasta)',jawatan:'Pegawai',nama_majikan:'Majikan Ujian',
 alamat_majikan1:'Pejabat 1',alamat_majikan2:'Pejabat 2',poskod_majikan:'26000',daerah_majikan:'Pekan',negeri_majikan:'Pahang',
 nama_waris:'Waris Ujian',hubungan_waris:'Bapa',telefon_waris:'0100000001',saiz_baju:'L',jenis_penilai:'Penilai Negeri',
 tahun_mula_aktif:2001,tahun_mohon_kelas3:2002,tahun_lulus_kelas3:2003,tahun_mohon_kelas1:2008,tahun_lulus_kelas1:2009});
try{
 const applicationsBefore=db.prepare('SELECT COUNT(*) n FROM permohonan').get().n;
 for(const key of ['ref','ra','pp','admin']){
  const payload=body(key);const saved=await api.updateProfile(request(key,'update-profile.php',payload),env);
  assert.equal(saved.status,200,JSON.stringify(await saved.clone().json()));
  const self=await read(key);
  const global=(await(await api.refereeProfile(request('admin',`profil-pengadil.php?id=${ids[key]}`),env)).json()).profil;
  const admin=(await(await api.adminUsers(request('admin',`admin-users.php?id=${ids[key]}`),env)).json()).user;
  for(const field of Object.keys(payload))for(const row of [self,global,admin])assert.equal(String(row[field]),String(payload[field]),field+' round trip');
 }
 // Partial Admin edits preserve omitted profile/photo/year data.
 db.prepare("UPDATE users SET url_gambar_profil='/uploads/fixture.png' WHERE id=?").run(ids.ref);
 const partial=await api.adminUsersWrite(request('admin','admin-users.php',{userId:ids.ref,nama_penuh:'QA PROFILE ref',email:'ref.profile@example.invalid',user_role:'Pengadil',persatuan_id:first,alamat_majikan2:'Pejabat baharu'},'PUT'),env);
 assert.equal(partial.status,200,JSON.stringify(await partial.clone().json()));
 let profile=await read();assert.equal(profile.tahun_lulus_kelas1,'2009');assert.equal(profile.alamat1,'Ujian 1');assert.equal(profile.url_gambar_profil,'/uploads/fixture.png');assert.equal(profile.alamat_majikan2,'Pejabat baharu');
 // PP can edit full profile within their district, including employer address and years.
 const ppEdit=await api.refereeProfileWrite(request('pp','profil-pengadil.php',{id:ids.ref,alamat_majikan1:'PP Pejabat',tahun_mohon_kelas1:'2010',tahun_lulus_kelas1:2011},'PUT'),env);
 assert.equal(ppEdit.status,200);profile=await read();assert.equal(profile.alamat_majikan1,'PP Pejabat');assert.equal(profile.tahun_lulus_kelas1,'2011');
 assert.equal((await api.refereeProfileWrite(request('pp','profil-pengadil.php',{id:ids.outside,saiz_baju:'XL'},'PUT'),env)).status,403);
 assert.equal((await api.refereeProfileWrite(request('pp','profil-pengadil.php',{id:ids.ref,persatuan_id:other},'PUT'),env)).status,403);
 assert.equal((await api.updateProfile(request('pp','update-profile.php',{...body('pp'),persatuan_id:other}),env)).status,403);
 db.prepare("UPDATE users SET tahun_mula_aktif='0000' WHERE id=?").run(ids.outside);
 assert.equal((await read('outside')).tahun_mula_aktif,null,'legacy zero year is empty, not an invalid required year');
 const before=await read();
 for(const changes of [{tahun_mula_aktif:2001.5},{tahun_mohon_kelas1:'abc'},{tahun_lulus_kelas1:2099},{tahun_mohon_kelas3:2020,tahun_lulus_kelas3:2019},{tahun_lulus_kelas1:1999}]){
  assert.equal((await api.updateProfile(request('ref','update-profile.php',{...body('ref'),...changes}),env)).status,400);
  assert.deepEqual(await read(),before,'invalid input cannot partially write');
 }
 // Self-service cannot alter roles, account status or assignment grades.
 assert.equal((await api.updateProfile(request('ref','update-profile.php',{...body('ref'),role:'Admin',aktif:0,pengadil_kebangsaan:1}),env)).status,200);
 assert.deepEqual({...db.prepare('SELECT role,aktif,pengadil_kebangsaan FROM users WHERE id=?').get(ids.ref)},{role:'Pengadil',aktif:1,pengadil_kebangsaan:0});
 const unrelated=(await(await api.refereeProfile(request('outside',`profil-pengadil.php?id=${ids.ref}`),env)).json()).profil;
 for(const field of ['no_ic','email','alamat1','alamat_majikan1','alamat_majikan2','poskod_majikan','telefon_waris'])assert.equal(Object.hasOwn(unrelated,field),false,field+' privacy');
 // Recorded application history only infers pass years from actual Lulus outcomes.
 const snapshot=db.prepare('SELECT * FROM permohonan LIMIT 1').get();delete snapshot.id;
 function app(type,result,year){const row={...snapshot,user_id:ids.outside,jenis_borang:type,status:'Approved',status_workflow:'Lengkap',status_ujian:result,tahun_permohonan:year};const keys=Object.keys(row);db.prepare(`INSERT INTO permohonan(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(row));}
 app('kelas3_fam','Tidak Lulus',2018);app('ujian_bertulis','Lulus',2019);app('ujian_kelas1_fam','Lulus',2022);
 const inferred=await read('outside');assert.equal(Number(inferred.tahun_mohon_kelas3),2018);assert.equal(Number(inferred.tahun_lulus_kelas3),2019);assert.equal(Number(inferred.tahun_lulus_kelas1),2022);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM permohonan').get().n,applicationsBefore+3,'profile updates never create or approve exams');
 const cleared=await api.refereeProfileWrite(request('admin','profil-pengadil.php',{id:ids.ref,tahun_mohon_kelas1:'',tahun_lulus_kelas1:null},'PUT'),env);assert.equal(cleared.status,200);
 assert.equal((await read()).tahun_lulus_kelas1,null);
 console.log('Profile completeness: four roles, all fields round trip, partial data preservation, number/year validation, history fallback, blank years, district permissions, private addresses and unchanged examination outcomes passed');
}finally{api.setEmailSenderForTests(null);api.setTelegramSenderForTests(null);close();}
