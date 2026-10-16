/**
 * Doubtful match records for PP Daerah review. Another record that is not
 * rejected, on the same date and involving the same official, makes a match
 * doubtful when:
 *  - both have a kick-off time and it is the same (an official cannot be at
 *    two matches at once), or
 *  - neither has a time, and the venue, both teams and every official match.
 * It is labelled a likely duplicate when venue, teams and all officials match.
 * Exact values only: no time window or venue radius.
 */
import type { Env } from './types';

export interface MatchRecord {
  id: number; user_id: number; tarikh: string; masa: string | null; tempat: string | null;
  home_team: string | null; away_team: string | null; match_group_id: string | null;
}

export interface MatchConflict {
  jenis: 'berganda' | 'bertembung';
  sumber: 'Lantikan rasmi' | 'Rekod pengadil';
  tarikh: string; masa: string; tempat: string; home_team: string; away_team: string;
  status_pp: string; pegawai_sama: string[]; pegawai: string[];
}

type Other = MatchRecord & { lantikan_id: number | null; jadual_id: number | null;
  status_pp: string | null; nama_penuh: string };

/** The key the verification list groups a record under. */
export const recordKey = (row: { id: number; match_group_id: string | null }): string =>
  row.match_group_id ? `g:${row.match_group_id}` : `s:${row.id}`;
const otherKey = (row: Other): string => row.match_group_id ? `g:${row.match_group_id}`
  : row.jadual_id ? `j:${row.jadual_id}` : `s:${row.id}`;
const day = (value: string) => value.slice(0, 10);
const time = (value: string | null) => (value ?? '').trim().slice(0, 5);
const text = (value: string | null) => (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const teams = (row: MatchRecord) => [text(row.home_team), text(row.away_team)].sort().join('|');
const sameSet = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((id) => b.has(id));

/** Conflicts per record key (see recordKey) for the given candidate records. */
export async function findMatchConflicts(env: Env, records: MatchRecord[]): Promise<Map<string, MatchConflict[]>> {
  const result = new Map<string, MatchConflict[]>();
  if (!records.length) return result;
  const candidates = new Map<string, MatchRecord[]>();
  for (const row of records) {
    const key = recordKey(row);
    candidates.set(key, [...(candidates.get(key) ?? []), row]);
  }
  const userIds = [...new Set(records.map((row) => row.user_id))];
  const days = [...new Set(records.map((row) => day(row.tarikh)))];
  const select = `SELECT c.id,c.user_id,c.tarikh,c.masa,c.tempat,c.home_team,c.away_team,c.match_group_id,
      c.lantikan_id,lp.jadual_id,c.status_pp,u.nama_penuh
    FROM perlawanan c JOIN users u ON u.id=c.user_id
    LEFT JOIN lantikan_pengadil lp ON lp.id=c.lantikan_id`;
  const others = await env.DB.prepare(`${select}
    WHERE c.user_id IN (SELECT value FROM json_each(?)) AND substr(c.tarikh,1,10) IN (SELECT value FROM json_each(?))
      AND COALESCE(c.status_pp,'')<>'Tidak Disahkan'`)
    .bind(JSON.stringify(userIds), JSON.stringify(days)).all<Other>();
  // Pair each candidate match with the other matches that share an official at the same slot.
  const hits = new Map<string, Map<string, Other[]>>();
  for (const other of others.results) {
    for (const [key, rows] of candidates) {
      const row = rows.find((item) => item.user_id === other.user_id);
      if (!row || otherKey(other) === key || rows.some((item) => item.id === other.id)) continue;
      if (day(row.tarikh) !== day(other.tarikh)) continue;
      const bothTimed = time(row.masa) !== '' && time(other.masa) !== '';
      const untimed = time(row.masa) === '' && time(other.masa) === '';
      if (!(bothTimed && time(row.masa) === time(other.masa)) && !untimed) continue;
      const byOther = hits.get(key) ?? new Map<string, Other[]>();
      byOther.set(otherKey(other), [...(byOther.get(otherKey(other)) ?? []), other]);
      hits.set(key, byOther);
    }
  }
  if (!hits.size) return result;
  // Load the full crew of every matched record to compare all officials.
  const keys = [...new Set([...hits.values()].flatMap((byOther) => [...byOther.keys()]))];
  const groups = keys.filter((key) => key.startsWith('g:')).map((key) => key.slice(2));
  const fixtures = keys.filter((key) => key.startsWith('j:')).map((key) => Number(key.slice(2)));
  const singles = keys.filter((key) => key.startsWith('s:')).map((key) => Number(key.slice(2)));
  const crews = await env.DB.prepare(`${select}
    WHERE c.match_group_id IN (SELECT value FROM json_each(?))
      OR lp.jadual_id IN (SELECT value FROM json_each(?)) OR c.id IN (SELECT value FROM json_each(?))`)
    .bind(JSON.stringify(groups), JSON.stringify(fixtures), JSON.stringify(singles)).all<Other>();
  const crewOf = new Map<string, Other[]>();
  for (const row of crews.results) crewOf.set(otherKey(row), [...(crewOf.get(otherKey(row)) ?? []), row]);
  for (const [key, byOther] of hits) {
    const rows = candidates.get(key)!;
    const first = rows[0];
    const ids = new Set(rows.map((row) => row.user_id));
    const conflicts: MatchConflict[] = [];
    for (const [other, shared] of byOther) {
      const crew = crewOf.get(other) ?? shared;
      const sample = crew[0];
      const duplicate = text(first.tempat) === text(sample.tempat) && teams(first) === teams(sample)
        && sameSet(ids, new Set(crew.map((row) => row.user_id)));
      // Without a time only a full duplicate is doubtful; a crew may do several untimed matches a day.
      if (time(first.masa) === '' && !duplicate) continue;
      conflicts.push({ jenis: duplicate ? 'berganda' : 'bertembung',
        sumber: crew.some((row) => row.lantikan_id) ? 'Lantikan rasmi' : 'Rekod pengadil',
        tarikh: day(sample.tarikh), masa: time(sample.masa), tempat: sample.tempat ?? '',
        home_team: sample.home_team ?? '', away_team: sample.away_team ?? '',
        status_pp: sample.status_pp || 'Belum Disahkan',
        pegawai_sama: [...new Set(shared.map((row) => row.nama_penuh))],
        pegawai: [...new Set(crew.map((row) => row.nama_penuh))] });
    }
    if (conflicts.length) result.set(key, conflicts);
  }
  return result;
}

export function conflictSummary(conflicts: MatchConflict[]): string {
  const duplicate = conflicts.some((item) => item.jenis === 'berganda');
  return duplicate
    ? 'Kemungkinan rekod berganda: perlawanan yang sama (tarikh, masa, tempat, pasukan dan semua pegawai) telah direkodkan.'
    : 'Pegawai bertembung: pegawai yang sama mempunyai rekod lain pada tarikh dan masa yang sama.';
}
