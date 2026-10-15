import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

const testTypes: Record<string, string> = {
  kecergasan: 'ujian_kecergasan', fitness: 'ujian_kecergasan',
  bertulis: 'ujian_bertulis', written: 'ujian_bertulis',
  kelas1: 'ujian_kelas1_fam',
};

const statusNames: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', absent: 'Absent',
};

interface TestApplication {
  id: number;
  user_id: number | null;
  nama_penuh: string;
  emel: string;
  user_email: string | null;
  jenis_permohonan: string;
  workflow_status: string | null;
}

export async function adminTestApplications(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (actor.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (request.method === 'GET') {
    const search = new URL(request.url).searchParams;
    const type = search.get('type') ?? 'fitness';
    const status = search.get('status') ?? 'pending';
    const kind = testTypes[type];
    if (!kind || (status !== 'all' && !statusNames[status])) {
      return json({ error: true, message: 'Jenis atau status tidak sah.' }, 400);
    }
    const limit = Math.min(500, Math.max(1, Number(search.get('limit')) || 100));
    const rows = await env.DB.prepare(`SELECT p.*,
      u.email AS user_email,u.no_telefon AS user_phone,
      u.url_gambar_profil,pb.nama_persatuan AS district_nama
      FROM permohonan p LEFT JOIN users u ON u.id=p.user_id
      LEFT JOIN persatuan_bolasepak_daerah pb ON pb.id=p.persatuan_id
      WHERE p.jenis_permohonan=? AND (?='all' OR p.workflow_status=?)
      ORDER BY p.tarikh_hantar DESC LIMIT ?`)
      .bind(kind, status, statusNames[status] ?? '', limit).all<Record<string, unknown>>();
    const statistics = await env.DB.prepare(`SELECT
      SUM(CASE WHEN workflow_status='Pending' AND jenis_permohonan='ujian_kecergasan' THEN 1 ELSE 0 END) AS pending_fitness,
      SUM(CASE WHEN workflow_status='Approved' AND jenis_permohonan='ujian_kecergasan' THEN 1 ELSE 0 END) AS approved_fitness,
      SUM(CASE WHEN workflow_status='Rejected' AND jenis_permohonan='ujian_kecergasan' THEN 1 ELSE 0 END) AS rejected_fitness,
      SUM(CASE WHEN workflow_status='Absent' AND jenis_permohonan='ujian_kecergasan' THEN 1 ELSE 0 END) AS absent_fitness,
      SUM(CASE WHEN jenis_permohonan='ujian_kecergasan' THEN 1 ELSE 0 END) AS total_fitness,
      SUM(CASE WHEN workflow_status='Pending' AND jenis_permohonan='ujian_bertulis' THEN 1 ELSE 0 END) AS pending_written,
      SUM(CASE WHEN workflow_status='Approved' AND jenis_permohonan='ujian_bertulis' THEN 1 ELSE 0 END) AS approved_written,
      SUM(CASE WHEN workflow_status='Rejected' AND jenis_permohonan='ujian_bertulis' THEN 1 ELSE 0 END) AS rejected_written,
      SUM(CASE WHEN workflow_status='Absent' AND jenis_permohonan='ujian_bertulis' THEN 1 ELSE 0 END) AS absent_written,
      SUM(CASE WHEN jenis_permohonan='ujian_bertulis' THEN 1 ELSE 0 END) AS total_written
      FROM permohonan WHERE jenis_permohonan IN ('ujian_kecergasan','ujian_bertulis','ujian_kelas1_fam')`)
      .first();
    const phpStatistics = Object.fromEntries(Object.entries(statistics ?? {}).map(([key, value]) =>
      [key, value === null ? null : String(value)]));
    return json({ error: false, applications: rows.results, statistics: phpStatistics });
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const input = await boundedJson(request, 8192);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 400);
  }
  const body = input as Record<string, unknown>;
  const id = Number(body.id);
  const kind = testTypes[String(body.type ?? '')];
  const action = String(body.action ?? '');
  const notes = typeof body.notes === 'string' ? body.notes.trim()
    : typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1 || !kind ||
      !['approve', 'reject', 'absent'].includes(action) || notes.length > 2000) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 400);
  }
  if (action === 'reject' && !notes) return json({ error: true, message: 'Sebab penolakan diperlukan.' }, 400);
  const application = await env.DB.prepare(`SELECT p.id,p.user_id,p.nama_penuh,p.emel,p.jenis_permohonan,
      p.workflow_status,u.email AS user_email FROM permohonan p LEFT JOIN users u ON u.id=p.user_id
      WHERE p.id=? AND p.jenis_permohonan=? AND p.workflow_status='Pending' LIMIT 1`)
    .bind(id, kind).first<TestApplication>();
  if (!application) return json({ error: true, message: 'Permohonan tidak dijumpai atau sudah diproses.' }, 404);
  const nextStatus = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Absent';
  const label = kind === 'ujian_kecergasan' ? 'Ujian Kecergasan'
    : kind === 'ujian_bertulis' ? 'Ujian Kelas III FAM' : 'Ujian Kelas I FAM';
  const decision = action === 'approve' ? 'Lulus' : action === 'reject' ? 'Tidak Lulus' : 'Tidak Hadir';
  const update = env.DB.prepare(`UPDATE permohonan SET workflow_status=?,
    admin_approved_at=datetime('now','+8 hours'),admin_approved_by=?,admin_notes=?,
    status_kemaskini=datetime('now','+8 hours')
    WHERE id=? AND jenis_permohonan=? AND workflow_status='Pending'`)
    .bind(nextStatus, actor.id, notes, id, kind);
  const statements = [update];
  if (application.user_id) {
    statements.push(env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,created_at)
      SELECT ?,'Keputusan Ujian',?,?,datetime('now','+8 hours') WHERE changes()=1`)
      .bind(application.user_id, `${label}: ${decision}`,
        `Keputusan permohonan ${label} anda: ${decision}.${notes ? ` Catatan: ${notes}` : ''}`));
  }
  const results = await env.DB.batch(statements);
  if (results[0].meta.changes !== 1) return json({ error: true, message: 'Permohonan sudah diproses.' }, 409);
  let emailSent = false;
  const recipient = application.user_email || application.emel;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    try {
      const title = `${label}: ${decision}`;
      const { html, text } = buildRefpahangEmail(title, application.nama_penuh,
        [`Keputusan permohonan ${label} anda: ${decision}.`, `No. Permohonan: #${id}`,
          ...(notes ? [`Catatan Admin: ${notes}`] : [])],
        { label: 'Semak Permohonan', url: new URL('/pengadil', env.BASE_URL).toString() });
      await sendRefpahangEmail(env, 'daftar', recipient, application.nama_penuh,
        `${title} - PBNP`, html, text);
      emailSent = true;
    } catch {
      console.error('Test application decision email could not be sent');
    }
  }
  return json({ error: false, email_sent: emailSent, message: `${label}: ${decision}.` });
}
