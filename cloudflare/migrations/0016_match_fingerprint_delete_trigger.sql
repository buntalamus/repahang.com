-- Keep the guard if an administrator removes the row that currently carries it.
CREATE TRIGGER IF NOT EXISTS perlawanan_promote_match_fingerprint
AFTER DELETE ON perlawanan
WHEN OLD.match_dedup_key IS NOT NULL
BEGIN
  UPDATE perlawanan SET match_dedup_key=OLD.match_dedup_key
  WHERE id=(
    SELECT p.id FROM perlawanan p
    WHERE p.lantikan_id IS NULL AND p.match_dedup_key IS NULL
      AND json_array(
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
  );
END;
