/** Port of config/telegram.php: same payloads, same false-on-failure contract. */
import type { Env } from '../types';
import type { KupOfficial } from './email';
import { appointmentDeadline } from './email';
import { h, masaFmt, noMatchFmt, tarikhFmt } from './format';

export type TelegramSender = (chatId: number | string, text: string,
  replyMarkup: Record<string, unknown> | null) => Promise<boolean>;

let telegramSenderOverride: TelegramSender | null = null;
export function setTelegramSenderForTests(sender: TelegramSender | null): void {
  telegramSenderOverride = sender;
}

export async function tgSend(env: Env, chatId: number | string, text: string,
  replyMarkup: Record<string, unknown> | null = null): Promise<boolean> {
  if (telegramSenderOverride) return telegramSenderOverride(chatId, text, replyMarkup);
  const token = env.TELEGRAM_BOT_TOKEN ?? '';
  if (token === '' || token === 'your_bot_token_here') {
    console.error('[Telegram] Bot token not configured.');
    return false;
  }
  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup !== null) payload.reply_markup = JSON.stringify(replyMarkup);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json().catch(() => null) as { ok?: boolean } | null;
    if (!data?.ok) {
      console.error('[Telegram] API error');
      return false;
    }
    return true;
  } catch {
    console.error('[Telegram] request failed');
    return false;
  }
}

/** Test seam for answerCallbackQuery/editMessageText; same payloads otherwise. */
export type TelegramApiCall = (method: string, payload: Record<string, unknown>) => Promise<void>;
let telegramApiOverride: TelegramApiCall | null = null;
export function setTelegramApiForTests(call: TelegramApiCall | null): void {
  telegramApiOverride = call;
}

async function tgPost(env: Env, method: string, payload: Record<string, unknown>): Promise<void> {
  if (telegramApiOverride) return telegramApiOverride(method, payload);
  const token = env.TELEGRAM_BOT_TOKEN ?? '';
  if (token === '' || token === 'your_bot_token_here') return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(5_000),
    });
  } catch {
    console.error(`[Telegram] ${method} failed`);
  }
}

/** Removes the button spinner, optionally as an alert. */
export function tgAnswerCallback(env: Env, callbackQueryId: string, text = '', showAlert = false): Promise<void> {
  return tgPost(env, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: showAlert });
}

/** Replaces a message and drops its inline buttons. */
export function tgEditMessage(env: Env, chatId: number | string, messageId: number, text: string): Promise<void> {
  return tgPost(env, 'editMessageText', {
    chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true,
    reply_markup: JSON.stringify({ inline_keyboard: [] }),
  });
}

export function tgBatalMessage(nama: string, jawatan: string, kejohanan: string, tarikh: string,
  masa: string, tempat: string, pasukanHome: string, pasukanAway: string, noMatch = '',
  status = 'Dibatalkan', sebab = '', scope: 'perlawanan' | 'lantikan' = 'perlawanan'): string {
  const noFmt = noMatchFmt(noMatch, '');
  const matchLine = `${h(pasukanHome)} lwn ${h(pasukanAway)}`;
  const noLine = noFmt ? `<b>No. Perlawanan:</b> ${noFmt}\n` : '';
  const isPostponed = status === 'Ditangguhkan';
  const tajuk = scope === 'lantikan' ? 'Pembatalan Lantikan'
    : isPostponed ? 'Penangguhan Perlawanan' : 'Pembatalan Perlawanan';
  const statusText = isPostponed ? 'ditangguhkan' : 'dibatalkan';
  const sebabText = sebab !== '' ? `\n<b>Sebab:</b> ${h(sebab)}\n` : '';
  return `<b>⛔ ${tajuk}</b>\n\n`
    + `Assalamualaikum <b>${h(nama)}</b>,\n\n`
    + `Lantikan anda sebagai <b>${h(jawatan)}</b> `
    + `untuk perlawanan berikut telah <b>${statusText}</b>:\n\n`
    + `<b>Kejohanan:</b> ${h(kejohanan)}\n`
    + noLine
    + `<b>Perlawanan:</b> ${matchLine}\n`
    + `<b>Tarikh:</b> ${tarikhFmt(tarikh)}\n`
    + `<b>Masa:</b> ${masaFmt(masa)} MYT\n`
    + `<b>Tempat:</b> ${h(tempat)}\n`
    + `${sebabText}\n<i>Sila hubungi pengurus kejohanan untuk maklumat lanjut.</i>`;
}

export function tgLantikanKeyboard(token: string): Record<string, unknown> {
  return {
    inline_keyboard: [[
      { text: '✅  Terima Tugasan', callback_data: `act:accept:token:${token}` },
      { text: '❌  Tolak Tugasan', callback_data: `act:reject:token:${token}` },
    ]],
  };
}

export function tgKupOfficialsSection(kupOfficials: KupOfficial[], regionLabel: string): string {
  if (kupOfficials.length === 0) return '';
  const lines = kupOfficials.map((official) => `<b>${h(official.jawatan ?? '-')}</b>\n`
    + `Nama: ${h(official.nama ?? '-')}\n`
    + `No. Tel: ${h(official.no_telefon ?? '-')}\n`
    + `${h(regionLabel)}: ${h(official.wilayah ?? '-')}`);
  return `\n\n<b>\u{1F465} Krew KUP Perlawanan</b>\n\n${lines.join('\n\n')}`;
}

export function tgKupCrewCompleteMessage(nama: string, kejohanan: string, tarikh: string,
  masa: string, tempat: string, pasukanHome: string, pasukanAway: string, noMatch: string,
  kupOfficials: KupOfficial[], regionLabel: string): string {
  const noFmt = noMatchFmt(noMatch, '');
  const noLine = noFmt ? `<b>No. Perlawanan:</b> ${noFmt}\n` : '';
  return '<b>✅ Krew KUP Lengkap</b>\n\n'
    + `Assalamualaikum <b>${h(nama)}</b>,\n\n`
    + 'Semua KUP yang dilantik telah menerima lantikan. Gunakan maklumat berikut '
    + 'untuk berhubung dan menyelaras tugasan perlawanan.\n\n'
    + `<b>Kejohanan:</b> ${h(kejohanan)}\n`
    + noLine
    + `<b>Perlawanan:</b> ${h(pasukanHome)} lwn ${h(pasukanAway)}\n`
    + `<b>Tarikh:</b> ${tarikhFmt(tarikh)}\n`
    + `<b>Masa:</b> ${masaFmt(masa)} MYT\n`
    + `<b>Tempat:</b> ${h(tempat)}`
    + tgKupOfficialsSection(kupOfficials, regionLabel);
}

export function tgLantikanMessage(nama: string, jawatan: string, kejohanan: string,
  tarikh: string, masa: string, tempat: string, pasukanHome: string, pasukanAway: string,
  noMatch = '', jenisKejohanan = 'Persahabatan', kupOfficials: KupOfficial[] = [],
  regionLabel = 'Negeri'): string {
  const noFmt = noMatchFmt(noMatch, '');
  const matchLine = `${h(pasukanHome)} lwn ${h(pasukanAway)}`;
  const noLine = noFmt ? `<b>No. Perlawanan:</b> ${noFmt}\n` : '';
  const deadline = appointmentDeadline(jenisKejohanan, tarikh, masa);
  return '<b>\u{1F3DF} Lantikan Pengadil</b>\n\n'
    + `Assalamualaikum <b>${h(nama)}</b>,\n\n`
    + `Anda telah dilantik sebagai <b>${h(jawatan)}</b> `
    + 'untuk perlawanan berikut:\n\n'
    + `<b>Kejohanan:</b> ${h(kejohanan)}\n`
    + noLine
    + `<b>Perlawanan:</b> ${matchLine}\n`
    + `<b>Tarikh:</b> ${tarikhFmt(tarikh)}\n`
    + `<b>Masa:</b> ${masaFmt(masa)} MYT\n`
    + `<b>Tempat:</b> ${h(tempat)}`
    + `${tgKupOfficialsSection(kupOfficials, regionLabel)}\n\n`
    + '⚠️ <b>Garis Masa Jawapan:</b>\n'
    + `Sila <b>terima atau tolak</b> tugasan ini <b>${deadline.sentence}</b>.\n\n`
    + `ℹ️ <i>${deadline.rule}</i>`;
}
