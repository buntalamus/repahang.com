-- District copies now go only to the district's PP Daerah, and only for
-- events they must act on (an official declined or was auto-rejected).
-- Admins and routine events (created, dispatched, accepted, deleted) are
-- seen in the app/portal instead of by email. Delivery prefers Telegram and
-- the app; see district-appointment-mail.ts.
DROP TRIGGER IF EXISTS queue_district_appointment_mail;
CREATE TRIGGER queue_district_appointment_mail AFTER INSERT ON lantikan_audit_log
WHEN NEW.event_status='success' AND (NEW.event_type='appointment_auto_rejected'
  OR (NEW.event_type='appointment_response' AND json_extract(NEW.details_json,'$.new_status')='Ditolak'))
BEGIN
  INSERT OR IGNORE INTO worker_district_appointment_mail(audit_id,recipient_user_id,recipient_email,recipient_name,context_json)
    SELECT NEW.id,u.id,lower(trim(u.email)),u.nama_penuh,
      json_object('kejohanan',k.nama,'pasukan_home',jp.pasukan_home,'pasukan_away',jp.pasukan_away,
        'tarikh',jp.tarikh,'masa',jp.masa,'tempat',jp.tempat,'actor_name',actor.nama_penuh,
        'nama_persatuan',p.nama_persatuan) FROM users u
    JOIN kejohanan k ON k.id=NEW.kejohanan_id
    JOIN persatuan_bolasepak_daerah p ON p.id=k.lantikan_persatuan_id
    LEFT JOIN jadual_perlawanan jp ON jp.id=NEW.jadual_id
    LEFT JOIN users actor ON actor.id=NEW.actor_user_id
    WHERE k.lantikan_persatuan_id IS NOT NULL AND u.aktif=1 AND trim(COALESCE(u.email,''))<>''
      AND u.role='PP Daerah' AND COALESCE(NULLIF(u.persatuan_id,0),u.district_id)=k.lantikan_persatuan_id;
END;

-- Copies already queued for Admins or for routine events are dropped.
UPDATE worker_district_appointment_mail SET completed_at=datetime('now','+8 hours'),claimed_at=NULL,
  last_error='Dihentikan: salinan hanya untuk PP dan penolakan.'
WHERE completed_at IS NULL AND (
  recipient_user_id IN (SELECT id FROM users WHERE role<>'PP Daerah')
  OR audit_id NOT IN (SELECT id FROM lantikan_audit_log WHERE event_type='appointment_auto_rejected'
    OR (event_type='appointment_response' AND json_extract(details_json,'$.new_status')='Ditolak')));
