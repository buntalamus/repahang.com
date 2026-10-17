/**
 * Telegram linking email blast (Admin Settings). Starting a blast freezes the
 * unlinked accounts into telegram_blast_recipients; the cron dispatcher in
 * mailbox-campaigns.ts sends them within the shared ten-per-five-minutes
 * budget, keeps a Peti Emel "Dihantar" copy of each email and records every
 * address as sent, failed, uncertain or skipped.
 */
import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import { SmtpRejection } from '../smtp';
import { json } from './auth';
import { wroteRow } from './d1-changes';
import { archiveSentCopy } from './mailbox-archive';
import type { Env } from './types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TELEGRAM_BLAST_SUBJECT = 'Aktifkan Telegram — Sistem Pengurusan Pengadil PBNP';
const INVALID = 'Alamat emel tidak sah.';
const UNCERTAIN = 'Status SMTP belum pasti; semak folder Dihantar sebelum menghantar semula.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UNLINKED = "(telegram_chat_id IS NULL OR trim(telegram_chat_id)='')";

type Batch = { id: string; status: string; total: number; created_at: string; cancelled_at: string | null;
  created_by_name: string | null };
type Target = { user_id: number; email: string; name: string };

export function telegramBlastEnabled(env: Env): boolean {
  return env.STAGING_WRITES_ENABLED === '1' && env.BULK_EMAIL_ENABLED === '1';
}

function botName(env: Env): string {
  return (env.TELEGRAM_BOT_USERNAME || 'refpahang_bot').replace(/^@+/, '');
}

/** The newest blast with per-status counts and every recipient's result. */
export async function latestTelegramBlast(env: Env) {
  const batch = await env.DB.prepare(`SELECT b.id,b.status,b.total,b.created_at,b.cancelled_at,
      u.nama_penuh AS created_by_name
    FROM telegram_blast_batches b LEFT JOIN users u ON u.id=b.created_by
    ORDER BY b.created_at DESC, b.rowid DESC LIMIT 1`).first<Batch>();
  if (!batch) return null;
  const recipients = await env.DB.prepare(`SELECT r.user_id,r.name,r.email,r.status,r.error,r.completed_at,
      CASE WHEN trim(COALESCE(u.telegram_chat_id,''))<>'' THEN 1 ELSE 0 END AS linked_now
    FROM telegram_blast_recipients r LEFT JOIN users u ON u.id=r.user_id
    WHERE r.batch_id=? ORDER BY r.name,r.user_id`).bind(batch.id)
    .all<{ status: string; linked_now: number } & Record<string, unknown>>();
  const counts: Record<string, number> = { pending: 0, processing: 0, sent: 0, failed: 0, uncertain: 0,
    skipped: 0, cancelled: 0 };
  for (const row of recipients.results) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const linkedSince = recipients.results.filter((row) => row.status === 'sent' && Number(row.linked_now) === 1).length;
  return { ...batch, counts, linked_since: linkedSince, recipients: recipients.results };
}

/** POST actions: start (default), cancel and retry-failed. Never sends SMTP itself. */
export async function telegramBlastAction(env: Env, actorId: number, body: Record<string, unknown>): Promise<Response> {
  const action = body.action === undefined ? 'start' : body.action;
  if (action === 'start') {
    const queued = await env.DB.prepare("SELECT id FROM telegram_blast_batches WHERE status='queued' LIMIT 1").first();
    if (queued) return json({ error: true, message: 'Blast sebelum ini masih berjalan. Tunggu selesai atau batalkan dahulu.',
      batch: await latestTelegramBlast(env) }, 409);
    const rows = await env.DB.prepare(`SELECT id,nama_penuh,trim(email) AS email FROM users
      WHERE email IS NOT NULL AND trim(email)<>'' AND ${UNLINKED} ORDER BY id`)
      .all<{ id: number; nama_penuh: string | null; email: string }>();
    if (!rows.results.length) return json({ error: true, message: 'Tiada pengguna yang belum memaut Telegram.' }, 422);
    const recipients = rows.results.map((row) => {
      const valid = EMAIL.test(row.email);
      return { user_id: row.id, email: row.email, name: String(row.nama_penuh ?? '').trim() || 'Pengadil',
        status: valid ? 'pending' : 'failed', error: valid ? null : INVALID };
    });
    const id = crypto.randomUUID();
    try {
      // One atomic batch: links for accounts without a token, the frozen list and the batch row.
      await env.DB.batch([
        env.DB.prepare(`UPDATE users SET tg_link_token=lower(hex(randomblob(16)))
          WHERE email IS NOT NULL AND trim(email)<>'' AND ${UNLINKED}
            AND (tg_link_token IS NULL OR trim(tg_link_token)='')`),
        env.DB.prepare('INSERT INTO telegram_blast_batches(id,created_by,total) VALUES(?,?,?)')
          .bind(id, actorId, recipients.length),
        env.DB.prepare(`INSERT INTO telegram_blast_recipients(batch_id,user_id,email,name,status,error)
          SELECT ?,json_extract(value,'$.user_id'),json_extract(value,'$.email'),json_extract(value,'$.name'),
            json_extract(value,'$.status'),json_extract(value,'$.error') FROM json_each(?)`)
          .bind(id, JSON.stringify(recipients)),
      ]);
    } catch (error) {
      // The unique index allows only one queued blast; a concurrent start lands here.
      const running = await env.DB.prepare("SELECT id FROM telegram_blast_batches WHERE status='queued' LIMIT 1").first();
      if (running) return json({ error: true, message: 'Blast lain sedang berjalan.', batch: await latestTelegramBlast(env) }, 409);
      throw error;
    }
    const pending = recipients.filter((row) => row.status === 'pending').length;
    return json({ error: false, batch: await latestTelegramBlast(env),
      message: `Blast dimulakan untuk ${recipients.length} pengguna. ${pending} emel akan dihantar secara berperingkat, 10 emel setiap 5 minit.` });
  }
  const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : '';
  if (!id) return json({ error: true, message: 'ID blast tidak sah.' }, 422);
  if (action === 'cancel') {
    const result = await env.DB.batch([
      env.DB.prepare(`UPDATE telegram_blast_batches SET status='cancelled',cancelled_at=datetime('now','+8 hours')
        WHERE id=? AND status='queued'`).bind(id),
      env.DB.prepare(`UPDATE telegram_blast_recipients SET status='cancelled' WHERE batch_id=? AND status='pending'
        AND EXISTS(SELECT 1 FROM telegram_blast_batches WHERE id=? AND status='cancelled')`).bind(id, id),
    ]);
    if (!wroteRow(result[0])) return json({ error: true, message: 'Blast tidak dijumpai atau sudah selesai.' }, 409);
    return json({ error: false, message: 'Blast dibatalkan. Emel yang belum dihantar tidak akan dihantar.',
      batch: await latestTelegramBlast(env) });
  }
  if (action === 'retry-failed') {
    // Uncertain addresses are included: a second copy of the same link is harmless,
    // and the Cloudflare email binding reports every rejection as an uncertain error.
    const others = await env.DB.prepare("SELECT id FROM telegram_blast_batches WHERE status='queued' AND id<>? LIMIT 1")
      .bind(id).first();
    if (others) return json({ error: true, message: 'Blast lain sedang berjalan.' }, 409);
    const result = await env.DB.batch([
      env.DB.prepare(`UPDATE telegram_blast_recipients SET status='pending',error=NULL,message_id=NULL,started_at=NULL
        WHERE batch_id=? AND status IN ('failed','uncertain') AND COALESCE(error,'')<>?
          AND EXISTS(SELECT 1 FROM telegram_blast_batches WHERE id=? AND status IN ('queued','completed'))`)
        .bind(id, INVALID, id),
      env.DB.prepare(`UPDATE telegram_blast_batches SET status='queued' WHERE id=? AND status='completed'
        AND EXISTS(SELECT 1 FROM telegram_blast_recipients WHERE batch_id=? AND status='pending')`).bind(id, id),
    ]);
    const retried = Number(result[0]?.meta.changes ?? 0);
    return json({ error: false, batch: await latestTelegramBlast(env),
      message: retried ? `${retried} emel yang gagal atau belum pasti akan dihantar semula.`
        : 'Tiada emel gagal yang boleh dihantar semula.' });
  }
  return json({ error: true, message: 'Tindakan tidak sah.' }, 422);
}

/**
 * Cron only, inside the shared dispatch lease. Sends at most `budget` emails and
 * pauses on the first SMTP or infrastructure failure, like the mailbox campaigns.
 */
export async function processTelegramBlast(env: Env, budget: number, now: number): Promise<void> {
  // A terminated Worker may have reached SMTP. Never resend those automatically.
  await env.DB.prepare(`UPDATE telegram_blast_recipients SET status='uncertain',error=?
    WHERE status='processing' AND started_at<?`).bind(UNCERTAIN, now - 1200).run();
  const mailbox = String(env.MAIL_ADMIN_USER ?? '').trim().toLowerCase();
  const bot = botName(env);
  let sent = 0;
  // Skipped accounts do not use the budget; the guard bounds the loop regardless.
  for (let guard = 0; sent < budget && guard < budget + 500; guard++) {
    const batch = await env.DB.prepare("SELECT id FROM telegram_blast_batches WHERE status='queued' LIMIT 1")
      .first<{ id: string }>();
    if (!batch) break;
    const messageId = crypto.randomUUID();
    const claimed = await env.DB.prepare(`UPDATE telegram_blast_recipients SET status='processing',message_id=?,started_at=?
      WHERE batch_id=? AND user_id=(SELECT user_id FROM telegram_blast_recipients
        WHERE batch_id=? AND status='pending' ORDER BY name,user_id LIMIT 1)
        AND status='pending' RETURNING user_id,email,name`)
      .bind(messageId, now, batch.id, batch.id).all<Target>();
    const target = claimed.results[0];
    if (!target) break;
    const settle = (status: string, error: string | null) => env.DB.prepare(`UPDATE telegram_blast_recipients
      SET status=?,error=?,completed_at=datetime('now','+8 hours') WHERE batch_id=? AND user_id=? AND message_id=?`)
      .bind(status, error, batch.id, target.user_id, messageId);
    const account = await env.DB.prepare('SELECT telegram_chat_id,tg_link_token FROM users WHERE id=?')
      .bind(target.user_id).first<{ telegram_chat_id: string | number | null; tg_link_token: string | null }>();
    const token = String(account?.tg_link_token ?? '').trim();
    if (!account || String(account.telegram_chat_id ?? '').trim() || !token) {
      await settle('skipped', !account ? 'Akaun telah dipadam.'
        : String(account.telegram_chat_id ?? '').trim() ? 'Telegram sudah dipaut sebelum emel dihantar.'
          : 'Tiada token pautan Telegram.').run();
      continue;
    }
    if (!EMAIL.test(target.email)) { await settle('failed', INVALID).run(); continue; }
    const link = `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(token)}`;
    const { html, text } = buildRefpahangEmail('Aktifkan Notifikasi Telegram', target.name, [
      'Sistem Pengurusan Pengadil PBNP menggunakan Telegram untuk menghantar notifikasi lantikan perlawanan.',
      'Hubungkan akaun anda untuk menerima notifikasi serta menerima atau menolak lantikan melalui Telegram.',
      `Buka pautan ini dan tekan START pada bot @${bot}.`,
    ], { label: 'Aktifkan Telegram Sekarang', url: link });
    let smtpStarted = false;
    try {
      if (mailbox) {
        await archiveSentCopy(env, { id: messageId, mailbox, to: target.email, subject: TELEGRAM_BLAST_SUBJECT,
          html, text, requestId: `telegram-blast:${messageId}` });
      }
      smtpStarted = true;
      const providerId = await sendRefpahangEmail(env, 'admin', target.email, target.name,
        TELEGRAM_BLAST_SUBJECT, html, text);
      await env.DB.batch([
        env.DB.prepare("UPDATE mailbox_messages SET delivery_status='sent',message_id=? WHERE id=?").bind(providerId, messageId),
        settle('sent', null),
      ]);
      sent++;
    } catch (error) {
      const uncertain = smtpStarted && !(error instanceof SmtpRejection);
      await env.DB.batch([
        env.DB.prepare('UPDATE mailbox_messages SET delivery_status=? WHERE id=?')
          .bind(uncertain ? 'processing' : 'failed', messageId),
        settle(uncertain ? 'uncertain' : 'failed', uncertain ? UNCERTAIN
          : smtpStarted ? 'Pelayan menolak emel; semak alamat atau had penghantaran sebelum cuba semula.'
            : 'Gagal menyediakan emel; boleh cuba semula.'),
      ]);
      break;
    }
  }
  await completeBatches(env);
}

async function completeBatches(env: Env): Promise<void> {
  await env.DB.prepare(`UPDATE telegram_blast_batches SET status='completed' WHERE status='queued'
    AND NOT EXISTS(SELECT 1 FROM telegram_blast_recipients r WHERE r.batch_id=telegram_blast_batches.id
      AND r.status IN ('pending','processing'))`).run();
}
