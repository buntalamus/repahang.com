/**
 * Port of config/laporan-pengesahan.php: the tournament chair workflow for RA
 * reports. Deliveries are attempted inside the request exactly like PHP; a
 * failed channel is recorded and retried only when Admin asks.
 */
import type { Env } from '../types';
import { buildEmailTemplate, emailButton, emailGreeting, emailInfoTable, emailPara,
  sendEmail, sendPenilaianEmail } from './email';
import { h, tarikhFmt } from './format';
import { guardStatement, runGuarded } from './guard';
import type { AuditMeta } from './lantikan-audit';
import { NOW } from './lantikan-audit';
import { randomHex } from './lantikan-helper';
import { tgSend } from './telegram';

export class PhpInvalidArgument extends Error {}
export class PhpDomainError extends Error {}

type Row = Record<string, unknown>;

function base(env: Env): string {
  return (env.BASE_URL || 'https://refpahang.com').replace(/\/+$/, '');
}

export function buildPengerusiApprovalUrl(env: Env, token: string): string {
  return `${base(env)}/api/laporan-pengesahan-token.php?token=${encodeURIComponent(token)}`;
}

export function buildPengerusiReportPreviewUrl(env: Env, reportId: number, token: string): string {
  return `${base(env)}/api/download-laporan-penilaian.php?id=${reportId}&approval_token=${encodeURIComponent(token)}`;
}

/** hash_hmac('sha256', 'laporan-penilaian:view:' . $id, $penilaianToken) */
export async function createReportViewToken(reportId: number, penilaianToken: string): Promise<string> {
  if (reportId <= 0 || penilaianToken.trim() === '') return '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(penilaianToken),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`laporan-penilaian:view:${reportId}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cut(value: string, length: number): string {
  return Array.from(value).slice(0, length).join('');
}

export function laporanAuditStatement(env: Env, stateId: number, reportId: number, eventType: string,
  channel: string, eventStatus: string, actorType = 'system', actorUserId: number | null = null,
  actorLuarId: number | null = null, linkUrl: string | null = null, details: Row = {},
  meta: AuditMeta = { ip: null, userAgent: null }): D1PreparedStatement {
  return env.DB.prepare(`INSERT INTO laporan_pengesahan_audit (laporan_pengesahan_id,laporan_id,
      event_type,channel,event_status,actor_type,actor_user_id,actor_luar_id,link_url,details_json,
      ip_address,user_agent,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,${NOW})`).bind(stateId, reportId, cut(eventType, 60), cut(channel, 30),
    cut(eventStatus, 30), cut(actorType, 30), actorUserId, actorLuarId, linkUrl,
    Object.keys(details).length === 0 ? null : JSON.stringify(details), meta.ip, meta.userAgent);
}

export async function recordLaporanPengesahanAudit(env: Env, stateId: number, reportId: number,
  eventType: string, channel: string, eventStatus: string, actorType = 'system',
  actorUserId: number | null = null, actorLuarId: number | null = null, linkUrl: string | null = null,
  details: Row = {}, meta: AuditMeta = { ip: null, userAgent: null }): Promise<void> {
  await laporanAuditStatement(env, stateId, reportId, eventType, channel, eventStatus, actorType,
    actorUserId, actorLuarId, linkUrl, details, meta).run();
}

export const CURRENT_CHAIR_SQL = `
  SELECT kp.*,COALESCE(u.email,pl.emel,'') AS email,
    COALESCE(u.no_telefon,pl.no_tel,'') AS no_telefon,
    COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
    COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),'') AS negeri,
    CASE WHEN kp.pengesah_user_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber
  FROM kejohanan_pengesah_laporan kp
  LEFT JOIN users u ON u.id=kp.pengesah_user_id
  LEFT JOIN pengadil_luar pl ON pl.id=kp.pengesah_luar_id
  WHERE kp.kejohanan_id=? AND kp.aktif=1 LIMIT 1`;

export async function getKejohananPengesahLaporan(env: Env, kejohananId: number): Promise<Row | null> {
  return env.DB.prepare(CURRENT_CHAIR_SQL).bind(kejohananId).first<Row>();
}

export async function getLaporanApprovalSnapshot(env: Env, reportId: number): Promise<Row> {
  const row = await env.DB.prepare(`
    SELECT laporan.id AS laporan_id,laporan.status AS laporan_status,
      laporan.jadual_id,laporan.lantikan_id,laporan.tarikh_hantar,
      laporan.tahap_kesukaran,laporan.cuaca,laporan.ulasan_keseluruhan,
      jp.no_perlawanan,jp.tarikh,jp.masa,jp.tempat,jp.pasukan_home,jp.pasukan_away,jp.kejohanan_id,
      k.nama AS nama_kejohanan,k.peringkat_kejohanan,
      COALESCE(u_ra.nama_penuh,pl_ra.nama,'Penilai Pengadil') AS nama_penilai
    FROM laporan_penilaian laporan
    JOIN jadual_perlawanan jp ON jp.id=laporan.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    JOIN lantikan_pengadil ra ON ra.id=laporan.lantikan_id
    LEFT JOIN users u_ra ON u_ra.id=ra.pengadil_id
    LEFT JOIN pengadil_luar pl_ra ON pl_ra.id=ra.pengadil_luar_id
    WHERE laporan.id=? AND ra.jawatan='Penilai Pengadil' AND ra.status='Diterima'
    LIMIT 1`).bind(reportId).first<Row>();
  if (!row) throw new Error('Laporan RA tidak dijumpai.');
  return row;
}

const str = (value: unknown) => String(value ?? '');

/** ensureLaporanPengesahanState(): create/refresh the chair approval row. */
export async function ensureLaporanPengesahanState(env: Env, reportId: number,
  meta: AuditMeta = { ip: null, userAgent: null }): Promise<Row> {
  const report = await getLaporanApprovalSnapshot(env, reportId);
  const mapping = await getKejohananPengesahLaporan(env, Number(report.kejohanan_id));
  const select = () => env.DB.prepare('SELECT * FROM laporan_pengesahan_pengerusi WHERE laporan_id=? LIMIT 1')
    .bind(reportId).first<Row>();
  const state = await select();
  const mappingId = mapping ? Number(mapping.id) : null;
  const mappingChanged = !!state && state.status === 'Menunggu'
    && Number(state.kejohanan_pengesah_id ?? 0) !== Number(mappingId ?? 0);
  const contactChanged = !!state && !!mapping && state.status === 'Menunggu' && !mappingChanged && (
    str(state.email_recipient).trim() !== str(mapping.email).trim()
    || str(state.telegram_chat_id) !== str(mapping.telegram_chat_id));

  if (!state) {
    const token = mapping ? randomHex(32) : null;
    const inserted = await env.DB.prepare(`INSERT INTO laporan_pengesahan_pengerusi (laporan_id,
        kejohanan_pengesah_id,pengesah_user_id,pengesah_luar_id,pengesah_nama,pengesah_jawatan,
        pengesah_negeri,approval_token,email_recipient,telegram_chat_id,status,email_attempts,
        telegram_attempts,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,'Menunggu',0,0,${NOW},${NOW})
      ON CONFLICT(laporan_id) DO NOTHING`).bind(reportId, mappingId,
      mapping?.pengesah_user_id ?? null, mapping?.pengesah_luar_id ?? null, mapping?.nama_snapshot ?? null,
      mapping?.jawatan_snapshot ?? null, mapping?.negeri ?? null, token, mapping?.email ?? null,
      mapping?.telegram_chat_id ?? null).run();
    if (inserted.meta.changes === 1) {
      const created = await select();
      await recordLaporanPengesahanAudit(env, Number(created?.id), reportId, 'approval_prepared', 'system',
        mapping ? 'success' : 'failed', 'system', null, null, token ? buildPengerusiApprovalUrl(env, token) : null,
        { reason: mapping ? null : 'pengerusi_not_configured' }, meta);
    }
  } else if (mappingChanged) {
    const token = mapping ? randomHex(32) : null;
    const updated = await env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET kejohanan_pengesah_id=?,
        pengesah_user_id=?,pengesah_luar_id=?,pengesah_nama=?,pengesah_jawatan=?,pengesah_negeri=?,
        approval_token=?,email_recipient=?,email_sent_at=NULL,email_claimed_at=NULL,email_last_error=NULL,
        telegram_chat_id=?,telegram_sent_at=NULL,telegram_claimed_at=NULL,telegram_last_error=NULL
      WHERE id=? AND status='Menunggu' AND kejohanan_pengesah_id IS ?`).bind(mappingId,
      mapping?.pengesah_user_id ?? null, mapping?.pengesah_luar_id ?? null, mapping?.nama_snapshot ?? null,
      mapping?.jawatan_snapshot ?? null, mapping?.negeri ?? null, token, mapping?.email ?? null,
      mapping?.telegram_chat_id ?? null, state.id, state.kejohanan_pengesah_id ?? null).run();
    if (updated.meta.changes === 1) {
      await recordLaporanPengesahanAudit(env, Number(state.id), reportId, 'approver_changed', 'system',
        mapping ? 'success' : 'failed', 'system', null, null, token ? buildPengerusiApprovalUrl(env, token) : null,
        { reason: mapping ? null : 'pengerusi_not_configured' }, meta);
    }
  } else if (contactChanged && mapping) {
    await env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET email_recipient=?,
        email_last_error=CASE WHEN email_sent_at IS NULL THEN NULL ELSE email_last_error END,
        telegram_chat_id=?,
        telegram_last_error=CASE WHEN telegram_sent_at IS NULL THEN NULL ELSE telegram_last_error END
      WHERE id=? AND status='Menunggu'`).bind(mapping.email ?? null, mapping.telegram_chat_id ?? null, state.id).run();
    await recordLaporanPengesahanAudit(env, Number(state.id), reportId, 'approver_contact_refreshed', 'system',
      'success', 'system', null, null,
      state.approval_token ? buildPengerusiApprovalUrl(env, str(state.approval_token)) : null, {
        email_available: str(mapping.email).trim() !== '',
        telegram_linked: !!mapping.telegram_chat_id,
      }, meta);
  }
  const latest = await select();
  if (!latest) throw new Error('Status pengesahan Pengerusi gagal disediakan.');
  return latest;
}

/** notifyAdminReportCopy(): one portal copy per active Admin, once per report. */
export async function notifyAdminReportCopy(env: Env, report: Row, state: Row,
  meta: AuditMeta = { ip: null, userAgent: null }): Promise<void> {
  const pengerusi = str(state.pengesah_nama).trim() || 'belum ditetapkan';
  const message = `${str(report.nama_penilai)} telah menghantar laporan RA bagi ${str(report.pasukan_home)} lwn ${str(report.pasukan_away)} (${str(report.nama_kejohanan)}). Pengerusi Pengadil: ${pengerusi}. Admin boleh menyemak salinan dan hanya menggunakan override jika perlu.`;
  await runGuarded(env, [
    guardStatement(env, 'admin_report_copy',
      'EXISTS(SELECT 1 FROM laporan_pengesahan_pengerusi WHERE id=? AND admin_copy_at IS NULL)', [state.id]),
    env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET admin_copy_at=${NOW}
      WHERE id=? AND admin_copy_at IS NULL`).bind(state.id),
    env.DB.prepare(`INSERT INTO notifications (user_id,type,subject,message,email_sent,is_read,created_at)
      SELECT id,'Laporan RA','Salinan Laporan RA — Menunggu Pengesahan Pengerusi',?,0,0,${NOW}
      FROM users WHERE role='Admin' AND aktif=1`).bind(message),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_audit (laporan_pengesahan_id,laporan_id,event_type,
        channel,event_status,actor_type,actor_user_id,actor_luar_id,link_url,details_json,ip_address,
        user_agent,created_at)
      SELECT ?,?,'admin_copy_created','portal','success','system',NULL,NULL,NULL,
        json_object('admin_count',(SELECT count(*) FROM users WHERE role='Admin' AND aktif=1)),?,?,${NOW}`)
      .bind(state.id, report.laporan_id, meta.ip, meta.userAgent),
  ]);
}

export interface ChairDispatch {
  configured: boolean; email_sent: boolean; telegram_sent: boolean; state: Row;
}

/** dispatchLaporanForPengerusi(): prepare the approval and try every unsent channel now. */
export async function dispatchLaporanForPengerusi(env: Env, reportId: number,
  meta: AuditMeta = { ip: null, userAgent: null }): Promise<ChairDispatch> {
  const state = await ensureLaporanPengesahanState(env, reportId, meta);
  const report = await getLaporanApprovalSnapshot(env, reportId);
  await notifyAdminReportCopy(env, report, state, meta);
  const token = str(state.approval_token).trim();
  if (token === '' || !state.kejohanan_pengesah_id) {
    return { configured: false, email_sent: false, telegram_sent: false, state };
  }
  const stateId = Number(state.id);
  const approvalUrl = buildPengerusiApprovalUrl(env, token);
  const previewUrl = buildPengerusiReportPreviewUrl(env, reportId, token);
  const audit = (channel: string, status: string, details: Row) => recordLaporanPengesahanAudit(env, stateId,
    reportId, 'chair_notification', channel, status, 'system', null, null, approvalUrl, details, meta);
  let emailDelivered = !!state.email_sent_at;
  let telegramDelivered = !!state.telegram_sent_at;

  if (!emailDelivered && str(state.email_recipient).trim() === '' && Number(state.email_attempts ?? 0) === 0) {
    const skipped = await env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET email_attempts=email_attempts+1,
        email_last_error='email_not_available' WHERE id=? AND email_sent_at IS NULL AND email_attempts=0`)
      .bind(stateId).run();
    if (skipped.meta.changes === 1) await audit('email', 'skipped', { reason: 'email_not_available' });
  }
  if (!telegramDelivered && !state.telegram_chat_id && Number(state.telegram_attempts ?? 0) === 0) {
    const skipped = await env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET telegram_attempts=telegram_attempts+1,
        telegram_last_error='telegram_not_linked' WHERE id=? AND telegram_sent_at IS NULL AND telegram_attempts=0`)
      .bind(stateId).run();
    if (skipped.meta.changes === 1) await audit('telegram', 'skipped', { reason: 'telegram_not_linked' });
  }
  if (!emailDelivered && str(state.email_recipient).trim() !== '') {
    const claim = await env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET email_claimed_at=${NOW},
        email_attempts=email_attempts+1
      WHERE id=? AND email_sent_at IS NULL
        AND (email_claimed_at IS NULL OR email_claimed_at<datetime('now','+8 hours','-10 minutes'))`)
      .bind(stateId).run();
    if (claim.meta.changes === 1) {
      const body = emailGreeting(str(state.pengesah_nama))
        + emailPara(`Satu laporan Penilai Pengadil telah dihantar dan memerlukan pengesahan anda sebagai <strong>${h(state.pengesah_jawatan)}</strong>.`)
        + emailInfoTable([
          ['Kejohanan', h(report.nama_kejohanan)],
          ['Perlawanan', h(`${str(report.pasukan_home)} lwn ${str(report.pasukan_away)}`)],
          ['Tarikh', tarikhFmt(str(report.tarikh))],
          ['Penilai', h(report.nama_penilai)],
        ])
        + emailPara('Sila semak laporan penuh, tulis komen jika perlu, kemudian buat pengesahan.')
        + emailButton(approvalUrl, 'Semak & Sahkan Laporan')
        + emailPara(`<a href="${h(previewUrl)}">Lihat laporan penuh dalam mod baca sahaja</a>`);
      const html = buildEmailTemplate('Pengesahan Laporan RA', '#7C3AED', '📋', body);
      emailDelivered = await sendEmail(env, str(state.email_recipient),
        `Pengesahan Laporan RA — ${str(report.pasukan_home)} lwn ${str(report.pasukan_away)}`, html,
        str(state.pengesah_nama), 'lantikan');
      await env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET
          email_sent_at=CASE WHEN ?=1 THEN ${NOW} ELSE email_sent_at END,
          email_last_error=CASE WHEN ?=1 THEN NULL ELSE 'send_failed' END,email_claimed_at=NULL
        WHERE id=?`).bind(emailDelivered ? 1 : 0, emailDelivered ? 1 : 0, stateId).run();
      await audit('email', emailDelivered ? 'success' : 'failed', { recipient: state.email_recipient });
    }
  }
  if (!telegramDelivered && state.telegram_chat_id) {
    const claim = await env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET telegram_claimed_at=${NOW},
        telegram_attempts=telegram_attempts+1
      WHERE id=? AND telegram_sent_at IS NULL
        AND (telegram_claimed_at IS NULL OR telegram_claimed_at<datetime('now','+8 hours','-10 minutes'))`)
      .bind(stateId).run();
    if (claim.meta.changes === 1) {
      const message = '📋 <b>Pengesahan Laporan RA</b>\n\n'
        + `🏆 ${h(report.nama_kejohanan)}\n`
        + `⚽ ${h(`${str(report.pasukan_home)} lwn ${str(report.pasukan_away)}`)}\n`
        + `👤 Penilai: ${h(report.nama_penilai)}\n\n`
        + 'Sila semak, tulis komen dan sahkan laporan ini.';
      telegramDelivered = await tgSend(env, Number(state.telegram_chat_id), message,
        { inline_keyboard: [[{ text: '📋 Semak & Sahkan', url: approvalUrl }]] });
      await env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET
          telegram_sent_at=CASE WHEN ?=1 THEN ${NOW} ELSE telegram_sent_at END,
          telegram_last_error=CASE WHEN ?=1 THEN NULL ELSE 'send_failed' END,telegram_claimed_at=NULL
        WHERE id=?`).bind(telegramDelivered ? 1 : 0, telegramDelivered ? 1 : 0, stateId).run();
      await audit('telegram', telegramDelivered ? 'success' : 'failed', { telegram_chat_id: state.telegram_chat_id });
    }
  }
  const latest = await env.DB.prepare('SELECT * FROM laporan_pengesahan_pengerusi WHERE id=?')
    .bind(stateId).first<Row>() ?? state;
  return { configured: true, email_sent: !!latest.email_sent_at, telegram_sent: !!latest.telegram_sent_at,
    state: latest };
}

const LIST_COLUMNS = ['kawalan_kekuatan', 'kawalan_kelemahan', 'fizikal_kekuatan', 'fizikal_kelemahan',
  'kerjasama_kekuatan', 'kerjasama_kelemahan'];

function decodedList(raw: unknown): string[] {
  try {
    const value: unknown = JSON.parse(str(raw));
    return Array.isArray(value) ? value.map(String)
      : value && typeof value === 'object' ? Object.values(value as Row).map(String) : [];
  } catch { return []; }
}

/** notifyConfirmedReportOfficials(): email + Telegram to every assessed official. */
export async function notifyConfirmedReportOfficials(env: Env, reportId: number, finalComment: string,
  commentLabel: string, approvalStateId: number, meta: AuditMeta = { ip: null, userAgent: null }): Promise<void> {
  const report = await env.DB.prepare(`
    SELECT laporan.*,jp.tarikh,jp.pasukan_home,jp.pasukan_away,k.nama AS nama_kejohanan,
      COALESCE(u_ra.nama_penuh,pl_ra.nama,'Penilai Pengadil') AS nama_penilai,ra.penilaian_token
    FROM laporan_penilaian laporan
    JOIN jadual_perlawanan jp ON jp.id=laporan.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    JOIN lantikan_pengadil ra ON ra.id=laporan.lantikan_id
    LEFT JOIN users u_ra ON u_ra.id=ra.pengadil_id
    LEFT JOIN pengadil_luar pl_ra ON pl_ra.id=ra.pengadil_luar_id
    WHERE laporan.id=? AND laporan.status='Disahkan'`).bind(reportId).first<Row>();
  if (!report) throw new Error('Laporan disahkan tidak dijumpai untuk notifikasi KUP.');
  if (str(report.penilaian_token).trim() === '') {
    report.penilaian_token = randomHex(32);
    await env.DB.prepare(`UPDATE lantikan_pengadil SET penilaian_token=?
      WHERE id=? AND status='Diterima' AND jawatan='Penilai Pengadil'`)
      .bind(report.penilaian_token, report.lantikan_id).run();
  }
  const viewToken = await createReportViewToken(reportId, str(report.penilaian_token));
  const reportUrl = `${base(env)}/api/download-laporan-penilaian.php?id=${reportId}&view_token=${encodeURIComponent(viewToken)}`;
  const pasukan = `${str(report.pasukan_home)} vs ${str(report.pasukan_away)}`;
  const audit = (channel: string, status: string, details: Row) => recordLaporanPengesahanAudit(env,
    approvalStateId, reportId, 'kup_report_notification', channel, status, 'system', null, null,
    reportUrl, details, meta);
  const officials = (await env.DB.prepare(`SELECT lpp.* FROM laporan_penilaian_pegawai lpp
    WHERE lpp.laporan_id=? ORDER BY CASE lpp.jawatan WHEN 'Pengadil' THEN 1
      WHEN 'Penolong Pengadil 1' THEN 2 WHEN 'Penolong Pengadil 2' THEN 3
      WHEN 'Pegawai ke4' THEN 4 ELSE 0 END`).bind(reportId).all<Row>()).results;
  for (const official of officials) {
    for (const column of LIST_COLUMNS) official[column] = decodedList(official[column]);
    const lantikanId = Number(official.lantikan_pengadil_id);
    const recipient = await env.DB.prepare(`SELECT COALESCE(u.email,pl.emel,'') AS email,
        COALESCE(u.nama_penuh,pl.nama,'') AS nama,
        COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id
      FROM lantikan_pengadil lp LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id WHERE lp.id=?`).bind(lantikanId).first<Row>();
    if (!recipient) {
      await audit('system', 'skipped', { lantikan_id: lantikanId, reason: 'appointment_not_found' });
      continue;
    }
    const strengths = [...official.kawalan_kekuatan as string[], ...official.fizikal_kekuatan as string[],
      ...official.kerjasama_kekuatan as string[]];
    const weaknesses = [...official.kawalan_kelemahan as string[], ...official.fizikal_kelemahan as string[],
      ...official.kerjasama_kelemahan as string[]];
    const advice = [official.kawalan_nasihat, official.fizikal_nasihat, official.kerjasama_nasihat]
      .map((value) => str(value)).filter((value) => value !== '' && value !== '0').join('\n');
    const markah = official.markah === null || official.markah === undefined ? null : Number(official.markah);
    if (str(recipient.email).trim() !== '') {
      const ok = await sendPenilaianEmail(env, str(recipient.email), str(recipient.nama) || '-',
        str(official.jawatan), str(report.nama_kejohanan), str(report.tarikh), pasukan, str(report.nama_penilai),
        markah, official.prestasi === null || official.prestasi === undefined ? null : str(official.prestasi),
        strengths, weaknesses, advice, str(report.ulasan_keseluruhan), finalComment, reportUrl, commentLabel);
      await audit('email', ok ? 'success' : 'failed', { lantikan_id: lantikanId, recipient: recipient.email });
    } else {
      await audit('email', 'skipped', { lantikan_id: lantikanId, reason: 'email_not_available' });
    }
    if (recipient.telegram_chat_id) {
      const mark = markah !== null ? (Math.round(markah * 10) / 10).toFixed(1) : '-';
      const message = '📋 <b>Laporan Penilaian Disahkan</b>\n\n'
        + `⚽ <b>${h(pasukan)}</b>\n`
        + `🏆 ${h(report.nama_kejohanan)}\n`
        + `👤 Jawatan: <b>${h(official.jawatan)}</b>\n`
        + `📊 Markah: <b>${mark}</b>/10\n`
        + `🔍 Penilai: ${h(report.nama_penilai)}`
        + `\n\n📋 <a href="${h(reportUrl)}">Lihat Laporan Penuh</a>`;
      const ok = await tgSend(env, Number(recipient.telegram_chat_id), message);
      await audit('telegram', ok ? 'success' : 'failed', { lantikan_id: lantikanId });
    } else {
      await audit('telegram', 'skipped', { lantikan_id: lantikanId, reason: 'telegram_not_linked' });
    }
  }
}

/** confirmLaporanByPengerusi() */
export async function confirmLaporanByPengerusi(env: Env, token: string, comment: string,
  meta: AuditMeta = { ip: null, userAgent: null }): Promise<Row> {
  const state = await env.DB.prepare(`SELECT approval.*,laporan.jadual_id,laporan.status AS laporan_status
    FROM laporan_pengesahan_pengerusi approval JOIN laporan_penilaian laporan ON laporan.id=approval.laporan_id
    WHERE approval.approval_token=? LIMIT 1`).bind(token).first<Row>();
  if (!state) throw new PhpInvalidArgument('Pautan pengesahan tidak sah.');
  if (state.status !== 'Menunggu' || state.laporan_status !== 'Dihantar') {
    throw new PhpDomainError('Laporan ini telah disahkan atau di-override sebelum ini.');
  }
  const done = await runGuarded(env, [
    guardStatement(env, 'chair_confirm', `EXISTS(SELECT 1 FROM laporan_pengesahan_pengerusi a
      JOIN laporan_penilaian r ON r.id=a.laporan_id WHERE a.id=? AND a.status='Menunggu' AND r.status='Dihantar')`,
    [state.id]),
    env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET status='Disahkan',catatan_pengerusi=?,
      tarikh_sahkan=${NOW} WHERE id=? AND status='Menunggu'`).bind(comment, state.id),
    env.DB.prepare(`UPDATE laporan_penilaian SET status='Disahkan',catatan_admin=?,tarikh_sahkan=${NOW}
      WHERE id=? AND status='Dihantar'`).bind(comment, state.laporan_id),
    env.DB.prepare("UPDATE jadual_perlawanan SET status='Selesai' WHERE id=?").bind(state.jadual_id),
    laporanAuditStatement(env, Number(state.id), Number(state.laporan_id), 'report_confirmed', 'token', 'success',
      state.pengesah_luar_id ? 'pengerusi_luar' : 'pengerusi_berdaftar',
      state.pengesah_user_id ? Number(state.pengesah_user_id) : null,
      state.pengesah_luar_id ? Number(state.pengesah_luar_id) : null,
      buildPengerusiApprovalUrl(env, token), { comment }, meta),
  ]);
  if (!done) throw new PhpDomainError('Laporan ini telah disahkan atau di-override sebelum ini.');
  try {
    await notifyConfirmedReportOfficials(env, Number(state.laporan_id), comment, 'Catatan Pengerusi Pengadil',
      Number(state.id), meta);
  } catch (error) {
    console.error('[confirmLaporanByPengerusi] notification error', error instanceof Error ? error.message : error);
  }
  return state;
}

/** overrideLaporanByAdmin() */
export async function overrideLaporanByAdmin(env: Env, reportId: number, adminUserId: number, reason: string,
  comment: string, meta: AuditMeta = { ip: null, userAgent: null }): Promise<Row> {
  if (reason.trim() === '') throw new PhpInvalidArgument('Sebab override Admin diperlukan.');
  const state = await ensureLaporanPengesahanState(env, reportId, meta);
  const locked = await env.DB.prepare(`SELECT approval.*,laporan.jadual_id,laporan.status AS laporan_status
    FROM laporan_pengesahan_pengerusi approval JOIN laporan_penilaian laporan ON laporan.id=approval.laporan_id
    WHERE approval.id=? LIMIT 1`).bind(state.id).first<Row>();
  if (!locked || locked.status !== 'Menunggu' || locked.laporan_status !== 'Dihantar') {
    throw new PhpDomainError('Laporan ini telah disahkan atau di-override sebelum ini.');
  }
  const done = await runGuarded(env, [
    guardStatement(env, 'report_override', `EXISTS(SELECT 1 FROM laporan_pengesahan_pengerusi a
      JOIN laporan_penilaian r ON r.id=a.laporan_id WHERE a.id=? AND a.status='Menunggu' AND r.status='Dihantar')`,
    [locked.id]),
    env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET status='Override Admin',admin_override_user_id=?,
      alasan_override=?,catatan_pengerusi=?,tarikh_sahkan=${NOW} WHERE id=? AND status='Menunggu'`)
      .bind(adminUserId, reason, comment, locked.id),
    env.DB.prepare(`UPDATE laporan_penilaian SET status='Disahkan',catatan_admin=?,tarikh_sahkan=${NOW}
      WHERE id=? AND status='Dihantar'`).bind(comment, reportId),
    env.DB.prepare("UPDATE jadual_perlawanan SET status='Selesai' WHERE id=?").bind(locked.jadual_id),
    laporanAuditStatement(env, Number(locked.id), reportId, 'report_admin_override', 'admin', 'success', 'admin',
      adminUserId, null, null, { reason, comment, configured_chair: locked.pengesah_nama ?? null }, meta),
  ]);
  if (!done) throw new PhpDomainError('Laporan ini telah disahkan atau di-override sebelum ini.');
  try {
    await notifyConfirmedReportOfficials(env, reportId, comment, 'Catatan Override Admin', Number(locked.id), meta);
  } catch (error) {
    console.error('[overrideLaporanByAdmin] notification error', error instanceof Error ? error.message : error);
  }
  return locked;
}
