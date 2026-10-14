import { recordExpiredAppointment } from './appointment-response-core';
import type { Env } from './types';

interface PendingAppointment { id: number }

/** Process a bounded batch; the core rechecks the deadline and writes atomically. */
export async function processExpiredAppointments(env: Env, limit = 50): Promise<number> {
  if (env.APPOINTMENT_AUTO_REJECT_ENABLED !== '1' ||
      env.STAGING_AUTH_ENABLED !== '1' || env.STAGING_WRITES_ENABLED !== '1' ||
      env.APPOINTMENT_DELIVERY_ENABLED !== '1') return 0;

  const capped = Math.max(1,Math.min(limit,100));
  const pending = await env.DB.prepare(`
    SELECT lp.id
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN kejohanan k ON k.id=jp.kejohanan_id
    WHERE lp.status='Belum Jawab' AND lp.notif_hantar=1
      AND lp.tarikh_notif IS NOT NULL
      AND datetime(lp.tarikh_notif,
        CASE WHEN lower(trim(COALESCE(k.jenis_kejohanan,'')))='liga'
          THEN '+48 hours' ELSE '+3 hours' END) <= datetime('now','+8 hours')
      AND datetime(lp.tarikh_notif,
        CASE WHEN lower(trim(COALESCE(k.jenis_kejohanan,'')))='liga'
          THEN '+48 hours' ELSE '+3 hours' END) < datetime(jp.tarikh||' '||jp.masa)
    ORDER BY lp.tarikh_notif,lp.id LIMIT ?
  `).bind(capped).all<PendingAppointment>();
  let changed = 0;
  for (const row of pending.results) {
    try {
      const outcome = await recordExpiredAppointment(env,row.id);
      if (outcome.kind === 'expired') changed++;
    } catch (error) {
      console.error('Appointment expiry failed', row.id,
        error instanceof Error ? error.name : 'UnknownError');
    }
  }
  return changed;
}
