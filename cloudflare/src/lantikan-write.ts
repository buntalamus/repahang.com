import { districtOf, localOfficialSql } from './appointment-access';
/**
 * Write side of api/lantikan.php: assign (new, replacement, after kickoff),
 * notify, notify_all, batal_jadual, batal_bulk and DELETE. PHP serialised
 * these with transactions and FOR UPDATE; here each atomic part is one D1
 * batch whose first statement is a guard that aborts when the state read
 * beforehand changed. Notifications are sent before responding, as in PHP.
 */
import { json } from './auth';
import type { SessionUser as User } from './auth';
import type { Env } from './types';
import { boundedJson } from './request';
import { sendBatalEmail, sendLantikanEmail } from './php/email';
import type { AuditMeta, LantikanSnapshot } from './php/lantikan-audit';
import { NOW, buildAppointmentDirectLinks, buildTelegramLink, getLantikanAuditSnapshot,
  lantikanAuditSelectStatement, lantikanAuditStatement, recordLantikanAudit } from './php/lantikan-audit';
import { autoTolakLantikanTertunggak, createPortalNotification, generatePenilaianToken,
  getAppointmentSlotValidation, getMatchKupOfficials, hasMatchStarted, historySyncStatements,
  isAcceptedKupCrewComplete, isKupPosition, markAppointmentExternallyDelivered,
  markMatchDispatchedIfComplete, matchStartedMessage, notifyCompleteKupCrew, notifyLantikanPortal,
  notifyPPDaerahLantikan, randomHex } from './php/lantikan-helper';
import { tgBatalMessage, tgLantikanKeyboard, tgLantikanMessage, tgSend } from './php/telegram';
import { guardStatement, runGuarded } from './php/guard';
import { notifyPPDaerahBatal } from './lantikan-notify';

const VALID_JAWATAN = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4', 'Penilai Pengadil'];
const CHANGED = 'Slot lantikan telah berubah. Muat semula dan cuba lagi.';

/** Writes run only when every staging switch for appointment side effects is on. */
export function appointmentWritesEnabled(env: Env): boolean {
  return env.STAGING_AUTH_ENABLED === '1' && env.STAGING_WRITES_ENABLED === '1'
    && env.APPOINTMENT_DELIVERY_ENABLED === '1';
}

/** PHP (int) cast for request values. */
export function phpInt(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const match = /^\s*([+-]?\d+)/.exec(value);
    return match ? Number.parseInt(match[1], 10) : 0;
  }
  return 0;
}

/** PHP empty() for scalar request values. */
function phpEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === false || value === 0 || value === ''
    || value === '0' || (Array.isArray(value) && value.length === 0);
}

function phpTrim(value: unknown, fallback: string): string {
  return (value === undefined || value === null ? fallback : String(value)).trim();
}

type Timing = { id: number; tarikh: string; masa: string | null; status: string };

async function getJadualTiming(env: Env, jadualId: number): Promise<Timing | null> {
  return env.DB.prepare('SELECT id,tarikh,masa,status FROM jadual_perlawanan WHERE id=?')
    .bind(jadualId).first<Timing>();
}

/** Response for the whole route; GET stays in admin-appointments.ts. */
export async function lantikanWrite(request: Request, env: Env, user: User): Promise<Response> {
  if (!appointmentWritesEnabled(env)) {
    return json({ error: true, message: 'Pengurusan lantikan belum tersedia di staging.' }, 503);
  }
  const meta: AuditMeta = {
    ip: request.headers.get('CF-Connecting-IP'),
    userAgent: request.headers.get('User-Agent') === null ? null
      : Array.from(request.headers.get('User-Agent') as string).slice(0, 255).join(''),
  };
  if (request.method === 'DELETE') return deleteAppointment(env, request, user, meta);
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  const parsed = await boundedJson(request, 262_144);
  if (parsed instanceof Response) return parsed;
  const input = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown> : {};
  const action = input.action ?? 'assign';
  if (action === 'notify') return notifyMatch(env, input, user, meta);
  if (action === 'notify_all') return notifyAll(env, input, user, meta);
  if (action === 'batal_jadual' || action === 'batal_bulk') {
    const status = phpTrim(input.status, 'Dibatalkan');
    const sebab = phpTrim(input.sebab, '');
    let ids: number[];
    if (action === 'batal_jadual') {
      const jadualId = phpInt(input.jadual_id);
      if (!jadualId) return json({ error: true, message: 'jadual_id diperlukan.' }, 400);
      ids = [jadualId];
    } else {
      ids = !phpEmpty(input.jadual_ids) && Array.isArray(input.jadual_ids) ? input.jadual_ids.map(phpInt) : [];
      if (ids.length === 0) return json({ error: true, message: 'jadual_ids diperlukan.' }, 400);
    }
    if (!['Dibatalkan', 'Ditangguhkan'].includes(status) || sebab === '' || Array.from(sebab).length > 500) {
      return json({ error: true, message: 'Status dan sebab (maksimum 500 aksara) diperlukan.' }, 400);
    }
    return batalLantikanByJadual(env, ids, status, sebab, user.id, meta, user.role==='PP Daerah' ? 'pp_daerah' : 'admin');
  }
  return assign(env, input, user, meta);
}

async function assign(env: Env, input: Record<string, unknown>, user: User, meta: AuditMeta): Promise<Response> {
  const jadualId = phpInt(input.jadual_id);
  const pengadilId = !phpEmpty(input.pengadil_id) ? phpInt(input.pengadil_id) : null;
  const luarId = !phpEmpty(input.pengadil_luar_id) ? phpInt(input.pengadil_luar_id) : null;
  const jawatan = phpTrim(input.jawatan, '');
  if (!jadualId || (!pengadilId && !luarId) || !jawatan) {
    return json({ error: true, message: 'jadual_id, pengadil dan jawatan diperlukan.' }, 400);
  }
  if ((pengadilId !== null) === (luarId !== null)) {
    return json({ error: true, message: 'Pilih tepat satu pegawai berdaftar atau pegawai luar.' }, 400);
  }
  if (!VALID_JAWATAN.includes(jawatan)) return json({ error: true, message: 'Jawatan tidak sah.' }, 400);
  const timing = await getJadualTiming(env, jadualId);
  if (!timing) return json({ error: true, message: 'Perlawanan tidak dijumpai.' }, 404);
  if (['Dibatalkan', 'Ditangguhkan'].includes(String(timing.status ?? ''))) {
    return json({ error: true, message: 'Lantikan tidak boleh diubah untuk perlawanan yang dibatalkan atau ditangguhkan.' }, 409);
  }
  const poolMember = await env.DB.prepare(`
    SELECT COALESCE(u.jenis_pengadil,pl.jenis_pengadil,'') AS jenis_pengadil,
      u.telegram_chat_id
    FROM jadual_perlawanan jp
    JOIN pool_pengadil pp ON pp.kejohanan_id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=pp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=pp.pengadil_luar_id
    WHERE jp.id=? AND ((? IS NOT NULL AND pp.pengadil_id=?) OR (? IS NOT NULL AND pp.pengadil_luar_id=?))
    LIMIT 1`).bind(jadualId, pengadilId, pengadilId, luarId, luarId).first<{
      jenis_pengadil: string; telegram_chat_id: string | number | null;
    }>();
  if (!poolMember) return json({ error: true, message: 'Pegawai yang dipilih tiada dalam pool kejohanan ini.' }, 409);
  const jenisPengadil = String(poolMember.jenis_pengadil ?? '').trim();
  if (jawatan === 'Penilai Pengadil' && jenisPengadil !== 'Penilai Pengadil') {
    return json({ error: true, message: 'Slot Penilai Pengadil hanya boleh diberikan kepada pegawai berjenis Penilai Pengadil.' }, 409);
  }
  if (jawatan !== 'Penilai Pengadil' && jenisPengadil === 'Penilai Pengadil') {
    return json({ error: true, message: 'Penilai Pengadil tidak boleh ditempatkan dalam slot KUP.' }, 409);
  }
  const matchStarted = hasMatchStarted(String(timing.tarikh), String(timing.masa ?? ''));
  if (!matchStarted && pengadilId && !String(poolMember.telegram_chat_id ?? '').trim()) {
    return json({ error: true, telegram_link_required: true,
      message: 'Pegawai ini perlu menghubungkan Telegram sebelum boleh menerima lantikan. Minta beliau buka pautan dalam emel atau menu Profil.' }, 409);
  }

  const existing = await env.DB.prepare(`SELECT id,pengadil_id,pengadil_luar_id,status,penilaian_token
    FROM lantikan_pengadil WHERE jadual_id=? AND jawatan=?`).bind(jadualId, jawatan)
    .first<{ id: number; pengadil_id: number | null; pengadil_luar_id: number | null; status: string;
      penilaian_token: string | null }>();
  const identityChanged = !existing || Number(existing.pengadil_id ?? 0) !== Number(pengadilId ?? 0)
    || Number(existing.pengadil_luar_id ?? 0) !== Number(luarId ?? 0);
  const requiresFreshResponse = identityChanged
    || (existing !== null && !['Belum Jawab', 'Diterima'].includes(String(existing.status)));

  const conflictSql = `SELECT lp.id,lp.jawatan,jp.no_perlawanan FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    WHERE lp.status IN ('Belum Jawab','Diterima') AND jp.tarikh=? AND jp.masa IS ?
      AND NOT (lp.jadual_id=? AND lp.jawatan=?)
      AND ((? IS NOT NULL AND lp.pengadil_id=?) OR (? IS NOT NULL AND lp.pengadil_luar_id=?)) LIMIT 1`;
  const conflictBinds = [timing.tarikh, timing.masa, jadualId, jawatan, pengadilId, pengadilId, luarId, luarId];
  const reportSql = 'SELECT id FROM laporan_penilaian WHERE jadual_id=? LIMIT 1';
  const legacySql = `SELECT pp.id FROM penilaian_pengadil pp JOIN perlawanan p ON p.id=pp.perlawanan_id
    JOIN lantikan_pengadil lp ON lp.id=p.lantikan_id WHERE lp.jadual_id=? LIMIT 1`;
  if (requiresFreshResponse) {
    const conflict = await env.DB.prepare(conflictSql).bind(...conflictBinds).first<{ jawatan: string }>();
    if (conflict) {
      return json({ error: true,
        message: `Pegawai ini sudah dilantik sebagai ${conflict.jawatan} pada tarikh dan masa yang sama.` }, 409);
    }
    if (await env.DB.prepare(reportSql).bind(jadualId).first()) {
    return json({ error: true, message: 'Lantikan tidak boleh diubah kerana laporan Penilai Pengadil untuk perlawanan ini telah diwujudkan.' }, 409);
    }
    if (await env.DB.prepare(legacySql).bind(jadualId).first()) {
      return json({ error: true, message: 'Lantikan tidak boleh diubah kerana rekod penilaian pengadil telah wujud dalam sejarah perlawanan.' }, 409);
    }
  }

  const slotUnchanged = existing
    ? `EXISTS(SELECT 1 FROM lantikan_pengadil WHERE id=? AND jadual_id=? AND jawatan=?
        AND pengadil_id IS ? AND pengadil_luar_id IS ? AND status=?)`
    : 'NOT EXISTS(SELECT 1 FROM lantikan_pengadil WHERE jadual_id=? AND jawatan=?)';
  const slotBinds = existing
    ? [existing.id, jadualId, jawatan, existing.pengadil_id, existing.pengadil_luar_id, existing.status]
    : [jadualId, jawatan];
  const freshChecks = requiresFreshResponse
    ? ` AND NOT EXISTS(${conflictSql}) AND NOT EXISTS(${reportSql}) AND NOT EXISTS(${legacySql})` : '';
  const districtGuard = user.role==='PP Daerah'
    ? ` AND EXISTS(SELECT 1 FROM users u WHERE u.id=? AND ${localOfficialSql('u')})` : '';
  const statements: D1PreparedStatement[] = [
    guardStatement(env, 'lantikan_assign',
      `${slotUnchanged} AND EXISTS(SELECT 1 FROM jadual_perlawanan WHERE id=?
        AND status NOT IN ('Dibatalkan','Ditangguhkan'))${freshChecks}${districtGuard}`,
      [...slotBinds, jadualId, ...(requiresFreshResponse ? [...conflictBinds, jadualId, jadualId] : []),
        ...(user.role==='PP Daerah' ? [pengadilId,districtOf(user)] : [])]),
  ];
  let shouldNotifyRa = false;
  if (existing) {
    if (matchStarted) {
      const keepPenilaianToken = jawatan === 'Penilai Pengadil' && !identityChanged && existing.status === 'Diterima';
      statements.push(env.DB.prepare(`UPDATE lantikan_pengadil SET pengadil_id=?,pengadil_luar_id=?,
          status='Diterima',komen=NULL,
          sebab_status='Disahkan terus oleh pentadbir selepas perlawanan bermula',
          tarikh_jawab=${NOW},status_dikemaskini_at=${NOW},
          notif_hantar=0,tg_notif_hantar=0,tarikh_notif=NULL,tg_token=NULL,email_token=NULL,
          penilaian_token=CASE WHEN ?=1 THEN penilaian_token ELSE NULL END,created_by=?
        WHERE id=?`).bind(pengadilId, luarId, keepPenilaianToken ? 1 : 0, user.id, existing.id));
      shouldNotifyRa = jawatan === 'Penilai Pengadil' && !keepPenilaianToken;
    } else if (requiresFreshResponse) {
      // Old response links must not answer a replacement's appointment.
      statements.push(env.DB.prepare(`UPDATE lantikan_pengadil SET pengadil_id=?,pengadil_luar_id=?,
          status='Belum Jawab',komen=NULL,sebab_status=NULL,tarikh_jawab=NULL,status_dikemaskini_at=NULL,
          notif_hantar=0,tg_notif_hantar=0,tarikh_notif=NULL,tg_token=NULL,email_token=NULL,
          penilaian_token=NULL,created_by=?
        WHERE id=?`).bind(pengadilId, luarId, user.id, existing.id));
    }
  } else if (matchStarted) {
    statements.push(env.DB.prepare(`INSERT INTO lantikan_pengadil
        (jadual_id,pengadil_id,pengadil_luar_id,jawatan,status,sebab_status,tarikh_jawab,
         status_dikemaskini_at,notif_hantar,tg_notif_hantar,created_by,created_at,updated_at)
      VALUES (?,?,?,?,'Diterima','Disahkan terus oleh pentadbir selepas perlawanan bermula',
        ${NOW},${NOW},0,0,?,${NOW},${NOW})`).bind(jadualId, pengadilId, luarId, jawatan, user.id));
    shouldNotifyRa = jawatan === 'Penilai Pengadil';
  } else {
    // MySQL column defaults: status 'Belum Jawab', notif flags 0, timestamps now.
    statements.push(env.DB.prepare(`INSERT INTO lantikan_pengadil
        (jadual_id,pengadil_id,pengadil_luar_id,jawatan,status,notif_hantar,tg_notif_hantar,
         created_by,created_at,updated_at)
      VALUES (?,?,?,?,'Belum Jawab',0,0,?,${NOW},${NOW})`).bind(jadualId, pengadilId, luarId, jawatan, user.id));
  }
  const auditEvent = !existing ? 'appointment_created'
    : (identityChanged ? 'appointment_reassigned' : 'appointment_reviewed');
  statements.push(lantikanAuditSelectStatement(env, 'lp.jadual_id=? AND lp.jawatan=?', [jadualId, jawatan],
    auditEvent, 'admin', 'success', {
      previous_pengadil_id: existing?.pengadil_id ?? null,
      previous_pengadil_luar_id: existing?.pengadil_luar_id ?? null,
      previous_status: existing?.status ?? null,
      match_started: matchStarted,
      notification_sent: false,
    }, null, user.role==='PP Daerah' ? 'pp_daerah' : 'admin', user.id, meta));
  statements.push(...historySyncStatements(env, jadualId));
  if (matchStarted) {
    statements.push(env.DB.prepare(`UPDATE jadual_perlawanan SET status=CASE
        WHEN status IN ('Belum Lantik','Menunggu Pengesahan') THEN 'Disahkan' ELSE status END
      WHERE id=?`).bind(jadualId));
  } else if (requiresFreshResponse || !existing) {
    statements.push(env.DB.prepare("UPDATE jadual_perlawanan SET status='Menunggu Pengesahan' WHERE id=?")
      .bind(jadualId));
  }
  // The replaced official must hear that their appointment no longer stands.
  const previousHolder = existing && identityChanged && !matchStarted
    && ['Belum Jawab', 'Diterima'].includes(String(existing.status))
    ? await getLantikanAuditSnapshot(env, existing.id) : null;
  if (!(await runGuarded(env, statements))) return json({ error: true, message: CHANGED }, 409);
  let previousHolderNotified = false;
  if (previousHolder && (previousHolder.notif_hantar || previousHolder.tg_notif_hantar)) {
    previousHolderNotified = await notifyReplacedOfficial(env, previousHolder, user, meta);
  }

  const shouldNotifyCompleteKup = matchStarted && requiresFreshResponse && isKupPosition(jawatan)
    && await isAcceptedKupCrewComplete(env, jadualId);
  let message = matchStarted
    ? 'Lantikan rekod lama disahkan terus dan sejarah pengadil dikemaskini.'
    : (existing ? 'Lantikan dikemaskini.' : 'Pengadil berjaya dilantik.');
  if (shouldNotifyCompleteKup) {
    try {
      const crew = await notifyCompleteKupCrew(env, jadualId);
      message += ` Krew KUP lengkap dimaklumkan melalui ${crew.telegram_sent} Telegram dan ${crew.email_sent} emel.`;
      if (crew.pending_channels > 0) {
        message += ` ${crew.pending_channels} penghantaran akan dicuba semula secara automatik.`;
      }
    } catch (error) {
      console.error('[lantikan.php] KUP crew notification error', error instanceof Error ? error.message : error);
      message += ' Krew KUP lengkap, tetapi notifikasi krew gagal dihantar.';
    }
  }
  if (shouldNotifyRa) {
    try {
      const row = await env.DB.prepare('SELECT id FROM lantikan_pengadil WHERE jadual_id=? AND jawatan=?')
        .bind(jadualId, jawatan).first<{ id: number }>();
      if (row) await generatePenilaianToken(env, row.id, meta);
      message += ' Pautan borang Penilai Pengadil telah dihantar.';
    } catch (error) {
      console.error('[lantikan.php] RA notification failed', error instanceof Error ? error.message : error);
      message += ' Lantikan Penilai Pengadil berjaya, tetapi notifikasi borang gagal dihantar.';
    }
  }
  return json({ error: false, message,
    ...(previousHolder ? { previous_holder_notified: previousHolderNotified } : {}) });
}

const REPLACED_REASON = 'Lantikan anda telah diganti oleh pegawai lain.';

/** Cancellation notice (Telegram, email, portal) to an official replaced before kickoff. */
async function notifyReplacedOfficial(env: Env, snapshot: LantikanSnapshot, user: User,
  meta: AuditMeta): Promise<boolean> {
  const actorType = user.role === 'PP Daerah' ? 'pp_daerah' : 'admin';
  const s = (key: keyof LantikanSnapshot) => String(snapshot[key] ?? '');
  let delivered = false;
  try {
    if (snapshot.telegram_chat_id) {
      const ok = await tgSend(env, Number(snapshot.telegram_chat_id), tgBatalMessage(s('nama_pegawai'),
        s('jawatan'), s('kejohanan'), s('tarikh'), s('masa'), s('tempat'), s('pasukan_home'),
        s('pasukan_away'), s('no_perlawanan'), 'Dibatalkan', REPLACED_REASON, 'lantikan'));
      delivered = ok || delivered;
      await recordLantikanAudit(env, snapshot.lantikan_id, 'reassignment_notification', 'telegram',
        ok ? 'success' : 'failed', { reason: REPLACED_REASON }, null, actorType, user.id, snapshot, meta);
    }
    if (snapshot.emel_pegawai) {
      const match = await env.DB.prepare('SELECT logo_home,logo_away FROM jadual_perlawanan WHERE id=?')
        .bind(snapshot.jadual_id).first<{ logo_home: string | null; logo_away: string | null }>();
      const ok = await sendBatalEmail(env, s('emel_pegawai'), s('nama_pegawai'), s('jawatan'), s('kejohanan'),
        s('tarikh'), s('masa'), s('tempat'), s('pasukan_home'), s('pasukan_away'), s('no_perlawanan'),
        String(match?.logo_home ?? ''), String(match?.logo_away ?? ''), Boolean(snapshot.pengadil_id),
        'Dibatalkan', REPLACED_REASON, 'lantikan');
      delivered = ok || delivered;
      await recordLantikanAudit(env, snapshot.lantikan_id, 'reassignment_notification', 'email',
        ok ? 'success' : 'failed', { reason: REPLACED_REASON, recipient: snapshot.emel_pegawai },
        null, actorType, user.id, snapshot, meta);
    }
    if (snapshot.pengadil_id) {
      await createPortalNotification(env, Number(snapshot.pengadil_id), 'Status Perlawanan',
        `Lantikan dibatalkan: ${s('pasukan_home')} lwn ${s('pasukan_away')}`,
        `Lantikan anda sebagai ${s('jawatan')} untuk ${s('pasukan_home')} lwn ${s('pasukan_away')} telah diganti oleh pegawai lain.`);
      delivered = true;
    }
  } catch (error) {
    console.error('[lantikan.php] replaced official notification error', error instanceof Error ? error.message : error);
  }
  return delivered;
}

async function deleteAppointment(env: Env, request: Request, user: User, meta: AuditMeta): Promise<Response> {
  const id = phpInt(new URL(request.url).searchParams.get('id') ?? 0);
  if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
  const record = await env.DB.prepare(`
    SELECT lp.jawatan,lp.status,lp.notif_hantar,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
      COALESCE(u.nama_penuh,pl.nama) AS nama, COALESCE(u.email,pl.emel) AS email,
      lp.pengadil_id,lp.jadual_id,jp.no_perlawanan,jp.tarikh,jp.masa,jp.tempat,
      jp.pasukan_home,jp.pasukan_away,jp.kejohanan_id,jp.logo_home,jp.logo_away,
      COALESCE(kj.nama,'') AS kejohanan
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON lp.jadual_id=jp.id
    LEFT JOIN kejohanan kj ON jp.kejohanan_id=kj.id
    LEFT JOIN users u ON lp.pengadil_id=u.id
    LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id=pl.id
    WHERE lp.id=?`).bind(id).first<Record<string, unknown> & { jawatan: string; status: string;
      jadual_id: number; tarikh: string; masa: string | null }>();
  if (!record) return json({ error: true, message: 'Lantikan tidak dijumpai.' }, 404);
  if (hasMatchStarted(String(record.tarikh), String(record.masa ?? ''))) {
    return json({ error: true,
      message: 'Lantikan perlawanan yang telah bermula tidak boleh dibuang. Gunakan tindakan Ganti untuk membetulkan pegawai.' }, 409);
  }
  const snapshot = await getLantikanAuditSnapshot(env, id);
  if (!snapshot) throw new Error('Snapshot audit lantikan tidak dijumpai sebelum dibuang.');
  const reportSql = `SELECT lp.id FROM laporan_penilaian lp
    LEFT JOIN laporan_penilaian_pegawai lpp ON lpp.laporan_id=lp.id
    WHERE lp.lantikan_id=? OR lpp.lantikan_pengadil_id=? LIMIT 1`;
  const legacySql = `SELECT pp.id FROM penilaian_pengadil pp JOIN perlawanan p ON p.id=pp.perlawanan_id
    WHERE p.lantikan_id=? LIMIT 1`;
  if (await env.DB.prepare(reportSql).bind(id, id).first()) {
    return json({ error: true, message: 'Lantikan tidak boleh dibuang kerana sudah digunakan dalam laporan Penilai Pengadil.' }, 409);
  }
  if (await env.DB.prepare(legacySql).bind(id).first()) {
    return json({ error: true, message: 'Lantikan tidak boleh dibuang kerana rekod penilaian pengadil telah wujud.' }, 409);
  }
  const jadualId = Number(record.jadual_id);
  const done = await runGuarded(env, [
    guardStatement(env, 'lantikan_delete', `EXISTS(SELECT 1 FROM lantikan_pengadil WHERE id=? AND status=?)
      AND NOT EXISTS(${reportSql}) AND NOT EXISTS(${legacySql})`, [id, record.status, id, id, id]),
    env.DB.prepare('DELETE FROM perlawanan WHERE lantikan_id=?').bind(id),
    lantikanAuditStatement(env, id, 'appointment_deleted', 'admin', 'success', {
      previous_status: record.status, notification_was_sent: Boolean(record.notif_hantar),
    }, null, user.role==='PP Daerah' ? 'pp_daerah' : 'admin', user.id, snapshot, meta),
    env.DB.prepare('DELETE FROM lantikan_pengadil WHERE id=?').bind(id),
    ...historySyncStatements(env, jadualId),
  ]);
  if (!done) return json({ error: true, message: 'Lantikan berubah semasa proses buang. Sila cuba lagi.' }, 409);
  const shouldNotifyCompleteKup = isKupPosition(record.jawatan)
    && ['Belum Jawab', 'Diterima'].includes(record.status)
    && await isAcceptedKupCrewComplete(env, jadualId);
  if (!(await getAppointmentSlotValidation(env, jadualId)).valid) {
    await env.DB.prepare("UPDATE jadual_perlawanan SET status='Belum Lantik' WHERE id=?").bind(jadualId).run();
  } else if (!(await markMatchDispatchedIfComplete(env, jadualId))) {
    await env.DB.prepare("UPDATE jadual_perlawanan SET status='Menunggu Pengesahan' WHERE id=?").bind(jadualId).run();
  }
  if (shouldNotifyCompleteKup) {
    try { await notifyCompleteKupCrew(env, jadualId); } catch (error) {
      console.error('[lantikan.php delete] KUP crew notification error', error instanceof Error ? error.message : error);
    }
  }
  if (record.notif_hantar) {
    const s = (key: string) => String(record[key] ?? '');
    if (record.telegram_chat_id) {
      const delivered = await tgSend(env, Number(record.telegram_chat_id), tgBatalMessage(s('nama'),
        s('jawatan'), s('kejohanan'), s('tarikh'), s('masa'), s('tempat'), s('pasukan_home'),
        s('pasukan_away'), s('no_perlawanan')));
      await recordLantikanAudit(env, id, 'cancellation_notification', 'telegram',
        delivered ? 'success' : 'failed', { reason: 'Lantikan dibuang oleh pentadbir', error: null },
        null, user.role==='PP Daerah' ? 'pp_daerah' : 'admin', user.id, snapshot, meta);
    }
    if (record.email) {
      const delivered = await sendBatalEmail(env, s('email'), s('nama'), s('jawatan'), s('kejohanan'),
        s('tarikh'), s('masa'), s('tempat'), s('pasukan_home'), s('pasukan_away'), s('no_perlawanan'),
        s('logo_home'), s('logo_away'), Boolean(record.pengadil_id));
      await recordLantikanAudit(env, id, 'cancellation_notification', 'email',
        delivered ? 'success' : 'failed', { reason: 'Lantikan dibuang oleh pentadbir',
          recipient: record.email, error: null }, null, user.role==='PP Daerah' ? 'pp_daerah' : 'admin', user.id, snapshot, meta);
    }
  }
  return json({ error: false, message: 'Lantikan dibuang.' });
}

async function batalLantikanByJadual(env: Env, rawIds: number[], status: string, sebab: string,
  actorUserId: number, meta: AuditMeta, actorType: string): Promise<Response> {
  const jadualIds = [...new Set(rawIds.filter((id) => id > 0))];
  if (jadualIds.length === 0) return json({ error: false, message: 'Tiada perlawanan.' });
  const idsJson = JSON.stringify(jadualIds);
  const inIds = '(SELECT value FROM json_each(?))';
  const matches = await env.DB.prepare(`SELECT id,no_perlawanan,tarikh,masa FROM jadual_perlawanan
    WHERE id IN ${inIds}`).bind(idsJson).all<{ tarikh: string; masa: string | null }>();
  if (matches.results.length !== jadualIds.length) {
    return json({ error: true, message: 'Satu atau lebih perlawanan tidak dijumpai.' }, 404);
  }
  if (matches.results.some((match) => hasMatchStarted(String(match.tarikh), String(match.masa ?? '')))) {
    return json({ error: true,
      message: 'Perlawanan yang telah bermula tidak boleh dibatalkan melalui aliran lantikan. Rekod sejarah perlu dikekalkan.' }, 409);
  }
  const records = (await env.DB.prepare(`
    SELECT lp.id,lp.jawatan,lp.notif_hantar,lp.jadual_id,lp.status AS previous_status,
      u.persatuan_id,kj.lantikan_persatuan_id,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
      COALESCE(u.nama_penuh,pl.nama) AS nama, COALESCE(u.email,pl.emel) AS email,
      lp.pengadil_id,jp.no_perlawanan,jp.tarikh,jp.masa,jp.tempat,jp.pasukan_home,jp.pasukan_away,
      jp.logo_home,jp.logo_away,COALESCE(kj.nama,'') AS kejohanan
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON lp.jadual_id=jp.id
    LEFT JOIN kejohanan kj ON jp.kejohanan_id=kj.id
    LEFT JOIN users u ON lp.pengadil_id=u.id
    LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id=pl.id
    WHERE lp.jadual_id IN ${inIds}`).bind(idsJson).all<Record<string, unknown> & { id: number }>()).results;
  const reportSql = `SELECT id FROM laporan_penilaian WHERE jadual_id IN ${inIds} LIMIT 1`;
  const legacySql = `SELECT pp.id FROM penilaian_pengadil pp JOIN perlawanan p ON p.id=pp.perlawanan_id
    JOIN lantikan_pengadil lp ON lp.id=p.lantikan_id WHERE lp.jadual_id IN ${inIds} LIMIT 1`;
  if (await env.DB.prepare(reportSql).bind(idsJson).first()) {
    return json({ error: true, message: 'Perlawanan tidak boleh dibatalkan kerana laporan Penilai Pengadil telah diwujudkan.' }, 409);
  }
  if (await env.DB.prepare(legacySql).bind(idsJson).first()) {
    return json({ error: true, message: 'Perlawanan tidak boleh dibatalkan kerana rekod penilaian pengadil telah wujud.' }, 409);
  }
  const recordIds = JSON.stringify(records.map((record) => record.id));
  const done = await runGuarded(env, [
    guardStatement(env, 'lantikan_batal', `NOT EXISTS(${reportSql}) AND NOT EXISTS(${legacySql})
      AND (SELECT count(*) FROM lantikan_pengadil WHERE jadual_id IN ${inIds})=?`,
    [idsJson, idsJson, idsJson, records.length]),
    // Keep rows for audit, revoke every bearer token, then drop pre-kickoff history.
    env.DB.prepare(`UPDATE lantikan_pengadil SET status=?,sebab_status=?,status_dikemaskini_at=${NOW},
        tg_token=NULL,email_token=NULL,penilaian_token=NULL WHERE jadual_id IN ${inIds}`)
      .bind(status, sebab, idsJson),
    lantikanAuditSelectStatement(env, `lp.id IN ${inIds}`, [recordIds], 'appointment_status_changed',
      'admin', 'success', { new_status: status, reason: sebab }, null, actorType, actorUserId, meta),
    ...jadualIds.flatMap((jadualId) => historySyncStatements(env, jadualId)),
    env.DB.prepare(`UPDATE jadual_perlawanan SET status=?,sebab_status=?,status_dikemaskini_at=${NOW}
      WHERE id IN ${inIds}`).bind(status, sebab, idsJson),
  ]);
  if (!done) return json({ error: true, message: CHANGED }, 409);

  let notifCount = 0;
  for (const r of records) {
    if (!r.notif_hantar) continue;
    const s = (key: string) => String(r[key] ?? '');
    let delivered = false;
    if (r.telegram_chat_id) {
      const telegramDelivered = await tgSend(env, Number(r.telegram_chat_id), tgBatalMessage(s('nama'),
        s('jawatan'), s('kejohanan'), s('tarikh'), s('masa'), s('tempat'), s('pasukan_home'),
        s('pasukan_away'), s('no_perlawanan'), status, sebab));
      delivered = telegramDelivered || delivered;
      await recordLantikanAudit(env, r.id, 'cancellation_notification', 'telegram',
        telegramDelivered ? 'success' : 'failed', { new_status: status, reason: sebab, error: null },
        null, actorType, actorUserId, null, meta);
    }
    if (r.email) {
      const emailDelivered = await sendBatalEmail(env, s('email'), s('nama'), s('jawatan'), s('kejohanan'),
        s('tarikh'), s('masa'), s('tempat'), s('pasukan_home'), s('pasukan_away'), s('no_perlawanan'),
        s('logo_home'), s('logo_away'), Boolean(r.pengadil_id), status, sebab);
      delivered = emailDelivered || delivered;
      await recordLantikanAudit(env, r.id, 'cancellation_notification', 'email',
        emailDelivered ? 'success' : 'failed',
        { new_status: status, reason: sebab, recipient: r.email, error: null },
        null, actorType, actorUserId, null, meta);
    }
    if (r.pengadil_id) {
      await createPortalNotification(env, Number(r.pengadil_id), 'Status Perlawanan',
        `Perlawanan ${status}: ${s('pasukan_home')} lwn ${s('pasukan_away')}`,
        `Lantikan anda sebagai ${s('jawatan')} telah ${status.toLowerCase()}. Sebab: ${sebab}`);
      delivered = true;
    }
    if (delivered) notifCount++;
  }
  // PP Daerah of state tournaments were told about the appointment, so they hear about the cancellation.
  const ppGroups = new Map<string, { persatuanId: number; first: Record<string, unknown>;
    officials: Array<{ nama: string; jawatan: string }> }>();
  for (const r of records) {
    const pid = Number(r.persatuan_id ?? 0);
    if (!r.notif_hantar || r.lantikan_persatuan_id || !pid || !r.pengadil_id
      || !['Belum Jawab', 'Diterima'].includes(String(r.previous_status))) continue;
    const key = `${r.jadual_id}:${pid}`;
    const group = ppGroups.get(key) ?? { persatuanId: pid, first: r, officials: [] };
    group.officials.push({ nama: String(r.nama ?? ''), jawatan: String(r.jawatan ?? '') });
    ppGroups.set(key, group);
  }
  for (const group of ppGroups.values()) {
    try {
      const f = group.first;
      await notifyPPDaerahBatal(env, group.persatuanId, group.officials, status, sebab, {
        kejohanan: String(f.kejohanan ?? ''), tarikh: String(f.tarikh ?? ''), masa: f.masa as string | null,
        tempat: f.tempat as string | null, pasukan_home: String(f.pasukan_home ?? ''),
        pasukan_away: String(f.pasukan_away ?? ''),
      });
    } catch (error) {
      console.error('[lantikan.php batal] PP Daerah notification error', error instanceof Error ? error.message : error);
    }
  }
  let message = `${records.length} lantikan ditanda ${status} untuk ${jadualIds.length} perlawanan.`;
  if (notifCount > 0) message += ` ${notifCount} notifikasi pembatalan dihantar.`;
  return json({ error: false, message });
}

type PendingAssignment = {
  lantikan_id: number; jawatan: string; tg_token: string | null; email_token: string | null;
  telegram_chat_id: number | string | null; tg_link_token: string | null; user_id: number | null;
  luar_id: number | null; nama: string; email: string | null; pengadil_id: number | null;
  persatuan_id: number | null; lantikan_persatuan_id: number | null; no_perlawanan: string | null; tarikh: string; masa: string | null;
  tempat: string | null; pasukan_home: string; pasukan_away: string; logo_home: string | null;
  logo_away: string | null; kejohanan: string; jenis_kejohanan: string;
};

async function pendingAssignments(env: Env, jadualId: number): Promise<PendingAssignment[]> {
  return (await env.DB.prepare(`
    SELECT lp.id AS lantikan_id,lp.jawatan,lp.tg_notif_hantar,lp.tg_token,lp.email_token,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
      COALESCE(u.tg_link_token,pl.tg_link_token) AS tg_link_token,
      u.id AS user_id, pl.id AS luar_id,
      COALESCE(u.nama_penuh,pl.nama) AS nama, COALESCE(u.email,pl.emel) AS email,
      lp.pengadil_id,u.persatuan_id,kj.lantikan_persatuan_id,jp.no_perlawanan,jp.tarikh,jp.masa,jp.tempat,
      jp.pasukan_home,jp.pasukan_away,jp.kejohanan_id,jp.logo_home,jp.logo_away,
      COALESCE(kj.nama,'') AS kejohanan,
      COALESCE(kj.jenis_kejohanan,'Persahabatan') AS jenis_kejohanan
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON lp.jadual_id=jp.id
    LEFT JOIN kejohanan kj ON jp.kejohanan_id=kj.id
    LEFT JOIN users u ON lp.pengadil_id=u.id
    LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id=pl.id
    WHERE lp.jadual_id=? AND lp.status='Belum Jawab'`).bind(jadualId).all<PendingAssignment>()).results;
}

function awaitingTelegram(assignments: PendingAssignment[]): string[] {
  return assignments.filter((a) => a.user_id != null &&
    !String(a.telegram_chat_id ?? '').trim())
    .map((a) => a.nama);
}

type DispatchTotals = { tgSent: number; tgSkipped: number; emailSent: number; delivered: number; failed: number };

/** Body of the per-assignment loop shared by notify and notify_all. */
async function dispatchMatch(env: Env, jadualId: number, assignments: PendingAssignment[],
  actorId: number, meta: AuditMeta, totals: DispatchTotals, ppNotified: Set<string>, actorType: string): Promise<void> {
  const roster = await getMatchKupOfficials(env, jadualId);
  const allOfficials = roster.officials;
  const regionLabel = roster.region_label;
  const logoHome = assignments[0]?.logo_home ?? '';
  const logoAway = assignments[0]?.logo_away ?? '';
  const botUsername = env.TELEGRAM_BOT_USERNAME || 'refpahang_bot';
  const ppOfficials = new Map<number, Array<{ nama: string; jawatan: string }>>();
  for (const a of assignments) {
    // Reuse tokens so earlier email/Telegram links stay valid when re-sent.
    const tgToken = a.tg_token ? a.tg_token : randomHex(16);
    const emailToken = a.email_token ? a.email_token : randomHex(16);
    let tgLinkToken = a.tg_link_token;
    if (!tgLinkToken && !a.telegram_chat_id) {
      tgLinkToken = randomHex(16);
      if (a.user_id) {
        await env.DB.prepare('UPDATE users SET tg_link_token=? WHERE id=?').bind(tgLinkToken, a.user_id).run();
      } else {
        await env.DB.prepare('UPDATE pengadil_luar SET tg_link_token=? WHERE id=?').bind(tgLinkToken, a.luar_id).run();
      }
    }
    await env.DB.prepare('UPDATE lantikan_pengadil SET tg_token=?,email_token=? WHERE id=?')
      .bind(tgToken, emailToken, a.lantikan_id).run();
    const snapshot = await getLantikanAuditSnapshot(env, a.lantikan_id);
    if (!snapshot) throw new Error('Snapshot audit lantikan tidak dijumpai.');
    const links = buildAppointmentDirectLinks(env, emailToken);
    const audit = (eventType: string, channel: string, status: string, details: Record<string, unknown>,
      linkUrl: string | null) => recordLantikanAudit(env, a.lantikan_id, eventType, channel, status,
      details, linkUrl, actorType, actorId, snapshot, meta);
    await audit('appointment_links_prepared', 'system', 'success', links, links.accept_url);

    let tgDelivered = false;
    let emailDelivered = false;
    if (a.telegram_chat_id) {
      tgDelivered = await tgSend(env, Number(a.telegram_chat_id), tgLantikanMessage(a.nama, a.jawatan,
        a.kejohanan, a.tarikh, a.masa ?? '', a.tempat ?? '', a.pasukan_home, a.pasukan_away,
        a.no_perlawanan ?? '', a.jenis_kejohanan ?? 'Persahabatan', allOfficials, regionLabel),
        tgLantikanKeyboard(tgToken));
      if (tgDelivered) totals.tgSent++; else totals.tgSkipped++;
      await audit('appointment_notification', 'telegram', tgDelivered ? 'success' : 'failed', {
        telegram_linked: true, callback_buttons: ['accept', 'reject'], error: null,
      }, null);
    } else {
      totals.tgSkipped++;
      const link = tgLinkToken ? buildTelegramLink(env, tgLinkToken) : null;
      await audit('appointment_notification', 'telegram', 'skipped',
        { reason: 'telegram_not_linked', telegram_link_url: link }, link);
    }
    if (a.email) {
      const tgLinkUrl = tgLinkToken && !a.telegram_chat_id ? `https://t.me/${botUsername}?start=${tgLinkToken}` : null;
      emailDelivered = await sendLantikanEmail(env, a.email, a.nama, a.jawatan, a.kejohanan, a.tarikh,
        a.masa ?? '', a.tempat ?? '', a.pasukan_home, a.pasukan_away, emailToken, tgLinkUrl,
        Boolean(a.pengadil_id), a.no_perlawanan ?? '', logoHome ?? '', logoAway ?? '', allOfficials,
        a.jenis_kejohanan ?? 'Persahabatan', regionLabel);
      if (emailDelivered) totals.emailSent++;
      await audit('appointment_notification', 'email', emailDelivered ? 'success' : 'failed', {
        recipient: a.email, accept_url: links.accept_url, reject_url: links.reject_url, error: null,
      }, links.accept_url);
    } else {
      await audit('appointment_notification', 'email', 'skipped', { reason: 'email_missing' }, links.accept_url);
    }

    // Portal is supplemental; the deadline starts only after Telegram or email works.
    let deliveryRecorded = false;
    if (tgDelivered || emailDelivered) {
      deliveryRecorded = await markAppointmentExternallyDelivered(env, a.lantikan_id, tgDelivered, emailDelivered);
      if (deliveryRecorded) totals.delivered++;
      await audit('appointment_dispatched', 'combined', deliveryRecorded ? 'success' : 'failed', {
        telegram_success: tgDelivered, email_success: emailDelivered, deadline_started: deliveryRecorded,
      }, links.accept_url);
      if (deliveryRecorded && a.user_id) {
        try {
          await notifyLantikanPortal(env, a.user_id, a.jawatan, a.kejohanan, a.tarikh, a.pasukan_home, a.pasukan_away);
        } catch (error) {
          console.error('[lantikan.php notify] Portal notification error', error instanceof Error ? error.message : error);
        }
      }
    } else {
      totals.failed++;
      await audit('appointment_dispatched', 'combined', 'failed', {
        telegram_success: false, email_success: false, deadline_started: false,
      }, links.accept_url);
    }
    // PP Daerah of state tournaments hear once per match, with all their officials listed.
    const pid = Number(a.persatuan_id ?? 0);
    if (deliveryRecorded && !a.lantikan_persatuan_id && pid && !ppNotified.has(`${jadualId}:${pid}`)) {
      const district = ppOfficials.get(pid) ?? [];
      district.push({ nama: a.nama, jawatan: a.jawatan });
      ppOfficials.set(pid, district);
    }
  }
  const first = assignments[0];
  for (const [pid, officials] of ppOfficials) {
    try {
      await notifyPPDaerahLantikan(env, pid, officials, first.kejohanan, first.tarikh, first.masa ?? '',
        first.tempat ?? '', first.pasukan_home, first.pasukan_away);
      ppNotified.add(`${jadualId}:${pid}`);
    } catch (error) {
      console.error('[lantikan.php notify] PP Daerah notification error', error instanceof Error ? error.message : error);
    }
  }
}

async function notifyMatch(env: Env, input: Record<string, unknown>, user: User, meta: AuditMeta): Promise<Response> {
  const jadualId = phpInt(input.jadual_id);
  if (!jadualId) return json({ error: true, message: 'jadual_id diperlukan.' }, 400);
  const timing = await getJadualTiming(env, jadualId);
  if (!timing) return json({ error: true, message: 'Perlawanan tidak dijumpai.' }, 404);
  if (['Dibatalkan', 'Ditangguhkan'].includes(String(timing.status ?? ''))) {
    return json({ error: true, message: 'Lantikan tidak boleh dihantar untuk perlawanan yang dibatalkan atau ditangguhkan.' }, 409);
  }
  if (hasMatchStarted(String(timing.tarikh), String(timing.masa ?? ''))) {
    return json({ error: true, message: matchStartedMessage(String(timing.tarikh), String(timing.masa ?? '')) }, 409);
  }
  // Expired rows must not be revived by a re-send.
  await autoTolakLantikanTertunggak(env, { jadual_id: jadualId }, meta);
  const slots = await getAppointmentSlotValidation(env, jadualId);
  if (!slots.valid) {
    return json({ error: true,
      message: `Lantikan belum boleh dihantar. Slot wajib belum lengkap: ${slots.missing.join(', ')}.`,
      missing_positions: slots.missing }, 409);
  }
  const renotify = await env.DB.prepare(`SELECT COUNT(*) AS n FROM lantikan_pengadil
    WHERE jadual_id=? AND notif_hantar=1 AND status='Belum Jawab'`).bind(jadualId).first<{ n: number }>();
  const renotifyCount = Number(renotify?.n ?? 0);
  const assignments = await pendingAssignments(env, jadualId);
  if (assignments.length === 0) {
    return json({ error: true, message: 'Tiada pengadil dengan status Belum Jawab.' }, 400);
  }
  const unlinked = awaitingTelegram(assignments);
  if (unlinked.length) return json({ error: true, telegram_link_required: true,
    message: `Notifikasi belum boleh dihantar. Pegawai perlu menghubungkan Telegram: ${unlinked.join(', ')}.` }, 409);
  const totals: DispatchTotals = { tgSent: 0, tgSkipped: 0, emailSent: 0, delivered: 0, failed: 0 };
  await dispatchMatch(env, jadualId, assignments, user.id, meta, totals, new Set(), user.role==='PP Daerah' ? 'pp_daerah' : 'admin');
  const dispatchComplete = await markMatchDispatchedIfComplete(env, jadualId);
  if (!dispatchComplete) {
    await env.DB.prepare("UPDATE jadual_perlawanan SET status='Menunggu Pengesahan' WHERE id=?").bind(jadualId).run();
  }
  const parts = [`Notifikasi berjaya dihantar kepada ${totals.delivered} pegawai.`];
  if (totals.emailSent > 0) parts.push(`${totals.emailSent} emel dihantar.`);
  if (totals.tgSent > 0) parts.push(`${totals.tgSent} notifikasi Telegram dihantar.`);
  if (totals.tgSkipped > 0) parts.push(`${totals.tgSkipped} pegawai tidak menerima notifikasi Telegram; saluran emel digunakan jika berjaya.`);
  if (renotifyCount > 0) parts.push(`Nota: ${renotifyCount} pengadil dihantar semula (pautan asal masih sah; tempoh jawapan dikira semula dari notifikasi terbaru).`);
  if (totals.failed > 0) parts.push(`${totals.failed} lantikan gagal dihantar dan tempoh jawapannya belum bermula.`);
  return json({
    error: false, message: parts.join(' '), tg_sent: totals.tgSent, tg_skipped: totals.tgSkipped,
    email_sent: totals.emailSent, delivery_failed: totals.failed, appointment_complete: dispatchComplete,
    renotify_count: renotifyCount,
  });
}

async function notifyAll(env: Env, input: Record<string, unknown>, user: User, meta: AuditMeta): Promise<Response> {
  const kejohananId = phpInt(input.kejohanan_id);
  if (!kejohananId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
  const filterIds = !phpEmpty(input.jadual_ids) && Array.isArray(input.jadual_ids)
    ? input.jadual_ids.map(phpInt) : [];
  await autoTolakLantikanTertunggak(env, { kejohanan_id: kejohananId }, meta);
  const rows = filterIds.length > 0
    ? await env.DB.prepare(`SELECT DISTINCT jp.id,jp.tarikh,jp.masa FROM jadual_perlawanan jp
        JOIN lantikan_pengadil lp ON lp.jadual_id=jp.id
        WHERE jp.kejohanan_id=? AND lp.status='Belum Jawab'
          AND jp.id IN (SELECT value FROM json_each(?))
        ORDER BY jp.tarikh ASC,jp.masa ASC`).bind(kejohananId, JSON.stringify(filterIds))
      .all<{ id: number; tarikh: string; masa: string | null }>()
    : await env.DB.prepare(`SELECT DISTINCT jp.id,jp.tarikh,jp.masa FROM jadual_perlawanan jp
        JOIN lantikan_pengadil lp ON lp.jadual_id=jp.id
        WHERE jp.kejohanan_id=? AND lp.status='Belum Jawab'
        ORDER BY jp.tarikh ASC,jp.masa ASC`).bind(kejohananId)
      .all<{ id: number; tarikh: string; masa: string | null }>();
  let startedMatchCount = 0;
  const jadualIds: number[] = [];
  for (const row of rows.results) {
    if (hasMatchStarted(String(row.tarikh), String(row.masa ?? ''))) { startedMatchCount++; continue; }
    jadualIds.push(Number(row.id));
  }
  if (jadualIds.length === 0) {
    return json({ error: true, message: startedMatchCount > 0
      ? `Notifikasi tidak dihantar: ${startedMatchCount} perlawanan yang dipilih telah bermula.`
      : 'Tiada pengadil dengan status Belum Jawab untuk dihantar notifikasi.' }, 400);
  }
  const totals: DispatchTotals = { tgSent: 0, tgSkipped: 0, emailSent: 0, delivered: 0, failed: 0 };
  let totalRenotify = 0;
  let matchesProcessed = 0;
  let incompleteMatchCount = 0;
  let telegramPendingMatchCount = 0;
  const ppNotified = new Set<string>();
  // Each official costs about a dozen D1 queries plus an SMTP session, and a
  // Worker request allows 1,000 D1 queries: send in batches and return the rest.
  const OFFICIALS_PER_REQUEST = 40;
  let officialsDispatched = 0;
  let remaining: number[] = [];
  for (const [index, jadualId] of jadualIds.entries()) {
    if (officialsDispatched >= OFFICIALS_PER_REQUEST) { remaining = jadualIds.slice(index); break; }
    if (!(await getAppointmentSlotValidation(env, jadualId)).valid) { incompleteMatchCount++; continue; }
    const renotify = await env.DB.prepare(`SELECT COUNT(*) AS n FROM lantikan_pengadil
      WHERE jadual_id=? AND notif_hantar=1 AND status='Belum Jawab'`).bind(jadualId).first<{ n: number }>();
    totalRenotify += Number(renotify?.n ?? 0);
    const assignments = await pendingAssignments(env, jadualId);
    if (assignments.length === 0) continue;
    if (awaitingTelegram(assignments).length) { telegramPendingMatchCount++; continue; }
    await dispatchMatch(env, jadualId, assignments, user.id, meta, totals, ppNotified, user.role==='PP Daerah' ? 'pp_daerah' : 'admin');
    officialsDispatched += assignments.length;
    if (!(await markMatchDispatchedIfComplete(env, jadualId))) {
      await env.DB.prepare("UPDATE jadual_perlawanan SET status='Menunggu Pengesahan' WHERE id=?").bind(jadualId).run();
    }
    matchesProcessed++;
  }
  const parts = [`${totals.delivered} notifikasi dihantar untuk ${matchesProcessed} perlawanan.`];
  if (totals.emailSent > 0) parts.push(`${totals.emailSent} emel dihantar.`);
  if (totals.tgSent > 0) parts.push(`${totals.tgSent} Telegram dihantar.`);
  if (totals.tgSkipped > 0) parts.push(`${totals.tgSkipped} pegawai tidak menerima notifikasi Telegram; saluran emel digunakan jika berjaya.`);
  if (totalRenotify > 0) parts.push(`Nota: ${totalRenotify} pengadil dihantar semula (pautan asal masih sah; tempoh jawapan dikira semula dari notifikasi terbaru).`);
  if (startedMatchCount > 0) parts.push(`${startedMatchCount} perlawanan yang telah bermula dilangkau.`);
  if (incompleteMatchCount > 0) parts.push(`${incompleteMatchCount} perlawanan tanpa Pengadil, AR1 dan AR2 lengkap dilangkau.`);
  if (telegramPendingMatchCount > 0) parts.push(`${telegramPendingMatchCount} perlawanan dilangkau kerana pengadil belum menghubungkan Telegram.`);
  if (totals.failed > 0) parts.push(`${totals.failed} lantikan gagal dihantar dan tempoh jawapannya belum bermula.`);
  if (remaining.length > 0) parts.push(`${remaining.length} perlawanan lagi sedang dihantar.`);
  return json({
    error: false, message: parts.join(' '), total_assignments: totals.delivered,
    remaining_jadual_ids: remaining,
    matches_processed: matchesProcessed, email_sent: totals.emailSent, tg_sent: totals.tgSent,
    tg_skipped: totals.tgSkipped, delivery_failed: totals.failed,
    matches_skipped_incomplete: incompleteMatchCount, matches_skipped_started: startedMatchCount,
    matches_skipped_telegram: telegramPendingMatchCount,
  });
}
