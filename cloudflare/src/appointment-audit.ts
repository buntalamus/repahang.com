import { currentUser, json } from './auth';
import { activeOfficialSql, MATCH_YEAR_SQL } from './appointment-eligibility';
import { notifyAcceptanceOverride } from './lantikan-notify';
import { boundedJson } from './request';
import type { Env } from './types';
import { guardStatement, runGuarded } from './php/guard';
import { auditMetaFrom, getLantikanAuditSnapshot, lantikanAuditStatement } from './php/lantikan-audit';
import { createPortalNotification, generatePenilaianToken, historySyncStatements,
  isAcceptedKupCrewComplete, isKupPosition, markMatchDispatchedIfComplete,
  notifyCompleteKupCrew } from './php/lantikan-helper';
import { wroteRow } from './d1-changes';

interface Snapshot {
  lantikan_id: number;
  jadual_id: number;
  kejohanan_id: number | null;
  pengadil_id: number | null;
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
  no_telefon_pegawai: string;
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

/** is_array(json_decode(...)) ? ... : [] */
function details(raw: string | null): Record<string,unknown> | unknown[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' ? value as Record<string,unknown> : [];
  } catch { return []; }
}

function positiveId(raw: unknown): number | null {
  const value = String(raw ?? '');
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function loadSnapshot(env: Env, id: number): Promise<Snapshot | null> {
  return env.DB.prepare(`
    SELECT lp.id AS lantikan_id,lp.jadual_id,jp.kejohanan_id,
      lp.pengadil_id,lp.pengadil_luar_id,lp.jawatan,lp.status,lp.komen,
      lp.notif_hantar,lp.tg_notif_hantar,lp.tarikh_notif,
      lp.email_token,lp.penilaian_token,
      COALESCE(u.nama_penuh,pl.nama,'') AS nama_pegawai,
      COALESCE(u.email,pl.emel,'') AS emel_pegawai,
      COALESCE(u.no_telefon,pl.no_tel,'') AS no_telefon_pegawai,
      COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
      COALESCE(u.tg_link_token,pl.tg_link_token) AS tg_link_token,
      jp.status AS jadual_status
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.id=? LIMIT 1
  `).bind(id).first<Snapshot>();
}

function activeLinks(env: Env, snapshot: Snapshot): Record<string,string | null> {
  const base = env.BASE_URL.replace(/\/$/,'');
  const emailToken = snapshot.status === 'Belum Jawab' ? snapshot.email_token?.trim() : null;
  const raToken = snapshot.status === 'Diterima' && snapshot.jawatan === 'Penilai Pengadil'
    ? snapshot.penilaian_token?.trim() : null;
  const telegramToken = !snapshot.telegram_chat_id ? snapshot.tg_link_token?.trim() : null;
  const emailLink = emailToken
    ? `${base}/api/lantikan-jawab-token.php?token=${encodeURIComponent(emailToken)}` : null;
  return {
    accept_url: emailLink ? `${emailLink}&action=accept` : null,
    reject_url: emailLink ? `${emailLink}&action=reject` : null,
    ra_form_url: raToken
      ? `${base}/penilaian-borang.html?token=${encodeURIComponent(raToken)}` : null,
    telegram_link_url: telegramToken && env.TELEGRAM_BOT_USERNAME
      ? `https://t.me/${encodeURIComponent(env.TELEGRAM_BOT_USERNAME.replace(/^@/,''))}?start=${encodeURIComponent(telegramToken)}` : null,
  };
}

async function insertAudit(request: Request, env: Env, actorId: number,
  snapshot: Snapshot, eventType: string, eventDetails: Record<string,unknown>, linkUrl: string | null): Promise<void> {
  const id = snapshot.lantikan_id;
  await env.DB.prepare(`
    INSERT INTO lantikan_audit_log (
      event_key,lantikan_id,jadual_id,kejohanan_id,pengadil_id,pengadil_luar_id,
      jawatan,nama_pegawai,emel_pegawai,no_telefon_pegawai,event_type,channel,
      event_status,link_url,details_json,actor_type,actor_user_id,ip_address,user_agent,created_at
    ) VALUES (NULL,?,?,?,?,?,?,?,?,?,?,'manual','success',?,?,'admin',?,?,?,datetime('now','+8 hours'))
  `).bind(
    id,snapshot.jadual_id,snapshot.kejohanan_id,snapshot.pengadil_id,
    snapshot.pengadil_luar_id,snapshot.jawatan,snapshot.nama_pegawai,
    snapshot.emel_pegawai,snapshot.no_telefon_pegawai,eventType,linkUrl,
    JSON.stringify(eventDetails),actorId,
    request.headers.get('CF-Connecting-IP'),request.headers.get('User-Agent')?.slice(0,255) ?? null,
  ).run();
}

async function recordCopy(request: Request, env: Env, actorId: number,
  body: Record<string,unknown>, id: number): Promise<Response> {
  const linkType = body.link_type;
  if (typeof linkType !== 'string' ||
      !['accept_url','reject_url','ra_form_url','telegram_link_url'].includes(linkType)) {
    return json({error:true,message:'Jenis pautan tidak sah.'},400);
  }
  const snapshot = await loadSnapshot(env,id);
  if (!snapshot) return json({error:true,message:'Lantikan tidak dijumpai.'},404);
  const linkUrl = activeLinks(env,snapshot)[linkType];
  if (!linkUrl) return json({error:true,message:'Pautan ini tidak aktif. Muat semula log pautan.'},409);
  await insertAudit(request,env,actorId,snapshot,'direct_link_copied',{link_type:linkType},linkUrl);
  return json({error:false,message:'Salinan pautan direkodkan.'});
}

function randomHex(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)),
    (byte) => byte.toString(16).padStart(2,'0')).join('');
}

async function prepareLinks(request: Request, env: Env, actorId: number, id: number): Promise<Response> {
  const before = await loadSnapshot(env,id);
  if (!before) return json({error:true,message:'Lantikan tidak dijumpai.'},404);
  const base = env.BASE_URL.replace(/\/$/,'');
  const emailPrefix = `${base}/api/lantikan-jawab-token.php?token=`;
  const raPrefix = `${base}/penilaian-borang.html?token=`;
  const telegramPrefix = env.TELEGRAM_BOT_USERNAME
    ? `https://t.me/${encodeURIComponent(env.TELEGRAM_BOT_USERNAME.replace(/^@/,''))}?start=` : null;
  const email = (action: 'accept' | 'reject') =>
    `CASE WHEN lp.status='Belum Jawab' AND trim(COALESCE(lp.email_token,''))<>''
      THEN ? || lp.email_token || '&action=${action}' END`;
  const ra = `CASE WHEN lp.status='Diterima' AND lp.jawatan='Penilai Pengadil'
    AND trim(COALESCE(lp.penilaian_token,''))<>'' THEN ? || lp.penilaian_token END`;
  const telegram = `CASE WHEN COALESCE(u.telegram_chat_id,pl.telegram_chat_id) IS NULL
    AND trim(COALESCE(u.tg_link_token,pl.tg_link_token,''))<>''
    THEN ? || COALESCE(u.tg_link_token,pl.tg_link_token) END`;
  const changes = await env.DB.batch([
    env.DB.prepare(`
      UPDATE lantikan_pengadil SET email_token=?
      WHERE id=? AND status='Belum Jawab' AND trim(COALESCE(email_token,''))=''
    `).bind(randomHex(),id),
    env.DB.prepare(`
      UPDATE pengadil_luar SET tg_link_token=?
      WHERE id=? AND trim(COALESCE(tg_link_token,''))=''
        AND trim(COALESCE(telegram_chat_id,''))=''
    `).bind(randomHex(),before.pengadil_luar_id ?? -1),
    env.DB.prepare(`
      UPDATE lantikan_pengadil SET penilaian_token=?
      WHERE id=? AND status='Diterima' AND jawatan='Penilai Pengadil'
        AND trim(COALESCE(penilaian_token,''))=''
    `).bind(randomHex(),id),
    env.DB.prepare(`
      INSERT INTO lantikan_audit_log (
        event_key,lantikan_id,jadual_id,kejohanan_id,pengadil_id,pengadil_luar_id,
        jawatan,nama_pegawai,emel_pegawai,no_telefon_pegawai,event_type,channel,
        event_status,link_url,details_json,actor_type,actor_user_id,ip_address,user_agent,created_at
      )
      SELECT NULL,lp.id,lp.jadual_id,jp.kejohanan_id,lp.pengadil_id,lp.pengadil_luar_id,
        lp.jawatan,COALESCE(u.nama_penuh,pl.nama,''),COALESCE(u.email,pl.emel,''),
        COALESCE(u.no_telefon,pl.no_tel,''),'direct_links_prepared','manual','success',
        COALESCE(${email('accept')},${ra},${telegram}),
        json_object('accept_url',${email('accept')},'reject_url',${email('reject')},
          'ra_form_url',${ra},'telegram_link_url',${telegram}),
        'admin',?,?,?,datetime('now','+8 hours')
      FROM lantikan_pengadil lp
      JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
      WHERE lp.id=?
    `).bind(emailPrefix,raPrefix,telegramPrefix,
      emailPrefix,emailPrefix,raPrefix,telegramPrefix,
      actorId,request.headers.get('CF-Connecting-IP'),
      request.headers.get('User-Agent')?.slice(0,255) ?? null,id),
  ]);
  if (!wroteRow(changes[3])) {
    return json({error:true,message:'Lantikan berubah semasa menyediakan pautan.'},409);
  }
  const after = await loadSnapshot(env,id);
  if (!after) return json({error:true,message:'Lantikan berubah semasa menyediakan pautan.'},409);
  const data = await auditData(env,id,after);
  return json({error:false,
    message:'Pautan aktif disediakan. Tempoh jawapan belum bermula sehingga penghantaran ditandakan.',
    data});
}

async function markManualDelivery(request: Request, env: Env, actorId: number,
  body: Record<string,unknown>, id: number): Promise<Response> {
  const deliveryType = body.delivery_type === undefined ? 'appointment' : body.delivery_type;
  if (deliveryType !== 'appointment' && deliveryType !== 'ra_form' && deliveryType !== 'telegram_link') {
    return json({error:true,message:'Jenis penghantaran manual tidak sah.'},400);
  }
  const snapshot = await loadSnapshot(env,id);
  if (!snapshot) return json({error:true,message:'Lantikan tidak dijumpai.'},404);
  const link = activeLinks(env,snapshot)[deliveryType === 'appointment' ? 'accept_url'
    : deliveryType === 'ra_form' ? 'ra_form_url' : 'telegram_link_url'];
  if (!link) {
    return json({error:true,message:deliveryType === 'appointment'
      ? 'Pautan lantikan aktif belum tersedia.' : 'Pautan aktif tidak tersedia untuk ditandakan.'},409);
  }
  if (deliveryType === 'appointment' && Number(snapshot.notif_hantar ?? 0) !== 0) {
    return json({error:true,
      message:'Tempoh jawapan lantikan ini sudah bermula. Gunakan tindakan hantar semula jika benar-benar perlu.'},409);
  }
  const prefix = deliveryType === 'appointment'
    ? `${env.BASE_URL.replace(/\/$/,'')}/api/lantikan-jawab-token.php?token=`
    : deliveryType === 'ra_form'
      ? `${env.BASE_URL.replace(/\/$/,'')}/penilaian-borang.html?token=`
      : `https://t.me/${encodeURIComponent((env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/,''))}?start=`;
  const linkExpression = deliveryType === 'appointment'
    ? "? || lp.email_token || '&action=accept'"
    : deliveryType === 'ra_form'
      ? '? || lp.penilaian_token' : '? || COALESCE(u.tg_link_token,pl.tg_link_token)';
  const guard = deliveryType === 'appointment'
    ? "lp.status='Belum Jawab' AND trim(COALESCE(lp.email_token,''))<>'' AND changes()=1"
    : deliveryType === 'ra_form'
      ? "lp.status='Diterima' AND lp.jawatan='Penilai Pengadil' AND trim(COALESCE(lp.penilaian_token,''))<>''"
      : "COALESCE(u.telegram_chat_id,pl.telegram_chat_id) IS NULL AND trim(COALESCE(u.tg_link_token,pl.tg_link_token,''))<>''";
  const audit = env.DB.prepare(`
    INSERT INTO lantikan_audit_log (
      event_key,lantikan_id,jadual_id,kejohanan_id,pengadil_id,pengadil_luar_id,
      jawatan,nama_pegawai,emel_pegawai,no_telefon_pegawai,event_type,channel,
      event_status,link_url,details_json,actor_type,actor_user_id,ip_address,user_agent,created_at
    )
    SELECT NULL,lp.id,lp.jadual_id,jp.kejohanan_id,lp.pengadil_id,lp.pengadil_luar_id,
      lp.jawatan,COALESCE(u.nama_penuh,pl.nama,''),COALESCE(u.email,pl.emel,''),
      COALESCE(u.no_telefon,pl.no_tel,''),'manual_delivery_confirmed','manual','success',
      ${linkExpression},json_object('delivery_type',?,'deadline_started',json(?)),
      'admin',?,?,?,datetime('now','+8 hours')
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.id=? AND ${guard}
  `).bind(prefix,deliveryType,deliveryType === 'appointment' ? 'true' : 'false',actorId,
    request.headers.get('CF-Connecting-IP'),request.headers.get('User-Agent')?.slice(0,255) ?? null,id);
  const results = deliveryType === 'appointment'
    ? await env.DB.batch([
      env.DB.prepare(`
        UPDATE lantikan_pengadil SET notif_hantar=1,tarikh_notif=datetime('now','+8 hours')
        WHERE id=? AND status='Belum Jawab' AND COALESCE(notif_hantar,0)=0
          AND trim(COALESCE(email_token,''))<>''
      `).bind(id),audit,
    ])
    : [await audit.run()];
  if (deliveryType === 'appointment' && !wroteRow(results[0]) ||
      !wroteRow(results.at(-1))) {
    return json({error:true,message:'Lantikan berubah semasa penghantaran manual. Muat semula log pautan.'},409);
  }
  const after = await loadSnapshot(env,id);
  if (!after) return json({error:true,message:'Lantikan berubah semasa penghantaran manual.'},409);
  return json({error:false,message:deliveryType === 'appointment'
    ? 'Penghantaran manual direkodkan dan tempoh jawapan bermula sekarang.'
    : 'Penghantaran pautan manual direkodkan.',data:await auditData(env,id,after)});
}

async function auditPost(request: Request, env: Env, actorId: number): Promise<Response> {
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({error:true,message:'Tindakan audit lantikan belum tersedia di staging.'},503);
  }
  const input = await boundedJson(request,8192);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({error:true,message:'Data tidak sah.'},400);
  }
  const body = input as Record<string,unknown>;
  if (body.action !== 'record_copy' && body.action !== 'prepare_links'
      && body.action !== 'mark_manual_delivery' && body.action !== 'admin_override_acceptance') {
    return json({error:true,message:'Tindakan audit lantikan belum tersedia di staging.'},503);
  }
  const id = positiveId(body.lantikan_id);
  if (!id) return json({error:true,message:'lantikan_id diperlukan.'},400);
  if (body.action === 'record_copy') return recordCopy(request,env,actorId,body,id);
  if (body.action === 'mark_manual_delivery') return markManualDelivery(request,env,actorId,body,id);
  if (body.action === 'admin_override_acceptance') {
    if (env.APPOINTMENT_DELIVERY_ENABLED !== '1') {
      return json({error:true,message:'Override lantikan belum tersedia di staging.'},503);
    }
    return adminOverrideAcceptance(request,env,actorId,id);
  }
  return prepareLinks(request,env,actorId,id);
}

/** admin_override_acceptance as in api/lantikan-audit.php. */
async function adminOverrideAcceptance(request: Request, env: Env, actorId: number,
  id: number): Promise<Response> {
  const meta = auditMetaFrom(request);
  const snapshot = await getLantikanAuditSnapshot(env,id);
  if (!snapshot) return json({error:true,message:'Lantikan tidak dijumpai.'},404);
  const jadualId = Number(snapshot.jadual_id);
  if (['Dibatalkan','Ditangguhkan'].includes(String(snapshot.jadual_status ?? ''))) {
    return json({error:true,
      message:'Penerimaan tidak boleh dioverride untuk perlawanan yang dibatalkan atau ditangguhkan.'},409);
  }
  const isAutoRejected = snapshot.status === 'Ditolak' && (snapshot.komen ?? '') === AUTO_REJECT_COMMENT;
  const isManualKupRejected = snapshot.status === 'Ditolak' && !isAutoRejected && isKupPosition(snapshot.jawatan);
  if (!isAutoRejected && !isManualKupRejected) {
    return json({error:true,
      message:'Override hanya dibenarkan untuk penolakan automatik atau penolakan KUP yang disahkan tersilap.'},409);
  }
  const reason = isAutoRejected ? 'Diterima melalui override Admin selepas tempoh tamat'
    : 'Diterima melalui override Admin selepas penolakan tersilap';
  const activeGuard = `(lp.pengadil_id IS NULL OR EXISTS(SELECT 1 FROM users u
    WHERE u.id=lp.pengadil_id AND ${activeOfficialSql('u', MATCH_YEAR_SQL)}))`;
  if (!await env.DB.prepare(`SELECT lp.id FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id WHERE lp.id=? AND ${activeGuard}`)
    .bind(id).first()) {
    return json({error:true,inactive_official:true,message:'Pegawai tidak aktif tidak boleh dilantik atau disahkan melalui override.'},409);
  }
  const done = await runGuarded(env,[
    guardStatement(env,'lantikan_override',`EXISTS(SELECT 1 FROM lantikan_pengadil lp
      JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id WHERE lp.id=? AND lp.status='Ditolak'
        AND lp.komen IS ? AND jp.status NOT IN ('Dibatalkan','Ditangguhkan') AND ${activeGuard})`,[id,snapshot.komen]),
    env.DB.prepare(`UPDATE lantikan_pengadil SET status='Diterima',komen=?,sebab_status=?,
        tarikh_jawab=datetime('now','+8 hours'),status_dikemaskini_at=datetime('now','+8 hours'),
        tg_token=NULL,email_token=NULL WHERE id=? AND status='Ditolak'`).bind(reason,reason,id),
    ...historySyncStatements(env,jadualId),
    lantikanAuditStatement(env,id,'appointment_admin_acceptance_override','admin','success',{
      previous_status:snapshot.status,previous_comment:snapshot.komen,
      previous_reason:snapshot.sebab_status,new_status:'Diterima',reason,
      override_source:isAutoRejected ? 'automatic_timeout_rejection' : 'official_rejection_mistake',
      official_confirmation_received_outside_portal:true,
    },null,'admin',actorId,snapshot,meta),
  ]);
  // PHP raised a RuntimeException here, surfacing as a generic server error.
  if (!done) return json({error:true,message:'Ralat pelayan.'},500);
  await markMatchDispatchedIfComplete(env,jadualId);
  const jawatan = String(snapshot.jawatan ?? '');
  const shouldNotifyCompleteKup = isKupPosition(jawatan) && await isAcceptedKupCrewComplete(env,jadualId);
  const matchLabel = `${snapshot.pasukan_home ?? ''} lwn ${snapshot.pasukan_away ?? ''}`.trim();
  if (snapshot.pengadil_id) {
    try {
      await createPortalNotification(env,Number(snapshot.pengadil_id),'Lantikan Diterima',
        `Penerimaan lantikan ${matchLabel} disahkan Admin`,
        `Pentadbir telah merekodkan penerimaan anda sebagai ${jawatan} selepas pengesahan diterima di luar portal.`);
    } catch (error) {
      console.error('[lantikan-audit.php] override portal notification error',error instanceof Error ? error.message : error);
    }
  }
  if (jawatan !== 'Penilai Pengadil') {
    try { await notifyAcceptanceOverride(env,snapshot,actorId); } catch (error) {
      console.error('[lantikan-audit.php] override notice error',error instanceof Error ? error.message : error);
    }
  }
  if (jawatan === 'Penilai Pengadil') {
    try { await generatePenilaianToken(env,id,meta); } catch (error) {
      console.error('[lantikan-audit.php] override RA notification error',error instanceof Error ? error.message : error);
    }
  }
  if (shouldNotifyCompleteKup) {
    try { await notifyCompleteKupCrew(env,jadualId); } catch (error) {
      console.error('[lantikan-audit.php] override KUP crew notification error',error instanceof Error ? error.message : error);
    }
  }
  const after = await loadSnapshot(env,id);
  if (!after) return json({error:true,message:'Lantikan tidak dijumpai.'},404);
  return json({error:false,
    message:`Penerimaan ${snapshot.nama_pegawai} sebagai ${jawatan} berjaya disahkan oleh Admin.`,
    data:await auditData(env,id,after)});
}

async function auditData(env: Env,id: number,snapshot: Snapshot): Promise<Record<string,unknown>> {
  const events = await env.DB.prepare(`
    SELECT id,event_type,channel,event_status,link_url,details_json,
      actor_type,actor_user_id,ip_address,created_at
    FROM lantikan_audit_log WHERE lantikan_id=? ORDER BY id DESC LIMIT 100
  `).bind(id).all<AuditEvent>();
  const links = activeLinks(env,snapshot);
  const isRejected = snapshot.status === 'Ditolak';
  const isAutoRejected = isRejected && snapshot.komen === AUTO_REJECT_COMMENT;
  const isManualKupRejected = isRejected && !isAutoRejected && KUP_ROLES.has(snapshot.jawatan);
  return {
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
    links,
    events:events.results.map(({details_json,...event})=>({...event,details:details(details_json)})),
  };
}

/** Admin audit lookup and direct-link actions. */
export async function appointmentAudit(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request,env);
  if (!user) return json({error:true,message: 'Sesi tidak sah. Sila log masuk semula.'},401);
  if (user.role !== 'Admin') return json({error:true,message:'Akses ditolak.'},403);
  if (request.method === 'POST') {
    return auditPost(request,env,user.id);
  }
  if (request.method !== 'GET') {
    return json({error:true,message:'Kaedah tidak disokong.'},405);
  }
  const id = positiveId(new URL(request.url).searchParams.get('lantikan_id'));
  if (!id) {
    return json({error:true,message:'lantikan_id diperlukan.'},400);
  }
  const snapshot = await loadSnapshot(env,id);
  if (!snapshot) return json({error:true,message:'Lantikan tidak dijumpai.'},404);
  return json({error:false,data:await auditData(env,id,snapshot)});
}
