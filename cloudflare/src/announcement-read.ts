import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

export async function announcementRead(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({error:true,message:'Sesi tidak sah.'},401);
  if (request.method !== 'POST') return json({error:true,message:'Kaedah tidak dibenarkan.'},405);
  if (env.STAGING_WRITES_ENABLED !== '1') return json({error:true,message:'Tindakan tulis belum tersedia.'},503);
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  const raw = String((input as Record<string,unknown> | null)?.announcement_id ?? '');
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    return json({error:true,message:'ID pengumuman tidak sah.'},400);
  }
  const id = Number(raw);
  const result = await env.DB.batch([
    env.DB.prepare(`INSERT INTO worker_announcement_reads(user_id,announcement_id)
      SELECT ?,id FROM announcements WHERE id=?
      ON CONFLICT(user_id,announcement_id) DO UPDATE SET read_at=datetime('now','+8 hours')`)
      .bind(user.id,id),
    env.DB.prepare('UPDATE notifications SET is_read=1 WHERE user_id=? AND announcement_id=?')
      .bind(user.id,id),
  ]);
  if (!result[0].meta.changes) return json({error:true,message:'Pengumuman tidak ditemui.'},404);
  return json({error:false,message:'Pengumuman ditandai dibaca.'});
}
