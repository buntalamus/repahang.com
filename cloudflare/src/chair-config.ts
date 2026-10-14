import { currentUser, json } from './auth';
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

function decodedJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw) as unknown; } catch { return null; }
}

/** Admin chair lookup only. Assignment and notification require the full approval workflow. */
export async function chairConfig(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (request.method === 'POST') {
    return json({ error: true, message: 'Tetapan Pengerusi belum tersedia di staging.' }, 503);
  }
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

  const current = await env.DB.prepare(`
    SELECT kp.*,COALESCE(u.email,pl.emel,'') AS email,
           COALESCE(u.no_telefon,pl.no_tel,'') AS no_telefon,
           COALESCE(u.telegram_chat_id,pl.telegram_chat_id) AS telegram_chat_id,
           COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),'') AS negeri,
           CASE WHEN kp.pengesah_user_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber
    FROM kejohanan_pengesah_laporan kp
    LEFT JOIN users u ON u.id=kp.pengesah_user_id
    LEFT JOIN pengadil_luar pl ON pl.id=kp.pengesah_luar_id
    WHERE kp.kejohanan_id=? AND kp.aktif=1 LIMIT 1
  `).bind(id).first<Chair>();
  const mappedCurrent = current ? (() => {
    const { telegram_chat_id, ...rest } = current;
    return { ...rest, telegram_linked: Boolean(telegram_chat_id) };
  })() : null;

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
