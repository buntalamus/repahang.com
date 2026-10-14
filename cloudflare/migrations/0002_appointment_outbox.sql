-- Worker-only response delivery queue. Imported PHP audit and KUP retry rows
-- must never be interpreted as new Worker messages after cutover.
CREATE TABLE IF NOT EXISTS worker_appointment_outbox (
  event_key TEXT PRIMARY KEY,
  lantikan_id INTEGER NOT NULL,
  jadual_id INTEGER NOT NULL,
  response_status TEXT NOT NULL CHECK (response_status IN ('Diterima', 'Ditolak')),
  response_channel TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  next_attempt_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_worker_appointment_outbox_pending
  ON worker_appointment_outbox(completed_at, next_attempt_at, claimed_at, created_at);

-- One channel per recipient. Only Worker events can create these rows; the
-- 445 imported PHP crew retry rows are deliberately outside this queue.
CREATE TABLE IF NOT EXISTS worker_appointment_deliveries (
  delivery_key TEXT PRIMARY KEY,
  event_key TEXT NOT NULL REFERENCES worker_appointment_outbox(event_key),
  kind TEXT NOT NULL CHECK (kind IN ('admin_response','pp_response','ra_form','kup_crew')),
  channel TEXT NOT NULL CHECK (channel IN ('email','telegram')),
  recipient_user_id INTEGER,
  recipient_lantikan_id INTEGER,
  crew_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  next_attempt_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  CHECK ((recipient_user_id IS NOT NULL) <> (recipient_lantikan_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_worker_appointment_deliveries_pending
  ON worker_appointment_deliveries(status,next_attempt_at,claimed_at,created_at);
