/**
 * Mobile app push notifications through Firebase Cloud Messaging (HTTP v1).
 * Every in-app notice (a notifications row) is also pushed to the devices the
 * recipient registered from the app, so no notification call site changes:
 * processPushQueue() follows the notifications table with a cursor and runs
 * after each write (ctx.waitUntil) and from the cron.
 */
import { currentUser, json, requestTokenHash } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';
import { sendWebPush, webPushEnabled, webPushUrl, type WebPushMessage } from './webpush';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CURSOR_KEY = 'notifications_cursor';
const MAX_DEVICES_PER_USER = 10;
const SEND_CONCURRENCY = 10;

interface ServiceAccount { project_id: string; client_email: string; private_key: string }

interface NotificationRow { id: number; user_id: number; type: string; subject: string; message: string }

interface DeviceRow { user_id: number; token: string }

interface WebSubscriptionRow { id: number; user_id: number; endpoint: string; p256dh: string; auth: string; role: string }

export type PushResult = 'sent' | 'invalid' | 'failed';

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
  badge?: number;
}

let cachedAccess: { email: string; token: string; expiresAt: number } | null = null;

export function pushEnabled(env: Env): boolean {
  return env.PUSH_ENABLED === '1' && !!env.FCM_SERVICE_ACCOUNT;
}

function serviceAccount(env: Env): ServiceAccount | null {
  try {
    const parsed = JSON.parse(env.FCM_SERVICE_ACCOUNT ?? '') as Partial<ServiceAccount>;
    return parsed.project_id && parsed.client_email && parsed.private_key ? parsed as ServiceAccount : null;
  } catch {
    return null;
  }
}

function base64Url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let binary = '';
  for (const byte of raw) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function signedAssertion(account: ServiceAccount, now: number): Promise<string> {
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']);
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: account.client_email, scope: FCM_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  }))}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function accessToken(account: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccess && cachedAccess.email === account.client_email && cachedAccess.expiresAt > now + 60) {
    return cachedAccess.token;
  }
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: await signedAssertion(account, now),
    }),
  });
  if (!response.ok) {
    console.error('[push] FCM access token refused', response.status);
    return null;
  }
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;
  cachedAccess = { email: account.client_email, token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) };
  return body.access_token;
}

/** Sends one push. 'invalid' means the device token is gone and should be removed. */
export async function sendPush(env: Env, deviceToken: string, message: PushMessage): Promise<PushResult> {
  const account = serviceAccount(env);
  if (!account) return 'failed';
  try {
    const access = await accessToken(account);
    if (!access) return 'failed';
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: message.title, body: message.body },
            data: message.data,
            android: { priority: 'HIGH', notification: { channel_id: 'refpahang', sound: 'default' } },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: { aps: { sound: 'default', ...(message.badge !== undefined ? { badge: message.badge } : {}) } },
            },
          },
        }),
      });
    if (response.ok) return 'sent';
    const text = await response.text();
    if (response.status === 404 || /UNREGISTERED|SENDER_ID_MISMATCH/.test(text)
      || (response.status === 400 && /registration token/i.test(text))) return 'invalid';
    console.error('[push] FCM send failed', response.status);
    return 'failed';
  } catch {
    return 'failed';
  }
}

function plainText(value: string, limit: number): string {
  const text = value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
  const chars = Array.from(text);
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : text;
}

/** App screen opened when the push is tapped. */
export function pushScreen(type: string): 'lantikan' | 'permohonan' | 'sejarah' | 'notifikasi' {
  const value = type.toLowerCase();
  if (value.startsWith('lantikan') || value.includes('terima lantikan') || value.includes('tolak lantikan')
    || ['perubahan perlawanan', 'status perlawanan', 'pengganti diperlukan', 'perlawanan baru'].includes(value)) {
    return 'lantikan';
  }
  if (value.includes('permohonan') || value.includes('keputusan') || value.includes('pendaftaran')
    || value.includes('seminar') || value === 'pp disahkan' || value === 'ditolak') return 'permohonan';
  if (value.includes('pengesahan perlawanan') || value.includes('rekod perlawanan') || value.includes('laporan')) {
    return 'sejarah';
  }
  return 'notifikasi';
}

export function pushMessageFor(row: NotificationRow, badge?: number): PushMessage {
  return {
    title: plainText(row.subject || row.type || 'RefPahang', 100),
    body: plainText(row.message, 240),
    data: { notification_id: String(row.id), type: row.type, screen: pushScreen(row.type) },
    badge,
  };
}

/**
 * Pushes notifications rows written since the last run. The cursor is claimed
 * with a compare-and-swap, so concurrent runs never push a row twice. Rows
 * written while push is disabled are skipped rather than sent late.
 */
export async function processPushQueue(env: Env, limit = 50):
  Promise<{ sent: number; failed: number; removed: number }> {
  const summary = { sent: 0, failed: 0, removed: 0 };
  const state = await env.DB.prepare('SELECT state_value FROM worker_push_state WHERE state_key=?')
    .bind(CURSOR_KEY).first<{ state_value: number }>();
  if (!state) return summary;
  const from = Number(state.state_value);
  const rows = (await env.DB.prepare(`SELECT id,user_id,type,subject,message FROM notifications
    WHERE id>? ORDER BY id LIMIT ?`).bind(from, limit).all<NotificationRow>()).results;
  if (!rows.length) return summary;
  const upto = rows[rows.length - 1].id;
  const claim = await env.DB.prepare('UPDATE worker_push_state SET state_value=? WHERE state_key=? AND state_value=?')
    .bind(upto, CURSOR_KEY, from).run();
  if (claim.meta.changes !== 1) return summary;
  const fcm = pushEnabled(env);
  const web = webPushEnabled(env);
  if (!fcm && !web) return summary;

  const now = Math.floor(Date.now() / 1000);
  const devices = fcm ? (await env.DB.prepare(`SELECT d.user_id,d.token FROM worker_push_devices d
      JOIN worker_sessions s ON s.token_hash=d.session_token_hash AND s.expires_at>?
      JOIN users u ON u.id=d.user_id AND u.aktif=1
    WHERE d.user_id IN (SELECT user_id FROM notifications WHERE id>? AND id<=?)`)
    .bind(now, from, upto).all<DeviceRow>()).results : [];
  const subscriptions = web ? (await env.DB.prepare(`SELECT w.id,w.user_id,w.endpoint,w.p256dh,w.auth,u.role
      FROM worker_webpush_subscriptions w JOIN users u ON u.id=w.user_id AND u.aktif=1
    WHERE w.user_id IN (SELECT user_id FROM notifications WHERE id>? AND id<=?)`)
    .bind(from, upto).all<WebSubscriptionRow>()).results : [];
  if (!devices.length && !subscriptions.length) return summary;
  const unread = new Map((await env.DB.prepare(`SELECT user_id,count(*) AS n FROM notifications
    WHERE is_read=0 AND user_id IN (SELECT user_id FROM notifications WHERE id>? AND id<=?) GROUP BY user_id`)
    .bind(from, upto).all<{ user_id: number; n: number }>()).results.map((r) => [r.user_id, Number(r.n)]));

  // Each job sends one notice to one target and reports whether that target is gone.
  type Job = { key: string; send: () => Promise<PushResult>; remove: D1PreparedStatement };
  const jobs: Job[] = [];
  for (const row of rows) {
    const message = pushMessageFor(row, unread.get(row.user_id));
    for (const device of devices) {
      if (device.user_id !== row.user_id) continue;
      jobs.push({ key: `fcm:${device.token}`, send: () => sendPush(env, device.token, message),
        remove: env.DB.prepare('DELETE FROM worker_push_devices WHERE token=?').bind(device.token) });
    }
    for (const sub of subscriptions) {
      if (sub.user_id !== row.user_id) continue;
      const webMessage: WebPushMessage = {
        title: message.title, body: message.body, tag: `n${row.id}`, badge: message.badge,
        url: webPushUrl(sub.role, message.data.screen),
      };
      jobs.push({ key: `web:${sub.id}`, send: () => sendWebPush(env, sub, webMessage),
        remove: env.DB.prepare('DELETE FROM worker_webpush_subscriptions WHERE id=?').bind(sub.id) });
    }
  }
  const invalid = new Map<string, D1PreparedStatement>();
  for (let i = 0; i < jobs.length; i += SEND_CONCURRENCY) {
    const batch = jobs.slice(i, i + SEND_CONCURRENCY).filter((job) => !invalid.has(job.key));
    const results = await Promise.all(batch.map((job) => job.send()));
    results.forEach((result, index) => {
      if (result === 'sent') summary.sent += 1;
      else if (result === 'invalid') invalid.set(batch[index].key, batch[index].remove);
      else summary.failed += 1;
    });
  }
  for (const statement of invalid.values()) {
    await statement.run();
    summary.removed += 1;
  }
  return summary;
}

/** POST registers the app's FCM token for this session; DELETE removes it. */
export async function pushRegister(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  const user = await currentUser(request, env);
  const sessionHash = await requestTokenHash(request);
  if (!user || !sessionHash) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  const body = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token || token.length > 1024 || /\s/.test(token)) {
    return json({ error: true, message: 'Token peranti tidak sah.' }, 422);
  }
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM worker_push_devices WHERE token=? AND user_id=?').bind(token, user.id).run();
    return json({ error: false, message: 'Peranti dibuang.' });
  }
  const platform = body.platform === 'android' || body.platform === 'ios' ? body.platform : null;
  if (!platform) return json({ error: true, message: 'Platform tidak sah.' }, 422);
  const version = typeof body.app_version === 'string' ? body.app_version.trim().slice(0, 32) : null;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO worker_push_devices(user_id,session_token_hash,platform,token,app_version,
        created_at,last_seen_at)
      VALUES(?,?,?,?,?,datetime('now','+8 hours'),datetime('now','+8 hours'))
      ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,session_token_hash=excluded.session_token_hash,
        platform=excluded.platform,app_version=excluded.app_version,last_seen_at=excluded.last_seen_at`)
      .bind(user.id, sessionHash, platform, token, version || null),
    env.DB.prepare(`DELETE FROM worker_push_devices WHERE user_id=? AND id NOT IN (
        SELECT id FROM worker_push_devices WHERE user_id=? ORDER BY last_seen_at DESC, id DESC LIMIT ?)`)
      .bind(user.id, user.id, MAX_DEVICES_PER_USER),
  ]);
  return json({ error: false, message: 'Peranti didaftarkan.' });
}

/** Lets the app ask the user to update; Android installs come from MOBILE_ANDROID_URL. */
export function mobileVersion(request: Request, env: Env): Response {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  return json({
    error: false,
    min_version: env.MOBILE_MIN_VERSION ?? '1.0.0',
    latest_version: env.MOBILE_LATEST_VERSION ?? '1.0.0',
    android_url: env.MOBILE_ANDROID_URL ?? null,
    ios_url: env.MOBILE_IOS_URL ?? null,
  });
}

/** Public Android download, served from R2 key app/refpahang.apk. */
export async function mobileApk(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  if (new URL(request.url).pathname !== '/app/refpahang.apk') {
    return json({ error: true, message: 'Fail tidak dijumpai.' }, 404);
  }
  const object = request.method === 'HEAD' ? await env.MEDIA.head('app/refpahang.apk') : await env.MEDIA.get('app/refpahang.apk');
  if (!object) return json({ error: true, message: 'App belum tersedia untuk dimuat turun.' }, 404);
  return new Response(request.method === 'HEAD' ? null : (object as R2ObjectBody).body, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="RefPahang.apk"',
      'Content-Length': String(object.size),
      'Cache-Control': 'no-cache',
      ETag: object.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

const BROADCAST_BATCH = 400;

/**
 * Release tool: pushes one message (default: app update ready) to every
 * registered device with a live session. Guarded by the MOBILE_BROADCAST_TOKEN
 * secret, not a user session. Call again with next_offset until it is null.
 */
export async function mobileBroadcast(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const secret = env.MOBILE_BROADCAST_TOKEN ?? '';
  const given = request.headers.get('X-Refpahang-Broadcast-Token') ?? '';
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(secret), digest(given)]);
  if (secret.length < 32 || a.some((byte, i) => byte !== b[i])) {
    return json({ error: true, message: 'Akses ditolak.' }, 403);
  }
  if (!pushEnabled(env)) return json({ error: true, message: 'Push tidak diaktifkan.' }, 503);
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  const body = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 100) : 'Kemas kini RefPahang tersedia';
  const message = typeof body.body === 'string' && body.body.trim() ? body.body.trim().slice(0, 240)
    : 'Buka app untuk memuat turun versi terkini.';
  const screen = typeof body.screen === 'string' && /^[a-z]{1,20}$/.test(body.screen) ? body.screen : 'update';
  const offset = Math.max(0, Number.parseInt(String(body.offset ?? 0), 10) || 0);
  const devices = (await env.DB.prepare(`SELECT d.id,d.token FROM worker_push_devices d
      JOIN worker_sessions s ON s.token_hash=d.session_token_hash AND s.expires_at>?
      JOIN users u ON u.id=d.user_id AND u.aktif=1
    ORDER BY d.id LIMIT ? OFFSET ?`).bind(Math.floor(Date.now() / 1000), BROADCAST_BATCH, offset)
    .all<{ id: number; token: string }>()).results;
  const summary = { sent: 0, failed: 0, removed: 0 };
  const push: PushMessage = { title, body: message, data: { type: 'Kemas Kini App', screen } };
  for (let i = 0; i < devices.length; i += SEND_CONCURRENCY) {
    const batch = devices.slice(i, i + SEND_CONCURRENCY);
    const results = await Promise.all(batch.map((device) => sendPush(env, device.token, push)));
    for (let j = 0; j < results.length; j++) {
      if (results[j] === 'sent') summary.sent += 1;
      else if (results[j] === 'invalid') {
        await env.DB.prepare('DELETE FROM worker_push_devices WHERE id=?').bind(batch[j].id).run();
        summary.removed += 1;
      } else summary.failed += 1;
    }
  }
  // Removed rows shift later devices down, so the next page starts that much earlier.
  const next = devices.length === BROADCAST_BATCH ? offset + BROADCAST_BATCH - summary.removed : null;
  return json({ error: false, ...summary, next_offset: next });
}
