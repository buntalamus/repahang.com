import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
  form: any = {};
  selectedFile: File | null = null;

  typeLabels: Record<string, string> = {
    pengadil_berdaftar: 'Borang Pendaftaran Pengadil',
    pengadil_futsal: 'Borang Pengadil Futsal',
    ujian_kecergasan: 'Ujian Kecergasan',
    ujian_bertulis: 'Ujian Kelas III FAM',
    ujian_kelas1_fam: 'Ujian Kelas 1 FAM',
  };

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.type = data['type'] || 'berdaftar';
      this.loadHistory();
    });
  }

  get typeLabel(): string {
    return this.typeLabels[this.type] || this.type;
  }

  loadHistory(): void {
    this.loading = true;
    this.api
      .get<any>('pengadil-application-history.php', { type: this.type })
      .subscribe({
        next: (res) => {
          if (!res.error) {
            this.history = res.data || [];
            this.currentApp = this.history.find(
              (a: any) =>
                a.status_workflow === 'Draf' ||
                a.status_workflow === 'Menunggu PP Daerah' ||
                a.status_workflow === 'PP Daerah Disahkan' ||
                a.status_workflow === 'Menunggu Admin' ||
                a.status_workflow === 'Menunggu Bayaran' ||
                a.status === 'Pending',
            );
          }
          this.loading = false;
        },
        error: () => (this.loading = false),
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  submit(): void {
    this.submitting = true;
    const fd = new FormData();
    fd.append('type', this.type);
    if (this.selectedFile) {
      fd.append('dokumen', this.selectedFile);
    }
    Object.keys(this.form).forEach((k) => fd.append(k, this.form[k]));

    this.api.postFormData<any>('pengadil-application.php', fd).subscribe({
      next: (res) => {
        this.submitting = false;
        if (!res.error) {
          this.toast.success('Permohonan dihantar.');
          this.loadHistory();
          this.form = {};
          this.selectedFile = null;
        } else {
          this.toast.error(res.message);
        }
      },
      error: () => {
        this.submitting = false;
        this.toast.error('Gagal menghantar permohonan.');
      },
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Lengkap':
      case 'Admin Diluluskan':
      case 'Bayaran Diterima':
      case 'Approved':
        return 'bg-green-100 text-green-700';
      case 'Ditolak':
      case 'Rejected':
        return 'bg-red-100 text-red-700';
      case 'Menunggu PP Daerah':
      case 'Menunggu Admin':
      case 'Menunggu Bayaran':
      case 'PP Daerah Disahkan':
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'Draf':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  downloadPdf(app: any): void {
    const endpoints: Record<string, string> = {
      berdaftar: 'download-borang-pendaftaran.php',
      pengadil_berdaftar: 'download-borang-pendaftaran.php',
      futsal: 'download-borang-futsal.php',
      pengadil_futsal: 'download-borang-futsal.php',
      kecergasan: 'download-borang-ujian-kecergasan.php',
      ujian_kecergasan: 'download-borang-ujian-kecergasan.php',
    };
    const endpoint = endpoints[app.jenis_borang] || endpoints[this.type] || 'download-borang-pendaftaran.php';
    const url = `${environment.apiUrl}/${endpoint}?id=${app.permohonan_id || app.id}`;
    window.open(url, '_blank');
  }
}
