import type { Env } from './types';
import { baseUrl } from './php/email';
import { notifyUser } from './notify';

const labels: Record<string,string> = {
  appointment_created:'Lantikan baharu', appointment_reassigned:'Penggantian pengadil',
  appointment_deleted:'Lantikan dibuang', appointment_status_changed:'Perubahan status perlawanan',
  appointment_response:'Jawapan pengadil', appointment_auto_rejected:'Lantikan ditolak automatik',
  appointment_admin_acceptance_override:'Override penerimaan oleh Admin', appointment_dispatched:'Notifikasi lantikan dihantar',
};
type Delivery = {id:number;audit_id:number;recipient_user_id:number;recipient_email:string;recipient_name:string;attempts:number};

/** District copies for PP Daerah when an official declines or is auto-rejected (migration 0031).
 * Sent through Telegram and the in-app notice (app push); email only as the fallback.
 * Claimed per recipient; the copies contain no referee response/form tokens. */
export async function processDistrictAppointmentMail(env: Env, limit=30): Promise<{sent:number;failed:number}> {
  const result={sent:0,failed:0};
  const pending=await env.DB.prepare(`SELECT * FROM worker_district_appointment_mail
    WHERE completed_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at<=datetime('now','+8 hours'))
      AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-10 minutes'))
    ORDER BY id LIMIT ?`).bind(Math.max(1,Math.min(100,limit))).all<Delivery>();
  for (const row of pending.results) {
    const claim=await env.DB.prepare(`UPDATE worker_district_appointment_mail
      SET claimed_at=datetime('now','+8 hours'),attempts=attempts+1 WHERE id=? AND completed_at IS NULL
      AND (claimed_at IS NULL OR claimed_at<datetime('now','+8 hours','-10 minutes'))
      AND (next_attempt_at IS NULL OR next_attempt_at<=datetime('now','+8 hours')) RETURNING attempts`)
      .bind(row.id).first<{attempts:number}>();
    if (!claim) continue;
    const event=await env.DB.prepare(`SELECT a.event_type,a.nama_pegawai,a.jawatan,a.details_json,a.created_at,
      json_extract(dm.context_json,'$.pasukan_home') AS pasukan_home,
      json_extract(dm.context_json,'$.pasukan_away') AS pasukan_away,
      json_extract(dm.context_json,'$.tarikh') AS tarikh,json_extract(dm.context_json,'$.masa') AS masa,
      json_extract(dm.context_json,'$.tempat') AS tempat,json_extract(dm.context_json,'$.kejohanan') AS kejohanan,
      json_extract(dm.context_json,'$.actor_name') AS actor_name,u.role AS recipient_role,
      json_extract(dm.context_json,'$.nama_persatuan') AS nama_persatuan
      FROM lantikan_audit_log a JOIN kejohanan k ON k.id=a.kejohanan_id
      JOIN worker_district_appointment_mail dm ON dm.audit_id=a.id AND dm.id=?
      JOIN users u ON u.id=? AND u.aktif=1 AND lower(trim(u.email))=?
        AND (u.role='Admin' OR (u.role='PP Daerah'
          AND COALESCE(NULLIF(u.persatuan_id,0),u.district_id)=k.lantikan_persatuan_id))
      WHERE a.id=?`).bind(row.id,row.recipient_user_id,row.recipient_email,row.audit_id).first<Record<string,unknown>>();
    if (!event) {
      await env.DB.prepare(`UPDATE worker_district_appointment_mail SET completed_at=datetime('now','+8 hours'),
        claimed_at=NULL,last_error='Penerima atau akses daerah telah berubah.' WHERE id=?`).bind(row.id).run();
      continue;
    }
    let details: Record<string,unknown>={};
    try {const value:unknown=JSON.parse(String(event.details_json ?? '{}'));
      if(value && typeof value==='object' && !Array.isArray(value)) details=value as Record<string,unknown>;
    } catch { /* Historical events can have no JSON details. */ }
    const label=labels[String(event.event_type)] ?? 'Makluman lantikan';
    const rejected=event.event_type==='appointment_auto_rejected' || details.new_status==='Ditolak';
    if (event.recipient_role!=='PP Daerah' || !rejected) {
      await env.DB.prepare(`UPDATE worker_district_appointment_mail SET completed_at=datetime('now','+8 hours'),
        claimed_at=NULL,last_error='Dihentikan: salinan hanya untuk PP dan penolakan.' WHERE id=?`).bind(row.id).run();
      continue;
    }
    const match=`${event.pasukan_home ?? '-'} lwn ${event.pasukan_away ?? '-'}`;
    const reason=[details.reason,details.komen,details.comment].find((v) => typeof v==='string' && v.trim()) as string | undefined;
    const contact=await env.DB.prepare('SELECT telegram_chat_id FROM users WHERE id=?')
      .bind(row.recipient_user_id).first<{telegram_chat_id:string|number|null}>();
    const title=event.event_type==='appointment_auto_rejected' ? 'Lantikan ditolak automatik' : 'Lantikan ditolak';
    const outcome=await notifyUser(env,{userId:row.recipient_user_id,name:row.recipient_name,email:row.recipient_email,
      telegramChatId:contact?.telegram_chat_id ?? null},{
      subject:`[Daerah] ${title}: ${event.nama_pegawai} — ${match}`,
      title:`${title} — perlu pengganti`,
      mailType:'lantikan',
      paragraphs:[`${event.nama_pegawai} (${event.jawatan}) ${event.event_type==='appointment_auto_rejected'
        ? 'tidak menjawab dalam tempoh dan lantikan ditolak automatik' : 'menolak lantikan'}. Sila lantik pengganti.`],
      rows:[['Kejohanan',String(event.kejohanan ?? '-')],['Perlawanan',match],
        ['Tarikh / Masa',`${event.tarikh ?? '-'} ${event.masa ?? ''}`.trim()],['Tempat',String(event.tempat ?? '-')],
        ...(reason ? [['Sebab',reason] as [string,string]] : [])],
      actions:[{label:'Lantik pengganti',url:`${baseUrl(env)}/pp-daerah/lantikan`}],
      portal:{type:'Pengganti Diperlukan',subject:`Lantik pengganti: ${match}`,
        message:`${event.nama_pegawai} (${event.jawatan}) ${event.event_type==='appointment_auto_rejected' ? 'ditolak automatik' : 'menolak'} — ${event.kejohanan ?? ''}, ${event.tarikh ?? ''}.`},
    });
    const sent=outcome.email==='sent' || outcome.telegram==='sent' || outcome.portal==='sent';
    if (sent) {
      await env.DB.prepare(`UPDATE worker_district_appointment_mail SET completed_at=datetime('now','+8 hours'),
        claimed_at=NULL,next_attempt_at=NULL,last_error=NULL WHERE id=? AND attempts=?`)
        .bind(row.id,claim.attempts).run(); result.sent++;
    } else {
      await env.DB.prepare(`UPDATE worker_district_appointment_mail SET claimed_at=NULL,
        next_attempt_at=datetime('now','+8 hours',?),last_error='Penghantaran gagal; menunggu percubaan semula.'
        WHERE id=? AND attempts=?`).bind(`+${Math.min(60,5*claim.attempts)} minutes`,row.id,claim.attempts).run(); result.failed++;
    }
  }
  return result;
}
