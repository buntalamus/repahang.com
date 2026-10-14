import { currentUser, json } from './auth';
import type { Env } from './types';

export async function telegramLinkSelf(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: true, message: 'Sila log masuk.' }, 401);
  const row = await env.DB.prepare('SELECT telegram_chat_id,tg_link_token FROM users WHERE id=? AND aktif=1')
    .bind(actor.id).first<{ telegram_chat_id: number | null; tg_link_token: string | null }>();
  if (!row) return json({ error: true, message: 'Pengguna tidak ditemui.' }, 404);
  if (row.telegram_chat_id) {
    return json({ error: false, linked: true, message: 'Telegram telah dihubungkan.' });
  }
  let token = row.tg_link_token;
  if (!token) {
    if (env.STAGING_WRITES_ENABLED !== '1') {
      return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
    }
    const generated = Array.from(crypto.getRandomValues(new Uint8Array(16)),
      (byte) => byte.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('UPDATE users SET tg_link_token=? WHERE id=? AND tg_link_token IS NULL AND telegram_chat_id IS NULL')
      .bind(generated, actor.id).run();
    const fresh = await env.DB.prepare('SELECT tg_link_token FROM users WHERE id=?')
      .bind(actor.id).first<{ tg_link_token: string | null }>();
    token = fresh?.tg_link_token ?? null;
  }
  if (!token) return json({ error: true, message: 'Pautan Telegram tidak tersedia.' }, 409);
  return json({ error: false, linked: false,
    link_url: `https://t.me/${encodeURIComponent(env.TELEGRAM_BOT_USERNAME || 'refpahang_bot')}?start=${token}` });
}
