import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-pp-applications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LoadingComponent, SlicePipe],
  template: `
    @if (loading()) {
      <app-loading message="Memuatkan permohonan..." />
    } @else {
      <!-- Toolbar -->
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <input type="text" [ngModel]="search()" (ngModelChange)="search.set($event)"
          placeholder="Cari nama, IC..."
          class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm" />
        <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)"
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="all">Semua Status</option>
          <option value="menunggu">Menunggu Pengesahan</option>
          <option value="disahkan">Telah Disahkan</option>
          <option value="Ditolak">Ditolak</option>
        </select>
        @if (type === 'pengadil') {
          <button (click)="downloadExcel()"
            class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
            Muat Turun Excel
          </button>
        }
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">No. KP</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarikh</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              @if (isUjianType) {
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Keputusan Ujian</th>
              }
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Tindakan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (app of filtered(); track app.id; let i = $index) {
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-400 text-xs">{{ i + 1 }}</td>
                <td class="px-4 py-3 font-medium text-slate-900">{{ app.nama_penuh }}</td>
                <td class="px-4 py-3 text-slate-500 font-mono text-xs">{{ app.no_kp }}</td>
                <td class="px-4 py-3 text-slate-500 text-xs">{{ app.tarikh_hantar | slice:0:10 }}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    [class]="statusClass(app.status_workflow)">
                    {{ statusLabel(app.status_workflow) }}
                  </span>
                </td>
                @if (isUjianType) {
                  <td class="px-4 py-3">
                    @if (app.status_ujian) {
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        [class]="ujianClass(app.status_ujian)">
                        {{ app.status_ujian }}
                      </span>
                    } @else {
                      <span class="text-xs text-slate-400">Belum ditetapkan</span>
                    }
                  </td>
                }
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    @if (app.status_workflow === 'Menunggu PP Daerah') {
                      <button (click)="approve(app)"
                        class="px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition">
                        Sahkan
                      </button>
                      <button (click)="openReject(app)"
                        class="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition">
                        Tolak
                      </button>
                    }
                    @if (app.status_workflow !== 'Menunggu PP Daerah') {
                      <span class="text-xs text-slate-300">—</span>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="isUjianType ? 7 : 6" class="px-6 py-12 text-center text-slate-400 text-sm">
                  Tiada rekod ditemui.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <!-- Modal: Tolak -->
    @if (showRejectModal()) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        (click)="showRejectModal.set(false)">
        <div class="bg-white rounded-2xl max-w-lg w-full shadow-xl" (click)="$event.stopPropagation()">
          <div class="p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-base font-semibold text-slate-900">Tolak Permohonan</h3>
            <button (click)="showRejectModal.set(false)" class="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div class="p-5 space-y-4">
            <p class="text-sm text-slate-600">Permohonan: <strong>{{ rejectTarget()?.nama_penuh }}</strong></p>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Sebab Penolakan</label>
              <textarea [ngModel]="rejectNotes()" (ngModelChange)="rejectNotes.set($event)" rows="3"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                placeholder="Tulis sebab penolakan..."></textarea>
            </div>
            <div class="flex justify-end gap-3">
              <button (click)="showRejectModal.set(false)"
                class="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Batal</button>
              <button (click)="confirmReject()"
                class="px-4 py-2 text-sm bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">Tolak</button>
            </div>
          </div>
        </div>
      </div>
    }

  `,
})
export class PpApplicationsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  type = 'pengesahan';

  loading = signal(true);
  applications = signal<any[]>([]);
  search = signal('');
  statusFilter = signal('all');

  showRejectModal = signal(false);
  rejectTarget = signal<any>(null);
  rejectNotes = signal('');

  readonly disahkanStatuses = ['PP Daerah Disahkan', 'Menunggu Admin', 'Admin Diluluskan', 'Lengkap'];

  get isUjianType(): boolean {
    return this.type === 'kelas3' || this.type === 'kelas1';
  }

  filtered = computed(() => {
    let data = this.applications();
    const q = this.search().toLowerCase();
    const sf = this.statusFilter();

    if (sf === 'menunggu') {
      data = data.filter(a => a.status_workflow === 'Menunggu PP Daerah');
    } else if (sf === 'disahkan') {
      data = data.filter(a => this.disahkanStatuses.includes(a.status_workflow));
    } else if (sf === 'Ditolak') {
      data = data.filter(a => a.status_workflow === 'Ditolak');
    }

    if (q) {
      data = data.filter(a =>
        (a.nama_penuh ?? '').toLowerCase().includes(q) ||
        (a.no_kp ?? '').includes(q)
      );
    }
    return data;
  });

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.type = data['type'] || 'pengesahan';
      this.loadData();
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.api.get<any>('pp-applications.php', { type: this.type }).subscribe({
      next: res => {
        this.applications.set(res.applications || res.data || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  approve(app: any): void {
    if (!confirm(`Sahkan permohonan ${app.nama_penuh}?`)) return;
    this.api.post<any>('pp-verify.php', { permohonan_id: app.id, action: 'approve' }).subscribe({
      next: res => {
        if (!res.error) {
          this.toast.success('Permohonan disahkan.');
          this.applications.update(list =>
            list.map(a => a.id === app.id ? { ...a, status_workflow: 'Menunggu Admin' } : a)
          );
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  openReject(app: any): void {
    this.rejectTarget.set(app);
    this.rejectNotes.set('');
    this.showRejectModal.set(true);
  }

  confirmReject(): void {
    if (!this.rejectNotes().trim()) {
      this.toast.error('Sebab penolakan diperlukan.');
      return;
    }
    this.api.post<any>('pp-verify.php', {
      permohonan_id: this.rejectTarget()!.id,
      action: 'reject',
      notes: this.rejectNotes().trim(),
    }).subscribe({
      next: res => {
        if (!res.error) {
          this.toast.success('Permohonan ditolak.');
          this.showRejectModal.set(false);
          this.applications.update(list =>
            list.map(a => a.id === this.rejectTarget()!.id ? { ...a, status_workflow: 'Ditolak' } : a)
          );
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }


  downloadExcel(): void {
    window.open(`${environment.apiUrl}/pp-export-referees.php?type=${this.type}`, '_blank');
  }

  statusClass(s: string): string {
    if (s === 'Menunggu PP Daerah') return 'bg-amber-100 text-amber-800';
    if (this.disahkanStatuses.includes(s)) return 'bg-green-100 text-green-800';
    if (s === 'Ditolak') return 'bg-red-100 text-red-800';
    return 'bg-slate-100 text-slate-600';
  }

  statusLabel(s: string): string {
    if (s === 'Menunggu PP Daerah') return 'Menunggu';
    if (s === 'PP Daerah Disahkan' || s === 'Menunggu Admin') return 'Disahkan';
    if (s === 'Admin Diluluskan' || s === 'Lengkap') return 'Diluluskan';
    if (s === 'Ditolak') return 'Ditolak';
    return s;
  }

  ujianClass(s: string): string {
    if (s === 'Lulus') return 'bg-green-100 text-green-800';
    if (s === 'Tidak Lulus') return 'bg-red-100 text-red-800';
    if (s === 'Tidak Hadir') return 'bg-amber-100 text-amber-800';
    return 'bg-slate-100 text-slate-600';
  }
}
