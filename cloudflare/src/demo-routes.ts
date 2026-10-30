/** Demo-only endpoints (see demo.ts). Both answer 404 outside DEMO_MODE. */
import { json } from './auth';
import type { SessionUser } from './auth';
import { DEMO_ACCOUNTS, DEMO_CLOSED_MESSAGE, demoOpen, isDemo } from './demo';
import type { Env } from './types';

/** GET /api/demo-info.php: public account list for the login page; 404 outside the demo. */
export async function demoInfo(request: Request, env: Env): Promise<Response> {
  if (!isDemo(env)) return json({ error: true, message: 'Tidak dijumpai.' }, 404);
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const open = await demoOpen(env);
  return json({ demo: true, open, ...(open ? {} : { message: DEMO_CLOSED_MESSAGE }), accounts: DEMO_ACCOUNTS });
}

/** GET /api/demo-status.php on production: whether the Admin has opened the demo. */
export async function demoStatus(request: Request, env: Env): Promise<Response> {
  if (isDemo(env)) return json({ error: true, message: 'Tidak dijumpai.' }, 404);
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const row = await env.DB.prepare("SELECT setting_value FROM application_settings WHERE setting_key='demo_enabled'")
    .first<{ setting_value: string }>();
  return json({ enabled: row?.setting_value === '1' });
}

/** GET /api/admin-demo-outbox.php?channel=&q=&page=: messages kept from fictional recipients. */
export async function adminDemoOutbox(request: Request, env: Env, user: SessionUser | null): Promise<Response> {
  if (!isDemo(env)) return json({ error: true, message: 'Tidak dijumpai.' }, 404);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak. Hanya pentadbir dibenarkan.' }, 403);
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const url = new URL(request.url);
  const channel = url.searchParams.get('channel');
  const q = (url.searchParams.get('q') ?? '').trim();
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get('page')) || 1));
  const perPage = 50;
  const where: string[] = [];
  const values: (string | number)[] = [];
  if (channel === 'email' || channel === 'telegram') { where.push('channel=?'); values.push(channel); }
  if (q) { where.push('(recipient LIKE ? OR subject LIKE ? OR body LIKE ?)'); values.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await env.DB.prepare(`SELECT count(*) AS n FROM demo_outbox ${clause}`).bind(...values).first<{ n: number }>();
  const rows = (await env.DB.prepare(`SELECT id,channel,recipient,subject,body,created_at FROM demo_outbox ${clause}
    ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...values, perPage, (page - 1) * perPage).all()).results;
  return json({ success: true, data: rows, total: Number(total?.n ?? 0), page, per_page: perPage });
}
