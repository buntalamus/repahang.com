/**
 * The authentication prelude at the top of each PHP endpoint, run before the
 * Worker handler so status codes and messages match bootstrap.php
 * (requireAuth/requireRole/requireAdmin) or the file's own inline check.
 * Endpoints whose PHP checks the method before the session are not listed.
 */
import { json } from '../auth';
import type { SessionUser } from '../auth';

type Gate = (user: SessionUser | null) => Response | null;

const unauthenticated = () => json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);

const requireAuth: Gate = (user) => (user ? null : unauthenticated());

const requireRole = (...roles: string[]): Gate => (user) => {
  if (!user) return unauthenticated();
  return roles.includes(user.role) ? null
    : json({ error: true, message: 'Akses ditolak. Peranan anda tidak dibenarkan untuk aksi ini.' }, 403);
};

const requireAdmin: Gate = (user) => {
  if (!user) return unauthenticated();
  return user.role === 'Admin' ? null
    : json({ error: true, message: 'Akses ditolak. Hanya pentadbir dibenarkan.' }, 403);
};

/** requireAuth() then an inline Admin check with its own message. */
const authThenAdmin = (message: string): Gate => (user) => {
  if (!user) return unauthenticated();
  return user.role === 'Admin' ? null : json({ error: true, message }, 403);
};

const inline = (check: (user: SessionUser | null) => boolean, status: number, message: string): Gate =>
  (user) => (check(user) ? null : json({ error: true, message }, status));

const ALL_ROLES = ['Pengadil', 'Penilai', 'PP Daerah', 'Admin'];

export const GATES: Record<string, Gate> = {
  // requireRole([...]) at the top of the file
  'lantikan.php': requireRole('Admin', 'PP Daerah'),
  'admin-matches.php': requireRole('Admin'),
  'lantikan-audit.php': requireRole('Admin'),
  'lantikan-jawab.php': requireRole('Pengadil', 'Penilai', 'PP Daerah'),
  'tugasan.php': requireRole('Pengadil', 'Penilai', 'PP Daerah'),
  'laporan-penilaian.php': requireRole('Admin', 'Penilai', 'PP Daerah'),
  'pengadil-penilaian.php': requireRole('Pengadil'),
  'pp-penilaian.php': requireRole('PP Daerah'),
  'pp-applications.php': requireRole('PP Daerah'),
  'pp-verify-match.php': requireRole('PP Daerah'),
  'pp-referees.php': requireRole('PP Daerah'),
  'pp-verify.php': requireRole('PP Daerah'),
  'pp-export-referees.php': requireRole('PP Daerah'),
  'pp-dashboard-overview.php': requireRole('PP Daerah'),
  'pengadil-luar.php': requireRole('Admin'),
  'pengadil-luar-upload.php': requireRole('Admin'),
  'profil-pengadil.php': requireRole(...ALL_ROLES),
  'pengadil-matches.php': requireRole('Pengadil'),
  'get-active-referees.php': requireRole(...ALL_ROLES),
  'pengadil-taraf.php': requireRole('Admin'),
  'pengadil-match-manage.php': requireRole('Pengadil'),
  'pool-pengadil.php': requireRole('Admin', 'PP Daerah'),
  'jadual-perlawanan.php': requireRole('Admin', 'PP Daerah'),
  'jadual-lantikan-report.php': requireRole('Admin', 'PP Daerah'),
  'jadual-upload.php': requireRole('Admin', 'PP Daerah'),
  'kejohanan.php': requireRole('Admin', 'PP Daerah'),
  'districts.php': requireRole(...ALL_ROLES),
  // requireAdmin()
  'admin-users.php': requireAdmin,
  'kejohanan-pengesah-laporan.php': requireAdmin,
  'download-referees-excel.php': requireAdmin,
  'referees.php': requireAdmin,
  'admin-delete-referee.php': requireAdmin,
  'statistics.php': requireAdmin,
  'admin-telegram-blast.php': requireAdmin,
  'pengadil-luar-telegram-blast.php': requireAdmin,
  // requireAuth()
  'application-settings.php': requireAuth,
  'pengadil-application-history.php': requireAuth,
  'admin-applications.php': requireAuth,
  'get-user-profile.php': requireAuth,
  'notifications.php': requireAuth,
  'telegram-link-self.php': requireAuth,
  'pengadil-application.php': requireAuth,
  'admin-approve.php': authThenAdmin('Akses ditolak. Hanya admin boleh mengakses.'),
  'admin-test-applications.php': authThenAdmin('Akses ditolak. Hanya admin boleh mengakses.'),
  // Inline session checks with their own wording
  'admin-dashboard-stats.php': inline((u) => u?.role === 'Admin', 401, 'Unauthorised'),
  'admin-dashboard-tasks.php': inline((u) => u?.role === 'Admin', 401, 'Unauthorised'),
  'admin-profile.php': inline((u) => u?.role === 'Admin', 401, 'Akses tidak dibenarkan'),
  'admin-settings.php': inline((u) => u?.role === 'Admin', 403, 'Akses ditolak. Hanya admin dibenarkan.'),
  'announcements.php': inline((u) => !!u, 401, 'Sesi tidak sah'),
  'penilai-dashboard.php': inline((u) => u?.role === 'Penilai', 403, 'Akses ditolak'),
  'pp-announcements.php': (user) => !user ? json({ error: true, message: 'Sesi tidak sah' }, 401)
    : user.role === 'PP Daerah' ? null : json({ error: true, message: 'Akses tidak dibenarkan' }, 403),
};
