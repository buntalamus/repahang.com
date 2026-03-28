import { Component, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnDestroy {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;
  announcements: any[] = [];
  currentAnnIndex = 0;
  private autoFlipInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private auth: AuthService,
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
  ) {
    this.checkMaintenance();
    this.loadAnnouncements();
  }

  ngOnDestroy(): void {
    if (this.autoFlipInterval) clearInterval(this.autoFlipInterval);
  }

  private checkMaintenance(): void {
    this.api.get<{ maintenance_mode: boolean; is_admin: boolean }>('check-maintenance.php').subscribe({
      next: (res) => {
        if (res.maintenance_mode && !res.is_admin) {
          this.router.navigate(['/maintenance']);
        }
      },
    });
  }

  private loadAnnouncements(): void {
    this.api.get<any>('public-announcements.php').subscribe({
      next: (res) => {
        if (!res.error) {
          this.announcements = res.data || [];
          if (this.announcements.length > 1) {
            this.autoFlipInterval = setInterval(() => this.nextAnn(), 2000);
          }
        }
      },
    });
  }

  get currentAnn(): any {
    return this.announcements[this.currentAnnIndex] || null;
  }

  nextAnn(): void {
    if (this.announcements.length > 1) {
      this.currentAnnIndex = (this.currentAnnIndex + 1) % this.announcements.length;
    }
  }

  prevAnn(): void {
    if (this.announcements.length > 1) {
      this.currentAnnIndex = (this.currentAnnIndex - 1 + this.announcements.length) % this.announcements.length;
    }
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.toast.warning('Sila masukkan emel dan kata laluan.');
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.error) {
          this.errorMessage = res.message || 'Gagal log masuk. Sila cuba lagi.';
          this.toast.error(this.errorMessage);
          return;
        }
        if (this.auth.currentUser?.password_changed === 0) {
          this.router.navigate(['/tukar-kata-laluan']);
        } else {
          this.router.navigate([this.auth.getRoleRoute()]);
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Tidak dapat menyambung ke pelayan.';
        this.toast.error(this.errorMessage);
      },
    });
  }
}
