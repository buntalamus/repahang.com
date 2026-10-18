import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { bundle, openDatabase } from './_harness.mjs';

const { register, login, session } = await bundle("export {register} from '../src/register'; export {login,session} from '../src/auth';");
const { db, DB, close } = openDatabase(['0001_worker_sessions']);
const objects = new Map();
const emails = [];
const env = {
  DB, STAGING_AUTH_ENABLED: '1', STAGING_WRITES_ENABLED: '1',
  BASE_URL: 'https://staging.refpahang.example', TELEGRAM_BOT_USERNAME: 'test_bot',
  MAIL_DAFTAR_USER: 'daftar@refpahang.example', MAIL_DAFTAR_NAME: 'PBNP',
  EMAIL: { send: async message => { emails.push(message); return { messageId: 'test' }; } },
  MEDIA: { put: async (key, bytes) => objects.set(key, bytes),
    delete: async key => objects.delete(key) },
};
db.prepare("UPDATE application_settings SET setting_value='1' WHERE setting_key='registration_open'").run();
// The snapshot's sign-up close date would close registration once it passes.
db.prepare("UPDATE application_settings SET setting_value='' WHERE setting_key IN ('registration_open_date','registration_close_date')").run();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}
function picture() {
  const header = Buffer.alloc(13); header.writeUInt32BE(150, 0); header.writeUInt32BE(150, 4);
  header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc(150 * (1 + 150 * 4));
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
function form(type = 'Pengadil Baharu') {
  const data = new FormData();
  const fields = {
    nama_penuh: 'Pengadil Ujian', no_ic: '990101061234', email: 'pengadil.ujian@example.invalid',
    no_telefon: '0123456789', jantina: 'Lelaki', role: 'Pengadil', jenis_pengadil: type,
    persatuan_id: String(db.prepare('SELECT id FROM persatuan_bolasepak_daerah WHERE aktif=1 LIMIT 1').get().id),
    alamat1: 'Alamat Ujian', poskod: '25000', daerah: 'Kuantan', negeri: 'Pahang',
    status_kerja: 'Pelajar', nama_waris: 'Waris Ujian', hubungan_waris: 'Ibu Bapa',
    telefon_waris: '0123456789', saiz_baju: 'M', tahun_mula_aktif: '2026',
    pengesahan_data: 'true',
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  data.set('gambar_profil', new File([picture()], 'profile.png', { type: 'image/png' }));
  return data;
}
async function post(data) {
  return register(new Request('https://staging.refpahang.example/api/register.php',
    { method: 'POST', body: data }), env);
}
async function checkLogin(email, role) {
  const recipientOf = message => typeof message.to === 'string' ? message.to : message.to.email;
  const mail = emails.find(message => recipientOf(message) === email);
  const password = mail.text.match(/Kata laluan sementara: (\S+)/)?.[1];
  assert.ok(password, 'welcome email provides the temporary password');
  const response = await login(new Request(env.BASE_URL + '/api/login.php', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }), env);
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.role, role);
  assert.equal(data.can_referee, role === 'Pengadil' ? 1 : 0);
  assert.equal(data.can_ra, role === 'Penilai' ? 1 : 0);
  assert.equal(data.redirect_url, role === 'Penilai' ? '/penilai-dashboard.html' : '/pengadil-dashboard.html');
  const state = await (await session(new Request(env.BASE_URL + '/api/session.php', {
    headers: { Cookie: response.headers.get('Set-Cookie').split(';')[0] },
  }), env)).json();
  assert.equal(state.authenticated, true);
  assert.equal(state.user_role, role);
}
try {
  // Public sign-up must never create privileged accounts or contradictory roles.
  for (const role of ['Admin', 'PP Daerah', '', 'Penilai Pengadil', 'invalid']) {
    const invalid = form(); invalid.set('role', role);
    assert.equal((await post(invalid)).status, 400);
  }
  const mismatched = form(); mismatched.set('role', 'Penilai');
  assert.equal((await post(mismatched)).status, 400);
  assert.equal((await post(form('Penilai Pengadil'))).status, 400);
  const missingType = form('');
  assert.equal((await post(missingType)).status, 400);
  assert.equal(objects.size, 0);
  const incomplete = form(); incomplete.delete('alamat1');
  const rejected = await post(incomplete);
  assert.equal(rejected.status, 400);
  assert.ok((await rejected.json()).missing_fields.includes('alamat1'));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE email='pengadil.ujian@example.invalid'").get().n, 0);
  assert.equal(objects.size, 0);

  const missingEmployer = form();
  missingEmployer.set('status_kerja', 'Bekerja (Swasta)');
  const employerResponse = await post(missingEmployer);
  assert.equal(employerResponse.status, 400);
  assert.ok((await employerResponse.json()).missing_fields.includes('nama_majikan'));
  assert.equal(objects.size, 0);

  const noPicture = form(); noPicture.delete('gambar_profil');
  assert.equal((await post(noPicture)).status, 400);
  assert.equal(objects.size, 0);

  const successful = await post(form());
  assert.equal(successful.status, 200);
  assert.equal((await successful.json()).error, false);
  const user = db.prepare("SELECT role,alamat1,nama_waris,saiz_baju,tahun_mula_aktif,url_gambar_profil FROM users WHERE email='pengadil.ujian@example.invalid'").get();
  assert.equal(user.role, 'Pengadil');
  assert.equal(user.alamat1, 'Alamat Ujian');
  assert.equal(user.nama_waris, 'Waris Ujian');
  assert.equal(user.saiz_baju, 'M');
  assert.equal(user.tahun_mula_aktif, '2026');
  assert.ok(user.url_gambar_profil.startsWith('/uploads/profiles/registration_'));
  assert.equal(objects.size, 1);
  const recipientOf = (message) => typeof message.to === 'string' ? message.to : message.to.email;
  assert.equal(emails.filter((message) => recipientOf(message) === 'pengadil.ujian@example.invalid').length, 1);
  // The district PP Daerah (or Admin) is told about the new sign-up.
  const reviewerMails = emails.filter((message) => /^Pendaftaran Pengadil Baharu: /.test(message.subject));
  assert.ok(reviewerMails.length >= 1);
  assert.equal(emails.length, 1 + reviewerMails.length);
  assert.match(emails[0].text, /Wajib: Hubungkan Telegram sebelum anda boleh menerima lantikan/);
  assert.match(emails[0].html, /Hubungkan Telegram \(Wajib\)/);
  assert.equal((await post(form())).status, 409);
  assert.equal(objects.size, 1);
  await checkLogin('pengadil.ujian@example.invalid', 'Pengadil');
  const assessor = form('Penilai Pengadil');
  assessor.set('role', 'Penilai'); assessor.set('jenis_pengadil', '');
  assessor.set('no_ic', '990101061235'); assessor.set('email', 'penilai.ujian@example.invalid');
  assessor.delete('saiz_baju'); assessor.delete('tahun_mula_aktif');
  const incompleteAssessor = form(''); incompleteAssessor.set('role', 'Penilai');
  incompleteAssessor.delete('nama_waris');
  const rejectedAssessor = await post(incompleteAssessor);
  assert.equal(rejectedAssessor.status, 400);
  assert.ok((await rejectedAssessor.json()).missing_fields.includes('nama_waris'));
  assert.equal((await post(assessor)).status, 200);
  const ra = db.prepare("SELECT role,jenis_pengadil,saiz_baju,tahun_mula_aktif FROM users WHERE email='penilai.ujian@example.invalid'").get();
  assert.equal(ra.role, 'Penilai');
  assert.equal(ra.jenis_pengadil, 'Penilai Pengadil');
  assert.equal(ra.saiz_baju, null);
  assert.equal(ra.tahun_mula_aktif, null);
  assert.ok(emails.some(message => /^Pendaftaran Penilai Pengadil Baharu: /.test(message.subject)));
  await checkLogin('penilai.ujian@example.invalid', 'Penilai');
  assert.equal((await post(assessor)).status, 409);
  assert.equal(objects.size, 2);
  // A cached old form without a role field remains a referee registration.
  const legacy = form('Pengadil Negeri'); legacy.delete('role');
  legacy.set('no_ic', '990101061236'); legacy.set('email', 'legacy.ujian@example.invalid');
  assert.equal((await post(legacy)).status, 200);
  assert.equal(db.prepare("SELECT role FROM users WHERE email='legacy.ujian@example.invalid'").get().role, 'Pengadil');
  console.log('profile registration: role/category gates, referee and assessor login/session, profile requirements, privileged role rejection, duplicates and cached forms passed');
} finally { close(); }
