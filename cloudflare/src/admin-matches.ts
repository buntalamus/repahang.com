import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

type MatchRow = Record<string, unknown> & { id: number; match_group_id: string | null; pengadil_id: number };

function idOf(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function matchKey(row: MatchRow): string {
  return row.match_group_id ? `g:${row.match_group_id}` : `s:${row.id}`;
}

async function listMatches(request: Request, env: Env): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const status = query.get('status') ?? '';
  const districtId = query.get('daerah_id') === '0' ? null : idOf(query.get('daerah_id'));
  const page = Math.max(1, Math.min(100_000, Number(query.get('page')) || 1));
  const perPage = Math.max(1, Math.min(100, Number(query.get('per_page')) || 50));
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (status === 'pending') where.push("(p.status_pp IS NULL OR p.status_pp='' OR p.status_pp='Belum Disahkan')");
  else if (status === 'verified') where.push("p.status_pp='Disahkan'");
  else if (status === 'rejected') where.push("p.status_pp='Tidak Disahkan'");
  if (districtId) { where.push('p.daerah_perlawanan_id=?'); params.push(districtId); }
  const predicate = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await env.DB.prepare(`SELECT p.id,p.match_group_id,p.tarikh,p.masa,p.jenis,p.nama_kejohanan,
    p.tempat,p.jawatan,p.home_team,p.away_team,p.status_pp,p.catatan_pp,p.verified_at,p.created_at,
    p.lantikan_id,p.submitted_by,p.daerah_perlawanan_id,
    p.skor_ht_home,p.skor_ht_away,p.skor_ft_home,p.skor_ft_away,
    p.skor_et_home,p.skor_et_away,p.skor_ps_home,p.skor_ps_away,p.cuaca,
    d.nama AS daerah_perlawanan_nama,
    u.id AS pengadil_id,u.nama_penuh AS pengadil_nama,u.no_ic AS pengadil_ic,u.jenis_pengadil,
    sub.nama_penuh AS submitter_name,ver.nama_penuh AS verified_by_name
    FROM perlawanan p JOIN users u ON u.id=p.user_id
    LEFT JOIN users sub ON sub.id=p.submitted_by
    LEFT JOIN users ver ON ver.id=p.verified_by
    LEFT JOIN districts d ON d.id=p.daerah_perlawanan_id
    ${predicate} ORDER BY p.tarikh DESC,p.match_group_id,p.id`)
    .bind(...params).all<MatchRow>();
  const groups = new Map<string, Record<string, unknown>>();
  for (const row of rows.results) {
    const key = matchKey(row);
    let group = groups.get(key);
    if (!group) {
      group = {
        match_group_id: row.match_group_id,id: row.id,tarikh: row.tarikh,masa: row.masa,
        jenis: row.jenis,nama_kejohanan: row.nama_kejohanan,tempat: row.tempat,
        home_team: row.home_team,away_team: row.away_team,status_pp: row.status_pp,
        catatan_pp: row.catatan_pp,verified_at: row.verified_at,
        verified_by_name: row.verified_by_name,created_at: row.created_at,
        lantikan_id: row.lantikan_id,submitted_by: row.submitted_by,
        submitter_name: row.submitter_name,daerah_perlawanan_id: row.daerah_perlawanan_id,
        daerah_perlawanan_nama: row.daerah_perlawanan_nama,
        skor_ht_home: row.skor_ht_home,skor_ht_away: row.skor_ht_away,
        skor_ft_home: row.skor_ft_home,skor_ft_away: row.skor_ft_away,
        skor_et_home: row.skor_et_home,skor_et_away: row.skor_et_away,
        skor_ps_home: row.skor_ps_home,skor_ps_away: row.skor_ps_away,
        cuaca: row.cuaca,is_grouped: row.match_group_id !== null,officials: [],
      };
      groups.set(key, group);
    }
    (group.officials as Record<string, unknown>[]).push({
      id: row.id,user_id: row.pengadil_id,nama: row.pengadil_nama,
      no_ic: row.pengadil_ic,jenis_pengadil: row.jenis_pengadil,jawatan: row.jawatan,
    });
  }
  const districtFilter = districtId ? 'WHERE p.daerah_perlawanan_id=?' : '';
  const [stats, districts] = await Promise.all([
    env.DB.prepare(`SELECT
      COUNT(DISTINCT COALESCE(p.match_group_id,'single_' || p.id)) AS total,
      COUNT(DISTINCT CASE WHEN p.status_pp IS NULL OR p.status_pp='' OR p.status_pp='Belum Disahkan'
        THEN COALESCE(p.match_group_id,'single_' || p.id) END) AS pending,
      COUNT(DISTINCT CASE WHEN p.status_pp='Disahkan' THEN COALESCE(p.match_group_id,'single_' || p.id) END) AS verified,
      COUNT(DISTINCT CASE WHEN p.status_pp='Tidak Disahkan' THEN COALESCE(p.match_group_id,'single_' || p.id) END) AS rejected
      FROM perlawanan p ${districtFilter}`).bind(...(districtId ? [districtId] : [])).first(),
    env.DB.prepare('SELECT id,nama FROM districts ORDER BY nama').all(),
  ]);
  const all = [...groups.values()];
  return json({ error: false,
    matches: all.slice((page - 1) * perPage, page * perPage),
    statistics: stats, districts: districts.results,
    pagination: { page,per_page: perPage,total_pages: Math.ceil(all.length / perPage),total_items: all.length },
  });
}

function target(input: Record<string, unknown>): { where: string; value: string | number } | Response {
  if (input.match_group_id != null && input.match_group_id !== '') {
    if (typeof input.match_group_id !== 'string' || input.match_group_id.length > 100) {
      return json({ error: true, message: 'ID perlawanan tidak sah.' }, 422);
    }
    return { where: 'match_group_id=?', value: input.match_group_id };
  }
  const id = idOf(input.match_id);
  if (!id) return json({ error: true, message: 'ID perlawanan diperlukan.' }, 422);
  return { where: 'id=?', value: id };
}

async function changeMatch(request: Request, env: Env, adminId: number, adminName: string): Promise<Response> {
  const body = await boundedJson(request, 8192);
  if (body instanceof Response) return body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: true, message: 'Data tidak sah.' }, 400);
  }
  const input = body as Record<string, unknown>;
  const matchTarget = target(input);
  if (matchTarget instanceof Response) return matchTarget;
  const justification = typeof input.justification === 'string' ? input.justification.trim() : '';
  if (justification.length > 1000) return json({ error: true, message: 'Justifikasi terlalu panjang.' }, 422);
  if (request.method === 'DELETE' && !justification) {
    return json({ error: true, message: 'Justifikasi wajib diisi untuk memadam rekod.' }, 422);
  }
  const action = input.action;
  if (request.method === 'POST' && !['verify','reject','revert'].includes(String(action))) {
    return json({ error: true, message: 'Action tidak sah.' }, 422);
  }
  if (request.method === 'POST' && action !== 'revert' && !justification) {
    return json({ error: true, message: 'Justifikasi wajib diisi untuk override admin.' }, 422);
  }
  const rows = await env.DB.prepare(`SELECT p.id,p.home_team,p.away_team,p.tarikh,p.user_id
    FROM perlawanan p WHERE p.${matchTarget.where}`).bind(matchTarget.value).all<{
      id: number; home_team: string | null; away_team: string | null; tarikh: string; user_id: number | null;
    }>();
  if (!rows.results.length) return json({ error: true, message: 'Perlawanan tidak dijumpai.' }, 404);
  const first = rows.results[0];
  const description = `${first.home_team ?? ''} vs ${first.away_team ?? ''} (${rows.results.length} rekod) - Justifikasi: ${justification}`;
  if (request.method === 'DELETE') {
    // This is the explicit perlawanan deletion control. Preserve the audit
    // description in the same D1 transaction as the deletion.
    const results = await env.DB.batch([
      env.DB.prepare(`DELETE FROM perlawanan WHERE ${matchTarget.where}`).bind(matchTarget.value),
      env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
        VALUES(?,?,'perlawanan',?,?,datetime('now','+8 hours'))`)
        .bind(adminId, matchTarget.where === 'id=?' ? 'admin_delete_match' : 'admin_delete_match_group', first.id, description),
    ]);
    if (results[0].meta.changes < 1) return json({ error: true, message: 'Perlawanan tidak dijumpai.' }, 404);
    return json({ error: false, message: matchTarget.where === 'id=?'
      ? 'Perlawanan berjaya dipadam.' : `Perlawanan dipadam (${rows.results.length} rekod).` });
  }
  const status = action === 'verify' ? 'Disahkan' : action === 'reject' ? 'Tidak Disahkan' : 'Belum Disahkan';
  const note = `[Admin Override - ${adminName}] ${action === 'revert'
    ? justification || 'Status dikembalikan untuk semakan semula.' : justification}`;
  const subject = action === 'verify' ? 'Perlawanan Disahkan (Admin)'
    : action === 'reject' ? 'Perlawanan Tidak Disahkan (Admin)' : 'Perlawanan Dikembalikan (Admin)';
  const day = first.tarikh.split('-').reverse().join('/');
  const message = action === 'verify'
    ? `Rekod perlawanan ${first.home_team} vs ${first.away_team} pada ${day} telah disahkan oleh Admin.`
    : action === 'reject'
      ? `Rekod perlawanan ${first.home_team} vs ${first.away_team} pada ${day} tidak disahkan oleh Admin. Justifikasi: ${justification}`
      : `Rekod perlawanan ${first.home_team} vs ${first.away_team} pada ${day} telah dikembalikan untuk semakan semula oleh Admin.`;
  const recipients = [...new Set(rows.results.map((row) => row.user_id).filter((id): id is number => id !== null))];
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE perlawanan SET status_pp=?,catatan_pp=?,verified_at=datetime('now','+8 hours'),verified_by=?
      WHERE ${matchTarget.where}`).bind(status, note, adminId, matchTarget.value),
    ...recipients.map((recipient) => env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,is_read,created_at)
      VALUES(?,'Pengesahan Perlawanan',?,?,0,datetime('now','+8 hours'))`)
      .bind(recipient, subject, message)),
    env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
      VALUES(?,?,'perlawanan',?,?,datetime('now','+8 hours'))`)
      .bind(adminId, matchTarget.where === 'id=?' ? 'admin_override_match' : 'admin_override_match_group',
        first.id, `Override ${description} - Status: ${status}`),
  ];
  const results = await env.DB.batch(statements);
  if (results[0].meta.changes < 1) return json({ error: true, message: 'Perlawanan tidak dijumpai.' }, 404);
  const response = action === 'verify' ? 'Perlawanan berjaya disahkan (Admin Override).'
    : action === 'reject' ? 'Perlawanan ditolak (Admin Override).' : 'Status perlawanan dikembalikan.';
  return json({ error: false, message: response });
}

export async function adminMatches(request: Request, env: Env): Promise<Response> {
  if (!['GET','POST','DELETE'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (request.method === 'GET') return listMatches(request, env);
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  return changeMatch(request, env, user.id, user.nama_penuh);
}
