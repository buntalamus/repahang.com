-- New RA submissions only. Imported PHP reports never enter this queue.
CREATE TABLE IF NOT EXISTS worker_report_submissions (
  report_id INTEGER PRIMARY KEY REFERENCES laporan_penilaian(id),
  nonce TEXT NOT NULL UNIQUE,
  integrity_checked INTEGER NOT NULL DEFAULT 0 CHECK (integrity_checked IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);

CREATE TABLE IF NOT EXISTS worker_chair_deliveries (
  delivery_key TEXT PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES worker_report_submissions(report_id),
  channel TEXT NOT NULL CHECK (channel IN ('email','telegram')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  next_attempt_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_worker_chair_deliveries_pending
  ON worker_chair_deliveries(status,next_attempt_at,claimed_at,created_at);
