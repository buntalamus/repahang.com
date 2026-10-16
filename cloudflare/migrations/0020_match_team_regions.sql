-- Team origins are entered by Admin; historical origins are left unknown.
ALTER TABLE jadual_perlawanan ADD COLUMN pasukan_home_daerah TEXT NOT NULL DEFAULT '';
ALTER TABLE jadual_perlawanan ADD COLUMN pasukan_home_negeri TEXT NOT NULL DEFAULT '';
ALTER TABLE jadual_perlawanan ADD COLUMN pasukan_away_daerah TEXT NOT NULL DEFAULT '';
ALTER TABLE jadual_perlawanan ADD COLUMN pasukan_away_negeri TEXT NOT NULL DEFAULT '';
