-- The existing finalization marker/queue also records reasoned Admin overrides.
-- Historical rows keep the default chair provenance.
ALTER TABLE worker_report_confirmations
  ADD COLUMN source TEXT NOT NULL DEFAULT 'chair'
  CHECK (source IN ('chair','admin'));
