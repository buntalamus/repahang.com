import assert from 'node:assert/strict';
import { bundle, openDatabase, sessionCookie } from './_harness.mjs';
const { registeredReferees, adminRefereeExport, filterReferees, refereeExamResult, refereeQualification } = await bundle(`
 export { registeredReferees } from '../src/registered-referees';
 export { adminRefereeExport } from '../src/referee-exports';
 export { filterReferees, refereeExamResult, refereeQualification } from '../../shared/referee-filters';`);
const { db, DB, close } = openDatabase(['0001_worker_sessions', '0019_annual_seminar_attendance']);
const year = new Date().getFullYear();
const insert = (sql, ...values) => Number(db.prepare(sql).run(...values).lastInsertRowid);
const env = { DB, STAGING_AUTH_ENABLED: '1' };
const admin = db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const cookie = await sessionCookie(db, admin.id);
const get = params => new Request(`https://refpahang.example/api/referees.php?year=${year}&q=FILTER%20QA&${params}`, { headers: { Cookie: cookie } });
const all = { q: '', gender: 'all', qualification: 'all', annual: 'all', class3: 'all', class1: 'all' };
const app = (id, type, result, appYear = year) => insert(`INSERT INTO permohonan(user_id,nama_penuh,no_kp,emel,no_telefon,jantina,alamat1,poskod,daerah,negeri,status_kerja,nama_waris,hubungan_waris,telefon_waris,jenis_borang,tahun_permohonan,status,status_ujian,jenis_pengadil)
 VALUES(?,'FILTER QA','000101060001','fixture@example.invalid','0100000000','Lelaki','Ujian','25000','Kuantan','Pahang','Lain','Ujian','Bapa','0100000000',?,?,'Approved',?,'Pengadil Negeri')`, id, type, appYear, result);
const user = (name, gender = 'LELAKI') => {
 const id = insert(`INSERT INTO users(email,password,role,nama_penuh,jantina,aktif,password_changed)
 VALUES(?,'unused','Pengadil',?,?,1,1)`, `${name}@example.invalid`, `FILTER QA ${name}`, gender);
 app(id, 'pengadil_berdaftar', null); return id;
};
try {
 const prior = user('Prior'); app(prior, 'kelas3_fam', 'Lulus', year - 1); app(prior, 'ujian_kecergasan', 'Lulus');
 const senior = user('Senior', 'PEREMPUAN'); app(senior, 'kelas3_fam', 'Lulus', year - 1); app(senior, 'ujian_kelas1_fam', 'Lulus'); app(senior, 'ujian_kecergasan', 'Tidak Lulus');
 const failed = user('Failed'); app(failed, 'ujian_bertulis', 'Tidak Lulus'); app(failed, 'ujian_kecergasan', 'Tidak Hadir');
 const pending = user('Pending'); app(pending, 'kelas3_fam', null); app(pending, 'ujian_kecergasan', null);
 const future = user('Future'); app(future, 'ujian_kelas1_fam', 'Lulus', year + 1);
 const inactive = user('Inactive'); db.prepare('UPDATE users SET aktif=0 WHERE id=?').run(inactive);
 const load = async params => (await (await registeredReferees(get(params), env)).json()).data;
 const rows = await load(''); assert.equal(rows.length, 5);
 const row = id => rows.find(r => r.user_id === id);
 assert.equal(refereeQualification(row(prior), year), 'class3');
 assert.equal(refereeQualification(row(senior), year), 'class1');
 assert.equal(refereeQualification(row(future), year), 'unrecorded');
 assert.equal(refereeQualification(row(pending), year), 'unrecorded', 'Approved application does not imply exam pass');
 assert.equal(refereeExamResult(row(prior), 'class3', year), 'Tiada rekod', 'Prior qualification is not a current exam result');
 assert.equal(refereeExamResult(row(failed), 'class3', year), 'Tidak Lulus', 'Legacy written exam counts as Class III');
 assert.equal(refereeExamResult(row(pending), 'class3', year), 'Belum direkodkan');
 assert.equal(refereeExamResult(row(pending), 'annual', year), 'Belum direkodkan');
 for (const [params, filters, expected] of [
  ['qualification=class3', { qualification: 'class3' }, prior],
  ['class1=Lulus&gender=PEREMPUAN', { class1: 'Lulus', gender: 'PEREMPUAN' }, senior],
  ['annual=Tidak%20Hadir&class3=Tidak%20Lulus', { annual: 'Tidak Hadir', class3: 'Tidak Lulus' }, failed],
  ['class3=Belum%20direkodkan', { class3: 'Belum direkodkan' }, pending],
 ]) {
  const server = await load(params); assert.deepEqual(server.map(r => r.user_id), [expected]);
  assert.deepEqual(filterReferees(rows, { ...all, ...filters }, year).map(r => r.user_id), [expected]);
  const csvResponse = await adminRefereeExport(get(params), env); assert.equal(csvResponse.status, 200);
  const csv = await csvResponse.text(); assert.equal(csv.trim().split('\r\n').length, 2);
  assert.ok(csv.includes(row(expected).nama_penuh)); assert.match(csv, /Keputusan Ujian Kelas III FAM/);
 }
 const repeated = { approved_applications: [
  { id: 1, jenis_borang: 'kelas3_fam', tahun_permohonan: year, status_ujian: 'Lulus' },
  { id: 2, jenis_borang: 'ujian_bertulis', tahun_permohonan: year, status_ujian: 'Tidak Lulus' },
 ] };
 assert.equal(refereeExamResult(repeated, 'class3', year), 'Tidak Lulus');
 assert.equal(refereeQualification(repeated, year), 'class3');
 assert.equal(refereeExamResult({ fitness_status: null }, 'annual', 2027), 'Belum direkodkan');
 assert.equal((await registeredReferees(new Request('https://refpahang.example/api/referees.php'), env)).status, 401);
 console.log('Referee filters: selected-year results, legacy Class III, highest earned class, no future leakage, missing vs pending, combined filters and matching CSV passed');
} finally { close(); }
