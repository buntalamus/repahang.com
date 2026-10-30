/**
 * Monday-morning summary for Admin and PP Daerah: one email that replaces the
 * per-event copies. Sent by the five-minute cron from 08:00 Malaysia time on
 * Mondays, once per person per week, and only when something needs action.
 */
import { listAppointmentGaps } from './appointment-gaps';
import { baseUrl, buildEmailTemplate, emailButton, emailGreeting, emailInfoTable, emailPara, sendEmail } from './php/email';
import { h } from './php/format';
import type { Env } from './types';

interface Staff { id: number; nama_penuh: string; email: string; role: string; district: number | null }

export interface DigestCounts {
  gaps: Record<string, unknown>[];
  rejected: number;
  pendingMatches: number;
  pendingApplications: number;
  pendingReports: number;
}

/** Monday of the Malaysia-time week, e.g. "2026-10-19". */
export function weekKey(now = Date.now()): string {
  const kl = new Date(now + 8 * 3600_000);
  const monday = new Date(kl);
  monday.setUTCDate(kl.getUTCDate() - ((kl.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function due(now = Date.now()): boolean {
  const kl = new Date(now + 8 * 3600_000);
  return kl.getUTCDay() === 1 && kl.getUTCHours() >= 8;
}

export async function digestCounts(env: Env, staff: { role: string; district: number | null }): Promise<DigestCounts> {
  const district = staff.role === 'Admin' ? null : staff.district;
  const scope = (column: string) => (district === null ? '' : `AND ${column}=?`);
  const binds = district === null ? [] : [district];
  const one = async (sql: string) => Number((await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0);
  const [gaps, rejected, pendingMatches, pendingApplications, pendingReports] = await Promise.all([
    listAppointmentGaps(env, district, 7),
    one(`SELECT count(*) AS n FROM lantikan_pengadil lp JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id WHERE lp.status='Ditolak'
      AND COALESCE(lp.tarikh_jawab,lp.updated_at)>=datetime('now','+8 hours','-7 days') ${scope('k.lantikan_persatuan_id')}`),
    one(`SELECT count(DISTINCT COALESCE(match_group_id,'s'||id)) AS n FROM perlawanan
      WHERE COALESCE(status_pp,'Belum Disahkan')='Belum Disahkan' ${scope('daerah_perlawanan_id')}`),
    one(district === null
      ? "SELECT count(*) AS n FROM permohonan WHERE status_workflow='Menunggu Admin'"
      : "SELECT count(*) AS n FROM permohonan WHERE status_workflow='Menunggu PP Daerah' AND persatuan_id=?"),
    district === null ? one("SELECT count(*) AS n FROM laporan_penilaian WHERE status='Dihantar'") : Promise.resolve(0),
  ]);
  return { gaps, rejected, pendingMatches, pendingApplications, pendingReports };
}

export function digestHtml(env: Env, staff: Staff, c: DigestCounts): string {
  const base = baseUrl(env);
  const admin = staff.role === 'Admin';
  const rows: Array<[string, string]> = [
    ['Perlawanan 7 hari belum lengkap pegawai', String(c.gaps.length)],
    ['Lantikan ditolak (7 hari lepas)', String(c.rejected)],
    ['Rekod perlawanan menunggu pengesahan', String(c.pendingMatches)],
    [admin ? 'Permohonan menunggu Admin' : 'Permohonan menunggu PP Daerah', String(c.pendingApplications)],
    ...(admin ? [['Laporan RA menunggu pengesahan', String(c.pendingReports)] as [string, string]] : []),
  ];
  let body = emailGreeting(staff.nama_penuh)
    + emailPara('Ringkasan mingguan perkara yang memerlukan tindakan anda dalam Sistem Pengurusan Pengadil PBNP.')
    + emailInfoTable(rows);
  if (c.gaps.length) {
    const list = c.gaps.slice(0, 10).map((g) => `<li style="margin-bottom:4px;">${h(g.tarikh)} ${h(String(g.masa ?? '').slice(0, 5))}
      — <strong>${h(g.pasukan_home)} lwn ${h(g.pasukan_away)}</strong> (${h(g.nama_kejohanan)})</li>`).join('');
    body += emailPara('<strong>Perlawanan yang belum lengkap pegawai:</strong>')
      + `<ul style="color:#374151;font-size:13px;line-height:1.6;margin:0 0 16px;padding-left:20px;">${list}</ul>`
      + (c.gaps.length > 10 ? emailPara(`dan ${c.gaps.length - 10} lagi.`) : '');
  }
  body += emailButton(`${base}${admin ? '/admin' : '/pp-daerah'}`, 'Buka sistem')
    + emailPara('<span style="color:#6B7280;font-size:12px;">Makluman harian dihantar melalui Telegram dan app RefPahang. Emel ini dihantar seminggu sekali.</span>');
  return buildEmailTemplate('Ringkasan Mingguan', '#111827', '', body);
}

export async function processWeeklyDigest(env: Env, now = Date.now(), limit = 20): Promise<{ sent: number; skipped: number }> {
  const summary = { sent: 0, skipped: 0 };
  // Production only (staging keeps writes and outbound mail off).
  if (env.STAGING_WRITES_ENABLED !== '1' || !due(now)) return summary;
  const week = weekKey(now);
  const staff = (await env.DB.prepare(`SELECT u.id,u.nama_penuh,trim(u.email) AS email,u.role,
      COALESCE(NULLIF(u.persatuan_id,0),u.district_id) AS district
    FROM users u WHERE u.aktif=1 AND u.role IN ('Admin','PP Daerah') AND trim(COALESCE(u.email,''))<>''
      AND NOT EXISTS (SELECT 1 FROM worker_weekly_digest d WHERE d.user_id=u.id AND d.week_key=?)
    ORDER BY u.id LIMIT ?`).bind(week, limit).all<Staff>()).results;
  for (const person of staff) {
    if (person.role === 'PP Daerah' && !person.district) continue;
    const claim = await env.DB.prepare(`INSERT OR IGNORE INTO worker_weekly_digest(user_id,week_key,status) VALUES(?,?,'claimed')`)
      .bind(person.id, week).run();
    if (claim.meta.changes !== 1) continue;
    const counts = await digestCounts(env, person);
    const total = counts.gaps.length + counts.rejected + counts.pendingMatches + counts.pendingApplications + counts.pendingReports;
    if (total === 0) {
      await env.DB.prepare(`UPDATE worker_weekly_digest SET status='nothing' WHERE user_id=? AND week_key=?`).bind(person.id, week).run();
      summary.skipped += 1;
      continue;
    }
    const ok = await sendEmail(env, person.email, `Ringkasan Mingguan RefPahang — ${week}`, digestHtml(env, person, counts),
      person.nama_penuh, 'admin');
    if (ok) {
      await env.DB.prepare(`UPDATE worker_weekly_digest SET status='sent' WHERE user_id=? AND week_key=?`).bind(person.id, week).run();
      summary.sent += 1;
    } else {
      // Release the claim so the next cron run retries.
      await env.DB.prepare('DELETE FROM worker_weekly_digest WHERE user_id=? AND week_key=?').bind(person.id, week).run();
    }
  }
  return summary;
}
