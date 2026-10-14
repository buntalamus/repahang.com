import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

const statuses = ['Draf', 'Aktif', 'Selesai', 'Dibatalkan'];
const kinds = ['Karnival', 'Liga', 'Persahabatan'];
const levels = ['Daerah', 'Negeri', 'Kebangsaan', 'Asia'];
const listing = `
  SELECT k.*,u.nama_penuh AS created_by_nama,
    (SELECT COUNT(*) FROM jadual_perlawanan jp WHERE jp.kejohanan_id=k.id) AS jumlah_perlawanan
  FROM kejohanan k LEFT JOIN users u ON u.id=k.created_by
`;

function idOf(raw: string | null): number | null {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function fields(raw: unknown): Record<string, string> | Response {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return json({ error: true, message: 'Data kejohanan tidak sah.' }, 400);
  }
  const input = raw as Record<string, unknown>;
  for (const key of ['nama', 'tarikh_mula', 'tarikh_akhir', 'tempat', 'anjuran']) {
    if (input[key] != null && typeof input[key] !== 'string') {
      return json({ error: true, message: 'Data kejohanan tidak sah.' }, 400);
    }
  }
  const nama = (input.nama as string ?? '').trim();
  const start = (input.tarikh_mula as string ?? '').trim();
  const end = (input.tarikh_akhir as string ?? '').trim();
  if (!nama || !start || !end) {
    return json({ error: true, message: 'Nama, tarikh mula dan tarikh akhir diperlukan.' }, 400);
  }
  if (nama.length > 255 || !validDate(start)
    || !validDate(end) || start > end
    || (input.tempat as string ?? '').length > 255 || (input.anjuran as string ?? '').length > 255) {
    return json({ error: true, message: 'Maklumat kejohanan tidak sah.' }, 400);
  }
  const status = input.status ?? 'Draf';
  if (typeof status !== 'string' || !statuses.includes(status)) {
    return json({ error: true, message: 'Status tidak sah.' }, 400);
  }
  const jenis = kinds.includes(input.jenis_kejohanan as string) ? input.jenis_kejohanan as string : 'Persahabatan';
  const peringkat = levels.includes(input.peringkat_kejohanan as string) ? input.peringkat_kejohanan as string : 'Daerah';
  return {
    nama, tarikh_mula: start, tarikh_akhir: end, status,
    jenis_kejohanan: jenis, peringkat_kejohanan: peringkat,
    tempat: (input.tempat as string ?? '').trim(), anjuran: (input.anjuran as string ?? '').trim(),
  };
}

async function uploadLogo(request: Request, env: Env, id: number | null, side: string | null): Promise<Response> {
  if (!id || (side !== 'kiri' && side !== 'kanan')) {
    return json({ error: true, message: 'id dan side (kiri/kanan) diperlukan.' }, 400);
  }
  const tournament = await env.DB.prepare(`SELECT logo_${side} AS old_logo FROM kejohanan WHERE id=?`)
    .bind(id).first<{ old_logo: string | null }>();
  if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
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
  let data: FormData;
  try {
    data = await new Request(request.url, { method: 'POST', headers: { 'Content-Type': type }, body }).formData();
  } catch {
    return json({ error: true, message: 'Fail logo diperlukan.' }, 400);
  }
  const file = data.get('logo');
  if (!(file instanceof File)) return json({ error: true, message: 'Fail logo diperlukan.' }, 400);
  if (file.size > 2 * 1024 * 1024) {
    return json({ error: true, message: 'Saiz fail melebihi 2MB.' }, 413);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = (prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte);
  let mime: string;
  let extension: string;
  if (signature([0xff, 0xd8, 0xff])) { mime = 'image/jpeg'; extension = 'jpeg'; }
  else if (signature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) { mime = 'image/png'; extension = 'png'; }
  else if (signature([0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) { mime = 'image/gif'; extension = 'gif'; }
  else if (bytes.length >= 12 && signature([0x52, 0x49, 0x46, 0x46])
    && bytes.slice(8, 12).every((value, index) => value === [0x57, 0x45, 0x42, 0x50][index])) { mime = 'image/webp'; extension = 'webp'; }
  else return json({ error: true, message: 'Format fail tidak disokong.' }, 400);
  const key = `logos/kejohanan_${id}_${side}_${crypto.randomUUID()}.${extension}`;
  const logoPath = `/uploads/${key}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    const result = await env.DB.prepare(`UPDATE kejohanan SET logo_${side}=?,updated_at=datetime('now','+8 hours') WHERE id=?`)
      .bind(logoPath, id).run();
    if (result.meta.changes !== 1) throw new Error('Tournament disappeared during logo upload');
  } catch (error) {
    await env.MEDIA.delete(key);
    throw error;
  }
  const oldKey = tournament.old_logo?.startsWith('/uploads/logos/')
    ? tournament.old_logo.slice('/uploads/'.length) : null;
  if (oldKey) await env.MEDIA.delete(oldKey).catch(() => undefined);
  return json({ error: false, message: 'Logo berjaya dimuat naik.', logo_path: logoPath });
}

export async function tournaments(request: Request, env: Env): Promise<Response> {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  const url = new URL(request.url);
  if (request.method === 'GET') {
    if (url.searchParams.has('id')) {
      const id = idOf(url.searchParams.get('id'));
      if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
      const tournament = await env.DB.prepare(`${listing} WHERE k.id=?`).bind(id).first();
      if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
      return json({ error: false, kejohanan: tournament });
    }
    const rows = await env.DB.prepare(`${listing} ORDER BY k.tarikh_mula DESC`).all();
    return json({ error: false, data: rows.results });
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  if (request.method === 'POST' && url.searchParams.get('action') === 'logo') {
    return uploadLogo(request, env, idOf(url.searchParams.get('id')), url.searchParams.get('side'));
  }
  if (request.method === 'DELETE') {
    const id = idOf(url.searchParams.get('id'));
    if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
    const tournament = await env.DB.prepare('SELECT id,logo_kiri,logo_kanan FROM kejohanan WHERE id=?')
      .bind(id).first<{ id: number; logo_kiri: string | null; logo_kanan: string | null }>();
    if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
    const children = await env.DB.prepare('SELECT 1 FROM jadual_perlawanan WHERE kejohanan_id=? LIMIT 1').bind(id).first();
    if (children) {
      return json({ error: true, message: 'Tidak boleh memadam kejohanan yang masih mempunyai jadual perlawanan.' }, 400);
    }
    const audit = await env.DB.prepare('SELECT 1 FROM kejohanan_pengesah_laporan_audit WHERE kejohanan_id=? LIMIT 1')
      .bind(id).first();
    if (audit) {
      return json({ error: true, message: 'Kejohanan mempunyai rekod audit dan tidak boleh dipadam.' }, 409);
    }
    // D1 batch is transactional. Repeat both guards inside it so neither
    // confirmation nor match data disappears if another request changes them.
    const guarded = `NOT EXISTS (SELECT 1 FROM jadual_perlawanan WHERE kejohanan_id=?)
      AND NOT EXISTS (SELECT 1 FROM kejohanan_pengesah_laporan_audit WHERE kejohanan_id=?)`;
    const results = await env.DB.batch([
      env.DB.prepare(`DELETE FROM jadual_lantikan_pengesahan WHERE kejohanan_id=? AND ${guarded}`)
        .bind(id, id, id),
      env.DB.prepare(`DELETE FROM kejohanan WHERE id=? AND ${guarded}`)
        .bind(id, id, id),
    ]);
    const result = results[1];
    // D1 includes rows removed by FK cascades in this count.
    if (result.meta.changes < 1) {
      return json({ error: true, message: 'Tidak boleh memadam kejohanan yang masih mempunyai jadual perlawanan.' }, 409);
    }
    for (const path of [tournament.logo_kiri, tournament.logo_kanan]) {
      if (path?.startsWith('/uploads/logos/')) {
        await env.MEDIA.delete(path.slice('/uploads/'.length)).catch(() => undefined);
      }
    }
    return json({ error: false, message: 'Kejohanan berjaya dipadam.' });
  }
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  const parsed = fields(input);
  if (parsed instanceof Response) return parsed;
  if (request.method === 'POST') {
    const result = await env.DB.prepare(`
      INSERT INTO kejohanan(nama,jenis_kejohanan,peringkat_kejohanan,tarikh_mula,
        tarikh_akhir,tempat,anjuran,status,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,datetime('now','+8 hours'),datetime('now','+8 hours'))
    `).bind(parsed.nama, parsed.jenis_kejohanan, parsed.peringkat_kejohanan,
      parsed.tarikh_mula, parsed.tarikh_akhir, parsed.tempat, parsed.anjuran,
      parsed.status, user.id).run();
    return json({ error: false, message: 'Kejohanan berjaya dicipta.', id: result.meta.last_row_id });
  }
  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === 'number' && Number.isSafeInteger(raw.id) && raw.id > 0 ? raw.id : null;
  if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
  const result = await env.DB.prepare(`
    UPDATE kejohanan SET nama=?,jenis_kejohanan=?,peringkat_kejohanan=?,tarikh_mula=?,
      tarikh_akhir=?,tempat=?,anjuran=?,status=?,updated_at=datetime('now','+8 hours') WHERE id=?
  `).bind(parsed.nama, parsed.jenis_kejohanan, parsed.peringkat_kejohanan,
    parsed.tarikh_mula, parsed.tarikh_akhir, parsed.tempat, parsed.anjuran,
    parsed.status, id).run();
  if (result.meta.changes !== 1) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
  return json({ error: false, message: 'Kejohanan berjaya dikemaskini.' });
}
