import { compare } from 'bcryptjs';

import { boundedJson } from './request';
import type { Env } from './types';

export interface SessionUser {
  id: number;
  email: string;
  role: string;
  jenis_pengadil: string | null;
  nama_penuh: string;
  persatuan_id: number | null;
  district_id: number | null;
  persatuan_nama: string | null;
  password_changed: number;
}

interface LoginUser extends SessionUser {
  password: string;
  aktif: number;
}

const COOKIE_NAME = 'refpahang_session';
const SESSION_SECONDS = 12 * 60 * 60;
const LIMIT_WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = 10;

export function json(payload: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(JSON.stringify(payload), { status, headers });
}

function cookieValue(request: Request): string | null {
  const cookies = request.headers.get('Cookie')?.split(';') ?? [];
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=', 2);
    if (name === COOKIE_NAME && value && /^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  }
  return null;
}

function isSecure(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}

function sessionCookie(request: Request, token: string, maxAge: number): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure(request) ? '; Secure' : ''}`;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function loginAllowed(email: string, env: Env): boolean {
  const allowlist = env.STAGING_LOGIN_EMAILS;
  if (allowlist === undefined) return true;
  return allowlist.split(',').some((entry) => entry.trim().toLowerCase() === email.toLowerCase());
}

async function maintenanceActive(env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT setting_value FROM application_settings WHERE setting_key='maintenance_mode'",
  ).first<{ setting_value: string }>();
  return row?.setting_value === '1';
}

export async function currentUser(request: Request, env: Env): Promise<SessionUser | null> {
  if (env.STAGING_AUTH_ENABLED !== '1') return null;
  const token = cookieValue(request);
  if (!token) return null;
  const user = await env.DB.prepare(`
    SELECT u.id, u.email, u.role, u.jenis_pengadil, u.nama_penuh,
           COALESCE(NULLIF(u.persatuan_id,0),u.district_id) AS persatuan_id,
           u.district_id, p.nama_persatuan AS persatuan_nama,
           u.password_changed
    FROM worker_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN persatuan_bolasepak_daerah p ON p.id = u.persatuan_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.aktif = 1
    LIMIT 1
  `).bind(await sha256(token), Math.floor(Date.now() / 1000)).first<SessionUser>();
  if (!user || !loginAllowed(user.email, env)) return null;
  if (user.role !== 'Admin' && await maintenanceActive(env)) return null;
  return user;
}

export async function login(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  if (env.STAGING_AUTH_ENABLED !== '1') {
    return json({ error: true, message: 'Staging masih dalam proses migrasi.' }, 503);
  }
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Data log masuk tidak sah.' }, 422);
  }
  const body = input as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password || email.length > 254 || password.length > 1024) {
    return json({ error: true, message: 'Emel dan kata laluan diperlukan.' }, 422);
  }
  if (!loginAllowed(email, env)) {
    return json({ error: true, message: 'Emel atau kata laluan tidak sah.' }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const limitKey = await sha256(`${email}|${ip}`);
  const prior = await env.DB.prepare('SELECT failures, window_started FROM worker_login_limits WHERE limit_key=?')
    .bind(limitKey).first<{ failures: number; window_started: number }>();
  if (prior && prior.window_started > now - LIMIT_WINDOW_SECONDS && prior.failures >= MAX_FAILURES) {
    return json({ error: true, message: 'Terlalu banyak cubaan log masuk. Cuba lagi kemudian.' }, 429);
  }

  const user = await env.DB.prepare(`
    SELECT u.id, u.email, u.password, u.role, u.jenis_pengadil,
           u.persatuan_id, u.district_id, u.nama_penuh, u.aktif,
           u.password_changed, p.nama_persatuan AS persatuan_nama
    FROM users u
    LEFT JOIN persatuan_bolasepak_daerah p ON p.id = u.persatuan_id
    WHERE lower(u.email) = ? LIMIT 1
  `).bind(email).first<LoginUser>();
  const passwordHash = user?.password.replace(/^\$2y\$/, '$2b$');
  const valid = passwordHash ? await compare(password, passwordHash) : false;
  if (!user || !valid) {
    await env.DB.prepare(`
      INSERT INTO worker_login_limits(limit_key, failures, window_started) VALUES(?,1,?)
      ON CONFLICT(limit_key) DO UPDATE SET
        failures=CASE WHEN window_started < ? THEN 1 ELSE failures+1 END,
        window_started=CASE WHEN window_started < ? THEN excluded.window_started ELSE window_started END
    `).bind(limitKey, now, now - LIMIT_WINDOW_SECONDS, now - LIMIT_WINDOW_SECONDS).run();
    return json({ error: true, message: 'Emel atau kata laluan tidak sah.' }, 401);
  }
  if (Number(user.aktif) !== 1) {
    return json({ error: true, message: 'Akaun anda tidak aktif. Sila hubungi pentadbir.' }, 403);
  }
  if (user.role !== 'Admin' && await maintenanceActive(env)) {
    return json({ error: true, message: 'Sistem sedang dalam penyelenggaraan.' }, 503);
  }

  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM worker_login_limits WHERE limit_key=?').bind(limitKey),
    env.DB.prepare('DELETE FROM worker_sessions WHERE expires_at <= ?').bind(now),
    env.DB.prepare('INSERT INTO worker_sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)')
      .bind(await sha256(token), user.id, now, now + SESSION_SECONDS),
    env.DB.prepare("UPDATE users SET last_login=datetime('now') WHERE id=?").bind(user.id),
  ]);
  const redirectUrls: Record<string, string> = {
    Admin: '/admin-dashboard.html',
    'PP Daerah': '/pp-dashboard.html',
    Pengadil: '/pengadil-dashboard.html',
    Penilai: '/penilai-dashboard.html',
  };
  return json({
    error: false,
    message: 'Log masuk berjaya.',
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
      jenis_pengadil: user.jenis_pengadil,
      nama_penuh: user.nama_penuh,
      persatuan_id: user.persatuan_id,
      persatuan_nama: user.persatuan_nama,
      password_changed: Number(user.password_changed),
      redirect_url: redirectUrls[user.role] ?? '/admin-dashboard.html',
    },
  }, 200, sessionCookie(request, token, SESSION_SECONDS));
}

export async function session(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ authenticated: false });
  return json({
    authenticated: true,
    user_id: user.id,
    user_email: user.email,
    user_role: user.role,
    // session.php refreshes Admin classification with fetchColumn() ?: null.
    user_jenis_pengadil: user.role === 'Admin' ? (user.jenis_pengadil || null) : user.jenis_pengadil,
    user_persatuan_id: user.persatuan_id ?? user.district_id,
    user_persatuan_name: user.persatuan_nama,
    nama_penuh: user.nama_penuh,
    password_changed: Number(user.password_changed),
    base_url: new URL(request.url).origin,
  });
}

export async function logout(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const token = cookieValue(request);
  if (token) await env.DB.prepare('DELETE FROM worker_sessions WHERE token_hash=?').bind(await sha256(token)).run();
  return json({ error: false, message: 'Log keluar berjaya.' }, 200, sessionCookie(request, '', 0));
}
