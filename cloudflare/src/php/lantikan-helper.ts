/** Port of config/lantikan-helper.php used by the appointment endpoints. */
import type { Env } from '../types';
import type { KupOfficial } from './email';
import { buildEmailTemplate, emailButton, emailGreeting, emailInfoTable, emailPara,
  sendEmail, sendKupCrewCompleteEmail, baseUrl } from './email';
import { getMatchKickoffTimestamp, h, klTimestamp, masaFmt, phpDate, tarikhFmt } from './format';

export { getMatchKickoffTimestamp };
import type { AuditMeta } from './lantikan-audit';
import type { LantikanSnapshot } from './lantikan-audit';
import { NOW, getLantikanAuditSnapshot, recordLantikanAudit } from './lantikan-audit';
import { tgKupCrewCompleteMessage, tgSend } from './telegram';
import { wroteRow } from '../d1-changes';
import { contactRecipient, enqueueNoticeStatements } from '../notify';
import { autoRejectNotice, autoRejectOwnerNotice, autoRejectRecipient, queueAutoRejectDigests } from '../lantikan-notify';
import { responseDeadline } from '../../../shared/appointment-deadline';

export const LANTIKAN_AUTO_TOLAK_KOMEN = 'Ditolak automatik - tiada jawapan dalam tempoh';
export const KUP_POSITIONS = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4'];
const KUP_SQL = "'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4'";
const KUP_ORDER = `CASE lp.jawatan WHEN 'Pengadil' THEN 1 WHEN 'Penolong Pengadil 1' THEN 2
  WHEN 'Penolong Pengadil 2' THEN 3 WHEN 'Pegawai ke4' THEN 4 ELSE 0 END`;

export function isKupPosition(jawatan: string): boolean {
  return KUP_POSITIONS.includes(jawatan);
}

export function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)),
    (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}


export function hasMatchStarted(tarikh: string, masa: string, nowMs = Date.now()): boolean {
  const kickoff = getMatchKickoffTimestamp(tarikh, masa);
  return kickoff !== null && nowMs >= kickoff;
}

export function matchStartedMessage(tarikh: string, masa: string): string {
  const kickoff = getMatchKickoffTimestamp(tarikh, masa);
  const text = kickoff !== null ? phpDate('d M Y, H:i', kickoff) : `${tarikh} ${masa}`.trim();
  return `Lantikan atau notifikasi tidak dibenarkan kerana perlawanan telah bermula (${text}).`;
}

export function localDateTime(ms: number): string {
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
}

export async function getMatchKupOfficials(env: Env, jadualId: number):
  Promise<{ region_label: string; officials: Array<KupOfficial & { lantikan_id: number }> }> {
  const rows = await env.DB.prepare(`
    SELECT lp.id AS lantikan_id, lp.jawatan,
      COALESCE(NULLIF(trim(u.nama_penuh),''),NULLIF(trim(pl.nama),''),'Nama tidak direkodkan') AS nama,
      COALESCE(NULLIF(trim(u.no_telefon),''),NULLIF(trim(pl.no_tel),''),'-') AS no_telefon,
      CASE WHEN COALESCE(kj.peringkat_kejohanan,'Daerah')='Negeri'
        THEN COALESCE(NULLIF(trim(u.daerah),''),NULLIF(trim(pl.daerah),''),'-')
        ELSE COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),'-') END AS wilayah,
      COALESCE(kj.peringkat_kejohanan,'Daerah') AS peringkat_kejohanan
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN kejohanan kj ON kj.id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.jadual_id=? AND lp.jawatan IN (${KUP_SQL})
      AND lp.status IN ('Belum Jawab','Diterima')
    ORDER BY ${KUP_ORDER}`).bind(jadualId)
    .all<KupOfficial & { lantikan_id: number; peringkat_kejohanan: string }>();
  const peringkat = rows.results[0]?.peringkat_kejohanan ?? 'Daerah';
  return {
    region_label: peringkat === 'Negeri' ? 'Daerah' : 'Negeri',
    officials: rows.results.map(({ peringkat_kejohanan: _unused, ...official }) => official),
  };
}

export async function getAppointmentSlotValidation(env: Env, jadualId: number):
  Promise<{ valid: boolean; total: number; missing: string[] }> {
  const rows = await env.DB.prepare(`SELECT jawatan FROM lantikan_pengadil
    WHERE jadual_id=? AND status IN ('Belum Jawab','Diterima')`).bind(jadualId)
    .all<{ jawatan: string }>();
  const positions = [...new Set(rows.results.map((row) => String(row.jawatan)))];
  const missing = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2']
    .filter((role) => !positions.includes(role));
  return { valid: missing.length === 0 && positions.length >= 3 && positions.length <= 5,
    total: positions.length, missing };
}

export async function markMatchDispatchedIfComplete(env: Env, jadualId: number): Promise<boolean> {
  if (!(await getAppointmentSlotValidation(env, jadualId)).valid) return false;
  const counts = await env.DB.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='Diterima' OR notif_hantar=1 THEN 1 ELSE 0 END) AS dihantar
    FROM lantikan_pengadil WHERE jadual_id=? AND status IN ('Belum Jawab','Diterima')`)
    .bind(jadualId).first<{ total: number; dihantar: number | null }>();
  const complete = Number(counts?.total ?? 0) === Number(counts?.dihantar ?? 0);
  if (complete) {
    await env.DB.prepare("UPDATE jadual_perlawanan SET status='Disahkan' WHERE id=?").bind(jadualId).run();
  }
  return complete;
}

export async function isAcceptedKupCrewComplete(env: Env, jadualId: number): Promise<boolean> {
  const rows = await env.DB.prepare(`SELECT jawatan,status FROM lantikan_pengadil
    WHERE jadual_id=? AND jawatan IN (${KUP_SQL}) AND status IN ('Belum Jawab','Diterima')`)
    .bind(jadualId).all<{ jawatan: string; status: string }>();
  if (rows.results.length < 3 || rows.results.length > 4) return false;
  const positions = new Set<string>();
  for (const row of rows.results) {
    if (positions.has(row.jawatan) || row.status !== 'Diterima') return false;
    positions.add(row.jawatan);
  }
  return ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2'].every((role) => positions.has(role));
}

export async function markAppointmentExternallyDelivered(env: Env, lantikanId: number,
  telegramDelivered: boolean, emailDelivered: boolean): Promise<boolean> {
  if (!telegramDelivered && !emailDelivered) return false;
  const result = await env.DB.prepare(`UPDATE lantikan_pengadil SET notif_hantar=1,
      tarikh_notif=${NOW},
      tg_notif_hantar=CASE WHEN ?=1 THEN 1 ELSE tg_notif_hantar END
    WHERE id=? AND status='Belum Jawab'`).bind(telegramDelivered ? 1 : 0, lantikanId).run();
  return wroteRow(result);
}

/**
 * syncPerlawananHistoryForJadual(): remove history for appointments that are
 * not accepted registered KUP, then insert/update the accepted ones with the
 * current crew snapshot. `guard` lets a batch skip the sync when its own
 * transaction aborted.
 */
export function historySyncStatements(env: Env, jadualId: number,
  guard: { sql: string; binds: unknown[] } = { sql: '1', binds: [] }): D1PreparedStatement[] {
  const crew = (role: string) => `(SELECT c.pengadil_id FROM lantikan_pengadil c
    WHERE c.jadual_id=lp.jadual_id AND c.jawatan='${role}' AND c.status='Diterima'
      AND c.pengadil_id IS NOT NULL ORDER BY c.id DESC LIMIT 1)`;
  const parts = `(CASE WHEN COALESCE(kj.nama,'')<>'' THEN ' - '||kj.nama ELSE '' END
    || CASE WHEN COALESCE(jp.kategori,'')<>'' THEN ' - '||jp.kategori ELSE '' END
    || CASE WHEN COALESCE(jp.peringkat,'')<>'' THEN ' - '||jp.peringkat ELSE '' END)`;
  return [
    env.DB.prepare(`DELETE FROM perlawanan WHERE lantikan_id IN (
        SELECT lp.id FROM lantikan_pengadil lp WHERE lp.jadual_id=?
          AND (lp.status<>'Diterima' OR lp.pengadil_id IS NULL OR lp.jawatan NOT IN (${KUP_SQL})))
      AND ${guard.sql}`).bind(jadualId, ...guard.binds),
    env.DB.prepare(`INSERT INTO perlawanan (user_id,lantikan_id,tarikh,masa,jenis,nama_kejohanan,
        tempat,home_team,away_team,jawatan,head_referee_id,assistant_referee_1_id,
        assistant_referee_2_id,fourth_official_id,status_pp,created_at)
      SELECT lp.pengadil_id,lp.id,jp.tarikh,jp.masa,
        substr(CASE WHEN ${parts}='' THEN 'Kejohanan' ELSE substr(${parts},4) END,1,60),
        NULLIF(COALESCE(kj.nama,''),''),COALESCE(jp.tempat,''),COALESCE(jp.pasukan_home,''),
        COALESCE(jp.pasukan_away,''),lp.jawatan,
        ${crew('Pengadil')},${crew('Penolong Pengadil 1')},${crew('Penolong Pengadil 2')},
        ${crew('Pegawai ke4')},'Disahkan',${NOW}
      FROM lantikan_pengadil lp
      JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      LEFT JOIN kejohanan kj ON kj.id=jp.kejohanan_id
      WHERE lp.jadual_id=? AND lp.status='Diterima' AND lp.pengadil_id IS NOT NULL
        AND lp.jawatan IN (${KUP_SQL}) AND ${guard.sql}
      ON CONFLICT(lantikan_id) DO UPDATE SET user_id=excluded.user_id,tarikh=excluded.tarikh,
        masa=excluded.masa,jenis=excluded.jenis,nama_kejohanan=excluded.nama_kejohanan,
        tempat=excluded.tempat,home_team=excluded.home_team,away_team=excluded.away_team,
        jawatan=excluded.jawatan,head_referee_id=excluded.head_referee_id,
        assistant_referee_1_id=excluded.assistant_referee_1_id,
        assistant_referee_2_id=excluded.assistant_referee_2_id,
        fourth_official_id=excluded.fourth_official_id,status_pp='Disahkan'`)
      .bind(jadualId, ...guard.binds),
  ];
}

export async function syncPerlawananHistoryForJadual(env: Env, jadualId: number): Promise<void> {
  await env.DB.batch(historySyncStatements(env, jadualId));
}

export function portalNotificationStatement(env: Env, userId: number, type: string,
  subject: string, message: string): D1PreparedStatement {
  // MySQL defaulted email_sent and is_read to 0; D1 has no column defaults.
  return env.DB.prepare(`INSERT INTO notifications (user_id,type,subject,message,email_sent,is_read,created_at)
    VALUES (?,?,?,?,0,0,${NOW})`).bind(userId, type, subject, message);
}

export async function createPortalNotification(env: Env, userId: number, type: string,
  subject: string, message: string): Promise<void> {
  await portalNotificationStatement(env, userId, type, subject, message).run();
}

export async function notifyLantikanPortal(env: Env, userId: number, jawatan: string,
  kejohanan: string, tarikh: string, pasukanHome: string, pasukanAway: string): Promise<void> {
  const subject = `Lantikan: ${pasukanHome} lwn ${pasukanAway}`;
  const message = `Anda telah dilantik sebagai ${jawatan} untuk perlawanan ${pasukanHome} lwn ${pasukanAway} (${kejohanan}) pada ${tarikhFmt(tarikh)}. Sila semak menu Tugasan untuk terima atau tolak.`;
  await createPortalNotification(env, userId, 'Lantikan', subject, message);
}

/**
 * One portal notice, Telegram message and email per match to each PP Daerah,
 * listing every official from their district appointed to it.
 */
export async function notifyPPDaerahLantikan(env: Env, persatuanId: number,
  officials: Array<{ nama: string; jawatan: string }>, kejohanan: string, tarikh: string, masa: string,
  tempat: string, pasukanHome: string, pasukanAway: string): Promise<void> {
  if (!persatuanId || officials.length === 0) return;
  const users = await env.DB.prepare(`SELECT id,nama_penuh,email,telegram_chat_id FROM users
    WHERE role='PP Daerah' AND persatuan_id=? AND aktif=1`).bind(persatuanId)
    .all<{ id: number; nama_penuh: string; email: string | null; telegram_chat_id: number | null }>();
  if (users.results.length === 0) return;
  const tarikhText = tarikhFmt(tarikh);
  const masaText = masaFmt(masa);
  const pasukan = `${pasukanHome} lwn ${pasukanAway}`;
  const names = officials.map((item) => `${item.nama} (${item.jawatan})`).join(', ');
  for (const pp of users.results) {
    await createPortalNotification(env, pp.id, 'Lantikan Pegawai Pembangunan Daerah', `Lantikan Pengadil Daerah: ${pasukan}`,
      `${officials.length} pengadil daerah anda dilantik untuk ${pasukan} (${kejohanan}) pada ${tarikhText}: ${names}.`);
    if (pp.telegram_chat_id) {
      const message = '<b>📋 Makluman Lantikan Pengadil</b>\n\n'
        + 'Pengadil daerah anda telah dilantik:\n'
        + officials.map((item) => `• <b>${h(item.nama)}</b> — ${h(item.jawatan)}`).join('\n') + '\n\n'
        + `<b>Kejohanan:</b> ${h(kejohanan)}\n`
        + `<b>Perlawanan:</b> ${h(pasukan)}\n`
        + `<b>Tarikh:</b> ${tarikhText}\n`
        + `<b>Masa:</b> ${masaText}\n`
        + `<b>Tempat:</b> ${h(tempat)}\n`;
      await tgSend(env, pp.telegram_chat_id, message);
    }
    if (pp.email) {
      const body = emailGreeting(pp.nama_penuh)
        + emailPara('Pengadil dari daerah anda telah dilantik untuk bertugas:')
        + emailInfoTable([
          ...officials.map((item): [string, string] => [item.jawatan, h(item.nama)]),
          ['Kejohanan', h(kejohanan)], ['Perlawanan', h(pasukan)], ['Tarikh', tarikhText],
          ['Masa', masaText], ['Tempat', h(tempat)],
        ])
        + emailPara('Sila log masuk ke portal untuk maklumat lanjut.');
      await sendEmail(env, pp.email, `Lantikan Pengadil Daerah: ${pasukan} — ${tarikhText}`,
        buildEmailTemplate('Makluman Lantikan Pengadil', '#1e293b', '📋', body), pp.nama_penuh, 'lantikan');
    }
  }
}

/** Admin portal + Telegram only; PHP never e-mails Admin about a response. */
export async function notifyAdminLantikanResponse(env: Env, action: 'accept' | 'reject',
  namaPengadil: string, jawatan: string, kejohanan: string, tarikh: string,
  pasukanHome: string, pasukanAway: string, komen = ''): Promise<void> {
  const admins = await env.DB.prepare(`SELECT id,nama_penuh,telegram_chat_id FROM users
    WHERE role='Admin' AND aktif=1`).all<{ id: number; telegram_chat_id: number | null }>();
  if (admins.results.length === 0) return;
  const tarikhText = tarikhFmt(tarikh);
  const pasukan = `${pasukanHome} lwn ${pasukanAway}`;
  const isAccept = action === 'accept';
  const type = isAccept ? 'Lantikan Diterima' : 'Lantikan Ditolak';
  const subject = `${isAccept ? '✅ ' : '❌ '}${namaPengadil} — ${pasukan}`;
  let message = `${namaPengadil} telah ${isAccept ? 'menerima' : 'menolak'} lantikan sebagai ${jawatan} untuk ${pasukan} (${kejohanan}) pada ${tarikhText}.`;
  if (!isAccept && komen) message += ` Sebab: ${komen}`;
  for (const admin of admins.results) {
    await createPortalNotification(env, admin.id, type, subject, message);
    if (admin.telegram_chat_id) {
      let tg = `<b>${isAccept ? '✅' : '❌'} Lantikan ${isAccept ? 'Diterima' : 'Ditolak'}</b>\n\n`
        + `<b>Pengadil:</b> ${h(namaPengadil)}\n`
        + `<b>Jawatan:</b> ${h(jawatan)}\n`
        + `<b>Perlawanan:</b> ${h(pasukan)}\n`
        + `<b>Kejohanan:</b> ${h(kejohanan)}\n`
        + `<b>Tarikh:</b> ${tarikhText}\n`;
      if (!isAccept && komen) tg += `<b>Sebab:</b> ${h(komen)}\n`;
      await tgSend(env, admin.telegram_chat_id, tg);
    }
  }
}

export async function notifyPPDaerahResponse(env: Env, action: 'accept' | 'reject',
  persatuanId: number, namaPengadil: string, jawatan: string, kejohanan: string, tarikh: string,
  pasukanHome: string, pasukanAway: string, komen = ''): Promise<void> {
  if (!persatuanId) return;
  const users = await env.DB.prepare(`SELECT id,nama_penuh,telegram_chat_id FROM users
    WHERE role='PP Daerah' AND persatuan_id=? AND aktif=1`).bind(persatuanId)
    .all<{ id: number; telegram_chat_id: number | null }>();
  if (users.results.length === 0) return;
  const tarikhText = tarikhFmt(tarikh);
  const pasukan = `${pasukanHome} lwn ${pasukanAway}`;
  const isAccept = action === 'accept';
  const type = isAccept ? 'Pengadil Terima Lantikan' : 'Pengadil Tolak Lantikan';
  const subject = `${isAccept ? '✅ ' : '❌ '}${namaPengadil} — ${pasukan}`;
  let message = `${namaPengadil} telah ${isAccept ? 'menerima' : 'menolak'} lantikan sebagai ${jawatan} untuk ${pasukan} (${kejohanan}) pada ${tarikhText}.`;
  if (!isAccept && komen) message += ` Sebab: ${komen}`;
  for (const pp of users.results) {
    await createPortalNotification(env, pp.id, type, subject, message);
    if (pp.telegram_chat_id) {
      let tg = `<b>${isAccept ? '✅' : '❌'} Pengadil ${isAccept ? 'Terima' : 'Tolak'} Lantikan</b>\n\n`
        + `<b>Pengadil:</b> ${h(namaPengadil)}\n`
        + `<b>Jawatan:</b> ${h(jawatan)}\n`
        + `<b>Perlawanan:</b> ${h(pasukan)}\n`
        + `<b>Kejohanan:</b> ${h(kejohanan)}\n`
        + `<b>Tarikh:</b> ${tarikhText}\n`;
      if (!isAccept && komen) tg += `<b>Sebab:</b> ${h(komen)}\n`;
      await tgSend(env, pp.telegram_chat_id, tg);
    }
  }
}

/**
 * generatePenilaianToken(): reuse or create the RA form token, send email and
 * Telegram, audit each channel and throw when neither channel worked.
 */
export async function generatePenilaianToken(env: Env, lantikanId: number,
  meta: AuditMeta): Promise<string | null> {
  const row = await env.DB.prepare(`
    SELECT lp.jawatan,lp.status,lp.penilaian_token,lp.pengadil_id,lp.pengadil_luar_id,
      jp.tarikh,jp.pasukan_home,jp.pasukan_away,jp.tempat,
      COALESCE(kj.nama,'') AS kejohanan,
      COALESCE(u.nama_penuh,pl.nama,'') AS nama_penilai,
      COALESCE(u.email,pl.emel,'') AS emel_penilai,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id,'') AS tg_chat_id
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON lp.jadual_id=jp.id
    LEFT JOIN kejohanan kj ON jp.kejohanan_id=kj.id
    LEFT JOIN users u ON lp.pengadil_id=u.id
    LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id=pl.id
    WHERE lp.id=? AND lp.jawatan='Penilai Pengadil' AND lp.status='Diterima'`).bind(lantikanId)
    .first<{ penilaian_token: string | null; tarikh: string; pasukan_home: string;
      pasukan_away: string; tempat: string | null; kejohanan: string; nama_penilai: string;
      emel_penilai: string; tg_chat_id: number | string }>();
  if (!row) return null;
  let token = String(row.penilaian_token ?? '').trim();
  if (token === '') {
    token = randomHex(32);
    await env.DB.prepare(`UPDATE lantikan_pengadil SET penilaian_token=?
      WHERE id=? AND status='Diterima'`).bind(token, lantikanId).run();
  }
  const borangUrl = `${baseUrl(env)}/penilaian-borang.html?token=${token}`;
  const snapshot = await getLantikanAuditSnapshot(env, lantikanId);
  if (!snapshot) throw new Error('Snapshot audit RA tidak dijumpai.');
  let emailDelivered = false;
  let telegramDelivered = false;
  let emailError: string | null = null;
  let telegramError: string | null = null;
  const audit = (channel: string, status: string, details: Record<string, unknown>) =>
    recordLantikanAudit(env, lantikanId, 'ra_form_notification', channel, status, details,
      borangUrl, 'system', null, snapshot, meta);
  if (row.emel_penilai) {
    try {
      const pasukan = h(`${row.pasukan_home} lwn ${row.pasukan_away}`);
      const body = emailGreeting(row.nama_penilai)
        + emailPara('Anda telah menerima tugasan sebagai <strong>Penilai Pengadil</strong> untuk perlawanan berikut:')
        + emailInfoTable([
          ['Kejohanan', h(row.kejohanan)], ['Perlawanan', pasukan],
          ['Tarikh', tarikhFmt(row.tarikh)], ['Tempat', h(row.tempat ?? '')],
        ])
        + emailPara('Sila gunakan pautan di bawah untuk mengisi <strong>Borang Penilaian Pengadil</strong> selepas perlawanan:')
        + emailButton(borangUrl, 'Isi Borang Penilaian')
        + emailPara('<span style="color:#9CA3AF;font-size:12px;">Pautan ini unik untuk anda. Jangan kongsikan dengan orang lain.</span>');
      const html = buildEmailTemplate('Borang Penilaian Pengadil', '#2563EB', '📋', body);
      emailDelivered = await sendEmail(env, row.emel_penilai,
        `Borang Penilaian Pengadil — ${row.pasukan_home} lwn ${row.pasukan_away}`, html, row.nama_penilai);
      if (!emailDelivered) emailError = 'Penghantar emel memulangkan status gagal.';
    } catch (error) {
      emailDelivered = false;
      emailError = error instanceof Error ? error.message : String(error);
    }
    const details: Record<string, unknown> = { recipient: row.emel_penilai, ra_form_url: borangUrl };
    if (emailError !== null) details.error = emailError;
    await audit('email', emailDelivered ? 'success' : 'failed', details);
  } else {
    await audit('email', 'skipped', { reason: 'email_missing', ra_form_url: borangUrl });
  }
  if (row.tg_chat_id) {
    try {
      const message = '📋 <b>Borang Penilaian Pengadil</b>\n\n'
        + 'Anda telah menerima tugasan sebagai <b>Penilai Pengadil</b>.\n\n'
        + `⚽ ${h(`${row.pasukan_home} lwn ${row.pasukan_away}`)}\n`
        + `📅 ${tarikhFmt(row.tarikh)}\n`
        + `📍 ${h(row.tempat ?? '')}\n\n`
        + 'Sila isi borang penilaian selepas perlawanan:';
      telegramDelivered = await tgSend(env, Number(row.tg_chat_id), message,
        { inline_keyboard: [[{ text: '📋 Isi Borang Penilaian', url: borangUrl }]] });
      if (!telegramDelivered) telegramError = 'Penghantar Telegram memulangkan status gagal.';
    } catch (error) {
      telegramDelivered = false;
      telegramError = error instanceof Error ? error.message : String(error);
    }
    const details: Record<string, unknown> = { telegram_linked: true, ra_form_url: borangUrl };
    if (telegramError !== null) details.error = telegramError;
    await audit('telegram', telegramDelivered ? 'success' : 'failed', details);
  } else {
    await audit('telegram', 'skipped', { reason: 'telegram_not_linked', ra_form_url: borangUrl });
  }
  await recordLantikanAudit(env, lantikanId, 'ra_form_dispatched', 'combined',
    emailDelivered || telegramDelivered ? 'success' : 'failed', {
      email_success: emailDelivered, telegram_success: telegramDelivered,
      email_error: emailError, telegram_error: telegramError, ra_form_url: borangUrl,
    }, borangUrl, 'system', null, snapshot, meta);
  if (!emailDelivered && !telegramDelivered) {
    throw new Error('Pautan borang Penilai Pengadil telah disediakan tetapi gagal dihantar melalui emel dan Telegram. Gunakan pautan terus Admin.');
  }
  return token;
}

export interface KupCrewResult {
  complete: boolean; recipients: number; crew_signature: string; telegram_sent: number;
  email_sent: number; telegram_already_sent: number; email_already_sent: number;
  pending_channels: number; unreachable_recipients: number;
}

function emptyKupCrewResult(): KupCrewResult {
  return { complete: false, recipients: 0, crew_signature: '', telegram_sent: 0, email_sent: 0,
    telegram_already_sent: 0, email_already_sent: 0, pending_channels: 0, unreachable_recipients: 0 };
}

interface CrewRecipient {
  lantikan_id: number; jawatan: string; nama: string; email: string;
  telegram_chat_id: number | string | null; no_perlawanan: string | null; tarikh: string;
  masa: string | null; tempat: string | null; pasukan_home: string | null;
  pasukan_away: string | null; kejohanan: string;
}

async function getCompleteKupCrewContext(env: Env, jadualId: number) {
  if (!(await isAcceptedKupCrewComplete(env, jadualId))) return null;
  const roster = await getMatchKupOfficials(env, jadualId);
  if (roster.officials.length < 3 || roster.officials.length > 4) return null;
  const recipients = (await env.DB.prepare(`
    SELECT lp.id AS lantikan_id,lp.jawatan,
      COALESCE(NULLIF(trim(u.nama_penuh),''),NULLIF(trim(pl.nama),''),'Pengadil') AS nama,
      COALESCE(NULLIF(trim(u.email),''),NULLIF(trim(pl.emel),''),'') AS email,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
      jp.no_perlawanan,jp.tarikh,jp.masa,jp.tempat,jp.pasukan_home,jp.pasukan_away,
      COALESCE(kj.nama,'') AS kejohanan
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN kejohanan kj ON kj.id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.jadual_id=? AND lp.status='Diterima' AND lp.jawatan IN (${KUP_SQL})
    ORDER BY ${KUP_ORDER}`).bind(jadualId).all<CrewRecipient>()).results;
  if (recipients.length !== roster.officials.length) return null;
  const fingerprint = await sha256Hex([String(jadualId),
    ...recipients.map((recipient) => `${recipient.jawatan}:${recipient.lantikan_id}`)].join('|'));
  return { fingerprint, roster, recipients };
}

type CrewRow = { id: number; lantikan_id: number; telegram_applicable: number;
  email_applicable: number; telegram_sent_at: string | null; email_sent_at: string | null };

async function queueKupCrewNotifications(env: Env, jadualId: number, fingerprint: string,
  recipients: CrewRecipient[]): Promise<{ signature: string; rows: Map<number, CrewRow> }> {
  const existing = await env.DB.prepare(`SELECT crew_signature FROM kup_crew_notifications
    WHERE jadual_id=? AND crew_fingerprint=? AND superseded_at IS NULL LIMIT 1`)
    .bind(jadualId, fingerprint).first<{ crew_signature: string }>();
  const signature = existing?.crew_signature || await sha256Hex(`${fingerprint}|${randomHex(16)}`);
  await env.DB.batch([
    env.DB.prepare(`UPDATE kup_crew_notifications SET superseded_at=COALESCE(superseded_at,${NOW})
      WHERE jadual_id=? AND crew_signature<>? AND superseded_at IS NULL`).bind(jadualId, signature),
    ...recipients.map((recipient) => env.DB.prepare(`INSERT INTO kup_crew_notifications
        (jadual_id,lantikan_id,crew_fingerprint,crew_signature,telegram_applicable,email_applicable,
         telegram_attempts,email_attempts,created_at,updated_at)
      VALUES (?,?,?,?,?,?,0,0,${NOW},${NOW})
      ON CONFLICT(jadual_id,crew_signature,lantikan_id) DO UPDATE SET
        crew_fingerprint=excluded.crew_fingerprint,
        telegram_applicable=excluded.telegram_applicable,
        email_applicable=excluded.email_applicable,superseded_at=NULL`).bind(
      jadualId, recipient.lantikan_id, fingerprint, signature,
      recipient.telegram_chat_id ? 1 : 0, String(recipient.email ?? '').trim() !== '' ? 1 : 0)),
    env.DB.prepare(`UPDATE kup_crew_notifications SET completed_at=CASE
        WHEN (telegram_applicable=0 OR telegram_sent_at IS NOT NULL)
         AND (email_applicable=0 OR email_sent_at IS NOT NULL)
        THEN COALESCE(completed_at,${NOW}) ELSE NULL END
      WHERE jadual_id=? AND crew_signature=? AND superseded_at IS NULL`).bind(jadualId, signature),
  ]);
  const rows = await env.DB.prepare(`SELECT * FROM kup_crew_notifications
    WHERE jadual_id=? AND crew_signature=? AND superseded_at IS NULL`).bind(jadualId, signature)
    .all<CrewRow>();
  return { signature, rows: new Map(rows.results.map((row) => [Number(row.lantikan_id), row])) };
}

async function claimChannel(env: Env, id: number, channel: 'telegram' | 'email'): Promise<number | null> {
  const result = await env.DB.prepare(`UPDATE kup_crew_notifications
    SET ${channel}_claimed_at=${NOW},${channel}_attempts=${channel}_attempts+1
    WHERE id=? AND ${channel}_applicable=1 AND ${channel}_sent_at IS NULL AND superseded_at IS NULL
      AND (${channel}_next_attempt_at IS NULL OR ${channel}_next_attempt_at<=${NOW})
      AND (${channel}_claimed_at IS NULL OR ${channel}_claimed_at<datetime('now','+8 hours','-5 minutes'))`)
    .bind(id).run();
  if (!wroteRow(result)) return null;
  const row = await env.DB.prepare(`SELECT ${channel}_attempts AS attempts FROM kup_crew_notifications
    WHERE id=?`).bind(id).first<{ attempts: number }>();
  return Number(row?.attempts ?? 0);
}

async function finishChannel(env: Env, id: number, channel: 'telegram' | 'email', success: boolean,
  attempt: number, errorMessage: string): Promise<void> {
  const retrySeconds = Math.min(3600, 60 * 2 ** Math.max(0, Math.min(attempt - 1, 6)));
  await env.DB.batch([
    success
      ? env.DB.prepare(`UPDATE kup_crew_notifications SET ${channel}_sent_at=COALESCE(${channel}_sent_at,${NOW}),
          ${channel}_claimed_at=NULL,${channel}_next_attempt_at=NULL,${channel}_last_error=NULL
          WHERE id=? AND superseded_at IS NULL`).bind(id)
      : env.DB.prepare(`UPDATE kup_crew_notifications SET ${channel}_claimed_at=NULL,
          ${channel}_next_attempt_at=datetime('now','+8 hours','+${retrySeconds} seconds'),
          ${channel}_last_error=?
          WHERE id=? AND ${channel}_sent_at IS NULL AND superseded_at IS NULL`)
        .bind(Array.from(errorMessage || 'Penghantaran gagal.').slice(0, 500).join(''), id),
    env.DB.prepare(`UPDATE kup_crew_notifications SET completed_at=CASE
        WHEN (telegram_applicable=0 OR telegram_sent_at IS NOT NULL)
         AND (email_applicable=0 OR email_sent_at IS NOT NULL)
        THEN COALESCE(completed_at,${NOW}) ELSE NULL END
      WHERE id=? AND superseded_at IS NULL`).bind(id),
  ]);
}

/** notifyCompleteKupCrew(): persisted per recipient/channel in kup_crew_notifications. */
export async function notifyCompleteKupCrew(env: Env, jadualId: number): Promise<KupCrewResult> {
  const result = emptyKupCrewResult();
  const context = await getCompleteKupCrewContext(env, jadualId);
  if (!context) return result;
  const queued = await queueKupCrewNotifications(env, jadualId, context.fingerprint, context.recipients);
  result.complete = true;
  result.recipients = context.recipients.length;
  result.crew_signature = queued.signature;
  const { officials, region_label: regionLabel } = context.roster;
  for (const recipient of context.recipients) {
    const delivery = queued.rows.get(Number(recipient.lantikan_id));
    if (!delivery) continue;
    if (delivery.telegram_applicable && !delivery.telegram_sent_at) {
      const attempt = await claimChannel(env, delivery.id, 'telegram');
      if (attempt !== null) {
        let success = false;
        let errorMessage = '';
        try {
          success = await tgSend(env, Number(recipient.telegram_chat_id), tgKupCrewCompleteMessage(
            recipient.nama, recipient.kejohanan, recipient.tarikh, recipient.masa ?? '',
            recipient.tempat ?? '', recipient.pasukan_home ?? '', recipient.pasukan_away ?? '',
            recipient.no_perlawanan ?? '', officials, regionLabel));
          if (!success) errorMessage = 'Telegram API tidak mengesahkan penghantaran.';
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
        }
        await finishChannel(env, delivery.id, 'telegram', success, attempt, errorMessage);
        if (success) result.telegram_sent++;
      }
    }
    if (delivery.email_applicable && !delivery.email_sent_at) {
      const attempt = await claimChannel(env, delivery.id, 'email');
      if (attempt !== null) {
        let success = false;
        let errorMessage = '';
        try {
          success = await sendKupCrewCompleteEmail(env, recipient.email, recipient.nama,
            recipient.jawatan, recipient.kejohanan, recipient.tarikh, recipient.masa ?? '',
            recipient.tempat ?? '', recipient.pasukan_home ?? '', recipient.pasukan_away ?? '',
            recipient.no_perlawanan ?? '', officials, regionLabel);
          if (!success) errorMessage = 'SMTP tidak mengesahkan penghantaran.';
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
        }
        await finishChannel(env, delivery.id, 'email', success, attempt, errorMessage);
        if (success) result.email_sent++;
      }
    }
  }
  const summary = await env.DB.prepare(`SELECT
      COALESCE(SUM((telegram_applicable=1 AND telegram_sent_at IS NULL)
        + (email_applicable=1 AND email_sent_at IS NULL)),0) AS pending_channels,
      COALESCE(SUM(telegram_applicable=0 AND email_applicable=0),0) AS unreachable_recipients,
      COALESCE(SUM(telegram_sent_at IS NOT NULL),0) AS telegram_already_sent,
      COALESCE(SUM(email_sent_at IS NOT NULL),0) AS email_already_sent
    FROM kup_crew_notifications WHERE jadual_id=? AND crew_signature=? AND superseded_at IS NULL`)
    .bind(jadualId, queued.signature).first<Record<string, number>>();
  result.pending_channels = Number(summary?.pending_channels ?? 0);
  result.unreachable_recipients = Number(summary?.unreachable_recipients ?? 0);
  result.telegram_already_sent = Number(summary?.telegram_already_sent ?? 0);
  result.email_already_sent = Number(summary?.email_already_sent ?? 0);
  return result;
}

/** retryPendingKupCrewNotifications(): never notifies a crew that was not queued. */
export async function retryPendingKupCrewNotifications(env: Env, jadualId: number): Promise<KupCrewResult> {
  const context = await getCompleteKupCrewContext(env, jadualId);
  if (!context) {
    await env.DB.prepare(`UPDATE kup_crew_notifications SET superseded_at=COALESCE(superseded_at,${NOW})
      WHERE jadual_id=? AND completed_at IS NULL AND superseded_at IS NULL`).bind(jadualId).run();
    return emptyKupCrewResult();
  }
  const pending = await env.DB.prepare(`SELECT COUNT(*) AS n FROM kup_crew_notifications
    WHERE jadual_id=? AND crew_fingerprint=? AND superseded_at IS NULL AND completed_at IS NULL`)
    .bind(jadualId, context.fingerprint).first<{ n: number }>();
  if (Number(pending?.n ?? 0) === 0) return emptyKupCrewResult();
  return notifyCompleteKupCrew(env, jadualId);
}

/** api/kup-crew-notification-retry.php, run by the Worker cron instead of system cron. */
export async function processQueuedKupCrewNotifications(env: Env, limit = 100) {
  const capped = Math.max(1, Math.min(limit, 500));
  const rows = await env.DB.prepare(`SELECT DISTINCT jadual_id FROM kup_crew_notifications
    WHERE completed_at IS NULL AND superseded_at IS NULL AND (
      (telegram_applicable=1 AND telegram_sent_at IS NULL
        AND (telegram_next_attempt_at IS NULL OR telegram_next_attempt_at<=${NOW})
        AND (telegram_claimed_at IS NULL OR telegram_claimed_at<datetime('now','+8 hours','-5 minutes')))
      OR (email_applicable=1 AND email_sent_at IS NULL
        AND (email_next_attempt_at IS NULL OR email_next_attempt_at<=${NOW})
        AND (email_claimed_at IS NULL OR email_claimed_at<datetime('now','+8 hours','-5 minutes'))))
    ORDER BY jadual_id LIMIT ${capped}`).all<{ jadual_id: number }>();
  const summary = { matches_processed: 0, telegram_sent: 0, email_sent: 0, pending_channels: 0, errors: 0 };
  for (const { jadual_id: jadualId } of rows.results) {
    try {
      const result = await retryPendingKupCrewNotifications(env, Number(jadualId));
      summary.matches_processed++;
      summary.telegram_sent += result.telegram_sent;
      summary.email_sent += result.email_sent;
      summary.pending_channels += result.pending_channels;
    } catch (error) {
      summary.errors++;
      console.error('[KUP crew retry] jadual', jadualId, error instanceof Error ? error.message : error);
    }
  }
  return summary;
}

/**
 * autoTolakLantikanTertunggak(): reject appointments whose whole answer window
 * ended before kickoff, then notify a crew that became complete.
 */
export async function autoTolakLantikanTertunggak(env: Env,
  scope: { id?: number; jadual_id?: number; pengadil_id?: number; kejohanan_id?: number } = {},
  meta: AuditMeta = { ip: null, userAgent: null }): Promise<number> {
  const where: string[] = [];
  const binds: number[] = [];
  if (scope.id !== undefined) { where.push('lp.id=?'); binds.push(scope.id); }
  if (scope.jadual_id !== undefined) { where.push('lp.jadual_id=?'); binds.push(scope.jadual_id); }
  if (scope.pengadil_id !== undefined) { where.push('lp.pengadil_id=?'); binds.push(scope.pengadil_id); }
  if (scope.kejohanan_id !== undefined) { where.push('jp.kejohanan_id=?'); binds.push(scope.kejohanan_id); }
  const pending = await env.DB.prepare(`
    SELECT lp.id,lp.jadual_id,lp.jawatan,lp.tarikh_notif,
      COALESCE(kj.jenis_kejohanan,'') AS jenis_kejohanan,jp.tarikh,jp.masa
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN kejohanan kj ON kj.id=jp.kejohanan_id
    WHERE lp.status='Belum Jawab' AND lp.notif_hantar=1 AND lp.tarikh_notif IS NOT NULL
      AND COALESCE(jp.status,'') NOT IN ('Dibatalkan','Ditangguhkan')
      ${where.map((clause) => `AND ${clause}`).join(' ')}`).bind(...binds)
    .all<{ id: number; jadual_id: number; jawatan: string; tarikh_notif: string;
      jenis_kejohanan: string; tarikh: string; masa: string | null }>();
  const now = Date.now();
  const expired = pending.results.flatMap((row) => {
    const notif = klTimestamp(String(row.tarikh_notif));
    const kickoff = getMatchKickoffTimestamp(String(row.tarikh ?? ''), String(row.masa ?? ''));
    const deadline = responseDeadline(String(row.jenis_kejohanan), kickoff, notif);
    // Historical fixtures are never retrospectively rejected by this policy.
    return deadline?.autoReject && kickoff !== null && kickoff > now && deadline.at <= now
      ? [{ ...row, deadline: deadline.at, upcoming: true }] : [];
  }).slice(0, 50);
  if (expired.length === 0) return 0;
  const batchKey = `worker-auto-reject-${crypto.randomUUID()}`;
  const prefix = `${batchKey}-`;
  const upper = `${batchKey}.`;
  const statements: D1PreparedStatement[] = [];
  for (const row of expired) {
    const deadline = localDateTime(row.deadline);
    statements.push(env.DB.prepare(`UPDATE lantikan_pengadil SET status='Ditolak',komen=?,
        tarikh_jawab=?,status_dikemaskini_at=?,tg_token=NULL,email_token=NULL
      WHERE id=? AND status='Belum Jawab' AND tarikh_notif=? AND notif_hantar=1
        AND EXISTS(SELECT 1 FROM jadual_perlawanan WHERE id=? AND tarikh=? AND COALESCE(masa,'')=?
          AND COALESCE(status,'') NOT IN ('Dibatalkan','Ditangguhkan'))`)
      .bind(LANTIKAN_AUTO_TOLAK_KOMEN, deadline, deadline, row.id, row.tarikh_notif,
        row.jadual_id, row.tarikh, row.masa ?? ''));
    const snapshot = await getLantikanAuditSnapshot(env, row.id);
    if (!snapshot) throw new Error('Snapshot audit auto-tolak tidak dijumpai.');
    // Written only when the UPDATE above changed the appointment; the audit
    // identity columns do not change on rejection.
    statements.push(env.DB.prepare(`INSERT INTO lantikan_audit_log (event_key,lantikan_id,jadual_id,
        kejohanan_id,pengadil_id,pengadil_luar_id,jawatan,nama_pegawai,emel_pegawai,no_telefon_pegawai,
        event_type,channel,event_status,link_url,details_json,actor_type,actor_user_id,ip_address,
        user_agent,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,${NOW} WHERE changes()=1`)
      .bind(...auditValues(snapshot, row.id, row.deadline, meta, `${batchKey}-${row.id}`)));
    // Queued with the rejection itself; delivered by cron or waitUntil, never inside this request.
    // Only upcoming matches enter this batch; historical fixtures stay untouched.
    if (row.upcoming) statements.push(...enqueueNoticeStatements(env, `auto_reject:${row.id}:${row.tarikh_notif}`,
      autoRejectRecipient(snapshot), autoRejectNotice(snapshot), {
        kind: 'auto_reject_notification', lantikanId: row.id,
        guardSql: 'EXISTS(SELECT 1 FROM lantikan_audit_log WHERE event_key=?)',
        guardBinds: [`${batchKey}-${row.id}`],
      }));
    const owner = await env.DB.prepare(`SELECT u.id,u.nama_penuh,u.email,u.telegram_chat_id,u.role
      FROM lantikan_pengadil lp JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      LEFT JOIN kejohanan kj ON kj.id=jp.kejohanan_id
      JOIN users u ON u.id=COALESCE(NULLIF(lp.created_by,0),kj.created_by) AND u.aktif=1
      WHERE lp.id=?`).bind(row.id).first<{ id: number; nama_penuh: string; email: string | null;
        telegram_chat_id: string | number | null; role: string }>();
    if (owner) statements.push(...enqueueNoticeStatements(env, `auto_reject_owner:${row.id}:${row.tarikh_notif}`,
      contactRecipient(owner), autoRejectOwnerNotice(env, snapshot, owner.role), {
        kind: 'auto_reject_owner', lantikanId: row.id,
        guardSql: 'EXISTS(SELECT 1 FROM lantikan_audit_log WHERE event_key=?)',
        guardBinds: [`${batchKey}-${row.id}`],
      }));
  }
  const matches = [...new Set(expired.map((row) => row.jadual_id))];
  for (const jadualId of matches) {
    statements.push(...historySyncStatements(env, jadualId, {
      sql: `EXISTS(SELECT 1 FROM lantikan_audit_log WHERE event_key>=? AND event_key<? AND jadual_id=?)`,
      binds: [prefix, upper, jadualId],
    }));
  }
  await env.DB.batch(statements);
  const changed = await env.DB.prepare(`SELECT lantikan_id,jadual_id,jawatan FROM lantikan_audit_log
    WHERE event_key>=? AND event_key<?`).bind(prefix, upper).all<{ jadual_id: number; jawatan: string }>();
  try {
    const upcoming = new Set(expired.filter((row) => row.upcoming).map((row) => row.id));
    const digestRows = await env.DB.prepare(`SELECT al.lantikan_id,al.nama_pegawai AS nama,al.jawatan,
        jp.pasukan_home||' lwn '||jp.pasukan_away AS pasukan,COALESCE(kj.nama,'') AS kejohanan,jp.tarikh,
        u.persatuan_id
      FROM lantikan_audit_log al
      JOIN lantikan_pengadil lp ON lp.id=al.lantikan_id
      JOIN jadual_perlawanan jp ON jp.id=al.jadual_id
      LEFT JOIN kejohanan kj ON kj.id=jp.kejohanan_id
      LEFT JOIN users u ON u.id=al.pengadil_id
      LEFT JOIN users owner ON owner.id=COALESCE(NULLIF(lp.created_by,0),kj.created_by) AND owner.aktif=1
      WHERE al.event_key>=? AND al.event_key<? AND owner.id IS NULL
      ORDER BY jp.tarikh,jp.masa,al.id`).bind(prefix, upper)
      .all<{ lantikan_id: number; nama: string; jawatan: string; pasukan: string; kejohanan: string;
        tarikh: string; persatuan_id: number | null }>();
    await queueAutoRejectDigests(env, batchKey, digestRows.results.filter((row) => upcoming.has(Number(row.lantikan_id))));
  } catch (error) {
    console.error('[autoTolakLantikanTertunggak] digest queue error', error instanceof Error ? error.message : error);
  }
  const kupMatches = [...new Set(changed.results.filter((row) => isKupPosition(row.jawatan))
    .map((row) => Number(row.jadual_id)))];
  for (const jadualId of kupMatches) {
    if (await isAcceptedKupCrewComplete(env, jadualId)) {
      try { await notifyCompleteKupCrew(env, jadualId); } catch (error) {
        console.error('[autoTolakLantikanTertunggak] KUP crew notification error',
          error instanceof Error ? error.message : error);
      }
    }
  }
  return changed.results.length;
}

function auditValues(snapshot: LantikanSnapshot, lantikanId: number, deadline: number,
  meta: AuditMeta, eventKey: string): unknown[] {
  return [eventKey, lantikanId, snapshot.jadual_id ?? null, snapshot.kejohanan_id ?? null,
    snapshot.pengadil_id ?? null, snapshot.pengadil_luar_id ?? null, snapshot.jawatan ?? null,
    snapshot.nama_pegawai ?? null, snapshot.emel_pegawai ?? null, snapshot.no_telefon_pegawai ?? null,
    'appointment_auto_rejected', 'system', 'success', null,
    JSON.stringify({ reason: LANTIKAN_AUTO_TOLAK_KOMEN, deadline_timestamp: Math.floor(deadline / 1000) }),
    'system', null, meta.ip, meta.userAgent];
}
