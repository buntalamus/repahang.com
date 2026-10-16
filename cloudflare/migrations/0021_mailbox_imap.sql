-- Additive Shinjiru inbox index. Existing portal mail and Shinjiru mail stay intact.
CREATE TABLE IF NOT EXISTS mailbox_imap_state (
  mailbox TEXT NOT NULL,
  folder TEXT NOT NULL,
  uid_validity INTEGER NOT NULL DEFAULT 0,
  high_uid INTEGER NOT NULL DEFAULT 0,
  backfill_before INTEGER NOT NULL DEFAULT 1,
  lease_owner TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  last_attempt INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT,
  last_error TEXT,
  PRIMARY KEY (mailbox, folder)
);
CREATE TABLE IF NOT EXISTS mailbox_imap_items (
  mailbox TEXT NOT NULL,
  folder TEXT NOT NULL,
  uid_validity INTEGER NOT NULL,
  uid INTEGER NOT NULL,
  portal_id TEXT,
  raw_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('imported', 'oversized')),
  PRIMARY KEY (mailbox, folder, uid_validity, uid)
);
CREATE INDEX IF NOT EXISTS idx_mailbox_imap_hash ON mailbox_imap_items(mailbox, folder, raw_hash);
CREATE INDEX IF NOT EXISTS idx_mailbox_imap_portal ON mailbox_imap_items(portal_id);
CREATE TABLE IF NOT EXISTS mailbox_imap_folders (
  mailbox TEXT NOT NULL,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (mailbox, name)
);
-- Shared address book for authorized portal administrators only.
CREATE TABLE IF NOT EXISTS mailbox_contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
