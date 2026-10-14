import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

function positiveId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const number = Number(value);
    if (Number.isSafeInteger(number)) return number;
  }
  return null;
}

type PoolItem = { pengadil_id: number | null; pengadil_luar_id: number | null };

function parseItems(input: Record<string, unknown>): PoolItem[] | Response {
  const raw = Array.isArray(input.items) && input.items.length > 0 ? input.items : [input];
  if (raw.length > 200) return json({ error: true, message: 'Maksimum 200 pengadil bagi satu permintaan.' }, 400);
  const items: PoolItem[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return json({ error: true, message: `Item pool #${index + 1} tidak sah.` }, 400);
    }
    const record = item as Record<string, unknown>;
    const registered = positiveId(record.pengadil_id);
    const external = positiveId(record.pengadil_luar_id);
    if ((registered === null) === (external === null)) {
      return json({ error: true, message: `Item pool #${index + 1} mesti mempunyai tepat satu identiti pengadil.` }, 400);
    }
    items.push({ pengadil_id: registered, pengadil_luar_id: external });
  }
  return items;
}

export async function refereePool(request: Request, env: Env): Promise<Response> {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const tournamentId = positiveId(url.searchParams.get('kejohanan_id'));
    if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
    const rows = await env.DB.prepare(`
      SELECT pp.id AS pool_id, pp.kejohanan_id, pp.pengadil_id, pp.pengadil_luar_id,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.nama_penuh ELSE pl.nama END AS nama,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.daerah ELSE pl.daerah END AS daerah,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.negeri ELSE pl.negeri END AS negeri,
        COALESCE(k.peringkat_kejohanan, 'Daerah') AS peringkat_kejohanan,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.no_telefon ELSE pl.no_tel END AS no_tel,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.email ELSE pl.emel END AS emel,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.jenis_pengadil ELSE pl.jenis_pengadil END AS jenis_pengadil,
        CASE WHEN COALESCE(u.telegram_chat_id,pl.telegram_chat_id) IS NOT NULL
          AND COALESCE(u.telegram_chat_id,pl.telegram_chat_id) <> '' THEN 1 ELSE 0 END AS telegram_linked
      FROM pool_pengadil pp
      JOIN kejohanan k ON k.id=pp.kejohanan_id
      LEFT JOIN users u ON u.id=pp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=pp.pengadil_luar_id
      WHERE pp.kejohanan_id=? ORDER BY nama COLLATE NOCASE ASC
    `).bind(tournamentId).all();
    return json({ error: false, data: rows.results.map((item) => ({
      ...item,
      wilayah: item.peringkat_kejohanan === 'Negeri' ? (item.daerah || '-') : (item.negeri || '-'),
      telegram_linked: Boolean(item.telegram_linked),
    })) });
  }

  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }

  if (request.method === 'POST') {
    const body = await boundedJson(request, 32 * 1024);
    if (body instanceof Response) return body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: true, message: 'Data pool tidak sah.' }, 400);
    }
    const input = body as Record<string, unknown>;
    const tournamentId = positiveId(input.kejohanan_id);
    if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
    const items = parseItems(input);
    if (items instanceof Response) return items;
    const tournament = await env.DB.prepare('SELECT 1 FROM kejohanan WHERE id=?').bind(tournamentId).first();
    if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
    for (const [table, ids] of [
      ['users', [...new Set(items.map((item) => item.pengadil_id).filter((id): id is number => id !== null))]],
      ['pengadil_luar', [...new Set(items.map((item) => item.pengadil_luar_id).filter((id): id is number => id !== null))]],
    ] as const) {
      for (let offset = 0; offset < ids.length; offset += 50) {
        const chunk = ids.slice(offset, offset + 50);
        const rows = await env.DB.prepare(`SELECT id FROM ${table} WHERE id IN (${chunk.map(() => '?').join(',')})`)
          .bind(...chunk).all<{ id: number }>();
        if (rows.results.length !== chunk.length) {
          return json({ error: true, message: 'Identiti pengadil dalam senarai tidak dijumpai.' }, 400);
        }
      }
    }
    const results = await env.DB.batch(items.map((item) => env.DB.prepare(`
      INSERT OR IGNORE INTO pool_pengadil(kejohanan_id,pengadil_id,pengadil_luar_id,created_at)
      VALUES(?,?,?,datetime('now','+8 hours'))
    `).bind(tournamentId, item.pengadil_id, item.pengadil_luar_id)));
    const added = results.filter((result) => result.meta.changes > 0).length;
    const skipped = items.length - added;
    const message = `${added} pengadil ditambah ke pool.${skipped ? ` ${skipped} sudah ada dalam pool.` : ''}`;
    return json({ error: false, message, added, skipped });
  }

  const id = positiveId(url.searchParams.get('id'));
  if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
  const result = await env.DB.prepare(`
    DELETE FROM pool_pengadil WHERE id=? AND NOT EXISTS (
      SELECT 1 FROM jadual_perlawanan jp
      JOIN lantikan_pengadil lp ON lp.jadual_id=jp.id
      WHERE jp.kejohanan_id=pool_pengadil.kejohanan_id
        AND ((pool_pengadil.pengadil_id IS NOT NULL AND lp.pengadil_id=pool_pengadil.pengadil_id)
          OR (pool_pengadil.pengadil_luar_id IS NOT NULL AND lp.pengadil_luar_id=pool_pengadil.pengadil_luar_id))
    )
  `).bind(id).run();
  if (result.meta.changes === 0) {
    const exists = await env.DB.prepare('SELECT 1 FROM pool_pengadil WHERE id=?').bind(id).first();
    if (exists) return json({ error: true, message: 'Pengadil tidak boleh dibuang dari pool kerana mempunyai rekod lantikan dalam kejohanan ini.' }, 409);
    return json({ error: true, message: 'Rekod pool tidak dijumpai.' }, 404);
  }
  return json({ error: false, message: 'Dibuang dari pool.' });
}
