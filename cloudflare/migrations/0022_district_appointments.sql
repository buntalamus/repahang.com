-- Existing state/admin tournaments stay under Admin. Ownership is never inferred
-- from creator role, so promotion to PP cannot expose existing competitions.
ALTER TABLE kejohanan ADD COLUMN lantikan_persatuan_id INTEGER REFERENCES persatuan_bolasepak_daerah(id);
CREATE INDEX idx_kejohanan_lantikan_persatuan ON kejohanan(lantikan_persatuan_id,tarikh_mula);

-- Durable copies of district appointment events, separate from bearer links.
CREATE TABLE worker_district_appointment_mail (
  id INTEGER PRIMARY KEY,
  audit_id INTEGER NOT NULL,
  recipient_user_id INTEGER NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  context_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  next_attempt_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  UNIQUE(audit_id,recipient_email)
);
CREATE INDEX idx_district_appointment_mail_pending ON worker_district_appointment_mail(completed_at,next_attempt_at,claimed_at);
CREATE TRIGGER queue_district_appointment_mail AFTER INSERT ON lantikan_audit_log
WHEN NEW.event_status='success' AND NEW.event_type IN (
  'appointment_created','appointment_reassigned','appointment_deleted','appointment_status_changed',
  'appointment_response','appointment_auto_rejected','appointment_admin_acceptance_override','appointment_dispatched')
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
      AND (u.role='Admin' OR (u.role='PP Daerah'
        AND COALESCE(NULLIF(u.persatuan_id,0),u.district_id)=k.lantikan_persatuan_id));
END;
