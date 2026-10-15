import PostalMime from 'postal-mime';
import { buildRefpahangEmail, sendRefpahangEmail, type MailType } from '../mail';
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';
import { wroteRow } from './d1-changes';

const ALIASES = ['admin', 'daftar', 'lantikan', 'support', 'pengesahan'] as const;
const MAILBOXES = new Set(ALIASES.map((alias) => `${alias}@refpahang.com`));
const MAX_RAW_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_BYTES = 12_000;

type MailRow = {
  id: string; mailbox: string; folder: string; sender: string; recipient: string;
  subject: string; message_id: string | null; r2_key: string; size_bytes: number;
  received_at: string; read_at: string | null; delivery_status: string;
};

function mailboxAddress(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return MAILBOXES.has(normalized) ? normalized : null;
}

function cleanHeader(value: string | null, limit: number): string {
  return (value ?? '').replace(/[\r\n\0]/g, ' ').trim().slice(0, limit);
}

function base64Utf8(value: string): string {
  return btoa(Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join(''));
}

function responseHeaders(contentType: string, filename?: string): Headers {
  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (filename) headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  return headers;
}

/** Called only by Cloudflare Email Routing, never by a public HTTP request. */
export async function receiveMailboxEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const mailbox = mailboxAddress(message.to);
  if (!mailbox) {
    message.setReject('Unknown RefPahang mailbox');
    return;
  }
  if (message.rawSize > MAX_RAW_BYTES) {
    message.setReject('Message exceeds 25 MiB mailbox limit');
    return;
  }
  const id = crypto.randomUUID();
  const key = `mailbox/${mailbox}/inbox/${id}.eml`;
  // Store the original MIME so attachments and all headers are preserved.
  // A failure here rejects the incoming message instead of silently losing it.
  await env.MEDIA.put(key, message.raw, {
    httpMetadata: { contentType: 'message/rfc822' },
    customMetadata: { mailbox, folder: 'inbox' },
  });
  try {
    await env.DB.prepare(`
      INSERT INTO mailbox_messages
      (id, mailbox, folder, sender, recipient, subject, message_id, r2_key, size_bytes)
      VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?, ?)
    `).bind(id, mailbox, cleanHeader(message.headers.get('from') ?? message.from, 500),
      mailbox, cleanHeader(message.headers.get('subject'), 500) || '(Tiada tajuk)',
      cleanHeader(message.headers.get('message-id'), 500) || null, key, message.rawSize).run();
  } catch (error) {
    // Keep the R2 object for recovery if D1 indexing is unavailable.
    console.error('Mailbox R2 message stored but D1 indexing failed', { id, key, error });
    throw error;
  }
}

async function admin(request: Request, env: Env): Promise<Response | null> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  return null;
}

export async function adminMailbox(request: Request, env: Env): Promise<Response> {
  const denied = await admin(request, env);
  if (denied) return denied;
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: true, message: 'ID emel tidak sah.' }, 400);
      const row = await env.DB.prepare('SELECT * FROM mailbox_messages WHERE id=?').bind(id).first<MailRow>();
      if (!row) return json({ error: true, message: 'Emel tidak dijumpai.' }, 404);
      const object = await env.MEDIA.get(row.r2_key);
      if (!object) return json({ error: true, message: 'Kandungan emel tiada dalam storan.' }, 503);
      if (url.searchParams.get('download') === '1') {
        return new Response(object.body, { headers: responseHeaders('message/rfc822', `${row.id}.eml`) });
      }
      const parsed = await PostalMime.parse(await object.arrayBuffer());
      if (!row.read_at) await env.DB.prepare("UPDATE mailbox_messages SET read_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(id).run();
      return json({ error: false, data: {
        id: row.id, mailbox: row.mailbox, folder: row.folder, sender: row.sender,
        reply_address: parsed.replyTo?.[0]?.address || parsed.from?.address || '',
        recipient: row.recipient, subject: row.subject, received_at: row.received_at,
        delivery_status: row.delivery_status, text: parsed.text || '',
        attachments: parsed.attachments.map((attachment) => ({
          filename: attachment.filename || 'lampiran',
          mimeType: attachment.mimeType,
          size: typeof attachment.content === 'string'
            ? new TextEncoder().encode(attachment.content).byteLength
            : attachment.content.byteLength,
        })),
      } });
    }
    const mailbox = url.searchParams.get('mailbox') ?? 'daftar@refpahang.com';
    const folder = url.searchParams.get('folder') ?? 'inbox';
    if (!mailboxAddress(mailbox) || !['inbox', 'sent'].includes(folder)) {
      return json({ error: true, message: 'Peti masuk atau folder tidak sah.' }, 400);
    }
    const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page') || 1) || 1));
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM mailbox_messages WHERE mailbox=? AND folder=?')
      .bind(mailbox, folder).first<{ total: number }>();
    const rows = await env.DB.prepare(`
      SELECT id, mailbox, folder, sender, recipient, subject, size_bytes,
             received_at, read_at, delivery_status
      FROM mailbox_messages WHERE mailbox=? AND folder=?
      ORDER BY received_at DESC, id DESC LIMIT 50 OFFSET ?
    `).bind(mailbox, folder, (page - 1) * 50).all();
    return json({ error: false, data: rows.results, total: count?.total ?? 0, page });
  }
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  if (env.STAGING_WRITES_ENABLED !== '1' || env.MAILBOX_SEND_ENABLED !== '1') {
    return json({ error: true, message: 'Penghantaran emel belum diaktifkan.' }, 503);
  }
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Data emel tidak sah.' }, 422);
  }
  const body = input as Record<string, unknown>;
  const from = typeof body.from === 'string' ? mailboxAddress(body.from) : null;
  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  const subject = typeof body.subject === 'string' ? cleanHeader(body.subject, 250) : '';
  const content = typeof body.text === 'string' ? body.text.trim() : '';
  const requestId = typeof body.request_id === 'string' ? body.request_id : '';
  if (!from || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(to) || to.length > 254 ||
      !subject || !content || new TextEncoder().encode(content).byteLength > MAX_TEXT_BYTES ||
      !/^[0-9a-f-]{36}$/.test(requestId)) {
    return json({ error: true, message: 'Penghantar, penerima, tajuk, kandungan atau ID permintaan tidak sah.' }, 422);
  }
  const existing = await env.DB.prepare('SELECT id,delivery_status FROM mailbox_messages WHERE request_id=?')
    .bind(requestId).first<{ id: string; delivery_status: string }>();
  if (existing) return json({ error: false, data: existing });
  const id = crypto.randomUUID();
  const key = `mailbox/${from}/sent/${id}.eml`;
  const date = new Date().toUTCString();
  const type = from.split('@')[0] as MailType;
  const formatted = buildRefpahangEmail(subject, '', content.split(/\n\s*\n/));
  const encodedSubject = `=?UTF-8?B?${base64Utf8(subject)}?=`;
  const boundary = `refpahang-${id}`;
  const encodedText = base64Utf8(formatted.text).replace(/.{1,76}/g, '$&\r\n');
  const encodedHtml = base64Utf8(formatted.html).replace(/.{1,76}/g, '$&\r\n');
  const raw = `From: ${from}\r\nTo: ${to}\r\nSubject: ${encodedSubject}\r\nDate: ${date}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`
    + `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${encodedText}`
    + `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${encodedHtml}`
    + `--${boundary}--\r\n`;
  await env.MEDIA.put(key, raw, { httpMetadata: { contentType: 'message/rfc822' } });
  const claimed = await env.DB.prepare(`
    INSERT OR IGNORE INTO mailbox_messages
    (id, mailbox, folder, sender, recipient, subject, r2_key, size_bytes, delivery_status, request_id)
    VALUES (?, ?, 'sent', ?, ?, ?, ?, ?, 'processing', ?)
  `).bind(id, from, from, to, subject, key, new TextEncoder().encode(raw).byteLength, requestId).run();
  if (!wroteRow(claimed)) {
    await env.MEDIA.delete(key);
    const duplicate = await env.DB.prepare('SELECT id,delivery_status FROM mailbox_messages WHERE request_id=?')
      .bind(requestId).first();
    return json({ error: false, data: duplicate });
  }
  let messageId: string;
  try {
    messageId = await sendRefpahangEmail(env, type, to, '', subject, formatted.html, formatted.text);
  } catch (error) {
    await env.DB.prepare("UPDATE mailbox_messages SET delivery_status='failed' WHERE id=?")
      .bind(id).run();
    console.error('Mailbox outbound send failed', { id, error: error instanceof Error ? error.message : String(error) });
    return json({ error: true, message: 'Emel tidak berjaya dihantar. Semak folder Dihantar.' }, 502);
  }
  try {
    await env.DB.prepare("UPDATE mailbox_messages SET delivery_status='sent', message_id=? WHERE id=?")
      .bind(messageId, id).run();
  } catch (error) {
    // The provider accepted the message. Retain processing status so an
    // operator can reconcile it; a retry must never send it a second time.
    console.error('Mailbox send accepted but D1 status update failed', { id, messageId, error });
    return json({ error: false, data: { id, delivery_status: 'processing' } }, 202);
  }
  return json({ error: false, data: { id, delivery_status: 'sent' } });
}
