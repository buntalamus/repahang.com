import { ProfileFieldsComponent } from '../../../shared/components/profile-fields/profile-fields.component';
import { TelegramProfileComponent } from '../../../shared/components/telegram-profile/telegram-profile.component';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ChangePasswordComponent } from '../../auth/change-password/change-password.component';
import { ImageCropComponent } from '../../../shared/components/image-crop/image-crop.component';

@Component({
  selector: 'app-admin-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProfileFieldsComponent, TelegramProfileComponent, FormsModule, LoadingComponent, ChangePasswordComponent, ImageCropComponent],
  templateUrl: './profile.component.html',
})
export class AdminProfileComponent implements OnInit {
  @ViewChild('imageCrop') imageCrop!: ImageCropComponent;

  loading = true;
  editing = false;
  saving = false;
  profile: any = {};
  draft: any = {};
  associations: { id: number; nama_persatuan: string }[] = [];
  private readonly cdr = inject(ChangeDetectorRef);
  profileImageUrl = '';

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.api.get<{data:{id:number;nama_persatuan:string}[]}>('public-persatuan.php').subscribe({next:res=>{this.associations=res.data||[];this.cdr.markForCheck();}});
  }

  loadProfile(): void {
    this.api.get<any>('get-user-profile.php').subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        if (!res.error) {
          this.profile = res.user || res.data || res;
          if (this.profile.url_gambar_profil) {
            this.profileImageUrl = this.profile.url_gambar_profil;
          }
        }
        this.loading = false;
      },
      error: () => {this.loading = false; this.cdr.markForCheck();},
    });
  }

  toggleEdit(): void {
    this.editing = !this.editing;
    this.draft = this.editing ? structuredClone(this.profile) : {};
  }

  saveProfile(): void {
    this.saving = true;
    this.api.post<any>('update-profile.php', this.draft).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.saving = false;
        if (!res.error) {
          this.toast.success('Profil dikemaskini.');
          this.editing = false;
          this.loadProfile();
        } else {
          this.toast.error(res.message);
        }
      },
      error: (err: any) => {
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
        if (!res.error) {
          this.toast.success('Gambar profil dikemaskini.');
          this.profileImageUrl = res.data?.url || res.url || '';
          this.profile.url_gambar_profil = this.profileImageUrl;
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

}
