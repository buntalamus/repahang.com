-- One private conversation per account; admin read state is shared by admins.
CREATE TABLE IF NOT EXISTS support_threads (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  user_read_id INTEGER NOT NULL DEFAULT 0,
  admin_read_id INTEGER NOT NULL DEFAULT 0,
  last_message_id INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES support_threads(user_id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  is_admin INTEGER NOT NULL CHECK(is_admin IN (0,1)),
  client_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sender_id,client_id)
);
CREATE INDEX IF NOT EXISTS idx_support_thread_messages ON support_messages(user_id,id);
CREATE INDEX IF NOT EXISTS idx_support_unread ON support_messages(user_id,is_admin,id);
CREATE INDEX IF NOT EXISTS idx_support_sender_time ON support_messages(sender_id,created_at);
CREATE INDEX IF NOT EXISTS idx_support_threads_recent ON support_threads(last_message_id DESC);
