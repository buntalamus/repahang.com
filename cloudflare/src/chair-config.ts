import { currentUser, json } from './auth';
import { chairDispatchIntegrity, chairDispatchStatements, sendChairJobsNow } from './chair-dispatch';
import { boundedJson } from './request';
import type { Env } from './types';

interface Candidate {
  source: string;
  official_id: number;
  nama: string;
  daerah: string | null;
  negeri: string | null;
  no_telefon: string | null;
  email: string | null;
  telegram_chat_id: string | null;
  dalam_pool: number;
}

interface Chair extends Record<string, unknown> {
  telegram_chat_id: string | null;
}

interface ChairAudit extends Record<string, unknown> {
  old_identity_json: string | null;
  new_identity_json: string | null;
}

interface Official {
  id: number;
  nama: string;
  email: string | null;
  telegram_chat_id: string | number | null;
}

interface Mapping {
  id: number;
  pengesah_user_id: number | null;
  pengesah_luar_id: number | null;
  nama_snapshot: string;
  jawatan_snapshot: string;
  peringkat_snapshot: string | null;
  aktif: number;
  updated_at: string;
  email: string | null;
  telegram_chat_id: string | number | null;
}

function decodedJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw) as unknown; } catch { return null; }
}

function idOf(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = String(value).trim();
  const id = Number(raw);
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(id) ? id : null;
}

const currentChairSql = `
    SELECT kp.*,COALESCE(u.email,pl.emel,'') AS email,
           COALESCE(u.no_telefon,pl.no_tel,'') AS no_telefon,
           COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
           COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),'') AS negeri,
           CASE WHEN kp.pengesah_user_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber
    FROM kejohanan_pengesah_laporan kp
    LEFT JOIN users u ON u.id=kp.pengesah_user_id
    LEFT JOIN pengadil_luar pl ON pl.id=kp.pengesah_luar_id
    WHERE kp.kejohanan_id=? AND kp.aktif=1 LIMIT 1
  `;

async function currentChair(env: Env, kejohananId: number) {
  const current = await env.DB.prepare(currentChairSql).bind(kejohananId).first<Chair>();
  if (!current) return null;
  const { telegram_chat_id, ...rest } = current;
  return { ...rest, telegram_linked: Boolean(telegram_chat_id) };
}

/** Assign the tournament chair and refresh every pending report in one D1 batch. */
async function assignChair(request: Request, env: Env, adminId: number): Promise<Response> {
  if (env.STAGING_AUTH_ENABLED !== '1' || env.STAGING_WRITES_ENABLED !== '1' ||
      env.REPORT_DELIVERY_ENABLED !== '1') {
    return json({ error: true, message: 'Tetapan Pengerusi belum tersedia di staging.' }, 503);
  }
  const input = await boundedJson(request, 4096);
  if (input instanceof Response) return input;
  const body = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const kejohananId = idOf(body.kejohanan_id);
  const officialId = idOf(body.official_id);
  const source = typeof body.source === 'string' ? body.source.trim() : '';
  if (!kejohananId || !officialId || (source !== 'Berdaftar' && source !== 'Luar')) {
    return json({ error: true, message: 'Pilihan Pengerusi Pengadil tidak sah.' }, 400);
  }
  const jawatan = Array.from((typeof body.jawatan === 'string' ? body.jawatan.trim() : '') ||
    'Pengerusi Pengadil').slice(0, 150).join('');

  const tournament = await env.DB.prepare(`
    SELECT id,nama,peringkat_kejohanan FROM kejohanan WHERE id=? LIMIT 1
  `).bind(kejohananId).first<{ id: number; peringkat_kejohanan: string | null }>();
  if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);

  const eligible = source === 'Berdaftar'
    ? `EXISTS(SELECT 1 FROM users WHERE id=? AND aktif=1
        AND (role='Penilai' OR jenis_pengadil='Penilai Pengadil'))`
    : `EXISTS(SELECT 1 FROM pengadil_luar WHERE id=? AND jenis_pengadil='Penilai Pengadil')`;
  const official = await env.DB.prepare(source === 'Berdaftar' ? `
    SELECT id,nama_penuh AS nama,email,telegram_chat_id FROM users
    WHERE id=? AND aktif=1 AND (role='Penilai' OR jenis_pengadil='Penilai Pengadil') LIMIT 1
  ` : `
    SELECT id,nama,emel AS email,telegram_chat_id FROM pengadil_luar
    WHERE id=? AND jenis_pengadil='Penilai Pengadil' LIMIT 1
  `).bind(officialId).first<Official>();
  if (!official) return json({ error: true, message: 'Pegawai mesti berstatus Penilai Pengadil.' }, 422);
  const telegramLinked = Boolean(official.telegram_chat_id) && String(official.telegram_chat_id) !== '0';
  if (!(official.email ?? '').trim() && !telegramLinked) {
    return json({
      error: true,
      message: 'Pengerusi mesti mempunyai sekurang-kurangnya emel atau Telegram yang telah dipautkan.',
    }, 422);
  }

  const existing = await env.DB.prepare(`
    SELECT kp.id,kp.pengesah_user_id,kp.pengesah_luar_id,kp.nama_snapshot,kp.jawatan_snapshot,
           kp.peringkat_snapshot,kp.aktif,kp.updated_at,COALESCE(u.email,pl.emel) AS email,
           COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id
    FROM kejohanan_pengesah_laporan kp
    LEFT JOIN users u ON u.id=kp.pengesah_user_id
    LEFT JOIN pengadil_luar pl ON pl.id=kp.pengesah_luar_id
    WHERE kp.kejohanan_id=? LIMIT 1
  `).bind(kejohananId).first<Mapping>();
  // PHP stores the whole active mapping row as the old identity.
  const old = existing?.aktif === 1
    ? await env.DB.prepare(currentChairSql).bind(kejohananId).first<Chair>()
    : null;
  const newIdentity = JSON.stringify({
    source, official_id: officialId, nama: official.nama, jawatan,
    peringkat: tournament.peringkat_kejohanan, email: official.email ?? null,
    telegram_linked: telegramLinked,
  });
  const userId = source === 'Berdaftar' ? officialId : null;
  const luarId = source === 'Luar' ? officialId : null;
  // The marker fails the batch when the mapping changed since it was read.
  const unchanged = existing
    ? `EXISTS(SELECT 1 FROM kejohanan_pengesah_laporan WHERE kejohanan_id=? AND id=?
        AND pengesah_user_id IS ? AND pengesah_luar_id IS ? AND aktif=? AND updated_at=?)`
    : 'NOT EXISTS(SELECT 1 FROM kejohanan_pengesah_laporan WHERE kejohanan_id=?)';
  const unchangedBinds = existing
    ? [kejohananId, existing.id, existing.pengesah_user_id, existing.pengesah_luar_id,
      existing.aktif, existing.updated_at]
    : [kejohananId];
  const nonce = crypto.randomUUID();
  const marker = 'EXISTS(SELECT 1 FROM worker_chair_assignments WHERE nonce=? AND integrity_checked=0)';
  const now = "datetime('now','+8 hours')";
  const integrity = chairDispatchIntegrity(nonce);
  const statements = [
    env.DB.prepare(`INSERT INTO worker_chair_assignments
      (nonce,kejohanan_id,origin,actor_user_id,integrity_checked)
      VALUES(?,?,'chair_assigned',?,CASE WHEN ${unchanged} AND ${eligible} THEN 0 ELSE -1 END)`)
      .bind(nonce, kejohananId, adminId, ...unchangedBinds, officialId),
    env.DB.prepare(`INSERT INTO kejohanan_pengesah_laporan
      (kejohanan_id,pengesah_user_id,pengesah_luar_id,nama_snapshot,jawatan_snapshot,
       peringkat_snapshot,aktif,created_by,created_at,updated_at)
      SELECT ?,?,?,?,?,?,1,?,${now},${now} WHERE ${marker}
      ON CONFLICT(kejohanan_id) DO UPDATE SET
        pengesah_user_id=excluded.pengesah_user_id,pengesah_luar_id=excluded.pengesah_luar_id,
        nama_snapshot=excluded.nama_snapshot,jawatan_snapshot=excluded.jawatan_snapshot,
        peringkat_snapshot=excluded.peringkat_snapshot,aktif=1,
        created_by=excluded.created_by,updated_at=excluded.updated_at`)
      .bind(kejohananId, userId, luarId, official.nama, jawatan,
        tournament.peringkat_kejohanan, adminId, nonce),
    env.DB.prepare(`INSERT INTO kejohanan_pengesah_laporan_audit
      (kejohanan_id,kejohanan_pengesah_id,event_type,old_identity_json,new_identity_json,
       actor_user_id,ip_address,user_agent,created_at)
      SELECT kejohanan_id,id,?,?,?,?,?,?,${now} FROM kejohanan_pengesah_laporan
      WHERE kejohanan_id=? AND ${marker}`)
      .bind(old ? 'chair_changed' : 'chair_assigned', old ? JSON.stringify(old) : null,
        newIdentity, adminId, request.headers.get('CF-Connecting-IP')?.slice(0, 45) ?? null,
        request.headers.get('User-Agent')?.slice(0, 255) ?? null, kejohananId, nonce),
    ...chairDispatchStatements(env, nonce, 'chair_assigned', { kind: 'tournament', id: kejohananId }),
    env.DB.prepare(`UPDATE worker_chair_assignments SET integrity_checked=CASE WHEN
      EXISTS(SELECT 1 FROM kejohanan_pengesah_laporan WHERE kejohanan_id=? AND aktif=1
        AND pengesah_user_id IS ? AND pengesah_luar_id IS ? AND created_by=?)
      AND EXISTS(SELECT 1 FROM kejohanan_pengesah_laporan_audit WHERE kejohanan_id=?
        AND actor_user_id=? AND new_identity_json=?)
      AND ${integrity.sql} THEN 1 ELSE -1 END WHERE nonce=?`)
      .bind(kejohananId, userId, luarId, adminId, kejohananId, adminId, newIdentity,
        ...integrity.binds, nonce),
  ];
  let result: D1Result[];
  try {
    result = await env.DB.batch(statements);
  } catch (error) {
    if (String(error).includes('constraint')) {
      return json({ error: true, message: 'Tetapan Pengerusi atau laporan telah berubah. Muat semula dan cuba lagi.' }, 409);
    }
    throw error;
  }
  if (result[0]?.meta?.changes !== 1 || result[1]?.meta?.changes !== 1 ||
      result[2]?.meta?.changes !== 1 || result[result.length - 1]?.meta?.changes !== 1) {
    throw new Error('Incomplete chair assignment transaction');
  }
  // PHP dispatches every pending report of the tournament before responding.
  await sendChairJobsNow(env, nonce);
  const pending = await env.DB.prepare(`SELECT count(*) AS n
    FROM worker_chair_assignment_items WHERE nonce=?`).bind(nonce).first<{ n: number }>();
  return json({
    error: false,
    message: 'Pengerusi Pengadil berjaya ditetapkan untuk kejohanan ini.',
    data: {
      current: await currentChair(env, kejohananId),
      pending_dispatched: Number(pending?.n ?? 0),
      pending_failed: 0,
    },
  });
}

/** Admin chair lookup and assignment for one tournament. */
export async function chairConfig(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (request.method === 'POST') return assignChair(request, env, user.id);
  if (request.method !== 'GET') {
    return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  }
  const raw = new URL(request.url).searchParams.get('kejohanan_id');
  const id = Number(raw);
  if (!raw || !/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1) {
    return json({ error: true, message: 'ID kejohanan diperlukan.' }, 400);
  }
  const tournament = await env.DB.prepare(`
    SELECT id,nama,peringkat_kejohanan,status FROM kejohanan WHERE id=? LIMIT 1
  `).bind(id).first();
  if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);

  const candidates = await env.DB.prepare(`
    SELECT source,official_id,nama,daerah,negeri,no_telefon,email,
           telegram_chat_id,dalam_pool FROM (
      SELECT 'Berdaftar' AS source,u.id AS official_id,u.nama_penuh AS nama,
             u.daerah,COALESCE(NULLIF(trim(u.negeri),''),'Pahang') AS negeri,
             u.no_telefon,u.email,u.telegram_chat_id,
             CASE WHEN pp.id IS NULL THEN 0 ELSE 1 END AS dalam_pool
      FROM users u LEFT JOIN pool_pengadil pp
        ON pp.kejohanan_id=? AND pp.pengadil_id=u.id
      WHERE u.aktif=1 AND (u.role='Penilai' OR u.jenis_pengadil='Penilai Pengadil')
      UNION ALL
      SELECT 'Luar' AS source,pl.id AS official_id,pl.nama,pl.daerah,pl.negeri,
             pl.no_tel AS no_telefon,pl.emel AS email,pl.telegram_chat_id,
             CASE WHEN pp.id IS NULL THEN 0 ELSE 1 END AS dalam_pool
      FROM pengadil_luar pl LEFT JOIN pool_pengadil pp
        ON pp.kejohanan_id=? AND pp.pengadil_luar_id=pl.id
      WHERE pl.jenis_pengadil='Penilai Pengadil'
    ) candidates ORDER BY dalam_pool DESC,nama ASC
  `).bind(id,id).all<Candidate>();
  const mappedCandidates = candidates.results.map(({ telegram_chat_id, dalam_pool, ...candidate }) => ({
    ...candidate, official_id: Number(candidate.official_id),
    dalam_pool: Boolean(dalam_pool), telegram_linked: Boolean(telegram_chat_id),
  }));

  const mappedCurrent = await currentChair(env, id);

  const audit = await env.DB.prepare(`
    SELECT a.id,a.event_type,a.old_identity_json,a.new_identity_json,
           a.actor_user_id,u.nama_penuh AS actor_name,a.created_at
    FROM kejohanan_pengesah_laporan_audit a
    LEFT JOIN users u ON u.id=a.actor_user_id
    WHERE a.kejohanan_id=? ORDER BY a.id DESC LIMIT 25
  `).bind(id).all<ChairAudit>();
  const mappedAudit = audit.results.map(({ old_identity_json, new_identity_json, ...entry }) => ({
    ...entry,
    old_identity: decodedJson(old_identity_json),
    new_identity: decodedJson(new_identity_json),
  }));
  return json({ error: false, data: {
    kejohanan: tournament, current: mappedCurrent,
    candidates: mappedCandidates, audit: mappedAudit,
  } });
}
