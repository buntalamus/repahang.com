import { currentUser, json } from './auth';
import type { Env } from './types';

interface Snapshot {
  lantikan_id: number;
  jadual_id: number;
  pengadil_luar_id: number | null;
  jawatan: string;
  status: string;
  komen: string | null;
  notif_hantar: number | null;
  tg_notif_hantar: number | null;
  tarikh_notif: string | null;
  email_token: string | null;
  penilaian_token: string | null;
  tg_link_token: string | null;
  telegram_chat_id: number | null;
  nama_pegawai: string;
  emel_pegawai: string;
  jadual_status: string;
}

interface AuditEvent {
  id: number;
  event_type: string;
  channel: string;
  event_status: string;
  link_url: string | null;
  details_json: string | null;
  actor_type: string;
  actor_user_id: number | null;
  ip_address: string | null;
  created_at: string;
}

const KUP_ROLES = new Set(['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4']);
const AUTO_REJECT_COMMENT = 'Ditolak automatik - tiada jawapan dalam tempoh';

function details(raw: string | null): Record<string,unknown> | unknown[] {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' ? value as Record<string,unknown> : {};
  } catch { return {}; }
}

/** The audit panel is read-only until all four PHP admin actions are ported. */
export async function appointmentAudit(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request,env);
  if (!user) return json({error:true,message:'Sila log masuk.'},401);
  if (user.role !== 'Admin') return json({error:true,message:'Akses ditolak.'},403);
  if (request.method === 'POST') {
    return json({error:true,message:'Tindakan audit lantikan belum tersedia di staging.'},503);
  }
  if (request.method !== 'GET') {
    return json({error:true,message:'Kaedah tidak disokong.'},405);
  }
  const rawId = new URL(request.url).searchParams.get('lantikan_id');
  const id = Number(rawId);
  if (!rawId || !/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) {
    return json({error:true,message:'lantikan_id diperlukan.'},400);
  }
  const snapshot = await env.DB.prepare(`
    SELECT lp.id AS lantikan_id,lp.jadual_id,lp.pengadil_luar_id,
      lp.jawatan,lp.status,lp.komen,lp.notif_hantar,lp.tg_notif_hantar,
      lp.tarikh_notif,lp.email_token,lp.penilaian_token,
      COALESCE(u.nama_penuh,pl.nama,'') AS nama_pegawai,
      COALESCE(u.email,pl.emel,'') AS emel_pegawai,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
      COALESCE(u.tg_link_token,pl.tg_link_token) AS tg_link_token,
      jp.status AS jadual_status
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.id=? LIMIT 1
  `).bind(id).first<Snapshot>();
  if (!snapshot) return json({error:true,message:'Lantikan tidak dijumpai.'},404);
  const events = await env.DB.prepare(`
    SELECT id,event_type,channel,event_status,link_url,details_json,
      actor_type,actor_user_id,ip_address,created_at
    FROM lantikan_audit_log WHERE lantikan_id=? ORDER BY id DESC LIMIT 100
  `).bind(id).all<AuditEvent>();
  const base = env.BASE_URL.replace(/\/$/,'');
  const emailToken = snapshot.status === 'Belum Jawab' ? snapshot.email_token?.trim() : null;
  const raToken = snapshot.status === 'Diterima' && snapshot.jawatan === 'Penilai Pengadil'
    ? snapshot.penilaian_token?.trim() : null;
  const telegramToken = !snapshot.telegram_chat_id ? snapshot.tg_link_token?.trim() : null;
  const emailLink = emailToken
    ? `${base}/api/lantikan-jawab-token.php?token=${encodeURIComponent(emailToken)}` : null;
  const isRejected = snapshot.status === 'Ditolak';
  const isAutoRejected = isRejected && snapshot.komen === AUTO_REJECT_COMMENT;
  const isManualKupRejected = isRejected && !isAutoRejected && KUP_ROLES.has(snapshot.jawatan);
  return json({error:false,data:{
    lantikan:{
      id:snapshot.lantikan_id,jadual_id:snapshot.jadual_id,
      jawatan:snapshot.jawatan,status:snapshot.status,nama_pegawai:snapshot.nama_pegawai,
      is_external:snapshot.pengadil_luar_id !== null,
      email_available:snapshot.emel_pegawai.trim() !== '',
      telegram_linked:!!snapshot.telegram_chat_id,
      notif_hantar:Number(snapshot.notif_hantar ?? 0),
      tg_notif_hantar:Number(snapshot.tg_notif_hantar ?? 0),
      tarikh_notif:snapshot.tarikh_notif,
      can_admin_override_acceptance:!['Dibatalkan','Ditangguhkan'].includes(snapshot.jadual_status)
        && (isAutoRejected || isManualKupRejected),
    },
    links:{
      accept_url:emailLink ? `${emailLink}&action=accept` : null,
      reject_url:emailLink ? `${emailLink}&action=reject` : null,
      ra_form_url:raToken
        ? `${base}/penilaian-borang.html?token=${encodeURIComponent(raToken)}` : null,
      telegram_link_url:telegramToken && env.TELEGRAM_BOT_USERNAME
        ? `https://t.me/${encodeURIComponent(env.TELEGRAM_BOT_USERNAME.replace(/^@/,''))}?start=${encodeURIComponent(telegramToken)}` : null,
    },
    events:events.results.map(({details_json,...event})=>({...event,details:details(details_json)})),
  }});
}
