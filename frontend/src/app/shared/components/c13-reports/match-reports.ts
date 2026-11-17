export interface Report {
  id: string;
  match_id: string;
  recorded_at: number;
  referee_name?: string;
  form_type?: string;
  revision?: number;
  amendment_number?: number;
  match_number: string;
  scheduled_start: number;
  tournament_name: string;
  home_name: string;
  away_name: string;
  venue_name?: string | null;
}

export interface MatchReports {
  match: Report;
  c12: Report[];
  c13: Report[];
}

export function groupMatchReports(reports: Report[], query: string): MatchReports[] {
  const groups = new Map<string, MatchReports>();
  for (const report of [...reports].sort((a, b) => b.recorded_at - a.recorded_at)) {
    let group = groups.get(report.match_id);
    if (!group) {
      group = { match: report, c12: [], c13: [] };
      groups.set(report.match_id, group);
    }
    const documents = report.form_type === 'MATCH_SUMMARY_C12' ? group.c12 : group.c13;
    if (!documents.some(document => document.id === report.id)) documents.push(report);
    if (!group.match.venue_name && report.venue_name) group.match = { ...group.match, venue_name: report.venue_name };
  }
  const search = query.trim().toLocaleLowerCase('ms');
  return [...groups.values()].filter(group => {
    const report = group.match;
    return [report.tournament_name, report.match_number, report.home_name, report.away_name,
      report.venue_name, ...group.c13.map(document => document.referee_name),
      group.c12.length ? 'C12' : '', group.c13.length ? 'C13' : '']
      .join(' ').toLocaleLowerCase('ms').includes(search);
  }).sort((a, b) => b.match.scheduled_start - a.match.scheduled_start
    || a.match.match_number.localeCompare(b.match.match_number, 'ms', { numeric: true }));
}
