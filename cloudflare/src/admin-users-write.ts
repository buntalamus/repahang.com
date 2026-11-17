import { setAccountStatus, DEFAULT_INACTIVE_REASON } from './account-access';
import { normalizeProfileInput } from './profile-contract';
/**
 * Write half of api/admin-users.php (POST create, PUT update, PATCH password
 * actions, DELETE). GET stays in admin-users.ts.
 *
 * Owner decision (15 Oct 2026): DELETE deactivates the account instead of
 * PHP's `DELETE FROM users`, so match, application and report history stays.
 */
import { hash } from 'bcryptjs';
import { currentUser, json } from './auth';
import { SHARED_ACCOUNT_MESSAGE, isSharedDemoUserId } from './demo';
import { boundedJson } from './request';
import { phpInt } from './lantikan-write';
import { h } from './php/format';
import {
  baseUrl, buildEmailTemplate, emailAlert, emailButton, emailCredBox, emailGreeting,
  emailInfoTable, emailPara, sendEmail,
} from './php/email';
import type { Env } from './types';
import { notifyAccountUpdated, notifyOldEmailAddress } from './account-notify';
import { wroteRow } from './d1-changes';

const VALID_ROLES = ['Pengadil', 'Penilai', 'PP Daerah', 'Admin'];
// PHP's reset_password and resend_notification both set this fixed value.
const RESET_PASSWORD = '12345678';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Input = Record<string, unknown>;

function text(input: Input, key: string): string {
  const value = input[key];
  return value === undefined || value === null ? '' : String(value).trim();
}

/** PHP passes '' straight to an INT column; store NULL instead. */
function nullableId(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return phpInt(value);
}

function generatePassword(length = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}

async function emailTaken(env: Env, email: string, exceptId: number | null): Promise<boolean> {
  const row = exceptId === null
    ? await env.DB.prepare('SELECT id FROM users WHERE lower(email)=lower(?) LIMIT 1').bind(email).first()
    : await env.DB.prepare('SELECT id FROM users WHERE lower(email)=lower(?) AND id<>? LIMIT 1')
      .bind(email, exceptId).first();
  return row !== null;
}

/** Port of sendUserRegistrationEmail() in api/admin-users.php. */
function sendUserRegistrationEmail(env: Env, to: string, nama: string, role: string, password: string,
  jenisPengadil: string | null, isReset: boolean): Promise<boolean> {
  const roleNames: Record<string, string> = {
    'Admin': 'Administrator',
    'PP Daerah': 'Pegawai Pembangunan Daerah',
    'Pengadil': 'Pengadil',
    'Penilai': 'Penilai Pengadil',
  };
  const roleDisplay = roleNames[role] ?? role;
  const subject = isReset
    ? 'Reset Kata Laluan - Sistem Pengurusan Pengadil PBNP'
    : 'Akaun Berjaya Didaftarkan - Sistem Pengurusan Pengadil PBNP';
  const accentColor = isReset ? '#F59E0B' : '#111827';
  const bannerTitle = isReset ? 'Reset Kata Laluan' : 'Akaun Berjaya Didaftarkan';
  const rows: Array<[string, string]> = [['Nama', h(nama)], ['Peranan', h(roleDisplay)], ['Emel', h(to)]];
  if (jenisPengadil) rows.push(['Jenis Pengadil', h(jenisPengadil)]);
  let body = emailGreeting(nama);
  body += emailPara(isReset
    ? 'Kata laluan akaun anda dalam <strong>Sistem Pengurusan Pengadil Persatuan Bola Sepak Negeri Pahang</strong> telah <strong>direset</strong> oleh pentadbir.'
    : 'Akaun anda dalam <strong>Sistem Pengurusan Pengadil Persatuan Bola Sepak Negeri Pahang</strong> telah berjaya didaftarkan.');
  body += emailInfoTable(rows);
  body += emailPara(isReset ? '<strong>Kata Laluan Baru:</strong>' : '<strong>Maklumat Log Masuk:</strong>');
  body += emailCredBox('Emel / ID Pengguna', h(to));
  body += emailCredBox(isReset ? 'Kata Laluan Baru' : 'Kata Laluan', h(password));
  body += emailAlert('#F59E0B', '#FFFBEB', 'Keselamatan Akaun',
    'Simpan kata laluan ini dengan selamat. '
    + (isReset ? '<strong>Kata laluan lama anda tidak lagi sah.</strong> ' : '')
    + 'Anda <strong>digalakkan menukar kata laluan</strong> selepas log masuk pertama. Jangan kongsikan maklumat log masuk dengan sesiapa.');
  body += emailButton(`${baseUrl(env)}/login`, 'Log Masuk ke Sistem');
  return sendEmail(env, to, subject, buildEmailTemplate(bannerTitle, accentColor, '', body), nama, 'admin');
}

async function createUser(request: Request, env: Env): Promise<Response> {
  if (Number(request.headers.get('Content-Length') ?? 0) > 64 * 1024) {
    return json({ error: true, message: 'Permintaan terlalu besar.' }, 413);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: true, message: 'Nama penuh, email dan peranan diperlukan.' }, 400);
  }
  const input: Input = {};
  for (const key of ['nama_penuh', 'email', 'no_telefon', 'user_role', 'persatuan_id', 'jenis_pengadil', 'password']) {
    const value = form.get(key);
    if (typeof value === 'string') input[key] = value;
  }
  const namaPenuh = text(input, 'nama_penuh').toUpperCase();
  const email = text(input, 'email');
  const noTelefon = text(input, 'no_telefon');
  const role = String(input.user_role ?? '');
  const persatuanId = nullableId(input.persatuan_id);
  const jenisPengadil = text(input, 'jenis_pengadil').toUpperCase();
  let password = String(input.password ?? '');
  if (!namaPenuh || !email || !role) {
    return json({ error: true, message: 'Nama penuh, email dan peranan diperlukan.' }, 400);
  }
  if (!EMAIL_PATTERN.test(email)) return json({ error: true, message: 'Format email tidak sah.' }, 400);
  if (!VALID_ROLES.includes(role)) return json({ error: true, message: 'Peranan tidak sah.' }, 400);
  if (role !== 'Admin' && !persatuanId) {
    return json({ error: true, message: 'FA diperlukan untuk peranan ini.' }, 400);
  }
  if (await emailTaken(env, email, null)) return json({ error: true, message: 'Email sudah wujud.' }, 400);
  if (!password) password = generatePassword();
  const passwordHash = await hash(password, 12);
  await env.DB.prepare(`
    INSERT INTO users (email, password, role, persatuan_id, jenis_pengadil, nama_penuh, no_telefon,
      aktif, password_changed, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, datetime('now','+8 hours'), datetime('now','+8 hours'))
  `).bind(email, passwordHash, role, persatuanId, jenisPengadil, namaPenuh, noTelefon).run();
  const emailSent = await sendUserRegistrationEmail(env, email, namaPenuh, role, password, jenisPengadil || null, false);
  return json({ error: false, message: 'Pengguna berjaya ditambah.', generatedPassword: password, email_sent: emailSent });
}

async function updateUser(request: Request, env: Env): Promise<Response> {
  const parsed = await boundedJson(request, 64 * 1024);
  if (parsed instanceof Response) return parsed;
  const input = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Input;
  const userId = phpInt(input.userId ?? 0);
  if (!userId) return json({ error: true, message: 'ID pengguna diperlukan.' }, 400);
  if (await isSharedDemoUserId(env, userId)) return json({ error: true, message: SHARED_ACCOUNT_MESSAGE }, 403);
  const namaPenuh = text(input, 'nama_penuh');
  const email = text(input, 'email');
  const role = text(input, 'user_role');
  const persatuanId = nullableId(input.persatuan_id);
  const password = text(input, 'password');
  if (!namaPenuh || !email || !role) {
    return json({ error: true, message: 'Nama penuh, email dan peranan diperlukan.' }, 400);
  }
  if (!EMAIL_PATTERN.test(email)) return json({ error: true, message: 'Format email tidak sah.' }, 400);
  if (!VALID_ROLES.includes(role)) return json({ error: true, message: 'Peranan tidak sah.' }, 400);
  if (role !== 'Admin' && !persatuanId) {
    return json({ error: true, message: 'FA diperlukan untuk peranan ini.' }, 400);
  }
  if (await emailTaken(env, email, userId)) {
    return json({ error: true, message: 'Email sudah digunakan oleh pengguna lain.' }, 400);
  }
  const previous = await env.DB.prepare(`SELECT email,role,telegram_chat_id,
    tahun_mula_aktif,tahun_mohon_kelas3,tahun_lulus_kelas3,tahun_mohon_kelas1,tahun_lulus_kelas1
    FROM users WHERE id=?`).bind(userId).first<Record<string, unknown> & {email:string|null;role:string;telegram_chat_id:string|number|null}>();
  if (!previous) return json({error:true,message:'Pengguna tidak ditemui.'},404);
  const normalized=normalizeProfileInput(input,previous);
  if (normalized.error) return json({error:true,message:normalized.error},400);
  if (persatuanId && !await env.DB.prepare('SELECT 1 FROM persatuan_bolasepak_daerah WHERE id=?').bind(persatuanId).first())
    return json({error:true,message:'Persatuan tidak dijumpai.'},400);
  const sets=Object.keys(normalized.values).map(field=>`${field}=?`);
  const values:unknown[]=Object.values(normalized.values);
  // Partial profile edits preserve every property that was not submitted.
  sets.push('role=?');values.push(role);
  if (Object.hasOwn(input,'url_gambar_profil')) {sets.push('url_gambar_profil=?');values.push(text(input,'url_gambar_profil'));}
  if (password) {
    sets.push('password=?', 'password_changed=0');
    values.push(await hash(password, 12));
  }
  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id=?`).bind(...values, userId).run();
  let notified = false;
  if (previous) {
    const jenis = text(input, 'jenis_pengadil');
    if (password) {
      notified = await sendUserRegistrationEmail(env, email, namaPenuh, role, password, jenis || null, true) || notified;
    }
    const oldEmail = String(previous.email ?? '');
    const emailChanged = oldEmail.trim().toLowerCase() !== email.toLowerCase();
    const roleChanged = previous.role !== role;
    if (emailChanged || roleChanged) {
      notified = await notifyAccountUpdated(env,
        { userId, name: namaPenuh, email, telegramChatId: previous.telegram_chat_id }, {
          ...(roleChanged ? { role: { from: previous.role, to: role } } : {}),
          ...(emailChanged ? { email: { from: oldEmail, to: email } } : {}),
        }) || notified;
      if (emailChanged) await notifyOldEmailAddress(env, oldEmail, namaPenuh, email, 'pentadbir');
    }
  }
  return json({ error: false, message: 'Pengguna berjaya dikemaskini.', notification_sent: notified });
}

async function passwordAction(request: Request, env: Env, adminId: number): Promise<Response> {
  const parsed = await boundedJson(request);
  if (parsed instanceof Response) return parsed;
  const input = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Input;
  const userId = phpInt(input.userId ?? 0);
  const action = String(input.action ?? '');
  if (action === 'revoke_telegram') {
    if (!userId) return json({ error: true, message: 'ID pengguna diperlukan.' }, 400);
    const results = await env.DB.batch([
      env.DB.prepare(`UPDATE users SET telegram_chat_id=NULL,tg_link_token=NULL,updated_at=datetime('now','+8 hours')
        WHERE id=? AND trim(COALESCE(CAST(telegram_chat_id AS TEXT),''))<>''
        AND EXISTS (SELECT 1 FROM users actor WHERE actor.id=? AND actor.role='Admin' AND actor.aktif=1)`)
        .bind(userId, adminId),
      env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
        SELECT ?,'revoke_telegram_link','users',?,
          'Pautan Telegram pengguna ID '||?||' dibatalkan oleh Admin.',datetime('now','+8 hours')
        WHERE changes()>0`)
        .bind(adminId, userId, userId),
    ]);
    if (!wroteRow(results[0])) {
      return json({ error: true, message: 'Pautan Telegram sudah berubah atau sesi Admin tidak lagi sah. Muat semula dan cuba lagi.' }, 409);
    }
    return json({ error: false, message: 'Pautan Telegram berjaya dibatalkan.' });
  }
  if (action === 'set_account_status') {
    if (![0, 1].includes(input.aktif as number)) return json({ error: true, message: 'Status akaun tidak sah.' }, 400);
    return setAccountStatus(env, adminId, Number(input.userId), Number(input.aktif), input.reason);
  }
  if (!userId || !action) return json({ error: true, message: 'ID pengguna dan aksi diperlukan.' }, 400);
  if (action !== 'reset_password' && action !== 'resend_notification') {
    return json({ error: true, message: 'Aksi tidak sah.' }, 400);
  }
  if (await isSharedDemoUserId(env, userId)) return json({ error: true, message: SHARED_ACCOUNT_MESSAGE }, 403);
  const user = await env.DB.prepare('SELECT nama_penuh, email, role, jenis_pengadil FROM users WHERE id=?')
    .bind(userId).first<{ nama_penuh: string; email: string; role: string; jenis_pengadil: string | null }>();
  if (!user) return json({ error: true, message: 'Pengguna tidak dijumpai.' }, 404);
  await env.DB.prepare('UPDATE users SET password=?, password_changed=0 WHERE id=?')
    .bind(await hash(RESET_PASSWORD, 12), userId).run();
  const emailSent = await sendUserRegistrationEmail(env, user.email, user.nama_penuh, user.role,
    RESET_PASSWORD, user.jenis_pengadil, true);
  const message = action === 'reset_password'
    ? (emailSent
      ? 'Kata laluan berjaya direset kepada 12345678. Emel telah dihantar kepada pengguna.'
      : 'Kata laluan berjaya direset kepada 12345678. (Emel notifikasi gagal dihantar)')
    : (emailSent
      ? 'Emel notifikasi pendaftaran berjaya dihantar semula.'
      : 'Kata laluan berjaya direset. (Emel notifikasi gagal dihantar)');
  return json({ error: false, message, newPassword: RESET_PASSWORD });
}

async function deactivateUser(request: Request, env: Env, adminId: number): Promise<Response> {
  const parsed = await boundedJson(request);
  if (parsed instanceof Response) return parsed;
  const input = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Input;
  const userId = phpInt(input.userId ?? new URL(request.url).searchParams.get('id') ?? 0);
  if (!userId) return json({ error: true, message: 'ID pengguna diperlukan.' }, 400);
  return setAccountStatus(env, adminId, userId, 0, input.reason ?? DEFAULT_INACTIVE_REASON);
}

export async function adminUsersWrite(request: Request, env: Env): Promise<Response> {
  const admin = await currentUser(request, env);
  if (!admin) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (admin.role !== 'Admin') {
    return json({ error: true, message: 'Akses ditolak. Hanya admin boleh mengakses.' }, 403);
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const override = request.headers.get('X-HTTP-Method-Override');
  if (request.method === 'POST' && override === 'DELETE') return deactivateUser(request, env, admin.id);
  if (request.method === 'POST') return createUser(request, env);
  if (request.method === 'PUT') return updateUser(request, env);
  if (request.method === 'PATCH') return passwordAction(request, env, admin.id);
  if (request.method === 'DELETE') return deactivateUser(request, env, admin.id);
  return json({ error: true, message: 'Method not allowed' }, 405);
}
