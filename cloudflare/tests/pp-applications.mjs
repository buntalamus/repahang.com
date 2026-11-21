import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminApplications,adminApprove,adminRefereeExport,adminDashboardStats}=await bundle(`
  export {adminApplications} from '../src/applications';
  export {adminApprove} from '../src/admin-approve';
  export {adminRefereeExport} from '../src/referee-exports';
  export {adminDashboardStats} from '../src/admin-dashboard';
`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0019_annual_seminar_attendance']);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1'};
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const owner=db.prepare("SELECT id FROM users WHERE role='PP Daerah' AND aktif=1 LIMIT 1").get();
const cookie=await sessionCookie(db,admin.id);
const request=(path,auth=cookie)=>new Request(`https://refpahang.example/api/${path}`,{headers:{Cookie:auth}});
const list=async(query)=>(await (await adminApplications(request(`admin-applications.php?${query}`),env)).json());
const decide=(id,action,notes='')=>adminApprove(new Request('https://refpahang.example/api/admin-approve.php',{
  method:'POST',headers:{Cookie:cookie},body:JSON.stringify({permohonan_id:id,action,notes}),
}),env);

try {
  // Match the reported case: the saved R1/R2 type is PP, the current profile is RA.
  db.prepare("UPDATE users SET jenis_pengadil='Penilai Pengadil',email='' WHERE id=?").run(owner.id);
  db.prepare("UPDATE application_settings SET setting_value='2027' WHERE setting_key='application_year'").run();
  db.prepare('DELETE FROM permohonan WHERE tahun_permohonan=2027').run();
  const insert=db.prepare(`INSERT INTO permohonan(user_id,nama_penuh,jenis_borang,jenis_pengadil,
    tahun_permohonan,status,status_workflow,tarikh_hantar,emel,no_kp,no_telefon,jantina,
    alamat1,poskod,daerah,negeri,status_kerja,nama_waris,hubungan_waris,telefon_waris)
    VALUES (?,?,?,?,?,'Pending','Menunggu Admin','2026-11-20 16:26:34','','000101000001','','Lelaki',
      'Alamat ujian','26000','Rompin','Pahang','Bekerja','Waris ujian','Saudara','')`);
  const add=(name,form,type,year=2027)=>Number(insert.run(owner.id,name,form,type,year).lastInsertRowid);
  const legacy=add('PP R1 R2 UJIAN','pengadil_berdaftar','Pegawai Pembangunan');
  const dedicated=add('PP BERDAFTAR UJIAN','pp_berdaftar','Pegawai Pembangunan');
  const referee=add('PENGADIL UJIAN','pengadil_berdaftar','Pengadil Negeri');
  const ra=add('RA UJIAN','penilai_berdaftar','Penilai Pengadil');
  add('PP SESI LAMA UJIAN','pengadil_berdaftar','PEGAWAI PEMBANGUNAN',2026);
  const pp=await list('type=pp&year=2027');
  assert.deepEqual(pp.applications.map(row=>row.id).sort(),[legacy,dedicated].sort());
  assert.equal(Number(pp.statistics.pending),2);
  assert.equal(pp.applications.find(row=>row.id===legacy).application_category,'pegawai_pembangunan');
  assert.ok(!(await list('type=berdaftar&year=2027')).applications.some(row=>row.id===legacy));
  assert.deepEqual((await list('type=berdaftar&year=2027')).applications.map(row=>row.id),[referee]);
  assert.deepEqual((await list('type=penilai&year=2027')).applications.map(row=>row.id),[ra]);
  assert.ok((await list('status=Menunggu%20Admin')).applications.some(row=>row.id===legacy),'mobile queue preserved');
  const ownerCookie=await sessionCookie(db,owner.id);
  assert.equal((await adminApplications(request('admin-applications.php?type=pp&year=2027',ownerCookie),env)).status,403);
  assert.equal((await adminApplications(request('admin-applications.php?type=pp&year=bad'),env)).status,400);

  const dashboard=await (await adminDashboardStats(request('admin-dashboard-stats.php'),env)).json();
  assert.equal(dashboard.stats.application_years.pegawai_pembangunan,2027);
  assert.equal(dashboard.stats.applications_by_type.pegawai_pembangunan.pending,1);
  assert.equal(dashboard.stats.applications_by_type.pp_berdaftar.pending,1);
  const csv=await adminRefereeExport(request('download-referees-excel.php?type=pp&year=2027'),env);
  assert.equal(csv.status,200);
  const contents=await csv.text();
  for(const name of ['PP R1 R2 UJIAN','PP BERDAFTAR UJIAN'])assert.ok(contents.includes(name));
  for(const name of ['PENGADIL UJIAN','RA UJIAN','PP SESI LAMA UJIAN'])assert.ok(!contents.includes(name));

  assert.equal((await decide(legacy,'approve')).status,200);
  assert.deepEqual({...db.prepare('SELECT status_workflow,status_ujian FROM permohonan WHERE id=?').get(legacy)},
    {status_workflow:'Lengkap',status_ujian:null},'PP approval must not enter the referee fitness queue');
  assert.equal((await decide(dedicated,'reject','Dokumen tidak lengkap')).status,200);
  assert.equal((await list('type=pp&year=2027&status=Menunggu%20Admin')).applications.length,0);
  assert.equal(db.prepare('SELECT jenis_pengadil FROM users WHERE id=?').get(owner.id).jenis_pengadil,'Penilai Pengadil');
  console.log('PP applications: annual queue, saved type, session, Admin access, dashboard, export and both decisions passed');
} finally { close(); }
