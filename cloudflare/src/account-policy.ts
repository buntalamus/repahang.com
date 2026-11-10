import { isDemo } from './demo';
import type { Env } from './types';

export const DEFAULT_INACTIVE_REASON = 'Akaun anda telah dinyahaktifkan oleh pentadbir. Sila hubungi pentadbir untuk maklumat lanjut.';

/** Calendar months in MYT, clamped at month end (not a fixed 240 days). */
export function policyClock(now = new Date()) {
  const local = new Date(now.getTime() + 8 * 3600000);
  const year = local.getUTCFullYear();
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() - 8);
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return { year, idleCutoff: Math.floor((local.getTime() - 8 * 3600000) / 1000) };
}

function rules(now: Date) {
  const { year, idleCutoff } = policyClock(now);
  // Only full calendar years since account creation count. Submission, rather
  // than approval, is the evidence. Drafts cannot satisfy the submission rule.
  const annual = `(u.role='Pengadil' AND datetime(u.created_at)<=datetime('${year - 2}-01-01 00:00:00')
    AND COALESCE(u.registration_review_year,0)<${year}
    AND NOT EXISTS (SELECT 1 FROM permohonan p WHERE p.user_id=u.id
      AND p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan IN (${year - 2},${year - 1})
      AND unixepoch(p.tarikh_hantar) IS NOT NULL
      AND lower(COALESCE(p.status_workflow,'')) NOT IN ('draf','draft')
      AND lower(COALESCE(p.workflow_status,'')) NOT IN ('draf','draft')))`;
  // Imported action logs are actor activity, never edits made by an Admin on
  // the target's profile. Automated status changes do not extend idle time.
  const lastActivity = `MAX(COALESCE(u.last_activity_at,0),COALESCE(unixepoch(u.last_login),0),
    COALESCE(unixepoch(u.created_at,'-8 hours'),0),
    COALESCE((SELECT MAX(unixepoch(a.created_at,'-8 hours')) FROM activity_log a
      WHERE a.user_id=u.id AND a.action<>'auto_deactivate_account'),0))`;
  const idle = `(u.role<>'Admin' AND ${lastActivity}>0 AND ${lastActivity}<=${idleCutoff})`;
  return { annual, idle, year };
}

/** Enforce before issuing/accepting a session and from the scheduled job. */
export async function enforceAccountPolicy(env: Env, userId?: number, now = new Date()): Promise<void> {
  if (env.STAGING_WRITES_ENABLED !== '1') return;
  // The demo is never reset: its fictional accounts must not age out.
  if (isDemo(env)) return;
  const { annual, idle, year } = rules(now);
  const scope = userId === undefined ? '' : ' AND u.id=?';
  const candidates = (await env.DB.prepare(`SELECT u.id FROM users u WHERE u.aktif=1${scope}
    AND (${annual} OR ${idle}) ORDER BY u.id LIMIT 25`).bind(...(userId === undefined ? [] : [userId])).all<{ id: number }>()).results;
  // Bounded work leaves room for the other scheduled delivery jobs; each
  // subsequent run picks up remaining accounts. Login checks never wait for it.
  for (const { id } of candidates) {
    // Re-evaluate inside the transaction so recent activity/reactivation wins
    // over a stale scheduled candidate. Manual blocks are never overwritten.
    await env.DB.batch([
      env.DB.prepare(`UPDATE users AS u SET aktif=0,
        inactive_source=CASE WHEN ${annual} THEN 'registration' ELSE 'inactivity' END,
        inactive_reason=CASE WHEN ${annual}
          THEN 'Tiada permohonan pendaftaran pengadil dihantar bagi dua tahun berturut-turut: ${year - 2} dan ${year - 1}.'
          ELSE 'Tiada aktiviti atau log masuk sepanjang 8 bulan terakhir.' END,
        updated_at=datetime('now','+8 hours')
        WHERE u.id=? AND u.aktif=1 AND (${annual} OR ${idle})`).bind(id),
      env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
        SELECT id,'auto_deactivate_account','users',id,inactive_reason,datetime('now','+8 hours')
        FROM users WHERE id=? AND changes()>0`).bind(id),
      ...['worker_sessions','worker_push_devices','worker_webpush_subscriptions'].map(table =>
        env.DB.prepare(`DELETE FROM ${table} WHERE user_id=? AND EXISTS
          (SELECT 1 FROM users WHERE id=? AND aktif=0)`).bind(id, id)),
    ]);
  }
}

/** Called only by foreground interaction, never polling or notification delivery. */
export async function recordAccountActivity(env: Env, id: number): Promise<void> {
  if (env.STAGING_WRITES_ENABLED !== '1') return;
  await env.DB.prepare(`UPDATE users SET last_activity_at=unixepoch()
    WHERE id=? AND aktif=1 AND COALESCE(last_activity_at,0)<unixepoch()-300`).bind(id).run();
}
