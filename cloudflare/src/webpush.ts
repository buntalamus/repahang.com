/**
 * Web Push for the website installed as a PWA (notably iPhone, iOS 16.4+).
 * Payloads are encrypted per RFC 8291 (aes128gcm) and authorised with VAPID
 * (RFC 8292), all with WebCrypto. Subscriptions are stored per user and fed
 * by the same notifications cursor as the mobile app (processPushQueue).
 */
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

/** Push services browsers use; anything else is refused so we never POST to arbitrary URLs. */
const PUSH_HOSTS = [
  /(^|\.)push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
];
const MAX_SUBSCRIPTIONS_PER_USER = 10;
const encoder = new TextEncoder();

type Bytes = Uint8Array<ArrayBuffer>;

export interface WebPushSubscription { endpoint: string; p256dh: string; auth: string }

export interface WebPushMessage {
  title: string;
  body: string;
  url: string;
  /** App tab for the web build (/app/): lantikan, permohonan, sejarah or notifikasi. */
  screen: string;
  tag: string;
  badge?: number;
}

export type WebPushResult = 'sent' | 'invalid' | 'failed';

export function webPushEnabled(env: Env): boolean {
  return env.PUSH_ENABLED === '1' && !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY;
}

export function base64UrlDecode(value: string): Bytes {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** RFC 8291 aes128gcm body for one subscription (single record). */
export async function encryptPayload(p256dh: string, auth: string, payload: Bytes): Promise<Bytes> {
  const uaPublic = base64UrlDecode(p256dh);
  const authSecret = base64UrlDecode(auth);
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(encoder.encode('WebPush: info\u0000'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\u0000'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\u0000'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02 marks the last (only) record; no extra padding.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

const jwtCache = new Map<string, { token: string; expiresAt: number }>();

/** VAPID `Authorization` header value for the push service of [endpoint]. */
export async function vapidAuthorization(env: Env, endpoint: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const cached = jwtCache.get(audience);
  if (cached && cached.expiresAt > now + 600) return `vapid t=${cached.token}, k=${env.VAPID_PUBLIC_KEY}`;
  const publicKey = base64UrlDecode(env.VAPID_PUBLIC_KEY ?? '');
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
    d: env.VAPID_PRIVATE_KEY,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const expiresAt = now + 12 * 3600;
  const unsigned = `${base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))}.${base64UrlEncode(
    encoder.encode(JSON.stringify({ aud: audience, exp: expiresAt, sub: env.VAPID_SUBJECT ?? 'mailto:sokongan@pbnppahang.my' })))}`;
  // WebCrypto ECDSA returns the raw r||s form JWS ES256 expects.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)));
  const token = `${unsigned}.${base64UrlEncode(signature)}`;
  jwtCache.set(audience, { token, expiresAt });
  return `vapid t=${token}, k=${env.VAPID_PUBLIC_KEY}`;
}

/** Sends one notification. 'invalid' means the subscription is gone and should be removed. */
export async function sendWebPush(env: Env, subscription: WebPushSubscription, message: WebPushMessage): Promise<WebPushResult> {
  try {
    const body = await encryptPayload(subscription.p256dh, subscription.auth, encoder.encode(JSON.stringify(message)));
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuthorization(env, subscription.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'high',
      },
      body,
    });
    if (response.ok) return 'sent';
    if (response.status === 404 || response.status === 410) return 'invalid';
    console.error('[webpush] send failed', response.status);
    return 'failed';
  } catch {
    return 'failed';
  }
}

/** Website page a tapped notification opens, by role and notice screen. */
export function webPushUrl(role: string, screen: string): string {
  if (/^pengumuman:[1-9]\d*$/.test(screen)) return `/app/?screen=${encodeURIComponent(screen)}`;
  const pages: Record<string, Record<string, string>> = {
    lantikan: { Pengadil: '/pengadil/tugasan', 'PP Daerah': '/pp-daerah/tugasan', Penilai: '/penilai/tugasan', Admin: '/admin/lantikan' },
    permohonan: {
      Pengadil: '/pengadil/permohonan/berdaftar', 'PP Daerah': '/pp-daerah/pengesahan',
      Penilai: '/penilai/permohonan/tahunan', Admin: '/admin/permohonan',
    },
    sejarah: { Pengadil: '/pengadil/perlawanan', 'PP Daerah': '/pp-daerah/pengesahan-perlawanan', Penilai: '/penilai/penilaian', Admin: '/admin' },
  };
  const home: Record<string, string> = { Pengadil: '/pengadil', 'PP Daerah': '/pp-daerah', Penilai: '/penilai', Admin: '/admin' };
  return pages[screen]?.[role] ?? home[role] ?? '/';
}

function validSubscription(input: Record<string, unknown>): WebPushSubscription | null {
  const endpoint = typeof input.endpoint === 'string' ? input.endpoint.trim() : '';
  const keys = (input.keys && typeof input.keys === 'object' ? input.keys : {}) as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const auth = typeof keys.auth === 'string' ? keys.auth : '';
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || endpoint.length > 1024 || !PUSH_HOSTS.some((host) => host.test(url.hostname))) return null;
  try {
    const publicKey = base64UrlDecode(p256dh);
    if (publicKey.length !== 65 || publicKey[0] !== 4 || base64UrlDecode(auth).length !== 16) return null;
  } catch {
    return null;
  }
  return { endpoint, p256dh, auth };
}

/** GET: the VAPID public key the browser subscribes with (null while disabled). */
export function webPushKey(request: Request, env: Env): Response {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  return json({ error: false, public_key: webPushEnabled(env) ? env.VAPID_PUBLIC_KEY : null });
}

/** POST stores this browser's subscription for the signed-in user; DELETE removes it. */
export async function webPushSubscribe(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  const body = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  if (request.method === 'DELETE') {
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
    await env.DB.prepare('DELETE FROM worker_webpush_subscriptions WHERE endpoint=? AND user_id=?').bind(endpoint, user.id).run();
    return json({ error: false, message: 'Notifikasi dimatikan pada peranti ini.' });
  }
  if (!webPushEnabled(env)) return json({ error: true, message: 'Notifikasi pelayar belum diaktifkan.' }, 503);
  const subscription = validSubscription(body);
  if (!subscription) return json({ error: true, message: 'Langganan notifikasi tidak sah.' }, 422);
  const agent = (request.headers.get('User-Agent') ?? '').slice(0, 200);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO worker_webpush_subscriptions(user_id,endpoint,p256dh,auth,user_agent,created_at,last_seen_at)
      VALUES(?,?,?,?,?,datetime('now','+8 hours'),datetime('now','+8 hours'))
      ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,
        user_agent=excluded.user_agent,last_seen_at=excluded.last_seen_at`)
      .bind(user.id, subscription.endpoint, subscription.p256dh, subscription.auth, agent || null),
    env.DB.prepare(`DELETE FROM worker_webpush_subscriptions WHERE user_id=? AND id NOT IN (
        SELECT id FROM worker_webpush_subscriptions WHERE user_id=? ORDER BY last_seen_at DESC, id DESC LIMIT ?)`)
      .bind(user.id, user.id, MAX_SUBSCRIPTIONS_PER_USER),
  ]);
  return json({ error: false, message: 'Notifikasi diaktifkan pada peranti ini.' });
}
