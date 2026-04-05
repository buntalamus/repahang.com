import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-pp-match-verification',
  standalone: true,
  imports: [FormsModule, DatePipe, LoadingComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan senarai perlawanan..." />
    } @else {
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 class="text-xl font-bold text-slate-900">Pengesahan Perlawanan</h1>
          <p class="text-sm text-slate-500 mt-0.5">Sahkan atau tolak rekod perlawanan pengadil</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="bg-white rounded-xl p-4 border border-slate-200">
          <p class="text-2xl font-bold text-slate-900">{{ stats.total || 0 }}</p>
          <p class="text-xs text-slate-500">Jumlah</p>
        </div>
        <button (click)="filterStatus = 'pending'; loadMatches()"
          class="bg-white rounded-xl p-4 border text-left transition"
          [class]="filterStatus === 'pending' ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200 hover:border-amber-300'">
          <p class="text-2xl font-bold text-amber-600">{{ stats.pending || 0 }}</p>
          <p class="text-xs text-amber-600">Menunggu</p>
        </button>
        <button (click)="filterStatus = 'verified'; loadMatches()"
          class="bg-white rounded-xl p-4 border text-left transition"
          [class]="filterStatus === 'verified' ? 'border-green-400 ring-1 ring-green-200' : 'border-slate-200 hover:border-green-300'">
          <p class="text-2xl font-bold text-green-600">{{ stats.verified || 0 }}</p>
          <p class="text-xs text-green-600">Disahkan</p>
        </button>
        <button (click)="filterStatus = 'rejected'; loadMatches()"
          class="bg-white rounded-xl p-4 border text-left transition"
          [class]="filterStatus === 'rejected' ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200 hover:border-red-300'">
          <p class="text-2xl font-bold text-red-600">{{ stats.rejected || 0 }}</p>
          <p class="text-xs text-red-600">Ditolak</p>
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applySearch()"
          placeholder="Cari nama pengadil, pasukan, tempat..."
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-pahang-yellow/30 focus:border-pahang-yellow outline-none" />
        <button (click)="filterStatus = ''; loadMatches()"
          class="px-4 py-2 text-sm font-medium rounded-lg border transition"
          [class]="!filterStatus ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'">
          Semua
        </button>
      </div>

      <!-- Match Cards -->
      <div class="space-y-3">
        @for (match of filtered; track trackMatch(match)) {
          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-sm transition">
            <div class="p-4 sm:p-5">
              <!-- Match Header -->
              <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold text-slate-900">{{ match.home_team }} vs {{ match.away_team }}</span>
                    @if (match.lantikan_id) {
                      <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                        <span class="material-icons text-[10px]">assignment_ind</span> Lantikan
                      </span>
                    }
                    @if (match.is_grouped) {
                      <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700">
                        <span class="material-icons text-[10px]">group</span> {{ match.officials.length }} Pegawai
                      </span>
                    }
                  </div>
                  @if (!match.is_grouped) {
                    <p class="text-xs text-slate-500 mt-1">
                      <span class="material-icons text-[11px] align-middle mr-0.5">person</span>
                      {{ match.officials[0]?.nama }} — {{ match.officials[0]?.jawatan }}
                    </p>
                  }
                  @if (match.submitter_name) {
                    <p class="text-xs text-slate-400 mt-0.5">
                      Dihantar oleh: {{ match.submitter_name }}
                    </p>
                  }
                </div>
                <span class="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  [class]="getStatusClass(match.status_pp)">
                  {{ getStatusLabel(match.status_pp) }}
                </span>
              </div>

              <!-- Match Details -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                <div>
                  <p class="text-slate-400 mb-0.5">Tarikh</p>
                  <p class="font-medium text-slate-700">
                    {{ match.tarikh | date:'d MMM yyyy' }}
                    @if (match.masa) {
                      <span class="text-slate-400 ml-1">{{ match.masa }}</span>
                    }
                  </p>
                </div>
                <div>
                  <p class="text-slate-400 mb-0.5">Jenis</p>
                  <p class="font-medium text-slate-700">{{ match.jenis }}</p>
                </div>
                <div>
                  <p class="text-slate-400 mb-0.5">Tempat</p>
                  <p class="font-medium text-slate-700">{{ match.tempat }}</p>
                </div>
                <div>
                  <p class="text-slate-400 mb-0.5">Daerah</p>
                  <p class="font-medium text-slate-700">{{ match.daerah_perlawanan_nama || '-' }}</p>
                </div>
              </div>

              @if (match.nama_kejohanan) {
                <div class="text-xs mb-3">
                  <span class="text-slate-400">Kejohanan:</span>
                  <span class="font-medium text-slate-700 ml-1">{{ match.nama_kejohanan }}</span>
                </div>
              }

              <!-- Officials list (grouped matches) -->
              @if (match.is_grouped && match.officials.length > 0) {
                <div class="bg-slate-50 rounded-lg p-3 mb-3">
                  <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Pegawai Perlawanan</p>
                  <div class="space-y-1.5">
                    @for (o of match.officials; track o.id) {
                      <div class="flex items-center justify-between text-xs">
                        <div>
                          <span class="font-medium text-slate-700">{{ o.nama }}</span>
                          @if (o.jenis_pengadil) {
                            <span class="text-slate-400 ml-1">({{ o.jenis_pengadil }})</span>
                          }
                        </div>
                        <span class="text-slate-500 bg-white px-2 py-0.5 rounded border text-[10px]">{{ o.jawatan }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Legacy officials display (non-grouped) -->
              @if (!match.is_grouped) {
                @if (match.head_referee_name || match.assistant_referee_1_name || match.assistant_referee_2_name || match.fourth_official_name) {
                  <div class="bg-slate-50 rounded-lg p-3 mb-3">
                    <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Pegawai Perlawanan</p>
                    <div class="grid grid-cols-2 gap-1.5 text-xs">
                      @if (match.head_referee_name) {
                        <div><span class="text-slate-400">Pengadil Utama:</span> <span class="text-slate-700">{{ match.head_referee_name }}</span></div>
                      }
                      @if (match.assistant_referee_1_name) {
                        <div><span class="text-slate-400">PP 1:</span> <span class="text-slate-700">{{ match.assistant_referee_1_name }}</span></div>
                      }
                      @if (match.assistant_referee_2_name) {
                        <div><span class="text-slate-400">PP 2:</span> <span class="text-slate-700">{{ match.assistant_referee_2_name }}</span></div>
                      }
                      @if (match.fourth_official_name) {
                        <div><span class="text-slate-400">Pengadil 4:</span> <span class="text-slate-700">{{ match.fourth_official_name }}</span></div>
                      }
                    </div>
                  </div>
                }
              }

              <!-- PP Notes -->
              @if (match.catatan_pp) {
                <div class="bg-slate-50 rounded-lg p-3 mb-3">
                  <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Catatan PP</p>
                  <p class="text-xs text-slate-700">{{ match.catatan_pp }}</p>
                </div>
              }

              <!-- Actions for pending matches -->
              @if (!match.status_pp || match.status_pp === 'Belum Disahkan') {
                @if (isActionOpenFor(match)) {
                  <div class="border-t border-slate-100 pt-3 mt-3">
                    <textarea [(ngModel)]="actionNotes" rows="2"
                      placeholder="Catatan (pilihan)..."
                      class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-pahang-yellow/30 focus:border-pahang-yellow outline-none mb-3"></textarea>
                    <div class="flex items-center justify-end gap-2">
                      <button (click)="cancelAction()"
                        class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
                        Batal
                      </button>
                      <button (click)="submitAction('reject', match)"
                        [disabled]="processing"
                        class="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50">
                        {{ processing ? 'Memproses...' : 'Tolak' }}
                      </button>
                      <button (click)="submitAction('verify', match)"
                        [disabled]="processing"
                        class="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50">
                        {{ processing ? 'Memproses...' : (match.is_grouped ? 'Sahkan Semua' : 'Sahkan') }}
                      </button>
                    </div>
                  </div>
                } @else {
                  <div class="border-t border-slate-100 pt-3 mt-3 flex justify-end gap-2">
                    <button (click)="confirmDelete(match)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                      <span class="material-icons text-sm">delete</span>
                      Padam
                    </button>
                    <button (click)="openAction(match)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-pahang-yellow bg-pahang-yellow/10 hover:bg-pahang-yellow/20 rounded-lg transition">
                      <span class="material-icons text-sm">verified</span>
                      Sahkan / Tolak
                    </button>
                  </div>
                }
              } @else {
                <!-- Actions for verified/rejected matches -->
                <div class="border-t border-slate-100 pt-3 mt-3 flex justify-end gap-2">
                  <button (click)="confirmDelete(match)"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                    <span class="material-icons text-sm">delete</span>
                    Padam
                  </button>
                  <button (click)="submitAction('revert', match)"
                    [disabled]="processing"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition disabled:opacity-50">
                    <span class="material-icons text-sm">undo</span>
                    {{ processing ? 'Memproses...' : 'Edit Semula' }}
                  </button>
                </div>
              }

              <!-- Delete Confirmation -->
              @if (isDeleteConfirmFor(match)) {
                <div class="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                  <p class="text-xs text-red-700 mb-2">Adakah anda pasti mahu memadam perlawanan ini? Tindakan ini tidak boleh dibatalkan.</p>
                  <div class="flex justify-end gap-2">
                    <button (click)="cancelDelete()"
                      class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition">
                      Batal
                    </button>
                    <button (click)="deleteMatch(match)"
                      [disabled]="deleting"
                      class="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50">
                      {{ deleting ? 'Memadam...' : 'Ya, Padam' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        } @empty {
          <div class="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <span class="material-icons text-slate-300 text-4xl mb-2">sports_soccer</span>
            <p class="text-sm text-slate-400">
              @if (filterStatus === 'pending') {
                Tiada perlawanan menunggu pengesahan.
              } @else if (filterStatus === 'verified') {
                Tiada perlawanan yang disahkan.
              } @else if (filterStatus === 'rejected') {
                Tiada perlawanan yang ditolak.
              } @else {
                Tiada rekod perlawanan ditemui.
              }
            </p>
          </div>
        }
      </div>

      <!-- Pagination -->
      @if (pagination.total_pages > 1) {
        <div class="flex items-center justify-center gap-2 mt-6">
          <button (click)="goToPage(pagination.page - 1)" [disabled]="pagination.page <= 1"
            class="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition">
            Sebelum
          </button>
          <span class="text-xs text-slate-500">{{ pagination.page }} / {{ pagination.total_pages }}</span>
          <button (click)="goToPage(pagination.page + 1)" [disabled]="pagination.page >= pagination.total_pages"
            class="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition">
            Seterusnya
          </button>
        </div>
      }
    }
  `,
})
export class PpMatchVerificationComponent implements OnInit {
  loading = true;
  processing = false;
  deleting = false;
  matches: any[] = [];
  filtered: any[] = [];
  stats: any = {};
  pagination: any = { page: 1, total_pages: 1 };
  searchQuery = '';
  filterStatus = 'pending';
  actionMatchKey: string | null = null; // match_group_id or 'single_<id>'
  actionNotes = '';
  deleteConfirmKey: string | null = null;

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadMatches();
  }

  loadMatches(): void {
    this.loading = true;
    const params = `?status=${this.filterStatus}&page=${this.pagination.page}&per_page=20`;
    this.api.get<any>(`pp-verify-match.php${params}`).subscribe({
      next: (res) => {
        if (!res.error) {
          this.matches = res.matches || [];
          this.filtered = [...this.matches];
          this.stats = res.statistics || {};
          this.pagination = res.pagination || { page: 1, total_pages: 1 };
        }
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  applySearch(): void {
    if (!this.searchQuery) {
      this.filtered = [...this.matches];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.matches.filter(
      (m) =>
        (m.home_team || '').toLowerCase().includes(q) ||
        (m.away_team || '').toLowerCase().includes(q) ||
        (m.tempat || '').toLowerCase().includes(q) ||
        (m.jenis || '').toLowerCase().includes(q) ||
        (m.daerah_perlawanan_nama || '').toLowerCase().includes(q) ||
        (m.submitter_name || '').toLowerCase().includes(q) ||
        m.officials?.some((o: any) => (o.nama || '').toLowerCase().includes(q)),
    );
  }

  trackMatch(match: any): string {
    return match.match_group_id || ('s_' + match.id);
  }

  getMatchKey(match: any): string {
    return match.match_group_id || 'single_' + match.id;
  }

  getStatusClass(status: string): string {
    if (!status || status === 'Belum Disahkan') return 'bg-amber-100 text-amber-800';
    if (status === 'Disahkan') return 'bg-green-100 text-green-800';
    return 'bg-red-100 text-red-800';
  }

  getStatusLabel(status: string): string {
    if (!status || status === 'Belum Disahkan') return 'Menunggu';
    return status;
  }

  openAction(match: any): void {
    this.actionMatchKey = this.getMatchKey(match);
    this.actionNotes = '';
  }

  isActionOpenFor(match: any): boolean {
    return this.actionMatchKey === this.getMatchKey(match);
  }

  cancelAction(): void {
    this.actionMatchKey = null;
    this.actionNotes = '';
  }

  confirmDelete(match: any): void {
    this.deleteConfirmKey = this.getMatchKey(match);
  }

  isDeleteConfirmFor(match: any): boolean {
    return this.deleteConfirmKey === this.getMatchKey(match);
  }

  cancelDelete(): void {
    this.deleteConfirmKey = null;
  }

  deleteMatch(match: any): void {
    this.deleting = true;
    const payload: any = {};
    if (match.is_grouped && match.match_group_id) {
      payload.match_group_id = match.match_group_id;
    } else {
      payload.match_id = match.id;
    }

    this.api.delete<any>('pp-verify-match.php', payload).subscribe({
      next: (res) => {
        this.deleting = false;
        if (!res.error) {
          this.toast.success(res.message);
          this.cancelDelete();
          this.loadMatches();
        } else {
          this.toast.error(res.message);
        }
      },
      error: (err: any) => {
        this.deleting = false;
        this.toast.error(err?.error?.message || 'Gagal memadam perlawanan.');
      },
    });
  }

  submitAction(action: 'verify' | 'reject' | 'revert', match: any): void {
    this.processing = true;
    const payload: any = { action, notes: this.actionNotes };

    if (match.is_grouped && match.match_group_id) {
      payload.match_group_id = match.match_group_id;
    } else {
      payload.match_id = match.id;
    }

    this.api.post<any>('pp-verify-match.php', payload).subscribe({
      next: (res) => {
        this.processing = false;
        if (!res.error) {
          this.toast.success(res.message);
          this.cancelAction();
          this.loadMatches();
        } else {
          this.toast.error(res.message);
        }
      },
      error: (err: any) => {
        this.processing = false;
        this.toast.error(err?.error?.message || 'Gagal memproses pengesahan.');
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pagination.total_pages) return;
    this.pagination.page = page;
    this.loadMatches();
  }
}
