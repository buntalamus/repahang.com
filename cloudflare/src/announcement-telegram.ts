import type { Env } from './types';
import { tgSend } from './php/telegram';
import { h } from './php/format';

interface RecipientRow { chat_id: string; }

function excerpt(value: string, maximum = 2_800): string {
  let safe = '';
  for (const character of value) {
    const escaped = h(character);
    if (safe.length + escaped.length > maximum) return `${safe}…`;
    safe += escaped;
  }
  return safe;
}

function announcementMessage(title: string, content: string): string {
  return '📢 <b>HEBAHAN RASMI PENGADIL PAHANG</b>\n\n'
    + `<b>${excerpt(title, 400)}</b>\n\n`
    + `${excerpt(content)}\n\n`
    + '<i>Maklumat lanjut boleh dibaca di Portal Pengadil Pahang.</i>';
}

async function recipients(env: Env): Promise<string[]> {
  const result = await env.DB.prepare(`
    SELECT DISTINCT chat_id FROM (
      SELECT trim(CAST(telegram_chat_id AS TEXT)) AS chat_id FROM users
      WHERE trim(COALESCE(CAST(telegram_chat_id AS TEXT),''))<>''
      UNION
      SELECT trim(CAST(telegram_chat_id AS TEXT)) AS chat_id FROM pengadil_luar
      WHERE trim(COALESCE(CAST(telegram_chat_id AS TEXT),''))<>''
    ) WHERE chat_id<>''
  `).all<RecipientRow>();
  return result.results.map(row => row.chat_id);
}

export async function announceOnTelegram(env: Env, id: number, title: string, content: string): Promise<number> {
  const targets = await recipients(env);
  const message = announcementMessage(title, content);
  const button = { inline_keyboard: [[{
    text: 'Buka Portal Pengadil',
    url: new URL('/login', env.BASE_URL).toString(),
  }]] };
  let sent = 0;
  for (let start = 0; start < targets.length; start += 20) {
    const batch = targets.slice(start, start + 20);
    const results = await Promise.all(batch.map(chatId => tgSend(env, chatId, message, button)));
    sent += results.filter(Boolean).length;
    if (start + 20 < targets.length) await new Promise(resolve => setTimeout(resolve, 750));
  }
  console.info('[Announcement Telegram] completed', { announcement_id: id, recipients: targets.length, sent, failed: targets.length - sent });
  return targets.length;
}
