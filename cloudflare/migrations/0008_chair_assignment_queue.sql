-- Chair notifications now cover every pending approval the Worker prepares or
-- refreshes, including reports submitted through PHP before cutover. Jobs are
-- tied to an approval token generation, so a chair change or an Admin retry
-- queues new work while jobs for a rotated token are skipped.
CREATE TABLE IF NOT EXISTS worker_chair_jobs (
  delivery_key TEXT PRIMARY KEY,
  approval_id INTEGER NOT NULL REFERENCES laporan_pengesahan_pengerusi(id),
  report_id INTEGER NOT NULL REFERENCES laporan_penilaian(id),
  token_tag TEXT NOT NULL CHECK (length(token_tag)=16),
  channel TEXT NOT NULL CHECK (channel IN ('email','telegram')),
  origin TEXT NOT NULL CHECK (origin IN ('submission','chair_assigned','admin_retry')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  next_attempt_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_worker_chair_jobs_pending
  ON worker_chair_jobs(status,next_attempt_at,claimed_at,created_at);
CREATE INDEX IF NOT EXISTS idx_worker_chair_jobs_approval
  ON worker_chair_jobs(approval_id,channel,status);

INSERT INTO worker_chair_jobs
  (delivery_key,approval_id,report_id,token_tag,channel,origin,status,attempts,
   claimed_at,next_attempt_at,completed_at,last_error,created_at)
SELECT d.delivery_key,a.id,d.report_id,substr(a.approval_token,1,16),d.channel,
  'submission',d.status,d.attempts,d.claimed_at,d.next_attempt_at,d.completed_at,
  d.last_error,d.created_at
FROM worker_chair_deliveries d
JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=d.report_id
WHERE length(a.approval_token)=64;
DROP TABLE worker_chair_deliveries;

-- One row per chair assignment or Admin retry. The final integrity update turns
-- 0 into 1, or into -1 so the CHECK aborts the whole D1 batch.
CREATE TABLE IF NOT EXISTS worker_chair_assignments (
  nonce TEXT PRIMARY KEY,
  kejohanan_id INTEGER NOT NULL REFERENCES kejohanan(id),
  report_id INTEGER REFERENCES laporan_penilaian(id),
  origin TEXT NOT NULL CHECK (origin IN ('chair_assigned','admin_retry')),
  actor_user_id INTEGER NOT NULL REFERENCES users(id),
  integrity_checked INTEGER NOT NULL DEFAULT 0 CHECK (integrity_checked IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);

-- Classification of each pending report touched by one assignment/retry.
CREATE TABLE IF NOT EXISTS worker_chair_assignment_items (
  nonce TEXT NOT NULL REFERENCES worker_chair_assignments(nonce),
  report_id INTEGER NOT NULL REFERENCES laporan_penilaian(id),
  action TEXT NOT NULL CHECK (action IN ('prepare','rotate','refresh','keep')),
  PRIMARY KEY (nonce,report_id)
);
