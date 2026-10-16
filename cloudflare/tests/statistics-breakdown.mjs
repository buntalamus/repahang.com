import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

// Statistik: per-type approved/rejected/pending, per-district tables, and the
// fitness, seminar and patch breakdown of approved annual registrations.
const {statistics}=await bundle("export {statistics} from '../src/statistics';");
const {db,DB,close}=openDatabase(['0001_worker_sessions','0019_annual_seminar_attendance']);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1'};
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const cookie=await sessionCookie(db,admin.id);
const stats=async(year)=>(await (await statistics(new Request(
  `https://staging.refpahang.example/api/statistics.php?year=${year}`,{headers:{Cookie:cookie}}),env)).json()).data;

try {
  // The 2026 fitness tests held in January 2026 were filed under 2025/2027;
  // the production data fix moves them to the registration year.
  db.prepare(`UPDATE permohonan SET tahun_permohonan=2026 WHERE jenis_borang='ujian_kecergasan'
    AND tahun_permohonan IN (2025,2027)`).run();
  const annualIds=db.prepare(`SELECT id FROM permohonan WHERE jenis_borang='pengadil_berdaftar'
    AND tahun_permohonan=2026 AND status='Approved'
    AND UPPER(TRIM(COALESCE(jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')
    ORDER BY id LIMIT 3`).all().map(row=>row.id);
  db.prepare("UPDATE permohonan SET status_seminar='Hadir' WHERE id IN (?,?)").run(annualIds[0],annualIds[1]);
  db.prepare("UPDATE permohonan SET status_seminar='Tidak Hadir' WHERE id=?").run(annualIds[2]);

  const data=await stats(2026);
  const annual=data.applications.byType.pengadil_berdaftar;
  // Penilai Pengadil and Pegawai Pembangunan registrations are counted in their own categories.
  assert.equal(annual.total,db.prepare(`SELECT COUNT(*) n FROM permohonan WHERE jenis_borang='pengadil_berdaftar'
    AND tahun_permohonan=2026 AND UPPER(TRIM(COALESCE(jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')`).get().n);
  assert.equal(annual.approved+annual.rejected+annual.pending,annual.total);

  const legacy=(result)=>db.prepare(`SELECT COUNT(*) n FROM permohonan b JOIN permohonan f
    ON f.user_id=b.user_id AND f.tahun_permohonan=2026 AND f.jenis_borang='ujian_kecergasan'
    WHERE b.jenis_borang='pengadil_berdaftar' AND b.tahun_permohonan=2026 AND b.status='Approved'
      AND UPPER(TRIM(COALESCE(b.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')
      AND f.status_ujian=?`).get(result).n;
  const fitness=data.annualRegistration.fitness;
  assert.equal(fitness.lulus,legacy('Lulus'));
  assert.equal(fitness.tidak_lulus,legacy('Tidak Lulus'));
  assert.equal(fitness.tidak_hadir,legacy('Tidak Hadir'));
  assert.equal(fitness.lulus+fitness.tidak_lulus+fitness.tidak_hadir+fitness.belum,annual.approved);
  // 87 passed in the 2026 rows plus the 54 moved from 2027.
  assert.equal(fitness.lulus,141);
  assert.equal(data.annualRegistration.patch_eligible,fitness.lulus);
  assert.deepEqual(data.annualRegistration.seminar,{hadir:2,tidak_hadir:1,belum:annual.approved-3});

  for (const [type,counts] of Object.entries(data.applications.byType)) {
    const rows=counts.byDistrict;
    const sum=(key)=>rows.reduce((total,row)=>total+row[key],0);
    assert.equal(sum('total'),counts.total,type);
    assert.equal(sum('approved'),counts.approved,type);
    assert.equal(sum('rejected'),counts.rejected,type);
    assert.equal(sum('pending'),counts.pending,type);
  }
  const districts=annual.byDistrict;
  assert.ok(districts.length>=10);
  assert.equal(districts.reduce((total,row)=>total+row.lulus_ujian,0),fitness.lulus);

  // From 2027 the result is recorded on the annual registration itself.
  db.prepare(`UPDATE permohonan SET tahun_permohonan=2027,status_ujian='Tidak Lulus' WHERE id=?`).run(annualIds[0]);
  const next=(await stats(2027)).annualRegistration;
  assert.equal(next.fitness.tidak_lulus,1);
  assert.equal(next.patch_eligible,0);
  console.log('statistics breakdown: type cards, district tables, fitness, seminar and patch counts agree');
} finally {
  close();
}
