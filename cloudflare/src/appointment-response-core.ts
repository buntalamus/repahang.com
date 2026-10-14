import type { Env } from './types';

/**
 * Shared D1 state transition for portal, email-link and Telegram replies.
 * External delivery (RA form, KUP roster, admin/PP Telegram) must be added
 * before any HTTP reply route calls this function in staging.
 */
export type ReplyGuard =
  | { kind: 'user'; value: number }
  | { kind: 'email'; value: string }
  | { kind: 'telegram'; value: string; chatId: number };

export type ReplyAction = 'accept' | 'reject';
export type ReplyOutcome =
  | { kind: 'answered'; status: 'Diterima' | 'Ditolak'; jadualId: number; jawatan: string; auditKey: string }
  | { kind: 'expired'; jadualId: number; auditKey: string }
  | { kind: 'not_found' | 'already_answered' };

interface Assignment {
  id: number;
  jadual_id: number;
  pengadil_id: number | null;
  pengadil_luar_id: number | null;
  jawatan: string;
  status: string;
  notif_hantar: number | null;
  tarikh_notif: string | null;
  tarikh: string;
  masa: string | null;
  jenis_kejohanan: string | null;
  pasukan_home: string | null;
  pasukan_away: string | null;
  nama_kejohanan: string | null;
  nama_pegawai: string | null;
  emel_pegawai: string | null;
  no_telefon_pegawai: string | null;
  persatuan_id: number | null;
  kejohanan_id: number | null;
}

const AUTO_REJECT_COMMENT = 'Ditolak automatik - tiada jawapan dalam tempoh';
const KUP_ROLES = "'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4'";
const KUP_POSITION = new Set(['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4']);
const crewComplete = `EXISTS (
  SELECT 1 FROM (
    SELECT count(*) AS total, count(DISTINCT jawatan) AS unique_roles,
      sum(status='Diterima') AS accepted,
      sum(jawatan='Pengadil') AS r,
      sum(jawatan='Penolong Pengadil 1') AS ar1,
      sum(jawatan='Penolong Pengadil 2') AS ar2
    FROM lantikan_pengadil
    WHERE jadual_id=? AND jawatan IN (${KUP_ROLES})
      AND status IN ('Belum Jawab','Diterima')
  ) c WHERE c.total BETWEEN 3 AND 4 AND c.unique_roles=c.total
    AND c.accepted=c.total AND c.r=1 AND c.ar1=1 AND c.ar2=1
)`;
const crewKey = `(SELECT group_concat(jawatan||':'||id,'|') FROM (
  SELECT id,jawatan FROM lantikan_pengadil
  WHERE jadual_id=? AND jawatan IN (${KUP_ROLES})
    AND status='Diterima'
  ORDER BY CASE jawatan WHEN 'Pengadil' THEN 1
    WHEN 'Penolong Pengadil 1' THEN 2
    WHEN 'Penolong Pengadil 2' THEN 3 ELSE 4 END,id
))`;

function localTimestamp(value: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const timestamp = Date.parse(`${match[1]}T${match[2]}:${match[3] ?? '00'}+08:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function localDateTime(timestamp: number): string {
  return new Date(timestamp + 8 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
}

export function expiryDeadline(row: Pick<Assignment, 'notif_hantar' | 'tarikh_notif' | 'tarikh' | 'masa' | 'jenis_kejohanan'>,
  now = Date.now()): number | null {
  if (row.notif_hantar !== 1 || !row.tarikh_notif) return null;
  const sentAt = localTimestamp(row.tarikh_notif);
  const kickoff = localTimestamp(`${row.tarikh} ${String(row.masa ?? '').slice(0, 8)}`);
  if (sentAt === null || kickoff === null) return null;
  const hours = String(row.jenis_kejohanan ?? '').toLowerCase() === 'liga' ? 48 : 3;
  const deadline = sentAt + hours * 3600_000;
  return deadline <= now && deadline < kickoff ? deadline : null;
}

function guardSql(guard: ReplyGuard): { clause: string; values: Array<number | string> } {
  switch (guard.kind) {
    case 'user': return { clause: 'lp.pengadil_id=?', values: [guard.value] };
    case 'email': return { clause: 'lp.email_token=?', values: [guard.value] };
    case 'telegram': return {
      clause: `lp.tg_token=? AND (
        EXISTS (SELECT 1 FROM users owner WHERE owner.id=lp.pengadil_id AND owner.telegram_chat_id=?)
        OR EXISTS (SELECT 1 FROM pengadil_luar owner WHERE owner.id=lp.pengadil_luar_id AND owner.telegram_chat_id=?)
      )`,
      values: [guard.value, guard.chatId, guard.chatId],
    };
  }
}

const historySql = `
  INSERT INTO perlawanan (
    user_id,lantikan_id,tarikh,masa,jenis,nama_kejohanan,tempat,
    home_team,away_team,jawatan,head_referee_id,assistant_referee_1_id,
    assistant_referee_2_id,fourth_official_id,status_pp,created_at
  )
  SELECT lp.pengadil_id,lp.id,jp.tarikh,jp.masa,
    substr(COALESCE(NULLIF(trim(COALESCE(k.nama,'') ||
      CASE WHEN COALESCE(jp.kategori,'')<>'' THEN ' - '||jp.kategori ELSE '' END ||
      CASE WHEN COALESCE(jp.peringkat,'')<>'' THEN ' - '||jp.peringkat ELSE '' END),''),'Kejohanan'),1,60),
    NULLIF(k.nama,''),jp.tempat,jp.pasukan_home,jp.pasukan_away,lp.jawatan,
    (SELECT c.pengadil_id FROM lantikan_pengadil c WHERE c.jadual_id=lp.jadual_id
       AND c.jawatan='Pengadil' AND c.status='Diterima' AND c.pengadil_id IS NOT NULL LIMIT 1),
    (SELECT c.pengadil_id FROM lantikan_pengadil c WHERE c.jadual_id=lp.jadual_id
       AND c.jawatan='Penolong Pengadil 1' AND c.status='Diterima' AND c.pengadil_id IS NOT NULL LIMIT 1),
    (SELECT c.pengadil_id FROM lantikan_pengadil c WHERE c.jadual_id=lp.jadual_id
       AND c.jawatan='Penolong Pengadil 2' AND c.status='Diterima' AND c.pengadil_id IS NOT NULL LIMIT 1),
    (SELECT c.pengadil_id FROM lantikan_pengadil c WHERE c.jadual_id=lp.jadual_id
       AND c.jawatan='Pegawai ke4' AND c.status='Diterima' AND c.pengadil_id IS NOT NULL LIMIT 1),
    'Disahkan',datetime('now','+8 hours')
  FROM lantikan_pengadil lp
  JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
  LEFT JOIN kejohanan k ON k.id=jp.kejohanan_id
  WHERE lp.jadual_id=? AND lp.status='Diterima' AND lp.pengadil_id IS NOT NULL
    AND lp.jawatan IN (${KUP_ROLES})
    AND EXISTS (SELECT 1 FROM lantikan_audit_log a WHERE a.event_key=?)
  ON CONFLICT(lantikan_id) DO UPDATE SET
    user_id=excluded.user_id,tarikh=excluded.tarikh,masa=excluded.masa,
    jenis=excluded.jenis,nama_kejohanan=excluded.nama_kejohanan,
    tempat=excluded.tempat,home_team=excluded.home_team,away_team=excluded.away_team,
    jawatan=excluded.jawatan,head_referee_id=excluded.head_referee_id,
    assistant_referee_1_id=excluded.assistant_referee_1_id,
    assistant_referee_2_id=excluded.assistant_referee_2_id,
    fourth_official_id=excluded.fourth_official_id,status_pp='Disahkan'
`;

/** Batch is one D1 transaction: a duplicate reply cannot create audit/history/notifications. */
export async function recordAppointmentReply(
  env: Env, id: number, action: ReplyAction, comment: string, guard: ReplyGuard,
  actorUserId: number | null = null,
): Promise<ReplyOutcome> {
  const owner = guardSql(guard);
  const row = await env.DB.prepare(`
    SELECT lp.id,lp.jadual_id,lp.pengadil_id,lp.pengadil_luar_id,lp.jawatan,lp.status,
      lp.notif_hantar,lp.tarikh_notif,jp.tarikh,jp.masa,jp.pasukan_home,jp.pasukan_away,
      k.jenis_kejohanan,k.nama AS nama_kejohanan,jp.kejohanan_id,
      COALESCE(u.nama_penuh,pl.nama,'') AS nama_pegawai,
      COALESCE(u.email,pl.emel,'') AS emel_pegawai,
      COALESCE(u.no_telefon,pl.no_tel,'') AS no_telefon_pegawai,
      u.persatuan_id
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN kejohanan k ON k.id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.id=? AND ${owner.clause} LIMIT 1
  `).bind(id, ...owner.values).first<Assignment>();
  if (!row) return { kind: 'not_found' };
  if (row.status !== 'Belum Jawab') return { kind: 'already_answered' };

  const expiredAt = expiryDeadline(row);
  const newStatus = expiredAt === null && action === 'accept' ? 'Diterima' : 'Ditolak';
  const finalComment = expiredAt !== null ? AUTO_REJECT_COMMENT : comment;
  const answeredAt = expiredAt !== null ? localDateTime(expiredAt) : localDateTime(Date.now());
  const eventType = expiredAt !== null ? 'appointment_auto_rejected' : 'appointment_response';
  const channel = expiredAt !== null ? 'system' : guard.kind === 'user' ? 'portal' : guard.kind;
  const auditKey = `worker-${eventType}-${id}-${crypto.randomUUID()}`;
  const details = JSON.stringify(expiredAt !== null
    ? { reason: AUTO_REJECT_COMMENT, deadline_timestamp: Math.floor(expiredAt / 1000) }
    : { action, new_status: newStatus, comment });
  const marker = 'EXISTS (SELECT 1 FROM lantikan_audit_log a WHERE a.event_key=?)';
  const statements = [
    env.DB.prepare(`
      UPDATE lantikan_pengadil AS lp
      SET status=?,komen=?,tarikh_jawab=?,status_dikemaskini_at=?,
          tg_token=NULL,email_token=NULL
      WHERE lp.id=? AND ${owner.clause} AND lp.status='Belum Jawab'
        AND COALESCE(lp.tarikh_notif,'')=COALESCE(?,'')
        AND COALESCE(lp.notif_hantar,0)=?
    `).bind(newStatus, finalComment, answeredAt, answeredAt, id, ...owner.values,
      row.tarikh_notif, row.notif_hantar ?? 0),
    env.DB.prepare(`
      INSERT INTO lantikan_audit_log (
        event_key,lantikan_id,jadual_id,kejohanan_id,pengadil_id,pengadil_luar_id,
        jawatan,nama_pegawai,emel_pegawai,no_telefon_pegawai,event_type,channel,
        event_status,details_json,actor_type,actor_user_id,created_at
      ) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','+8 hours')
        WHERE changes()=1
    `).bind(auditKey,id,row.jadual_id,row.kejohanan_id,row.pengadil_id,
      row.pengadil_luar_id,row.jawatan,row.nama_pegawai,row.emel_pegawai,
      row.no_telefon_pegawai,eventType,channel,'success',details,
      expiredAt !== null ? 'system' : 'official',actorUserId),
    env.DB.prepare(`
      INSERT INTO worker_appointment_outbox
        (event_key,lantikan_id,jadual_id,response_status,response_channel)
      SELECT ?,?,?,?,? WHERE ${marker}
    `).bind(auditKey,id,row.jadual_id,newStatus,channel,auditKey),
    env.DB.prepare(`
      DELETE FROM perlawanan WHERE lantikan_id IN (
        SELECT lp.id FROM lantikan_pengadil lp WHERE lp.jadual_id=?
          AND (lp.status<>'Diterima' OR lp.pengadil_id IS NULL OR lp.jawatan NOT IN (${KUP_ROLES}))
      ) AND ${marker}
    `).bind(row.jadual_id,auditKey),
    env.DB.prepare(historySql).bind(row.jadual_id,auditKey),
  ];

  if (newStatus === 'Diterima' && row.jawatan === 'Penilai Pengadil') {
    statements.push(env.DB.prepare(`
      UPDATE lantikan_pengadil SET penilaian_token=COALESCE(NULLIF(penilaian_token,''),?)
      WHERE id=? AND status='Diterima' AND ${marker}
    `).bind(crypto.randomUUID().replaceAll('-','') + crypto.randomUUID().replaceAll('-',''),id,auditKey));
  }
  if (expiredAt === null) {
    const label = action === 'accept' ? 'diterima' : 'ditolak';
    const match = `${row.pasukan_home ?? ''} lwn ${row.pasukan_away ?? ''}`;
    const message = `Anda telah ${label} lantikan sebagai ${row.jawatan} untuk ${match} (${row.nama_kejohanan ?? ''}).`;
    if (row.pengadil_id !== null) {
      statements.push(env.DB.prepare(`
        INSERT INTO notifications(user_id,type,subject,message,created_at)
        SELECT ?,?,?,?,datetime('now','+8 hours') WHERE ${marker}
      `).bind(row.pengadil_id,`Lantikan ${label === 'diterima' ? 'Diterima' : 'Ditolak'}`,
        `Lantikan ${match}`,message,auditKey));
    }

    const adminsMessage = `${row.nama_pegawai ?? ''} telah ${action === 'accept' ? 'menerima' : 'menolak'} lantikan sebagai ${row.jawatan} untuk ${match} (${row.nama_kejohanan ?? ''}) pada ${row.tarikh}.${action === 'reject' && comment ? ` Sebab: ${comment}` : ''}`;
    statements.push(env.DB.prepare(`
      INSERT INTO notifications(user_id,type,subject,message,created_at)
      SELECT u.id,?,?,?,datetime('now','+8 hours') FROM users u
      WHERE u.role='Admin' AND u.aktif=1 AND ${marker}
    `).bind(`Lantikan ${label === 'diterima' ? 'Diterima' : 'Ditolak'}`,
      `${row.nama_pegawai ?? ''} — ${match}`,adminsMessage,auditKey));
    if (row.pengadil_id !== null && row.persatuan_id) {
      statements.push(env.DB.prepare(`
        INSERT INTO notifications(user_id,type,subject,message,created_at)
        SELECT u.id,?,?,?,datetime('now','+8 hours') FROM users u
        WHERE u.role='PP Daerah' AND u.aktif=1 AND u.persatuan_id=? AND ${marker}
      `).bind(action === 'accept' ? 'Pengadil Terima Lantikan' : 'Pengadil Tolak Lantikan',
        `${row.nama_pegawai ?? ''} — ${match}`,adminsMessage,row.persatuan_id,auditKey));
    }
    // Telegram responses follow the same Admin/PP audience as the PHP flow.
    statements.push(env.DB.prepare(`
      INSERT INTO worker_appointment_deliveries
        (delivery_key,event_key,kind,channel,recipient_user_id)
      SELECT ?||':admin:'||u.id||':telegram',?,'admin_response','telegram',u.id
      FROM users u WHERE u.role='Admin' AND u.aktif=1
        AND u.telegram_chat_id IS NOT NULL AND ${marker}
    `).bind(auditKey,auditKey,auditKey));
    if (row.pengadil_id !== null && row.persatuan_id) {
      statements.push(env.DB.prepare(`
        INSERT INTO worker_appointment_deliveries
          (delivery_key,event_key,kind,channel,recipient_user_id)
        SELECT ?||':pp:'||u.id||':telegram',?,'pp_response','telegram',u.id
        FROM users u WHERE u.role='PP Daerah' AND u.aktif=1
          AND u.persatuan_id=? AND u.telegram_chat_id IS NOT NULL AND ${marker}
      `).bind(auditKey,auditKey,row.persatuan_id,auditKey));
    }
  }
  if (newStatus === 'Diterima' && row.jawatan === 'Penilai Pengadil') {
    statements.push(env.DB.prepare(`
      INSERT INTO worker_appointment_deliveries
        (delivery_key,event_key,kind,channel,recipient_lantikan_id)
      SELECT ?||':ra:'||lp.id||':email',?,'ra_form','email',lp.id
      FROM lantikan_pengadil lp
      LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
      WHERE lp.id=? AND lp.status='Diterima'
        AND COALESCE(NULLIF(trim(u.email),''),NULLIF(trim(pl.emel),''),'')<>''
        AND ${marker}
    `).bind(auditKey,auditKey,id,auditKey));
    statements.push(env.DB.prepare(`
      INSERT INTO worker_appointment_deliveries
        (delivery_key,event_key,kind,channel,recipient_lantikan_id)
      SELECT ?||':ra:'||lp.id||':telegram',?,'ra_form','telegram',lp.id
      FROM lantikan_pengadil lp
      LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
      WHERE lp.id=? AND lp.status='Diterima'
        AND COALESCE(u.telegram_chat_id,pl.telegram_chat_id) IS NOT NULL
        AND ${marker}
    `).bind(auditKey,auditKey,id,auditKey));
  }
  if (newStatus === 'Diterima' && KUP_POSITION.has(row.jawatan)) {
    for (const channel of ['email','telegram'] as const) {
      const hasContact = channel === 'email'
        ? "COALESCE(NULLIF(trim(u.email),''),NULLIF(trim(pl.emel),''),'')<>''"
        : 'COALESCE(u.telegram_chat_id,pl.telegram_chat_id) IS NOT NULL';
      statements.push(env.DB.prepare(`
        INSERT INTO worker_appointment_deliveries
          (delivery_key,event_key,kind,channel,recipient_lantikan_id,crew_key)
        SELECT ?||':kup:'||lp.id||':${channel}',?,'kup_crew','${channel}',lp.id,
          ${crewKey}
        FROM lantikan_pengadil lp
        LEFT JOIN users u ON u.id=lp.pengadil_id
        LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
        WHERE lp.jadual_id=? AND lp.jawatan IN (${KUP_ROLES})
          AND lp.status='Diterima' AND ${hasContact}
          AND ${crewComplete} AND ${marker}
      `).bind(auditKey,auditKey,row.jadual_id,row.jadual_id,row.jadual_id,auditKey));
    }
  }
  const results = await env.DB.batch(statements);
  if (results[0].meta.changes !== 1) return { kind: 'already_answered' };
  if (results[1].meta.changes !== 1 || results[2].meta.changes !== 1) {
    throw new Error('Audit atau tugas penghantaran lantikan tidak disimpan.');
  }
  if (expiredAt !== null) return { kind: 'expired', jadualId: row.jadual_id, auditKey };
  return { kind: 'answered', status: newStatus, jadualId: row.jadual_id,
    jawatan: row.jawatan, auditKey };
}
