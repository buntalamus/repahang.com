-- RefPahang mailbox metadata. Raw RFC 822 messages remain private in R2.
CREATE TABLE IF NOT EXISTS mailbox_messages (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  folder TEXT NOT NULL CHECK (folder IN ('inbox', 'sent')),
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  message_id TEXT,
  r2_key TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'received',
  request_id TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_mailbox_messages_list
  ON mailbox_messages(mailbox, folder, received_at DESC, id DESC);
