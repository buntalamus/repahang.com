-- Existing imported reports have one row per RA appointment in the source dump.
-- The unique index and revision make concurrent Worker draft saves conflict safely.
ALTER TABLE laporan_penilaian ADD COLUMN worker_revision TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_worker_laporan_lantikan
  ON laporan_penilaian(lantikan_id);
