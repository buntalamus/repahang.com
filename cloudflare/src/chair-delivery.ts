import {buildRefpahangEmail,sendRefpahangEmail} from '../mail';
import type {Env} from './types';

type Job={delivery_key:string;approval_id:number;report_id:number;token_tag:string;
  channel:'email'|'telegram';attempts:number};
type Context={approval_id:number;approval_status:string;report_status:string;
  approval_token:string|null;mapping_id:number|null;mapping_active:number|null;
  pengesah_nama:string|null;pengesah_jawatan:string|null;
  email_recipient:string|null;telegram_chat_id:number|null;
  current_email:string|null;current_chat_id:number|null;
  nama_kejohanan:string;pasukan_home:string;pasukan_away:string;tarikh:string;
  nama_penilai:string};

export interface ChairSenders {
  email?:(env:Env,to:string,name:string,subject:string,html:string,text:string)=>Promise<unknown>;
  telegram?:(env:Env,chatId:number,message:string,url:string)=>Promise<unknown>;
}

function esc(value:string):string {
  return value.replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',
    '"':'&quot;',"'":'&#39;'}[char] ?? char));
}

async function sendTelegram(env:Env,chatId:number,message:string,url:string):Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram sender unavailable');
  const response=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:chatId,text:message,parse_mode:'HTML',
      reply_markup:{inline_keyboard:[[{text:'Semak & Sahkan Laporan',url}]]}}),
  });
  if (!response.ok || !(await response.json() as {ok?:boolean}).ok) {
    throw new Error('Telegram delivery failed');
  }
}

async function getContext(env:Env,job:Job):Promise<Context|null> {
  return env.DB.prepare(`SELECT a.id AS approval_id,a.status AS approval_status,
    r.status AS report_status,a.approval_token,a.kejohanan_pengesah_id AS mapping_id,
    kp.aktif AS mapping_active,a.pengesah_nama,a.pengesah_jawatan,
    a.email_recipient,a.telegram_chat_id,
    COALESCE(u.email,pl.emel) AS current_email,
    COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS current_chat_id,
    k.nama AS nama_kejohanan,jp.pasukan_home,jp.pasukan_away,jp.tarikh,
    COALESCE(ra_user.nama_penuh,ra_luar.nama,'Penilai Pengadil') AS nama_penilai
    FROM worker_chair_jobs d
    JOIN laporan_penilaian r ON r.id=d.report_id
    JOIN laporan_pengesahan_pengerusi a ON a.id=d.approval_id AND a.laporan_id=r.id
    JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id
    LEFT JOIN users ra_user ON ra_user.id=ra.pengadil_id
    LEFT JOIN pengadil_luar ra_luar ON ra_luar.id=ra.pengadil_luar_id
    LEFT JOIN kejohanan_pengesah_laporan kp ON kp.id=a.kejohanan_pengesah_id
      AND kp.kejohanan_id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=kp.pengesah_user_id
    LEFT JOIN pengadil_luar pl ON pl.id=kp.pengesah_luar_id
    WHERE d.delivery_key=? AND d.report_id=?
      AND d.token_tag=substr(COALESCE(a.approval_token,''),1,16) LIMIT 1`)
    .bind(job.delivery_key,job.report_id).first<Context>();
}

async function complete(env:Env,job:Job,approvalId:number|null,
  status:'sent'|'skipped'|'pending',reason:string):Promise<void> {
  const seconds=Math.min(3600,60*2**Math.min(Math.max(job.attempts,0),6));
  const result=await env.DB.batch([
    env.DB.prepare(`UPDATE worker_chair_jobs SET status=?,claimed_at=NULL,
      completed_at=CASE WHEN ?='pending' THEN NULL ELSE datetime('now','+8 hours') END,
      next_attempt_at=CASE WHEN ?='pending' THEN datetime('now','+8 hours',?) ELSE NULL END,
      last_error=? WHERE delivery_key=? AND status='pending' AND attempts=?
        AND claimed_at IS NOT NULL`).bind(status,status,status,`+${seconds} seconds`,
        reason||null,job.delivery_key,job.attempts),
    env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET
      ${job.channel}_attempts=${job.channel}_attempts+1,
      ${job.channel}_sent_at=CASE WHEN ?='sent' THEN datetime('now','+8 hours')
        ELSE ${job.channel}_sent_at END,
      ${job.channel}_claimed_at=NULL,
      ${job.channel}_last_error=CASE WHEN ?='sent' THEN NULL ELSE ? END,
      updated_at=datetime('now','+8 hours')
      WHERE id=? AND EXISTS(SELECT 1 FROM worker_chair_jobs
        WHERE delivery_key=? AND status=? AND attempts=?)`)
      .bind(status,status,reason||null,approvalId,job.delivery_key,status,job.attempts),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
      (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,actor_type,
       details_json,created_at)
      SELECT ?,?,'chair_notification',?,?,'system',?,datetime('now','+8 hours')
      WHERE ? IS NOT NULL AND EXISTS(SELECT 1 FROM worker_chair_jobs
        WHERE delivery_key=? AND status=? AND attempts=? AND completed_at IS NOT NULL)`)
      .bind(approvalId,job.report_id,job.channel,status==='sent'?'success':status,
        JSON.stringify({reason:reason||undefined}),approvalId,
        job.delivery_key,status,job.attempts),
  ]);
  if (result[0].meta.changes!==1) throw new Error('Chair delivery claim lost');
}

/** Only jobs the Worker queued are eligible; stage switches gate all sends. */
export async function processChairDeliveries(env:Env,limit=20,senders:ChairSenders={},
  approvalId:number|null=null):
  Promise<{processed:number;sent:number;skipped:number;failed:number}> {
  const counts={processed:0,sent:0,skipped:0,failed:0};
  if (env.REPORT_DELIVERY_ENABLED!=='1' || env.STAGING_AUTH_ENABLED!=='1' ||
      env.STAGING_WRITES_ENABLED!=='1') return counts;
  const jobs=await env.DB.prepare(`SELECT delivery_key,approval_id,report_id,token_tag,
    channel,attempts FROM worker_chair_jobs WHERE status='pending' AND (? IS NULL OR approval_id=?)
      AND (next_attempt_at IS NULL OR next_attempt_at<=datetime('now','+8 hours'))
      AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-5 minutes'))
    ORDER BY created_at,delivery_key LIMIT ?`)
    .bind(approvalId,approvalId,Math.max(1,Math.min(limit,50))).all<Job>();
  for (const candidate of jobs.results) {
    const claimed=await env.DB.prepare(`UPDATE worker_chair_jobs SET
      claimed_at=datetime('now','+8 hours'),attempts=attempts+1
      WHERE delivery_key=? AND status='pending'
        AND (next_attempt_at IS NULL OR next_attempt_at<=datetime('now','+8 hours'))
        AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-5 minutes'))`)
      .bind(candidate.delivery_key).run();
    if (claimed.meta.changes!==1) continue;
    const job={...candidate,attempts:candidate.attempts+1};
    counts.processed++;
    let contextId:number|null=null;
    try {
      const row=await getContext(env,job);
      contextId=row?.approval_id??null;
      if (!row || row.approval_status!=='Menunggu' || row.report_status!=='Dihantar' ||
          row.mapping_active!==1 || !row.approval_token) {
        await complete(env,job,contextId,'skipped','Laporan, Pengerusi atau token tidak lagi aktif.');
        counts.skipped++;continue;
      }
      const recipient=job.channel==='email' ? row.email_recipient?.trim() : row.telegram_chat_id;
      const current=job.channel==='email' ? row.current_email?.trim() : row.current_chat_id;
      if (!recipient || recipient!==current) {
        await complete(env,job,contextId,'skipped','Alamat Pengerusi tiada atau telah berubah.');
        counts.skipped++;continue;
      }
      const base=env.BASE_URL.replace(/\/$/,'');
      const url=`${base}/api/laporan-pengesahan-token.php?token=${row.approval_token}`;
      const preview=`${base}/api/download-laporan-penilaian.php?id=${job.report_id}&approval_token=${row.approval_token}`;
      const match=`${row.pasukan_home} lwn ${row.pasukan_away}`;
      const subject=`Pengesahan Laporan RA — ${match}`;
      const name=row.pengesah_nama||'Pengerusi Pengadil';
      if (job.channel==='email') {
        const content=buildRefpahangEmail(subject,name,[
          `Satu laporan Penilai Pengadil telah dihantar dan memerlukan pengesahan anda sebagai ${row.pengesah_jawatan||'Pengerusi Pengadil'}.`,
          `Kejohanan: ${row.nama_kejohanan}. Perlawanan: ${match}. Tarikh: ${row.tarikh.slice(0,10)}. Penilai: ${row.nama_penilai}.`,
          'Sila semak laporan penuh, tulis komen jika perlu, kemudian buat pengesahan.',
          `Laporan penuh (baca sahaja): ${preview}`,
        ],{label:'Semak & Sahkan Laporan',url});
        if (senders.email) await senders.email(env,String(recipient),name,subject,content.html,content.text);
        else await sendRefpahangEmail(env,'lantikan',String(recipient),name,subject,content.html,content.text);
      } else {
        const message=`📋 <b>Pengesahan Laporan RA</b>\n\n🏆 ${esc(row.nama_kejohanan)}\n⚽ ${esc(match)}\n🔍 Penilai: ${esc(row.nama_penilai)}\nSila semak laporan dan sahkan.`;
        if (senders.telegram) await senders.telegram(env,Number(recipient),message,url);
        else await sendTelegram(env,Number(recipient),message,url);
      }
      await complete(env,job,contextId,'sent','');counts.sent++;
    } catch(error) {
      console.error('RA chair delivery failed',job.channel,
        error instanceof Error ? error.name : 'UnknownError');
      await complete(env,job,contextId,'pending','Penghantaran gagal; percubaan semula dijadualkan.');
      counts.failed++;
    }
  }
  return counts;
}
