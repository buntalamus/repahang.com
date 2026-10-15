-- One fingerprint per self-reported match; appointed matches remain outside this guard.
ALTER TABLE perlawanan ADD COLUMN match_dedup_key TEXT;

WITH keyed AS (
  SELECT id, json_array(
    substr(tarikh,1,10),
    substr(trim(COALESCE(masa,'')),1,5),
    CASE WHEN lower(trim(COALESCE(home_team,''))) <= lower(trim(COALESCE(away_team,'')))
      THEN lower(trim(COALESCE(home_team,''))) ELSE lower(trim(COALESCE(away_team,''))) END,
    CASE WHEN lower(trim(COALESCE(home_team,''))) <= lower(trim(COALESCE(away_team,'')))
      THEN lower(trim(COALESCE(away_team,''))) ELSE lower(trim(COALESCE(home_team,''))) END,
    lower(trim(COALESCE(nama_kejohanan,''))),
    lower(trim(COALESCE(tempat,''))),
    lower(trim(COALESCE(jenis,''))),
    COALESCE(daerah_perlawanan_id,0)
  ) AS fingerprint
  FROM perlawanan WHERE lantikan_id IS NULL
), first_rows AS (
  SELECT MIN(id) AS id, fingerprint FROM keyed GROUP BY fingerprint
)
UPDATE perlawanan SET match_dedup_key=(
  SELECT fingerprint FROM first_rows WHERE first_rows.id=perlawanan.id
) WHERE id IN (SELECT id FROM first_rows);

CREATE UNIQUE INDEX IF NOT EXISTS idx_perlawanan_self_report_fingerprint
  ON perlawanan(match_dedup_key) WHERE match_dedup_key IS NOT NULL;
