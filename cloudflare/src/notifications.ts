import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

export async function notifications(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);

  if (request.method === 'GET') {
    const [rows, count] = await Promise.all([
      env.DB.prepare(`
        SELECT id, type, subject, message, is_read, created_at
        FROM notifications WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 50
      `).bind(user.id).all(),
      env.DB.prepare('SELECT COUNT(*) AS total FROM notifications WHERE user_id=? AND is_read=0')
        .bind(user.id).first<{ total: number }>(),
    ]);
    return json({ error: false, notifications: rows.results, unread_count: count?.total ?? 0 });
  }
  if (request.method !== 'POST') {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Data tidak sah.' }, 400);
  }
  const body = input as Record<string, unknown>;
  if (body.action === 'mark_all_read') {
    await env.DB.prepare('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0')
      .bind(user.id).run();
    return json({ error: false, message: 'All notifications marked as read' });
  }
  if (body.action === 'mark_read') {
    const raw = String(body.notification_id ?? '');
    if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
      return json({ error: true, message: 'ID notifikasi tidak sah.' }, 400);
    }
    const result = await env.DB.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?')
      .bind(Number(raw), user.id).run();
    if (result.meta.changes === 0) {
      return json({ error: true, message: 'Notifikasi tidak dijumpai.' }, 404);
    }
    return json({ error: false, message: 'Notification marked as read' });
  }
  return json({ error: true, message: 'Tindakan tidak sah.' }, 400);
}

export async function announcements(request: Request, env: Env): Promise<Response> {
  if (!await currentUser(request, env)) {
    return json({ error: true, message: 'Sila log masuk.' }, 401);
  }
  const idRaw = new URL(request.url).searchParams.get('id');
  if (idRaw !== null) {
    if (!/^[1-9][0-9]*$/.test(idRaw) || !Number.isSafeInteger(Number(idRaw))) {
      return json({ error: true, message: 'ID pengumuman tidak sah.' }, 400);
    }
    const row = await env.DB.prepare('SELECT id,title,content,created_by,created_at FROM announcements WHERE id=?')
      .bind(Number(idRaw)).first();
    if (!row) return json({ error: true, message: 'Pengumuman tidak ditemui' }, 404);
    return json({ error: false, announcement: formatAnnouncement(row) });
  }
  const rows = await env.DB.prepare('SELECT id,title,content,created_by,created_at FROM announcements ORDER BY created_at DESC, id DESC').all();
  return json({ error: false, announcements: rows.results.map(formatAnnouncement) });
}

function formatAnnouncement(row: Record<string, unknown>): Record<string, unknown> {
  const raw = String(row.created_at ?? '');
  const date = raw.slice(0, 10).split('-');
  const time = raw.slice(11, 16);
  return {
    ...row,
    created_at_formatted: date.length === 3 ? `${date[2]}/${date[1]}/${date[0]} ${time}`.trim() : raw,
  };
}
