import type { Env } from './types';
import { baseUrl, buildEmailTemplate, emailButton, emailGreeting, emailInfoTable, emailPara, sendEmail } from './php/email';
import { h } from './php/format';

const labels: Record<string,string> = {
  appointment_created:'Lantikan baharu', appointment_reassigned:'Penggantian pengadil',
  appointment_deleted:'Lantikan dibuang', appointment_status_changed:'Perubahan status perlawanan',
  appointment_response:'Jawapan pengadil', appointment_auto_rejected:'Lantikan ditolak automatik',
  appointment_admin_acceptance_override:'Override penerimaan oleh Admin', appointment_dispatched:'Notifikasi lantikan dihantar',
};
type Delivery = {id:number;audit_id:number;recipient_user_id:number;recipient_email:string;recipient_name:string;attempts:number};

/** Claimed per recipient, so a failed PP copy does not resend successful Admin copies.
 * These informational copies intentionally contain no referee response/form tokens. */
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
    const info: Array<[string,string]> = [
      ['Tindakan',h(label)],['Daerah',h(event.nama_persatuan)],['Kejohanan',h(event.kejohanan)],
      ['Perlawanan',h(`${event.pasukan_home ?? '-'} lwn ${event.pasukan_away ?? '-'}`)],
      ['Tarikh / Masa',h(`${event.tarikh ?? '-'} ${event.masa ?? ''}`)],['Tempat',h(event.tempat)],
      ['Pegawai',h(event.nama_pegawai)],['Jawatan',h(event.jawatan)],
      ['Oleh',h(event.actor_name ?? 'Sistem')],['Masa tindakan',h(event.created_at)],
    ];
    for(const [field,label] of [['new_status','Status'],['action','Jawapan'],['reason','Sebab'],['komen','Catatan'],['comment','Catatan']] as const) {
      if (typeof details[field]==='string') info.push([label,h(details[field])]);
    }
    const route=event.recipient_role==='Admin' ? '/admin/lantikan' : '/pp-daerah/lantikan';
    const html=buildEmailTemplate('Salinan Lantikan Daerah','#d4a000','',emailGreeting(row.recipient_name)
      +emailPara('Salinan makluman pengurusan lantikan pengadil daerah untuk rekod dan pemantauan anda.')
      +emailInfoTable(info)+emailButton(`${baseUrl(env)}${route}`,'Buka Sistem Lantikan'));
    let sent=false;
    try { sent=await sendEmail(env,row.recipient_email,`[Salinan Daerah] ${label}: ${event.nama_pegawai}`,
      html,row.recipient_name,'lantikan'); }
    catch { /* Keep a redacted failure in the queue and retry. */ }
    if (sent) {
      await env.DB.prepare(`UPDATE worker_district_appointment_mail SET completed_at=datetime('now','+8 hours'),
        claimed_at=NULL,next_attempt_at=NULL,last_error=NULL WHERE id=? AND attempts=?`)
        .bind(row.id,claim.attempts).run(); result.sent++;
    } else {
      await env.DB.prepare(`UPDATE worker_district_appointment_mail SET claimed_at=NULL,
        next_attempt_at=datetime('now','+8 hours',?),last_error='Penghantaran SMTP gagal; menunggu percubaan semula.'
        WHERE id=? AND attempts=?`).bind(`+${Math.min(60,5*claim.attempts)} minutes`,row.id,claim.attempts).run(); result.failed++;
    }
  }
  return result;
}
