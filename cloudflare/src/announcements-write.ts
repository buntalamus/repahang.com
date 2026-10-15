/** POST/PUT/DELETE half of api/announcements.php. GET stays in notifications.ts. */
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import { wroteRow } from './d1-changes';
import type { Env } from './types';
import { announceOnTelegram } from './announcement-telegram';

function announcementId(request: Request): number | null {
  const raw = new URL(request.url).searchParams.get('id');
  const id = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function titleAndContent(request: Request): Promise<{ title: string; content: string } | Response> {
  const parsed = await boundedJson(request, 64 * 1024);
  if (parsed instanceof Response) return parsed;
  const input = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
  const title = String(input.title ?? '').trim();
  const content = String(input.content ?? '').trim();
  if (!title || !content) return json({ error: true, message: 'Tajuk dan kandungan diperlukan' }, 400);
  return { title, content };
}

export async function announcementsWrite(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah' }, 401);
  const verb = ({ POST: 'membuat', PUT: 'mengedit', DELETE: 'memadam' } as Record<string, string>)[request.method];
  if (!verb) return json({ error: true, message: 'Kaedah tidak dibenarkan' }, 405);
  if (user.role !== 'Admin') {
    return json({ error: true, message: `Hanya admin boleh ${verb} pengumuman` }, 403);
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  if (request.method === 'POST') {
    const fields = await titleAndContent(request);
    if (fields instanceof Response) return fields;
    const result = await env.DB.prepare('INSERT INTO announcements (title, content, created_by) VALUES (?, ?, ?)')
      .bind(fields.title, fields.content, user.id).run();
    // PDO::lastInsertId() returns a string here; PHP did not cast it.
    const id = Number(result.meta.last_row_id);
    const delivery = announceOnTelegram(env, id, fields.title, fields.content)
      .catch((error) => console.error('[Announcement Telegram] dispatch failed', { announcement_id: id, error: String(error) }));
    if (ctx) {
      ctx.waitUntil(delivery);
      return json({ error: false, message: 'Pengumuman berjaya dibuat. Hebahan Telegram sedang dihantar.', id: String(id) });
    }
    await delivery;
    return json({ error: false, message: 'Pengumuman berjaya dibuat dan hebahan Telegram telah diproses.', id: String(id) });
  }
  const id = announcementId(request);
  if (!id) return json({ error: true, message: 'ID pengumuman diperlukan' }, 400);
  if (request.method === 'PUT') {
    const fields = await titleAndContent(request);
    if (fields instanceof Response) return fields;
    // MySQL's rowCount() counts changed rows, so PHP answered 404 when the
    // title and content were saved unchanged. Kept for parity.
    const result = await env.DB.prepare(`
      UPDATE announcements SET title=?, content=?
      WHERE id=? AND (title IS NOT ? COLLATE BINARY OR content IS NOT ? COLLATE BINARY)
    `).bind(fields.title, fields.content, id, fields.title, fields.content).run();
    if (!wroteRow(result)) return json({ error: true, message: 'Pengumuman tidak ditemui' }, 404);
    return json({ error: false, message: 'Pengumuman berjaya dikemaskini' });
  }
  const result = await env.DB.prepare('DELETE FROM announcements WHERE id=?').bind(id).run();
  if (!wroteRow(result)) return json({ error: true, message: 'Pengumuman tidak ditemui' }, 404);
  return json({ error: false, message: 'Pengumuman berjaya dipadam' });
}
