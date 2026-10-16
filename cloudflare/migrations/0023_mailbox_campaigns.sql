-- Reviewed recipient/content snapshots; never re-expand groups after confirmation.
CREATE TABLE mailbox_campaigns (
  id TEXT PRIMARY KEY,
  created_by INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  snapshot_token TEXT NOT NULL,
  mailbox TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  selection_json TEXT NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  cancelled_at TEXT
);
CREATE TABLE mailbox_campaign_recipients (
  campaign_id TEXT NOT NULL REFERENCES mailbox_campaigns(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed','uncertain','cancelled')),
  message_id TEXT,
  started_at INTEGER,
  completed_at TEXT,
  error TEXT,
  PRIMARY KEY(campaign_id,email)
);
CREATE INDEX mailbox_campaign_pending ON mailbox_campaign_recipients(status,campaign_id);
-- One lease and one rate budget shared by every campaign/admin/mailbox.
CREATE TABLE mailbox_campaign_dispatch (
  id INTEGER PRIMARY KEY CHECK(id=1),
  lock_token TEXT,
  lock_until INTEGER NOT NULL DEFAULT 0,
  next_batch_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO mailbox_campaign_dispatch(id) VALUES (1);
