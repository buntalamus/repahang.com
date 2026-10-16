export interface RefereeOrigin {
  daerah?: string | null;
  negeri?: string | null;
}

export interface MatchTeamOrigins {
  pasukan_home?: string | null;
  pasukan_away?: string | null;
  pasukan_home_daerah?: string | null;
  pasukan_home_negeri?: string | null;
  pasukan_away_daerah?: string | null;
  pasukan_away_negeri?: string | null;
}

function normalized(value?: string | null): string {
  const text = (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ms');
  return ['-', '—', 'n/a', 'tiada'].includes(text) ? '' : text;
}

/** Explicit origins only: team names and venue do not establish affiliation. */
export function teamRegionCaution(
  referee: RefereeOrigin | null | undefined,
  match: MatchTeamOrigins | null | undefined,
  level: string | null | undefined,
): string {
  if (!referee || !match) return '';
  const district = level === 'Negeri' || level === 'Daerah';
  if (!district && level !== 'Kebangsaan') return '';
  const field = district ? 'daerah' : 'negeri';
  const origin = normalized(referee[field]);
  if (!origin) return '';
  const reasons: string[] = [];
  for (const side of ['home', 'away'] as const) {
    const team = match[`pasukan_${side}`]?.trim();
    if (!team || !normalized(team)) continue;
    const region = match[`pasukan_${side}_${field}`];
    if (normalized(region) !== origin) continue;
    // District names may occur in different states. Known different states
    // must never be treated as the same district.
    const refereeState = normalized(referee.negeri);
    const teamState = normalized(match[`pasukan_${side}_negeri`]);
    if (district && refereeState && teamState && refereeState !== teamState) continue;
    reasons.push(`${district ? 'Daerah' : 'Negeri'} ${region?.trim()} sama dengan ${team}`);
  }
  return reasons.length ? `Berjaga-jaga: ${reasons.join('; ')}.` : '';
}
