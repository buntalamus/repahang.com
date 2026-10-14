import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

const states = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis',
  'Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','WP Kuala Lumpur','WP Putrajaya','WP Labuan'];
const grades = ['Pengadil Negeri','Pengadil Kebangsaan','Kelas 1','Kelas 2','Kelas 3','Penilai Pengadil'];
const stateAliases: Record<string, string> = { 'kuala lumpur': 'WP Kuala Lumpur', kl: 'WP Kuala Lumpur',
  putrajaya: 'WP Putrajaya', labuan: 'WP Labuan' };
const gradeAliases: Record<string, string> = { keb: 'Pengadil Kebangsaan', kebangsaan: 'Pengadil Kebangsaan',
  negeri: 'Pengadil Negeri', k1: 'Kelas 1', k2: 'Kelas 2', k3: 'Kelas 3', penilai: 'Penilai Pengadil',
  ra: 'Penilai Pengadil' };

function idOf(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function normalize(value: string, canonical: string[], aliases: Record<string, string>): string | null {
  const lower = value.trim().toLowerCase();
  return aliases[lower] ?? canonical.find((item) => item.toLowerCase() === lower) ?? null;
}

function parseFields(body: unknown): { nama: string; daerah: string; negeri: string;
  no_tel: string; emel: string; jenis_pengadil: string } | Response {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: true, message: 'Data pengadil luar tidak sah.' }, 400);
  }
  const input = body as Record<string, unknown>;
  const fields = ['nama','daerah','negeri','no_tel','emel','jenis_pengadil'];
  for (const field of fields) {
    if (input[field] != null && typeof input[field] !== 'string') {
      return json({ error: true, message: `${field} tidak sah.` }, 400);
    }
  }
  const nama = String(input.nama ?? '').trim();
  const daerah = String(input.daerah ?? '').trim();
  const stateRaw = String(input.negeri ?? '').trim();
  const negeri = normalize(stateRaw, states, stateAliases);
  const jenis_pengadil = normalize(String(input.jenis_pengadil ?? '') || 'Pengadil Negeri', grades, gradeAliases);
  const no_tel = String(input.no_tel ?? '').trim();
  const emel = String(input.emel ?? '').trim().toLowerCase();
  if (!nama || !daerah || !stateRaw) return json({ error: true, message: 'Nama, daerah dan negeri diperlukan.' }, 400);
  if (!negeri) return json({ error: true, message: 'Negeri tidak sah.' }, 400);
  if (!jenis_pengadil) return json({ error: true, message: 'Jenis pengadil tidak sah.' }, 400);
  if (emel && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emel) || emel.length > 254)) {
    return json({ error: true, message: 'Format emel tidak sah.' }, 400);
  }
  if (nama.length > 255 || daerah.length > 100 || no_tel.length > 30) {
    return json({ error: true, message: 'Maklumat pengadil luar terlalu panjang.' }, 400);
  }
  return { nama,daerah,negeri,no_tel,emel,jenis_pengadil };
}

const linked = `EXISTS(SELECT 1 FROM lantikan_pengadil lp WHERE lp.pengadil_luar_id=pengadil_luar.id)
  OR EXISTS(SELECT 1 FROM kejohanan_pengesah_laporan c WHERE c.pengesah_luar_id=pengadil_luar.id)
  OR EXISTS(SELECT 1 FROM laporan_pengesahan_pengerusi c WHERE c.pengesah_luar_id=pengadil_luar.id)
  OR EXISTS(SELECT 1 FROM laporan_pengesahan_audit a WHERE a.actor_luar_id=pengadil_luar.id)`;

export async function externalReferees(request: Request, env: Env): Promise<Response> {
  if (!['GET','POST','PUT','DELETE'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  const query = new URL(request.url).searchParams;
  if (request.method === 'GET') {
    if (query.has('id')) {
      const id = idOf(query.get('id'));
      if (!id) return json({ error: true, message: 'ID tidak sah.' }, 400);
      const row = await env.DB.prepare('SELECT * FROM pengadil_luar WHERE id=?').bind(id).first();
      if (!row) return json({ error: true, message: 'Tidak dijumpai.' }, 404);
      return json({ error: false, pengadil: row });
    }
    const search = (query.get('search') ?? '').trim().slice(0, 100);
    const district = (query.get('daerah') ?? '').trim().slice(0, 100);
    const state = (query.get('negeri') ?? '').trim().slice(0, 100);
    const where: string[] = [];
    const params: string[] = [];
    if (search) {
      where.push(`(nama LIKE ? OR daerah LIKE ? OR negeri LIKE ? OR emel LIKE ? OR no_tel LIKE ?)`);
      params.push(...Array(5).fill(`%${search}%`));
    }
    if (district) { where.push('daerah=?'); params.push(district); }
    if (state) { where.push('negeri=?'); params.push(state); }
    const result = await env.DB.prepare(`SELECT * FROM pengadil_luar ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY nama COLLATE NOCASE`).bind(...params).all();
    return json({ error: false, data: result.results });
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  if (request.method === 'DELETE') {
    const raw = query.get('ids');
    const ids = raw ? raw.split(',').map(idOf) : [idOf(query.get('id'))];
    if (!ids.length || ids.length > 200 || ids.some((id) => id === null)) {
      return json({ error: true, message: 'ID tidak sah.' }, 400);
    }
    const unique = [...new Set(ids as number[])];
    const placeholders = unique.map(() => '?').join(',');
    const result = await env.DB.prepare(`DELETE FROM pengadil_luar WHERE id IN (${placeholders})
      AND (SELECT COUNT(*) FROM pengadil_luar WHERE id IN (${placeholders}))=?
      AND NOT EXISTS (SELECT 1 FROM pengadil_luar WHERE id IN (${placeholders}) AND (${linked}))`)
      .bind(...unique, ...unique, unique.length, ...unique).run();
    if (result.meta.changes !== unique.length) {
      return json({ error: true, message: 'Pengadil luar tidak boleh dipadam kerana mempunyai rekod lantikan, pengesahan atau audit; atau ID tidak dijumpai. Tiada rekod dipadam.' }, 409);
    }
    return json({ error: false, message: raw ? `${unique.length} pengadil luar berjaya dipadam.` : 'Pengadil luar berjaya dipadam.' });
  }
  const body = await boundedJson(request, 8192);
  if (body instanceof Response) return body;
  const fields = parseFields(body);
  if (fields instanceof Response) return fields;
  if (request.method === 'POST') {
    const result = await env.DB.prepare(`INSERT INTO pengadil_luar(nama,daerah,negeri,no_tel,emel,jenis_pengadil,
      created_at,updated_at) VALUES(?,?,?,?,?,?,datetime('now','+8 hours'),datetime('now','+8 hours'))`)
      .bind(fields.nama,fields.daerah,fields.negeri,fields.no_tel,fields.emel,fields.jenis_pengadil).run();
    return json({ error: false, message: 'Pengadil luar berjaya ditambah.', id: result.meta.last_row_id });
  }
  const id = idOf((body as Record<string, unknown>).id);
  if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
  const result = await env.DB.prepare(`UPDATE pengadil_luar SET nama=?,daerah=?,negeri=?,no_tel=?,emel=?,
    jenis_pengadil=?,updated_at=datetime('now','+8 hours') WHERE id=?`)
    .bind(fields.nama,fields.daerah,fields.negeri,fields.no_tel,fields.emel,fields.jenis_pengadil,id).run();
  if (result.meta.changes !== 1) return json({ error: true, message: 'Pengadil luar tidak dijumpai.' }, 404);
  return json({ error: false, message: 'Pengadil luar berjaya dikemaskini.' });
}
