-- New Worker-only tables; no legacy user, application or match row is changed.
CREATE TABLE IF NOT EXISTS worker_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_worker_sessions_expires_at ON worker_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_worker_sessions_user_id ON worker_sessions(user_id);

CREATE TABLE IF NOT EXISTS worker_login_limits (
  limit_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  window_started INTEGER NOT NULL
);
