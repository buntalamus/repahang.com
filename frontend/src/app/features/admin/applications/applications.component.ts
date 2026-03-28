import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingComponent, PaginationComponent],
  templateUrl: './applications.component.html',
})
export class AdminApplicationsComponent implements OnInit {
  loading = true;
  applications: any[] = [];
  filtered: any[] = [];
  paged: any[] = [];
  activeTab = 'berdaftar';
  statusFilter = 'all';
  districtFilter = 'all';
  searchQuery = '';
  yearFilter = new Date().getFullYear().toString();
  currentPage = 1;
  pageSize = 10;

  // Expand row
  expandedId: number | null = null;

  // Reject modal
  showRejectModal = false;
  rejectTargetId = 0;
  rejectTargetName = '';
  rejectReason = '';

  // Approve modal
  showApproveModal = false;
  approveTargetId = 0;
  approveTargetName = '';
  approveNotes = '';

  // Delete modal
  showDeleteModal = false;
  deleteTargetId = 0;
  deleteTargetName = '';

  // Status change modal (for registration tabs)
  showStatusChangeModal = false;
  statusChangeApp: any = null;

  persatuanList: any[] = [];

  tabs = [
    { key: 'berdaftar', label: 'Pengadil Berdaftar' },
    { key: 'futsal', label: 'Pengadil Futsal' },
    { key: 'kecergasan', label: 'Ujian Kecergasan' },
    { key: 'bertulis', label: 'Ujian Kelas III FAM' },
    { key: 'kelas1', label: 'Ujian Kelas 1 FAM' },
  ];

  stats = { total: 0, pending: 0, approved: 0, rejected: 0 };

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadApplications();
    this.api.get<any>('admin-users.php').subscribe({
      next: (res) => { this.persatuanList = res.persatuan || []; },
    });
  }

  loadApplications(): void {
    this.loading = true;
    this.api.get<any>('admin-applications.php', {
      type: this.activeTab,
      status: this.statusFilter,
      year: this.yearFilter,
    }).subscribe({
      next: (res) => {
        this.applications = res.data || res.applications || [];
        this.updateStats();
        this.applyFilter();
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    this.statusFilter = 'all';
    this.loadApplications();
  }

  getUjianDisplayStatus(app: any): string {
    return app.status_ujian || 'Menunggu';
  }

  applyFilter(): void {
    let data = [...this.applications];
    if (this.statusFilter !== 'all') {
      if (this.isUjianTab) {
        data = data.filter((a) => this.getUjianDisplayStatus(a) === this.statusFilter);
      } else {
        data = data.filter((a) => this.getDisplayStatus(a) === this.statusFilter);
      }
    }
    if (this.districtFilter !== 'all') {
      data = data.filter((a) => (a.district_nama || '').includes(this.districtFilter));
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter((a) =>
        (a.nama_penuh || '').toLowerCase().includes(q) ||
        (a.no_kp || '').includes(q) ||
        (a.email || a.emel || '').toLowerCase().includes(q) ||
        (a.daerah || '').toLowerCase().includes(q) ||
        (a.district_nama || '').toLowerCase().includes(q)
      );
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

  getGlobalIndex(i: number): number {
    return (this.currentPage - 1) * this.pageSize + i + 1;
  }

  private updateStats(): void {
    this.stats.total = this.applications.length;
    if (this.isUjianTab) {
      this.stats.pending = this.applications.filter((a) => !a.status_ujian).length;
      this.stats.approved = this.applications.filter((a) => a.status_ujian === 'Lulus').length;
      this.stats.rejected = this.applications.filter((a) => a.status_ujian === 'Tidak Lulus' || a.status_ujian === 'Tidak Hadir').length;
    } else {
      this.stats.pending = this.applications.filter((a) => this.getDisplayStatus(a) === 'Menunggu').length;
      this.stats.approved = this.applications.filter((a) => this.getDisplayStatus(a) === 'Diluluskan').length;
      this.stats.rejected = this.applications.filter((a) => this.getDisplayStatus(a) === 'Ditolak').length;
    }
  }

  getDisplayStatus(app: any): string {
    const s = app.status || '';
    if (s === 'Menunggu Admin' || s === 'Menunggu PP Daerah' || s === 'Pembayaran' || s === 'Draf') {
      return 'Menunggu';
    }
    if (s === 'Lengkap' || s === 'Admin Diluluskan' || s === 'Approved') {
      return 'Diluluskan';
    }
    if (s === 'Ditolak' || s === 'Rejected') {
      return 'Ditolak';
    }
    return s || 'Menunggu';
  }

  approve(app: any): void {
    this.approveTargetId = app.permohonan_id || app.id;
    this.approveTargetName = app.nama_penuh || '';
    this.approveNotes = '';
    this.showApproveModal = true;
  }

  confirmApprove(): void {
    this.api.post<any>('admin-approve.php', {
      permohonan_id: this.approveTargetId,
      action: 'approve',
      notes: this.approveNotes || '',
    }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Permohonan diluluskan.');
          this.showApproveModal = false;
          this.loadApplications();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  cancelApprove(): void {
    this.showApproveModal = false;
    this.approveNotes = '';
  }

  toggleExpand(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  reject(app: any): void {
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
    this.api.post<any>('admin-approve.php', {
      permohonan_id: this.rejectTargetId,
      action: 'reject',
      notes: this.rejectReason,
    }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Permohonan ditolak.');
          this.showRejectModal = false;
          this.loadApplications();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  cancelReject(): void {
    this.showRejectModal = false;
    this.rejectReason = '';
  }

  // Status Ujian (for kecergasan/bertulis tabs)
  showStatusUjianModal = false;
  statusUjianAppId = 0;

  get isUjianTab(): boolean {
    return this.activeTab === 'kecergasan' || this.activeTab === 'bertulis' || this.activeTab === 'kelas1';
  }

  openStatusUjian(appId: number): void {
    this.statusUjianAppId = appId;
    this.showStatusUjianModal = true;
  }

  closeStatusUjian(): void {
    this.showStatusUjianModal = false;
    this.statusUjianAppId = 0;
  }

  selectStatusUjian(status: string): void {
    const appId = this.statusUjianAppId;
    this.closeStatusUjian();
    this.api.post<any>('admin-applications.php', {
      action: 'update_status_ujian',
      id: appId,
      status_ujian: status,
    }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success(`Status ujian dikemaskini: ${status}`);
          this.loadApplications();
        } else {
          this.toast.error(res.message);
        }
      },
      error: () => this.toast.error('Gagal mengemaskini status ujian.'),
    });
  }

  openStatusChange(app: any): void {
    this.statusChangeApp = app;
    this.showStatusChangeModal = true;
  }

  selectStatusLulus(): void {
    this.showStatusChangeModal = false;
    if (this.statusChangeApp) {
      this.approve(this.statusChangeApp);
    }
  }

  selectStatusTolak(): void {
    this.showStatusChangeModal = false;
    if (this.statusChangeApp) {
      this.reject(this.statusChangeApp);
    }
  }

  closeStatusChange(): void {
    this.showStatusChangeModal = false;
    this.statusChangeApp = null;
  }

  deleteApplication(app: any): void {
    this.deleteTargetId = app.id;
    this.deleteTargetName = app.nama;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    this.api.post<any>('admin-applications.php', {
      action: 'delete_application',
      id: this.deleteTargetId,
    }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Permohonan berjaya dipadam.');
          this.showDeleteModal = false;
          this.loadApplications();
        } else {
          this.toast.error(res.message);
        }
      },
      error: () => this.toast.error('Gagal memadam permohonan.'),
    });
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = 0;
    this.deleteTargetName = '';
  }

  downloadExcel(): void {
    window.open(`${environment.apiUrl}/download-referees-excel.php?type=${this.activeTab}&year=${this.yearFilter}`, '_blank');
  }
}
