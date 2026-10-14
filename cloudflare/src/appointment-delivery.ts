import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import type { Env } from './types';

type Channel = 'email' | 'telegram';
type Kind = 'admin_response' | 'pp_response' | 'ra_form' | 'kup_crew';

interface Delivery {
  delivery_key: string;
  event_key: string;
  kind: Kind;
  channel: Channel;
  recipient_user_id: number | null;
  recipient_lantikan_id: number | null;
  crew_key: string | null;
  attempts: number;
}

interface Context {
  response_status: string;
  nama_pegawai: string;
  jawatan: string;
  comment: string | null;
  jadual_id: number;
  tarikh: string;
  masa: string;
  tempat: string | null;
  no_perlawanan: string;
  pasukan_home: string;
  pasukan_away: string;
  kejohanan: string;
  peringkat_kejohanan: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_chat_id: number | null;
  recipient_role: string | null;
  recipient_active: number | null;
  official_persatuan_id: number | null;
  recipient_persatuan_id: number | null;
  recipient_appointment_status: string | null;
  penilaian_token: string | null;
}

interface CrewMember {
  id: number;
  jawatan: string;
  status: string;
  nama: string;
  no_telefon: string;
  wilayah: string;
}

export interface DeliverySenders {
  email?: (env: Env, to: string, name: string, subject: string,
    html: string, text: string) => Promise<unknown>;
  telegram?: (env: Env, chatId: number, html: string, url?: string) => Promise<unknown>;
}

function escapeTelegram(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

async function sendTelegram(env: Env, chatId: number, html: string, url?: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot secret is not configured');
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text: html, parse_mode: 'HTML',
      ...(url ? { reply_markup: { inline_keyboard: [[{ text: 'Isi Borang Penilaian', url }]] } } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  const result = await response.json() as { ok?: boolean };
  if (!result.ok) throw new Error('Telegram did not confirm delivery');
}

function fullCrew(members: CrewMember[]): boolean {
  if (members.length < 3 || members.length > 4) return false;
  const roles = new Set(members.map((member) => member.jawatan));
  return roles.size === members.length && members.every((member) => member.status === 'Diterima')
    && ['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2'].every((role) => roles.has(role));
}

async function contextFor(env: Env, job: Delivery): Promise<Context | null> {
  return env.DB.prepare(`
    SELECT o.response_status,a.nama_pegawai,a.jawatan,
      json_extract(a.details_json,'$.comment') AS comment,
      jp.id AS jadual_id,jp.tarikh,jp.masa,jp.tempat,jp.no_perlawanan,
      jp.pasukan_home,jp.pasukan_away,COALESCE(k.nama,'') AS kejohanan,
      k.peringkat_kejohanan,
      COALESCE(u.nama_penuh,pl.nama) AS recipient_name,
      COALESCE(u.email,pl.emel) AS recipient_email,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS recipient_chat_id,
      u.role AS recipient_role,u.aktif AS recipient_active,
      owner.persatuan_id AS official_persatuan_id,
      u.persatuan_id AS recipient_persatuan_id,
      lp.status AS recipient_appointment_status,lp.penilaian_token
    FROM worker_appointment_outbox o
    JOIN lantikan_audit_log a ON a.event_key=o.event_key
    JOIN jadual_perlawanan jp ON jp.id=o.jadual_id
    LEFT JOIN kejohanan k ON k.id=jp.kejohanan_id
    LEFT JOIN lantikan_pengadil lp ON lp.id=?
    LEFT JOIN lantikan_pengadil source_lp ON source_lp.id=o.lantikan_id
    LEFT JOIN users owner ON owner.id=source_lp.pengadil_id
    LEFT JOIN users u ON u.id=COALESCE(?,lp.pengadil_id)
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE o.event_key=? LIMIT 1
  `).bind(job.recipient_lantikan_id,job.recipient_user_id,job.event_key).first<Context>();
}

async function crewFor(env: Env, jadualId: number): Promise<CrewMember[]> {
  const result = await env.DB.prepare(`
    SELECT lp.id,lp.jawatan,lp.status,
      COALESCE(NULLIF(trim(u.nama_penuh),''),NULLIF(trim(pl.nama),''),'Nama tidak direkodkan') AS nama,
      COALESCE(NULLIF(trim(u.no_telefon),''),NULLIF(trim(pl.no_tel),''),'-') AS no_telefon,
      CASE WHEN COALESCE(k.peringkat_kejohanan,'Daerah')='Negeri'
        THEN COALESCE(NULLIF(trim(u.daerah),''),NULLIF(trim(pl.daerah),''),'-')
        ELSE COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),'-') END AS wilayah
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN kejohanan k ON k.id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.jadual_id=? AND lp.jawatan IN
      ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')
      AND lp.status IN ('Belum Jawab','Diterima')
    ORDER BY CASE lp.jawatan WHEN 'Pengadil' THEN 1
      WHEN 'Penolong Pengadil 1' THEN 2
      WHEN 'Penolong Pengadil 2' THEN 3 ELSE 4 END,lp.id
  `).bind(jadualId).all<CrewMember>();
  return result.results;
}

function makeMessage(env: Env, job: Delivery, row: Context, crew: CrewMember[]):
  { subject: string; text: string[]; action?: { label: string; url: string } } {
  const match = `${row.pasukan_home} lwn ${row.pasukan_away}`;
  const date = row.tarikh.slice(0,10);
  if (job.kind === 'ra_form') {
    const url = `${env.BASE_URL.replace(/\/$/,'')}/penilaian-borang.html?token=${encodeURIComponent(row.penilaian_token ?? '')}`;
    return {
      subject: `Borang Penilaian Pengadil — ${match}`,
      text: [`Anda telah menerima tugasan sebagai Penilai Pengadil untuk ${match} (${row.kejohanan}) pada ${date}.`,
        `Sila isi borang penilaian selepas perlawanan. Pautan ini unik untuk anda dan tidak boleh dikongsi.`],
      action: { label: 'Isi Borang Penilaian', url },
    };
  }
  if (job.kind === 'kup_crew') {
    const region = row.peringkat_kejohanan === 'Negeri' ? 'Daerah' : 'Negeri';
    const roster = crew.map((member) =>
      `${member.jawatan}: ${member.nama} · ${member.no_telefon} · ${region}: ${member.wilayah}`);
    return {
      subject: `Krew KUP Lengkap — ${match}`,
      text: [`Semua KUP telah menerima lantikan untuk ${match} (${row.kejohanan}) pada ${date} ${row.masa.slice(0,5)} di ${row.tempat ?? '-'}.`,
        'Senarai krew:', ...roster],
    };
  }
  const verb = row.response_status === 'Diterima' ? 'menerima' : 'menolak';
  const reason = row.response_status === 'Ditolak' && row.comment ? ` Sebab: ${row.comment}` : '';
  return {
    subject: `Lantikan ${row.response_status} — ${row.nama_pegawai}`,
    text: [`${row.nama_pegawai} telah ${verb} lantikan sebagai ${row.jawatan} untuk ${match} (${row.kejohanan}) pada ${date}.${reason}`],
  };
}

async function complete(env: Env, job: Delivery, status: 'sent' | 'skipped' | 'pending',
  error = ''): Promise<boolean> {
  const retrySeconds = Math.min(3600,60 * 2 ** Math.min(Math.max(job.attempts,0),6));
  const result = await env.DB.batch([
    env.DB.prepare(`
      UPDATE worker_appointment_deliveries
      SET status=?,claimed_at=NULL,
        completed_at=CASE WHEN ?='pending' THEN NULL ELSE datetime('now','+8 hours') END,
        next_attempt_at=CASE WHEN ?='pending' THEN datetime('now','+8 hours',?) ELSE NULL END,
        last_error=?
      WHERE delivery_key=? AND status='pending' AND attempts=? AND claimed_at IS NOT NULL
    `).bind(status,status,status,`+${retrySeconds} seconds`,error.slice(0,500) || null,
      job.delivery_key,job.attempts),
    env.DB.prepare(`
      UPDATE worker_appointment_outbox SET completed_at=datetime('now','+8 hours')
      WHERE event_key=? AND NOT EXISTS (
        SELECT 1 FROM worker_appointment_deliveries
        WHERE event_key=? AND status='pending'
      ) AND ?<>'pending'
    `).bind(job.event_key,job.event_key,status),
  ]);
  return result[0].meta.changes === 1;
}

/** At-least-once delivery, scoped strictly to Worker-created jobs. */
export async function processAppointmentDeliveries(env: Env, limit = 20,
  senders: DeliverySenders = {}): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  if (env.APPOINTMENT_DELIVERY_ENABLED !== '1' ||
      env.STAGING_AUTH_ENABLED !== '1' || env.STAGING_WRITES_ENABLED !== '1') {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const capped = Math.max(1,Math.min(limit,50));
  const pending = await env.DB.prepare(`
    SELECT delivery_key,event_key,kind,channel,recipient_user_id,
      recipient_lantikan_id,crew_key,attempts
    FROM worker_appointment_deliveries
    WHERE status='pending'
      AND (next_attempt_at IS NULL OR next_attempt_at<=datetime('now','+8 hours'))
      AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-5 minutes'))
    ORDER BY created_at,delivery_key LIMIT ?
  `).bind(capped).all<Delivery>();
  const counts = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  for (const candidate of pending.results) {
    const claimed = await env.DB.prepare(`
      UPDATE worker_appointment_deliveries
      SET claimed_at=datetime('now','+8 hours'),attempts=attempts+1
      WHERE delivery_key=? AND status='pending'
        AND (next_attempt_at IS NULL OR next_attempt_at<=datetime('now','+8 hours'))
        AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-5 minutes'))
    `).bind(candidate.delivery_key).run();
    if (claimed.meta.changes !== 1) continue;
    const job = { ...candidate, attempts: candidate.attempts + 1 };
    counts.processed++;
    try {
      const row = await contextFor(env,job);
      if (!row) { await complete(env,job,'skipped','Record no longer exists'); counts.skipped++; continue; }
      let crew: CrewMember[] = [];
      if (job.kind === 'kup_crew') {
        crew = await crewFor(env,row.jadual_id);
        const key = crew.map((member) => `${member.jawatan}:${member.id}`).join('|');
        if (!fullCrew(crew) || key !== job.crew_key) {
          await complete(env,job,'skipped','Crew changed after response'); counts.skipped++; continue;
        }
      }
      if (job.kind === 'ra_form' &&
        (row.recipient_appointment_status !== 'Diterima' || !row.penilaian_token)) {
        await complete(env,job,'skipped','RA form token no longer active'); counts.skipped++; continue;
      }
      if (job.kind === 'kup_crew' && row.recipient_appointment_status !== 'Diterima') {
        await complete(env,job,'skipped','KUP appointment no longer accepted'); counts.skipped++; continue;
      }
      if ((job.kind === 'admin_response' || job.kind === 'pp_response') &&
        (row.recipient_active !== 1 || row.recipient_role !==
          (job.kind === 'admin_response' ? 'Admin' : 'PP Daerah') ||
          (job.kind === 'pp_response' && row.recipient_persatuan_id !== row.official_persatuan_id))) {
        await complete(env,job,'skipped','Recipient no longer has role'); counts.skipped++; continue;
      }
      const message = makeMessage(env,job,row,crew);
      const recipientName = row.recipient_name || 'Pengguna';
      if (job.channel === 'email') {
        const address = row.recipient_email?.trim();
        if (!address) { await complete(env,job,'skipped','Email missing'); counts.skipped++; continue; }
        const content = buildRefpahangEmail(message.subject,recipientName,message.text,message.action);
        if (senders.email) await senders.email(env,address,recipientName,message.subject,content.html,content.text);
        else await sendRefpahangEmail(env,'lantikan',address,recipientName,message.subject,content.html,content.text);
      } else {
        if (!row.recipient_chat_id) {
          await complete(env,job,'skipped','Telegram unlinked'); counts.skipped++; continue;
        }
        const html = `<b>${escapeTelegram(message.subject)}</b>\n\n${message.text.map(escapeTelegram).join('\n\n')}`;
        if (senders.telegram) await senders.telegram(env,row.recipient_chat_id,html,message.action?.url);
        else await sendTelegram(env,row.recipient_chat_id,html,message.action?.url);
      }
      if (await complete(env,job,'sent')) counts.sent++;
    } catch (error) {
      // Never log a token, recipient address or raw provider response.
      console.error('Appointment delivery failed', job.kind, job.channel,
        error instanceof Error ? error.name : 'UnknownError');
      await complete(env,job,'pending','Penghantaran gagal; percubaan semula dijadualkan.');
      counts.failed++;
    }
  }
  await env.DB.prepare(`
    UPDATE worker_appointment_outbox SET completed_at=datetime('now','+8 hours')
    WHERE completed_at IS NULL AND NOT EXISTS (
      SELECT 1 FROM worker_appointment_deliveries d
      WHERE d.event_key=worker_appointment_outbox.event_key AND d.status='pending'
    )
  `).run();
  return counts;
}
