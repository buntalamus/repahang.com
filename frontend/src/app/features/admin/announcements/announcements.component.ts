import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [FormsModule, LoadingComponent, PaginationComponent, ConfirmModalComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan pengumuman..." />
    } @else {
      <!-- Kad Statistik -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p class="text-sm text-gray-500 font-medium mb-1">Jumlah Pengumuman</p>
          <p class="text-2xl font-bold text-gray-900">{{ announcements.length }}</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p class="text-sm text-gray-500 font-medium mb-1">Bulan Ini</p>
          <p class="text-2xl font-bold text-blue-600">{{ countThisMonth }}</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 sm:col-span-1">
          <p class="text-sm text-gray-500 font-medium mb-1">Terkini</p>
          <p class="text-sm font-semibold text-gray-900 truncate">{{ announcements.length ? announcements[0].title : '-' }}</p>
          <p class="text-[10px] text-gray-400 mt-0.5">{{ announcements.length ? formatDate(announcements[0].created_at) : '' }}</p>
        </div>
      </div>

      <!-- Penapis & Tindakan -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()"
              placeholder="Cari tajuk atau kandungan pengumuman..."
              class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <button (click)="openAdd()"
            class="px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Tambah Pengumuman
          </button>
        </div>
        @if (searchQuery) {
          <div class="mt-3 text-xs text-slate-500">
            Menunjukkan {{ filtered.length }} daripada {{ announcements.length }} pengumuman
          </div>
        }
      </div>

      <!-- Senarai Pengumuman Desktop -->
      <div class="hidden md:block space-y-4">
        @for (ann of paged; track ann.id; let i = $index) {
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow overflow-hidden">
            <div class="p-5">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
                    </span>
                    <h4 class="text-base font-semibold text-slate-900 truncate">{{ ann.title }}</h4>
                  </div>
                  <p class="text-sm text-slate-600 whitespace-pre-line line-clamp-3 ml-11">{{ ann.content }}</p>
                  <div class="flex items-center gap-4 mt-3 ml-11">
                    <span class="text-xs text-slate-400 flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      {{ formatDate(ann.created_at) }}
                    </span>
                    @if (ann.created_at_formatted) {
                      <span class="text-xs text-slate-400">{{ ann.created_at_formatted }}</span>
                    }
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button (click)="viewAnnouncement(ann)" class="px-2.5 py-1.5 bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-medium transition-colors shadow-sm" title="Lihat">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                  </button>
                  <button (click)="openEdit(ann)" class="px-2.5 py-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-medium transition-colors shadow-sm" title="Edit">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </button>
                  <button (click)="confirmDelete(ann)" class="px-2.5 py-1.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors shadow-sm" title="Padam">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        } @empty {
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
            <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">campaign</span>
            <p class="text-slate-400 text-sm">Tiada pengumuman ditemui.</p>
            <button (click)="openAdd()" class="mt-4 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors">
              + Tambah Pengumuman Pertama
            </button>
          </div>
        }
      </div>

      <!-- Senarai Pengumuman Mobil -->
      <div class="md:hidden space-y-3">
        @for (ann of paged; track ann.id) {
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="p-4">
              <div class="flex items-start justify-between gap-2 mb-2">
                <h4 class="text-sm font-semibold text-slate-900 line-clamp-2">{{ ann.title }}</h4>
              </div>
              <p class="text-xs text-slate-600 whitespace-pre-line line-clamp-3 mb-3">{{ ann.content }}</p>
              <span class="text-[10px] text-slate-400">{{ formatDate(ann.created_at) }}</span>
            </div>
            <div class="flex border-t border-gray-100 divide-x divide-gray-100">
              <button (click)="viewAnnouncement(ann)" class="flex-1 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors text-center">Lihat</button>
              <button (click)="openEdit(ann)" class="flex-1 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors text-center">Edit</button>
              <button (click)="confirmDelete(ann)" class="flex-1 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-center">Padam</button>
            </div>
          </div>
        } @empty {
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">campaign</span>
            <p class="text-slate-400 text-sm">Tiada pengumuman ditemui.</p>
          </div>
        }
      </div>

      <!-- Pagination -->
      @if (filtered.length > 0) {
        <div class="mt-4">
          <app-pagination [totalItems]="filtered.length" [pageSize]="pageSize" [currentPage]="currentPage"
            (pageChange)="onPageChange($event)" (pageSizeChange)="onPageSizeChange($event)" />
        </div>
      }
    }

    <!-- Modal Lihat Pengumuman -->
    @if (showViewModal && viewData) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="showViewModal = false">
        <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl" (click)="$event.stopPropagation()">
          <div class="p-6 border-b border-gray-100 flex items-start justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
              </span>
              <h3 class="text-lg font-bold text-gray-900 truncate">{{ viewData.title }}</h3>
            </div>
            <button (click)="showViewModal = false"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0 ml-4">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 120px)">
            <p class="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{{ viewData.content }}</p>
            <div class="mt-6 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Dicipta: {{ formatDateTime(viewData.created_at) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Modal Tambah / Edit Pengumuman -->
    @if (showModal) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="showModal = false">
        <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
          <div class="p-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
            <h3 class="text-base font-semibold text-gray-900">{{ editMode ? 'Kemaskini Pengumuman' : 'Tambah Pengumuman Baharu' }}</h3>
            <button (click)="showModal = false" class="text-gray-400 hover:text-gray-600 transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Tajuk Pengumuman</label>
              <input type="text" [(ngModel)]="form.title" placeholder="Masukkan tajuk..."
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Kandungan</label>
              <textarea [(ngModel)]="form.content" rows="8" placeholder="Tulis kandungan pengumuman..."
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
              <p class="text-[10px] text-gray-400 mt-1">{{ (form.content || '').length }} aksara</p>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
              <button (click)="showModal = false"
                class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Batal</button>
              <button (click)="save()" [disabled]="saving"
                class="px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {{ saving ? 'Menyimpan...' : (editMode ? 'Kemaskini' : 'Terbitkan') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Modal Padam -->
    @if (showDeleteModal && deleteTarget) {
      <app-confirm-modal
        title="Padam Pengumuman"
        [message]="'Adakah anda pasti mahu memadam pengumuman &quot;' + deleteTarget.title + '&quot;? Tindakan ini tidak boleh dibatalkan.'"
        confirmLabel="Ya, Padam"
        confirmClass="bg-red-600 text-white hover:bg-red-700"
        (confirmed)="executeDelete()"
        (cancelled)="showDeleteModal = false" />
    }
  `,
})
export class AdminAnnouncementsComponent implements OnInit {
  loading = true;
  announcements: any[] = [];
  filtered: any[] = [];
  paged: any[] = [];
  searchQuery = '';
  currentPage = 1;
  pageSize = 10;

  showModal = false;
  editMode = false;
  saving = false;
  form: any = { title: '', content: '' };

  showViewModal = false;
  viewData: any = null;

  showDeleteModal = false;
  deleteTarget: any = null;

  countThisMonth = 0;

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.get<any>('announcements.php').subscribe({
      next: (res) => {
        this.announcements = res.data || res.announcements || [];
        this.computeStats();
        this.applyFilter();
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  private computeStats(): void {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    this.countThisMonth = this.announcements.filter((a) => {
      const d = new Date(a.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
  }

  applyFilter(): void {
    let data = [...this.announcements];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(
        (a) =>
          (a.title || '').toLowerCase().includes(q) ||
          (a.content || '').toLowerCase().includes(q),
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

  viewAnnouncement(ann: any): void {
    this.viewData = ann;
    this.showViewModal = true;
  }

  openAdd(): void {
    this.form = { title: '', content: '' };
    this.editMode = false;
    this.showModal = true;
  }

  openEdit(ann: any): void {
    this.form = { ...ann };
    this.editMode = true;
    this.showModal = true;
  }

  save(): void {
    if (!this.form.title?.trim() || !this.form.content?.trim()) {
      this.toast.warning('Sila isi semua medan.');
      return;
    }
    this.saving = true;
    const req = this.editMode
      ? this.api.put<any>(`announcements.php?id=${this.form.id}`, this.form)
      : this.api.post<any>('announcements.php', this.form);
    req.subscribe({
      next: (res) => {
        this.saving = false;
        if (!res.error) {
          this.toast.success(this.editMode ? 'Pengumuman dikemaskini.' : 'Pengumuman berjaya diterbitkan.');
          this.showModal = false;
          this.load();
        } else {
          this.toast.error(res.message);
        }
      },
      error: () => {
        this.saving = false;
        this.toast.error('Gagal menyimpan pengumuman.');
      },
    });
  }

  confirmDelete(ann: any): void {
    this.deleteTarget = ann;
    this.showDeleteModal = true;
  }

  executeDelete(): void {
    if (!this.deleteTarget) return;
    this.api.delete<any>(`announcements.php?id=${this.deleteTarget.id}`).subscribe({
      next: (res) => {
        this.showDeleteModal = false;
        this.deleteTarget = null;
        if (!res.error) {
          this.toast.success('Pengumuman berjaya dipadam.');
          this.load();
        } else {
          this.toast.error(res.message);
        }
      },
      error: () => {
        this.showDeleteModal = false;
        this.toast.error('Gagal memadam pengumuman.');
      },
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
