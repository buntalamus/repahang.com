-- Historical profile data only. Never changes application or examination outcomes.
ALTER TABLE users ADD COLUMN tahun_mohon_kelas1 TEXT;
ALTER TABLE users ADD COLUMN tahun_lulus_kelas1 TEXT;
