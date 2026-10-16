import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';
import { wroteRow } from './d1-changes';
import { conflictSummary, findMatchConflicts } from './match-conflicts';

const scoreFields = [
  'skor_ht_home', 'skor_ht_away', 'skor_ft_home', 'skor_ft_away',
  'skor_et_home', 'skor_et_away', 'skor_ps_home', 'skor_ps_away',
] as const;
const textFields = ['jenis', 'tempat', 'jawatan', 'home_team', 'away_team', 'cuaca'] as const;

type Official = { user_id: number; jawatan: string };
type Recipient = { id: number; nama_penuh: string; email: string | null };

function positiveId(value: unknown): number | null {
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function localToday(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (kind: string) => parts.find((part) => part.type === kind)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function validMatchDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function tooOld(value: string): boolean {
  return Date.parse(`${localToday()}T00:00:00Z`) - Date.parse(`${value}T00:00:00Z`) > 14 * 86400000;
}

function requiredText(value: unknown, max = 255): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function optionalText(value: unknown, max = 255): string | null | false {
  if (value == null || value === '') return null;
  return typeof value === 'string' && value.trim().length <= max ? value.trim() : false;
}

function score(value: unknown): number | null | false {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 999 ? parsed : false;
}

function matchFingerprint(date: string, time: string | null, home: string, away: string,
  tournament: string | null, venue: string, kind: string, districtId: number): string {
  const teams = [home.trim().toLowerCase(), away.trim().toLowerCase()].sort();
  const normalizedTime = (time ?? '').trim().slice(0, 5);
  return JSON.stringify([date, normalizedTime, teams[0], teams[1], (tournament ?? '').trim().toLowerCase(),
    venue.trim().toLowerCase(), kind.trim().toLowerCase(), districtId]);
}

async function addMatch(input: Record<string, unknown>, env: Env,
  actorId: number, actorName: string): Promise<Response> {
  const date = input.tarikh;
  if (!validMatchDate(date)) return json({ error: true, message: 'Tarikh perlawanan tidak sah.' }, 400);
  if (tooOld(date)) return json({ error: true,
    message: 'Rekod perlawanan tidak boleh dihantar melebihi 14 hari dari tarikh perlawanan.' }, 400);
  const kind = requiredText(input.jenis);
  const venue = requiredText(input.tempat);
  const home = requiredText(input.home_team);
  const away = requiredText(input.away_team);
  if (!kind || !venue || !home || !away) {
    return json({ error: true, message: 'Jenis, tempat dan kedua-dua pasukan diperlukan.' }, 400);
  }
  const districtId = positiveId(input.daerah_perlawanan_id);
  if (!districtId) return json({ error: true, message: 'Sila pilih daerah perlawanan.' }, 400);
  const rawOfficials = input.officials;
  if (!Array.isArray(rawOfficials) || rawOfficials.length < 1 || rawOfficials.length > 5) {
    return json({ error: true, message: 'Bilangan pegawai mestilah antara 1 hingga 5.' }, 400);
  }
  const officials: Official[] = [];
  for (const entry of rawOfficials) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return json({ error: true, message: 'Pegawai perlawanan tidak sah.' }, 400);
    }
    const item = entry as Record<string, unknown>;
    const id = positiveId(item.user_id);
    const position = requiredText(item.jawatan, 100);
    if (!id || !position) return json({ error: true, message: 'Pengadil dan jawatan diperlukan.' }, 400);
    officials.push({ user_id: id, jawatan: position });
  }
  if (new Set(officials.map((item) => item.user_id)).size !== officials.length ||
      new Set(officials.map((item) => item.jawatan)).size !== officials.length) {
    return json({ error: true, message: 'Pengadil dan jawatan tidak boleh berulang.' }, 400);
  }
  const time = optionalText(input.masa, 20);
  const tournament = optionalText(input.nama_kejohanan);
  const weather = optionalText(input.cuaca, 100);
  const scores = scoreFields.map((field) => score(input[field]));
  if (time === false || tournament === false || weather === false || scores.includes(false)) {
    return json({ error: true, message: 'Butiran perlawanan tidak sah.' }, 400);
  }
  const fingerprint = matchFingerprint(date, time, home, away, tournament, venue, kind, districtId);
  const duplicate = await env.DB.prepare('SELECT 1 FROM perlawanan WHERE match_dedup_key=? LIMIT 1')
    .bind(fingerprint).first();
  if (duplicate) return json({ error: true,
    message: 'Perlawanan ini telah direkodkan. Semak rekod perlawanan anda atau minta pegawai yang mendaftar berkongsi maklumatnya.' }, 409);
  const [district, users, districtApprovers] = await Promise.all([
    env.DB.prepare('SELECT id,nama FROM districts WHERE id=?').bind(districtId)
      .first<{ id: number; nama: string }>(),
    env.DB.prepare(`SELECT u.id,u.nama_penuh,u.aktif,
      CASE WHEN u.role='Pengadil' OR (u.role='PP Daerah' AND
        (u.jenis_pengadil IN ('Pengadil Negeri','Pengadil Kebangsaan','Kelas III FAM','Kelas I FAM')
         OR EXISTS (SELECT 1 FROM permohonan ref WHERE ref.user_id=u.id
           AND ref.jenis_borang='pengadil_berdaftar' AND ref.status='Approved'
           AND COALESCE(ref.jenis_pengadil,'') NOT IN ('Penilai Pengadil','Pegawai Pembangunan'))))
        THEN 1 ELSE 0 END AS can_referee
      FROM users u WHERE u.id IN (${officials.map(() => '?').join(',')})`)
      .bind(...officials.map((item) => item.user_id))
      .all<{ id: number; nama_penuh: string; aktif: number; can_referee: number }>(),
    env.DB.prepare(`SELECT u.id,u.nama_penuh,u.email FROM users u
      JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id
      JOIN districts d ON d.nama=p.daerah
      WHERE u.role='PP Daerah' AND u.aktif=1 AND d.id=?`)
      .bind(districtId).all<Recipient>(),
  ]);
  if (!district) return json({ error: true, message: 'Daerah perlawanan tidak dijumpai.' }, 422);
  if (users.results.length !== officials.length || users.results.some((user) =>
    Number(user.aktif) !== 1 || Number(user.can_referee) !== 1)) {
    return json({ error: true, message: 'Semua pegawai perlawanan mesti mempunyai akaun pengadil yang aktif.' }, 422);
  }
  const groupId = crypto.randomUUID();
  // Doubtful records are still saved; the PP Daerah must review them before verifying.
  const conflicts = (await findMatchConflicts(env, officials.map((item, index) => ({
    id: -1 - index, user_id: item.user_id, tarikh: date, masa: time, tempat: venue,
    home_team: home, away_team: away, match_group_id: groupId,
  })))).get(`g:${groupId}`) ?? [];
  const formattedDate = date.split('-').reverse().join('/');
  const message = `${actorName} telah merekod perlawanan ${home} vs ${away} pada ${formattedDate} di ${venue} (${district.nama}). ${officials.length} pegawai perlawanan. Sila semak dan sahkan.`;
  const statements: D1PreparedStatement[] = officials.map((item, index) => env.DB.prepare(`
    INSERT INTO perlawanan(match_dedup_key,match_group_id,user_id,submitted_by,tarikh,masa,jenis,nama_kejohanan,
      tempat,jawatan,home_team,away_team,daerah_perlawanan_id,
      skor_ht_home,skor_ht_away,skor_ft_home,skor_ft_away,
      skor_et_home,skor_et_away,skor_ps_home,skor_ps_away,cuaca,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','+8 hours'))`)
    .bind(index === 0 ? fingerprint : null, groupId, item.user_id, actorId, date, time, kind, tournament, venue, item.jawatan,
      home, away, districtId, ...scores, weather));
  for (const approver of districtApprovers.results) {
    statements.push(env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,created_at)
      VALUES(?,'Perlawanan Baru','Perlawanan Baru Untuk Pengesahan',?,datetime('now','+8 hours'))`)
      .bind(approver.id, message));
  }
  for (const official of officials) {
    if (official.user_id === actorId) continue;
    statements.push(env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,created_at)
      VALUES(?,'Rekod Perlawanan','Rekod Perlawanan Baru Dimasukkan',?,datetime('now','+8 hours'))`)
      .bind(official.user_id,
        `${actorName} telah merekodkan anda sebagai ${official.jawatan} dalam perlawanan ${home} vs ${away} pada ${formattedDate} di ${venue}.`));
  }
  let results: D1Result[];
  try {
    results = await env.DB.batch(statements);
  } catch (error) {
    const duplicateAfterRace = await env.DB.prepare('SELECT 1 FROM perlawanan WHERE match_dedup_key=? LIMIT 1')
      .bind(fingerprint).first();
    if (duplicateAfterRace) return json({ error: true,
      message: 'Perlawanan yang sama baru sahaja didaftarkan oleh pegawai lain. Rekod anda tidak ditambah.' }, 409);
    throw error;
  }
  const matchIds = results.slice(0, officials.length).map((result) => result.meta.last_row_id);
  let emailsSent = 0;
  for (const approver of districtApprovers.results) {
    if (!approver.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approver.email)) continue;
    try {
      const details = [message,
        `Pegawai: ${officials.map((official) => {
          const name = users.results.find((user) => user.id === official.user_id)?.nama_penuh ?? '';
          return `${name} (${official.jawatan})`;
        }).join(', ')}`];
      const { html, text } = buildRefpahangEmail('Perlawanan Baru Untuk Pengesahan',
        approver.nama_penuh, details,
        { label: 'Semak Perlawanan', url: new URL('/pp-daerah/pengesahan-perlawanan', env.BASE_URL).toString() });
      await sendRefpahangEmail(env, 'pengesahan', approver.email, approver.nama_penuh,
        'Perlawanan Baru Untuk Pengesahan - PBNP', html, text);
      emailsSent++;
    } catch {
      console.error('Match verification email could not be sent');
    }
  }
  return json({ error: false,
    message: `Rekod perlawanan berjaya ditambah untuk ${officials.length} pegawai.${conflicts.length
      ? ` Perhatian: ${conflictSummary(conflicts)} PP Daerah akan menyemak rekod ini sebelum disahkan.` : ''}`,
    pertindihan: conflicts,
    match_group_id: groupId, match_ids: matchIds, emails_sent: emailsSent });
}

async function editMatch(input: Record<string, unknown>, env: Env, userId: number): Promise<Response> {
  const matchId = positiveId(input.match_id);
  if (!matchId) return json({ error: true, message: 'ID perlawanan diperlukan.' }, 400);
  const match = await env.DB.prepare(`SELECT id,match_group_id,lantikan_id,status_pp
    FROM perlawanan WHERE id=? AND user_id=?`).bind(matchId, userId)
    .first<{ id: number; match_group_id: string | null; lantikan_id: number | null; status_pp: string | null }>();
  if (!match) return json({ error: true, message: 'Perlawanan tidak dijumpai atau anda tidak mempunyai akses.' }, 403);
  if (match.lantikan_id || match.status_pp === 'Disahkan') {
    return json({ error: true, message: 'Rekod rasmi atau yang telah disahkan tidak boleh diubah.' }, 409);
  }
  if (match.match_group_id) {
    return json({ error: true, message: 'Suntingan perlawanan berkumpulan perlu melalui pentadbir.' }, 409);
  }
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (Object.hasOwn(input, 'tarikh')) {
    if (!validMatchDate(input.tarikh) || tooOld(input.tarikh)) {
      return json({ error: true, message: 'Tarikh perlawanan tidak sah atau melebihi 14 hari.' }, 400);
    }
    fields.push('tarikh=?'); values.push(input.tarikh);
  }
  for (const field of textFields) {
    if (!Object.hasOwn(input, field)) continue;
    const value = optionalText(input[field]);
    if (value === false || (field !== 'cuaca' && !value)) {
      return json({ error: true, message: `Medan ${field} tidak sah.` }, 400);
    }
    fields.push(`${field}=?`); values.push(value);
  }
  for (const field of scoreFields) {
    if (!Object.hasOwn(input, field)) continue;
    const value = score(input[field]);
    if (value === false) return json({ error: true, message: `Skor ${field} tidak sah.` }, 400);
    fields.push(`${field}=?`); values.push(value);
  }
  if (Object.hasOwn(input, 'daerah_perlawanan_id')) {
    const districtId = positiveId(input.daerah_perlawanan_id);
    if (!districtId || !(await env.DB.prepare('SELECT id FROM districts WHERE id=?').bind(districtId).first())) {
      return json({ error: true, message: 'Daerah perlawanan tidak sah.' }, 400);
    }
    fields.push('daerah_perlawanan_id=?'); values.push(districtId);
  }
  if (!fields.length) return json({ error: true, message: 'Tiada perubahan untuk dikemaskini.' }, 400);
  const result = await env.DB.prepare(`UPDATE perlawanan SET ${fields.join(',')} WHERE id=? AND user_id=?
    AND lantikan_id IS NULL AND match_group_id IS NULL AND COALESCE(status_pp,'')<>'Disahkan'`)
    .bind(...values, matchId, userId).run();
  if (!wroteRow(result)) return json({ error: true, message: 'Rekod berubah semasa semakan.' }, 409);
  return json({ error: false, message: 'Rekod perlawanan berjaya dikemaskini.' });
}

async function deleteMatch(input: Record<string, unknown>, env: Env, userId: number): Promise<Response> {
  const matchId = positiveId(input.match_id);
  if (!matchId) return json({ error: true, message: 'ID perlawanan diperlukan.' }, 400);
  const match = await env.DB.prepare(`SELECT id,lantikan_id,status_pp,home_team,away_team,tarikh
    FROM perlawanan WHERE id=? AND user_id=?`).bind(matchId, userId)
    .first<{ id: number; lantikan_id: number | null; status_pp: string | null;
      home_team: string | null; away_team: string | null; tarikh: string }>();
  if (!match) return json({ error: true, message: 'Perlawanan tidak dijumpai atau anda tidak mempunyai akses.' }, 403);
  if (match.lantikan_id) return json({ error: true, message: 'Rekod lantikan rasmi tidak boleh dipadam.' }, 403);
  if (match.status_pp === 'Disahkan') {
    return json({ error: true, message: 'Rekod yang telah disahkan tidak boleh dipadam.' }, 409);
  }
  const results = await env.DB.batch([
    env.DB.prepare(`DELETE FROM perlawanan WHERE id=? AND user_id=? AND lantikan_id IS NULL
      AND COALESCE(status_pp,'')<>'Disahkan'`).bind(matchId, userId),
    env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
      SELECT ?,'referee_delete_match','perlawanan',?,?,datetime('now','+8 hours') WHERE changes()=1`)
      .bind(userId, matchId, `${match.home_team ?? ''} vs ${match.away_team ?? ''} (${match.tarikh})`),
  ]);
  if (!wroteRow(results[0])) return json({ error: true, message: 'Perlawanan sudah berubah.' }, 409);
  return json({ error: false, message: 'Rekod perlawanan berjaya dipadam.' });
}

export async function refereeMatchManage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (Number(actor.can_referee) !== 1) return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const body = await boundedJson(request, 16384);
  if (body instanceof Response) return body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: true, message: 'Data tidak sah.' }, 400);
  }
  const input = body as Record<string, unknown>;
  if (input.action === 'add') return addMatch(input, env, actor.id, actor.nama_penuh);
  if (input.action === 'edit') return editMatch(input, env, actor.id);
  if (input.action === 'delete') return deleteMatch(input, env, actor.id);
  return json({ error: true, message: 'Action tidak sah. Gunakan: add, edit, atau delete.' }, 400);
}
