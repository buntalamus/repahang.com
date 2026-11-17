-- Demo deployment only (DEMO_MODE=1, demo.refpahang.com): email and Telegram
-- addressed to fictional seed recipients is kept here instead of being sent
-- (demo.ts). The table stays empty everywhere else.
CREATE TABLE IF NOT EXISTS demo_outbox (
  id INTEGER PRIMARY KEY,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_demo_outbox_channel ON demo_outbox(channel, id);
