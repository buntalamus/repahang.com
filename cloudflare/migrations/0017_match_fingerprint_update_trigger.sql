-- Refresh the event key whenever a self-reported match is edited.
CREATE TRIGGER IF NOT EXISTS perlawanan_refresh_match_fingerprint
AFTER UPDATE OF tarikh,masa,jenis,tempat,nama_kejohanan,home_team,away_team,daerah_perlawanan_id,lantikan_id
ON perlawanan
BEGIN
  UPDATE perlawanan SET match_dedup_key=(
    SELECT json_array(
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
    WHERE NEW.lantikan_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM perlawanan p WHERE p.id<>NEW.id
        AND p.match_dedup_key=json_array(
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
        ))
  ) WHERE id=NEW.id;
END;
