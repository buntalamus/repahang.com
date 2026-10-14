import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

const grades = {
  kebangsaan: { column: 'pengadil_kebangsaan', label: 'Pengadil Kebangsaan' },
  negeri: { column: 'pengadil_negeri', label: 'Pengadil Negeri' },
  daerah: { column: 'pengadil_daerah', label: 'Pengadil Daerah' },
} as const;

export async function refereeGrades(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') {
    return json({ error: true, message: 'Akses ditolak. Hanya admin dibenarkan.' }, 403);
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }

  const input = await boundedJson(request, 16384);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Data taraf tidak sah.' }, 400);
  }
  const body = input as Record<string, unknown>;
  const rawIds = body.user_ids;
  const grade = body.taraf;
  const value = body.value;
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > 500
    || typeof grade !== 'string' || !Object.hasOwn(grades, grade)
    || (value !== 0 && value !== 1)
    || rawIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return json({
      error: true,
      message: 'user_ids, taraf (kebangsaan/negeri/daerah) dan value (0/1) diperlukan.',
    }, 400);
  }
  const ids = [...new Set(rawIds as number[])];
  const { column, label } = grades[grade as keyof typeof grades];
  const queries: D1PreparedStatement[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100);
    const placeholders = chunk.map(() => '?').join(',');
    queries.push(env.DB.prepare(`UPDATE users SET ${column}=? WHERE id IN (${placeholders})`)
      .bind(value, ...chunk));
  }
  const results = await env.DB.batch(queries);
  const count = results.reduce((total, result) => total + result.meta.changes, 0);
  const action = value === 1 ? 'ditetapkan' : 'dibuang';
  return json({ error: false, message: `Taraf ${label} ${action} untuk ${count} pengadil.`, count });
}
