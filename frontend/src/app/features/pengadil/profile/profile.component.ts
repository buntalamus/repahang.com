import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ChangePasswordComponent } from '../../auth/change-password/change-password.component';

@Component({
  selector: 'app-pengadil-profile',
  standalone: true,
  imports: [FormsModule, LoadingComponent, ChangePasswordComponent],
  templateUrl: './profile.component.html',
})
export class PengadilProfileComponent implements OnInit {
  loading = true;
  editing = false;
  saving = false;
  profile: any = {};
  profileImageUrl = '';
  notifications: any[] = [];
  unreadCount = 0;
  generatingTgLink = false;

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadNotifications();
  }

  loadProfile(): void {
    this.api.get<any>('get-user-profile.php').subscribe({
      next: (res) => {
        if (!res.error) {
          this.profile = res.data || res;
          this.profileImageUrl = this.profile.url_gambar_profil || '';
        }
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  loadNotifications(): void {
    this.api.get<any>('notifications.php').subscribe({
      next: (res) => {
        if (!res.error) {
          this.notifications = res.data || [];
          this.unreadCount = this.notifications.filter((n: any) => !n.read).length;
        }
      },
    });
  }

  toggleEdit(): void {
    this.editing = !this.editing;
  }

  saveProfile(): void {
    this.saving = true;
    this.api.post<any>('update-profile.php', this.profile).subscribe({
      next: (res) => {
        this.saving = false;
        if (!res.error) {
          this.toast.success('Profil dikemaskini.');
          this.editing = false;
        } else {
          this.toast.error(res.message);
        }
      },
      error: () => {
        this.saving = false;
        this.toast.error('Gagal mengemaskini profil.');
      },
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const fd = new FormData();
    fd.append('image', input.files[0]);
    this.api.postFormData<any>('upload-profile-image.php', fd).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Gambar dikemaskini.');
          this.profileImageUrl = res.data?.url || '';
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  generateTelegramLink(): void {
    this.generatingTgLink = true;
    this.api.post<any>('telegram-link-self.php', {}).subscribe({
      next: (res) => {
        this.generatingTgLink = false;
        if (!res.error && res.link_url) {
          window.open(res.link_url, '_blank');
        } else if (res.linked) {
          this.profile.telegram_chat_id = 'linked';
          this.toast.success('Telegram telah dihubungkan.');
        } else {
          this.toast.error(res.message || 'Gagal menjana pautan.');
        }
      },
      error: () => {
        this.generatingTgLink = false;
        this.toast.error('Gagal menyambung ke pelayan.');
      },
    });
  }
}
