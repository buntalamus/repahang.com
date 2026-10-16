import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiResponse } from '../../../core/models/user.model';
import { compressProfileImage, MAX_PROFILE_IMAGE_BYTES } from '../../../shared/utils/profile-image';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  form = {
    nama_penuh: '',
    no_ic: '',
    email: '',
    no_telefon: '',
    jantina: '',
    jenis_pengadil: '',
    persatuan_id: '',
    pengesahan_data: false,
  };
  profile: Record<string, string> = {
    alamat1: '', alamat2: '', poskod: '', daerah: '', negeri: 'Pahang',
    status_kerja: '', jawatan: '', nama_majikan: '', alamat_majikan1: '',
    alamat_majikan2: '', poskod_majikan: '', daerah_majikan: '', negeri_majikan: '',
    nama_waris: '', hubungan_waris: '', telefon_waris: '',
    saiz_baju: '', tahun_mula_aktif: '',
  };
  picture: File | null = null;
  optimizingPicture = false;
  pictureSizeKb = 0;
  addressFields = [
    { key: 'alamat1', label: 'Alamat Kediaman', required: true },
    { key: 'alamat2', label: 'Alamat 2', required: false },
    { key: 'poskod', label: 'Poskod', required: true },
    { key: 'daerah', label: 'Daerah', required: true },
    { key: 'negeri', label: 'Negeri', required: true },
  ];
  employerFields = [
    { key: 'jawatan', label: 'Jawatan' },
    { key: 'nama_majikan', label: 'Nama Majikan / Institusi' },
    { key: 'alamat_majikan1', label: 'Alamat Majikan' },
    { key: 'alamat_majikan2', label: 'Alamat Majikan 2', optional: true },
    { key: 'poskod_majikan', label: 'Poskod Majikan' },
    { key: 'daerah_majikan', label: 'Daerah Majikan' },
    { key: 'negeri_majikan', label: 'Negeri Majikan' },
  ];

  errors: Record<string, string> = {};
  loading = false;
  checkingStatus = true;
  registrationClosed = false;
  registrationMessage = '';
  showModal = false;
  modalSuccess = false;
  modalTitle = '';
  modalMessage = '';
  telegramLink = '';

  persatuanList: { value: number; label: string }[] = [];

  jenisPengadilList = [
    'Pengadil Baharu',
    'Pengadil Kebangsaan',
    'Pengadil Negeri',
  ];
  get isReferee(): boolean {
    return this.form.jenis_pengadil !== 'Penilai Pengadil' &&
      this.form.jenis_pengadil !== 'Pegawai Pembangunan';
  }
  get needsEmployer(): boolean {
    const status = this.profile['status_kerja'].trim().toUpperCase();
    return !!status && !['PELAJAR', 'TIDAK BEKERJA', 'PESARA'].includes(status);
  }

  async onPictureSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.picture = null;
    this.pictureSizeKb = 0;
    delete this.errors['gambar_profil'];
    if (!file) return;
    this.optimizingPicture = true;
    try {
      this.picture = await compressProfileImage(file);
      this.pictureSizeKb = Math.ceil(this.picture.size / 1024);
    } catch (error) {
      this.errors['gambar_profil'] = error instanceof Error ? error.message : 'Gambar tidak dapat diproses.';
    } finally {
      this.optimizingPicture = false;
    }
  }

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
  ) {
    this.checkRegistrationStatus();
    this.loadPersatuan();
  }

  private checkRegistrationStatus(): void {
    this.checkingStatus = true;
    this.api.get<any>('registration-status.php').subscribe({
      next: (res) => {
        this.checkingStatus = false;
        if (!res.error) {
          this.registrationClosed = !res.registration_open;
          this.registrationMessage = res.registration_message || '';
        }
      },
      error: () => {
        this.checkingStatus = false;
      },
    });
  }

  private loadPersatuan(): void {
    this.api.get<any>('public-persatuan.php').subscribe({
      next: (res) => {
        if (!res.error && res.data) {
          this.persatuanList = res.data.map((p: any) => ({
            value: p.id,
            label: `${p.nama_persatuan} (${p.kod_persatuan})`,
          }));
        }
      },
    });
  }

  validate(): boolean {
    this.errors = {};
    if (!this.form.nama_penuh.trim()) this.errors['nama_penuh'] = 'Nama penuh diperlukan.';
    if (!/^\d{12}$/.test(this.form.no_ic)) this.errors['no_ic'] = 'No. KP mestilah 12 digit.';
    if (!this.form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) this.errors['email'] = 'Emel tidak sah.';
    if (!this.form.no_telefon.trim()) this.errors['no_telefon'] = 'No. telefon diperlukan.';
    if (!this.form.jantina) this.errors['jantina'] = 'Sila pilih jantina.';
    if (!this.form.jenis_pengadil) this.errors['jenis_pengadil'] = 'Sila pilih jenis pengadil.';
    if (!this.form.persatuan_id) this.errors['persatuan_id'] = 'Sila pilih persatuan.';
    if (!this.form.pengesahan_data) this.errors['pengesahan'] = 'Sila tandakan pengesahan.';
    for (const field of this.addressFields) {
      if (field.required && !this.profile[field.key].trim()) this.errors[field.key] = `${field.label} diperlukan.`;
    }
    if (!/^\d{5}$/.test(this.profile['poskod'])) this.errors['poskod'] = 'Poskod mestilah 5 digit.';
    if (!this.profile['status_kerja'].trim()) this.errors['status_kerja'] = 'Sila pilih status pekerjaan.';
    if (this.needsEmployer) {
      for (const field of this.employerFields) {
        if (!field.optional && !this.profile[field.key].trim()) this.errors[field.key] = `${field.label} diperlukan.`;
      }
    }
    for (const key of ['nama_waris', 'hubungan_waris']) {
      if (!this.profile[key].trim()) this.errors[key] = 'Maklumat waris diperlukan.';
    }
    if (!/^\d{10,11}$/.test(this.profile['telefon_waris'])) this.errors['telefon_waris'] = 'No. telefon waris mestilah 10 atau 11 digit.';
    if (this.isReferee) {
      if (!this.profile['saiz_baju']) this.errors['saiz_baju'] = 'Sila pilih saiz baju.';
      const year = Number(this.profile['tahun_mula_aktif']);
      if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear()) {
        this.errors['tahun_mula_aktif'] = 'Tahun mula aktif tidak sah.';
      }
    }
    if (!this.picture || this.picture.type !== 'image/jpeg' ||
        this.picture.size < 1 || this.picture.size > MAX_PROFILE_IMAGE_BYTES) {
      this.errors['gambar_profil'] = 'Gambar JPG/PNG diperlukan dan perlu dikecilkan semula.';
    }
    if (Object.keys(this.errors).length) {
      this.errors['summary'] = 'Sila lengkapkan semua medan bertanda merah sebelum mendaftar.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    return true;
  }

  onSubmit(): void {
    if (this.optimizingPicture) return;
    if (!this.validate()) return;
    this.loading = true;

    const data = new FormData();
    for (const [key, value] of Object.entries({ ...this.form, ...this.profile })) {
      data.set(key, String(value));
    }
    data.set('gambar_profil', this.picture!);
    this.api.postFormData<ApiResponse>('register.php', data).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.error) {
          this.modalSuccess = false;
          this.modalTitle = 'Pendaftaran Gagal';
          this.modalMessage = res.message;
          this.telegramLink = '';
        } else {
          this.modalSuccess = true;
          this.modalTitle = 'Pendaftaran Berjaya!';
          this.modalMessage = res.message || 'Sila semak emel anda untuk mendapatkan kata laluan.';
          this.telegramLink = (res as any).telegram_link || '';
        }
        this.showModal = true;
      },
      error: (err: any) => {
        this.loading = false;
        this.toast.error(err?.error?.message || 'Tidak dapat menyambung ke pelayan.');
      },
    });
  }

  closeModal(): void {
    this.showModal = false;
    if (this.modalSuccess) {
      this.router.navigate(['/login']);
    }
  }
}
