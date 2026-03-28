import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [FormsModule, LoadingComponent, PaginationComponent],
  templateUrl: './reports.component.html',
})
export class AdminReportsComponent implements OnInit {
  loading = true;
  applications: any[] = [];
  filtered: any[] = [];
  paged: any[] = [];
  statusFilter = 'Menunggu Admin';
  searchQuery = '';
  currentPage = 1;
  pageSize = 10;

  // Reject modal
  showRejectModal = false;
  rejectTargetId = 0;
  rejectTargetName = '';
  rejectReason = '';

  stats = { total: 0, approved: 0, pending: 0, rejected: 0 };

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadApplications();
  }

  loadApplications(): void {
    this.loading = true;
    this.api.get<any>('admin-applications.php', { status: this.statusFilter === 'all' ? 'all' : this.statusFilter }).subscribe({
      next: (res) => {
        this.applications = res.data || res.applications || [];
        this.updateStats();
        this.applyFilter();
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  updateStats(): void {
    this.stats.total = this.applications.length;
    this.stats.approved = this.applications.filter((a) => a.status === 'Lengkap' || a.status === 'Admin Diluluskan').length;
    this.stats.pending = this.applications.filter((a) => a.status === 'Menunggu Admin' || a.status === 'Menunggu PP Daerah').length;
    this.stats.rejected = this.applications.filter((a) => a.status === 'Ditolak').length;
  }

  applyFilter(): void {
    let data = [...this.applications];
    if (this.statusFilter !== 'all') {
      data = data.filter((a) => a.status === this.statusFilter);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter((a) => (a.nama_penuh || '').toLowerCase().includes(q) || (a.no_kp || '').includes(q));
    }
    this.filtered = data;
    this.currentPage = 1;
    this.updatePaged();
  }

  updatePaged(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paged = this.filtered.slice(start, start + this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePaged();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.updatePaged();
  }

  approve(id: number): void {
    this.api.post<any>('admin-approve.php', { permohonan_id: id, action: 'approve' }).subscribe({
      next: (res) => {
        if (!res.error) { this.toast.success('Permohonan diluluskan.'); this.loadApplications(); }
        else this.toast.error(res.message);
      },
    });
  }

  openReject(app: any): void {
    this.rejectTargetId = app.permohonan_id || app.id;
    this.rejectTargetName = app.nama_penuh || '';
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  confirmReject(): void {
    if (!this.rejectReason.trim()) {
      this.toast.error('Sila masukkan sebab penolakan.');
      return;
    }
    this.api.post<any>('admin-approve.php', { permohonan_id: this.rejectTargetId, action: 'reject', notes: this.rejectReason }).subscribe({
      next: (res) => {
        if (!res.error) { this.toast.success('Permohonan ditolak.'); this.showRejectModal = false; this.loadApplications(); }
        else this.toast.error(res.message);
      },
    });
  }

  cancelReject(): void {
    this.showRejectModal = false;
    this.rejectReason = '';
  }

  getProfileImage(app: any): string {
    if (app.url_gambar_profil) {
      if (app.url_gambar_profil.startsWith('http')) return app.url_gambar_profil;
      return app.url_gambar_profil.startsWith('/') ? app.url_gambar_profil : '/' + app.url_gambar_profil;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(app.nama_penuh || 'U')}&background=FADA00&color=000000&size=128`;
  }

  getReceiptUrl(app: any): string | null {
    if (!app.url_resit) return null;
    if (app.url_resit.startsWith('http')) return app.url_resit;
    return app.url_resit.startsWith('/') ? app.url_resit : '/' + app.url_resit;
  }

  formatAddress(app: any): string {
    return [app.alamat, app.poskod, app.bandar, app.negeri].filter(Boolean).join(', ') || '-';
  }

  downloadForm(id: number): void {
    window.open(`${environment.apiUrl}/download-borang-pendaftaran.php?id=${id}`, '_blank');
  }
}
