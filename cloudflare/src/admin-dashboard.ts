import { currentUser, json } from './auth';
import type { Env } from './types';

async function requireAdmin(request: Request, env: Env): Promise<Response | number> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  return user.id;
}

function displayDate(value: unknown): string {
  if (typeof value !== 'string' || value.length < 16) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year} ${value.slice(11, 16)}` : '-';
}

export async function adminProfile(request: Request, env: Env): Promise<Response> {
  const id = await requireAdmin(request, env);
  if (id instanceof Response) return id;
  const profile = await env.DB.prepare(`
    SELECT u.nama_penuh, u.email, u.last_login, u.created_at,
           (SELECT MAX(a.created_at) FROM activity_log a WHERE a.user_id=u.id)
             AS last_activity
    FROM users u WHERE u.id=? AND u.role='Admin' LIMIT 1
  `).bind(id).first<{
    nama_penuh: string; email: string; last_login: string | null;
    created_at: string; last_activity: string | null;
  }>();
  if (!profile) return json({ error: true, message: 'Profil admin tidak ditemui.' }, 404);
  return json({
    error: false,
    profile: {
      nama_penuh: profile.nama_penuh,
      email: profile.email,
      last_login_formatted: displayDate(profile.last_login),
      last_activity: displayDate(profile.last_activity),
      created_at: profile.created_at,
    },
  });
}

export async function adminDashboardTasks(request: Request, env: Env): Promise<Response> {
  const id = await requireAdmin(request, env);
  if (id instanceof Response) return id;
  const [applications, reports] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total FROM permohonan
      WHERE status_workflow IN ('Menunggu Admin','Menunggu PP Daerah')
    `).first<{ total: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM laporan_penilaian WHERE status='Dihantar'")
      .first<{ total: number }>(),
  ]);
  return json({
    error: false,
    tasks: {
      pending_applications: Number(applications?.total ?? 0),
      pending_reports: Number(reports?.total ?? 0),
    },
  });
}

export async function adminDashboardStats(request: Request, env: Env): Promise<Response> {
  const id = await requireAdmin(request, env);
  if (id instanceof Response) return id;
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit',
  }).format(new Date());
  const [referees, applications, reports, matches] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE role='Pengadil' AND aktif=1")
      .first<{ total: number }>(),
    env.DB.prepare(`
      SELECT COUNT(*) AS total FROM permohonan
      WHERE status_workflow IN ('Menunggu Admin','Menunggu PP Daerah')
    `).first<{ total: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM laporan_penilaian WHERE status='Dihantar'")
      .first<{ total: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS total FROM perlawanan WHERE substr(tarikh,1,7)=?')
      .bind(month).first<{ total: number }>(),
  ]);
  return json({
    error: false,
    stats: {
      total_pengadil: Number(referees?.total ?? 0),
      pending_applications: Number(applications?.total ?? 0),
      pending_reports: Number(reports?.total ?? 0),
      matches_this_month: Number(matches?.total ?? 0),
    },
  });
}
