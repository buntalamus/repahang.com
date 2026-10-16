import PostalMime, { type Email } from 'postal-mime';
import { withImapClient, type ImapClient, type ImapMessage } from '../imap';
import type { MailType } from '../mail';
import { wroteRow } from './d1-changes';
import type { Env } from './types';

export const SYSTEM_MAILBOXES = ['admin', 'daftar', 'lantikan', 'support', 'pengesahan'].map(
  (alias) => `${alias}@refpahang.com`,
);
export const imapEnabled = (env: Env): boolean =>
  env.MAILBOX_IMAP_ENABLED === '1' && env.STAGING_WRITES_ENABLED === '1';
type State = { uid_validity: number; high_uid: number; backfill_before: number };
export type SyncResult = { imported: number; oversized: number; pending: boolean; busy?: boolean };
type ClientRunner = typeof withImapClient;

function account(env: Env, mailbox: string) {
  if (!SYSTEM_MAILBOXES.includes(mailbox)) throw new Error('Unknown system mailbox');
  const type = mailbox.split('@')[0] as MailType;
  const username = env[`MAIL_${type.toUpperCase()}_USER` as keyof Env];
  const password = env[`MAIL_${type.toUpperCase()}_PASS` as keyof Env];
  if (username !== mailbox || typeof password !== 'string')
    throw new Error('IMAP credentials missing');
  return { hostname: env.IMAP_HOST || env.SMTP_HOST || '', username, password };
}

async function digest(bytes: Uint8Array): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function store(
  env: Env,
  mailbox: string,
  folder: string,
  kind: string,
  validity: number,
  message: ImapMessage,
): Promise<boolean> {
  const hash = await digest(message.raw);
  const identifier = await digest(new TextEncoder().encode(`${mailbox}\0${folder}\0${hash}`));
  const id = `${identifier.slice(0, 8)}-${identifier.slice(8, 12)}-4${identifier.slice(13, 16)}-a${identifier.slice(17, 20)}-${identifier.slice(20, 32)}`;
  const existing = await env.DB.prepare('SELECT id FROM mailbox_messages WHERE id=?')
    .bind(id)
    .first();
  if (!existing) {
    // Decode only headers here; attachment parsing is deferred until the mail is opened.
    let end = -1;
    for (let i = 0; i + 3 < Math.min(message.raw.length, 131072); i++) {
      if (
        message.raw[i] === 13 &&
        message.raw[i + 1] === 10 &&
        message.raw[i + 2] === 13 &&
        message.raw[i + 3] === 10
      ) {
        end = i + 4;
        break;
      }
    }
    let parsed: Partial<Email> = {};
    try {
      parsed = await PostalMime.parse(
        message.raw.slice(0, end < 0 ? Math.min(message.raw.length, 131072) : end),
      );
    } catch {
      /* Preserve malformed mail as EML with a fallback title instead of stalling the folder. */
    }
    const clean = (value: string) =>
      value
        .replace(/[\r\n\0]/g, ' ')
        .trim()
        .slice(0, 500);
    const sender = parsed.from
      ? clean(
          parsed.from.name
            ? `${parsed.from.name} <${parsed.from.address}>`
            : parsed.from.address || '',
        )
      : '';
    const key = `mailbox/${mailbox}/imap/${id}.eml`;
    await env.MEDIA.put(key, message.raw, {
      httpMetadata: { contentType: 'message/rfc822' },
      customMetadata: { mailbox, folder },
    });
    await env.DB.prepare(
      `INSERT OR IGNORE INTO mailbox_messages
      (id,mailbox,folder,sender,recipient,subject,message_id,r2_key,size_bytes,received_at,read_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        id,
        mailbox,
        kind === 'sent' ? 'sent' : 'inbox',
        sender,
        clean(
          parsed.to?.map((address) => address.address || address.name || '').join(', ') || mailbox,
        ),
        clean(parsed.subject || '') || '(Tiada tajuk)',
        clean(parsed.messageId || '') || null,
        key,
        message.raw.byteLength,
        message.date.replace('T', ' ').replace(/\.\d{3}Z$/, ''),
        message.seen ? message.date.replace('T', ' ').replace(/\.\d{3}Z$/, '') : null,
      )
      .run();
  }
  // The cursor is advanced only after BOTH R2 and D1 succeed. Stable IDs make retries safe.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO mailbox_imap_items
    (mailbox,folder,uid_validity,uid,portal_id,raw_hash,status) VALUES (?,?,?,?,?,?,'imported')`,
  )
    .bind(mailbox, folder, validity, message.uid, id, hash)
    .run();
  return !existing;
}

async function syncFolder(
  env: Env,
  mailbox: string,
  folder: string,
  client: ImapClient,
): Promise<SyncResult> {
  const owner = crypto.randomUUID();
  const claimed = await env.DB.prepare(
    `INSERT INTO mailbox_imap_state
    (mailbox,folder,lease_owner,lease_until,last_attempt) VALUES (?,?,?,unixepoch()+180,unixepoch())
    ON CONFLICT(mailbox,folder) DO UPDATE SET lease_owner=excluded.lease_owner,
      lease_until=excluded.lease_until,last_attempt=excluded.last_attempt
    WHERE mailbox_imap_state.lease_until < unixepoch() AND mailbox_imap_state.last_attempt < unixepoch()-20`,
  )
    .bind(mailbox, folder, owner)
    .run();
  if (!wroteRow(claimed)) return { imported: 0, oversized: 0, pending: false, busy: true };
  try {
    const inbox = await client.examine(folder);
    const row = await env.DB.prepare(
      'SELECT uid_validity,high_uid,backfill_before FROM mailbox_imap_state WHERE mailbox=? AND folder=?',
    )
      .bind(mailbox, folder)
      .first<State>();
    const kind = await env.DB.prepare(
      'SELECT kind FROM mailbox_imap_folders WHERE mailbox=? AND name=?',
    )
      .bind(mailbox, folder)
      .first<{ kind: string }>();
    let high = row?.uid_validity === inbox.uidValidity ? row.high_uid : inbox.uidNext - 1;
    let before = row?.uid_validity === inbox.uidValidity ? row.backfill_before : inbox.uidNext;
    // UIDVALIDITY changes trigger a fresh scan; exact raw copies retain their portal ID/read state.
    await env.DB.prepare(
      `UPDATE mailbox_imap_state SET uid_validity=?,high_uid=?,backfill_before=?
      WHERE mailbox=? AND folder=? AND lease_owner=?`,
    )
      .bind(inbox.uidValidity, high, before, mailbox, folder, owner)
      .run();
    let imported = 0,
      oversized = 0,
      processed = 0,
      bytes = 0;
    const take = async (values: number[], limit: number): Promise<number> => {
      let count = 0;
      for (const value of values.slice(0, limit)) {
        const existing = await env.DB.prepare(
          'SELECT status FROM mailbox_imap_items WHERE mailbox=? AND folder=? AND uid_validity=? AND uid=?',
        )
          .bind(mailbox, folder, inbox.uidValidity, value)
          .first();
        if (!existing) {
          const message = await inbox.fetch(value);
          if (message === 'oversized') {
            await env.DB.prepare(
              `INSERT OR IGNORE INTO mailbox_imap_items
              (mailbox,folder,uid_validity,uid,status) VALUES (?,?,?,?,'oversized')`,
            )
              .bind(mailbox, folder, inbox.uidValidity, value)
              .run();
            oversized++;
          } else if (message) {
            if (
              await store(env, mailbox, folder, kind?.kind || 'custom', inbox.uidValidity, message)
            )
              imported++;
            bytes += message.raw.byteLength;
          }
        }
        count++;
        processed++;
        if (bytes >= 30 * 1024 * 1024) break;
      }
      return count;
    };
    if (high < inbox.uidNext - 1) {
      const last = Math.min(high + 1000, inbox.uidNext - 1);
      const values = await inbox.search(high + 1, last);
      const count = await take(values, 5);
      high = count === values.length ? last : values[count - 1];
    }
    if (before > 1 && processed < 10 && bytes < 30 * 1024 * 1024) {
      const first = Math.max(1, before - 1000);
      const values = (await inbox.search(first, before - 1)).reverse();
      const count = await take(values, 10 - processed);
      before = count === values.length ? first : values[count - 1];
    }
    await env.DB.prepare(
      `UPDATE mailbox_imap_state SET high_uid=?,backfill_before=?,last_sync_at=CURRENT_TIMESTAMP,
      last_error=NULL WHERE mailbox=? AND folder=? AND lease_owner=?`,
    )
      .bind(high, before, mailbox, folder, owner)
      .run();
    return { imported, oversized, pending: before > 1 || high < inbox.uidNext - 1 };
  } catch (error) {
    await env.DB.prepare(
      "UPDATE mailbox_imap_state SET last_error='sync_failed' WHERE mailbox=? AND folder=? AND lease_owner=?",
    )
      .bind(mailbox, folder, owner)
      .run();
    // Never log server responses, message contents or credentials.
    console.error('Mailbox IMAP sync failed', { mailbox, folder });
    throw error;
  } finally {
    await env.DB.prepare(
      'UPDATE mailbox_imap_state SET lease_owner=NULL,lease_until=0 WHERE mailbox=? AND folder=? AND lease_owner=?',
    )
      .bind(mailbox, folder, owner)
      .run();
  }
}

/** One TLS connection per account, bounded batches. The server is never modified. */
export async function syncShinjiruMailbox(
  env: Env,
  mailbox: string,
  requestedFolder?: string,
  runner: ClientRunner = withImapClient,
): Promise<SyncResult> {
  if (!imapEnabled(env)) throw new Error('IMAP sync disabled');
  return runner(account(env, mailbox), async (client) => {
    const folders = await client.list();
    if (!folders.length || folders.length > 100) throw new Error('IMAP folder count invalid');
    await env.DB.batch(
      folders.map((folder) =>
        env.DB.prepare(
          `INSERT INTO mailbox_imap_folders
      (mailbox,name,label,kind) VALUES (?,?,?,?) ON CONFLICT(mailbox,name) DO UPDATE SET label=excluded.label,kind=excluded.kind`,
        ).bind(mailbox, folder.name, folder.label, folder.kind),
      ),
    );
    if (requestedFolder !== undefined) {
      const actual =
        requestedFolder === 'inbox'
          ? folders.find((folder) => folder.kind === 'inbox')?.name
          : requestedFolder === 'sent'
            ? folders.find((folder) => folder.kind === 'sent')?.name
            : requestedFolder.startsWith('imap:')
              ? requestedFolder.slice(5)
              : undefined;
      // A server with no Sent folder still supports portal SMTP/Sent history.
      if (!actual && requestedFolder === 'sent')
        return { imported: 0, oversized: 0, pending: false };
      if (!actual || !folders.some((folder) => folder.name === actual))
        throw new Error('IMAP folder unavailable');
      return syncFolder(env, mailbox, actual, client);
    }
    const inbox = folders.find((folder) => folder.kind === 'inbox');
    const oldest = await env.DB.prepare(
      `SELECT f.name FROM mailbox_imap_folders f
      LEFT JOIN mailbox_imap_state s ON s.mailbox=f.mailbox AND s.folder=f.name
      WHERE f.mailbox=? AND f.kind!='inbox' AND f.name IN (${folders.map(() => '?').join(',')})
      ORDER BY COALESCE(s.last_attempt,0),f.name LIMIT 1`,
    )
      .bind(mailbox, ...folders.map((folder) => folder.name))
      .first<{ name: string }>();
    const names = [inbox?.name, oldest?.name].filter(
      (name): name is string => !!name && folders.some((folder) => folder.name === name),
    );
    const total: SyncResult = { imported: 0, oversized: 0, pending: false };
    for (const name of names) {
      const result = await syncFolder(env, mailbox, name, client);
      total.imported += result.imported;
      total.oversized += result.oversized;
      total.pending ||= result.pending;
    }
    return total;
  });
}

export async function syncAllShinjiruMailboxes(env: Env): Promise<void> {
  if (!imapEnabled(env)) return;
  for (const mailbox of SYSTEM_MAILBOXES) {
    try {
      await syncShinjiruMailbox(env, mailbox);
    } catch {
      console.error('Shinjiru account sync unavailable', { mailbox });
    }
  }
}
