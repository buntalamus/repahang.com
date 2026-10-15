-- Only confirmations created by the Worker enter this queue. Imported PHP
-- approvals and audits are historical data and never cause a new delivery.
CREATE TABLE IF NOT EXISTS worker_report_confirmations (
  approval_id INTEGER PRIMARY KEY REFERENCES laporan_pengesahan_pengerusi(id),
  report_id INTEGER NOT NULL REFERENCES laporan_penilaian(id),
  integrity_checked INTEGER NOT NULL DEFAULT 0 CHECK (integrity_checked IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);

CREATE TABLE IF NOT EXISTS worker_report_deliveries (
  delivery_key TEXT PRIMARY KEY,
  approval_id INTEGER NOT NULL REFERENCES worker_report_confirmations(approval_id),
  report_id INTEGER NOT NULL REFERENCES laporan_penilaian(id),
  recipient_lantikan_id INTEGER NOT NULL REFERENCES lantikan_pengadil(id),
  channel TEXT NOT NULL CHECK (channel IN ('email','telegram')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  next_attempt_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_worker_report_deliveries_pending
  ON worker_report_deliveries(status,next_attempt_at,claimed_at,created_at);
