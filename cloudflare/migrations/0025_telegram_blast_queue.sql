-- Telegram linking email blast as a cron-dispatched queue. The recipient list
-- is frozen when the blast starts, and every address keeps its own result.
CREATE TABLE IF NOT EXISTS telegram_blast_batches (
  id TEXT PRIMARY KEY,
  created_by INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','completed','cancelled')),
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  cancelled_at TEXT
);

-- Only one blast may be in progress at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_blast_one_queued
  ON telegram_blast_batches(status) WHERE status='queued';

CREATE TABLE IF NOT EXISTS telegram_blast_recipients (
  batch_id TEXT NOT NULL REFERENCES telegram_blast_batches(id),
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed','uncertain','skipped','cancelled')),
  message_id TEXT,
  started_at INTEGER,
  completed_at TEXT,
  error TEXT,
  PRIMARY KEY (batch_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_blast_recipients_status
  ON telegram_blast_recipients(status, batch_id);
