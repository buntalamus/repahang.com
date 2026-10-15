import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

interface DistrictApplication {
  id: number;
  user_id: number | null;
  nama_penuh: string;
  emel: string;
  jenis_pengadil: string | null;
}

export async function ppVerify(request: Request, env: Env): Promise<Response> {
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (actor.role !== 'PP Daerah') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (!actor.persatuan_id) return json({ error: true, message: 'Persatuan not assigned.' }, 403);
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const input = await boundedJson(request, 8192);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 422);
  }
  const body = input as Record<string, unknown>;
  const id = Number(body.permohonan_id);
  const action = body.action;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1 || !['approve', 'reject'].includes(String(action)) ||
      (body.notes != null && typeof body.notes !== 'string') || notes.length > 2000) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 422);
  }
  if (action === 'reject' && !notes) return json({ error: true, message: 'Sebab penolakan diperlukan.' }, 422);
  const application = await env.DB.prepare(`
    SELECT id,user_id,nama_penuh,emel,jenis_pengadil FROM permohonan
    WHERE id=? AND persatuan_id=? AND status_workflow='Menunggu PP Daerah' LIMIT 1
  `).bind(id, actor.persatuan_id).first<DistrictApplication>();
  if (!application) return json({ error: true, message: 'Permohonan tidak dijumpai atau sudah diproses.' }, 404);
  const approved = action === 'approve';
  const decisionMessage = approved
    ? 'Permohonan anda telah disahkan oleh PP Daerah dan kini menunggu keputusan Admin.'
    : `Permohonan anda ditolak oleh PP Daerah. Sebab: ${notes}`;
  const result = await env.DB.batch([
    env.DB.prepare(`UPDATE permohonan SET status_workflow=?,
      status=CASE WHEN ? THEN status ELSE 'Rejected' END,
      pp_verified_at=datetime('now','+8 hours'),pp_verified_by=?,pp_notes=?,
      status_kemaskini=datetime('now','+8 hours')
      WHERE id=? AND persatuan_id=? AND status_workflow='Menunggu PP Daerah'`)
      .bind(approved ? 'Menunggu Admin' : 'Ditolak', approved ? 1 : 0,
        actor.id, notes, id, actor.persatuan_id),
    env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,created_at)
      SELECT ?,'Semakan Permohonan',?,?,datetime('now','+8 hours')
      WHERE ? IS NOT NULL AND changes()=1`)
      .bind(application.user_id, approved ? 'Permohonan Disahkan PP Daerah' : 'Permohonan Ditolak PP Daerah',
        decisionMessage, application.user_id),
  ]);
  if (result[0].meta.changes !== 1) {
    return json({ error: true, message: 'Permohonan sudah diproses.' }, 409);
  }
  if (approved) {
    const admins = await env.DB.prepare("SELECT id,email,nama_penuh FROM users WHERE role='Admin' AND aktif=1")
      .all<{ id: number; email: string; nama_penuh: string }>();
    for (const admin of admins.results) {
      await env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,created_at)
        VALUES(?,'Semakan Permohonan','Permohonan Menunggu Admin',?,datetime('now','+8 hours'))`)
        .bind(admin.id, `Permohonan #${id} telah disahkan oleh ${actor.nama_penuh}.`).run();
    }
    await Promise.allSettled(admins.results.map(async (admin) => {
      const { html, text } = buildRefpahangEmail('Permohonan Menunggu Kelulusan Admin',
        admin.nama_penuh, [`Permohonan #${id} oleh ${application.nama_penuh} telah disahkan oleh ${actor.nama_penuh}.`],
        { label: 'Semak Permohonan', url: new URL('/admin/permohonan', env.BASE_URL).toString() });
      await sendRefpahangEmail(env, 'admin', admin.email, admin.nama_penuh,
        'Permohonan Menunggu Kelulusan Admin - PBNP', html, text);
    }));
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.emel)) {
    try {
      const title = approved ? 'Permohonan Disahkan PP Daerah' : 'Permohonan Ditolak PP Daerah';
      const { html, text } = buildRefpahangEmail(title, application.nama_penuh,
        [decisionMessage, `No. Permohonan: #${id}`],
        { label: 'Semak Permohonan', url: new URL('/pengadil', env.BASE_URL).toString() });
      await sendRefpahangEmail(env, 'daftar', application.emel, application.nama_penuh,
        `${title} - Sistem Pengadil PBNP`, html, text);
    } catch {
      console.error('PP verification email could not be sent');
    }
  }
  return json({ error: false, message: approved
    ? 'Permohonan disahkan. Admin telah dimaklumkan.' : 'Permohonan telah ditolak.' });
}
