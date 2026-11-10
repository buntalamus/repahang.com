-- One phone reminder per accepted appointment and kind (24h / 2h before
-- kickoff), so the five-minute cron never sends the same reminder twice.
CREATE TABLE IF NOT EXISTS worker_match_reminders (
  lantikan_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  PRIMARY KEY (lantikan_id, kind)
);
