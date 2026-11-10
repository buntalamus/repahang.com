-- Account access is independent of annual registration and preserves history.
ALTER TABLE users ADD COLUMN inactive_reason TEXT;
ALTER TABLE users ADD COLUMN inactive_source TEXT;
ALTER TABLE users ADD COLUMN last_activity_at INTEGER;
-- Admin reactivation acknowledges the current annual check and starts a new idle period.
ALTER TABLE users ADD COLUMN registration_review_year INTEGER;
UPDATE users SET inactive_source='manual' WHERE aktif=0;
-- Existing login values may be UTC (Worker) or MYT (legacy). Interpreting them
-- as UTC conservatively grants up to eight extra hours rather than blocking early.
UPDATE users SET last_activity_at=MAX(
  COALESCE(unixepoch(created_at,'-8 hours'),0),
  COALESCE(unixepoch(last_login),0),
  COALESCE((SELECT MAX(unixepoch(a.created_at,'-8 hours')) FROM activity_log a WHERE a.user_id=users.id),0)
);
CREATE INDEX IF NOT EXISTS idx_account_activity ON users(aktif,last_activity_at);
CREATE INDEX IF NOT EXISTS idx_account_registration ON permohonan(user_id,jenis_borang,tahun_permohonan);
CREATE INDEX IF NOT EXISTS idx_account_activity_log ON activity_log(user_id,created_at);
