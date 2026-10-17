import { buildRefpahangEmail, sendRefpahangEmail, type MailType } from '../mail';
import { SmtpRejection } from '../smtp';
import { currentUser, json } from './auth';
import { wroteRow } from './d1-changes';
import { boundedJson } from './request';
import { directoryRecipients, mailboxDirectory, mailYear, recipientFilter } from './mailbox-directory';
import { archiveSentCopy } from './mailbox-archive';
import { processTelegramBlast, telegramBlastEnabled } from './telegram-blast';
import type { Env } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAILBOX = /^(admin|daftar|lantikan|support|pengesahan)@refpahang\.com$/;
type Campaign = { id:string; created_by:number; mailbox:string; subject:string; content:string; fingerprint:string; status:string };
type Target = { email:string; name:string; message_id:string };
const summarySql = `SELECT c.id,c.mailbox,c.subject,c.status,c.total,c.created_at,c.confirmed_at,
  u.nama_penuh AS created_by_name,
  SUM(CASE WHEN r.status='sent' THEN 1 ELSE 0 END) AS sent,
  SUM(CASE WHEN r.status='pending' THEN 1 ELSE 0 END) AS pending,
  SUM(CASE WHEN r.status='processing' THEN 1 ELSE 0 END) AS processing,
  SUM(CASE WHEN r.status='failed' THEN 1 ELSE 0 END) AS failed,
  SUM(CASE WHEN r.status='uncertain' THEN 1 ELSE 0 END) AS uncertain,
  SUM(CASE WHEN r.status='cancelled' THEN 1 ELSE 0 END) AS cancelled
  FROM mailbox_campaigns c LEFT JOIN users u ON u.id=c.created_by
  LEFT JOIN mailbox_campaign_recipients r ON r.campaign_id=c.id`;

async function detail(env: Env, id: string) {
  const campaign = await env.DB.prepare(`${summarySql} WHERE c.id=? GROUP BY c.id`).bind(id).first();
  if (!campaign) return null;
  const message = await env.DB.prepare('SELECT content,selection_json FROM mailbox_campaigns WHERE id=?').bind(id)
    .first<{content:string;selection_json:string}>();
  const recipients = await env.DB.prepare('SELECT email,name,status,error FROM mailbox_campaign_recipients WHERE campaign_id=? ORDER BY name,email')
    .bind(id).all();
  return { ...campaign, content: message?.content, selection: JSON.parse(message?.selection_json || '{}'), recipients: recipients.results };
}
function enabled(env: Env): boolean {
  return env.STAGING_WRITES_ENABLED === '1' && env.BULK_EMAIL_ENABLED === '1' && env.MAILBOX_SEND_ENABLED === '1';
}
export async function adminMailboxCampaigns(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({error:true,message:'Sila log masuk.'},401);
  if (user.role !== 'Admin') return json({error:true,message:'Akses ditolak.'},403);
  const url = new URL(request.url);
  if (request.method === 'GET') {
    if (url.searchParams.get('view') === 'directory') {
      const year = mailYear(url.searchParams.get('year'));
      if (!year) return json({error:true,message:'Tahun tidak sah.'},422);
      return json({error:false,data:await mailboxDirectory(env,year)});
    }
    const id = url.searchParams.get('id');
    if (id) {
      if (!UUID.test(id)) return json({error:true,message:'ID tidak sah.'},422);
      const data = await detail(env,id);
      return data ? json({error:false,data}) : json({error:true,message:'Blast tidak dijumpai.'},404);
    }
    const page = Math.max(1,Math.min(10000,Math.floor(Number(url.searchParams.get('page')) || 1)));
    const rows = await env.DB.prepare(`${summarySql} GROUP BY c.id ORDER BY c.created_at DESC,c.id DESC LIMIT 20 OFFSET ?`)
      .bind((page-1)*20).all();
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM mailbox_campaigns').first<{total:number}>();
    return json({error:false,data:rows.results,total:count?.total || 0,page,enabled:enabled(env)});
  }
  if (request.method !== 'POST') return json({error:true,message:'Kaedah tidak dibenarkan.'},405);
  if (!enabled(env)) return json({error:true,message:'Penghantaran blast belum diaktifkan.'},503);
  const input = await boundedJson(request,512*1024);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({error:true,message:'Data tidak sah.'},422);
  const body = input as Record<string,unknown>;
  if (typeof body.id !== 'string' || !UUID.test(body.id)) return json({error:true,message:'ID permintaan tidak sah.'},422);
  const id = body.id;
  if (body.action === 'preview') {
    const year = mailYear(body.year), filter = recipientFilter(body);
    const from = typeof body.from === 'string' ? body.from : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const content = typeof body.text === 'string' ? body.text.trim() : '';
    if (!year || !filter || !MAILBOX.test(from) || !subject || subject.length > 250 || /[\r\n\0]/.test(subject) ||
        !content || new TextEncoder().encode(content).byteLength > 12000) {
      return json({error:true,message:'Semak kumpulan, tahun, penghantar, tajuk dan kandungan (maksimum 12,000 bait).'},422);
    }
    const selection = JSON.stringify({year,...filter});
    const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([user.id,from,subject,content,selection])));
    const fingerprint = Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
    const existing = await env.DB.prepare('SELECT fingerprint FROM mailbox_campaigns WHERE id=?').bind(id).first<{fingerprint:string}>();
    if (existing) return existing.fingerprint === fingerprint ? json({error:false,data:await detail(env,id)})
      : json({error:true,message:'Draf telah berubah. Mulakan semakan baharu.'},409);
    const directory = await mailboxDirectory(env,year);
    const recipients = directoryRecipients(directory.contacts,filter);
    if (!recipients.length || recipients.length > 5000) return json({error:true,message:'Pilih antara 1 hingga 5,000 alamat emel yang sah.'},422);
    const snapshotToken = crypto.randomUUID();
    // One atomic D1 batch, with one JSON parameter instead of N recipient INSERTs.
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO mailbox_campaigns(id,created_by,fingerprint,snapshot_token,mailbox,subject,content,selection_json,total)
        VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,user.id,fingerprint,snapshotToken,from,subject,content,selection,recipients.length),
      env.DB.prepare(`INSERT OR IGNORE INTO mailbox_campaign_recipients(campaign_id,email,name)
        SELECT ?,json_extract(value,'$.email'),json_extract(value,'$.name') FROM json_each(?)
        WHERE EXISTS(SELECT 1 FROM mailbox_campaigns WHERE id=? AND snapshot_token=? AND status='draft')`)
        .bind(id,JSON.stringify(recipients.map(r=>({email:r.email,name:r.name}))),id,snapshotToken),
    ]);
    const stored = await env.DB.prepare('SELECT fingerprint FROM mailbox_campaigns WHERE id=?').bind(id).first<{fingerprint:string}>();
    if (stored?.fingerprint !== fingerprint) return json({error:true,message:'ID draf telah digunakan. Mulakan semakan baharu.'},409);
    return json({error:false,data:await detail(env,id)});
  }
  if (body.action === 'confirm') {
    // The reviewed snapshot is immutable: confirmation accepts only its ID.
    const campaign = await env.DB.prepare('SELECT * FROM mailbox_campaigns WHERE id=?').bind(id).first<Campaign>();
    if (!campaign) return json({error:true,message:'Draf tidak dijumpai.'},404);
    if (campaign.created_by !== user.id) return json({error:true,message:'Hanya pencipta draf boleh mengesahkan penghantaran.'},403);
    if (campaign.status === 'cancelled') return json({error:true,message:'Blast telah dibatalkan.'},409);
    await env.DB.prepare("UPDATE mailbox_campaigns SET status='queued',confirmed_at=CURRENT_TIMESTAMP WHERE id=? AND status='draft'")
      .bind(id).run();
    return json({error:false,data:await detail(env,id)});
  }
  if (body.action === 'cancel') {
    await env.DB.batch([
      env.DB.prepare("UPDATE mailbox_campaigns SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('draft','queued')").bind(id),
      env.DB.prepare(`UPDATE mailbox_campaign_recipients SET status='cancelled' WHERE campaign_id=? AND status='pending'
        AND EXISTS(SELECT 1 FROM mailbox_campaigns WHERE id=? AND status='cancelled')`).bind(id,id),
    ]);
    const data = await detail(env,id);
    return data ? json({error:false,data}) : json({error:true,message:'Blast tidak dijumpai.'},404);
  }
  if (body.action === 'retry-failed') {
    await env.DB.batch([
      env.DB.prepare(`UPDATE mailbox_campaign_recipients SET status='pending',error=NULL,message_id=NULL,started_at=NULL
        WHERE campaign_id=? AND status='failed' AND EXISTS(SELECT 1 FROM mailbox_campaigns WHERE id=? AND status IN ('queued','completed'))`).bind(id,id),
      env.DB.prepare(`UPDATE mailbox_campaigns SET status='queued' WHERE id=? AND status IN ('queued','completed')
        AND EXISTS(SELECT 1 FROM mailbox_campaign_recipients WHERE campaign_id=? AND status='pending')`).bind(id,id),
    ]);
    const data = await detail(env,id);
    return data ? json({error:false,data}) : json({error:true,message:'Blast tidak dijumpai.'},404);
  }
  return json({error:true,message:'Tindakan tidak sah.'},422);
}

async function archive(env: Env, campaign: Campaign, target: Target) {
  const formatted = buildRefpahangEmail(campaign.subject,'',campaign.content.split(/\n\s*\n/));
  await archiveSentCopy(env,{id:target.message_id,mailbox:campaign.mailbox,to:target.email,subject:campaign.subject,
    html:formatted.html,text:formatted.text,requestId:`blast:${target.message_id}`});
  return formatted;
}
/**
 * Cron only; never start SMTP from preview/confirmation or retry an uncertain acceptance.
 * Mailbox campaigns and the Telegram linking blast share one lease and one budget of
 * ten addresses per five minutes; campaigns go first.
 */
export async function processMailboxCampaigns(env: Env): Promise<void> {
  const campaigns = enabled(env), telegram = telegramBlastEnabled(env);
  if (!campaigns && !telegram) return;
  const now = Math.floor(Date.now()/1000), token = crypto.randomUUID();
  const lease = await env.DB.prepare(`UPDATE mailbox_campaign_dispatch SET lock_token=?,lock_until=?,next_batch_at=?
    WHERE id=1 AND lock_until<=? AND next_batch_at<=?`).bind(token,now+1200,now+300,now,now).run();
  if (!wroteRow(lease)) return;
  let used = 0, paused = false;
  try {
    if (campaigns) ({used,paused} = await dispatchCampaigns(env,now));
    if (telegram && !paused && used < 10) await processTelegramBlast(env,10-used,now);
  } finally {
    await env.DB.prepare('UPDATE mailbox_campaign_dispatch SET lock_token=NULL,lock_until=0 WHERE id=1 AND lock_token=?').bind(token).run();
  }
}

async function dispatchCampaigns(env: Env, now: number): Promise<{used:number;paused:boolean}> {
  let used = 0, paused = false;
  // A terminated Worker may have reached SMTP. Such targets require reconciliation, never automatic resending.
  await env.DB.prepare(`UPDATE mailbox_campaign_recipients SET status='uncertain',error='Status SMTP belum pasti; semak folder Dihantar sebelum menghantar semula.'
    WHERE status='processing' AND started_at<?`).bind(now-1200).run();
  for (; used<10; used++) {
    const candidate = await env.DB.prepare(`SELECT c.* FROM mailbox_campaigns c WHERE c.status='queued'
      AND EXISTS(SELECT 1 FROM mailbox_campaign_recipients r WHERE r.campaign_id=c.id AND r.status='pending')
      ORDER BY c.confirmed_at,c.created_at,c.id LIMIT 1`).first<Campaign>();
    if (!candidate) break;
    const messageId = crypto.randomUUID();
    const claimed = await env.DB.prepare(`UPDATE mailbox_campaign_recipients SET status='processing',message_id=?,started_at=?
      WHERE campaign_id=? AND email=(SELECT email FROM mailbox_campaign_recipients WHERE campaign_id=? AND status='pending' ORDER BY email LIMIT 1)
        AND status='pending' AND EXISTS(SELECT 1 FROM mailbox_campaigns WHERE id=? AND status='queued')
      RETURNING email,name,message_id`).bind(messageId,now,candidate.id,candidate.id,candidate.id).all<Target>();
    const target = claimed.results[0];
    if (!target) continue;
    let smtpStarted = false;
    try {
      const formatted = await archive(env,candidate,target);
      smtpStarted = true;
      const providerId = await sendRefpahangEmail(env,candidate.mailbox.split('@')[0] as MailType,target.email,target.name,
        candidate.subject,formatted.html,formatted.text);
      await env.DB.batch([
        env.DB.prepare("UPDATE mailbox_messages SET delivery_status='sent',message_id=? WHERE id=?").bind(providerId,messageId),
        env.DB.prepare("UPDATE mailbox_campaign_recipients SET status='sent',completed_at=CURRENT_TIMESTAMP WHERE campaign_id=? AND email=? AND message_id=?")
          .bind(candidate.id,target.email,messageId),
      ]);
    } catch (error) {
      const uncertain = smtpStarted && !(error instanceof SmtpRejection);
      const status = uncertain ? 'uncertain' : 'failed';
      await env.DB.batch([
        env.DB.prepare('UPDATE mailbox_messages SET delivery_status=? WHERE id=?').bind(uncertain?'processing':'failed',messageId),
        env.DB.prepare('UPDATE mailbox_campaign_recipients SET status=?,error=? WHERE campaign_id=? AND email=? AND message_id=?')
          .bind(status,uncertain?'Status SMTP belum pasti; semak folder Dihantar.':smtpStarted?'Pelayan menolak emel; semak alamat atau had penghantaran sebelum cuba semula.':'Gagal menyediakan emel; boleh cuba semula.',candidate.id,target.email,messageId),
      ]);
      // Pause this run on infrastructure/SMTP failure rather than consuming the whole queue.
      used++;
      paused = true;
      break;
    }
  }
  await env.DB.prepare(`UPDATE mailbox_campaigns SET status='completed' WHERE status='queued'
    AND NOT EXISTS(SELECT 1 FROM mailbox_campaign_recipients r WHERE r.campaign_id=mailbox_campaigns.id AND r.status IN ('pending','processing'))`).run();
  return {used,paused};
}
