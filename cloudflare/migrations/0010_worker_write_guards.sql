-- PHP serialised appointment writes with SELECT ... FOR UPDATE. A D1 batch is
-- one transaction, so its first statement inserts a guard row that is 1 only
-- when the state read before the batch is still true; otherwise the CHECK
-- aborts the whole batch and nothing is written.
CREATE TABLE IF NOT EXISTS worker_write_guards (
  nonce TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  ok INTEGER NOT NULL CHECK (ok = 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
