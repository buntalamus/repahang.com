-- Queued email/Telegram notices that are written in the same D1 batch as the
-- change they describe and delivered by cron or ctx.waitUntil (src/notify.ts).
CREATE TABLE IF NOT EXISTS worker_notification_outbox (
  id INTEGER PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','telegram')),
  recipient_user_id INTEGER,
  recipient_luar_id INTEGER,
  address TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  mail_type TEXT NOT NULL DEFAULT 'admin',
  payload_json TEXT NOT NULL,
  lantikan_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed','skipped','uncertain')),
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  next_attempt_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON worker_notification_outbox(status, next_attempt_at, id);
