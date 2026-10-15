-- Preserve the old fingerprint when an administrator changes/deletes its representative row.
CREATE TRIGGER IF NOT EXISTS perlawanan_promote_old_match_fingerprint
AFTER UPDATE OF tarikh,masa,jenis,tempat,nama_kejohanan,home_team,away_team,daerah_perlawanan_id,lantikan_id
ON perlawanan
WHEN OLD.match_dedup_key IS NOT NULL
BEGIN
  UPDATE perlawanan SET match_dedup_key=OLD.match_dedup_key WHERE id=(
    SELECT p.id FROM perlawanan p WHERE p.id<>NEW.id AND p.lantikan_id IS NULL
      AND p.match_dedup_key IS NULL AND json_array(
        substr(p.tarikh,1,10),
        substr(trim(COALESCE(p.masa,'')),1,5),
        CASE WHEN lower(trim(COALESCE(p.home_team,''))) <= lower(trim(COALESCE(p.away_team,'')))
          THEN lower(trim(COALESCE(p.home_team,''))) ELSE lower(trim(COALESCE(p.away_team,''))) END,
        CASE WHEN lower(trim(COALESCE(p.home_team,''))) <= lower(trim(COALESCE(p.away_team,'')))
          THEN lower(trim(COALESCE(p.away_team,''))) ELSE lower(trim(COALESCE(p.home_team,''))) END,
        lower(trim(COALESCE(p.nama_kejohanan,''))),
        lower(trim(COALESCE(p.tempat,''))),
        lower(trim(COALESCE(p.jenis,''))),
        COALESCE(p.daerah_perlawanan_id,0)
      )=OLD.match_dedup_key
    ORDER BY p.id LIMIT 1
  ) AND (NEW.lantikan_id IS NOT NULL OR OLD.match_dedup_key <>
    json_array(
      substr(NEW.tarikh,1,10),
      substr(trim(COALESCE(NEW.masa,'')),1,5),
      CASE WHEN lower(trim(COALESCE(NEW.home_team,''))) <= lower(trim(COALESCE(NEW.away_team,'')))
        THEN lower(trim(COALESCE(NEW.home_team,''))) ELSE lower(trim(COALESCE(NEW.away_team,''))) END,
      CASE WHEN lower(trim(COALESCE(NEW.home_team,''))) <= lower(trim(COALESCE(NEW.away_team,'')))
        THEN lower(trim(COALESCE(NEW.away_team,''))) ELSE lower(trim(COALESCE(NEW.home_team,''))) END,
      lower(trim(COALESCE(NEW.nama_kejohanan,''))),
      lower(trim(COALESCE(NEW.tempat,''))),
      lower(trim(COALESCE(NEW.jenis,''))),
      COALESCE(NEW.daerah_perlawanan_id,0)
    )
  );
END;
