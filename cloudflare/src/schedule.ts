import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

const fields = ['no_perlawanan', 'tarikh', 'masa', 'kategori', 'peringkat', 'kumpulan',
  'pasukan_home', 'pasukan_away', 'tempat'] as const;
type ScheduleFields = Record<(typeof fields)[number], string>;

function idOf(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function matchStarted(date: string, time: string): boolean {
  if (!validDate(date) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return false;
  const timestamp = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`);
  return Number.isFinite(timestamp) && Date.now() >= timestamp;
}

function parseFields(raw: unknown): ScheduleFields | Response {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return json({ error: true, message: 'Data perlawanan tidak sah.' }, 400);
  }
  const input = raw as Record<string, unknown>;
  const values = {} as ScheduleFields;
  for (const field of fields) {
    if (input[field] != null && typeof input[field] !== 'string') {
      return json({ error: true, message: `Medan ${field} tidak sah.` }, 400);
    }
    values[field] = String(input[field] ?? '').trim();
    if (values[field].length > 255) return json({ error: true, message: `Medan ${field} terlalu panjang.` }, 400);
  }
  if (!validDate(values.tarikh) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(values.masa)) {
    return json({ error: true, message: 'Tarikh atau masa tidak sah.' }, 400);
  }
  return values;
}

function dayName(date: string): string {
  return ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function prefix(category: string): string {
  return category.replace(/\s+/g, '').toUpperCase() || 'P';
}

async function historyStatements(env: Env, id: number, values: ScheduleFields): Promise<D1PreparedStatement[]> {
  const match = await env.DB.prepare(`
    SELECT k.nama AS nama_kejohanan FROM jadual_perlawanan jp
    JOIN kejohanan k ON k.id=jp.kejohanan_id WHERE jp.id=?
  `).bind(id).first<{ nama_kejohanan: string }>();
  if (!match) return [];
  const jenis = [match.nama_kejohanan, values.kategori, values.peringkat].filter(Boolean).join(' - ').slice(0, 60) || 'Kejohanan';
  // Existing history retains its result, PP verification, and row identity.
  return [env.DB.prepare(`
    UPDATE perlawanan SET tarikh=?,masa=?,jenis=?,nama_kejohanan=?,tempat=?,
      home_team=?,away_team=?
    WHERE lantikan_id IN (
      SELECT lp.id FROM lantikan_pengadil lp WHERE lp.jadual_id=? AND lp.status='Diterima'
        AND lp.pengadil_id IS NOT NULL AND lp.jawatan IN
          ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')
    ) AND NOT EXISTS (SELECT 1 FROM laporan_penilaian WHERE jadual_id=?)
  `).bind(values.tarikh, values.masa, jenis, match.nama_kejohanan,
    values.tempat, values.pasukan_home, values.pasukan_away, id, id)];
}

async function logoFromRegistry(env: Env, id: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`UPDATE jadual_perlawanan SET logo_home=(
      SELECT logo_path FROM pasukan_logo WHERE nama=jadual_perlawanan.pasukan_home COLLATE NOCASE LIMIT 1)
      WHERE id=?`).bind(id),
    env.DB.prepare(`UPDATE jadual_perlawanan SET logo_away=(
      SELECT logo_path FROM pasukan_logo WHERE nama=jadual_perlawanan.pasukan_away COLLATE NOCASE LIMIT 1)
      WHERE id=?`).bind(id),
  ]);
}

async function logoUpload(request: Request, env: Env, id: number | null, side: string | null): Promise<Response> {
  if (!id || !['home', 'away'].includes(side ?? '')) {
    return json({ error: true, message: 'id dan side (home/away) diperlukan.' }, 400);
  }
  const column = side === 'home' ? 'pasukan_home' : 'pasukan_away';
  const match = await env.DB.prepare(`SELECT ${column} AS nama FROM jadual_perlawanan WHERE id=?`)
    .bind(id).first<{ nama: string | null }>();
  if (!match) return json({ error: true, message: 'Perlawanan tidak dijumpai.' }, 404);
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.toLowerCase().startsWith('multipart/form-data;')) {
    return json({ error: true, message: 'Fail logo diperlukan.' }, 400);
  }
  if (Number(request.headers.get('Content-Length') ?? 0) > 2_200_000) {
    return json({ error: true, message: 'Saiz fail melebihi 2MB.' }, 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return json({ error: true, message: 'Fail logo diperlukan.' }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_200_000) {
      await reader.cancel();
      return json({ error: true, message: 'Saiz fail melebihi 2MB.' }, 413);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  let form: FormData;
  try {
    form = await new Request(request.url, { method: 'POST', headers: { 'Content-Type': type }, body }).formData();
  } catch { return json({ error: true, message: 'Fail logo diperlukan.' }, 400); }
  const file = form.get('logo');
  if (!(file instanceof File)) return json({ error: true, message: 'Fail logo diperlukan.' }, 400);
  if (file.size > 2 * 1024 * 1024) return json({ error: true, message: 'Saiz fail melebihi 2MB.' }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const starts = (sig: number[]) => sig.every((part, index) => bytes[index] === part);
  let mime: string;
  let ext: string;
  if (starts([255, 216, 255])) { mime = 'image/jpeg'; ext = 'jpg'; }
  else if (starts([137, 80, 78, 71, 13, 10, 26, 10])) { mime = 'image/png'; ext = 'png'; }
  else if (starts([71, 73, 70, 56]) && [55, 57].includes(bytes[4]) && bytes[5] === 97) {
    mime = 'image/gif'; ext = 'gif';
  } else if (starts([82, 73, 70, 70]) && bytes.slice(8, 12).every((b, i) => b === [87, 69, 66, 80][i])) {
    mime = 'image/webp'; ext = 'webp';
  } else return json({ error: true, message: 'Format fail tidak disokong.' }, 400);
  const key = `logos/pasukan_${id}_${side}_${crypto.randomUUID()}.${ext}`;
  const path = `/uploads/${key}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    const name = (match.nama ?? '').trim();
    if (name) {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO pasukan_logo(nama,logo_path,created_at,updated_at)
          VALUES(?,?,datetime('now','+8 hours'),datetime('now','+8 hours'))
          ON CONFLICT(nama) DO UPDATE SET logo_path=excluded.logo_path,updated_at=datetime('now','+8 hours')`)
          .bind(name, path),
        env.DB.prepare(`UPDATE jadual_perlawanan SET logo_home=? WHERE pasukan_home=? COLLATE NOCASE`).bind(path, name),
        env.DB.prepare(`UPDATE jadual_perlawanan SET logo_away=? WHERE pasukan_away=? COLLATE NOCASE`).bind(path, name),
      ]);
    } else {
      await env.DB.prepare(`UPDATE jadual_perlawanan SET logo_${side}=? WHERE id=?`).bind(path, id).run();
    }
  } catch (error) {
    await env.MEDIA.delete(key);
    throw error;
  }
  return json({ error: false, message: 'Logo berjaya dimuat naik.', logo_path: path });
}

export async function schedule(request: Request, env: Env): Promise<Response> {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    if (url.searchParams.has('id')) {
      const id = idOf(url.searchParams.get('id'));
      if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
      const match = await env.DB.prepare(`SELECT jp.*,k.nama AS nama_kejohanan
        FROM jadual_perlawanan jp JOIN kejohanan k ON k.id=jp.kejohanan_id WHERE jp.id=?`)
        .bind(id).first<Record<string, unknown>>();
      if (!match) return json({ error: true, message: 'Perlawanan tidak dijumpai.' }, 404);
      const assigned = await env.DB.prepare(`SELECT lp.id,lp.jawatan,lp.status,lp.komen,lp.tarikh_jawab,
        lp.notif_hantar,lp.pengadil_id,lp.pengadil_luar_id,
        COALESCE(u.nama_penuh,pl.nama) AS nama_penuh,
        COALESCE(u.no_telefon,pl.no_tel) AS no_telefon,
        COALESCE(u.email,pl.emel) AS email,u.url_gambar_profil
        FROM lantikan_pengadil lp LEFT JOIN users u ON u.id=lp.pengadil_id
        LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id WHERE lp.jadual_id=?
        ORDER BY CASE lp.jawatan WHEN 'Pengadil' THEN 1 WHEN 'Penolong Pengadil 1' THEN 2
          WHEN 'Penolong Pengadil 2' THEN 3 WHEN 'Pegawai ke4' THEN 4 ELSE 5 END`)
        .bind(id).all();
      return json({ error: false, perlawanan: { ...match, is_started: matchStarted(String(match.tarikh), String(match.masa)), lantikan: assigned.results } });
    }
    const tournamentId = idOf(url.searchParams.get('kejohanan_id'));
    if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
    const result = await env.DB.prepare(`SELECT jp.*,
      (SELECT COUNT(*) FROM lantikan_pengadil lp WHERE lp.jadual_id=jp.id
        AND lp.status IN ('Belum Jawab','Diterima')) AS jumlah_lantikan,
      (SELECT COUNT(*) FROM lantikan_pengadil lp WHERE lp.jadual_id=jp.id AND lp.status='Diterima') AS jumlah_terima
      FROM jadual_perlawanan jp WHERE jp.kejohanan_id=?
      ORDER BY jp.kategori,jp.tarikh,jp.masa,
        CAST(SUBSTR(jp.no_perlawanan,INSTR(jp.no_perlawanan,'-')+1) AS INTEGER),jp.no_perlawanan`)
      .bind(tournamentId).all<Record<string, unknown>>();
    return json({ error: false, data: result.results.map((match) => ({
      ...match, is_started: matchStarted(String(match.tarikh), String(match.masa)),
    })) });
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  if (request.method === 'POST' && url.searchParams.get('action') === 'logo') {
    return logoUpload(request, env, idOf(url.searchParams.get('id')), url.searchParams.get('side'));
  }
  if (request.method === 'DELETE' || (request.method === 'POST' && url.searchParams.get('action') === 'bulk_delete')) {
    let ids: number[];
    if (request.method === 'DELETE') {
      const id = idOf(url.searchParams.get('id'));
      if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
      ids = [id];
    } else {
      const body = await boundedJson(request, 16 * 1024);
      if (body instanceof Response) return body;
      const raw = (body && typeof body === 'object' && !Array.isArray(body)) ? (body as Record<string, unknown>).ids : null;
      if (!Array.isArray(raw) || !raw.length || raw.length > 200) {
        return json({ error: true, message: 'Senarai ID diperlukan (maksimum 200).' }, 400);
      }
      ids = raw.map(idOf).filter((id): id is number => id !== null);
      if (ids.length !== raw.length) return json({ error: true, message: 'Senarai ID tidak sah.' }, 400);
      ids = [...new Set(ids)];
    }
    const placeholders = ids.map(() => '?').join(',');
    // One D1 statement makes bulk deletion all-or-nothing, including when a
    // concurrent request creates an appointment after the caller's preview.
    const result = await env.DB.prepare(`DELETE FROM jadual_perlawanan
      WHERE id IN (${placeholders})
      AND (SELECT COUNT(*) FROM jadual_perlawanan WHERE id IN (${placeholders}))=?
      AND NOT EXISTS (
        SELECT 1 FROM jadual_perlawanan j WHERE j.id IN (${placeholders}) AND (
          EXISTS(SELECT 1 FROM lantikan_pengadil lp WHERE lp.jadual_id=j.id)
          OR EXISTS(SELECT 1 FROM laporan_penilaian lp WHERE lp.jadual_id=j.id)
          OR EXISTS(SELECT 1 FROM lantikan_audit_log al WHERE al.jadual_id=j.id)
        )
      )`).bind(...ids, ...ids, ids.length, ...ids).run();
    if (result.meta.changes !== ids.length) {
      return json({ error: true, message: 'Perlawanan mempunyai lantikan, laporan atau audit, atau ID tidak dijumpai. Tiada perlawanan dipadam.' }, 409);
    }
    return json({ error: false, message: `${ids.length} perlawanan berjaya dipadam.` });
  }
  const body = await boundedJson(request, 16 * 1024);
  if (body instanceof Response) return body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: true, message: 'Data perlawanan tidak sah.' }, 400);
  }
  const input = body as Record<string, unknown>;
  if (request.method === 'POST' && url.searchParams.get('action') === 'renumber') {
    const tournamentId = idOf(input.kejohanan_id);
    if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
    const result = await env.DB.prepare(`WITH numbered AS (
      SELECT id,
        COALESCE(NULLIF(UPPER(REPLACE(REPLACE(REPLACE(TRIM(kategori), ' ', ''), char(9), ''), char(10), '')), ''), 'P') AS pref,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(NULLIF(UPPER(REPLACE(REPLACE(REPLACE(TRIM(kategori), ' ', ''), char(9), ''), char(10), '')), ''), 'P')
          ORDER BY tarikh,masa,id
        ) AS seq
      FROM jadual_perlawanan WHERE kejohanan_id=?
    ) UPDATE jadual_perlawanan
      SET no_perlawanan=(SELECT pref || '-' || printf('%02d', seq) FROM numbered WHERE numbered.id=jadual_perlawanan.id)
      WHERE id IN (SELECT id FROM numbered)`).bind(tournamentId).run();
    return json({ error: false, message: `${result.meta.changes} perlawanan dinomborkan semula ikut kategori & masa.` });
  }
  const values = parseFields(input);
  if (values instanceof Response) return values;
  if (request.method === 'POST') {
    const tournamentId = idOf(input.kejohanan_id);
    if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
    const tournament = await env.DB.prepare('SELECT id FROM kejohanan WHERE id=?').bind(tournamentId).first();
    if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
    let number = values.no_perlawanan;
    if (!number) {
      const key = prefix(values.kategori);
      const existing = await env.DB.prepare('SELECT no_perlawanan FROM jadual_perlawanan WHERE kejohanan_id=? AND no_perlawanan LIKE ?')
        .bind(tournamentId, `${key}-%`).all<{ no_perlawanan: string }>();
      const max = existing.results.reduce((acc, row) => {
        const suffix = row.no_perlawanan.match(/-(\d+)$/);
        return Math.max(acc, suffix ? Number(suffix[1]) : 0);
      }, 0);
      number = `${key}-${String(max + 1).padStart(2, '0')}`;
    }
    const result = await env.DB.prepare(`INSERT INTO jadual_perlawanan
      (kejohanan_id,no_perlawanan,tarikh,masa,hari,kategori,peringkat,kumpulan,
       pasukan_home,pasukan_away,tempat,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,'Belum Lantik',datetime('now','+8 hours'),datetime('now','+8 hours'))`)
      .bind(tournamentId, number, values.tarikh, values.masa, dayName(values.tarikh), values.kategori,
        values.peringkat, values.kumpulan, values.pasukan_home, values.pasukan_away, values.tempat).run();
    const id = result.meta.last_row_id;
    await logoFromRegistry(env, id);
    return json({ error: false, message: 'Perlawanan berjaya ditambah.', id, no_perlawanan: number });
  }
  const id = idOf(input.id);
  if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
  const report = await env.DB.prepare('SELECT 1 FROM laporan_penilaian WHERE jadual_id=? LIMIT 1').bind(id).first();
  if (report) return json({ error: true, message: 'Perlawanan tidak boleh diubah kerana laporan RA telah diwujudkan.' }, 409);
  const history = await historyStatements(env, id, values);
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE jadual_perlawanan SET no_perlawanan=?,tarikh=?,masa=?,hari=?,
      kategori=?,peringkat=?,kumpulan=?,pasukan_home=?,pasukan_away=?,tempat=?,
      updated_at=datetime('now','+8 hours')
      WHERE id=? AND NOT EXISTS(SELECT 1 FROM laporan_penilaian WHERE jadual_id=?)`)
      .bind(values.no_perlawanan, values.tarikh, values.masa, dayName(values.tarikh), values.kategori,
        values.peringkat, values.kumpulan, values.pasukan_home, values.pasukan_away, values.tempat, id, id),
    ...history,
  ]);
  if (results[0].meta.changes !== 1) {
    return json({ error: true, message: 'Perlawanan tidak dijumpai atau laporan RA telah diwujudkan.' }, 409);
  }
  await logoFromRegistry(env, id);
  return json({ error: false, message: 'Perlawanan berjaya dikemaskini.' });
}
