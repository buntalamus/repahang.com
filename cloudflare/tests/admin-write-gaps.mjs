import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminUsersWrite,announcementsWrite,refereeProfileWrite}=await bundle(`
  export {adminUsersWrite} from '../src/admin-users-write';
  export {announcementsWrite} from '../src/announcements-write';
  export {refereeProfileWrite} from '../src/profile-admin-write';
`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0009_mysql_on_update_triggers']);
const sent=[];
const env={DB,BASE_URL:'https://refpahang.com',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  MAIL_ADMIN_USER:'admin@refpahang.com',MAIL_ADMIN_NAME:'Admin RefPahang',
  EMAIL:{send:async(message)=>{sent.push(message);return {messageId:'ok'};}}};
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const pp=db.prepare("SELECT id,persatuan_id FROM users WHERE role='PP Daerah' AND aktif=1 AND persatuan_id>0 LIMIT 1").get();
const local=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND persatuan_id=? LIMIT 1").get(pp.persatuan_id);
const remote=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND persatuan_id<>? LIMIT 1").get(pp.persatuan_id);
const adminCookie=await sessionCookie(db,admin.id);
const ppCookie=await sessionCookie(db,pp.id);
const base='https://refpahang.com/api/';
const call=(fn,file,method,cookie,body,search='')=>{
  const init={method,headers:{Cookie:cookie}};
  if (body instanceof FormData) init.body=body;
  else if (body!==undefined) init.body=JSON.stringify(body);
  return fn(new Request(base+file+search,init),env);
};
const users=(m,b,s,c=adminCookie)=>call(adminUsersWrite,'admin-users.php',m,c,b,s);
const notes=(m,b,s,c=adminCookie)=>call(announcementsWrite,'announcements.php',m,c,b,s);
const profile=(b,c=adminCookie)=>call(refereeProfileWrite,'profil-pengadil.php','PUT',c,b);
const read=async(response)=>({status:response.status,...(await response.json())});
const form=(fields)=>{const f=new FormData();for (const [k,v] of Object.entries(fields)) f.append(k,v);return f;};

try {
  // POST create (multipart, like the Angular page).
  let r=await read(await users('POST',form({nama_penuh:' ujian baharu ',email:'ujian.baharu@example.invalid',
    no_telefon:'0123',user_role:'Pengadil',persatuan_id:String(pp.persatuan_id),jenis_pengadil:'pengadil daerah'})));
  assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(r.generatedPassword.length,10);
  const created=db.prepare("SELECT * FROM users WHERE email='ujian.baharu@example.invalid'").get();
  assert.deepEqual([created.nama_penuh,created.role,created.jenis_pengadil,created.aktif,created.password_changed],
    ['UJIAN BAHARU','Pengadil','PENGADIL DAERAH',1,0]);
  assert.ok(bcrypt.compareSync(r.generatedPassword,created.password));
  r=await read(await users('POST',form({nama_penuh:'X',email:'UJIAN.BAHARU@example.invalid',user_role:'Pengadil',persatuan_id:'1'})));
  assert.deepEqual([r.status,r.message],[400,'Email sudah wujud.']);
  r=await read(await users('POST',form({nama_penuh:'X',email:'y@example.invalid',user_role:'Pengadil'})));
  assert.deepEqual([r.status,r.message],[400,'FA diperlukan untuk peranan ini.']);
  r=await read(await users('POST',form({nama_penuh:'X',email:'y@example.invalid',user_role:'Bos'})));
  assert.deepEqual([r.status,r.message],[400,'Peranan tidak sah.']);
  assert.equal((await users('POST',form({nama_penuh:'X',email:'z@example.invalid',user_role:'Admin'}),'',ppCookie)).status,403);

  // PUT update writes the record and refuses another user's email.
  r=await read(await users('PUT',{userId:created.id,nama_penuh:'UJIAN DIKEMASKINI',email:created.email,
    user_role:'Pengadil',persatuan_id:pp.persatuan_id,no_telefon:'0199',url_gambar_profil:'/uploads/x.jpg'}));
  assert.equal(r.status,200,JSON.stringify(r));
  const updated={...db.prepare('SELECT nama_penuh,no_telefon,url_gambar_profil FROM users WHERE id=?').get(created.id)};
  assert.deepEqual(updated,{nama_penuh:'UJIAN DIKEMASKINI',no_telefon:'0199',url_gambar_profil:'/uploads/x.jpg'});
  const otherEmail=db.prepare('SELECT email FROM users WHERE id=?').get(local.id).email;
  r=await read(await users('PUT',{userId:created.id,nama_penuh:'A',email:otherEmail,user_role:'Pengadil',persatuan_id:1}));
  assert.deepEqual([r.status,r.message],[400,'Email sudah digunakan oleh pengguna lain.']);

  // PATCH resets to PHP's fixed password and sends the PHP reset email.
  r=await read(await users('PATCH',{userId:created.id,action:'reset_password'}));
  assert.equal(r.message,'Kata laluan berjaya direset kepada 12345678. Emel telah dihantar kepada pengguna.');
  assert.ok(bcrypt.compareSync('12345678',db.prepare('SELECT password FROM users WHERE id=?').get(created.id).password));
  assert.equal(sent.at(-1).subject,'Reset Kata Laluan - Sistem Pengurusan Pengadil PBNP');
  assert.equal(sent.at(-1).to.email,'ujian.baharu@example.invalid');
  assert.match(sent.at(-1).html,/12345678/);
  r=await read(await users('PATCH',{userId:created.id,action:'resend_notification'}));
  assert.equal(r.message,'Emel notifikasi pendaftaran berjaya dihantar semula.');
  assert.equal((await users('PATCH',{userId:created.id,action:'lain'})).status,400);

  // DELETE deactivates (owner decision) and keeps history; own account refused.
  const matches=db.prepare('SELECT count(*) AS n FROM perlawanan WHERE user_id=?').get(local.id).n;
  r=await read(await users('DELETE',undefined,`?id=${local.id}`));
  assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(db.prepare('SELECT aktif FROM users WHERE id=?').get(local.id).aktif,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM perlawanan WHERE user_id=?').get(local.id).n,matches);
  r=await read(await users('DELETE',undefined,`?id=${admin.id}`));
  assert.deepEqual([r.status,r.message],[400,'Anda tidak boleh menandakan akaun sendiri sebagai Tidak Aktif.']);
  assert.equal((await users('DELETE',undefined,'?id=99999999')).status,404);
  db.prepare('UPDATE users SET aktif=1 WHERE id=?').run(local.id);

  // Announcements: create, edit, PHP's unchanged-edit 404, delete.
  r=await read(await notes('POST',{title:'Ujian',content:'Isi'}));
  assert.equal(r.status,200,JSON.stringify(r));
  const id=r.id;
  assert.equal((await read(await notes('PUT',{title:'Ujian 2',content:'Isi'},`?id=${id}`))).status,200);
  assert.equal((await read(await notes('PUT',{title:'Ujian 2',content:'Isi'},`?id=${id}`))).status,404);
  assert.equal((await read(await notes('PUT',{title:'UJIAN 2',content:'Isi'},`?id=${id}`))).status,200);
  assert.equal(db.prepare('SELECT title FROM announcements WHERE id=?').get(id).title,'UJIAN 2');
  r=await read(await notes('POST',{title:'',content:'x'}));
  assert.deepEqual([r.status,r.message],[400,'Tajuk dan kandungan diperlukan']);
  r=await read(await notes('DELETE',undefined,`?id=${id}`,ppCookie));
  assert.deepEqual([r.status,r.message],[403,'Hanya admin boleh memadam pengumuman']);
  assert.equal((await notes('DELETE',undefined,`?id=${id}`)).status,200);
  assert.equal((await notes('DELETE',undefined,`?id=${id}`)).status,404);

  // Profile PUT: PP Daerah limited to its district and cannot change persatuan/aktif.
  r=await read(await profile({id:remote.id,no_telefon:'0111'},ppCookie));
  assert.deepEqual([r.status,r.message],[403,'Anda hanya boleh kemaskini pengadil di bawah pentadbiran daerah anda.']);
  r=await read(await profile({id:local.id,no_telefon:' 0222 ',saiz_baju:'',persatuan_id:999,aktif:0},ppCookie));
  assert.equal(r.status,403,JSON.stringify(r));
  r=await read(await profile({id:local.id,no_telefon:' 0222 ',saiz_baju:'',aktif:0},ppCookie));
  assert.equal(r.status,200,JSON.stringify(r));
  const row={...db.prepare('SELECT no_telefon,saiz_baju,persatuan_id,aktif FROM users WHERE id=?').get(local.id)};
  assert.deepEqual(row,{no_telefon:'0222',saiz_baju:'',persatuan_id:pp.persatuan_id,aktif:1});
  r=await read(await profile({id:local.id,aktif:'0',tahun_mula_aktif:'2019abc'}));
  assert.equal(r.status,400,'Invalid year must not partly change account status');
  r=await read(await profile({id:local.id,aktif:'0',tahun_mula_aktif:'2019'}));
  assert.equal(r.status,200,JSON.stringify(r));
  assert.deepEqual({...db.prepare('SELECT aktif,tahun_mula_aktif FROM users WHERE id=?').get(local.id)},{aktif:0,tahun_mula_aktif:'2019'});
  r=await read(await profile({id:local.id,tidak_dibenarkan:'x'}));
  assert.deepEqual([r.status,r.message],[400,'Tiada perubahan untuk disimpan.']);
  console.log('admin write gaps: users create/update/reset/deactivate, announcements CRUD, profile PUT passed');
} finally {
  close();
}
