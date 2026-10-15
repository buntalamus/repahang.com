import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { bundle, openDatabase } from './_harness.mjs';

const { register } = await bundle("export {register} from '../src/register';");
const { db, DB, close } = openDatabase(['0001_worker_sessions']);
const objects = new Map();
const env = {
  DB, STAGING_AUTH_ENABLED: '1', STAGING_WRITES_ENABLED: '1',
  BASE_URL: 'https://staging.refpahang.example', TELEGRAM_BOT_USERNAME: 'test_bot',
  MAIL_DAFTAR_USER: 'daftar@refpahang.example', MAIL_DAFTAR_NAME: 'PBNP',
  EMAIL: { send: async () => ({ messageId: 'test' }) },
  MEDIA: { put: async (key, bytes) => objects.set(key, bytes),
    delete: async key => objects.delete(key) },
};
db.prepare("UPDATE application_settings SET setting_value='1' WHERE setting_key='registration_open'").run();

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
function form(role = 'Pengadil Baharu') {
  const data = new FormData();
  const fields = {
    nama_penuh: 'Pengadil Ujian', no_ic: '990101061234', email: 'pengadil.ujian@example.invalid',
    no_telefon: '0123456789', jantina: 'Lelaki', jenis_pengadil: role,
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
try {
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
  assert.equal((await post(form())).status, 409);
  assert.equal(objects.size, 1);
  const assessor = form('Penilai Pengadil');
  assessor.set('no_ic', '990101061235'); assessor.set('email', 'penilai.ujian@example.invalid');
  assessor.delete('saiz_baju'); assessor.delete('tahun_mula_aktif');
  assert.equal((await post(assessor)).status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE email='penilai.ujian@example.invalid'").get().n, 0);
  console.log('profile registration: profile gates, complete referee account, privileged role rejection and duplicate guard');
} finally { close(); }
