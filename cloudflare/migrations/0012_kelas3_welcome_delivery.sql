-- A 2026 Kelas III FAM welcome message must not reset a password again after
-- its first successful delivery. No temporary password or recipient data is stored.
CREATE TABLE IF NOT EXISTS worker_kelas3_welcome_delivery (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK(status IN ('ready','processing','sent','failed')),
  claim_token TEXT,
  claimed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  failed_at TEXT,
  actor_user_id INTEGER,
  PRIMARY KEY(user_id,campaign_year)
);
