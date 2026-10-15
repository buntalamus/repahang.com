import { hash } from 'bcryptjs';

import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import { json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';
import { wroteRow } from './d1-changes';

const genericMessage = 'Jika emel berdaftar, pautan tetapan semula kata laluan akan dihantar.';

function tokenHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function enabled(env: Env): boolean {
  return env.STAGING_AUTH_ENABLED === '1' && env.STAGING_WRITES_ENABLED === '1';
}

export async function forgotPassword(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Method not allowed.' }, 405);
  if (!enabled(env)) return json({ error: true, message: 'Fungsi ini belum tersedia di staging.' }, 503);
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  const body = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: true, message: 'Sila masukkan alamat emel yang sah.' }, 400);
  }

  const user = await env.DB.prepare(
    'SELECT id,nama_penuh,email FROM users WHERE lower(email)=? AND aktif=1 LIMIT 1',
  ).bind(email).first<{ id: number; nama_penuh: string; email: string }>();
  if (!user) return json({ error: false, message: genericMessage });

  const token = tokenHex();
  const storedToken = await sha256(token);
  // Legacy timestamps are Malaysia local time. Keep the same convention in
  // this migrated table so recent legacy requests are rate-limited too.
  const inserted = await env.DB.prepare(`
    INSERT INTO password_reset_tokens(user_id,token,expires_at,used,created_at)
    SELECT ?,?,datetime('now','+9 hours'),0,datetime('now','+8 hours')
    WHERE (SELECT COUNT(*) FROM password_reset_tokens
           WHERE user_id=? AND COALESCE(used,0)=0
             AND created_at > datetime('now','+7 hours')) < 3
  `).bind(user.id, storedToken, user.id).run();
  if (!wroteRow(inserted)) return json({ error: false, message: genericMessage });

  try {
    const resetUrl = new URL('/reset-kata-laluan', env.BASE_URL);
    if (resetUrl.protocol !== 'https:') throw new Error('Reset URL must be HTTPS');
    resetUrl.searchParams.set('token', token);
    const { html, text } = buildRefpahangEmail(
      'Tetapan Semula Kata Laluan', user.nama_penuh,
      [
        'Kami menerima permintaan untuk menetapkan semula kata laluan akaun anda.',
        'Pautan ini tamat tempoh dalam 1 jam. Jika anda tidak membuat permintaan ini, abaikan emel ini.',
      ],
      { label: 'Tetapkan Semula Kata Laluan', url: resetUrl.toString() },
    );
    await sendRefpahangEmail(
      env, 'admin', user.email, user.nama_penuh,
      'Tetapan Semula Kata Laluan - Sistem Pengadil Pahang', html, text,
    );
  } catch {
    // A token without a delivered email must not consume a rate-limit slot.
    await env.DB.prepare('DELETE FROM password_reset_tokens WHERE token=? AND COALESCE(used,0)=0')
      .bind(storedToken).run();
    console.error('Password reset email could not be sent');
  }
  return json({ error: false, message: genericMessage });
}

export async function resetPassword(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Method not allowed.' }, 405);
  if (!enabled(env)) return json({ error: true, message: 'Fungsi ini belum tersedia di staging.' }, 503);
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  const body = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const token = typeof body.token === 'string' ? body.token.trim().toLowerCase() : '';
  const password = body.password;
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: true, message: 'Token tidak sah.' }, 400);
  if (typeof password !== 'string' || new TextEncoder().encode(password).byteLength < 8) {
    return json({ error: true, message: 'Kata laluan mestilah sekurang-kurangnya 8 aksara.' }, 400);
  }
  if (new TextEncoder().encode(password).byteLength > 72) {
    return json({ error: true, message: 'Kata laluan terlalu panjang (maksimum 72 bait).' }, 400);
  }
  if (password !== body.confirm_password) {
    return json({ error: true, message: 'Kata laluan tidak sepadan.' }, 400);
  }

  const tokenRow = await env.DB.prepare(`
    SELECT t.id,t.user_id,t.expires_at,COALESCE(t.used,0) AS used,u.aktif
    FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
    WHERE t.token IN (?,?) LIMIT 1
  `).bind(await sha256(token), token).first<{
    id: number; user_id: number; expires_at: string; used: number; aktif: number;
  }>();
  if (!tokenRow || tokenRow.used !== 0 || tokenRow.aktif !== 1) {
    return json({ error: true, message: 'Pautan tidak sah atau telah digunakan.' }, 400);
  }
  const currentMalaysiaTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());
  if (tokenRow.expires_at <= currentMalaysiaTime) {
    return json({ error: true, message: 'Pautan telah tamat tempoh. Sila buat permintaan baharu.' }, 400);
  }

  const replacement = await hash(password, 12);
  // D1 batch is atomic. The second and third statements are conditioned on
  // the first password update, so a token used by a concurrent request cannot
  // overwrite the password or log out sessions spuriously.
  const results = await env.DB.batch([
    env.DB.prepare(`
      UPDATE users SET password=?,password_changed=1,updated_at=datetime('now','+8 hours')
      WHERE id=? AND aktif=1 AND EXISTS (
        SELECT 1 FROM password_reset_tokens
        WHERE id=? AND COALESCE(used,0)=0 AND expires_at>datetime('now','+8 hours')
      )
    `).bind(replacement, tokenRow.user_id, tokenRow.id),
    env.DB.prepare(`
      UPDATE password_reset_tokens SET used=1
      WHERE user_id=? AND COALESCE(used,0)=0
        AND EXISTS (SELECT 1 FROM users WHERE id=? AND password=?)
    `).bind(tokenRow.user_id, tokenRow.user_id, replacement),
    env.DB.prepare(`
      DELETE FROM worker_sessions WHERE user_id=?
        AND EXISTS (SELECT 1 FROM users WHERE id=? AND password=?)
    `).bind(tokenRow.user_id, tokenRow.user_id, replacement),
  ]);
  if (!wroteRow(results[0])) {
    return json({ error: true, message: 'Pautan tidak sah atau telah digunakan.' }, 400);
  }
  return json({
    error: false,
    message: 'Kata laluan berjaya ditukar. Sila log masuk dengan kata laluan baharu.',
  });
}
