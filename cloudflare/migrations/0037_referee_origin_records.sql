-- Historical records brought by a referee moving to Pahang. Pending records
-- live here; only an Admin decision promotes them into annual eligibility.
CREATE TABLE referee_origin_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  origin_state TEXT NOT NULL,
  transfer_date TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  verifier_name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  proof_key TEXT NOT NULL,
  proof_name TEXT NOT NULL,
  proof_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK(status IN ('requested','open','submitted','accepted','rejected','revoked')),
  expires_on TEXT,
  granted_by INTEGER REFERENCES users(id),
  granted_at TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  review_notes TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0,
  last_operation TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  CHECK(date_from<=date_to AND date_to<transfer_date)
);
CREATE UNIQUE INDEX referee_origin_one_active ON referee_origin_requests(user_id)
  WHERE status IN ('requested','open','submitted');
CREATE INDEX referee_origin_queue ON referee_origin_requests(status,id);

CREATE TABLE referee_origin_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES referee_origin_requests(id),
  tarikh TEXT NOT NULL,
  masa TEXT,
  jenis TEXT NOT NULL,
  nama_kejohanan TEXT NOT NULL,
  tempat TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  jawatan TEXT NOT NULL,
  record_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  UNIQUE(request_id,record_key)
);

ALTER TABLE perlawanan ADD COLUMN origin_record_id INTEGER REFERENCES referee_origin_records(id);
CREATE UNIQUE INDEX perlawanan_origin_record ON perlawanan(origin_record_id)
  WHERE origin_record_id IS NOT NULL;

-- Accepted history stays immutable, including through older generic routes.
-- Annual applications may still attach permohonan_id to these records.
CREATE TRIGGER perlawanan_origin_immutable BEFORE UPDATE ON perlawanan
WHEN OLD.origin_record_id IS NOT NULL AND (
  NEW.origin_record_id IS NOT OLD.origin_record_id OR NEW.user_id IS NOT OLD.user_id
  OR NEW.tarikh IS NOT OLD.tarikh OR NEW.masa IS NOT OLD.masa
  OR NEW.jenis IS NOT OLD.jenis OR NEW.nama_kejohanan IS NOT OLD.nama_kejohanan
  OR NEW.tempat IS NOT OLD.tempat OR NEW.home_team IS NOT OLD.home_team
  OR NEW.away_team IS NOT OLD.away_team OR NEW.jawatan IS NOT OLD.jawatan
  OR NEW.status_pp IS NOT OLD.status_pp OR NEW.verified_by IS NOT OLD.verified_by
  OR NEW.verified_at IS NOT OLD.verified_at OR NEW.catatan_pp IS NOT OLD.catatan_pp
  OR NEW.match_group_id IS NOT OLD.match_group_id OR NEW.lantikan_id IS NOT OLD.lantikan_id
  OR NEW.daerah_perlawanan_id IS NOT OLD.daerah_perlawanan_id
)
BEGIN SELECT RAISE(ABORT,'origin_record_locked'); END;
CREATE TRIGGER perlawanan_origin_no_delete BEFORE DELETE ON perlawanan
WHEN OLD.origin_record_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'origin_record_locked'); END;

-- Serialize duplicate checks with ordinary match entry too. Existing legacy
-- duplicates do not prevent this migration from being applied.
CREATE TRIGGER perlawanan_origin_duplicate BEFORE INSERT ON perlawanan
WHEN EXISTS (
  SELECT 1 FROM perlawanan p WHERE p.user_id=NEW.user_id AND COALESCE(p.status_pp,'')<>'Tidak Disahkan'
    AND substr(p.tarikh,1,10)=substr(NEW.tarikh,1,10)
    AND (NEW.origin_record_id IS NOT NULL OR p.origin_record_id IS NOT NULL)
    AND ((lower(trim(p.home_team))=lower(trim(NEW.home_team)) AND lower(trim(p.away_team))=lower(trim(NEW.away_team)))
      OR (lower(trim(p.home_team))=lower(trim(NEW.away_team)) AND lower(trim(p.away_team))=lower(trim(NEW.home_team))))
)
BEGIN SELECT RAISE(ABORT,'origin_record_duplicate'); END;
