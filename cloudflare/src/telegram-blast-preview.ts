import {buildRefpahangEmail,sendRefpahangEmail} from '../mail';
import {currentUser,json} from './auth';
import {mysqlTextOrder} from './php/mysql-order';
import type {Env} from './types';

type External = Record<string,unknown> & {
  id:number;emel:string|null;telegram_chat_id:string|null;tg_link_token:string|null;
  attempts:number|null;first_sent_at:string|null;last_failed_at:string|null;
};

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Invitee = {id:number;nama_penuh:string|null;email:string;tg_link_token:string|null};

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
  if (request.method==='POST') return json({error:true,message:'Penghantaran onboarding belum tersedia di staging.'},503);
  if (request.method!=='GET') return json({error:true,message:'Kaedah tidak disokong.'},405);
  const raw=new URL(request.url).searchParams.get('kejohanan_id');
  const id=Number(raw);
  if (!raw || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id)) {
    return json({error:true,message:'kejohanan_id diperlukan.'},400);
  }
  const tournament=await env.DB.prepare(`SELECT id,nama,status,tarikh_mula,tarikh_akhir
    FROM kejohanan WHERE id=? LIMIT 1`).bind(id).first();
  if (!tournament) return json({error:true,message:'Kejohanan tidak dijumpai.'},404);
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
  return json({error:false,data:{kejohanan:tournament,counts,recipients,recent_batches:batches.results}});
}
