import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-pengadil-application',
  standalone: true,
  imports: [FormsModule, LoadingComponent],
  templateUrl: './application.component.html',
})
export class PengadilApplicationComponent implements OnInit {
  loading = true;
  submitting = false;
  type = 'berdaftar';
  history: any[] = [];
  currentApp: any = null;
  appSettings: any = {};
  profile: any = {};

  form: any = { nama_waris: '', hubungan_waris: '', telefon_waris: '', saiz_baju: '' };
  declare1 = false;
  declare2 = false;
  declare3 = false;
  // Health declarations (for berdaftar/kecergasan bundled form)
  declareHealth1 = false; // Status kesihatan
  declareHealth2 = false; // Pemeriksaan perubatan
  declareHealth3 = false; // Risiko
  declareHealth4 = false; // Pelepasan tanggungan
  declareHealth5 = false; // Kebenaran rawatan
  selectedResit: File | null = null;
  selectedGambar: File | null = null;

  hubunganOptions = ['Ibu Bapa', 'Pasangan', 'Anak', 'Adik-beradik', 'Lain-lain'];
  saizBajuOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  typeLabels: Record<string, string> = {
    berdaftar:          'Pendaftaran Tahunan Pengadil (R1+R2)',
    pengadil_berdaftar: 'Pendaftaran Tahunan Pengadil (R1+R2)',
    kelas3:             'Peperiksaan Kelas III FAM',
    kelas3_fam:         'Peperiksaan Kelas III FAM',
    kelas1:             'Ujian Kelas I FAM',
    ujian_kelas1_fam:   'Ujian Kelas I FAM',
    penilai_berdaftar:  'Pendaftaran Tahunan Penilai Pengadil Negeri (R4)',
    pp_berdaftar:       'Pendaftaran Tahunan PP Daerah (R1)',
  };

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.type = data['type'] || 'berdaftar';
      this.loadData();
    });
  }

  get typeLabel(): string { return this.typeLabels[this.type] || this.type; }
  get applicationsOpen(): boolean {
    if (this.isBerdaftar || this.isPpBerdaftar) return this.appSettings.berdaftar_open === '1';
    if (this.isPenilai) return this.appSettings.penilai_open === '1';
    if (this.isKelas3)  return this.appSettings.kelas3_open  === '1';
    if (this.isKelas1)  return this.appSettings.kelas1_open  === '1';
    return false;
  }
  get applicationYear(): string { return this.appSettings.application_year || String(new Date().getFullYear()); }
  get paymentAmount(): string { return this.appSettings.payment_amount || '80.00'; }
  get bankName(): string { return this.appSettings.payment_bank_name || '-'; }
  get accountName(): string { return this.appSettings.payment_account_name || '-'; }
  get accountNo(): string { return this.appSettings.payment_account_no || '-'; }
  get isBerdaftar(): boolean { return this.type === 'berdaftar'; }
  get isKelas3(): boolean { return this.type === 'kelas3'; }
  get isKelas1(): boolean { return this.type === 'kelas1'; }
  get isPenilai(): boolean { return this.type === 'penilai_berdaftar'; }
  get isPpBerdaftar(): boolean { return this.type === 'pp_berdaftar'; }
  get isAnnualReg(): boolean { return this.isBerdaftar || this.isPenilai || this.isPpBerdaftar; }
  get needsPayment(): boolean { return this.isBerdaftar; }
  // FAM payment info
  get famBankName(): string { return this.appSettings.fam_bank_name || 'Bank Islam Persatuan Bolasepak Malaysia'; }
  get famAccountNo(): string { return this.appSettings.fam_account_no || '1213 1010 0061 21'; }
  get bertulisFee(): string { return this.appSettings.bertulis_fee || '50.00'; }
  get kelas1Fee(): string { return this.appSettings.kelas1_fee || '300.00'; }
  // FAM eligibility
  get bertulisMinAge(): number { return +(this.appSettings.bertulis_min_age || 15); }
  get bertulisMaxAge(): number { return +(this.appSettings.bertulis_max_age || 40); }
  get kelas1MaxAge(): number { return +(this.appSettings.kelas1_max_age || 32); }
  get kelas1MinFitnessRounds(): number { return +(this.appSettings.kelas1_min_fitness_rounds || 7); }
  get showForm(): boolean {
    if (!this.applicationsOpen) return false;
    return !this.currentApp;
  }

  loadData(): void {
    this.loading = true;
    forkJoin({
      history:  this.api.get<any>('pengadil-application-history.php', { type: this.type }),
      settings: this.api.get<any>('application-settings.php'),
      profile:  this.api.get<any>('get-user-profile.php'),
    }).subscribe({
      next: ({ history, settings, profile }) => {
        if (!history.error) {
          this.history = history.data || [];
          this.currentApp = this.history.find((a: any) =>
            ['Draf', 'Menunggu PP Daerah', 'PP Daerah Disahkan', 'Menunggu Admin',
             'Menunggu Bayaran', 'Pending'].includes(a.status_workflow || a.status),
          );
        }
        if (!settings.error) { this.appSettings = settings.settings || {}; }
        if (!profile.error)  { this.profile = profile.user || profile.data || {}; }
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  onResitSelected(e: Event): void {
    this.selectedResit = (e.target as HTMLInputElement).files?.[0] ?? null;
  }
  onGambarSelected(e: Event): void {
    this.selectedGambar = (e.target as HTMLInputElement).files?.[0] ?? null;
  }

  submit(): void {
    // Validate
    if (!this.form.nama_waris || !this.form.hubungan_waris || !this.form.telefon_waris) {
      this.toast.error('Sila lengkapkan maklumat waris.'); return;
    }
    if (this.isAnnualReg) {
      if (!this.form.saiz_baju) { this.toast.error('Sila pilih saiz baju rasmi.'); return; }
      if (!this.selectedResit) { this.toast.error('Sila muat naik resit bayaran.'); return; }
      if (!this.selectedGambar) { this.toast.error('Sila muat naik gambar profil.'); return; }
      if (!this.declare1 || !this.declare2 || !this.declare3) {
        this.toast.error('Sila tandakan semua perakuan am.'); return;
      }
      if (!this.declareHealth1 || !this.declareHealth2 || !this.declareHealth3 || !this.declareHealth4 || !this.declareHealth5) {
        this.toast.error('Sila tandakan semua perakuan kesihatan.'); return;
      }
    } else if (this.isKelas3 || this.isKelas1) {
      if (!this.selectedResit) { this.toast.error('Sila muat naik resit bayaran FAM.'); return; }
      if (!this.declare1 || !this.declare2) {
        this.toast.error('Sila tandakan semua perakuan.'); return;
      }
    } else {
      if (!this.declare1 || !this.declare2) {
        this.toast.error('Sila tandakan semua perakuan.'); return;
      }
    }

    this.submitting = true;
    const jenisBorangMap: Record<string, string> = {
      berdaftar:         'pengadil_berdaftar',
      kelas3:            'kelas3_fam',
      kelas1:            'ujian_kelas1_fam',
      penilai_berdaftar: 'penilai_berdaftar',
      pp_berdaftar:      'pp_berdaftar',
    };

    const fd = new FormData();
    fd.append('jenis_borang', jenisBorangMap[this.type] || this.type);
    Object.keys(this.form).forEach((k) => { if (this.form[k]) fd.append(k, this.form[k]); });
    if (this.selectedResit)  fd.append('resit',  this.selectedResit);
    if (this.selectedGambar) fd.append('gambar', this.selectedGambar);

    this.api.postFormData<any>('pengadil-application.php', fd).subscribe({
      next: (res) => {
        this.submitting = false;
        if (!res.error) {
          this.toast.success('Permohonan berjaya dihantar!');
          this.form = { nama_waris: '', hubungan_waris: '', telefon_waris: '', saiz_baju: '' };
          this.declare1 = this.declare2 = this.declare3 = false;
          this.declareHealth1 = this.declareHealth2 = this.declareHealth3 = this.declareHealth4 = this.declareHealth5 = false;
          this.selectedResit = this.selectedGambar = null;
          this.loadData();
        } else {
          this.toast.error(res.message || 'Gagal menghantar permohonan.');
        }
      },
      error: (err) => {
        this.submitting = false;
        const msg = err?.error?.message || 'Gagal menghantar permohonan.';
        this.toast.error(msg);
      },
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Lengkap': case 'Admin Diluluskan': case 'Bayaran Diterima': case 'Approved':
        return 'bg-green-100 text-green-700';
      case 'Ditolak': case 'Rejected':
        return 'bg-red-100 text-red-700';
      case 'Menunggu PP Daerah': case 'Menunggu Admin': case 'Menunggu Bayaran':
      case 'PP Daerah Disahkan': case 'Pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'Draf': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  downloadPdf(app: any): void {
    const t = app.jenis_borang || this.type;
    let endpoint = 'download-borang-pendaftaran.php';
    let typeParam = 'pengadil_berdaftar';
    switch (t) {
      case 'berdaftar': case 'pengadil_berdaftar':
        endpoint = 'download-borang-pendaftaran.php'; typeParam = 'pengadil_berdaftar'; break;
      case 'penilai_berdaftar':
        endpoint = 'download-borang-pendaftaran.php'; typeParam = 'penilai_berdaftar'; break;
      case 'pp_berdaftar':
        endpoint = 'download-borang-pendaftaran.php'; typeParam = 'pp_berdaftar'; break;
      case 'kelas3': case 'kelas3_fam':
        endpoint = 'download-borang-pendaftaran.php'; typeParam = 'kelas3_fam'; break;
      case 'kelas1': case 'ujian_kelas1': case 'ujian_kelas1_fam':
        endpoint = 'download-borang-pendaftaran.php'; typeParam = 'ujian_kelas1'; break;
    }
    window.open(`${environment.apiUrl}/${endpoint}?type=${typeParam}&application_id=${app.id}`, '_blank');
  }
}
