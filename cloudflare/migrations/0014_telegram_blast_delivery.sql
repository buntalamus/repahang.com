-- Track each recipient in a Telegram linking email batch before sending.
-- A timed-out browser request can inspect progress without sending duplicates.
CREATE TABLE IF NOT EXISTS telegram_blast_delivery (
  batch_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending','sent','failed','skipped')),
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  message_id TEXT,
  PRIMARY KEY (batch_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_blast_delivery_batch_status
  ON telegram_blast_delivery(batch_id, status);
