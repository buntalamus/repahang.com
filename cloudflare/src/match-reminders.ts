/**
 * Phone reminders for accepted appointments: one about 24 hours and one about
 * 2 hours before kickoff, sent by the five-minute cron to the official's app
 * (FCM) and Web Push subscriptions. Push only — nothing is added to the
 * portal's notification list, so PHP-era notices are unchanged.
 */
import { pushEnabled, sendPush, type PushMessage } from './push';
import { sendWebPush, webPushEnabled, webPushUrl, type WebPushMessage } from './webpush';
import type { Env } from './types';

interface Due {
  id: number;
  pengadil_id: number;
  role: string;
  jawatan: string;
  tarikh: string;
  masa: string;
  tempat: string | null;
  pasukan_home: string | null;
  pasukan_away: string | null;
  kind: '24h' | '2h';
}

const KICKOFF = "datetime(date(jp.tarikh)||' '||substr(jp.masa,1,5))";
const NOW = "datetime('now','+8 hours')";

/** Appointments whose reminder window has opened and that were not reminded yet. */
function dueSql(kind: '24h' | '2h'): string {
  // The 24h reminder is skipped when the match is already within 2 hours;
  // the 2h one then covers it.
  const window = kind === '24h'
    ? `${KICKOFF} > datetime(${NOW},'+2 hours') AND ${KICKOFF} <= datetime(${NOW},'+24 hours')`
    : `${KICKOFF} > ${NOW} AND ${KICKOFF} <= datetime(${NOW},'+2 hours')`;
  return `SELECT lp.id,lp.pengadil_id,u.role,lp.jawatan,jp.tarikh,jp.masa,jp.tempat,jp.pasukan_home,jp.pasukan_away,
      '${kind}' AS kind
    FROM lantikan_pengadil lp JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    JOIN users u ON u.id=lp.pengadil_id AND u.aktif=1
    WHERE lp.status='Diterima' AND COALESCE(jp.status,'') NOT IN ('Dibatalkan','Ditangguhkan')
      AND jp.masa IS NOT NULL AND jp.masa<>'' AND ${window}
      AND NOT EXISTS (SELECT 1 FROM worker_match_reminders r WHERE r.lantikan_id=lp.id AND r.kind='${kind}')`;
}

export function reminderText(due: Due): { title: string; body: string } {
  const match = `${due.pasukan_home ?? '-'} vs ${due.pasukan_away ?? '-'}`;
  const time = due.masa.slice(0, 5);
  const title = due.kind === '24h' ? `Esok: ${match}` : `2 jam lagi: ${match}`;
  const body = `${due.jawatan} · ${due.kind === '24h' ? 'esok ' : ''}${time}${due.tempat ? ` · ${due.tempat}` : ''}`;
  return { title, body };
}

export async function processMatchReminders(env: Env, limit = 50): Promise<{ sent: number; reminders: number }> {
  const fcm = pushEnabled(env);
  const web = webPushEnabled(env);
  const summary = { sent: 0, reminders: 0 };
  if (!fcm && !web) return summary;
  const due = [
    ...(await env.DB.prepare(`${dueSql('2h')} LIMIT ?`).bind(limit).all<Due>()).results,
    ...(await env.DB.prepare(`${dueSql('24h')} LIMIT ?`).bind(limit).all<Due>()).results,
  ];
  const now = Math.floor(Date.now() / 1000);
  for (const item of due) {
    // Claim first: a concurrent cron run loses the insert and skips this one.
    const claim = await env.DB.prepare('INSERT OR IGNORE INTO worker_match_reminders(lantikan_id,kind) VALUES(?,?)')
      .bind(item.id, item.kind).run();
    if (claim.meta.changes !== 1) continue;
    summary.reminders += 1;
    const { title, body } = reminderText(item);
    if (fcm) {
      const devices = (await env.DB.prepare(`SELECT d.token FROM worker_push_devices d
          JOIN worker_sessions s ON s.token_hash=d.session_token_hash AND s.expires_at>? WHERE d.user_id=?`)
        .bind(now, item.pengadil_id).all<{ token: string }>()).results;
      const message: PushMessage = { title, body, data: { type: 'Peringatan Perlawanan', screen: 'lantikan', id: String(item.id) } };
      for (const device of devices) if (await sendPush(env, device.token, message) === 'sent') summary.sent += 1;
    }
    if (web) {
      const subs = (await env.DB.prepare('SELECT id,endpoint,p256dh,auth FROM worker_webpush_subscriptions WHERE user_id=?')
        .bind(item.pengadil_id).all<{ id: number; endpoint: string; p256dh: string; auth: string }>()).results;
      const message: WebPushMessage = { title, body, url: webPushUrl(item.role, 'lantikan'), screen: 'lantikan', tag: `r${item.id}-${item.kind}` };
      for (const sub of subs) {
        const result = await sendWebPush(env, sub, message);
        if (result === 'sent') summary.sent += 1;
        else if (result === 'invalid') await env.DB.prepare('DELETE FROM worker_webpush_subscriptions WHERE id=?').bind(sub.id).run();
      }
    }
  }
  return summary;
}
