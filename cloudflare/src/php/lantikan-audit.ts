/** Port of config/lantikan-audit.php. */
import type { Env } from '../types';

export const NOW = "datetime('now','+8 hours')";

/** Request facts PHP read from $_SERVER for audit rows. */
export interface AuditMeta { ip: string | null; userAgent: string | null }

export function auditMetaFrom(request: Request | null): AuditMeta {
  if (!request) return { ip: null, userAgent: null };
  const agent = request.headers.get('User-Agent');
  return {
    ip: request.headers.get('CF-Connecting-IP'),
    userAgent: agent === null ? null : Array.from(agent).slice(0, 255).join(''),
  };
}

export interface LantikanSnapshot {
  lantikan_id: number;
  jadual_id: number;
  kejohanan_id: number | null;
  pengadil_id: number | null;
  pengadil_luar_id: number | null;
  jawatan: string;
  status: string;
  komen: string | null;
  sebab_status: string | null;
  tarikh_jawab: string | null;
  notif_hantar: number | null;
  tg_notif_hantar: number | null;
  tarikh_notif: string | null;
  email_token: string | null;
  tg_token: string | null;
  penilaian_token: string | null;
  nama_pegawai: string;
  emel_pegawai: string;
  no_telefon_pegawai: string;
  telegram_chat_id: number | string | null;
  tg_link_token: string | null;
  no_perlawanan: string | null;
  tarikh: string;
  masa: string | null;
  tempat: string | null;
  jadual_status: string;
  pasukan_home: string;
  pasukan_away: string;
  kejohanan: string;
}

export const SNAPSHOT_SQL = `
  SELECT lp.id AS lantikan_id, lp.jadual_id, jp.kejohanan_id,
         lp.pengadil_id, lp.pengadil_luar_id, lp.jawatan, lp.status,
         lp.komen, lp.sebab_status, lp.tarikh_jawab,
         lp.notif_hantar, lp.tg_notif_hantar, lp.tarikh_notif,
         lp.email_token, lp.tg_token, lp.penilaian_token,
         COALESCE(u.nama_penuh, pl.nama, '') AS nama_pegawai,
         COALESCE(u.email, pl.emel, '') AS emel_pegawai,
         COALESCE(u.no_telefon, pl.no_tel, '') AS no_telefon_pegawai,
         COALESCE(u.telegram_chat_id, pl.telegram_chat_id) AS telegram_chat_id,
         COALESCE(u.tg_link_token, pl.tg_link_token) AS tg_link_token,
         jp.no_perlawanan, jp.tarikh, jp.masa, jp.tempat,
         jp.status AS jadual_status,
         jp.pasukan_home, jp.pasukan_away,
         COALESCE(kj.nama, '') AS kejohanan
  FROM lantikan_pengadil lp
  JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
  LEFT JOIN kejohanan kj ON kj.id = jp.kejohanan_id
  LEFT JOIN users u ON u.id = lp.pengadil_id
  LEFT JOIN pengadil_luar pl ON pl.id = lp.pengadil_luar_id
  WHERE lp.id = ?`;

export async function getLantikanAuditSnapshot(env: Env, lantikanId: number): Promise<LantikanSnapshot | null> {
  return env.DB.prepare(SNAPSHOT_SQL).bind(lantikanId).first<LantikanSnapshot>();
}

export function buildTelegramLink(env: Env, linkToken: string): string {
  const botUsername = (env.TELEGRAM_BOT_USERNAME || 'refpahang_bot').replace(/^@+/, '');
  return `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(linkToken)}`;
}

export function buildAppointmentDirectLinks(env: Env, emailToken: string):
  { accept_url: string; reject_url: string } {
  const base = (env.BASE_URL || 'https://refpahang.com').replace(/\/+$/, '');
  const encoded = encodeURIComponent(emailToken);
  return {
    accept_url: `${base}/api/lantikan-jawab-token.php?token=${encoded}&action=accept`,
    reject_url: `${base}/api/lantikan-jawab-token.php?token=${encoded}&action=reject`,
  };
}

/** json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); [] stays an array. */
export function phpJson(details: Record<string, unknown> | unknown[]): string {
  return !Array.isArray(details) && Object.keys(details).length === 0 ? '[]' : JSON.stringify(details);
}

/** INSERT for recordLantikanAudit(); usable on its own or inside a D1 batch. */
export function lantikanAuditStatement(env: Env, lantikanId: number, eventType: string,
  channel: string, eventStatus: string, details: Record<string, unknown> | unknown[],
  linkUrl: string | null, actorType: string, actorUserId: number | null,
  snapshot: LantikanSnapshot, meta: AuditMeta, eventKey: string | null = null): D1PreparedStatement {
  return env.DB.prepare(`
    INSERT INTO lantikan_audit_log (
      event_key, lantikan_id, jadual_id, kejohanan_id,
      pengadil_id, pengadil_luar_id, jawatan,
      nama_pegawai, emel_pegawai, no_telefon_pegawai,
      event_type, channel, event_status, link_url, details_json,
      actor_type, actor_user_id, ip_address, user_agent, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,${NOW})`).bind(
    eventKey, lantikanId, snapshot.jadual_id ?? null, snapshot.kejohanan_id ?? null,
    snapshot.pengadil_id ?? null, snapshot.pengadil_luar_id ?? null, snapshot.jawatan ?? null,
    snapshot.nama_pegawai ?? null, snapshot.emel_pegawai ?? null, snapshot.no_telefon_pegawai ?? null,
    eventType, channel, eventStatus, linkUrl, phpJson(details),
    actorType, actorUserId, meta.ip, meta.userAgent);
}

export async function recordLantikanAudit(env: Env, lantikanId: number, eventType: string,
  channel = 'system', eventStatus = 'info', details: Record<string, unknown> | unknown[] = [],
  linkUrl: string | null = null, actorType = 'system', actorUserId: number | null = null,
  snapshot: LantikanSnapshot | null = null, meta: AuditMeta = { ip: null, userAgent: null },
  eventKey: string | null = null): Promise<void> {
  const resolved = snapshot ?? await getLantikanAuditSnapshot(env, lantikanId);
  if (!resolved) throw new Error('Lantikan untuk log audit tidak dijumpai.');
  await lantikanAuditStatement(env, lantikanId, eventType, channel, eventStatus, details,
    linkUrl, actorType, actorUserId, resolved, meta, eventKey).run();
}

/**
 * recordLantikanAudit() inside a D1 batch where the row id is not known yet:
 * the snapshot is read by the INSERT itself, after earlier batch statements.
 */
export function lantikanAuditSelectStatement(env: Env, where: string, whereBinds: unknown[],
  eventType: string, channel: string, eventStatus: string,
  details: Record<string, unknown> | unknown[], linkUrl: string | null, actorType: string,
  actorUserId: number | null, meta: AuditMeta, eventKey: string | null = null): D1PreparedStatement {
  return env.DB.prepare(`
    INSERT INTO lantikan_audit_log (
      event_key, lantikan_id, jadual_id, kejohanan_id,
      pengadil_id, pengadil_luar_id, jawatan,
      nama_pegawai, emel_pegawai, no_telefon_pegawai,
      event_type, channel, event_status, link_url, details_json,
      actor_type, actor_user_id, ip_address, user_agent, created_at
    )
    SELECT ?, lp.id, lp.jadual_id, jp.kejohanan_id, lp.pengadil_id, lp.pengadil_luar_id, lp.jawatan,
      COALESCE(u.nama_penuh, pl.nama, ''), COALESCE(u.email, pl.emel, ''),
      COALESCE(u.no_telefon, pl.no_tel, ''), ?, ?, ?, ?, ?, ?, ?, ?, ?, ${NOW}
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
    LEFT JOIN users u ON u.id = lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id = lp.pengadil_luar_id
    WHERE ${where}`).bind(eventKey, eventType, channel, eventStatus, linkUrl, phpJson(details),
    actorType, actorUserId, meta.ip, meta.userAgent, ...whereBinds);
}
