-- Publication is an Admin/PP action, independent of external delivery and its
-- answer deadline. Existing notification/answer evidence remains valid; no
-- appointment statuses, answers or delivery timestamps are rewritten.
ALTER TABLE lantikan_pengadil ADD COLUMN published_at TEXT;
