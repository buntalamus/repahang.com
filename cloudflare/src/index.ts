import { currentUser, json, login, logout, session } from './auth';
import { adminUsers } from './admin-users';
import { adminSettings, maintenanceEnabled } from './admin-settings';
import { changePassword } from './change-password';
import { adminDashboardStats, adminDashboardTasks, adminProfile } from './admin-dashboard';
import { appointments } from './appointments';
import { districtAssessments, refereeAssessments } from './assessments';
import { districtApplications } from './district-applications';
import { districtReferees } from './district-referees';
import { refereeProfile } from './profile';
import { adminApplications, applicationHistory, applicationSettings, deleteApplication } from './applications';
import { announcements, notifications } from './notifications';
import { activeReferees, ownApplications, refereeMatches } from './referee';
import { refereeGrades } from './referee-grades';
import { refereePool } from './referee-pool';
import { schedule } from './schedule';
import { scheduleReport } from './schedule-report';
import { printSchedule } from './print-schedule';
import { registeredReferees, deactivateReferee } from './registered-referees';
import { adminMatches } from './admin-matches';
import { districtMatchVerification } from './district-match-verification';
import { externalReferees } from './external-referees';
import { register } from './register';
import { adminApprove } from './admin-approve';
import { telegramLinkSelf } from './telegram-link-self';
import { ppVerify } from './pp-verify';
import { adminTestApplications } from './admin-test-applications';
import { refereeMatchManage } from './referee-match-manage';
import { statistics } from './statistics';
import { adminRefereeExport, districtRefereeExport } from './referee-exports';
import { scheduleUpload } from './schedule-upload';
import { externalRefereesUpload } from './external-referees-upload';
import { updateProfile, uploadProfileImage } from './profile-write';
import { forgotPassword, resetPassword } from './password-reset';
import { assessorDashboard, districtAnnouncements, districtOverview } from './role-dashboards';
import { tournaments } from './tournaments';
import type { Env } from './types';

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  return request.headers.get('Sec-Fetch-Site') !== 'cross-site';
}

function dateForDisplay(raw: string): string {
  const parts = raw.slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : raw;
}

async function publicAnnouncements(env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT id, title, content, created_at FROM announcements
    ORDER BY created_at DESC LIMIT 5
  `).all<{ id: number; title: string; content: string; created_at: string }>();
  const data = result.results.map((row) => ({
    ...row,
    created_at_formatted: dateForDisplay(row.created_at),
  }));
  return json({ error: false, data });
}

async function registrationStatus(env: Env): Promise<Response> {
  const record = await env.DB.prepare("SELECT setting_value FROM application_settings WHERE setting_key='registration_open'")
    .first<{ setting_value: string }>();
  return json({
    error: false,
    registration_open: env.STAGING_AUTH_ENABLED === '1' && (record ? record.setting_value === '1' : true),
  });
}

async function publicPersatuan(env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT id, nama_persatuan, kod_persatuan, daerah
    FROM persatuan_bolasepak_daerah WHERE aktif=1 ORDER BY nama_persatuan ASC
  `).all();
  return json({ error: false, data: result.results });
}

async function districts(request: Request, env: Env): Promise<Response> {
  if (!await currentUser(request, env)) {
    return json({ error: true, message: 'Sila log masuk.' }, 401);
  }
  const result = await env.DB.prepare('SELECT id, nama FROM districts ORDER BY nama ASC').all();
  return json({ error: false, data: result.results });
}

async function userProfile(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  const profile = await env.DB.prepare(`
    SELECT u.id, u.email, u.nama_penuh, u.no_ic, u.no_telefon, u.jantina,
           u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
           u.status_kerja, u.jawatan, u.nama_majikan, u.alamat_majikan1,
           u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan,
           u.negeri_majikan, u.nama_waris, u.hubungan_waris, u.telefon_waris,
           u.url_gambar_profil, u.umur, u.jenis_pengadil, u.tahun_mula_aktif,
           u.saiz_baju, u.telegram_chat_id, u.password_changed,
           pbd.nama_persatuan AS persatuan_bolasepak_daerah,
           (SELECT p.jenis_pengadil FROM permohonan p WHERE p.user_id=u.id
            ORDER BY p.tahun_permohonan DESC, p.id DESC LIMIT 1) AS permohonan_jenis_pengadil,
           (SELECT p.tahun_permohonan FROM permohonan p
            WHERE p.user_id=u.id AND p.jenis_borang='ujian_bertulis'
              AND p.status_workflow IN ('Lengkap','Admin Diluluskan','Bayaran Diterima')
            ORDER BY p.tahun_permohonan DESC LIMIT 1) AS tahun_lulus_kelas3
    FROM users u
    LEFT JOIN persatuan_bolasepak_daerah pbd
      ON pbd.id=COALESCE(u.persatuan_id,u.district_id)
    WHERE u.id=? LIMIT 1
  `).bind(user.id).first();
  if (!profile) return json({ error: true, message: 'Profil tidak dijumpai.' }, 404);
  return json({ error: false, user: profile });
}

async function privateMedia(request: Request, env: Env, pathname: string): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  let key: string;
  try {
    key = decodeURIComponent(pathname.slice('/uploads/'.length));
  } catch {
    return json({ error: true, message: 'Laluan fail tidak sah.' }, 400);
  }
  if (!key || key.includes('\\') || key.split('/').some((part) => part === '..' || part === '.')) {
    return json({ error: true, message: 'Laluan fail tidak sah.' }, 400);
  }
  if (user.role !== 'Admin') {
    const reference = `/uploads/${key}`;
    let allowed = await env.DB.prepare(`
      SELECT 1 FROM users WHERE url_gambar_profil IN (?, ?, ?)
      UNION ALL
      SELECT 1 FROM permohonan WHERE user_id=? AND (
        url_resit IN (?, ?, ?) OR url_gambar_profil IN (?, ?, ?)
        OR payment_receipt_url IN (?, ?, ?)
      )
      UNION ALL
      SELECT 1 FROM permohonan_pp WHERE user_id=? AND (
        resit_pembayaran_path IN (?, ?, ?) OR resit_path IN (?, ?, ?)
      )
      UNION ALL
      SELECT 1 FROM penilai_permohonan pen
      JOIN permohonan p ON p.id=pen.permohonan_id
      WHERE p.user_id=? AND (
        pen.sijil_kursus_url IN (?, ?, ?) OR pen.sijil_kesihatan_url IN (?, ?, ?)
      ) LIMIT 1
    `).bind(
      reference, reference.slice(1), key,
      user.id, reference, reference.slice(1), key,
      reference, reference.slice(1), key,
      reference, reference.slice(1), key,
      user.id, reference, reference.slice(1), key,
      reference, reference.slice(1), key,
      user.id, reference, reference.slice(1), key,
      reference, reference.slice(1), key,
    ).first();
    // Tournament/team logos are shown to officials as well as Admin. Keep
    // receipts and other private uploads under the owner checks above.
    if (!allowed && key.startsWith('logos/')) {
      allowed = await env.DB.prepare(`
        SELECT 1 FROM kejohanan WHERE logo_kiri=? OR logo_kanan=?
        UNION ALL SELECT 1 FROM jadual_perlawanan WHERE logo_home=? OR logo_away=?
        UNION ALL SELECT 1 FROM pasukan_logo WHERE logo_path=? LIMIT 1
      `).bind(reference, reference, reference, reference, reference).first();
    }
    if (!allowed) return json({ error: true, message: 'Akses ditolak.' }, 403);
  }
  const object = request.method === 'HEAD' ? await env.MEDIA.head(key) : await env.MEDIA.get(key);
  if (!object) return json({ error: true, message: 'Fail tidak dijumpai.' }, 404);
  const headers = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  return new Response(request.method === 'HEAD' ? null : (object as R2ObjectBody).body, { headers });
}

async function api(request: Request, env: Env, pathname: string): Promise<Response> {
  if (pathname === '/api/__migration-health') {
    if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
    await env.DB.prepare('SELECT 1').first();
    return json({ ok: true, stage: 'migration', api_complete: false });
  }
  if (pathname === '/api/login.php') return login(request, env);
  if (pathname === '/api/register.php') return register(request, env);
  if (pathname === '/api/admin-approve.php') return adminApprove(request, env);
  if (pathname === '/api/telegram-link-self.php') return telegramLinkSelf(request, env);
  if (pathname === '/api/pp-verify.php') return ppVerify(request, env);
  if (pathname === '/api/admin-test-applications.php') return adminTestApplications(request, env);
  if (pathname === '/api/pengadil-match-manage.php') return refereeMatchManage(request, env);
  if (pathname === '/api/statistics.php') return statistics(request, env);
  if (pathname === '/api/download-referees-excel.php') return adminRefereeExport(request, env);
  if (pathname === '/api/pp-export-referees.php') return districtRefereeExport(request, env);
  if (pathname === '/api/jadual-upload.php') return scheduleUpload(request, env);
  if (pathname === '/api/pengadil-luar-upload.php') return externalRefereesUpload(request, env);
  if (pathname === '/api/session.php') return session(request, env);
  if (pathname === '/api/logout.php') return logout(request, env);
  if (pathname === '/api/change-password.php') return changePassword(request, env);
  if (pathname === '/api/forgot-password.php') return forgotPassword(request, env);
  if (pathname === '/api/reset-password.php') return resetPassword(request, env);
  if (pathname === '/api/pengadil-taraf.php') return refereeGrades(request, env);
  if (pathname === '/api/admin-settings.php') return adminSettings(request, env);
  if (pathname === '/api/kejohanan.php') return tournaments(request, env);
  if (pathname === '/api/pool-pengadil.php') return refereePool(request, env);
  if (pathname === '/api/jadual-perlawanan.php') return schedule(request, env);
  if (pathname === '/api/jadual-lantikan-report.php') return scheduleReport(request, env);
  if (pathname === '/api/download-jadual-lantikan.php') return printSchedule(request, env);
  if (pathname === '/api/referees.php') return registeredReferees(request, env);
  if (pathname === '/api/admin-delete-referee.php') return deactivateReferee(request, env);
  if (pathname === '/api/admin-matches.php') return adminMatches(request, env);
  if (pathname === '/api/pp-verify-match.php') return districtMatchVerification(request, env);
  if (pathname === '/api/pengadil-luar.php') return externalReferees(request, env);
  if (pathname === '/api/update-profile.php') return updateProfile(request, env);
  if (pathname === '/api/upload-profile-image.php') return uploadProfileImage(request, env);
  if (pathname === '/api/admin-applications.php' && request.method === 'POST') {
    return deleteApplication(request, env);
  }
  if (pathname === '/api/notifications.php' && request.method === 'POST') {
    return notifications(request, env);
  }
  if (request.method !== 'GET') {
    return json({ error: true, message: 'Fungsi ini belum tersedia di staging.' }, 503);
  }
  if (pathname === '/api/check-maintenance.php') {
    const maintenance = await maintenanceEnabled(env);
    const isAdmin = (await currentUser(request, env))?.role === 'Admin';
    return json({ maintenance_mode: maintenance, is_admin: isAdmin, can_access: !maintenance || isAdmin });
  }
  if (pathname === '/api/public-announcements.php') return publicAnnouncements(env);
  if (pathname === '/api/registration-status.php') return registrationStatus(env);
  if (pathname === '/api/public-persatuan.php') return publicPersatuan(env);
  if (pathname === '/api/districts.php') return districts(request, env);
  if (pathname === '/api/get-user-profile.php') return userProfile(request, env);
  if (pathname === '/api/application-settings.php') return applicationSettings(request, env);
  if (pathname === '/api/pengadil-application-history.php') return applicationHistory(request, env);
  if (pathname === '/api/admin-applications.php') return adminApplications(request, env);
  if (pathname === '/api/admin-users.php') return adminUsers(request, env);
  if (pathname === '/api/admin-profile.php') return adminProfile(request, env);
  if (pathname === '/api/admin-dashboard-tasks.php') return adminDashboardTasks(request, env);
  if (pathname === '/api/admin-dashboard-stats.php') return adminDashboardStats(request, env);
  if (pathname === '/api/pengadil-matches.php') return refereeMatches(request, env);
  if (pathname === '/api/pengadil-penilaian.php') return refereeAssessments(request, env);
  if (pathname === '/api/pp-penilaian.php') return districtAssessments(request, env);
  if (pathname === '/api/pp-applications.php') return districtApplications(request, env);
  if (pathname === '/api/pp-referees.php') return districtReferees(request, env);
  if (pathname === '/api/profil-pengadil.php') return refereeProfile(request, env);
  if (pathname === '/api/get-active-referees.php') return activeReferees(request, env);
  if (pathname === '/api/pengadil-application.php') return ownApplications(request, env);
  if (pathname === '/api/notifications.php') return notifications(request, env);
  if (pathname === '/api/announcements.php') return announcements(request, env);
  if (pathname === '/api/tugasan.php') return appointments(request, env);
  if (pathname === '/api/penilai-dashboard.php') return assessorDashboard(request, env);
  if (pathname === '/api/pp-announcements.php') return districtAnnouncements(request, env);
  if (pathname === '/api/pp-dashboard-overview.php') return districtOverview(request, env);
  return json({ error: true, message: 'Fungsi ini belum tersedia di staging.' }, 503);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !isSameOrigin(request)) {
      return json({ error: true, message: 'Asal permintaan tidak dibenarkan.' }, 403);
    }
    try {
      if (pathname.startsWith('/api/')) return await api(request, env, pathname);
      if (pathname.startsWith('/uploads/')) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
        }
        return await privateMedia(request, env, pathname);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('RefPahang Worker request failed', error);
      return json({ error: true, message: 'Ralat pelayan dalaman.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
