import { hash } from 'bcryptjs';

import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import { json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';
import { wroteRow } from './d1-changes';

const allowedTypes = new Set([
  'Pengadil Kebangsaan', 'Pengadil Negeri', 'Penilai Pengadil', 'Pegawai Pembangunan',
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
  const input = await boundedJson(request, 8192);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Data pendaftaran tidak sah.' }, 400);
  }
  const body = input as Record<string, unknown>;
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
      body.pengesahan_data !== true) {
    return json({ error: true, message: 'Maklumat pendaftaran tidak lengkap atau tidak sah.' }, 400);
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
  const role = refereeType === 'Pegawai Pembangunan' ? 'PP Daerah' : 'Pengadil';
  const passwordHash = await hash(password, 12);
  let userId: number;
  try {
    const result = await env.DB.prepare(`
      INSERT INTO users(email,password,role,district_id,persatuan_id,nama_penuh,no_ic,
        no_telefon,jantina,jenis_pengadil,aktif,password_changed,tg_link_token,
        pengadil_kebangsaan,pengadil_negeri,pengadil_daerah,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,1,0,?,0,0,0,
        datetime('now','+8 hours'),datetime('now','+8 hours')
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE no_ic=? OR lower(email)=?)
    `).bind(email, passwordHash, role, association.district_id, associationId,
      name, ic, phone, gender, refereeType, token, ic, email).run();
    if (!wroteRow(result)) {
      return json({ error: true, message: 'Akaun sudah didaftarkan.' }, 409);
    }
    userId = Number(result.meta.last_row_id);
  } catch (error) {
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
      'Selamat datang! Akaun anda telah berjaya didaftarkan. Sila lengkapkan profil anda di dashboard.',
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
      `Untuk menghubungkan Telegram, buka ${telegramLink}`,
    ], { label: 'Log Masuk Sekarang', url: new URL('/login', env.BASE_URL).toString() });
    await sendRefpahangEmail(env, 'daftar', email, name,
      'Selamat Datang - Sistem Pengadil Pahang', html, text);
    emailSent = true;
  } catch {
    console.error('Registration email could not be sent');
  }
  return json({ error: false, user_id: userId, email_sent: emailSent,
    telegram_link: telegramLink,
    message: emailSent
      ? 'Pendaftaran berjaya! Emel dengan kata laluan telah dihantar.'
      : 'Akaun berjaya didaftarkan tetapi emel belum dapat dihantar. Gunakan tetapan semula kata laluan untuk mendapatkan akses.' });
}
