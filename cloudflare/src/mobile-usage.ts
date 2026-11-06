/**
 * Who uses the mobile app (Android APK and the iPhone web app at /app/), for
 * the Statistik pages. Admin sees every active user; PP Daerah only users of
 * their district. Read-only.
 *
 * Status per user:
 *  - notifikasi: an app/phone that can receive pushes (Android device with a
 *    live app session, or a Web Push subscription);
 *  - log_masuk: a live app session (90-day mobile login) but no push yet;
 *  - belum: neither.
 */
import { appointmentManager, districtOf } from './appointment-access';
import { currentUser, json } from './auth';
import type { Env } from './types';

interface UsageRow {
  id: number;
  nama_penuh: string | null;
  email: string | null;
  role: string;
  jenis_pengadil: string | null;
  persatuan: string | null;
  app_session: number;
  android_version: string | null;
  web_push: number;
  last_seen: string | null;
}

/** "1.2.0" < "1.3.0". */
function older(version: string | null, latest: string): boolean {
  if (!version) return false;
  const parse = (v: string) => v.split(/[.+]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parse(version), parse(latest)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

export async function mobileUsage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (!appointmentManager(user)) return json({ error: true, message: 'Akses ditolak.' }, 403);
  const district = user.role === 'Admin' ? null : districtOf(user);
  const now = Math.floor(Date.now() / 1000);
  const rows = (await env.DB.prepare(`
    WITH app AS (
      SELECT user_id, MAX(created_at) AS last_login FROM worker_sessions
      WHERE expires_at-created_at>86400 AND expires_at>? GROUP BY user_id),
    android AS (
      SELECT d.user_id, MAX(d.app_version) AS version, MAX(d.last_seen_at) AS seen
      FROM worker_push_devices d JOIN worker_sessions s ON s.token_hash=d.session_token_hash AND s.expires_at>?
      GROUP BY d.user_id),
    web AS (SELECT user_id, MAX(last_seen_at) AS seen FROM worker_webpush_subscriptions GROUP BY user_id)
    SELECT u.id,u.nama_penuh,u.email,u.role,u.jenis_pengadil,p.nama_persatuan AS persatuan,
      CASE WHEN app.user_id IS NULL THEN 0 ELSE 1 END AS app_session,
      android.version AS android_version,
      CASE WHEN web.user_id IS NULL THEN 0 ELSE 1 END AS web_push,
      MAX(COALESCE(android.seen,''),COALESCE(web.seen,''),
        COALESCE(datetime(app.last_login,'unixepoch','+8 hours'),'')) AS last_seen
    FROM users u
    LEFT JOIN persatuan_bolasepak_daerah p ON p.id=COALESCE(NULLIF(u.persatuan_id,0),u.district_id)
    LEFT JOIN app ON app.user_id=u.id
    LEFT JOIN android ON android.user_id=u.id
    LEFT JOIN web ON web.user_id=u.id
    WHERE u.aktif=1 ${district === null ? '' : 'AND COALESCE(NULLIF(u.persatuan_id,0),u.district_id)=?'}
    ORDER BY u.role,u.nama_penuh`)
    .bind(now, now, ...(district === null ? [] : [district])).all<UsageRow>()).results;
  const latest = env.MOBILE_LATEST_VERSION ?? '1.0.0';
  const users = rows.map((row) => {
    const push = row.android_version !== null || row.web_push === 1;
    return {
      id: row.id,
      nama_penuh: row.nama_penuh,
      email: row.email,
      role: row.role,
      jenis_pengadil: row.jenis_pengadil,
      persatuan: row.persatuan,
      status: push ? 'notifikasi' : row.app_session ? 'log_masuk' : 'belum',
      android_version: row.android_version,
      versi_lama: older(row.android_version, latest),
      web_push: row.web_push === 1,
      last_seen: row.last_seen || null,
    };
  });
  const roles = new Map<string, { role: string; aktif: number; notifikasi: number; log_masuk: number; belum: number; versi_lama: number }>();
  for (const u of users) {
    const r = roles.get(u.role) ?? { role: u.role, aktif: 0, notifikasi: 0, log_masuk: 0, belum: 0, versi_lama: 0 };
    r.aktif += 1;
    r[u.status as 'notifikasi' | 'log_masuk' | 'belum'] += 1;
    if (u.versi_lama) r.versi_lama += 1;
    roles.set(u.role, r);
  }
  return json({ error: false, latest_version: latest, summary: [...roles.values()], users });
}
