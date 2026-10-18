-- Web Push (PWA, e.g. iPhone home-screen app) subscriptions. Unlike the
-- mobile app's devices these belong to the user, not a session: the website
-- session lasts 12 hours, and the browser unsubscribes itself on logout.
CREATE TABLE IF NOT EXISTS worker_webpush_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);

CREATE INDEX IF NOT EXISTS idx_worker_webpush_user ON worker_webpush_subscriptions(user_id);
