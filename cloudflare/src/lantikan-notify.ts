/**
 * Appointment (lantikan) notices that had no outbound message: match details
 * changed after dispatch, answer reminders, auto-rejection, PP Daerah copies of
 * cancellations and Admin acceptance overrides.
 */
import type { Env } from './types';
import { appointmentDeadline, baseUrl } from './php/email';
import { getMatchKickoffTimestamp, klTimestamp, masaFmt, noMatchFmt, phpDate, tarikhFmt } from './php/format';
import { buildAppointmentDirectLinks, recordLantikanAudit } from './php/lantikan-audit';
import type { LantikanSnapshot } from './php/lantikan-audit';
import { tgLantikanKeyboard } from './php/telegram';
import { activeAdmins, contactRecipient, districtPPs, enqueueNoticeStatements, notifyUser,
  processNotificationOutbox } from './notify';
import type { Notice, Recipient } from './notify';
import { responseDeadline } from '../../shared/appointment-deadline';

export interface MatchDetails {
  tarikh: string;
  masa: string | null;
  tempat: string | null;
  pasukan_home: string;
  pasukan_away: string;
}

const DETAIL_FIELDS = ['tarikh', 'masa', 'tempat', 'pasukan_home', 'pasukan_away'] as const;

function norm(value: unknown): string {
  return String(value ?? '').trim();
}

function masaKey(value: unknown): string {
  return norm(value).slice(0, 5);
}

export function matchDetailsChanged(before: MatchDetails, after: MatchDetails): boolean {
  return DETAIL_FIELDS.some((field) => field === 'masa'
    ? masaKey(before.masa) !== masaKey(after.masa) : norm(before[field]) !== norm(after[field]));
}

function changeText(before: string, after: string): string {
  return before === after ? after : `${after} (sebelum ini: ${before || '-'})`;
}

interface NotifiedOfficial {
  lantikan_id: number;
  jawatan: string;
  status: string;
  email_token: string | null;
  tg_token: string | null;
  tarikh_notif: string | null;
  pengadil_id: number | null;
  pengadil_luar_id: number | null;
  nama: string;
  email: string | null;
  telegram_chat_id: string | number | null;
  jadual_status: string;
  no_perlawanan: string | null;
  kejohanan: string;
  jenis_kejohanan: string;
}

function officialRecipient(row: { pengadil_id: number | null; pengadil_luar_id: number | null; nama: string;
  email: string | null; telegram_chat_id: string | number | null }): Recipient {
  return { userId: row.pengadil_id, luarId: row.pengadil_luar_id, name: row.nama, email: row.email,
    telegramChatId: row.telegram_chat_id };
}

function answerActions(env: Env, emailToken: string | null): Array<{ label: string; url: string }> {
  if (!emailToken) return [{ label: 'Log Masuk ke Portal', url: `${baseUrl(env)}/login` }];
  const links = buildAppointmentDirectLinks(env, emailToken);
  return [{ label: 'Terima Tugasan', url: links.accept_url }, { label: 'Tolak Tugasan', url: links.reject_url }];
}

/**
 * Tells every official already told about this match (and still Belum Jawab or
 * Diterima) that its date, time, venue or teams changed. Returns how many
 * officials were reached on at least one channel.
 */
export async function notifyScheduleChange(env: Env, jadualId: number, before: MatchDetails,
  after: MatchDetails, actorType: string, actorUserId: number | null, nowMs = Date.now()): Promise<number> {
  if (!matchDetailsChanged(before, after)) return 0;
  const kickoff = getMatchKickoffTimestamp(after.tarikh, after.masa ?? '');
  if (kickoff !== null && kickoff <= nowMs) return 0;
  const officials = (await env.DB.prepare(`
    SELECT lp.id AS lantikan_id,lp.jawatan,lp.status,lp.email_token,lp.tg_token,lp.tarikh_notif,
      lp.pengadil_id,lp.pengadil_luar_id,
      COALESCE(u.nama_penuh,pl.nama,'') AS nama, COALESCE(u.email,pl.emel) AS email,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
      jp.status AS jadual_status,jp.no_perlawanan,COALESCE(kj.nama,'') AS kejohanan,
      COALESCE(kj.jenis_kejohanan,'Persahabatan') AS jenis_kejohanan
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN kejohanan kj ON kj.id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.jadual_id=? AND lp.status IN ('Belum Jawab','Diterima')
      AND (lp.notif_hantar=1 OR lp.tg_notif_hantar=1)
    ORDER BY lp.id`).bind(jadualId).all<NotifiedOfficial>()).results;
  let reached = 0;
  for (const official of officials) {
    if (['Dibatalkan', 'Ditangguhkan'].includes(official.jadual_status)) continue;
    const pending = official.status === 'Belum Jawab';
    const matchLabel = `${after.pasukan_home} lwn ${after.pasukan_away}`;
    const notifMs = official.tarikh_notif ? klTimestamp(official.tarikh_notif) : null;
    const deadline = pending
      ? appointmentDeadline(official.jenis_kejohanan, after.tarikh, after.masa ?? '', notifMs ?? nowMs) : null;
    const notice: Notice = {
      email: 'always',
      subject: `Perubahan Perlawanan: ${official.kejohanan} — ${matchLabel} — ${tarikhFmt(after.tarikh)}`,
      title: 'Perubahan Maklumat Perlawanan',
      accent: '#D97706',
      mailType: 'lantikan',
      paragraphs: [
        `Maklumat perlawanan yang anda dilantik sebagai ${official.jawatan} telah dikemaskini oleh pengurus kejohanan.`,
        'Sila semak butiran terkini di bawah.',
      ],
      rows: [
        ['Kejohanan', official.kejohanan || '-'],
        ['No. Perlawanan', noMatchFmt(String(official.no_perlawanan ?? ''))],
        ['Perlawanan', changeText(`${before.pasukan_home} lwn ${before.pasukan_away}`, matchLabel)],
        ['Tarikh', changeText(tarikhFmt(before.tarikh), tarikhFmt(after.tarikh))],
        ['Masa', changeText(`${masaFmt(before.masa)} MYT`, `${masaFmt(after.masa)} MYT`)],
        ['Tempat', changeText(norm(before.tempat), norm(after.tempat) || '-')],
        ['Status Lantikan', official.status],
      ],
      alert: deadline
        ? { label: 'Lantikan Belum Dijawab', tone: 'warn',
          text: `Sila terima atau tolak tugasan ini ${deadline.sentence}.` }
        : { label: 'Tindakan', tone: 'info',
          text: 'Lantikan anda kekal diterima. Hubungi pengurus kejohanan jika anda tidak lagi dapat bertugas.' },
      actions: pending ? answerActions(env, official.email_token) : undefined,
      telegram: { markup: pending && official.tg_token ? tgLantikanKeyboard(official.tg_token) : null },
      portal: { type: 'Perubahan Perlawanan', subject: `Perubahan Perlawanan: ${matchLabel}`,
        message: `Maklumat perlawanan ${matchLabel} (${official.kejohanan}) telah dikemaskini: `
          + `${tarikhFmt(after.tarikh)}, ${masaFmt(after.masa)} MYT, ${norm(after.tempat) || '-'}.` },
    };
    const result = await notifyUser(env, officialRecipient(official), notice);
    for (const channel of ['email', 'telegram'] as const) {
      if (result[channel] === 'skipped') continue;
      try {
        await recordLantikanAudit(env, official.lantikan_id, 'schedule_change_notification', channel,
          result[channel] === 'sent' ? 'success' : 'failed',
          { before, after, recipient: channel === 'email' ? official.email : null },
          null, actorType, actorUserId);
      } catch (error) {
        console.error('[schedule change] audit failed', error instanceof Error ? error.message : error);
      }
    }
    if (Object.values(result).includes('sent')) reached += 1;
  }
  return reached;
}

/** Notice for the official whose unanswered appointment was rejected automatically. */
export function autoRejectNotice(snapshot: LantikanSnapshot): Notice {
  const matchLabel = `${snapshot.pasukan_home} lwn ${snapshot.pasukan_away}`;
  return {
    email: 'always',
    subject: `Lantikan Ditolak Automatik: ${snapshot.kejohanan} — ${matchLabel} — ${tarikhFmt(snapshot.tarikh)}`,
    title: 'Lantikan Ditolak Secara Automatik',
    accent: '#DC2626',
    mailType: 'lantikan',
    paragraphs: [
      `Lantikan anda sebagai ${snapshot.jawatan} untuk perlawanan di bawah telah ditolak secara automatik `
        + 'kerana tiada jawapan diterima dalam tempoh yang ditetapkan.',
      'Jika anda sebenarnya boleh bertugas, sila hubungi pengurus kejohanan dengan segera.',
    ],
    rows: [
      ['Kejohanan', snapshot.kejohanan || '-'],
      ['No. Perlawanan', noMatchFmt(String(snapshot.no_perlawanan ?? ''))],
      ['Perlawanan', matchLabel],
      ['Tarikh', tarikhFmt(snapshot.tarikh)],
      ['Masa', `${masaFmt(snapshot.masa)} MYT`],
      ['Tempat', String(snapshot.tempat ?? '') || '-'],
    ],
    portal: { type: 'Lantikan Ditolak', subject: `Lantikan ditolak automatik: ${matchLabel}`,
      message: `Lantikan anda sebagai ${snapshot.jawatan} untuk ${matchLabel} (${snapshot.kejohanan}) pada `
        + `${tarikhFmt(snapshot.tarikh)} telah ditolak secara automatik kerana tiada jawapan dalam tempoh.` },
  };
}

export function autoRejectRecipient(snapshot: LantikanSnapshot): Recipient {
  return { userId: snapshot.pengadil_id, luarId: snapshot.pengadil_luar_id, name: snapshot.nama_pegawai,
    email: snapshot.emel_pegawai, telegramChatId: snapshot.telegram_chat_id };
}

/** The account that made the appointment receives the replacement request. */
export function autoRejectOwnerNotice(env: Env, snapshot: LantikanSnapshot, role: string): Notice {
  const match = `${snapshot.pasukan_home} lwn ${snapshot.pasukan_away}`;
  return {
    subject: `Perlu Lantik Pengganti: ${snapshot.kejohanan} — ${match} — ${tarikhFmt(snapshot.tarikh)}`,
    title: 'Lantikan Ditolak Automatik — Pengganti Diperlukan', mailType: 'lantikan',
    paragraphs: [`${snapshot.nama_pegawai} belum menjawab lantikan sebagai ${snapshot.jawatan} sebelum tarikh akhir. Lantikan tersebut telah ditolak secara automatik.`,
      'Sila buat lantikan baharu bagi pengganti untuk jawatan ini.'],
    rows: [['Kejohanan', snapshot.kejohanan], ['No. Perlawanan', noMatchFmt(String(snapshot.no_perlawanan ?? ''))],
      ['Perlawanan', match], ['Tarikh', tarikhFmt(snapshot.tarikh)], ['Masa', `${masaFmt(snapshot.masa)} MYT`],
      ['Pegawai', snapshot.nama_pegawai], ['Jawatan', snapshot.jawatan]],
    actions: [{ label: 'Lantik Pengganti', url: `${baseUrl(env)}/${role === 'PP Daerah' ? 'pp-daerah' : 'admin'}/lantikan` }],
    portal: { type: 'Pengganti Diperlukan', subject: `Lantik pengganti: ${match}`,
      message: `${snapshot.nama_pegawai} (${snapshot.jawatan}) ditolak automatik. Sila lantik pengganti untuk ${match} (${snapshot.kejohanan}).` },
  };
}

/**
 * Admin and PP Daerah digests (in-app + Telegram, no email) for one auto-reject
 * run, queued so page loads that trigger auto-reject never wait on delivery.
 */
export async function queueAutoRejectDigests(env: Env, batchKey: string,
  rows: Array<{ nama: string; jawatan: string; pasukan: string; kejohanan: string; tarikh: string;
    persatuan_id: number | null }>): Promise<void> {
  if (rows.length === 0) return;
  const lines = rows.map((row) => `${row.nama} (${row.jawatan}) — ${row.pasukan}, ${tarikhFmt(row.tarikh)}`);
  const digest = (scope: string, items: string[]): Notice => ({
    subject: `Lantikan ditolak automatik: ${items.length} lantikan`,
    title: '⏰ Lantikan Ditolak Automatik',
    mailType: 'lantikan',
    paragraphs: [`${items.length} lantikan${scope} telah ditolak secara automatik kerana tiada jawapan dalam tempoh:`,
      items.map((line) => `• ${line}`).join('\n'),
      'Sila lantik pengganti atau gunakan override Admin jika pegawai telah mengesahkan di luar portal.'],
    portal: { type: 'Lantikan Ditolak', subject: `Lantikan ditolak automatik: ${items.length} lantikan`,
      message: `${items.length} lantikan${scope} ditolak automatik: ${items.join('; ')}.` },
  });
  const statements: D1PreparedStatement[] = [];
  for (const admin of await activeAdmins(env)) {
    statements.push(...enqueueNoticeStatements(env, `auto_reject_admin:${batchKey}:${admin.id}`,
      { ...contactRecipient(admin), email: null }, digest('', lines), { kind: 'auto_reject_digest' }));
  }
  const byDistrict = new Map<number, string[]>();
  rows.forEach((row, index) => {
    if (!row.persatuan_id) return;
    byDistrict.set(row.persatuan_id, [...(byDistrict.get(row.persatuan_id) ?? []), lines[index]]);
  });
  for (const [persatuanId, items] of byDistrict) {
    for (const pp of await districtPPs(env, persatuanId)) {
      statements.push(...enqueueNoticeStatements(env, `auto_reject_pp:${batchKey}:${pp.id}`,
        { ...contactRecipient(pp), email: null }, digest(' pengadil daerah anda', items),
        { kind: 'auto_reject_digest' }));
    }
  }
  if (statements.length) await env.DB.batch(statements);
}

const REMINDER_LEAD_HOURS = { liga: 12, other: 1 } as const;

interface ReminderRow {
  lantikan_id: number;
  jawatan: string;
  tarikh_notif: string;
  email_token: string | null;
  tg_token: string | null;
  pengadil_id: number | null;
  pengadil_luar_id: number | null;
  nama: string;
  email: string | null;
  telegram_chat_id: string | number | null;
  tarikh: string;
  masa: string | null;
  tempat: string | null;
  no_perlawanan: string | null;
  pasukan_home: string;
  pasukan_away: string;
  kejohanan: string;
  jenis_kejohanan: string;
}

/** When a reminder is due for one appointment, or null. */
export function reminderWindow(jenisKejohanan: string, tarikhNotif: string, tarikh: string, masa: string,
  nowMs = Date.now()): { answerBy: number } | null {
  const notif = klTimestamp(tarikhNotif);
  if (notif === null || notif <= 0) return null;
  const kickoff = getMatchKickoffTimestamp(tarikh, masa);
  const deadline = responseDeadline(jenisKejohanan, kickoff, notif);
  if (!deadline) return null;
  const answerBy = deadline.at;
  const lead = (jenisKejohanan.toLowerCase() === 'liga' ? REMINDER_LEAD_HOURS.liga : REMINDER_LEAD_HOURS.other)
    * 3600_000;
  const remindAt = answerBy - lead;
  if (remindAt <= notif + 15 * 60_000) return null;
  return remindAt <= nowMs && nowMs < answerBy ? { answerBy } : null;
}

/** Cron: one reminder per dispatch for officials who have not answered yet. */
export async function sendAppointmentReminders(env: Env, nowMs = Date.now(), limit = 30): Promise<number> {
  const rows = (await env.DB.prepare(`
    SELECT lp.id AS lantikan_id,lp.jawatan,lp.tarikh_notif,lp.email_token,lp.tg_token,
      lp.pengadil_id,lp.pengadil_luar_id,
      COALESCE(u.nama_penuh,pl.nama,'') AS nama, COALESCE(u.email,pl.emel) AS email,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
      jp.tarikh,jp.masa,jp.tempat,jp.no_perlawanan,jp.pasukan_home,jp.pasukan_away,
      COALESCE(kj.nama,'') AS kejohanan,COALESCE(kj.jenis_kejohanan,'') AS jenis_kejohanan
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN kejohanan kj ON kj.id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.status='Belum Jawab' AND lp.notif_hantar=1 AND lp.tarikh_notif IS NOT NULL
      AND COALESCE(jp.status,'') NOT IN ('Dibatalkan','Ditangguhkan')
      AND jp.tarikh>=date('now','+8 hours','-1 day')
      AND NOT EXISTS(SELECT 1 FROM worker_notification_outbox o
        WHERE o.dedupe_key IN ('reminder:'||lp.id||':'||lp.tarikh_notif||':email',
          'reminder:'||lp.id||':'||lp.tarikh_notif||':telegram'))
    ORDER BY lp.id`).all<ReminderRow>()).results;
  const statements: D1PreparedStatement[] = [];
  let queued = 0;
  for (const row of rows) {
    if (queued >= limit) break;
    const due = reminderWindow(row.jenis_kejohanan, row.tarikh_notif, row.tarikh, row.masa ?? '', nowMs);
    if (!due) continue;
    const matchLabel = `${row.pasukan_home} lwn ${row.pasukan_away}`;
    const notice: Notice = {
      subject: `Peringatan Lantikan: ${row.kejohanan} — ${matchLabel} — ${tarikhFmt(row.tarikh)}`,
      title: 'Peringatan: Lantikan Belum Dijawab',
      accent: '#F59E0B',
      mailType: 'lantikan',
      paragraphs: [`Anda masih belum menjawab lantikan sebagai ${row.jawatan} untuk perlawanan berikut.`,
        `Sila terima atau tolak tugasan ini sebelum ${phpDate('d M Y, H:i', due.answerBy)}.`],
      rows: [
        ['Kejohanan', row.kejohanan || '-'],
        ['No. Perlawanan', noMatchFmt(String(row.no_perlawanan ?? ''))],
        ['Perlawanan', matchLabel],
        ['Tarikh', tarikhFmt(row.tarikh)],
        ['Masa', `${masaFmt(row.masa)} MYT`],
        ['Tempat', String(row.tempat ?? '') || '-'],
      ],
      alert: { label: 'Tarikh Akhir Jawapan', tone: 'warn',
        text: `${phpDate('d M Y, H:i', due.answerBy)}. Lantikan yang tidak dijawab dalam tempoh akan ditolak secara automatik.` },
      actions: answerActions(env, row.email_token),
      telegram: { markup: row.tg_token ? tgLantikanKeyboard(row.tg_token) : null },
      precondition: { lantikanId: row.lantikan_id, tarikhNotif: row.tarikh_notif },
    };
    statements.push(...enqueueNoticeStatements(env, `reminder:${row.lantikan_id}:${row.tarikh_notif}`,
      officialRecipient(row), notice, { kind: 'response_reminder', lantikanId: row.lantikan_id }));
    queued += 1;
  }
  if (statements.length) await env.DB.batch(statements);
  return queued;
}

/** PP Daerah of a state tournament hear once per match when it is cancelled or postponed. */
export async function notifyPPDaerahBatal(env: Env, persatuanId: number,
  officials: Array<{ nama: string; jawatan: string }>, status: string, sebab: string,
  match: { kejohanan: string; tarikh: string; masa: string | null; tempat: string | null;
    pasukan_home: string; pasukan_away: string }): Promise<number> {
  const pps = await districtPPs(env, persatuanId);
  const pasukan = `${match.pasukan_home} lwn ${match.pasukan_away}`;
  const statusText = status === 'Ditangguhkan' ? 'ditangguhkan' : 'dibatalkan';
  const notice: Notice = {
    subject: `Perlawanan ${status}: ${pasukan} — ${tarikhFmt(match.tarikh)}`,
    title: status === 'Ditangguhkan' ? 'Perlawanan Ditangguhkan' : 'Perlawanan Dibatalkan',
    accent: status === 'Ditangguhkan' ? '#D97706' : '#DC2626',
    mailType: 'lantikan',
    paragraphs: [`Perlawanan yang melibatkan pengadil daerah anda telah ${statusText}. `
      + 'Lantikan pegawai berikut tidak lagi berkuat kuasa:',
    officials.map((item) => `• ${item.nama} — ${item.jawatan}`).join('\n')],
    rows: [['Kejohanan', match.kejohanan || '-'], ['Perlawanan', pasukan], ['Tarikh', tarikhFmt(match.tarikh)],
      ['Masa', `${masaFmt(match.masa)} MYT`], ['Tempat', String(match.tempat ?? '') || '-'], ['Sebab', sebab]],
    portal: { type: 'Status Perlawanan', subject: `Perlawanan ${status}: ${pasukan}`,
      message: `${officials.length} pengadil daerah anda terlibat dalam ${pasukan} (${match.kejohanan}) pada `
        + `${tarikhFmt(match.tarikh)} yang telah ${statusText}. Sebab: ${sebab}` },
  };
  let reached = 0;
  for (const pp of pps) {
    const result = await notifyUser(env, contactRecipient(pp), notice);
    if (Object.values(result).includes('sent')) reached += 1;
  }
  return reached;
}

/** Email + Telegram to an official whose rejection an Admin turned into acceptance. */
export async function notifyAcceptanceOverride(env: Env, snapshot: LantikanSnapshot, actorUserId: number):
  Promise<void> {
  const matchLabel = `${snapshot.pasukan_home} lwn ${snapshot.pasukan_away}`;
  const result = await notifyUser(env, { ...autoRejectRecipient(snapshot), userId: null }, {
    email: 'always',
    subject: `Lantikan Diterima (Pengesahan Admin): ${snapshot.kejohanan} — ${matchLabel} — ${tarikhFmt(snapshot.tarikh)}`,
    title: 'Penerimaan Lantikan Disahkan',
    accent: '#16A34A',
    mailType: 'lantikan',
    paragraphs: [`Pentadbir telah merekodkan penerimaan anda sebagai ${snapshot.jawatan} untuk perlawanan berikut `
      + 'selepas pengesahan diterima di luar portal.', 'Sila hadir bertugas mengikut butiran di bawah.'],
    rows: [
      ['Kejohanan', snapshot.kejohanan || '-'],
      ['No. Perlawanan', noMatchFmt(String(snapshot.no_perlawanan ?? ''))],
      ['Perlawanan', matchLabel],
      ['Tarikh', tarikhFmt(snapshot.tarikh)],
      ['Masa', `${masaFmt(snapshot.masa)} MYT`],
      ['Tempat', String(snapshot.tempat ?? '') || '-'],
    ],
  });
  for (const channel of ['email', 'telegram'] as const) {
    if (result[channel] === 'skipped') continue;
    try {
      await recordLantikanAudit(env, snapshot.lantikan_id, 'override_notification', channel,
        result[channel] === 'sent' ? 'success' : 'failed',
        { recipient: channel === 'email' ? snapshot.emel_pegawai : null }, null, 'admin', actorUserId);
    } catch (error) {
      console.error('[override] audit failed', error instanceof Error ? error.message : error);
    }
  }
}

export { processNotificationOutbox };
