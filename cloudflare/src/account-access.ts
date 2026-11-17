/** Admin account access changes. Match/application/report history is retained. */
import { policyClock } from './account-policy';
export { DEFAULT_INACTIVE_REASON } from './account-policy';
import { json } from './auth';
import { SHARED_ACCOUNT_MESSAGE, isSharedDemoUserId } from './demo';
import { notifyAccountDeactivated } from './account-notify';
import { wroteRow } from './d1-changes';
import type { Env } from './types';

export const MAX_INACTIVE_REASON_LENGTH = 1000;

export async function setAccountStatus(env: Env, adminId: number, userId: number, active: number,
  reasonInput: unknown, profileValues: Record<string, string | number | null> = {}): Promise<Response> {
  if (!Number.isSafeInteger(userId) || userId < 1 || ![0, 1].includes(active)) {
    return json({ error: true, message: 'ID pengguna atau status akaun tidak sah.' }, 400);
  }
  if (active === 0 && userId === adminId) {
    return json({ error: true, message: 'Anda tidak boleh menandakan akaun sendiri sebagai Tidak Aktif.' }, 400);
  }
  if (await isSharedDemoUserId(env, userId)) return json({ error: true, message: SHARED_ACCOUNT_MESSAGE }, 403);
  const reason = active === 1 ? null : typeof reasonInput === 'string' ? reasonInput.trim() : '';
  if (active === 0 && (!reason || reason.length > MAX_INACTIVE_REASON_LENGTH || reason.includes('\0'))) {
    return json({ error: true, message: 'Sila isi sebab Tidak Aktif (maksimum 1000 aksara).' }, 400);
  }
  const target = await env.DB.prepare(`SELECT id,nama_penuh,email,telegram_chat_id,aktif,inactive_reason
    FROM users WHERE id=?`).bind(userId).first<{
      id: number; nama_penuh: string; email: string | null; telegram_chat_id: string | number | null;
      aktif: number; inactive_reason: string | null;
    }>();
  if (!target) return json({ error: true, message: 'Pengguna tidak dijumpai.' }, 404);
  if (!Object.keys(profileValues).length && Number(target.aktif) === active && (target.inactive_reason ?? '') === (reason ?? '')) {
    return json({ error: false, message: active ? 'Akaun sudah aktif.' : 'Akaun sudah Tidak Aktif.' });
  }
  const accessChanged = Number(target.aktif) !== active || (target.inactive_reason ?? '') !== (reason ?? '');
  const restore = active === 1 && Number(target.aktif) === 0 ? 1 : 0;
  const action = accessChanged ? active ? 'reactivate_user' : 'deactivate_user' : 'update_user';
  const description = !accessChanged ? `Profil ${target.nama_penuh} dikemas kini oleh Admin.`
    : active ? `Akaun ${target.nama_penuh} diaktifkan semula oleh Admin.`
    : `Akaun ${target.nama_penuh} ditandakan Tidak Aktif. Sebab: ${reason}`;
  // Recheck the actor and prior state inside the transaction. A concurrently
  // deactivated Admin cannot use a previously authorised request to lock out
  // the remaining Admin. A stale account-status dialog cannot overwrite a change.
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE users SET ${Object.keys(profileValues).map(key => `${key}=?,`).join('')}aktif=?,inactive_reason=?,inactive_source=?,
        registration_review_year=CASE WHEN ?=1 THEN ? ELSE registration_review_year END,
        last_activity_at=CASE WHEN ?=1 THEN unixepoch() ELSE last_activity_at END,
        updated_at=datetime('now','+8 hours')
      WHERE id=? AND aktif=? AND COALESCE(inactive_reason,'')=?
      AND EXISTS (SELECT 1 FROM users actor WHERE actor.id=? AND actor.role='Admin' AND actor.aktif=1)`)
      .bind(...Object.values(profileValues), active, reason, active ? null : 'manual', restore, policyClock().year, restore, userId, target.aktif, target.inactive_reason ?? '', adminId),
    env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
      SELECT ?,?,'users',?,?,datetime('now','+8 hours') WHERE changes()>0`)
      .bind(adminId, action, userId, description),
    ...['worker_sessions', 'worker_push_devices', 'worker_webpush_subscriptions'].map(table =>
      env.DB.prepare(`DELETE FROM ${table} WHERE user_id=? AND ?=1
        AND EXISTS (SELECT 1 FROM users target WHERE target.id=? AND target.aktif=? AND target.inactive_reason IS ?)
        AND EXISTS (SELECT 1 FROM users actor WHERE actor.id=? AND actor.role='Admin' AND actor.aktif=1)`)
        .bind(userId, accessChanged ? 1 : 0, userId, active, reason, adminId)),
  ]);
  if (!wroteRow(results[0])) {
    return json({ error: true, message: 'Status akaun telah berubah atau sesi Admin tidak lagi sah. Muat semula dan cuba lagi.' }, 409);
  }
  let notified = false;
  if (!active && Number(target.aktif) === 1) {
    try {
      notified = await notifyAccountDeactivated(env,
        { name: target.nama_penuh, email: target.email, telegramChatId: target.telegram_chat_id }, reason ?? undefined);
    } catch (error) {
      console.error('[account-access] notification failed', error instanceof Error ? error.message : 'unknown');
    }
  }
  return json({ error: false, message: active ? 'Akaun diaktifkan semula. Pengguna boleh log masuk.'
    : 'Akaun ditandakan Tidak Aktif. Akses log masuk disekat dan sejarah dikekalkan.',
    is_active: active, inactive_reason: reason, notification_sent: notified });
}
