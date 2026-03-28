import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Public routes
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'daftar',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'maintenance',
    loadComponent: () =>
      import('./features/maintenance/maintenance.component').then((m) => m.MaintenanceComponent),
  },
  {
    path: 'tukar-kata-laluan',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/force-change-password/force-change-password.component').then((m) => m.ForceChangePasswordComponent),
  },

  // Admin routes
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'permohonan',
        loadComponent: () =>
          import('./features/admin/applications/applications.component').then((m) => m.AdminApplicationsComponent),
      },
      {
        path: 'pengadil-berdaftar',
        loadComponent: () =>
          import('./features/admin/pengadil-berdaftar/pengadil-berdaftar.component').then((m) => m.PengadilBerdaftarComponent),
      },
      {
        path: 'pengguna',
        loadComponent: () =>
          import('./features/admin/users/users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'lantikan',
        loadComponent: () =>
          import('./features/admin/lantikan-pengadil/lantikan-pengadil.component').then((m) => m.LantikanPengadilComponent),
      },
      {
        path: 'pengadil-luar',
        loadComponent: () =>
          import('./features/admin/pengadil-luar/pengadil-luar.component').then((m) => m.PengadilLuarComponent),
      },
      {
        path: 'statistik',
        loadComponent: () =>
          import('./features/admin/statistics/statistics.component').then((m) => m.AdminStatisticsComponent),
      },
      {
        path: 'pengumuman',
        loadComponent: () =>
          import('./features/admin/announcements/announcements.component').then((m) => m.AdminAnnouncementsComponent),
      },
      {
        path: 'tetapan',
        loadComponent: () =>
          import('./features/admin/settings/settings.component').then((m) => m.AdminSettingsComponent),
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./features/admin/profile/profile.component').then((m) => m.AdminProfileComponent),
      },
      {
        path: 'laporan',
        loadComponent: () =>
          import('./features/admin/reports/reports.component').then((m) => m.AdminReportsComponent),
      },
      {
        path: 'ujian',
        loadComponent: () =>
          import('./features/admin/test-applications/test-applications.component').then((m) => m.TestApplicationsComponent),
      },
    ],
  },

  // PP Daerah routes
  {
    path: 'pp-daerah',
    canActivate: [authGuard, roleGuard('PP Daerah')],
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/pp-daerah/dashboard/dashboard.component').then((m) => m.PpDashboardComponent),
      },
      {
        path: 'permohonan/berdaftar',
        loadComponent: () =>
          import('./features/pp-daerah/applications/applications.component').then((m) => m.PpApplicationsComponent),
        data: { type: 'berdaftar' },
      },
      {
        path: 'permohonan/futsal',
        loadComponent: () =>
          import('./features/pp-daerah/applications/applications.component').then((m) => m.PpApplicationsComponent),
        data: { type: 'futsal' },
      },
      {
        path: 'permohonan/kecergasan',
        loadComponent: () =>
          import('./features/pp-daerah/applications/applications.component').then((m) => m.PpApplicationsComponent),
        data: { type: 'kecergasan' },
      },
      {
        path: 'permohonan/bertulis',
        loadComponent: () =>
          import('./features/pp-daerah/applications/applications.component').then((m) => m.PpApplicationsComponent),
        data: { type: 'bertulis' },
      },
      {
        path: 'permohonan/kelas1',
        loadComponent: () =>
          import('./features/pp-daerah/applications/applications.component').then((m) => m.PpApplicationsComponent),
        data: { type: 'kelas1' },
      },
      {
        path: 'pengadil',
        loadComponent: () =>
          import('./features/pp-daerah/referees/referees.component').then((m) => m.PpRefereesComponent),
      },
      {
        path: 'lantikan',
        loadComponent: () =>
          import('./features/pp-daerah/applications/applications.component').then((m) => m.PpApplicationsComponent),
        data: { type: 'lantikan' },
      },
      {
        path: 'statistik',
        loadComponent: () =>
          import('./features/pp-daerah/dashboard/dashboard.component').then((m) => m.PpDashboardComponent),
        data: { section: 'statistik' },
      },
      {
        path: 'pengesahan',
        loadComponent: () =>
          import('./features/pp-daerah/applications/applications.component').then((m) => m.PpApplicationsComponent),
        data: { type: 'pengesahan' },
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./features/admin/profile/profile.component').then((m) => m.AdminProfileComponent),
      },
    ],
  },

  // Pengadil routes
  {
    path: 'pengadil',
    canActivate: [authGuard, roleGuard('Pengadil')],
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/pengadil/dashboard/dashboard.component').then((m) => m.PengadilDashboardComponent),
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./features/pengadil/profile/profile.component').then((m) => m.PengadilProfileComponent),
      },
      {
        path: 'perlawanan',
        loadComponent: () =>
          import('./features/pengadil/matches/matches.component').then((m) => m.PengadilMatchesComponent),
      },
      {
        path: 'permohonan/berdaftar',
        loadComponent: () =>
          import('./features/pengadil/application/application.component').then((m) => m.PengadilApplicationComponent),
        data: { type: 'berdaftar' },
      },
      {
        path: 'permohonan/futsal',
        loadComponent: () =>
          import('./features/pengadil/application/application.component').then((m) => m.PengadilApplicationComponent),
        data: { type: 'futsal' },
      },
      {
        path: 'permohonan/kecergasan',
        loadComponent: () =>
          import('./features/pengadil/application/application.component').then((m) => m.PengadilApplicationComponent),
        data: { type: 'kecergasan' },
      },
      {
        path: 'permohonan/bertulis',
        loadComponent: () =>
          import('./features/pengadil/application/application.component').then((m) => m.PengadilApplicationComponent),
        data: { type: 'bertulis' },
      },
      {
        path: 'permohonan/kelas1',
        loadComponent: () =>
          import('./features/pengadil/application/application.component').then((m) => m.PengadilApplicationComponent),
        data: { type: 'kelas1' },
      },
      {
        path: 'tugasan',
        loadComponent: () =>
          import('./features/pengadil/tugasan/tugasan.component').then((m) => m.PengadilTugasanComponent),
      },
    ],
  },

  // Penilai routes
  {
    path: 'penilai',
    canActivate: [authGuard, roleGuard('Penilai')],
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/penilai/dashboard/dashboard.component').then((m) => m.PenilaiDashboardComponent),
      },
      {
        path: 'penilaian',
        loadComponent: () =>
          import('./features/penilai/assessments/assessments.component').then((m) => m.PenilaiAssessmentsComponent),
      },
      {
        path: 'permohonan',
        loadComponent: () =>
          import('./features/penilai/dashboard/dashboard.component').then((m) => m.PenilaiDashboardComponent),
        data: { section: 'permohonan' },
      },
      {
        path: 'tugasan',
        loadComponent: () =>
          import('./features/pengadil/tugasan/tugasan.component').then((m) => m.PengadilTugasanComponent),
      },
      {
        path: 'statistik',
        loadComponent: () =>
          import('./features/penilai/dashboard/dashboard.component').then((m) => m.PenilaiDashboardComponent),
        data: { section: 'statistik' },
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./features/admin/profile/profile.component').then((m) => m.AdminProfileComponent),
      },
    ],
  },

  // Wildcard
  { path: '**', redirectTo: 'login' },
];
