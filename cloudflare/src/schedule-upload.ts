import { authorizeAppointmentResource } from './appointment-access';
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const textFields = ['kategori', 'peringkat', 'kumpulan', 'pasukan_home',
  'pasukan_away', 'tempat', 'no_perlawanan', 'pasukan_home_daerah', 'pasukan_home_negeri',
  'pasukan_away_daerah', 'pasukan_away_negeri'] as const;

function positiveId(value: unknown): number | null {
  const text = String(value ?? '');
  if (!/^[1-9]\d*$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

type Row = Record<(typeof textFields)[number], string> & { tarikh: string; masa: string; hari: string };

/** Admin Excel preview import. Valid rows are committed together; invalid rows are reported. */
export async function scheduleUpload(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  const access=await authorizeAppointmentResource(request,env,user,'upload');
  if (access) return access;
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const payload = await boundedJson(request, 256 * 1024);
  if (payload instanceof Response) return payload;
  const input = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown> : {};
  const tournamentId = positiveId(input.kejohanan_id);
  if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
  const tournament = await env.DB.prepare('SELECT id FROM kejohanan WHERE id=?')
    .bind(tournamentId).first();
  if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
  if (!Array.isArray(input.data) || input.data.length === 0) {
    return json({ error: true, message: 'Tiada data untuk dimuat naik.' }, 400);
  }
  if (input.data.length > 200) {
    return json({ error: true, message: 'Maksimum 200 perlawanan sekali muat naik.' }, 400);
  }

  const existing = await env.DB.prepare('SELECT no_perlawanan FROM jadual_perlawanan WHERE kejohanan_id=?')
    .bind(tournamentId).all<{ no_perlawanan: string }>();
  const nextByPrefix = new Map<string, number>();
  const numbers = new Set(existing.results.map((row) => row.no_perlawanan));
  const rows: Row[] = [];
  const errors: string[] = [];
  for (const [index, raw] of input.data.entries()) {
    const line = index + 1;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`Baris ${line}: Data perlawanan tidak sah.`);
      continue;
    }
    const source = raw as Record<string, unknown>;
    const row = {} as Row;
    let tooLong = false;
    let invalidField = false;
    for (const field of textFields) {
      if (field.startsWith('pasukan_') && (field.endsWith('_daerah') || field.endsWith('_negeri'))
        && source[field] != null && typeof source[field] !== 'string') invalidField = true;
      row[field] = String(source[field] ?? '').trim();
      if (row[field].length > 255) tooLong = true;
    }
    row.tarikh = String(source.tarikh ?? '').trim();
    row.masa = String(source.masa ?? '').trim().replace(/[^\d:]/g, '');
    if (invalidField) {
      errors.push(`Baris ${line}: Daerah atau negeri pasukan tidak sah.`);
      continue;
    }
    if (row.masa.length === 4 && !row.masa.includes(':')) {
      row.masa = `${row.masa.slice(0, 2)}:${row.masa.slice(2)}`;
    }
    if (!row.tarikh || !row.masa) {
      errors.push(`Baris ${line}: Tarikh dan masa diperlukan.`);
      continue;
    }
    if (!validDate(row.tarikh)) {
      errors.push(`Baris ${line}: Tarikh '${row.tarikh.slice(0, 20)}' tidak sah.`);
      continue;
    }
    if (!/^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(row.masa)) {
      errors.push(`Baris ${line}: Masa '${row.masa.slice(0, 20)}' tidak sah.`);
      continue;
    }
    if (tooLong) {
      errors.push(`Baris ${line}: Teks terlalu panjang.`);
      continue;
    }
    row.hari = days[new Date(`${row.tarikh}T00:00:00Z`).getUTCDay()];
    if (!row.no_perlawanan) {
      const prefix = row.kategori.replace(/\s+/g, '').toUpperCase() || 'P';
      let next = nextByPrefix.get(prefix);
      if (next == null) {
        const max = existing.results.reduce((current, item) => {
          if (!item.no_perlawanan.startsWith(`${prefix}-`)) return current;
          const match = /-(\d+)$/.exec(item.no_perlawanan);
          return Math.max(current, match ? Number(match[1]) : 0);
        }, 0);
        next = max + 1;
      }
      while (numbers.has(`${prefix}-${String(next).padStart(2, '0')}`)) next++;
      row.no_perlawanan = `${prefix}-${String(next).padStart(2, '0')}`;
      nextByPrefix.set(prefix, next + 1);
    }
    numbers.add(row.no_perlawanan);
    rows.push(row);
  }
  if (rows.length === 0) {
    return json({ error: false, message: `0 perlawanan berjaya ditambah. ${errors.length} baris dilangkau.`,
      inserted: 0, skipped: errors.length, errors: errors.slice(0, 20) });
  }

  const statements = rows.map((row) => env.DB.prepare(`
    INSERT INTO jadual_perlawanan
      (kejohanan_id,no_perlawanan,tarikh,masa,hari,kategori,peringkat,kumpulan,
       pasukan_home,pasukan_away,tempat,pasukan_home_daerah,pasukan_home_negeri,
       pasukan_away_daerah,pasukan_away_negeri,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Belum Lantik',datetime('now','+8 hours'),datetime('now','+8 hours'))
  `).bind(tournamentId, row.no_perlawanan, row.tarikh, row.masa, row.hari,
    row.kategori, row.peringkat, row.kumpulan, row.pasukan_home, row.pasukan_away, row.tempat,
    row.pasukan_home_daerah, row.pasukan_home_negeri, row.pasukan_away_daerah, row.pasukan_away_negeri));
  // Match the PHP registry fill for the whole tournament. The two updates
  // share the import transaction, so logo failures cannot leave half an import.
  statements.push(env.DB.prepare(`
    UPDATE jadual_perlawanan SET logo_home=(
      SELECT logo_path FROM pasukan_logo WHERE nama=jadual_perlawanan.pasukan_home COLLATE NOCASE LIMIT 1)
    WHERE kejohanan_id=? AND EXISTS(
      SELECT 1 FROM pasukan_logo WHERE nama=jadual_perlawanan.pasukan_home COLLATE NOCASE
        AND COALESCE(jadual_perlawanan.logo_home,'')<>logo_path)
  `).bind(tournamentId));
  statements.push(env.DB.prepare(`
    UPDATE jadual_perlawanan SET logo_away=(
      SELECT logo_path FROM pasukan_logo WHERE nama=jadual_perlawanan.pasukan_away COLLATE NOCASE LIMIT 1)
    WHERE kejohanan_id=? AND EXISTS(
      SELECT 1 FROM pasukan_logo WHERE nama=jadual_perlawanan.pasukan_away COLLATE NOCASE
        AND COALESCE(jadual_perlawanan.logo_away,'')<>logo_path)
  `).bind(tournamentId));
  let results: D1Result[];
  try {
    results = await env.DB.batch(statements);
  } catch (error) {
    console.error('Schedule upload transaction failed', error);
    return json({ error: true, message: 'Muat naik gagal. Tiada perlawanan ditambah.' }, 409);
  }
  const logosFilled = results.slice(-2).reduce((sum, result) => sum + Number(result.meta.changes ?? 0), 0);
  let message = `${rows.length} perlawanan berjaya ditambah.`;
  if (logosFilled) message += ` ${logosFilled} logo pasukan diisi secara automatik.`;
  if (errors.length) message += ` ${errors.length} baris dilangkau.`;
  return json({ error: false, message, inserted: rows.length, skipped: errors.length,
    errors: errors.slice(0, 20) });
}
