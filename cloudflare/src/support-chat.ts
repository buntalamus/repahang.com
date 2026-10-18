import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

function positiveId(value: unknown): number | null {
  const raw = String(value ?? '');
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
}

const messageSelect = `SELECT m.id,m.body,m.is_admin,m.created_at,
  CASE WHEN m.is_admin=1 THEN 'Admin' ELSE u.nama_penuh END AS sender_name
  FROM support_messages m JOIN users u ON u.id=m.sender_id`;

export async function supportChat(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk semula.' }, 401);
  const admin = user.role === 'Admin';
  if (!admin && user.role !== 'Pengadil' && user.role !== 'Penilai' &&
      !(user.role === 'PP Daerah' && (Number(user.can_referee) === 1 || Number(user.can_ra) === 1))) {
    return json({ error: true, message: 'Akses chat tidak dibenarkan.' }, 403);
  }
  if (!['GET', 'POST'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? 'messages';
  if (request.method === 'GET' && action === 'summary') {
    const row = await env.DB.prepare(admin
      ? `SELECT COUNT(*) AS unread_count FROM support_threads t
         JOIN support_messages m ON m.user_id=t.user_id AND m.is_admin=0 AND m.id>t.admin_read_id`
      : `SELECT COUNT(*) AS unread_count FROM support_messages m JOIN support_threads t ON t.user_id=m.user_id
         WHERE t.user_id=? AND m.is_admin=1 AND m.id>t.user_read_id`)
      .bind(...(admin ? [] : [user.id])).first<{ unread_count: number }>();
    return json({ error: false, unread_count: row?.unread_count ?? 0 });
  }
  if (request.method === 'GET' && action === 'threads') {
    if (!admin) return json({ error: true, message: 'Akses ditolak.' }, 403);
    const page = positiveId(url.searchParams.get('page') ?? '1');
    const search = (url.searchParams.get('search') ?? '').trim();
    if (!page || page > 10000 || search.length > 100) return json({ error: true, message: 'Penapis tidak sah.' }, 400);
    // Literal substring search, never SQL wildcard interpretation.
    const filter = `t.last_message_id>0 AND (?='' OR instr(lower(u.nama_penuh),lower(?))>0)`;
    const [rows, total] = await Promise.all([
      env.DB.prepare(`SELECT t.user_id,u.nama_penuh,u.role,p.daerah,t.updated_at,
        substr(last.body,1,120) AS preview,last.is_admin,
        (SELECT COUNT(*) FROM support_messages m WHERE m.user_id=t.user_id AND m.is_admin=0 AND m.id>t.admin_read_id) AS unread_count
        FROM support_threads t JOIN users u ON u.id=t.user_id
        LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id
        JOIN support_messages last ON last.id=t.last_message_id
        WHERE ${filter} ORDER BY t.last_message_id DESC LIMIT 30 OFFSET ?`)
        .bind(search, search, (page - 1) * 30).all(),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM support_threads t JOIN users u ON u.id=t.user_id WHERE ${filter}`)
        .bind(search, search).first<{ total: number }>(),
    ]);
    return json({ error: false, data: rows.results, total: total?.total ?? 0, page });
  }
  let body: Record<string, unknown> = {};
  if (request.method === 'POST') {
    if (env.STAGING_WRITES_ENABLED !== '1') return json({ error: true, message: 'Chat belum tersedia.' }, 503);
    const input = await boundedJson(request, 16000);
    if (input instanceof Response) return input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: true, message: 'Data tidak sah.' }, 400);
    body = input as Record<string, unknown>;
  }
  const requestedOwner = request.method === 'POST' ? body.user_id : url.searchParams.get('user_id');
  const owner = admin ? positiveId(requestedOwner) : user.id;
  // Explicitly reject attempts to address another user's thread.
  if (!owner || (!admin && requestedOwner !== undefined && requestedOwner !== null && positiveId(requestedOwner) !== user.id)) {
    return json({ error: true, message: 'Perbualan tidak dibenarkan.' }, 403);
  }
  if (admin && !await env.DB.prepare('SELECT user_id FROM support_threads WHERE user_id=? AND last_message_id>0').bind(owner).first()) {
    return json({ error: true, message: 'Perbualan tidak ditemui.' }, 404);
  }
  if (request.method === 'GET' && action === 'messages') {
    const beforeRaw = url.searchParams.get('before');
    const afterRaw = url.searchParams.get('after');
    const before = beforeRaw === null ? null : positiveId(beforeRaw);
    const after = afterRaw === null ? null : positiveId(afterRaw);
    if ((beforeRaw !== null && !before) || (afterRaw !== null && !after) || (before && after)) {
      return json({ error: true, message: 'Penanda mesej tidak sah.' }, 400);
    }
    const rows = await env.DB.prepare(`${messageSelect} WHERE m.user_id=?
      ${before ? 'AND m.id<?' : after ? 'AND m.id>?' : ''}
      ORDER BY m.id ${after ? 'ASC' : 'DESC'} LIMIT 51`)
      .bind(owner, ...(before ? [before] : after ? [after] : [])).all<{ id: number }>();
    const more = rows.results.length > 50;
    const messages = rows.results.slice(0, 50);
    if (!after) messages.reverse();
    return json({ error: false, data: messages, has_more: more });
  }
  if (request.method === 'POST' && body.action === 'read') {
    const through = positiveId(body.through_id);
    if (!through || !await env.DB.prepare('SELECT id FROM support_messages WHERE id=? AND user_id=?').bind(through, owner).first()) {
      return json({ error: true, message: 'Mesej tidak ditemui.' }, 400);
    }
    const column = admin ? 'admin_read_id' : 'user_read_id';
    await env.DB.prepare(`UPDATE support_threads SET ${column}=MAX(${column},?) WHERE user_id=?`).bind(through, owner).run();
    return json({ error: false });
  }
  if (request.method === 'POST' && body.action === 'send') {
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const clientId = typeof body.client_id === 'string' ? body.client_id : '';
    if (!text || text.length > 2000 || !/^[a-zA-Z0-9_-]{16,80}$/.test(clientId)) {
      return json({ error: true, message: 'Mesej mestilah 1 hingga 2,000 aksara.' }, 400);
    }
    const existing = await env.DB.prepare('SELECT id,user_id,body FROM support_messages WHERE sender_id=? AND client_id=?')
      .bind(user.id, clientId).first<{ id: number; user_id: number; body: string }>();
    if (existing) {
      if (existing.user_id !== owner || existing.body !== text) return json({ error: true, message: 'ID mesej telah digunakan.' }, 409);
      return json({ error: false, message_id: existing.id });
    }
    // The rate guard and write share one transaction, including concurrent requests.
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO support_threads(user_id) VALUES(?)').bind(owner),
      env.DB.prepare(`INSERT OR IGNORE INTO support_messages(user_id,sender_id,is_admin,client_id,body)
        SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM support_messages
          WHERE sender_id=? AND created_at>=datetime('now','-1 minute'))<10`)
        .bind(owner, user.id, admin ? 1 : 0, clientId, text, user.id),
      env.DB.prepare(`UPDATE support_threads SET
        last_message_id=COALESCE((SELECT MAX(id) FROM support_messages WHERE user_id=?),0),
        updated_at=COALESCE((SELECT created_at FROM support_messages WHERE user_id=? ORDER BY id DESC LIMIT 1),updated_at)
        WHERE user_id=?`).bind(owner, owner, owner),
    ]);
    const saved = await env.DB.prepare('SELECT id,user_id,body FROM support_messages WHERE sender_id=? AND client_id=?')
      .bind(user.id, clientId).first<{ id: number; user_id: number; body: string }>();
    if (!saved) return json({ error: true, message: 'Terlalu banyak mesej. Cuba semula selepas satu minit.' }, 429);
    if (saved.user_id !== owner || saved.body !== text) return json({ error: true, message: 'ID mesej telah digunakan.' }, 409);
    return json({ error: false, message_id: saved.id });
  }
  return json({ error: true, message: 'Tindakan tidak sah.' }, 400);
}
