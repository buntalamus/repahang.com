import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiResponse } from '../../../core/models/user.model';

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

  errors: Record<string, string> = {};
  loading = false;
  checkingStatus = true;
  registrationClosed = false;
  showModal = false;
  modalSuccess = false;
  modalTitle = '';
  modalMessage = '';
  telegramLink = '';

  persatuanList: { value: number; label: string }[] = [];

  jenisPengadilList = [
    'Pengadil Kebangsaan',
    'Pengadil Negeri',
    'Penilai Pengadil',
    'Pegawai Pembangunan',
  ];

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
    return Object.keys(this.errors).length === 0;
  }

  onSubmit(): void {
    if (!this.validate()) return;
    this.loading = true;

    this.api.post<ApiResponse>('register.php', this.form).subscribe({
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
