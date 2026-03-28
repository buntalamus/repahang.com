import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-pp-applications',
  standalone: true,
  imports: [FormsModule, LoadingComponent, NgClass],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan permohonan..." />
    } @else {
      <!-- Header -->
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()"
          placeholder="Cari nama, IC..."
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm flex-1" />
        <select [(ngModel)]="statusFilter" (ngModelChange)="applyFilter()"
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="all">Semua Status</option>
          <option value="Menunggu PP Daerah">Menunggu</option>
          <option value="PP Daerah Disahkan">Disahkan</option>
          <option value="Ditolak">Ditolak</option>
        </select>
        @if (type === 'berdaftar') {
          <button (click)="downloadExcel()"
            class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
            Muat Turun Excel
          </button>
        }
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nama</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">No. KP</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Jenis</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tarikh</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Tindakan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (app of filtered; track app.id; let i = $index) {
              <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 text-slate-500">{{ i + 1 }}</td>
                <td class="px-6 py-4 font-medium text-slate-900">{{ app.nama_penuh }}</td>
                <td class="px-6 py-4 text-slate-600">{{ app.no_kp }}</td>
                <td class="px-6 py-4 text-slate-600">{{ app.jenis_permohonan || app.jenis_borang || '-' }}</td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    [ngClass]="{
                      'bg-amber-100 text-amber-800': app.status_workflow === 'Menunggu PP Daerah',
                      'bg-green-100 text-green-800': app.status_workflow === 'PP Daerah Disahkan' || app.status_workflow === 'Menunggu Admin' || app.status_workflow === 'Lengkap',
                      'bg-red-100 text-red-800': app.status_workflow === 'Ditolak'
                    }">
                    {{ app.status_workflow }}
                  </span>
                </td>
                <td class="px-6 py-4 text-slate-500">{{ app.tarikh_hantar || app.created_at }}</td>
                <td class="px-6 py-4 text-right">
                  @if (app.status_workflow === 'Menunggu PP Daerah') {
                    <button (click)="approveApplication(app)"
                      class="text-green-600 hover:text-green-800 text-xs font-medium mr-3">Sahkan</button>
                    <button (click)="openRejectModal(app)"
                      class="text-red-600 hover:text-red-800 text-xs font-medium">Tolak</button>
                  } @else {
                    <span class="text-xs text-slate-400">—</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="px-6 py-12 text-center text-slate-400">Tiada permohonan ditemui.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }

    <!-- Reject Modal -->
    @if (showRejectModal) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="showRejectModal = false">
        <div class="bg-white rounded-2xl max-w-lg w-full" (click)="$event.stopPropagation()">
          <div class="p-6 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">Tolak Permohonan</h3>
            <button (click)="showRejectModal = false" class="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div class="p-6 space-y-4">
            <p class="text-sm text-slate-600">Permohonan: <strong>{{ rejectTarget?.nama_penuh }}</strong></p>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Sebab Penolakan</label>
              <textarea [(ngModel)]="rejectNotes" rows="4"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Tulis sebab penolakan..."></textarea>
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button (click)="showRejectModal = false"
                class="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Batal</button>
              <button (click)="confirmReject()"
                class="px-4 py-2 text-sm bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">Tolak Permohonan</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class PpApplicationsComponent implements OnInit {
  loading = true;
  type = 'berdaftar';
  applications: any[] = [];
  filtered: any[] = [];
  searchQuery = '';
  statusFilter = 'all';
  showRejectModal = false;
  rejectTarget: any = null;
  rejectNotes = '';

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

  loadData(): void {
    this.loading = true;
    this.api.get<any>('pp-applications.php', { type: this.type }).subscribe({
      next: (res) => {
        this.applications = res.data || res.applications || [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  applyFilter(): void {
    let data = [...this.applications];
    if (this.statusFilter !== 'all') {
      data = data.filter((a) => a.status_workflow === this.statusFilter);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter((a) => (a.nama_penuh || '').toLowerCase().includes(q) || (a.no_kp || '').includes(q));
    }
    this.filtered = data;
  }

  approveApplication(app: any): void {
    if (!confirm(`Sahkan permohonan ${app.nama_penuh}?`)) return;
    this.api.post<any>('pp-verify.php', { permohonan_id: app.id, action: 'approve' }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Permohonan disahkan.');
          this.applications = this.applications.filter((a) => a.id !== app.id);
          this.applyFilter();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  openRejectModal(app: any): void {
    this.rejectTarget = app;
    this.rejectNotes = '';
    this.showRejectModal = true;
  }

  confirmReject(): void {
    if (!this.rejectNotes.trim()) {
      this.toast.error('Sebab penolakan diperlukan.');
      return;
    }
    this.api.post<any>('pp-verify.php', {
      permohonan_id: this.rejectTarget.id,
      action: 'reject',
      notes: this.rejectNotes.trim(),
    }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Permohonan ditolak.');
          this.showRejectModal = false;
          this.applications = this.applications.filter((a) => a.id !== this.rejectTarget.id);
          this.applyFilter();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  downloadExcel(): void {
    window.open(`${environment.apiUrl}/pp-export-referees.php?type=${this.type}`, '_blank');
  }
}
