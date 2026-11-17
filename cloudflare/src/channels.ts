/**
 * Whether a user can be reached without email: the mobile app (an FCM device
 * with a live app session) or a Web Push subscription (iPhone app / browser).
 * Email is the fallback channel; see notify.ts and docs/CHANGELOG.md.
 */
import type { Env } from './types';

/** SQL-only expression; callers supply a trusted user-id column, never request input. */
export const appChannelSql = (userId: string): string => `(
  EXISTS(SELECT 1 FROM worker_push_devices d JOIN worker_sessions s
    ON s.token_hash=d.session_token_hash AND s.user_id=d.user_id AND s.expires_at>unixepoch()
    WHERE d.user_id=${userId} AND trim(d.token)<>'')
  OR EXISTS(SELECT 1 FROM worker_webpush_subscriptions w WHERE w.user_id=${userId}))`;

export async function hasAppChannel(env: Env, userId: number | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const row = await env.DB.prepare(`SELECT ${appChannelSql('?')} AS reachable`)
      .bind(userId, userId).first<{ reachable: number }>();
    return Number(row?.reachable) === 1;
  } catch {
    // Tables missing (older DB): treat as unreachable so email still goes out.
    return false;
  }
}

/**
 * For staff notices that already wrote an in-app notice: sends [telegramText]
 * when the user has Telegram linked and returns true when Telegram or the app
 * reached them, so the caller can skip the email.
 */
export async function reachStaff(env: Env, userId: number, telegramText: string): Promise<boolean> {
  const { tgSend } = await import('./php/telegram');
  const user = await env.DB.prepare('SELECT telegram_chat_id FROM users WHERE id=?')
    .bind(userId).first<{ telegram_chat_id: string | number | null }>();
  const chat = String(user?.telegram_chat_id ?? '').trim();
  let telegram = false;
  if (/^-?\d+$/.test(chat)) {
    try { telegram = await tgSend(env, chat, telegramText); } catch { telegram = false; }
  }
  return telegram || await hasAppChannel(env, userId);
}
