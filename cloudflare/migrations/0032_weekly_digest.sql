-- One weekly summary email per Admin / PP Daerah per ISO week (weekly-digest.ts).
CREATE TABLE IF NOT EXISTS worker_weekly_digest (
  user_id INTEGER NOT NULL,
  week_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  PRIMARY KEY (user_id, week_key)
);
