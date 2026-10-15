import { currentUser, json } from './auth';
import { phpInt } from './lantikan-write';
import { auditMetaFrom } from './php/lantikan-audit';
import { dispatchLaporanForPengerusi, getKejohananPengesahLaporan } from './php/laporan-pengesahan';
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

/** POST of api/kejohanan-pengesah-laporan.php. */
async function assignChair(request: Request, env: Env, adminId: number): Promise<Response> {
  if (env.STAGING_AUTH_ENABLED !== '1' || env.STAGING_WRITES_ENABLED !== '1' ||
      env.REPORT_DELIVERY_ENABLED !== '1') {
    return json({ error: true, message: 'Tetapan Pengerusi belum tersedia di staging.' }, 503);
  }
  const input = await boundedJson(request, 4096);
  if (input instanceof Response) return input;
  const body = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const kejohananId = phpInt(body.kejohanan_id);
  const source = String(body.source ?? '').trim();
  const officialId = phpInt(body.official_id);
  let jawatan = String(body.jawatan ?? 'Pengerusi Pengadil').trim();
  if (kejohananId < 1 || officialId < 1 || (source !== 'Berdaftar' && source !== 'Luar')) {
    return json({ error: true, message: 'Pilihan Pengerusi Pengadil tidak sah.' }, 400);
  }
  if (jawatan === '') jawatan = 'Pengerusi Pengadil';
  const meta = auditMetaFrom(request);
  try {
    const tournament = await env.DB.prepare(`
      SELECT id,nama,peringkat_kejohanan FROM kejohanan WHERE id=? LIMIT 1
    `).bind(kejohananId).first<{ id: number; peringkat_kejohanan: string | null }>();
    if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
    const official = await env.DB.prepare(source === 'Berdaftar' ? `
      SELECT id,nama_penuh AS nama,negeri,email,no_telefon,telegram_chat_id FROM users
      WHERE id=? AND aktif=1 AND (role='Penilai' OR jenis_pengadil='Penilai Pengadil') LIMIT 1
    ` : `
      SELECT id,nama,negeri,emel AS email,no_tel AS no_telefon,telegram_chat_id FROM pengadil_luar
      WHERE id=? AND jenis_pengadil='Penilai Pengadil' LIMIT 1
    `).bind(officialId).first<Official>();
    if (!official) return json({ error: true, message: 'Pegawai mesti berstatus Penilai Pengadil.' }, 422);
    if (String(official.email ?? '').trim() === '' && !official.telegram_chat_id) {
      return json({ error: true,
        message: 'Pengerusi mesti mempunyai sekurang-kurangnya emel atau Telegram yang telah dipautkan.' }, 422);
    }
    const old = await getKejohananPengesahLaporan(env, kejohananId);
    const newIdentity = {
      source, official_id: officialId, nama: official.nama, jawatan,
      peringkat: tournament.peringkat_kejohanan, email: official.email ?? null,
      telegram_linked: !!official.telegram_chat_id,
    };
    const now = "datetime('now','+8 hours')";
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO kejohanan_pengesah_laporan
        (kejohanan_id,pengesah_user_id,pengesah_luar_id,nama_snapshot,jawatan_snapshot,
         peringkat_snapshot,aktif,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,1,?,${now},${now})
        ON CONFLICT(kejohanan_id) DO UPDATE SET
          pengesah_user_id=excluded.pengesah_user_id,pengesah_luar_id=excluded.pengesah_luar_id,
          nama_snapshot=excluded.nama_snapshot,jawatan_snapshot=excluded.jawatan_snapshot,
          peringkat_snapshot=excluded.peringkat_snapshot,aktif=1,created_by=excluded.created_by`)
        .bind(kejohananId, source === 'Berdaftar' ? officialId : null, source === 'Luar' ? officialId : null,
          official.nama, Array.from(jawatan).slice(0, 150).join(''), tournament.peringkat_kejohanan, adminId),
      env.DB.prepare(`INSERT INTO kejohanan_pengesah_laporan_audit
        (kejohanan_id,kejohanan_pengesah_id,event_type,old_identity_json,new_identity_json,
         actor_user_id,ip_address,user_agent,created_at)
        SELECT kejohanan_id,id,?,?,?,?,?,?,${now} FROM kejohanan_pengesah_laporan
        WHERE kejohanan_id=? AND aktif=1`)
        .bind(old ? 'chair_changed' : 'chair_assigned', old ? JSON.stringify(old) : null,
          JSON.stringify(newIdentity), adminId, meta.ip, meta.userAgent, kejohananId),
    ]);
    const pending = await env.DB.prepare(`SELECT laporan.id FROM laporan_penilaian laporan
      JOIN jadual_perlawanan jp ON jp.id=laporan.jadual_id
      WHERE jp.kejohanan_id=? AND laporan.status='Dihantar'`).bind(kejohananId).all<{ id: number }>();
    let dispatched = 0;
    let failed = 0;
    for (const { id } of pending.results) {
      try {
        await dispatchLaporanForPengerusi(env, Number(id), meta);
        dispatched++;
      } catch (error) {
        failed++;
        console.error('[kejohanan-pengesah-laporan.php] Pending dispatch error',
          error instanceof Error ? error.message : error);
      }
    }
    return json({
      error: false,
      message: 'Pengerusi Pengadil berjaya ditetapkan untuk kejohanan ini.',
      data: {
        current: await getKejohananPengesahLaporan(env, kejohananId),
        pending_dispatched: dispatched,
        pending_failed: failed,
      },
    });
  } catch (error) {
    console.error('[kejohanan-pengesah-laporan.php]', error instanceof Error ? error.message : error);
    return json({ error: true, message: 'Ralat pelayan.' }, 500);
  }
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
