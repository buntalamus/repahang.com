import {buildRefpahangEmail,sendRefpahangEmail} from '../mail';
import {currentUser,json} from './auth';
import {guardStatement,runGuarded} from './php/guard';
import {mysqlTextOrder} from './php/mysql-order';
import {boundedJson} from './request';
import type {Env} from './types';
import { wroteRow } from './d1-changes';

type External = Record<string,unknown> & {
  id:number;emel:string|null;telegram_chat_id:string|null;tg_link_token:string|null;
  attempts:number|null;first_sent_at:string|null;last_failed_at:string|null;
};

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Invitee = {id:number;nama_penuh:string|null;email:string;tg_link_token:string|null};
type OnboardingBatch = {id:number;batch_token:string;kejohanan_id:number;
  kejohanan_nama:string;attempt_mode:'initial'|'resend'};
type OnboardingRecipient = External & {nama:string;emel:string|null};
type OnboardingMeta = {ip:string|null;userAgent:string|null};

function tokenHex():string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),
    (byte)=>byte.toString(16).padStart(2,'0')).join('');
}

/** Admin-only Telegram account linking invitation and preview. */
export async function adminTelegramBlastPreview(request:Request,env:Env):Promise<Response> {
  const user=await currentUser(request,env);
  if (!user) return json({error:true,message: 'Sesi tidak sah. Sila log masuk semula.'},401);
  if (user.role!=='Admin') return json({error:true,message:'Akses ditolak.'},403);
  if (request.method==='POST') {
    if (env.STAGING_WRITES_ENABLED!=='1' || env.BULK_EMAIL_ENABLED!=='1') {
      return json({error:true,message:'Penghantaran blast belum tersedia di staging.'},503);
    }
    const rows=await env.DB.prepare(`SELECT id,nama_penuh,email,tg_link_token FROM users
      WHERE aktif=1 AND email IS NOT NULL AND trim(email)<>''
        AND (telegram_chat_id IS NULL OR trim(telegram_chat_id)='') ORDER BY id`).all<Invitee>();
    const bot=(env.TELEGRAM_BOT_USERNAME || 'refpahang_bot').replace(/^@+/,'');
    let sent=0;
    let failed=0;
    const errors:string[]=[];
    for (const row of rows.results) {
      const email=String(row.email ?? '').trim();
      if (!EMAIL.test(email)) {
        failed++;
        errors.push(email);
        continue;
      }
      let token=String(row.tg_link_token ?? '').trim();
      if (!token) {
        const generated=tokenHex();
        await env.DB.prepare(`UPDATE users SET tg_link_token=? WHERE id=? AND aktif=1
          AND (tg_link_token IS NULL OR trim(tg_link_token)='')
          AND (telegram_chat_id IS NULL OR trim(telegram_chat_id)='')`)
          .bind(generated,row.id).run();
      }
      const fresh=await env.DB.prepare(`SELECT tg_link_token FROM users WHERE id=?
        AND aktif=1 AND (telegram_chat_id IS NULL OR trim(telegram_chat_id)='')`).bind(row.id)
        .first<{tg_link_token:string|null}>();
      token=String(fresh?.tg_link_token ?? '').trim();
      if (!token) continue; // User linked Telegram while the blast was running.
      const name=String(row.nama_penuh ?? '').trim() || 'Pengadil';
      const link=`https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(token)}`;
      const {html,text}=buildRefpahangEmail('Aktifkan Notifikasi Telegram',name,[
        'Sistem Pengurusan Pengadil PBNP menggunakan Telegram untuk menghantar notifikasi lantikan perlawanan.',
        'Hubungkan akaun anda untuk menerima notifikasi serta menerima atau menolak lantikan melalui Telegram.',
        `Buka pautan ini dan tekan START pada bot @${bot}.`,
      ],{label:'Aktifkan Telegram Sekarang',url:link});
      try {
        await sendRefpahangEmail(env,'admin',email,name,
          'Aktifkan Telegram — Sistem Pengurusan Pengadil PBNP',html,text);
        sent++;
      } catch {
        failed++;
        errors.push(email);
      }
    }
    return json({error:false,
      message:`Blast selesai. ${sent} emel berjaya dihantar${failed ? `, ${failed} gagal.` : '.'}`,
      sent,failed,errors});
  }
  if (request.method!=='GET') return json({error:true,message:'Kaedah tidak disokong.'},405);
  const row=await env.DB.prepare(`SELECT
    COUNT(*) AS total,
    COALESCE(SUM(CASE WHEN telegram_chat_id IS NOT NULL AND trim(telegram_chat_id)<>''
      THEN 1 ELSE 0 END),0) AS linked
    FROM users WHERE aktif=1 AND email IS NOT NULL AND email<>''`).first<{total:number;linked:number}>();
  const total=Number(row?.total ?? 0);
  const linked=Number(row?.linked ?? 0);
  return json({error:false,total,linked,not_linked:total-linked});
}

export async function externalTelegramBlastPreview(request:Request,env:Env):Promise<Response> {
  const user=await currentUser(request,env);
  if (!user) return json({error:true,message: 'Sesi tidak sah. Sila log masuk semula.'},401);
  if (user.role!=='Admin') return json({error:true,message:'Akses ditolak.'},403);
  if (request.method==='POST') {
    if (env.STAGING_WRITES_ENABLED!=='1' || env.BULK_EMAIL_ENABLED!=='1') {
      return json({error:true,message:'Penghantaran onboarding belum tersedia di staging.'},503);
    }
    const parsed=await boundedJson(request,4096);
    if (parsed instanceof Response) return parsed;
    const body=parsed && typeof parsed==='object' && !Array.isArray(parsed)
      ? parsed as Record<string,unknown> : {};
    const id=Number(body.kejohanan_id);
    const mode=body.mode===undefined ? 'initial' : body.mode;
    if (!Number.isSafeInteger(id) || id<=0) {
      return json({error:true,message:'kejohanan_id diperlukan.'},400);
    }
    if (mode!=='initial' && mode!=='resend') {
      return json({error:true,message:'Mode penghantaran tidak sah.'},400);
    }
    return sendExternalTelegramBlast(request,env,id,mode,user.id);
  }
  if (request.method!=='GET') return json({error:true,message:'Kaedah tidak disokong.'},405);
  const raw=new URL(request.url).searchParams.get('kejohanan_id');
  const id=Number(raw);
  if (!raw || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id)) {
    return json({error:true,message:'kejohanan_id diperlukan.'},400);
  }
  const data=await externalPreviewData(env,id);
  if (!data) return json({error:true,message:'Kejohanan tidak dijumpai.'},404);
  return json({error:false,data});
}

async function externalPreviewData(env:Env,id:number) {
  const tournament=await env.DB.prepare(`SELECT id,nama,status,tarikh_mula,tarikh_akhir
    FROM kejohanan WHERE id=? LIMIT 1`).bind(id).first();
  if (!tournament) return null;
  const [pool,batches]=await Promise.all([
    env.DB.prepare(`SELECT pl.id,pl.nama,pl.daerah,pl.negeri,pl.no_tel,pl.emel,
      pl.telegram_chat_id,pl.tg_link_token,pl.jenis_pengadil,
      os.attempts,os.first_sent_at,os.last_sent_at,os.last_failed_at,
      os.last_error,os.claimed_at,os.linked_at
      FROM pool_pengadil pp
      JOIN pengadil_luar pl ON pl.id=pp.pengadil_luar_id
      LEFT JOIN telegram_onboarding_state os
        ON os.kejohanan_id=pp.kejohanan_id AND os.pengadil_luar_id=pp.pengadil_luar_id
      WHERE pp.kejohanan_id=? AND pp.pengadil_luar_id IS NOT NULL
      ORDER BY pl.negeri ASC,pl.nama ASC,pl.id ASC`).bind(id).all<External>(),
    env.DB.prepare(`SELECT id,batch_token,attempt_mode,total_pool,targeted_count,
      sent_count,failed_count,skipped_count,status,actor_user_id,started_at,completed_at
      FROM telegram_onboarding_batch WHERE kejohanan_id=? ORDER BY id DESC LIMIT 10`)
      .bind(id).all(),
  ]);
  const counts={total_external:pool.results.length,linked:0,no_email:0,invalid_email:0,
    ready:0,failed:0,emailed_waiting:0,initial_sendable:0,resendable:0};
  const bot=(env.TELEGRAM_BOT_USERNAME || 'refpahang_bot').replace(/^@+/,'');
  const recipients=pool.results.sort((a,b)=>
    mysqlTextOrder(a.negeri,b.negeri) || mysqlTextOrder(a.nama,b.nama) || a.id-b.id
  ).map((row)=>{
    const {telegram_chat_id,tg_link_token,...rest}=row;
    const emel=String(row.emel ?? '').trim();
    const linked=String(telegram_chat_id ?? '').trim()!=='';
    const valid=EMAIL.test(emel);
    const status=linked ? 'linked' : !emel ? 'no_email' : !valid ? 'invalid_email'
      : row.first_sent_at ? 'emailed_waiting' : row.last_failed_at ? 'failed' : 'ready';
    counts[status]++;
    if (!linked && valid) {
      counts.resendable++;
      if (!row.first_sent_at) counts.initial_sendable++;
    }
    const token=String(tg_link_token ?? '').trim();
    return {...rest,id:Number(row.id),attempts:Number(row.attempts ?? 0),emel,
      telegram_linked:linked,email_valid:valid,onboarding_status:status,
      link_url:!linked && token ? `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(token)}` : null};
  });
  return {kejohanan:tournament,counts,recipients,recent_batches:batches.results};
}

function onboardingLog(env:Env,batch:OnboardingBatch,recipient:OnboardingRecipient,
  status:string,reason:string,link:string|null,error:string|null,actorId:number,meta:OnboardingMeta) {
  return env.DB.prepare(`INSERT INTO telegram_onboarding_log (
    batch_id,batch_token,kejohanan_id,kejohanan_nama,pengadil_luar_id,nama_pegawai,
    emel_pegawai,attempt_mode,event_status,reason,link_url,error_message,
    actor_user_id,ip_address,user_agent
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    batch.id,batch.batch_token,batch.kejohanan_id,batch.kejohanan_nama,
    recipient.id,recipient.nama,recipient.emel || null,batch.attempt_mode,
    status,reason,link,error,actorId,meta.ip,meta.userAgent,
  );
}

async function sendExternalTelegramBlast(request:Request,env:Env,id:number,
  mode:'initial'|'resend',actorId:number):Promise<Response> {
  const tournament=await env.DB.prepare('SELECT id,nama FROM kejohanan WHERE id=? LIMIT 1')
    .bind(id).first<{id:number;nama:string}>();
  if (!tournament) return json({error:true,message:'Kejohanan tidak dijumpai.'},404);
  const rows=await env.DB.prepare(`SELECT pl.id,pl.nama,pl.emel,pl.telegram_chat_id,
      pl.tg_link_token,os.first_sent_at,os.last_failed_at,os.attempts
    FROM pool_pengadil pp JOIN pengadil_luar pl ON pl.id=pp.pengadil_luar_id
    LEFT JOIN telegram_onboarding_state os
      ON os.kejohanan_id=pp.kejohanan_id AND os.pengadil_luar_id=pl.id
    WHERE pp.kejohanan_id=? AND pp.pengadil_luar_id IS NOT NULL
    ORDER BY pl.negeri,pl.nama,pl.id`).bind(id).all<OnboardingRecipient>();
  const batchToken=tokenHex();
  const meta:OnboardingMeta={
    ip:request.headers.get('CF-Connecting-IP'),
    userAgent:request.headers.get('User-Agent')?.slice(0,255) ?? null,
  };
  await env.DB.prepare(`INSERT INTO telegram_onboarding_batch
    (batch_token,kejohanan_id,kejohanan_nama,attempt_mode,total_pool,actor_user_id,
      ip_address,user_agent) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(batchToken,id,tournament.nama,mode,rows.results.length,actorId,meta.ip,meta.userAgent).run();
  const inserted=await env.DB.prepare('SELECT id FROM telegram_onboarding_batch WHERE batch_token=?')
    .bind(batchToken).first<{id:number}>();
  if (!inserted) throw new Error('Batch onboarding tidak dijumpai selepas disimpan.');
  const batch:OnboardingBatch={id:inserted.id,batch_token:batchToken,
    kejohanan_id:id,kejohanan_nama:tournament.nama,attempt_mode:mode};
  const bot=(env.TELEGRAM_BOT_USERNAME || 'refpahang_bot').replace(/^@+/,'');
  const linkFor=(token:string)=>`https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(token)}`;
  let sent=0,failed=0,skipped=0,consecutiveFailures=0;
  const errors:{pengadil_luar_id:number;nama:string;emel:string}[]=[];
  try {
    for (const recipient of rows.results) {
      const email=String(recipient.emel ?? '').trim();
      const linked=String(recipient.telegram_chat_id ?? '').trim()!=='';
      const link=recipient.tg_link_token && !linked ? linkFor(recipient.tg_link_token) : null;
      const reason=linked ? 'already_linked' : !email ? 'email_missing'
        : !EMAIL.test(email) ? 'email_invalid'
          : mode==='initial' && recipient.first_sent_at ? 'already_emailed'
            : consecutiveFailures>=3 ? 'smtp_circuit_open' : null;
      if (reason) {
        await onboardingLog(env,batch,recipient,'skipped',reason,link,null,actorId,meta).run();
        skipped++;
        continue;
      }
      await env.DB.prepare(`INSERT OR IGNORE INTO telegram_onboarding_state
        (kejohanan_id,pengadil_luar_id) VALUES (?,?)`).bind(id,recipient.id).run();
      const claim=tokenHex();
      const claimed=await env.DB.prepare(`UPDATE telegram_onboarding_state SET
        claim_token=?,claimed_at=datetime('now','+8 hours'),attempts=attempts+1,last_batch_id=?
        WHERE kejohanan_id=? AND pengadil_luar_id=?
          AND (?='resend' OR first_sent_at IS NULL)
          AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-10 minutes'))`)
        .bind(claim,batch.id,id,recipient.id,mode).run();
      if (!wroteRow(claimed)) {
        const state=await env.DB.prepare(`SELECT first_sent_at FROM telegram_onboarding_state
          WHERE kejohanan_id=? AND pengadil_luar_id=?`).bind(id,recipient.id)
          .first<{first_sent_at:string|null}>();
        const why=mode==='initial' && state?.first_sent_at ? 'already_emailed' : 'delivery_in_progress';
        await onboardingLog(env,batch,recipient,'skipped',why,link,null,actorId,meta).run();
        skipped++;
        continue;
      }
      await env.DB.prepare(`UPDATE pengadil_luar SET tg_link_token=? WHERE id=?
        AND (tg_link_token IS NULL OR trim(tg_link_token)='')`).bind(tokenHex(),recipient.id).run();
      const profile=await env.DB.prepare(`SELECT telegram_chat_id,tg_link_token FROM pengadil_luar
        WHERE id=?`).bind(recipient.id)
        .first<{telegram_chat_id:string|null;tg_link_token:string|null}>();
      const skipAfterClaim=!profile ? 'profile_missing'
        : String(profile.telegram_chat_id ?? '').trim()!=='' ? 'linked_during_batch'
          : !String(profile.tg_link_token ?? '').trim() ? 'token_missing' : null;
      if (skipAfterClaim) {
        await env.DB.batch([
          env.DB.prepare(`UPDATE telegram_onboarding_state SET claim_token=NULL,claimed_at=NULL
            WHERE kejohanan_id=? AND pengadil_luar_id=? AND claim_token=?`).bind(id,recipient.id,claim),
          onboardingLog(env,batch,recipient,'skipped',skipAfterClaim,null,null,actorId,meta),
        ]);
        skipped++;
        continue;
      }
      const freshLink=linkFor(String(profile?.tg_link_token));
      await onboardingLog(env,batch,recipient,'processing','smtp_attempt_started',
        freshLink,null,actorId,meta).run();
      let delivered=false;
      try {
        const {html,text}=buildRefpahangEmail('Pautkan Telegram Sebelum Lantikan',recipient.nama,[
          `Nama anda telah dimasukkan dalam pool pengadil luar bagi ${tournament.nama}. Sila pautkan akaun Telegram anda sebelum lantikan perlawanan dihantar.`,
          'INI BUKAN LANTIKAN PERLAWANAN. Tiada tindakan Terima atau Tolak diperlukan sekarang dan tempoh jawapan lantikan belum bermula.',
          `Klik pautan, buka bot @${bot}, kemudian tekan START. Pautan ini peribadi; jangan kongsikan dengan orang lain.`,
        ],{label:'Pautkan Telegram Sekarang',url:freshLink});
        await sendRefpahangEmail(env,'lantikan',email,recipient.nama,
          `Pautkan Telegram Sebelum Lantikan — ${tournament.nama}`,html,text);
        delivered=true;
      } catch {
        // Do not retain provider errors, which may include credentials or addresses.
      }
      const error=delivered ? null : 'Penghantaran emel gagal.';
      const completed=await runGuarded(env,[
        guardStatement(env,'telegram_onboarding_complete',
          `EXISTS(SELECT 1 FROM telegram_onboarding_state
            WHERE kejohanan_id=? AND pengadil_luar_id=? AND claim_token=?)`,
          [id,recipient.id,claim]),
        env.DB.prepare(`UPDATE telegram_onboarding_state SET
          first_sent_at=CASE WHEN ?=1 THEN COALESCE(first_sent_at,datetime('now','+8 hours')) ELSE first_sent_at END,
          last_sent_at=CASE WHEN ?=1 THEN datetime('now','+8 hours') ELSE last_sent_at END,
          last_failed_at=CASE WHEN ?=0 THEN datetime('now','+8 hours') ELSE last_failed_at END,
          last_error=?,claim_token=NULL,claimed_at=NULL
          WHERE kejohanan_id=? AND pengadil_luar_id=? AND claim_token=?`)
          .bind(delivered?1:0,delivered?1:0,delivered?1:0,error,id,recipient.id,claim),
        onboardingLog(env,batch,recipient,delivered?'sent':'failed',
          delivered?'smtp_accepted':'smtp_failed',freshLink,error,actorId,meta),
      ]);
      if (!completed) throw new Error('Claim penghantaran berubah sebelum keputusan disimpan.');
      if (delivered) {sent++;consecutiveFailures=0;}
      else {
        failed++;consecutiveFailures++;
        errors.push({pengadil_luar_id:recipient.id,nama:recipient.nama,emel:email});
      }
    }
    const targeted=sent+failed;
    await env.DB.prepare(`UPDATE telegram_onboarding_batch SET targeted_count=?,sent_count=?,
      failed_count=?,skipped_count=?,status=?,completed_at=datetime('now','+8 hours')
      WHERE id=?`).bind(targeted,sent,failed,skipped,
      failed ? sent ? 'partial' : 'failed' : 'completed',batch.id).run();
    let message=targeted===0 ? 'Tiada emel onboarding baharu untuk dihantar.'
      : `Blast selesai: ${sent} berjaya, ${failed} gagal, ${skipped} dilangkau.`;
    if (consecutiveFailures>=3) {
      message+=' Baki penerima tidak dicuba selepas tiga kegagalan SMTP berturut-turut.';
    }
    return json({error:false,message,batch_id:batch.id,mode,sent,failed,skipped,errors,
      smtp_circuit_open:consecutiveFailures>=3,data:await externalPreviewData(env,id)});
  } catch {
    await env.DB.batch([
      env.DB.prepare(`UPDATE telegram_onboarding_state SET claim_token=NULL,claimed_at=NULL
        WHERE last_batch_id=? AND claim_token IS NOT NULL`).bind(batch.id),
      env.DB.prepare(`UPDATE telegram_onboarding_batch SET status='failed',
        targeted_count=?,sent_count=?,failed_count=?,skipped_count=?,
        completed_at=datetime('now','+8 hours') WHERE id=? AND status='processing'`)
        .bind(sent+failed,sent,failed,skipped,batch.id),
    ]);
    return json({error:true,message:'Ralat semasa menghantar onboarding Telegram.'},500);
  }
}
