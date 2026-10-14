import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

function idOf(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

type ScopedMatch = { id: number; user_id: number; tarikh: string; jenis: string | null;
  home_team: string | null; away_team: string | null; daerah_perlawanan_id: number | null };

function scope(persatuanId: number, districtId: number): { sql: string; params: number[] } {
  return {
    sql: `((p.match_group_id IS NOT NULL AND p.daerah_perlawanan_id=?)
      OR (p.match_group_id IS NULL AND u.persatuan_id=? AND u.role='Pengadil'))`,
    params: [districtId, persatuanId],
  };
}

async function list(request: Request, env: Env, persatuanId: number, districtId: number): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(100_000, Number(query.get('page')) || 1));
  const perPage = Math.max(1, Math.min(100, Number(query.get('per_page')) || 20));
  const status = query.get('status') ?? '';
  const condition = status === 'pending' ? " AND (p.status_pp IS NULL OR p.status_pp='' OR p.status_pp='Belum Disahkan')"
    : status === 'verified' ? " AND p.status_pp='Disahkan'"
      : status === 'rejected' ? " AND p.status_pp='Tidak Disahkan'" : '';
  const access = scope(persatuanId, districtId);
  const rows = await env.DB.prepare(`SELECT p.id,p.match_group_id,p.tarikh,p.masa,p.jenis,p.nama_kejohanan,
    p.tempat,p.jawatan,p.home_team,p.away_team,p.status_pp,p.catatan_pp,p.verified_at,p.created_at,
    p.lantikan_id,p.submitted_by,p.daerah_perlawanan_id,
    p.skor_ht_home,p.skor_ht_away,p.skor_ft_home,p.skor_ft_away,
    p.skor_et_home,p.skor_et_away,p.skor_ps_home,p.skor_ps_away,p.cuaca,
    d.nama AS daerah_perlawanan_nama,u.id AS pengadil_id,
    u.nama_penuh AS pengadil_nama,u.no_ic AS pengadil_ic,u.jenis_pengadil,
    sub.nama_penuh AS submitter_name
    FROM perlawanan p JOIN users u ON u.id=p.user_id
    LEFT JOIN users sub ON sub.id=p.submitted_by
    LEFT JOIN districts d ON d.id=p.daerah_perlawanan_id
    WHERE ${access.sql}${condition} ORDER BY p.tarikh DESC,p.match_group_id,p.id`)
    .bind(...access.params).all<Record<string, unknown>>();
  const grouped = new Map<string, Record<string, unknown>>();
  for (const row of rows.results) {
    const key = row.match_group_id ? `g:${row.match_group_id}` : `s:${row.id}`;
    let group = grouped.get(key);
    if (!group) {
      group = { ...row, id: Number(row.id), is_grouped: row.match_group_id !== null, officials: [] };
      delete group.pengadil_id;
      delete group.pengadil_nama;
      delete group.pengadil_ic;
      delete group.jenis_pengadil;
      delete group.jawatan;
      grouped.set(key, group);
    }
    (group.officials as Record<string, unknown>[]).push({
      id: Number(row.id),user_id: Number(row.pengadil_id),nama: row.pengadil_nama,
      no_ic: row.pengadil_ic,jenis_pengadil: row.jenis_pengadil,jawatan: row.jawatan,
    });
  }
  const stats = await env.DB.prepare(`SELECT
    COUNT(DISTINCT COALESCE(p.match_group_id,'single_' || p.id)) AS total,
    COUNT(DISTINCT CASE WHEN p.status_pp IS NULL OR p.status_pp='' OR p.status_pp='Belum Disahkan'
      THEN COALESCE(p.match_group_id,'single_' || p.id) END) AS pending,
    COUNT(DISTINCT CASE WHEN p.status_pp='Disahkan' THEN COALESCE(p.match_group_id,'single_' || p.id) END) AS verified,
    COUNT(DISTINCT CASE WHEN p.status_pp='Tidak Disahkan' THEN COALESCE(p.match_group_id,'single_' || p.id) END) AS rejected
    FROM perlawanan p JOIN users u ON u.id=p.user_id WHERE ${access.sql}`)
    .bind(...access.params).first();
  const all = [...grouped.values()];
  return json({ error: false, matches: all.slice((page - 1) * perPage, page * perPage),
    statistics: stats,pagination: { page,per_page: perPage,
      total_pages: Math.ceil(all.length / perPage),total_items: all.length } });
}

async function change(request: Request, env: Env, userId: number,
  persatuanId: number, districtId: number): Promise<Response> {
  const body = await boundedJson(request, 8192);
  if (body instanceof Response) return body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 422);
  }
  const input = body as Record<string, unknown>;
  const grouped = typeof input.match_group_id === 'string' && input.match_group_id !== '';
  const matchId = idOf(input.match_id);
  if (!grouped && !matchId) return json({ error: true, message: 'Parameter tidak sah.' }, 422);
  if (grouped && (input.match_group_id as string).length > 100) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 422);
  }
  const action = String(input.action ?? '');
  if (request.method === 'POST' && !['verify','reject','revert'].includes(action)) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 422);
  }
  if (input.notes != null && typeof input.notes !== 'string') {
    return json({ error: true, message: 'Catatan tidak sah.' }, 422);
  }
  const notes = String(input.notes ?? '').trim();
  if (notes.length > 1000) return json({ error: true, message: 'Catatan terlalu panjang.' }, 422);
  let rows: ScopedMatch[];
  let where: string;
  let params: (string | number)[];
  if (grouped) {
    const groupId = input.match_group_id as string;
    const found = await env.DB.prepare(`SELECT id,user_id,tarikh,jenis,home_team,away_team,daerah_perlawanan_id
      FROM perlawanan WHERE match_group_id=?`).bind(groupId).all<ScopedMatch>();
    rows = found.results;
    // A group must be wholly within the PP's district. This prevents an
    // accidental partial decision or a guessed group ID crossing a boundary.
    if (!rows.length || !districtId || rows.some((row) => row.daerah_perlawanan_id !== districtId)) {
      return json({ error: true, message: 'Perlawanan tidak dijumpai atau bukan dalam daerah anda.' }, 404);
    }
    where = 'match_group_id=? AND daerah_perlawanan_id=?';
    params = [groupId, districtId];
  } else {
    const found = await env.DB.prepare(`SELECT p.id,p.user_id,p.tarikh,p.jenis,p.home_team,p.away_team,p.daerah_perlawanan_id
      FROM perlawanan p JOIN users u ON u.id=p.user_id
      WHERE p.id=? AND p.match_group_id IS NULL AND u.persatuan_id=? AND u.role='Pengadil'`)
      .bind(matchId, persatuanId).all<ScopedMatch>();
    rows = found.results;
    if (!rows.length) return json({ error: true, message: 'Perlawanan tidak dijumpai atau bukan dalam daerah anda.' }, 404);
    where = `id=? AND match_group_id IS NULL AND EXISTS(
      SELECT 1 FROM users u WHERE u.id=perlawanan.user_id AND u.persatuan_id=? AND u.role='Pengadil')`;
    params = [matchId!, persatuanId];
  }
  const first = rows[0];
  const day = first.tarikh.split('-').reverse().join('/');
  const description = `Perlawanan ${first.home_team ?? ''} vs ${first.away_team ?? ''} pada ${day} - ${rows.length} rekod`;
  const operation = request.method === 'DELETE' ? 'delete' : action;
  if (operation === 'delete') {
    const result = await env.DB.batch([
      env.DB.prepare(`DELETE FROM perlawanan WHERE ${where}`).bind(...params),
      env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
        VALUES(?,?,'perlawanan',?,?,datetime('now','+8 hours'))`)
        .bind(userId, grouped ? 'delete_match_group' : 'delete_match', first.id, `Padam ${description}`),
    ]);
    if (result[0].meta.changes !== rows.length) {
      return json({ error: true, message: 'Perlawanan berubah semasa dipadam. Sila semak semula.' }, 409);
    }
    return json({ error: false, message: grouped
      ? `Perlawanan berjaya dipadam (${rows.length} rekod).` : 'Perlawanan berjaya dipadam.' });
  }
  const status = action === 'verify' ? 'Disahkan' : action === 'reject' ? 'Tidak Disahkan' : 'Belum Disahkan';
  const subject = action === 'verify' ? 'Perlawanan Disahkan'
    : action === 'reject' ? 'Perlawanan Tidak Disahkan' : 'Perlawanan Dikembalikan';
  const message = action === 'verify'
    ? `Rekod perlawanan ${first.home_team} vs ${first.away_team} pada ${day} telah disahkan oleh PP Daerah.`
    : action === 'reject'
      ? `Rekod perlawanan ${first.home_team} vs ${first.away_team} pada ${day} tidak disahkan. Catatan: ${notes || '-'}`
      : `Rekod perlawanan ${first.home_team} vs ${first.away_team} pada ${day} telah dikembalikan untuk semakan semula oleh PP Daerah.`;
  const recipients = [...new Set(rows.map((row) => row.user_id))];
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE perlawanan SET status_pp=?,catatan_pp=?,verified_at=datetime('now','+8 hours'),verified_by=?
      WHERE ${where}`).bind(status, notes, userId, ...params),
    ...recipients.map((recipient) => env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,is_read,created_at)
      VALUES(?,'Pengesahan Perlawanan',?,?,0,datetime('now','+8 hours'))`).bind(recipient, subject, message)),
    env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
      VALUES(?,?,'perlawanan',?,?,datetime('now','+8 hours'))`)
      .bind(userId, grouped ? 'verify_match_group' : 'verify_match', first.id, `${description} - Status: ${status}`),
  ]);
  if (results[0].meta.changes !== rows.length) {
    return json({ error: true, message: 'Perlawanan berubah semasa semakan. Sila muat semula.' }, 409);
  }
  return json({ error: false, message: action === 'verify' ? 'Perlawanan berjaya disahkan.'
    : action === 'reject' ? 'Perlawanan telah ditolak.' : 'Perlawanan dikembalikan ke status menunggu.',
    match: { ...(grouped ? { match_group_id: input.match_group_id,officials_count: rows.length } : { id: first.id }),
      status_pp: status,verified_at: new Date().toISOString() } });
}

export async function districtMatchVerification(request: Request, env: Env): Promise<Response> {
  if (!['GET','POST','DELETE'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'PP Daerah') return json({ error: true, message: 'Akses ditolak - hanya PP Daerah sahaja' }, 403);
  if (!user.persatuan_id) return json({ error: true, message: 'Persatuan not assigned.' }, 403);
  const district = await env.DB.prepare(`SELECT d.id FROM persatuan_bolasepak_daerah p
    JOIN districts d ON d.nama=p.daerah WHERE p.id=?`).bind(user.persatuan_id).first<{ id: number }>();
  const districtId = district?.id ?? 0;
  if (request.method === 'GET') return list(request, env, user.persatuan_id, districtId);
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  return change(request, env, user.id, user.persatuan_id, districtId);
}
