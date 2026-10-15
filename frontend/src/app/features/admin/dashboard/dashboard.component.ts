import { Component, OnInit } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, LoadingComponent, NgClass, FormsModule, DatePipe],
  templateUrl: './dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  loading = true;
  profile: any = {};
  tasks: any = {};
  announcements: any[] = [];
  stats = { users: 0, matches: 0, verifyRate: 0 };
  applicationYear = new Date().getFullYear();
  applicationCards: { key: string; label: string; route: string; type?: string;
    total: number; pending: number; approved: number }[] = [
    { key: 'pengadil_berdaftar', label: 'Pengadil Berdaftar', route: '/admin/permohonan', type: 'berdaftar', total: 0, pending: 0, approved: 0 },
    { key: 'penilai_berdaftar', label: 'Penilai Pengadil Berdaftar', route: '/admin/permohonan-ra', total: 0, pending: 0, approved: 0 },
    { key: 'kelas3_fam', label: 'Kelas III FAM', route: '/admin/permohonan', type: 'kelas3', total: 0, pending: 0, approved: 0 },
    { key: 'ujian_kelas1_fam', label: 'Kelas I FAM', route: '/admin/permohonan', type: 'kelas1', total: 0, pending: 0, approved: 0 },
  ];
  recentApplications: any[] = [];
  applicationGroups: { key: string; label: string; route: string; type?: string; items: any[] }[] = [];
  showRejectModal = false;
  rejectTargetId = 0;
  rejectTargetName = '';
  rejectReason = '';

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    const T = 10000;
    forkJoin({
      profile: this.api.get<any>('admin-profile.php').pipe(
        timeout(T),
        catchError(() => of({ error: true })),
      ),
      tasks: this.api.get<any>('admin-dashboard-tasks.php').pipe(
        timeout(T),
        catchError(() => of({ error: true })),
      ),
      apiStats: this.api.get<any>('admin-dashboard-stats.php').pipe(
        timeout(T),
        catchError(() => of({ error: true })),
      ),
      announcements: this.api.get<any>('announcements.php').pipe(
        timeout(T),
        catchError(() => of({ error: true, data: [] })),
      ),
      recentApplications: this.api.get<any>('admin-applications.php', { status: 'Menunggu Admin', year: String(this.applicationYear) }).pipe(
        timeout(T),
        catchError(() => of({ error: true, data: [] })),
      ),
    }).pipe(
      finalize(() => { this.loading = false; }),
    ).subscribe({
      next: ({ profile, tasks, apiStats, announcements, recentApplications }) => {
        if (profile.success || !profile.error) this.profile = profile.data || profile.profile || profile;
        if (!tasks.error) this.tasks = tasks.data || tasks.tasks || tasks;

        // Map new backend stats format
        if (!apiStats.error && apiStats.stats) {
            this.stats.users = apiStats.stats.total_pengadil || 0;
            this.stats.matches = apiStats.stats.matches_this_month || 0;
            this.stats.verifyRate = apiStats.stats.pending_reports || 0;
            this.applicationYear = apiStats.stats.year || this.applicationYear;
            const byType = apiStats.stats.applications_by_type || {};
            this.applicationCards = this.applicationCards.map(card => ({ ...card,
              total: byType[card.key]?.total || 0,
              pending: byType[card.key]?.pending || 0,
              approved: byType[card.key]?.approved || 0,
            }));
        }

        if (!announcements.error) this.announcements = announcements.data || announcements.announcements || [];

        if (!recentApplications.error) {
          const items = recentApplications.data || recentApplications.applications || [];
          this.recentApplications = Array.isArray(items) ? items : [];
          this.groupRecentApplications();
        }
      },
      error: () => { this.loading = false; },
    });
  }

  private groupRecentApplications(): void {
    this.applicationGroups = this.applicationCards.map(({ key, label, route, type }) => ({
      key, label, route, type,
      items: this.recentApplications.filter(app => app.application_category === key).slice(0, 3),
    }));
  }

  approveApplication(id: number): void {
    this.api.post<any>('admin-approve.php', { permohonan_id: id, action: 'approve' }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Permohonan diluluskan.');
          this.recentApplications = this.recentApplications.filter((a) => a.id !== id);
          this.groupRecentApplications();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  rejectApplication(id: number, name?: string): void {
    this.rejectTargetId = id;
    this.rejectTargetName = name || '';
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  confirmReject(): void {
    if (!this.rejectReason.trim()) {
      this.toast.error('Sebab penolakan diperlukan.');
      return;
    }
    this.api.post<any>('admin-approve.php', { permohonan_id: this.rejectTargetId, action: 'reject', notes: this.rejectReason.trim() }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Permohonan ditolak.');
          this.showRejectModal = false;
          this.recentApplications = this.recentApplications.filter((a) => a.id !== this.rejectTargetId);
          this.groupRecentApplications();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }
}
