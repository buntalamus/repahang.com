import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { catchError, finalize, forkJoin, of, timeout } from 'rxjs';

@Component({
  selector: 'app-pengadil-dashboard',
  standalone: true,
  imports: [RouterLink, LoadingComponent],
  templateUrl: './dashboard.component.html',
})
export class PengadilDashboardComponent implements OnInit {
  loading = true;
  profile: any = {};
  matchStats = { total: 0, verified: 0, year: new Date().getFullYear(), eligible: false };
  notifications: any[] = [];
  unreadCount = 0;
  recentMatches: any[] = [];
  announcements: any[] = [];
  pendingLantikan = 0;

  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  private loadDashboard(): void {
    const T = 10000;
    forkJoin({
      profile: this.api.get<any>('get-user-profile.php').pipe(timeout(T), catchError(() => of({ error: true }))),
      matches: this.api.get<any>('pengadil-matches.php').pipe(timeout(T), catchError(() => of({ error: true }))),
      notifications: this.api.get<any>('notifications.php').pipe(timeout(T), catchError(() => of({ error: true, data: [] }))),
      announcements: this.api.get<any>('announcements.php').pipe(timeout(T), catchError(() => of({ error: true, data: [] }))),
      tugasan: this.api.get<any>('tugasan.php').pipe(timeout(T), catchError(() => of({ error: true }))),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ profile, matches, notifications, announcements, tugasan }) => {
          if (!profile.error) {
            this.profile = profile.data || profile.profile || profile;
          }
          if (!matches.error) {
            const list = matches.data || matches.matches || [];
            this.recentMatches = list.slice(0, 5);
            const stats = matches.statistics || {};
            this.matchStats.total = stats.current_year || list.length;
            this.matchStats.verified = stats.verified_year || list.filter((m: any) => m.status_pp === 'Disahkan').length;
            this.matchStats.year = stats.year || new Date().getFullYear();
            this.matchStats.eligible = stats.eligible || false;
          }
          if (!notifications.error) {
            this.notifications = (notifications.data || notifications.notifications || []).slice(0, 5);
            this.unreadCount = notifications.unread_count || 0;
          }
          if (!announcements.error) {
            this.announcements = (announcements.data || announcements.announcements || []).slice(0, 5);
          }
          if (!tugasan.error) {
            const list = tugasan.data || tugasan.tugasan || [];
            this.pendingLantikan = Array.isArray(list) ? list.filter((t: any) => t.status === 'Belum Jawab').length : 0;
          }
        },
      });
  }
}
