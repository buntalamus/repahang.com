-- Nullable for imported PHP appointments. A Worker-created appointment has a
-- unique marker so its audit and schedule transition can share one D1 batch.
ALTER TABLE lantikan_pengadil ADD COLUMN worker_assignment_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_worker_assignment_key
  ON lantikan_pengadil(worker_assignment_key);
