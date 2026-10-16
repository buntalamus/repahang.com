import { processDistrictAppointmentMail } from './district-appointment-mail';
import { currentUser, json, login, logout, session } from './auth';
import { adminUsers } from './admin-users';
import { adminUserMasterData } from './user-master-data';
import { adminSettings, maintenanceEnabled } from './admin-settings';
import { changePassword } from './change-password';
import { adminDashboardStats, adminDashboardTasks, adminProfile } from './admin-dashboard';
import { appointments } from './appointments';
import { adminAppointments } from './admin-appointments';
import { appointmentReply } from './appointment-reply';
import { appointmentEmailLink } from './appointment-email-link';
import { appointmentAudit } from './appointment-audit';
import { assessmentToken } from './assessment-token';
import { assessmentReports } from './assessment-reports';
import { assessmentDraft } from './assessment-draft';
import { submitAssessmentRequest } from './report-submission';
import { telegramWebhook } from './telegram-webhook';
import { adminUsersWrite } from './admin-users-write';
import { announcementsWrite } from './announcements-write';
import { refereeProfileWrite } from './profile-admin-write';
import { GATES } from './php/gates';
import { appointmentWritesEnabled } from './lantikan-write';
import { processQueuedKupCrewNotifications } from './php/lantikan-helper';
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
import { fitnessForm } from './fitness-form';
import { futsalForm } from './futsal-form';
import { registrationPdf } from './registration-pdf';
import { submitRefereeApplication } from './application-submit';
import { chairConfig } from './chair-config';
import { printAssessment } from './print-assessment';
import { chairApprovalLink } from './chair-approval-link';
import { adminTelegramBlastPreview, externalTelegramBlastPreview } from './telegram-blast-preview';
import { registeredReferees, deactivateReferee } from './registered-referees';
import { adminMatches } from './admin-matches';
import { districtMatchVerification } from './district-match-verification';
import { externalReferees } from './external-referees';
import { register } from './register';
import { missingRefereeProfile, profileLabels } from './referee-profile';
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
import { adminMailbox, receiveMailboxEmail } from './mailbox';
import { syncAllShinjiruMailboxes } from './mailbox-imap';
import type { Env } from './types';

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  return request.headers.get('Sec-Fetch-Site') !== 'cross-site';
}

export function qaWriteAllowed(request: Request, env: Env): boolean {
  if (!env.STAGING_QA_WRITE_TOKEN || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const pathname = new URL(request.url).pathname;
  // A test user must still be able to obtain a session through the normal UI.
  if (pathname === '/api/login.php' || pathname === '/api/logout.php') return true;
  return request.headers.get('X-Refpahang-QA-Write-Token') === env.STAGING_QA_WRITE_TOKEN;
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
    registration_open: env.STAGING_AUTH_ENABLED === '1' && env.STAGING_WRITES_ENABLED === '1'
      && (record ? record.setting_value === '1' : true),
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
    return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  }
  const result = await env.DB.prepare('SELECT id, nama FROM districts ORDER BY nama ASC').all();
  return json({ error: false, data: result.results });
}

async function userProfile(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  const profile = await env.DB.prepare(`
    SELECT u.id, u.email, u.nama_penuh, u.no_ic, u.no_telefon, u.jantina,
           u.persatuan_id,
           u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
           u.status_kerja, u.jawatan, u.nama_majikan, u.alamat_majikan1,
           u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan,
           u.negeri_majikan, u.nama_waris, u.hubungan_waris, u.telefon_waris,
           u.url_gambar_profil, u.umur, u.jenis_pengadil, u.tahun_mula_aktif,
           u.saiz_baju, u.telegram_chat_id, u.password_changed,
           CASE WHEN trim(COALESCE(u.telegram_chat_id,''))='' THEN 1 ELSE 0 END AS telegram_link_required,
           pbd.nama_persatuan AS persatuan_bolasepak_daerah,
           p.jenis_pengadil AS permohonan_jenis_pengadil,
           (SELECT p.tahun_permohonan FROM permohonan p
            WHERE p.user_id=u.id AND p.jenis_borang='ujian_bertulis'
              AND p.status_workflow IN ('Lengkap','Admin Diluluskan','Bayaran Diterima')
            ORDER BY p.tahun_permohonan DESC LIMIT 1) AS tahun_lulus_kelas3
    FROM users u
    LEFT JOIN persatuan_bolasepak_daerah pbd
      ON pbd.id=COALESCE(u.persatuan_id,u.district_id)
    LEFT JOIN permohonan p ON p.user_id=u.id
    WHERE u.id=? LIMIT 1
  `).bind(user.id).first();
  if (!profile) return json({ error: true, message: 'Profil tidak dijumpai.' }, 404);
  const missing = missingRefereeProfile(profile as Record<string, unknown>);
  return json({ error: false, user: profile, profile_missing_fields: missing,
    profile_missing_labels: missing.map(key => profileLabels[key]) });
}

async function privateMedia(request: Request, env: Env, pathname: string): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  let key: string;
  try {
    key = decodeURIComponent(pathname.slice('/uploads/'.length));
  } catch {
    return json({ error: true, message: 'Laluan fail tidak sah.' }, 400);
  }
  if (!key || key.includes('\\') || key.split('/').some((part) => part === '..' || part === '.')) {
    return json({ error: true, message: 'Laluan fail tidak sah.' }, 400);
  }
  // Authorization and the current DB reference are checked before every cache lookup.
  const cacheableProfile = request.method === 'GET' &&
    (key.startsWith('profiles/') || key.startsWith('profile_') || key.startsWith('applications/gambar_'));
  const cache: Cache | null = typeof caches === 'undefined'
    ? null : (caches as unknown as { default: Cache }).default;
  const cacheKey = cacheableProfile
    ? new Request(new URL(`/__private-profile-cache/${encodeURIComponent(key)}`, request.url), { method: 'GET' })
    : null;
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
  if (cache && cacheKey) {
    let cached: Response | undefined;
    try { cached = await cache.match(cacheKey); } catch { cached = undefined; }
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('Cache-Control', 'private, no-store');
      return new Response(cached.body, { status: cached.status, headers });
    }
  }
  const object = request.method === 'HEAD' ? await env.MEDIA.head(key) : await env.MEDIA.get(key);
  if (!object) return json({ error: true, message: 'Fail tidak dijumpai.' }, 404);
  const headers = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  const response = new Response(request.method === 'HEAD' ? null : (object as R2ObjectBody).body, { headers });
  if (cache && cacheKey && response.headers.get('Content-Type')?.startsWith('image/')) {
    const cacheHeaders = new Headers(response.headers);
    cacheHeaders.set('Cache-Control', 'public, max-age=86400');
    try {
      await cache.put(cacheKey, new Response(response.clone().body, {
        status: response.status, statusText: response.statusText, headers: cacheHeaders,
      }));
    } catch { /* Cache is an optimization; the R2 response is still valid. */ }
  }
  return response;
}

async function api(request: Request, env: Env, pathname: string, ctx: ExecutionContext): Promise<Response> {
  if (pathname === '/api/__migration-health') {
    if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
    await env.DB.prepare('SELECT 1').first();
    return json({ ok: true, stage: 'migration', api_complete: false });
  }
  const gate = GATES[pathname.slice('/api/'.length)];
  if (gate && request.method !== 'OPTIONS') {
    const denied = gate(await currentUser(request, env));
    if (denied) return denied;
  }
  if (pathname === '/api/login.php') return login(request, env);
  if (pathname === '/api/admin-mailbox.php') return adminMailbox(request, env);
  if (pathname === '/api/register.php') return register(request, env);
  if (pathname === '/api/admin-approve.php') return adminApprove(request, env);
  if (pathname === '/api/telegram-link-self.php') return telegramLinkSelf(request, env);
  if (pathname === '/api/pp-verify.php') return ppVerify(request, env);
  if (pathname === '/api/admin-test-applications.php') return adminTestApplications(request, env);
  if (pathname === '/api/pengadil-match-manage.php') return refereeMatchManage(request, env);
  if (pathname === '/api/lantikan-jawab.php') return appointmentReply(request, env);
  if (pathname === '/api/lantikan.php') return adminAppointments(request, env);
  if (pathname === '/api/lantikan-jawab-token.php') return appointmentEmailLink(request, env);
  if (pathname === '/api/telegram-webhook.php') return telegramWebhook(request, env);
  if (pathname === '/api/lantikan-audit.php') return appointmentAudit(request, env);
  if (pathname === '/api/penilaian-token.php') return request.method === 'POST'
    ? assessmentDraft(request,env,'token') : assessmentToken(request, env);
  if (pathname === '/api/laporan-penilaian.php') return request.method === 'POST'
    ? assessmentDraft(request,env,'session') : request.method === 'PUT'
      ? submitAssessmentRequest(request,env) : assessmentReports(request, env);
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
  if (pathname === '/api/download-borang-ujian-kecergasan.php') return fitnessForm(request, env);
  if (pathname === '/api/download-borang-futsal.php') return futsalForm(request, env);
  if (pathname === '/api/download-borang-pendaftaran.php') return registrationPdf(request, env);
  if (pathname === '/api/kejohanan-pengesah-laporan.php') return chairConfig(request, env);
  if (pathname === '/api/download-laporan-penilaian.php') return printAssessment(request, env);
  if (pathname === '/api/laporan-pengesahan-token.php') return chairApprovalLink(request, env);
  if (pathname === '/api/admin-telegram-blast.php') return adminTelegramBlastPreview(request, env);
  if (pathname === '/api/pengadil-luar-telegram-blast.php') return externalTelegramBlastPreview(request, env);
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
  if (pathname === '/api/pengadil-application.php' && request.method === 'POST') {
    return submitRefereeApplication(request, env);
  }
  if (pathname === '/api/notifications.php' && request.method === 'POST') {
    return notifications(request, env);
  }
  if (pathname === '/api/admin-users-master-data.php') return adminUserMasterData(request, env);
  if (pathname === '/api/admin-users.php' && request.method !== 'GET') return adminUsersWrite(request, env);
  if (pathname === '/api/announcements.php' && request.method !== 'GET') return announcementsWrite(request, env, ctx);
  if (pathname === '/api/profil-pengadil.php' && request.method !== 'GET') {
    return refereeProfileWrite(request, env);
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
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await receiveMailboxEmail(message, env);
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (!qaWriteAllowed(request, env)) {
      return json({ error: true, message: 'Tindakan ujian memerlukan kunci QA.' }, 403);
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !isSameOrigin(request)) {
      return json({ error: true, message: 'Asal permintaan tidak dibenarkan.' }, 403);
    }
    try {
      if (pathname.startsWith('/api/')) {
        const response=await api(request, env, pathname, ctx);
        if (response.ok && request.method==='POST' && appointmentWritesEnabled(env)
          && ['/api/lantikan.php','/api/lantikan-jawab.php','/api/lantikan-jawab-token.php',
            '/api/lantikan-audit.php','/api/telegram-webhook.php'].includes(pathname)) {
          ctx.waitUntil(processDistrictAppointmentMail(env).catch(()=>console.error('District appointment mail retry pending.')));
        }
        return response;
      }
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
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    // api/kup-crew-notification-retry.php ran from the system cron in PHP.
    try {
      if (appointmentWritesEnabled(env)) {
        try { await processQueuedKupCrewNotifications(env); }
        finally { await processDistrictAppointmentMail(env); }
      }
    } finally {
      await syncAllShinjiruMailboxes(env);
    }
  },
} satisfies ExportedHandler<Env>;
