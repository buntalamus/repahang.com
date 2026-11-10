-- Mobile app push notifications. A device belongs to the app session that
-- registered it, so logging out or session expiry stops its pushes.
CREATE TABLE IF NOT EXISTS worker_push_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token_hash TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios')),
  token TEXT NOT NULL UNIQUE,
  app_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);

CREATE INDEX IF NOT EXISTS idx_worker_push_devices_user ON worker_push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_push_devices_session ON worker_push_devices(session_token_hash);

-- Every in-app notice is pushed: processPushQueue() reads notifications rows
-- after this cursor. Existing rows are never pushed.
CREATE TABLE IF NOT EXISTS worker_push_state (
  state_key TEXT PRIMARY KEY,
  state_value INTEGER NOT NULL
);

INSERT OR IGNORE INTO worker_push_state(state_key, state_value)
  SELECT 'notifications_cursor', COALESCE(MAX(id), 0) FROM notifications;
