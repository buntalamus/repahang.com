/** All times are Unix milliseconds. Late replacements may answer until kickoff. */
export function responseDeadline(kind: string, kickoff: number | null, notified: number | null):
  { at: number; hours: number; autoReject: boolean } | null {
  if (kickoff === null || notified === null || !Number.isFinite(kickoff) ||
      !Number.isFinite(notified) || notified <= 0 || notified >= kickoff) return null;
  const hours = kind.trim().toLowerCase() === 'liga' ? 48 : 3;
  const cutoff = kickoff - hours * 3600_000;
  const late = notified >= cutoff;
  return { at: late ? kickoff : cutoff, hours, autoReject: !late };
}
