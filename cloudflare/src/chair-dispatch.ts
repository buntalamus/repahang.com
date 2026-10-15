import {processChairDeliveries} from './chair-delivery';
import type {ChairSenders} from './chair-delivery';
import type {Env} from './types';

export type ChairOrigin='chair_assigned'|'admin_retry';
type Scope={kind:'tournament'|'report';id:number};

const now="datetime('now','+8 hours')";
const chairOf=`JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
  LEFT JOIN kejohanan_pengesah_laporan kp ON kp.kejohanan_id=jp.kejohanan_id AND kp.aktif=1
  LEFT JOIN users u ON u.id=kp.pengesah_user_id
  LEFT JOIN pengadil_luar pl ON pl.id=kp.pengesah_luar_id`;
const chairEmail='COALESCE(u.email,pl.emel)';
const chairChat='COALESCE(u.telegram_chat_id,pl.telegram_chat_id)';
const emailMissing=(alias:string)=>`trim(COALESCE(${alias}.email_recipient,''))=''`;
const chatMissing=(alias:string)=>
  `COALESCE(NULLIF(trim(CAST(${alias}.telegram_chat_id AS TEXT)),''),'0')='0'`;
// PHP compares only the mapping id; the upsert keeps that id when the chair
// person changes, so such a change is handled as a contact refresh.
const chairDiffers='COALESCE(a.kejohanan_pengesah_id,0)<>COALESCE(kp.id,0)';
const approvalUrl=(env:Env)=>
  `${env.BASE_URL.replace(/\/$/,'')}/api/laporan-pengesahan-token.php?token=`;
const linkOf=(alias:string)=>`CASE WHEN length(${alias}.approval_token)=64
  THEN ?||${alias}.approval_token END`;
const marker='EXISTS(SELECT 1 FROM worker_chair_assignments WHERE nonce=? AND integrity_checked=0)';

/**
 * D1 statements equivalent to PHP ensureLaporanPengesahanState plus the
 * delivery claim, for every pending report in scope. They run after the
 * caller's marker insert and before its integrity update, in one batch.
 */
export function chairDispatchStatements(env:Env,nonce:string,origin:ChairOrigin,
  scope:Scope):D1PreparedStatement[] {
  const inScope=scope.kind==='tournament' ? 'jp.kejohanan_id=?' : 'r.id=?';
  const item=(action:string)=>`FROM worker_chair_assignment_items i
    JOIN laporan_penilaian r ON r.id=i.report_id ${chairOf}
    WHERE i.nonce=? AND i.action IN (${action})`;
  const source=(action:string)=>`(SELECT i.report_id,kp.id AS kp_id,
    kp.pengesah_user_id AS user_id,kp.pengesah_luar_id AS luar_id,
    kp.nama_snapshot AS nama,kp.jawatan_snapshot AS jawatan,
    COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),'') AS negeri,
    ${chairEmail} AS email,${chairChat} AS chat_id ${item(action)}) src`;
  const approvals=`FROM worker_chair_assignment_items i
    JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=i.report_id WHERE i.nonce=?`;
  const channels=(['email','telegram'] as const).flatMap((channel)=>{
    const missing=channel==='email' ? emailMissing('a') : chatMissing('a');
    const reason=channel==='email' ? 'email_not_available' : 'telegram_not_linked';
    const due=`a.status='Menunggu' AND a.kejohanan_pengesah_id IS NOT NULL
      AND length(a.approval_token)=64 AND a.${channel}_sent_at IS NULL`;
    return [
      // PHP records a missing channel once per approval, then stays quiet.
      env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
        (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,actor_type,
         link_url,details_json,created_at)
        SELECT a.id,a.laporan_id,'chair_notification',?,'skipped','system',
          ${linkOf('a')},json_object('reason',?,'nonce',?),${now}
        ${approvals} AND ${due} AND a.${channel}_attempts=0 AND ${missing}`)
        .bind(channel,approvalUrl(env),reason,nonce,nonce),
      env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET
        ${channel}_attempts=${channel}_attempts+1,${channel}_last_error=?,updated_at=${now}
        WHERE id IN (SELECT a.id ${approvals} AND ${due} AND a.${channel}_attempts=0
          AND ${missing})`).bind(reason,nonce),
    ];
  });
  return [
    env.DB.prepare(`INSERT INTO worker_chair_assignment_items(nonce,report_id,action)
      SELECT ?,r.id,CASE
        WHEN a.id IS NULL THEN 'prepare'
        WHEN ${chairDiffers} THEN 'rotate'
        WHEN kp.id IS NOT NULL AND (
          trim(COALESCE(a.email_recipient,''))<>trim(COALESCE(${chairEmail},''))
          OR COALESCE(CAST(a.telegram_chat_id AS TEXT),'')
            <>COALESCE(CAST(${chairChat} AS TEXT),'')) THEN 'refresh'
        ELSE 'keep' END
      FROM laporan_penilaian r JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id
        AND ra.jadual_id=r.jadual_id AND ra.jawatan='Penilai Pengadil' AND ra.status='Diterima'
      ${chairOf}
      LEFT JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=r.id
      WHERE r.status='Dihantar' AND (a.id IS NULL OR a.status='Menunggu')
        AND ${inScope} AND ${marker}`).bind(nonce,scope.id,nonce),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_pengerusi
      (laporan_id,kejohanan_pengesah_id,pengesah_user_id,pengesah_luar_id,
       pengesah_nama,pengesah_jawatan,pengesah_negeri,approval_token,status,
       email_recipient,email_attempts,telegram_chat_id,telegram_attempts,
       created_at,updated_at)
      SELECT r.id,kp.id,kp.pengesah_user_id,kp.pengesah_luar_id,kp.nama_snapshot,
        kp.jawatan_snapshot,COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),''),
        CASE WHEN kp.id IS NULL THEN NULL ELSE lower(hex(randomblob(32))) END,'Menunggu',
        ${chairEmail},0,${chairChat},0,${now},${now}
      ${item("'prepare'")}`).bind(nonce),
    // A different mapping gets a new token, so links already sent stop working.
    env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET
      kejohanan_pengesah_id=src.kp_id,pengesah_user_id=src.user_id,
      pengesah_luar_id=src.luar_id,pengesah_nama=src.nama,pengesah_jawatan=src.jawatan,
      pengesah_negeri=src.negeri,
      approval_token=CASE WHEN src.kp_id IS NULL THEN NULL ELSE lower(hex(randomblob(32))) END,
      email_recipient=src.email,email_sent_at=NULL,email_claimed_at=NULL,
      email_last_error=NULL,
      telegram_chat_id=src.chat_id,telegram_sent_at=NULL,telegram_claimed_at=NULL,
      telegram_last_error=NULL,updated_at=${now}
      FROM ${source("'rotate'")}
      WHERE laporan_pengesahan_pengerusi.laporan_id=src.report_id
        AND laporan_pengesahan_pengerusi.status='Menunggu'`).bind(nonce),
    env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET
      email_recipient=src.email,
      email_last_error=CASE WHEN email_sent_at IS NULL THEN NULL ELSE email_last_error END,
      telegram_chat_id=src.chat_id,
      telegram_last_error=CASE WHEN telegram_sent_at IS NULL THEN NULL ELSE telegram_last_error END,
      updated_at=${now}
      FROM ${source("'refresh'")}
      WHERE laporan_pengesahan_pengerusi.laporan_id=src.report_id
        AND laporan_pengesahan_pengerusi.status='Menunggu'`).bind(nonce),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
      (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,actor_type,
       link_url,details_json,created_at)
      SELECT a.id,a.laporan_id,CASE i.action WHEN 'prepare' THEN 'approval_prepared'
          WHEN 'rotate' THEN 'approver_changed' ELSE 'approver_contact_refreshed' END,
        'system',CASE WHEN a.kejohanan_pengesah_id IS NULL THEN 'failed' ELSE 'success' END,
        'system',${linkOf('a')},CASE
          WHEN i.action='refresh' THEN json_object('email_available',
            CASE WHEN ${emailMissing('a')} THEN json('false') ELSE json('true') END,
            'telegram_linked',CASE WHEN ${chatMissing('a')} THEN json('false') ELSE json('true') END,
            'origin',?,'nonce',?)
          WHEN a.kejohanan_pengesah_id IS NULL THEN json_object('reason',
            'pengerusi_not_configured','origin',?,'nonce',?)
          ELSE json_object('origin',?,'nonce',?) END,${now}
      ${approvals} AND i.action IN ('prepare','rotate','refresh')`)
      .bind(approvalUrl(env),origin,nonce,origin,nonce,origin,nonce,nonce),
    env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,email_sent,is_read,created_at)
      SELECT admin.id,'Laporan RA','Salinan Laporan RA #'||r.id||
        ' — Menunggu Pengesahan Pengerusi',
        COALESCE(ra_user.nama_penuh,ra_luar.nama,'Penilai Pengadil')||
        ' telah menghantar laporan RA bagi '||jp.pasukan_home||' lwn '||jp.pasukan_away||
        ' ('||k.nama||'). Pengerusi Pengadil: '||COALESCE(a.pengesah_nama,'belum ditetapkan')||
        '. Admin boleh menyemak salinan dan hanya menggunakan override jika perlu.',
        0,0,${now}
      FROM worker_chair_assignment_items i
      JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=i.report_id AND a.admin_copy_at IS NULL
      JOIN laporan_penilaian r ON r.id=i.report_id
      JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id
      JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id
      LEFT JOIN users ra_user ON ra_user.id=ra.pengadil_id
      LEFT JOIN pengadil_luar ra_luar ON ra_luar.id=ra.pengadil_luar_id
      CROSS JOIN users admin
      WHERE i.nonce=? AND admin.role='Admin' AND admin.aktif=1`).bind(nonce),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
      (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,actor_type,
       details_json,created_at)
      SELECT a.id,a.laporan_id,'admin_copy_created','portal','success','system',
        json_object('admin_count',(SELECT count(*) FROM users WHERE role='Admin' AND aktif=1),
          'nonce',?),${now}
      ${approvals} AND a.admin_copy_at IS NULL`).bind(nonce,nonce),
    env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET admin_copy_at=${now}
      WHERE admin_copy_at IS NULL AND id IN (SELECT a.id ${approvals})`).bind(nonce),
    ...channels,
    // Jobs for a token that was just rotated would only carry a dead link.
    env.DB.prepare(`UPDATE worker_chair_jobs SET status='skipped',claimed_at=NULL,
      completed_at=${now},last_error='Token Pengerusi telah diputar.'
      WHERE status='pending' AND approval_id IN (SELECT a.id ${approvals})
        AND token_tag<>(SELECT substr(COALESCE(a.approval_token,''),1,16)
          FROM laporan_pengesahan_pengerusi a WHERE a.id=worker_chair_jobs.approval_id)`)
      .bind(nonce),
    // PHP attempts every unsent channel in the request, so waiting jobs skip backoff.
    env.DB.prepare(`UPDATE worker_chair_jobs SET next_attempt_at=NULL
      WHERE status='pending'
        AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-5 minutes'))
        AND approval_id IN (SELECT a.id ${approvals})`).bind(nonce),
    env.DB.prepare(`INSERT INTO worker_chair_jobs
      (delivery_key,approval_id,report_id,token_tag,channel,origin)
      SELECT 'chair:'||a.laporan_id||':'||ch.channel||':'||?,a.id,a.laporan_id,
        substr(a.approval_token,1,16),ch.channel,?
      FROM worker_chair_assignment_items i
      JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=i.report_id
      CROSS JOIN (SELECT 'email' AS channel UNION ALL SELECT 'telegram') ch
      WHERE i.nonce=? AND a.status='Menunggu' AND a.kejohanan_pengesah_id IS NOT NULL
        AND length(a.approval_token)=64
        AND CASE ch.channel
          WHEN 'email' THEN a.email_sent_at IS NULL AND NOT ${emailMissing('a')}
          ELSE a.telegram_sent_at IS NULL AND NOT ${chatMissing('a')} END
        AND NOT EXISTS(SELECT 1 FROM worker_chair_jobs j WHERE j.approval_id=a.id
          AND j.channel=ch.channel AND j.status='pending'
          AND j.token_tag=substr(a.approval_token,1,16))`).bind(nonce,origin,nonce),
  ];
}

/** Integrity condition for chairDispatchStatements; binds follow the SQL order. */
export function chairDispatchIntegrity(nonce:string):{sql:string;binds:unknown[]} {
  return {sql:`NOT EXISTS(SELECT 1 FROM worker_chair_assignment_items i
      JOIN laporan_penilaian r ON r.id=i.report_id ${chairOf}
      LEFT JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=i.report_id
      WHERE i.nonce=? AND (a.id IS NULL OR a.status<>'Menunggu' OR r.status<>'Dihantar'
        OR ${chairDiffers} OR a.admin_copy_at IS NULL
        OR (kp.id IS NOT NULL AND length(COALESCE(a.approval_token,''))<>64)))
    AND (SELECT count(*) FROM laporan_pengesahan_audit
      WHERE laporan_id IN (SELECT report_id FROM worker_chair_assignment_items WHERE nonce=?)
        AND event_type IN ('approval_prepared','approver_changed','approver_contact_refreshed')
        AND json_extract(CASE WHEN json_valid(details_json) THEN details_json END,'$.nonce')=?)
      =(SELECT count(*) FROM worker_chair_assignment_items
        WHERE nonce=? AND action IN ('prepare','rotate','refresh'))`,
  binds:[nonce,nonce,nonce,nonce]};
}

/** Send the jobs of one assignment/retry within the request, as PHP does. */
export async function sendChairJobsNow(env:Env,nonce:string,senders:ChairSenders={}):Promise<void> {
  for (let round=0;round<20;round++) {
    const counts=await processChairDeliveries(env,50,senders,{nonce});
    if (counts.processed===0) return;
  }
}

type RetryState={id:number;configured:number;status:string;email_sent_at:string|null;
  telegram_sent_at:string|null;email_last_error:string|null;telegram_last_error:string|null};

/** Admin retry: refresh the approval like PHP, queue unsent channels and send them now. */
export async function retryChairNotification(env:Env,reportId:number,adminId:number,
  senders:ChairSenders={}):Promise<{status:number;body:Record<string,unknown>}> {
  const current=await env.DB.prepare(`SELECT r.status AS report_status,a.status AS approval_status
    FROM laporan_penilaian r LEFT JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=r.id
    WHERE r.id=? LIMIT 1`).bind(reportId)
    .first<{report_status:string;approval_status:string|null}>();
  if (!current || current.report_status!=='Dihantar' ||
      (current.approval_status!==null && current.approval_status!=='Menunggu')) {
    return {status:409,body:{error:true,message:'Laporan ini tidak lagi menunggu Pengerusi.'}};
  }
  const nonce=crypto.randomUUID();
  const integrity=chairDispatchIntegrity(nonce);
  const statements=[
    env.DB.prepare(`INSERT INTO worker_chair_assignments
      (nonce,kejohanan_id,report_id,origin,actor_user_id)
      SELECT ?,jp.kejohanan_id,r.id,'admin_retry',? FROM laporan_penilaian r
      JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
      WHERE r.id=? AND r.status='Dihantar' AND NOT EXISTS(SELECT 1
        FROM laporan_pengesahan_pengerusi a WHERE a.laporan_id=r.id AND a.status<>'Menunggu')`)
      .bind(nonce,adminId,reportId),
    ...chairDispatchStatements(env,nonce,'admin_retry',{kind:'report',id:reportId}),
    env.DB.prepare(`UPDATE worker_chair_assignments SET integrity_checked=CASE WHEN
      (SELECT count(*) FROM worker_chair_assignment_items WHERE nonce=?)=1
      AND ${integrity.sql} THEN 1 ELSE -1 END WHERE nonce=?`)
      .bind(nonce,...integrity.binds,nonce),
  ];
  let result:D1Result[];
  try {result=await env.DB.batch(statements);}
  catch(error) {
    if (String(error).includes('constraint')) return {status:409,body:{error:true,
      message:'Laporan telah berubah. Muat semula sebelum mencuba semula.'}};
    throw error;
  }
  if (result[0]?.meta?.changes!==1) {
    return {status:409,body:{error:true,message:'Laporan ini tidak lagi menunggu Pengerusi.'}};
  }
  if (result[result.length-1]?.meta?.changes!==1) throw new Error('Incomplete chair retry transaction');
  await sendChairJobsNow(env,nonce,senders);
  const state=await env.DB.prepare(`SELECT id,status,email_sent_at,telegram_sent_at,
    email_last_error,telegram_last_error,
    CASE WHEN kejohanan_pengesah_id IS NOT NULL AND length(approval_token)=64
      THEN 1 ELSE 0 END AS configured
    FROM laporan_pengesahan_pengerusi WHERE laporan_id=?`).bind(reportId).first<RetryState>();
  if (!state) throw new Error('Chair retry state unavailable');
  const {configured,...rest}=state;
  const pengesahan={configured:configured===1,email_sent:Boolean(state.email_sent_at),
    telegram_sent:Boolean(state.telegram_sent_at),state:rest};
  return {status:200,body:{error:false,
    message:pengesahan.email_sent || pengesahan.telegram_sent
      ? 'Percubaan penghantaran kepada Pengerusi selesai. Sekurang-kurangnya satu saluran berjaya.'
      : 'Percubaan direkodkan tetapi tiada saluran berjaya. Gunakan pautan terus jika perlu.',
    pengesahan}};
}
