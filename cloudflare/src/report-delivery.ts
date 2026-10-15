import {buildRefpahangEmail,sendRefpahangEmail} from '../mail';
import type {Env} from './types';

type Job={delivery_key:string;approval_id:number;report_id:number;
  recipient_lantikan_id:number;channel:'email'|'telegram';attempts:number};
type Context={status:string;approval_status:string;recipient_status:string;
  recipient_name:string|null;recipient_email:string|null;recipient_chat_id:number|null;
  jawatan:string;markah:number|null;prestasi:string|null;
  kawalan_kekuatan:string|null;kawalan_kelemahan:string|null;kawalan_nasihat:string|null;
  fizikal_kekuatan:string|null;fizikal_kelemahan:string|null;fizikal_nasihat:string|null;
  kerjasama_kekuatan:string|null;kerjasama_kelemahan:string|null;kerjasama_nasihat:string|null;
  ulasan_keseluruhan:string|null;catatan_pengerusi:string|null;
  nama_penilai:string;nama_kejohanan:string;tarikh:string;
  pasukan_home:string;pasukan_away:string;penilaian_token:string|null};

export interface ReportSenders {
  email?:(env:Env,to:string,name:string,subject:string,html:string,text:string)=>Promise<unknown>;
  telegram?:(env:Env,chatId:number,message:string,url:string)=>Promise<unknown>;
}

function esc(value:string):string {
  return value.replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',
    '"':'&quot;',"'":'&#39;'}[char] ?? char));
}
function points(raw:string|null):string {
  try {const list:unknown=JSON.parse(raw ?? '');return Array.isArray(list)
    ? list.filter((item):item is string=>typeof item==='string').join('; ') : '';}
  catch {return '';}
}
async function viewUrl(env:Env,reportId:number,secret:string):Promise<string> {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',key,
    new TextEncoder().encode(`laporan-penilaian:view:${reportId}`));
  const token=Array.from(new Uint8Array(signed),
    (byte)=>byte.toString(16).padStart(2,'0')).join('');
  return `${env.BASE_URL.replace(/\/$/,'')}/api/download-laporan-penilaian.php?id=${reportId}&view_token=${token}`;
}
async function context(env:Env,job:Job):Promise<Context|null> {
  return env.DB.prepare(`SELECT r.status,a.status AS approval_status,
    lp.status AS recipient_status,
    COALESCE(u.nama_penuh,pl.nama) AS recipient_name,
    COALESCE(u.email,pl.emel) AS recipient_email,
    COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS recipient_chat_id,
    p.jawatan,p.markah,p.prestasi,p.kawalan_kekuatan,p.kawalan_kelemahan,
    p.kawalan_nasihat,p.fizikal_kekuatan,p.fizikal_kelemahan,p.fizikal_nasihat,
    p.kerjasama_kekuatan,p.kerjasama_kelemahan,p.kerjasama_nasihat,
    r.ulasan_keseluruhan,a.catatan_pengerusi,
    COALESCE(ra_user.nama_penuh,ra_external.nama,'Penilai Pengadil') AS nama_penilai,
    k.nama AS nama_kejohanan,jp.tarikh,jp.pasukan_home,jp.pasukan_away,
    ra.penilaian_token
    FROM worker_report_deliveries d
    JOIN worker_report_confirmations c ON c.approval_id=d.approval_id
      AND c.report_id=d.report_id AND c.integrity_checked=1
    JOIN laporan_pengesahan_pengerusi a ON a.id=c.approval_id
    JOIN laporan_penilaian r ON r.id=c.report_id
    JOIN laporan_penilaian_pegawai p ON p.laporan_id=r.id
      AND p.lantikan_pengadil_id=d.recipient_lantikan_id
    JOIN lantikan_pengadil lp ON lp.id=p.lantikan_pengadil_id AND lp.jadual_id=r.jadual_id
    JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id
    JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    LEFT JOIN users ra_user ON ra_user.id=ra.pengadil_id
    LEFT JOIN pengadil_luar ra_external ON ra_external.id=ra.pengadil_luar_id
    WHERE d.delivery_key=? AND d.approval_id=? AND d.report_id=? LIMIT 1`)
    .bind(job.delivery_key,job.approval_id,job.report_id).first<Context>();
}
async function complete(env:Env,job:Job,status:'sent'|'skipped'|'pending',error=''):
  Promise<boolean> {
  const seconds=Math.min(3600,60*2**Math.min(Math.max(job.attempts,0),6));
  const result=await env.DB.batch([
    env.DB.prepare(`UPDATE worker_report_deliveries SET status=?,claimed_at=NULL,
      completed_at=CASE WHEN ?='pending' THEN NULL ELSE datetime('now','+8 hours') END,
      next_attempt_at=CASE WHEN ?='pending' THEN datetime('now','+8 hours',?) ELSE NULL END,
      last_error=? WHERE delivery_key=? AND status='pending' AND attempts=?
      AND claimed_at IS NOT NULL`).bind(status,status,status,`+${seconds} seconds`,
      error.slice(0,500)||null,job.delivery_key,job.attempts),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
      (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,actor_type,
       details_json,created_at)
      SELECT approval_id,report_id,'kup_report_notification',channel,?,
        'system',?,datetime('now','+8 hours') FROM worker_report_deliveries
      WHERE delivery_key=? AND status=? AND attempts=? AND completed_at IS NOT NULL`)
      .bind(status==='sent'?'success':status,
        JSON.stringify({lantikan_id:job.recipient_lantikan_id,reason:error||undefined}),
        job.delivery_key,status,job.attempts),
  ]);
  return result[0].meta.changes===1;
}

async function sendTelegram(env:Env,chatId:number,message:string,url:string):Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram sender unavailable');
  const response=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:chatId,text:message,parse_mode:'HTML',
      reply_markup:{inline_keyboard:[[{text:'Lihat Laporan Penuh',url}]]}}),
  });
  if (!response.ok || !(await response.json() as {ok?:boolean}).ok) {
    throw new Error('Telegram delivery failed');
  }
}

/** Retryable notifications created only by an explicit Worker confirmation. */
export async function processReportDeliveries(env:Env,limit=20,senders:ReportSenders={}):
  Promise<{processed:number;sent:number;failed:number;skipped:number}> {
  const counts={processed:0,sent:0,failed:0,skipped:0};
  if (env.REPORT_DELIVERY_ENABLED!=='1' || env.STAGING_AUTH_ENABLED!=='1' ||
      env.STAGING_WRITES_ENABLED!=='1') return counts;
  const pending=await env.DB.prepare(`SELECT delivery_key,approval_id,report_id,
    recipient_lantikan_id,channel,attempts FROM worker_report_deliveries
    WHERE status='pending'
      AND (next_attempt_at IS NULL OR next_attempt_at<=datetime('now','+8 hours'))
      AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-5 minutes'))
    ORDER BY created_at,delivery_key LIMIT ?`).bind(Math.max(1,Math.min(limit,50))).all<Job>();
  for (const candidate of pending.results) {
    const claimed=await env.DB.prepare(`UPDATE worker_report_deliveries
      SET claimed_at=datetime('now','+8 hours'),attempts=attempts+1
      WHERE delivery_key=? AND status='pending'
        AND (next_attempt_at IS NULL OR next_attempt_at<=datetime('now','+8 hours'))
        AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-5 minutes'))`)
      .bind(candidate.delivery_key).run();
    if (claimed.meta.changes!==1) continue;
    const job={...candidate,attempts:candidate.attempts+1};
    counts.processed++;
    try {
      const row=await context(env,job);
      if (!row || row.status!=='Disahkan' || row.approval_status!=='Disahkan' ||
          row.recipient_status!=='Diterima' || !row.penilaian_token) {
        await complete(env,job,'skipped','Report or recipient no longer valid');
        counts.skipped++;continue;
      }
      const url=await viewUrl(env,job.report_id,row.penilaian_token);
      const match=`${row.pasukan_home} lwn ${row.pasukan_away}`;
      const subject=`Laporan Penilaian Disahkan — ${match}`;
      const name=row.recipient_name || 'Pegawai Perlawanan';
      const mark=row.markah===null ? '-' : Number(row.markah).toFixed(1);
      const paragraphs=[
        `Laporan penilaian ${row.jawatan} untuk ${match} (${row.nama_kejohanan}) pada ${row.tarikh.slice(0,10)} telah disahkan.`,
        `Markah: ${mark}/10. Prestasi: ${row.prestasi||'-'}. Penilai: ${row.nama_penilai}.`,
        ...(['kawalan','fizikal','kerjasama'] as const).flatMap((section)=>[
          points(row[`${section}_kekuatan`]) && `${section}: Kekuatan — ${points(row[`${section}_kekuatan`])}`,
          points(row[`${section}_kelemahan`]) && `${section}: Penambahbaikan — ${points(row[`${section}_kelemahan`])}`,
          row[`${section}_nasihat`] && `${section}: Nasihat — ${row[`${section}_nasihat`]}`,
        ].filter((value):value is string=>Boolean(value))),
        row.ulasan_keseluruhan ? `Ulasan keseluruhan: ${row.ulasan_keseluruhan}` : '',
        row.catatan_pengerusi ? `Catatan Pengerusi Pengadil: ${row.catatan_pengerusi}` : '',
      ].filter(Boolean);
      if (job.channel==='email') {
        const address=row.recipient_email?.trim();
        if (!address) {await complete(env,job,'skipped','Email missing');counts.skipped++;continue;}
        const content=buildRefpahangEmail(subject,name,paragraphs,
          {label:'Lihat Laporan Penuh',url});
        if (senders.email) await senders.email(env,address,name,subject,content.html,content.text);
        else await sendRefpahangEmail(env,'pengesahan',address,name,subject,content.html,content.text);
      } else {
        if (!row.recipient_chat_id) {
          await complete(env,job,'skipped','Telegram unlinked');counts.skipped++;continue;
        }
        const message=`📋 <b>Laporan Penilaian Disahkan</b>\n\n⚽ ${esc(match)}\n🏆 ${esc(row.nama_kejohanan)}\n👤 ${esc(row.jawatan)}\n📊 Markah: ${esc(mark)}/10\n🔍 Penilai: ${esc(row.nama_penilai)}`;
        if (senders.telegram) await senders.telegram(env,row.recipient_chat_id,message,url);
        else await sendTelegram(env,row.recipient_chat_id,message,url);
      }
      if (await complete(env,job,'sent')) counts.sent++;
    } catch(error) {
      console.error('RA report delivery failed',job.channel,
        error instanceof Error ? error.name : 'UnknownError');
      await complete(env,job,'pending','Penghantaran gagal; percubaan semula dijadualkan.');
      counts.failed++;
    }
  }
  return counts;
}
