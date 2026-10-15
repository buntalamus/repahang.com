-- Seminar attendance is recorded on the annual application, independently
-- from fitness results and patch/state-license eligibility.
ALTER TABLE permohonan ADD COLUMN status_seminar TEXT;
