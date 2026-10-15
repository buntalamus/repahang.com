import { hash } from 'bcryptjs';

import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import { json } from './auth';
import type { Env } from './types';
import { wroteRow } from './d1-changes';
import { dimensions } from './profile-write';
import { missingRefereeProfile, profileLabels } from './referee-profile';

const allowedTypes = new Set([
  'Pengadil Baharu', 'Pengadil Kebangsaan', 'Pengadil Negeri',
]);

function randomPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function tokenHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),
    (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function registrationForm(request: Request): Promise<FormData | Response> {
  const max = 6 * 1024 * 1024;
  const type = request.headers.get('Content-Type') || '';
  if (!type.toLowerCase().startsWith('multipart/form-data;')) {
    return json({ error: true, message: 'Borang pendaftaran dan gambar profil diperlukan.' }, 400);
  }
  if (Number(request.headers.get('Content-Length') || 0) > max) {
    return json({ error: true, message: 'Saiz borang terlalu besar (maksimum 6MB).' }, 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return json({ error: true, message: 'Data pendaftaran tidak sah.' }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return json({ error: true, message: 'Saiz borang terlalu besar (maksimum 6MB).' }, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return await new Request(request.url, { method: 'POST', headers: { 'Content-Type': type }, body: bytes }).formData();
  } catch {
    return json({ error: true, message: 'Data pendaftaran tidak sah.' }, 400);
  }
}

export async function register(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Method not allowed' }, 405);
  if (env.STAGING_AUTH_ENABLED !== '1' || env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Pendaftaran belum tersedia di staging.' }, 503);
  }
  const registration = await env.DB.prepare(
    "SELECT setting_value FROM application_settings WHERE setting_key='registration_open'",
  ).first<{ setting_value: string }>();
  if (registration?.setting_value === '0') {
    return json({ error: true, message: 'Pendaftaran akaun baru telah ditutup buat sementara waktu.' }, 403);
  }
  const input = await registrationForm(request);
  if (input instanceof Response) return input;
  const body: Record<string, unknown> = {};
  input.forEach((value, key) => {
    if (typeof value === 'string') body[key] = value.trim();
  });
  const name = typeof body.nama_penuh === 'string' ? body.nama_penuh.trim().toUpperCase() : '';
  const ic = typeof (body.no_ic ?? body.no_kp) === 'string' ? String(body.no_ic ?? body.no_kp).trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.no_telefon === 'string' ? body.no_telefon.trim() : '';
  const gender = typeof body.jantina === 'string' ? body.jantina.trim().toUpperCase() : '';
  const refereeType = typeof body.jenis_pengadil === 'string' ? body.jenis_pengadil.trim() : '';
  const associationId = Number(body.persatuan_id);
  if (!name || name.length > 200 || !/^\d{12}$/.test(ic) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      !/^\d{10,11}$/.test(phone) || !['LELAKI', 'PEREMPUAN'].includes(gender) ||
      !allowedTypes.has(refereeType) || !Number.isSafeInteger(associationId) || associationId < 1 ||
      body.pengesahan_data !== 'true') {
    return json({ error: true, message: 'Maklumat pendaftaran tidak lengkap atau tidak sah.' }, 400);
  }
  const picture = input.get('gambar_profil');
  if (!(picture instanceof File) || picture.size < 1 || picture.size > 5 * 1024 * 1024) {
    return json({ error: true, message: 'Gambar profil JPG atau PNG diperlukan (maksimum 5MB).' }, 400);
  }
  const image = new Uint8Array(await picture.arrayBuffer());
  const info = dimensions(image);
  if (!info || !['image/jpeg', 'image/png'].includes(info.mime) ||
      info.width < 150 || info.height < 150 || info.width > 4000 || info.height > 4000) {
    return json({ error: true, message: 'Gambar profil mesti JPG/PNG sah berukuran 150 hingga 4000 piksel.' }, 400);
  }
  const profileFields = [
    'alamat1', 'alamat2', 'poskod', 'daerah', 'negeri', 'status_kerja',
    'jawatan', 'nama_majikan', 'alamat_majikan1', 'alamat_majikan2',
    'poskod_majikan', 'daerah_majikan', 'negeri_majikan',
    'nama_waris', 'hubungan_waris', 'telefon_waris', 'saiz_baju', 'tahun_mula_aktif',
  ] as const;
  for (const key of profileFields) {
    if (typeof body[key] === 'string' && String(body[key]).length > (key.startsWith('alamat') ? 500 : 255)) {
      return json({ error: true, message: `${profileLabels[key] || key} terlalu panjang.` }, 400);
    }
  }
  const year = Number(body.tahun_mula_aktif);
  const currentYear = Number(new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()));
  if (!Number.isInteger(year) || year < 1950 || year > currentYear) {
    return json({ error: true, message: 'Tahun mula aktif tidak sah.' }, 400);
  }
  if (!/^\d{5}$/.test(String(body.poskod || '')) ||
      !/^\d{10,11}$/.test(String(body.telefon_waris || ''))) {
    return json({ error: true, message: 'Poskod atau no. telefon waris tidak sah.' }, 400);
  }
  const missing = missingRefereeProfile({ ...body, nama_penuh: name, no_ic: ic,
    email, no_telefon: phone, jantina: gender, jenis_pengadil: refereeType,
    persatuan_id: associationId, url_gambar_profil: 'dipilih' });
  if (missing.length) {
    return json({ error: true, message: `Lengkapkan profil: ${missing.map(key => profileLabels[key]).join(', ')}.`, missing_fields: missing }, 400);
  }
  const association = await env.DB.prepare(`
    SELECT p.id,p.daerah,d.id AS district_id FROM persatuan_bolasepak_daerah p
    LEFT JOIN districts d ON lower(d.nama)=lower(p.daerah)
    WHERE p.id=? AND p.aktif=1 LIMIT 1
  `).bind(associationId).first<{ id: number; daerah: string; district_id: number | null }>();
  if (!association) return json({ error: true, message: 'Persatuan tidak sah.' }, 400);
  const existing = await env.DB.prepare(
    'SELECT no_ic,email FROM users WHERE no_ic=? OR lower(email)=? LIMIT 1',
  ).bind(ic, email).first<{ no_ic: string | null; email: string }>();
  if (existing) return json({ error: true, message: existing.no_ic === ic
    ? 'No. Kad Pengenalan ini telah didaftarkan!' : 'Alamat emel ini telah didaftarkan!' }, 409);

  const password = randomPassword();
  const token = tokenHex();
  const role = 'Pengadil';
  const passwordHash = await hash(password, 12);
  const pictureKey = `profiles/registration_${crypto.randomUUID()}.${info.ext}`;
  const picturePath = `/uploads/${pictureKey}`;
  await env.MEDIA.put(pictureKey, image, { httpMetadata: { contentType: info.mime } });
  let userId: number;
  try {
    const result = await env.DB.prepare(`
      INSERT INTO users(email,password,role,district_id,persatuan_id,nama_penuh,no_ic,
        no_telefon,jantina,jenis_pengadil,alamat1,alamat2,poskod,daerah,negeri,
        status_kerja,jawatan,nama_majikan,alamat_majikan1,alamat_majikan2,
        poskod_majikan,daerah_majikan,negeri_majikan,nama_waris,hubungan_waris,
        telefon_waris,saiz_baju,tahun_mula_aktif,url_gambar_profil,
        aktif,password_changed,tg_link_token,
        pengadil_kebangsaan,pengadil_negeri,pengadil_daerah,created_at,updated_at)
      SELECT ${Array.from({ length: 29 }, () => '?').join(',')},1,0,?,0,0,0,
        datetime('now','+8 hours'),datetime('now','+8 hours')
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE no_ic=? OR lower(email)=?)
    `).bind(email, passwordHash, role, association.district_id, associationId,
      name, ic, phone, gender, refereeType,
      ...profileFields.map(key => String(body[key] || '') || null), picturePath,
      token, ic, email).run();
    if (!wroteRow(result)) {
      await env.MEDIA.delete(pictureKey);
      return json({ error: true, message: 'Akaun sudah didaftarkan.' }, 409);
    }
    userId = Number(result.meta.last_row_id);
  } catch (error) {
    await env.MEDIA.delete(pictureKey);
    // Another request may have registered the same identity after the read.
    const conflict = await env.DB.prepare(
      'SELECT id FROM users WHERE no_ic=? OR lower(email)=? LIMIT 1',
    ).bind(ic, email).first();
    if (conflict) return json({ error: true, message: 'Akaun sudah didaftarkan.' }, 409);
    throw error;
  }
  await env.DB.prepare(`
    INSERT INTO notifications(user_id,type,subject,message,created_at)
    VALUES(?,'Permohonan Diterima','Pendaftaran Berjaya',
      'Akaun dan profil anda telah didaftarkan. Hubungkan Telegram melalui pautan dalam emel pendaftaran sebelum menerima lantikan.',
      datetime('now','+8 hours'))
  `).bind(userId).run();
  const bot = env.TELEGRAM_BOT_USERNAME || 'refpahang_bot';
  const telegramLink = `https://t.me/${encodeURIComponent(bot)}?start=${token}`;
  let emailSent = false;
  try {
    const { html, text } = buildRefpahangEmail('Akaun Berjaya Didaftarkan', name, [
      'Akaun Sistem Pengadil Pahang anda telah berjaya didaftarkan.',
      `Emel log masuk: ${email}`,
      `Kata laluan sementara: ${password}`,
      'Sila tukar kata laluan selepas log masuk. Jangan kongsikan butiran ini.',
      'Wajib: Hubungkan Telegram sebelum anda boleh menerima lantikan. Buka pautan di bawah dan tekan Mula / Start dalam bot.',
      `Pautan Telegram: ${telegramLink}`,
      `Selepas itu, log masuk di ${new URL('/login', env.BASE_URL).toString()}`,
    ], { label: 'Hubungkan Telegram (Wajib)', url: telegramLink });
    await sendRefpahangEmail(env, 'daftar', email, name,
      'Selamat Datang - Sistem Pengadil Pahang', html, text);
    emailSent = true;
  } catch {
    console.error('Registration email could not be sent');
  }
  return json({ error: false, user_id: userId, email_sent: emailSent,
    telegram_link: telegramLink,
    message: emailSent
      ? 'Pendaftaran berjaya! Hubungkan Telegram melalui pautan ini sebelum menerima lantikan. Kata laluan dihantar melalui emel.'
      : 'Akaun berjaya didaftarkan tetapi emel belum dapat dihantar. Hubungkan Telegram melalui pautan ini, kemudian gunakan tetapan semula kata laluan untuk mendapatkan akses.' });
}
