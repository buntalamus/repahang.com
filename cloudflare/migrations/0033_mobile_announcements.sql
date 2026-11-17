CREATE TABLE IF NOT EXISTS worker_announcement_reads (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  PRIMARY KEY(user_id, announcement_id)
);

ALTER TABLE notifications ADD COLUMN announcement_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_notifications_announcement_user
  ON notifications(announcement_id,user_id);
