import { currentUser, json } from './auth';
import type { Env } from './types';

export async function telegramLinkSelf(request: Request, env: Env): Promise<Response> {
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  const row = await env.DB.prepare('SELECT telegram_chat_id,tg_link_token FROM users WHERE id=? AND aktif=1')
    .bind(actor.id).first<{ telegram_chat_id: number | null; tg_link_token: string | null }>();
  if (!row) return json({ error: true, message: 'Pengguna tidak ditemui.' }, 404);
  if (String(row.telegram_chat_id ?? '').trim()) {
    return json({ error: false, linked: true, message: 'Telegram telah dihubungkan.' });
  }
  let token = String(row.tg_link_token ?? '').trim() || null;
  if (!token) {
    if (env.STAGING_WRITES_ENABLED !== '1') {
      return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
    }
    const generated = Array.from(crypto.getRandomValues(new Uint8Array(16)),
      (byte) => byte.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare(`UPDATE users SET tg_link_token=? WHERE id=? AND trim(COALESCE(tg_link_token,''))='' AND trim(COALESCE(telegram_chat_id,''))=''`)
      .bind(generated, actor.id).run();
    const fresh = await env.DB.prepare('SELECT tg_link_token,telegram_chat_id FROM users WHERE id=?')
      .bind(actor.id).first<{ tg_link_token: string | null; telegram_chat_id: string | null }>();
    if (String(fresh?.telegram_chat_id ?? '').trim()) return json({error:false,linked:true,message:'Telegram telah dihubungkan.'});
    token = fresh?.tg_link_token ?? null;
  }
  if (!token) return json({ error: true, message: 'Pautan Telegram tidak tersedia.' }, 409);
  return json({ error: false, linked: false,
    link_url: `https://t.me/${encodeURIComponent(env.TELEGRAM_BOT_USERNAME || 'refpahang_bot')}?start=${token}` });
}
