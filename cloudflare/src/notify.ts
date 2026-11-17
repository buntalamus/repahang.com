/**
 * Shared email + Telegram + portal notices for events that had no outbound
 * notification. Inline sends never throw; bulk or background notices are
 * written to worker_notification_outbox inside the caller's D1 batch and
 * delivered by processNotificationOutbox() (cron and ctx.waitUntil).
 *
 * Routine notices use Telegram/app first, with email as fallback. Formal and
 * security notices set email: 'always': attempt email first, then Telegram/app.
 */
import type { MailType } from '../mail';
import type { Env } from './types';
import { buildEmailTemplate, emailAlert, emailButton, emailGreeting, emailInfoTable, emailPara,
  sendEmail } from './php/email';
import { h } from './php/format';
import { tgSend } from './php/telegram';
import { NOW, recordLantikanAudit } from './php/lantikan-audit';
import { hasAppChannel } from './channels';

export type ChannelResult = 'sent' | 'failed' | 'skipped';

export interface Recipient {
  userId?: number | null;
  luarId?: number | null;
  name: string;
  email?: string | null;
  telegramChatId?: string | number | null;
}

export interface Notice {
  subject: string;
  title: string;
  accent?: string;
  mailType?: MailType;
  /** Plain text; escaped when rendered. */
  paragraphs: string[];
  /** Plain-text label/value pairs; escaped when rendered. */
  rows?: Array<[string, string]>;
  alert?: { label: string; text: string; tone?: 'info' | 'warn' | 'danger' };
  actions?: Array<{ label: string; url: string }>;
  /** false: no Telegram. markup: inline keyboard sent with the default text. */
  telegram?: false | { text?: string; markup?: Record<string, unknown> | null };
  /** In-app notice; only used when the recipient has a userId. */
  portal?: { type: string; subject: string; message: string };
  /** Outbox only: skip delivery unless this appointment is still unanswered with this tarikh_notif. */
  precondition?: { lantikanId: number; tarikhNotif: string };
  /** 'always' attempts email FIRST, then Telegram/app; 'fallback' uses email only when needed. */
  email?: 'always' | 'fallback';
  /** Set by the outbox: an in-app notice (and so an app push) was written with this notice. */
  portalWritten?: boolean;
}

export interface NoticeResult { email: ChannelResult; telegram: ChannelResult; portal: ChannelResult }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALERT_COLORS = {
  info: ['#2563EB', '#EFF6FF'],
  warn: ['#F59E0B', '#FFFBEB'],
  danger: ['#DC2626', '#FEF2F2'],
} as const;

export function validEmail(value: unknown): value is string {
  const text = String(value ?? '').trim();
  return text.length > 0 && text.length <= 254 && EMAIL_PATTERN.test(text);
}

function chatId(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return /^-?\d+$/.test(text) ? text : null;
}

function multiline(text: string): string {
  return h(text).replace(/\r?\n/g, '<br>');
}

export function renderNoticeEmail(notice: Notice, name: string): string {
  let body = emailGreeting(name);
  for (const paragraph of notice.paragraphs) body += emailPara(multiline(paragraph));
  if (notice.rows?.length) {
    body += emailInfoTable(notice.rows.map(([label, value]): [string, string] => [label, multiline(value)]));
  }
  if (notice.alert) {
    const [border, bg] = ALERT_COLORS[notice.alert.tone ?? 'info'];
    body += emailAlert(border, bg, h(notice.alert.label), multiline(notice.alert.text));
  }
  for (const action of notice.actions ?? []) body += emailButton(h(action.url), h(action.label));
  body += `<p style="color:#9CA3AF;font-size:11px;margin:24px 0 0;line-height:1.6;">
           Ini adalah notifikasi automatik daripada Sistem Pengurusan Pengadil PBNP.</p>`;
  return buildEmailTemplate(h(notice.title), notice.accent ?? '#111827', '', body);
}

export function renderNoticeTelegram(notice: Notice, name: string): string {
  if (notice.telegram && notice.telegram.text) return notice.telegram.text;
  let text = `<b>${h(notice.title)}</b>\n\nAssalamualaikum <b>${h(name)}</b>,\n\n`;
  text += notice.paragraphs.map((paragraph) => h(paragraph)).join('\n\n');
  if (notice.rows?.length) {
    text += `\n\n${notice.rows.map(([label, value]) => `<b>${h(label)}:</b> ${h(value)}`).join('\n')}`;
  }
  if (notice.alert) text += `\n\n<b>${h(notice.alert.label)}:</b> ${h(notice.alert.text)}`;
  for (const action of notice.actions ?? []) text += `\n\n${h(action.label)}: ${h(action.url)}`;
  return Array.from(text).length > 4000 ? `${Array.from(text).slice(0, 3990).join('')}…` : text;
}

function telegramMarkup(notice: Notice): Record<string, unknown> | null {
  return notice.telegram ? notice.telegram.markup ?? null : null;
}

/** Formal: email first; routine: Telegram/app first. Email failures do not block the other channels. */
export async function notifyUser(env: Env, recipient: Recipient, notice: Notice): Promise<NoticeResult> {
  const result: NoticeResult = { email: 'skipped', telegram: 'skipped', portal: 'skipped' };
  const name = recipient.name || String(recipient.email ?? '');
  const email = async () => {
    if (validEmail(recipient.email)) result.email = await sendEmail(env, String(recipient.email).trim(), notice.subject,
      renderNoticeEmail(notice, name), name, notice.mailType ?? 'admin') ? 'sent' : 'failed';
  };
  if (notice.email === 'always') await email();
  const chat = chatId(recipient.telegramChatId);
  if (chat && notice.telegram !== false) {
    try {
      result.telegram = await tgSend(env, chat, renderNoticeTelegram(notice, name), telegramMarkup(notice))
        ? 'sent' : 'failed';
    } catch {
      result.telegram = 'failed';
    }
  }
  if (recipient.userId && notice.portal) {
    try {
      await env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,email_sent,is_read,created_at)
        VALUES(?,?,?,?,0,0,${NOW})`).bind(recipient.userId, notice.portal.type, notice.portal.subject,
        notice.portal.message).run();
      result.portal = 'sent';
    } catch {
      result.portal = 'failed';
    }
  }
  const reachedElsewhere = result.telegram === 'sent'
    || (result.portal === 'sent' && await hasAppChannel(env, recipient.userId));
  if (notice.email !== 'always' && !reachedElsewhere) await email();
  return result;
}

/** notifyUser() for several recipients; returns how many got at least one channel. */
export async function notifyAll(env: Env, recipients: Recipient[], notice: Notice | ((r: Recipient) => Notice)):
  Promise<number> {
  let reached = 0;
  for (const recipient of recipients) {
    const result = await notifyUser(env, recipient, typeof notice === 'function' ? notice(recipient) : notice);
    if (result.email === 'sent' || result.telegram === 'sent' || result.portal === 'sent') reached += 1;
  }
  return reached;
}

export interface EnqueueOptions {
  kind: string;
  lantikanId?: number | null;
  /** SQL condition; the rows are written only when it holds at batch time. */
  guardSql?: string;
  guardBinds?: unknown[];
}

/**
 * Statements that queue the notice (email + Telegram rows, plus the in-app
 * notice written directly). Add them to the D1 batch of the change itself.
 */
export function enqueueNoticeStatements(env: Env, dedupeKey: string, recipient: Recipient, notice: Notice,
  options: EnqueueOptions): D1PreparedStatement[] {
  const guard = options.guardSql ?? '1';
  const guardBinds = options.guardBinds ?? [];
  const name = recipient.name || String(recipient.email ?? '');
  const payload = JSON.stringify({ ...notice, portal: undefined, portalWritten: Boolean(recipient.userId && notice.portal) });
  const statements: D1PreparedStatement[] = [];
  // Formal notices attempt email first; routine notices try Telegram before email.
  const channels: Array<['email' | 'telegram', string | null]> = [
    ['telegram', notice.telegram === false ? null : chatId(recipient.telegramChatId)],
    ['email', validEmail(recipient.email) ? String(recipient.email).trim() : null],
  ];
  if (notice.email === 'always') channels.reverse();
  for (const [channel, address] of channels) {
    if (!address) continue;
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO worker_notification_outbox
        (dedupe_key,kind,channel,recipient_user_id,recipient_luar_id,address,recipient_name,mail_type,
         payload_json,lantikan_id,status,attempts,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,'pending',0,${NOW} WHERE ${guard}`)
      .bind(`${dedupeKey}:${channel}`, options.kind, channel, recipient.userId ?? null, recipient.luarId ?? null,
        address, name, notice.mailType ?? 'admin', payload, options.lantikanId ?? null, ...guardBinds));
  }
  if (recipient.userId && notice.portal) {
    statements.push(env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,email_sent,is_read,created_at)
      SELECT ?,?,?,?,0,0,${NOW} WHERE ${guard}`).bind(recipient.userId, notice.portal.type,
      notice.portal.subject, notice.portal.message, ...guardBinds));
  }
  return statements;
}

interface OutboxRow {
  id: number;
  dedupe_key: string;
  recipient_user_id: number | null;
  kind: string;
  channel: 'email' | 'telegram';
  address: string;
  recipient_name: string;
  mail_type: MailType;
  payload_json: string;
  lantikan_id: number | null;
  attempts: number;
}

const MAX_ATTEMPTS = 5;

export function notificationOutboxEnabled(env: Env): boolean {
  return env.STAGING_WRITES_ENABLED === '1';
}

/** Delivers queued notices. Safe to run concurrently: rows are claimed with UPDATE … RETURNING. */
export async function processNotificationOutbox(env: Env, limit = 25):
  Promise<{ sent: number; failed: number; skipped: number }> {
  const summary = { sent: 0, failed: 0, skipped: 0 };
  if (!notificationOutboxEnabled(env)) return summary;
  // A Worker that died after claiming may already have delivered; never resend those.
  await env.DB.prepare(`UPDATE worker_notification_outbox SET status='uncertain',
      last_error='Penghantaran terhenti sebelum status direkodkan.',completed_at=${NOW}
    WHERE status='processing' AND claimed_at<=datetime('now','+8 hours','-15 minutes')`).run();
  const claimed = await env.DB.prepare(`UPDATE worker_notification_outbox
      SET status='processing',claimed_at=${NOW},attempts=attempts+1
    WHERE id IN (SELECT id FROM worker_notification_outbox WHERE status='pending'
        AND (next_attempt_at IS NULL OR next_attempt_at<=${NOW}) ORDER BY id LIMIT ?)
      AND status='pending'
    RETURNING id,dedupe_key,recipient_user_id,kind,channel,address,recipient_name,mail_type,payload_json,lantikan_id,attempts`)
    .bind(limit).all<OutboxRow>();
  for (const row of claimed.results.sort((a, b) => a.id - b.id)) {
    let notice: Notice;
    try {
      notice = JSON.parse(row.payload_json) as Notice;
    } catch {
      await finish(env, row, 'failed', 'Payload tidak sah.');
      summary.failed += 1;
      continue;
    }
    if (notice.precondition) {
      const still = await env.DB.prepare(`SELECT 1 FROM lantikan_pengadil
        WHERE id=? AND status='Belum Jawab' AND tarikh_notif=?`)
        .bind(notice.precondition.lantikanId, notice.precondition.tarikhNotif).first();
      if (!still) {
        await finish(env, row, 'skipped', 'Lantikan telah dijawab atau dihantar semula.');
        summary.skipped += 1;
        continue;
      }
    }
    if (row.channel === 'email' && notice.email !== 'always') {
      const fallback = await emailFallbackState(env, row, notice);
      if (fallback === 'reached') {
        await finish(env, row, 'skipped', 'Diterima melalui Telegram atau app.');
        summary.skipped += 1;
        continue;
      }
      if (fallback === 'wait') {
        // Telegram for the same notice is still being retried; decide after it settles.
        await env.DB.prepare(`UPDATE worker_notification_outbox SET status='pending',attempts=attempts-1,
            next_attempt_at=datetime('now','+8 hours','+5 minutes') WHERE id=? AND status='processing'`).bind(row.id).run();
        continue;
      }
    }
    let delivered = false;
    try {
      delivered = row.channel === 'email'
        ? await sendEmail(env, row.address, notice.subject, renderNoticeEmail(notice, row.recipient_name),
          row.recipient_name, row.mail_type)
        : await tgSend(env, row.address, renderNoticeTelegram(notice, row.recipient_name), telegramMarkup(notice));
    } catch {
      delivered = false;
    }
    if (delivered) {
      await finish(env, row, 'sent', null);
      summary.sent += 1;
    } else if (row.attempts >= MAX_ATTEMPTS) {
      await finish(env, row, 'failed', 'Gagal dihantar selepas beberapa cubaan.');
      summary.failed += 1;
    } else {
      const minutes = Math.min(60, 5 * row.attempts);
      await env.DB.prepare(`UPDATE worker_notification_outbox SET status='pending',
          next_attempt_at=datetime('now','+8 hours','+${minutes} minutes'),last_error=?
        WHERE id=? AND status='processing'`).bind('Penghantaran gagal; akan dicuba semula.', row.id).run();
      summary.failed += 1;
    }
  }
  return summary;
}

/** For an email row: 'reached' when Telegram or the app already reached the person, 'wait' while
 * the Telegram row is still retrying, otherwise 'send'. */
async function emailFallbackState(env: Env, row: OutboxRow, notice: Notice): Promise<'reached' | 'wait' | 'send'> {
  const base = row.dedupe_key.replace(/:email$/, '');
  const telegram = await env.DB.prepare(`SELECT status FROM worker_notification_outbox WHERE dedupe_key=?`)
    .bind(`${base}:telegram`).first<{ status: string }>();
  if (telegram?.status === 'sent') return 'reached';
  if (notice.portalWritten && await hasAppChannel(env, row.recipient_user_id)) return 'reached';
  if (telegram && ['pending', 'processing'].includes(telegram.status)) return 'wait';
  return 'send';
}

async function finish(env: Env, row: OutboxRow, status: 'sent' | 'failed' | 'skipped', error: string | null):
  Promise<void> {
  await env.DB.prepare(`UPDATE worker_notification_outbox SET status=?,last_error=?,completed_at=${NOW}
    WHERE id=? AND status='processing'`).bind(status, error, row.id).run();
  if (row.lantikan_id && status !== 'skipped') {
    try {
      await recordLantikanAudit(env, row.lantikan_id, row.kind, row.channel,
        status === 'sent' ? 'success' : 'failed',
        { recipient: row.address, attempts: row.attempts, error });
    } catch {
      console.error('[notification outbox] audit skipped for', row.kind);
    }
  }
}

export interface ContactRow {
  id: number;
  nama_penuh: string;
  email: string | null;
  telegram_chat_id: string | number | null;
}

export function contactRecipient(row: ContactRow): Recipient {
  return { userId: row.id, name: row.nama_penuh, email: row.email, telegramChatId: row.telegram_chat_id };
}

export async function activeAdmins(env: Env): Promise<ContactRow[]> {
  return (await env.DB.prepare(`SELECT id,nama_penuh,email,telegram_chat_id FROM users
    WHERE role='Admin' AND aktif=1 ORDER BY id`).all<ContactRow>()).results;
}

/** PP Daerah of an association, matched the same way district verification does. */
export async function districtPPs(env: Env, persatuanId: number | null | undefined): Promise<ContactRow[]> {
  if (!persatuanId) return [];
  return (await env.DB.prepare(`SELECT id,nama_penuh,email,telegram_chat_id FROM users
    WHERE role='PP Daerah' AND aktif=1 AND COALESCE(NULLIF(persatuan_id,0),district_id)=? ORDER BY id`)
    .bind(persatuanId).all<ContactRow>()).results;
}

export async function userContact(env: Env, userId: number | null | undefined): Promise<ContactRow | null> {
  if (!userId) return null;
  return env.DB.prepare('SELECT id,nama_penuh,email,telegram_chat_id FROM users WHERE id=?')
    .bind(userId).first<ContactRow>();
}

/** "d/m/Y H:i" in Kuala Lumpur time for security notices. */
export function klNowText(nowMs = Date.now()): string {
  const local = new Date(nowMs + 8 * 3600_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} `
    + `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}
