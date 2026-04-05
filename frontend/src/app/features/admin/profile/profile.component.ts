import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ChangePasswordComponent } from '../../auth/change-password/change-password.component';
import { ImageCropComponent } from '../../../shared/components/image-crop/image-crop.component';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [FormsModule, LoadingComponent, ChangePasswordComponent, ImageCropComponent],
  templateUrl: './profile.component.html',
})
export class AdminProfileComponent implements OnInit {
  @ViewChild('imageCrop') imageCrop!: ImageCropComponent;

  loading = true;
  editing = false;
  saving = false;
  profile: any = {};
  profileImageUrl = '';

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.api.get<any>('get-user-profile.php').subscribe({
      next: (res) => {
        if (!res.error) {
          this.profile = res.data || res;
          if (this.profile.url_gambar_profil) {
            this.profileImageUrl = this.profile.url_gambar_profil;
          }
        }
        this.loading = false;
      },
      error: () => (this.loading = false),
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
      error: (err: any) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Gagal mengemaskini profil.');
      },
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.imageCrop.loadImage(input.files[0]);
    input.value = '';
  }

  onImageCropped(blob: Blob): void {
    const fd = new FormData();
    fd.append('image', blob, 'profile.jpg');
    this.api.postFormData<any>('upload-profile-image.php', fd).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Gambar profil dikemaskini.');
          this.profileImageUrl = res.data?.url || res.url || '';
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }
}
