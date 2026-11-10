/**
 * api/telegram-webhook.php: /start account linking and the accept/reject
 * buttons of appointment messages. Always answers Telegram with 200.
 */
import { isDemo } from './demo';
import { DRAFT_APPOINTMENT_MESSAGE, publishedAppointmentSql } from './appointment-publication';
import type { Env } from './types';
import { appointmentWritesEnabled } from './lantikan-write';
import { h, masaFmt, tarikhFmt } from './php/format';
import { guardStatement, runGuarded } from './php/guard';
import type { AuditMeta } from './php/lantikan-audit';
import { NOW, auditMetaFrom, lantikanAuditSelectStatement } from './php/lantikan-audit';
import { LANTIKAN_AUTO_TOLAK_KOMEN, autoTolakLantikanTertunggak, createPortalNotification,
  generatePenilaianToken, getMatchKupOfficials, notifyAdminLantikanResponse, notifyCompleteKupCrew,
  notifyPPDaerahResponse } from './php/lantikan-helper';
import { applyAppointmentResponse, ucfirst } from './php/lantikan-response';
import { tgAnswerCallback, tgEditMessage, tgKupOfficialsSection, tgSend } from './php/telegram';

type Update = {
  message?: { chat?: { id?: number }; text?: string; from?: { first_name?: string; last_name?: string } };
  callback_query?: { id?: string; from?: { id?: number }; data?: string;
    message?: { message_id?: number; id?: number } };
};

const ok = () => new Response(null, { status: 200 });

/**
 * The bot has one webhook (production). Updates carrying a token production
 * does not know are offered to the demo Worker; the demo answers 404 when it
 * does not know the token either, and production then replies as before.
 */
export const DEMO_RELAY_HEADER = 'X-Demo-Relay-Secret';
const START_TOKEN = /^\/start\s+(\S+)/;
const CALLBACK_TOKEN = /^act:(?:accept|reject):token:([A-Za-z0-9]+)$/;

async function relayedToDemo(env: Env, update: Update, raw: string): Promise<boolean> {
  if (!env.DEMO_RELAY_URL || !env.DEMO_RELAY_SECRET) return false;
  const start = START_TOKEN.exec(String(update.message?.text ?? '').trim());
  const press = CALLBACK_TOKEN.exec(String(update.callback_query?.data ?? ''));
  if (start) {
    if (await env.DB.prepare(`SELECT 1 FROM users WHERE tg_link_token=?1
      UNION SELECT 1 FROM pengadil_luar WHERE tg_link_token=?1 LIMIT 1`).bind(start[1]).first()) return false;
  } else if (press) {
    if (await env.DB.prepare('SELECT 1 FROM lantikan_pengadil WHERE tg_token=? LIMIT 1').bind(press[1]).first()) return false;
  } else return false;
  try {
    const response = await fetch(env.DEMO_RELAY_URL, {
      method: 'POST', body: raw, signal: AbortSignal.timeout(8_000),
      headers: { 'Content-Type': 'application/json', [DEMO_RELAY_HEADER]: env.DEMO_RELAY_SECRET },
    });
    return response.status === 200;
  } catch {
    console.error('[telegram-webhook] demo relay failed');
    return false;
  }
}

export async function telegramWebhook(request: Request, env: Env): Promise<Response> {
  if (!appointmentWritesEnabled(env)) return ok();
  // The demo only ever hears from production's relay.
  const demo = isDemo(env);
  if (demo && (!env.DEMO_RELAY_SECRET || request.headers.get(DEMO_RELAY_HEADER) !== env.DEMO_RELAY_SECRET)) {
    return new Response(null, { status: 403 });
  }
  let update: Update;
  let raw: string;
  try {
    raw = await request.text();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ok();
    update = parsed as Update;
  } catch { return ok(); }
  if (!demo && await relayedToDemo(env, update, raw)) return ok();
  const meta = auditMetaFrom(request);
  let callbackId: string | null = null;
  let handled = true;
  try {
    if (update.message) {
      handled = await handleStart(env, update.message, meta);
    } else if (update.callback_query) {
      callbackId = String(update.callback_query.id ?? '');
      handled = await handleCallback(env, update.callback_query, meta);
    }
  } catch (error) {
    console.error('[telegram-webhook] FATAL', error instanceof Error ? error.message : error);
    if (callbackId !== null) await tgAnswerCallback(env, callbackId, 'Ralat sistem. Sila hubungi admin.', true);
  }
  return handled ? ok() : new Response(null, { status: 404 });
}

/** False only in the demo, for a token it does not know: production then replies instead. */
async function handleStart(env: Env, message: NonNullable<Update['message']>, meta: AuditMeta): Promise<boolean> {
  const chatId = Math.trunc(Number(message.chat?.id ?? 0));
  const text = String(message.text ?? '').trim();
  if (!text.startsWith('/start')) return true;
  const space = text.indexOf(' ');
  const linkToken = space === -1 ? '' : text.slice(space + 1).trim();
  const linked = await env.DB.prepare(`
    SELECT id,'user' AS tbl,nama_penuh FROM users WHERE telegram_chat_id=?
    UNION
    SELECT id,'luar' AS tbl,nama AS nama_penuh FROM pengadil_luar WHERE telegram_chat_id=?
    LIMIT 1`).bind(chatId, chatId).first<{ id: number; tbl: string; nama_penuh: string | null }>();
  const linkedNama = linked?.nama_penuh ?? null;
  if (linkToken === '') {
    await tgSend(env, chatId, linkedNama
      ? '✅ <b>Akaun anda sudah dihubungkan</b>\n\n'
        + `Selamat kembali, <b>${h(linkedNama)}</b>.\n\n`
        + 'Anda akan menerima notifikasi Telegram apabila dilantik untuk bertugas.'
      : '<b>Sistem Pengurusan Pengadil Pahang FA</b>\n\n'
        + 'Bot ini digunakan untuk menerima notifikasi lantikan perlawanan.\n\n'
        + 'Sila minta pentadbir untuk menghantar pautan pendaftaran Telegram kepada anda.');
    return true;
  }
  const row = await env.DB.prepare(`
    SELECT id,'user' AS tbl,nama_penuh FROM users WHERE tg_link_token=?
    UNION
    SELECT id,'luar' AS tbl,nama AS nama_penuh FROM pengadil_luar WHERE tg_link_token=?
    LIMIT 1`).bind(linkToken, linkToken).first<{ id: number; tbl: string; nama_penuh: string }>();
  if (!row) {
    if (isDemo(env)) return false;
    await tgSend(env, chatId, linkedNama
      ? '✅ <b>Akaun anda sudah dihubungkan</b>\n\n'
        + `Selamat kembali, <b>${h(linkedNama)}</b>. `
        + 'Pautan pendaftaran itu sudah digunakan, jadi tiada tindakan lanjut diperlukan.\n\n'
        + 'Anda akan menerima notifikasi Telegram apabila dilantik untuk bertugas.'
      : '⚠️ <b>Pautan Pendaftaran Tidak Aktif</b>\n\n'
        + 'Pautan ini sudah tidak aktif — kemungkinan ia telah digunakan sebelum ini '
        + 'atau digantikan dengan pautan baharu.\n\n'
        + 'Sila minta pentadbir menghantar pautan pendaftaran Telegram yang terbaharu kepada anda.');
    return true;
  }
  if (linked && (linked.tbl !== row.tbl || Number(linked.id) !== Number(row.id))) {
    await tgSend(env, chatId, '⚠️ <b>Telegram Sudah Dipaut</b>\n\n'
      + `Chat Telegram ini sudah dipaut kepada <b>${h(linkedNama)}</b>.\n\n`
      + 'Sila hubungi pentadbir jika rekod itu tidak betul.');
    return true;
  }
  const table = row.tbl === 'user' ? 'users' : 'pengadil_luar';
  const statements: D1PreparedStatement[] = [
    guardStatement(env, 'telegram_link', `EXISTS(SELECT 1 FROM ${table} WHERE id=? AND tg_link_token=?)`,
      [row.id, linkToken]),
    env.DB.prepare(`UPDATE ${table} SET telegram_chat_id=?,tg_link_token=NULL WHERE id=? AND tg_link_token=?`)
      .bind(chatId, row.id, linkToken),
  ];
  if (row.tbl === 'luar') {
    // recordExternalTelegramLinked(): one audit row per appointment of this official.
    statements.push(lantikanAuditSelectStatement(env, 'lp.pengadil_luar_id=? ORDER BY lp.id ASC', [row.id],
      'telegram_account_linked', 'telegram', 'success', { telegram_chat_id: chatId }, null, 'official', null, meta));
    // recordExternalTelegramOnboardingLinked(): log first (it reads linked state), then mark linked.
    statements.push(env.DB.prepare(`INSERT INTO telegram_onboarding_log (batch_id,batch_token,kejohanan_id,
        kejohanan_nama,pengadil_luar_id,nama_pegawai,emel_pegawai,attempt_mode,event_status,reason,
        link_url,error_message,actor_user_id,ip_address,user_agent,created_at)
      SELECT os.last_batch_id,b.batch_token,os.kejohanan_id,b.kejohanan_nama,os.pengadil_luar_id,pl.nama,
        NULLIF(trim(COALESCE(pl.emel,'')),''),b.attempt_mode,'linked','telegram_account_linked',NULL,NULL,
        b.actor_user_id,?,?,${NOW}
      FROM telegram_onboarding_state os
      JOIN telegram_onboarding_batch b ON b.id=os.last_batch_id
      JOIN pengadil_luar pl ON pl.id=os.pengadil_luar_id
      WHERE os.pengadil_luar_id=? AND os.last_batch_id IS NOT NULL AND COALESCE(b.batch_token,'')<>''
      ORDER BY os.kejohanan_id ASC`).bind(meta.ip, meta.userAgent, row.id));
    statements.push(env.DB.prepare(`UPDATE telegram_onboarding_state
      SET linked_at=COALESCE(linked_at,${NOW}),claim_token=NULL,claimed_at=NULL
      WHERE pengadil_luar_id=?`).bind(row.id));
  }
  // A concurrent use of the same token raised an exception in PHP: no reply.
  if (!(await runGuarded(env, statements))) return true;
  await tgSend(env, chatId, '✅ <b>Akaun berjaya dihubungkan!</b>\n\n'
    + `Selamat datang, <b>${h(row.nama_penuh)}</b>.\n\n`
    + 'Anda akan menerima notifikasi Telegram apabila dilantik untuk bertugas dalam sesuatu perlawanan.');
  return true;
}

type CallbackRow = { id: number; jadual_id: number; status: string; komen: string | null;
  is_published: number;
  jawatan: string; pengadil_id: number | null; tarikh: string; pasukan_home: string;
  pasukan_away: string; tempat: string | null; masa: string | null; kejohanan: string | null;
  owner_chat_id: number | string | null; nama_penuh: string; persatuan_id: number | null };

async function handleCallback(env: Env, cbq: NonNullable<Update['callback_query']>, meta: AuditMeta): Promise<boolean> {
  const cbqId = String(cbq.id ?? '');
  const chatId = Math.trunc(Number(cbq.from?.id ?? 0));
  const msgId = Math.trunc(Number(cbq.message?.message_id ?? cbq.message?.id ?? 0));
  const match = /^act:(accept|reject):token:([A-Za-z0-9]+)$/.exec(String(cbq.data ?? ''));
  if (!match) {
    await tgAnswerCallback(env, cbqId, 'Format tidak sah.', true);
    return true;
  }
  const action = match[1] as 'accept' | 'reject';
  const tgToken = match[2];
  const row = await env.DB.prepare(`
    SELECT lp.id,lp.jadual_id,lp.status,lp.komen,lp.tarikh_notif,lp.jawatan,lp.pengadil_id,
      ${publishedAppointmentSql('lp')} AS is_published,
      jp.tarikh,jp.pasukan_home,jp.pasukan_away,jp.tempat,jp.masa,kj.nama AS kejohanan,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS owner_chat_id,
      COALESCE(NULLIF(trim(u.nama_penuh),''),NULLIF(trim(pl.nama),''),'Pengadil') AS nama_penuh,
      u.persatuan_id
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON lp.jadual_id=jp.id
    LEFT JOIN kejohanan kj ON jp.kejohanan_id=kj.id
    LEFT JOIN users u ON lp.pengadil_id=u.id
    LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id=pl.id
    WHERE lp.tg_token=? LIMIT 1`).bind(tgToken).first<CallbackRow>();
  if (!row) {
    if (isDemo(env)) return false;
    await tgAnswerCallback(env, cbqId, '⚠️ Butang ini sudah tidak aktif.\n\n'
      + 'Tugasan mungkin telah dijawab melalui saluran lain, atau lantikan telah dikemaskini oleh pentadbir. '
      + 'Sila semak dashboard atau notifikasi terbaru anda.', true);
    if (msgId) {
      await tgEditMessage(env, chatId, msgId, '⚠️ <b>Notifikasi Lapuk</b>\n\n'
        + 'Butang pada notifikasi ini sudah tidak aktif. Tugasan mungkin telah dijawab '
        + 'melalui saluran lain, atau lantikan telah dikemaskini oleh pentadbir.\n\n'
        + 'Sila semak dashboard atau notifikasi terbaru anda.');
    }
    return true;
  }
  if (Math.trunc(Number(row.owner_chat_id ?? 0)) !== chatId) {
    await tgAnswerCallback(env, cbqId, 'Anda tidak dibenarkan untuk tugasan ini.', true);
    return true;
  }
  if (!row.is_published) {
    await tgAnswerCallback(env, cbqId, DRAFT_APPOINTMENT_MESSAGE, true);
    return true;
  }
  if (await autoTolakLantikanTertunggak(env, { id: row.id }, meta) > 0
      || (row.status === 'Ditolak' && (row.komen ?? '') === LANTIKAN_AUTO_TOLAK_KOMEN)) {
    await tgAnswerCallback(env, cbqId, '⏰ Tempoh menjawab telah tamat. Lantikan telah ditolak secara automatik.', true);
    if (msgId) {
      await tgEditMessage(env, chatId, msgId, '⏰ <b>Tempoh Menjawab Tamat</b>\n\n'
        + 'Lantikan ini telah <b>ditolak secara automatik</b> kerana tiada jawapan dalam tempoh ditetapkan.\n'
        + 'Sila hubungi pentadbir jika anda masih boleh bertugas.');
    }
    return true;
  }
  if (row.status !== 'Belum Jawab') {
    await tgAnswerCallback(env, cbqId, `Tugasan ini ${row.status === 'Diterima' ? 'sudah diterima' : 'sudah ditolak'}.`, true);
    return true;
  }
  const newStatus = action === 'accept' ? 'Diterima' : 'Ditolak';
  const outcome = await applyAppointmentResponse(env, {
    lantikanId: row.id, jadualId: row.jadual_id, jawatan: row.jawatan, newStatus, channel: 'telegram',
    details: { action, new_status: newStatus, telegram_chat_id: chatId }, linkUrl: null, actorUserId: null,
  }, meta);
  if (!outcome.updated) {
    await tgAnswerCallback(env, cbqId, `Tugasan ini ${action === 'accept' ? 'sudah diterima' : 'sudah ditolak'}.`, true);
    return true;
  }
  const tarikhText = tarikhFmt(String(row.tarikh ?? ''));
  const pasukan = h(`${row.pasukan_home ?? ''} lwn ${row.pasukan_away ?? ''}`);
  const jawatan = h(row.jawatan ?? '');
  const kejohanan = h(row.kejohanan ?? '');
  const tempat = h(row.tempat ?? '');
  const masaText = row.masa ? masaFmt(row.masa) : '-';
  const dashUrl = `${(env.BASE_URL || 'https://refpahang.com').replace(/\/+$/, '')}/pengadil-dashboard`;
  const dashboardSection = row.pengadil_id ? `\n\n🔗 <a href="${dashUrl}">Lihat Dashboard Pengadil</a>` : '';
  const roster = await getMatchKupOfficials(env, row.jadual_id);
  const kupSection = tgKupOfficialsSection(roster.officials, roster.region_label);
  let reply: string;
  if (action === 'accept') {
    await tgAnswerCallback(env, cbqId, '✅ Tugasan Diterima!\n\n'
      + `${row.jawatan}\n${row.pasukan_home} lwn ${row.pasukan_away}\n${tarikhText}, ${masaText} MYT`, true);
    reply = '✅ <b>Tugasan Diterima</b>\n\n'
      + `Anda telah <b>menerima</b> tugasan sebagai <b>${jawatan}</b> `
      + 'untuk perlawanan berikut:\n\n'
      + `<b>Kejohanan:</b> ${kejohanan}\n<b>Perlawanan:</b> ${pasukan}\n<b>Tarikh:</b> ${tarikhText}\n`
      + `<b>Masa:</b> ${masaText} MYT\n<b>Tempat:</b> ${tempat}${kupSection}\n\n`
      + 'Terima kasih. Sila hadir pada waktu yang ditetapkan.\n\n'
      + `⚠️ <b>Sila bawa kelengkapan penuh pengadil.</b> ⚽${dashboardSection}`;
  } else {
    await tgAnswerCallback(env, cbqId, '❌ Tugasan Ditolak\n\n'
      + `${row.jawatan}\n${row.pasukan_home} lwn ${row.pasukan_away}\n${tarikhText}`, true);
    reply = '❌ <b>Tugasan Ditolak</b>\n\n'
      + `Anda telah <b>menolak</b> tugasan sebagai <b>${jawatan}</b> `
      + 'untuk perlawanan berikut:\n\n'
      + `<b>Kejohanan:</b> ${kejohanan}\n<b>Perlawanan:</b> ${pasukan}\n<b>Tarikh:</b> ${tarikhText}\n`
      + `<b>Masa:</b> ${masaText} MYT\n<b>Tempat:</b> ${tempat}${kupSection}\n\n`
      + `Pentadbir akan dimaklumkan. Terima kasih.${dashboardSection}`;
  }
  await tgEditMessage(env, chatId, msgId, reply);
  if (newStatus === 'Diterima') {
    try { await generatePenilaianToken(env, row.id, meta); } catch (error) {
      console.error('[telegram-webhook] generatePenilaianToken error', error instanceof Error ? error.message : error);
    }
  }
  if (outcome.shouldNotifyCompleteKup) {
    try { await notifyCompleteKupCrew(env, row.jadual_id); } catch (error) {
      console.error('[telegram-webhook] KUP crew notification error', error instanceof Error ? error.message : error);
    }
  }
  try {
    await notifyAdminLantikanResponse(env, action, row.nama_penuh, row.jawatan, row.kejohanan ?? '',
      row.tarikh, row.pasukan_home, row.pasukan_away);
    if (row.pengadil_id) {
      const label = action === 'accept' ? 'diterima' : 'ditolak';
      await createPortalNotification(env, row.pengadil_id, `Lantikan ${ucfirst(label)}`,
        `Lantikan ${row.pasukan_home} lwn ${row.pasukan_away}`,
        `Anda telah ${label} lantikan sebagai ${row.jawatan} untuk ${row.pasukan_home} lwn ${row.pasukan_away} (${row.kejohanan ?? ''}).`);
      const persatuanId = Number(row.persatuan_id ?? 0);
      if (persatuanId) {
        await notifyPPDaerahResponse(env, action, persatuanId, row.nama_penuh, row.jawatan, row.kejohanan ?? '',
          row.tarikh, row.pasukan_home, row.pasukan_away);
      }
    }
  } catch (error) {
    console.error('[telegram-webhook] notification error', error instanceof Error ? error.message : error);
  }
  return true;
}
