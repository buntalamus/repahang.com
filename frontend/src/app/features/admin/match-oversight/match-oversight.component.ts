import { Component, OnInit, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProfileModalService } from '../../../core/services/profile-modal.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-admin-match-oversight',
  standalone: true,
  imports: [FormsModule, DatePipe, LoadingComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan rekod perlawanan..." />
    } @else {
      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div class="bg-white rounded-xl p-4 border border-slate-200">
          <p class="text-2xl font-bold text-slate-900">{{ stats.total || 0 }}</p>
          <p class="text-xs text-slate-500">Jumlah</p>
        </div>
        <button (click)="setFilter('pending')" class="bg-white rounded-xl p-4 border text-left transition"
          [class]="filterStatus === 'pending' ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200 hover:border-amber-300'">
          <p class="text-2xl font-bold text-amber-600">{{ stats.pending || 0 }}</p>
          <p class="text-xs text-amber-600">Menunggu</p>
        </button>
        <button (click)="setFilter('verified')" class="bg-white rounded-xl p-4 border text-left transition"
          [class]="filterStatus === 'verified' ? 'border-green-400 ring-1 ring-green-200' : 'border-slate-200 hover:border-green-300'">
          <p class="text-2xl font-bold text-green-600">{{ stats.verified || 0 }}</p>
          <p class="text-xs text-green-600">Disahkan</p>
        </button>
        <button (click)="setFilter('rejected')" class="bg-white rounded-xl p-4 border text-left transition"
          [class]="filterStatus === 'rejected' ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200 hover:border-red-300'">
          <p class="text-2xl font-bold text-red-600">{{ stats.rejected || 0 }}</p>
          <p class="text-xs text-red-600">Ditolak</p>
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applySearch()"
          placeholder="Cari pasukan, pengadil, tempat, daerah..."
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-pahang-yellow/30 focus:border-pahang-yellow outline-none" />
        <select [(ngModel)]="filterDaerahId" (ngModelChange)="setDaerahFilter($event)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pahang-yellow/30 focus:border-pahang-yellow outline-none">
          <option value="0">Semua Daerah</option>
          @for (d of districts; track d.id) {
            <option [value]="d.id">{{ d.nama }}</option>
          }
        </select>
        <button (click)="setFilter('')"
          class="px-4 py-2 text-sm font-medium rounded-lg border transition"
          [class]="!filterStatus ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'">
          Semua Status
        </button>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Perlawanan</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Tarikh</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Daerah</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Pegawai</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (match of filtered; track trackMatch(match); let i = $index) {
                <tr class="hover:bg-slate-50 cursor-pointer transition" (click)="openModal(match)">
                  <td class="px-4 py-3 text-slate-400 text-xs">{{ i + 1 }}</td>
                  <td class="px-4 py-3">
                    <p class="font-semibold text-slate-900 text-sm">{{ match.home_team }} vs {{ match.away_team }}</p>
                    <p class="text-xs text-slate-400 mt-0.5">{{ match.tempat }}</p>
                  </td>
                  <td class="px-4 py-3 hidden sm:table-cell">
                    <p class="text-slate-700 text-xs">{{ match.tarikh | date:'d MMM yyyy' }}</p>
                    @if (match.masa) {<p class="text-slate-400 text-xs">{{ match.masa }}</p>}
                  </td>
                  <td class="px-4 py-3 hidden md:table-cell text-xs text-slate-600">{{ match.daerah_perlawanan_nama || '-' }}</td>
                  <td class="px-4 py-3 hidden lg:table-cell">
                    @if (match.is_grouped) {
                      <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700">
                        <span class="material-icons text-[10px]">group</span>{{ match.officials.length }}
                      </span>
                    } @else {
                      <span class="text-xs text-slate-600"
                            [class.cursor-pointer]="match.officials[0]?.user_id"
                            [class.hover:text-blue-600]="match.officials[0]?.user_id"
                            [class.hover:underline]="match.officials[0]?.user_id"
                            (click)="match.officials[0]?.user_id && profileModal.open(match.officials[0].user_id); $event.stopPropagation()">{{ match.officials[0]?.nama || '-' }}</span>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" [class]="getStatusClass(match.status_pp)">
                      {{ getStatusLabel(match.status_pp) }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-4 py-12 text-center text-slate-400">
                    <span class="material-icons text-4xl mb-2 block">sports_soccer</span>
                    Tiada rekod perlawanan ditemui.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination -->
      @if (pagination.total_pages > 1) {
        <div class="flex items-center justify-center gap-2 mt-4">
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

    <!-- Match Detail Modal -->
    @if (selectedMatch) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
           (click)="closeModal($event)" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-black/40"></div>

        <div class="relative bg-white w-full max-w-lg rounded-xl shadow-xl"
             (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-100">
            <div class="flex-1 min-w-0 pr-3">
              <p class="font-bold text-slate-900 text-sm leading-snug">{{ selectedMatch.home_team }} vs {{ selectedMatch.away_team }}</p>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ selectedMatch.tarikh | date:'d MMM yyyy' }}
                @if (selectedMatch.masa) { · {{ selectedMatch.masa }}}
                · {{ selectedMatch.tempat }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" [class]="getStatusClass(selectedMatch.status_pp)">
                {{ getStatusLabel(selectedMatch.status_pp) }}
              </span>
              <button (click)="closeModal()" class="text-slate-400 hover:text-slate-600 transition" aria-label="Tutup">
                <span class="material-icons text-lg">close</span>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="px-4 py-3 space-y-3">

            <!-- Info rows -->
            <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              <div class="flex justify-between border-b border-slate-100 pb-1.5">
                <span class="text-slate-400">Jenis</span>
                <span class="font-medium text-slate-700">{{ selectedMatch.jenis || '-' }}</span>
              </div>
              <div class="flex justify-between border-b border-slate-100 pb-1.5">
                <span class="text-slate-400">Daerah</span>
                <span class="font-medium text-slate-700">{{ selectedMatch.daerah_perlawanan_nama || '-' }}</span>
              </div>
              @if (selectedMatch.nama_kejohanan) {
                <div class="flex justify-between border-b border-slate-100 pb-1.5 col-span-2">
                  <span class="text-slate-400">Kejohanan</span>
                  <span class="font-medium text-slate-700">{{ selectedMatch.nama_kejohanan }}</span>
                </div>
              }
              @if (selectedMatch.cuaca) {
                <div class="flex justify-between border-b border-slate-100 pb-1.5">
                  <span class="text-slate-400">Cuaca</span>
                  <span class="font-medium text-slate-700">{{ selectedMatch.cuaca }}</span>
                </div>
              }
              @if (selectedMatch.submitter_name) {
                <div class="flex justify-between border-b border-slate-100 pb-1.5">
                  <span class="text-slate-400">Dihantar oleh</span>
                  <span class="font-medium text-slate-700">{{ selectedMatch.submitter_name }}</span>
                </div>
              }
              @if (selectedMatch.verified_by_name) {
                <div class="flex justify-between border-b border-slate-100 pb-1.5 col-span-2">
                  <span class="text-slate-400">Diproses oleh</span>
                  <span class="font-medium text-slate-700">{{ selectedMatch.verified_by_name }} · {{ selectedMatch.verified_at | date:'d MMM yyyy' }}</span>
                </div>
              }
              @if (selectedMatch.skor_ft_home !== null && selectedMatch.skor_ft_away !== null) {
                <div class="flex justify-between border-b border-slate-100 pb-1.5">
                  <span class="text-slate-400">Keputusan (FT)</span>
                  <span class="font-bold text-slate-800">{{ selectedMatch.skor_ft_home }} – {{ selectedMatch.skor_ft_away }}</span>
                </div>
              }
              @if (selectedMatch.skor_ht_home !== null) {
                <div class="flex justify-between border-b border-slate-100 pb-1.5">
                  <span class="text-slate-400">Separuh Masa (HT)</span>
                  <span class="font-medium text-slate-700">{{ selectedMatch.skor_ht_home }} – {{ selectedMatch.skor_ht_away }}</span>
                </div>
              }
            </div>

            <!-- Officials compact table -->
            <div>
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Pegawai Perlawanan</p>
              <table class="w-full text-xs">
                <tbody>
                  @for (o of selectedMatch.officials; track o.id) {
                    <tr class="border-b border-slate-100 last:border-0">
                      <td class="py-1 text-slate-500 w-1/2">{{ o.jawatan }}</td>
                      <td class="py-1 font-medium text-slate-800">
                        <span [class.cursor-pointer]="o.user_id"
                              [class.hover:text-blue-600]="o.user_id"
                              [class.hover:underline]="o.user_id"
                              (click)="o.user_id && profileModal.open(o.user_id)">{{ o.nama }}</span>
                        @if (o.jenis_pengadil) {<span class="text-slate-400 font-normal"> ({{ o.jenis_pengadil }})</span>}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Existing notes -->
            @if (selectedMatch.catatan_pp) {
              <p class="text-xs text-slate-500 italic border-l-2 border-amber-300 pl-2">{{ selectedMatch.catatan_pp }}</p>
            }

            <!-- Override action area -->
            <div class="border-t border-slate-100 pt-3 space-y-2">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="material-icons text-sm text-orange-500">admin_panel_settings</span>
                <span class="text-xs font-semibold text-orange-600">Override Admin</span>
                <span class="text-xs text-slate-400">(justifikasi wajib)</span>
              </div>
              <textarea [(ngModel)]="justification" rows="2"
                placeholder="Contoh: ralat data, permintaan PP, semakan audit..."
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none focus:ring-1 focus:ring-orange-300 outline-none"></textarea>
              @if (justificationError) {
                <p class="text-xs text-red-600">{{ justificationError }}</p>
              }
              <div class="flex justify-between items-center">
                <button (click)="showDeleteConfirm = !showDeleteConfirm; justificationError = ''"
                  class="text-xs text-red-500 hover:text-red-700 transition">Padam</button>
                <div class="flex gap-2">
                  <button (click)="submitOverride('revert')" [disabled]="processing"
                    class="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg disabled:opacity-50">
                    {{ processing ? '...' : 'Kembalikan' }}
                  </button>
                  <button (click)="submitOverride('reject')" [disabled]="processing"
                    class="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50">
                    {{ processing ? '...' : 'Tolak' }}
                  </button>
                  <button (click)="submitOverride('verify')" [disabled]="processing"
                    class="px-4 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                    {{ processing ? 'Memproses...' : (selectedMatch.is_grouped ? 'Sahkan Semua' : 'Sahkan') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Delete confirm inline -->
            @if (showDeleteConfirm) {
              <div class="space-y-2 bg-red-50 rounded-lg px-3 py-2">
                <p class="text-xs text-red-700 font-medium">Padam semua rekod perlawanan ini? Tidak boleh dibatalkan.</p>
                <textarea [(ngModel)]="justification" rows="2"
                  placeholder="Justifikasi pemadaman (wajib)..."
                  class="w-full px-3 py-2 border border-red-300 bg-white rounded-lg text-xs resize-none focus:ring-1 focus:ring-red-300 outline-none"></textarea>
                @if (justificationError) {
                  <p class="text-xs text-red-600">{{ justificationError }}</p>
                }
                <div class="flex justify-end gap-2">
                  <button (click)="showDeleteConfirm = false; justificationError = ''" class="text-xs text-slate-500 hover:text-slate-700">Batal</button>
                  <button (click)="deleteMatch()" [disabled]="deleting"
                    class="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
                    {{ deleting ? 'Memadam...' : 'Ya, Padam' }}
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminMatchOversightComponent implements OnInit {
  loading = true;
  processing = false;
  deleting = false;

  matches: any[] = [];
  filtered: any[] = [];
  stats: any = {};
  districts: any[] = [];
  pagination: any = { page: 1, total_pages: 1 };

  searchQuery = '';
  filterStatus = '';
  filterDaerahId = 0;

  selectedMatch: any = null;
  showDeleteConfirm = false;
  justification = '';
  justificationError = '';

  constructor(
    private api: ApiService,
    private toast: ToastService,
    public profileModal: ProfileModalService,
  ) {}

  ngOnInit(): void {
    this.loadMatches();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeModal(); }

  setFilter(status: string): void {
    this.filterStatus = status;
    this.pagination.page = 1;
    this.loadMatches();
  }

  setDaerahFilter(id: number): void {
    this.filterDaerahId = +id;
    this.pagination.page = 1;
    this.loadMatches();
  }

  loadMatches(): void {
    this.loading = true;
    const params = `?status=${this.filterStatus}&daerah_id=${this.filterDaerahId}&page=${this.pagination.page}&per_page=50`;
    this.api.get<any>(`admin-matches.php${params}`).subscribe({
      next: (res) => {
        if (!res.error) {
          this.matches   = res.matches   || [];
          this.filtered  = [...this.matches];
          this.stats     = res.statistics || {};
          this.districts = res.districts  || [];
          this.pagination = res.pagination || { page: 1, total_pages: 1 };
        }
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  applySearch(): void {
    if (!this.searchQuery) { this.filtered = [...this.matches]; return; }
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.matches.filter((m) =>
      (m.home_team || '').toLowerCase().includes(q) ||
      (m.away_team || '').toLowerCase().includes(q) ||
      (m.tempat || '').toLowerCase().includes(q) ||
      (m.jenis || '').toLowerCase().includes(q) ||
      (m.daerah_perlawanan_nama || '').toLowerCase().includes(q) ||
      (m.submitter_name || '').toLowerCase().includes(q) ||
      m.officials?.some((o: any) => (o.nama || '').toLowerCase().includes(q)),
    );
  }

  trackMatch(match: any): string { return match.match_group_id || ('s_' + match.id); }

  openModal(match: any): void {
    this.selectedMatch     = match;
    this.showDeleteConfirm = false;
    this.justification     = '';
    this.justificationError = '';
  }

  closeModal(event?: MouseEvent): void {
    if (event && event.target !== event.currentTarget) return;
    this.selectedMatch = null;
    this.showDeleteConfirm = false;
    this.justification = '';
    this.justificationError = '';
  }

  hasScore(match: any): boolean {
    return match.skor_ft_home !== null || match.skor_ht_home !== null ||
           match.skor_et_home !== null || match.skor_ps_home !== null;
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

  submitOverride(action: 'verify' | 'reject' | 'revert'): void {
    this.justificationError = '';
    if (action !== 'revert' && !this.justification.trim()) {
      this.justificationError = 'Justifikasi wajib diisi.';
      return;
    }
    if (!this.selectedMatch) return;

    this.processing = true;
    const payload: any = { action, justification: this.justification };
    if (this.selectedMatch.is_grouped && this.selectedMatch.match_group_id) {
      payload.match_group_id = this.selectedMatch.match_group_id;
    } else {
      payload.match_id = this.selectedMatch.id;
    }

    this.api.post<any>('admin-matches.php', payload).subscribe({
      next: (res) => {
        this.processing = false;
        if (!res.error) {
          this.toast.success(res.message);
          this.closeModal();
          this.loadMatches();
        } else {
          this.toast.error(res.message);
        }
      },
      error: (err: any) => {
        this.processing = false;
        this.toast.error(err?.error?.message || 'Gagal memproses override.');
      },
    });
  }

  deleteMatch(): void {
    this.justificationError = '';
    if (!this.justification.trim()) {
      this.justificationError = 'Justifikasi wajib diisi.';
      return;
    }
    if (!this.selectedMatch) return;

    this.deleting = true;
    const payload: any = { justification: this.justification };
    if (this.selectedMatch.is_grouped && this.selectedMatch.match_group_id) {
      payload.match_group_id = this.selectedMatch.match_group_id;
    } else {
      payload.match_id = this.selectedMatch.id;
    }

    this.api.delete<any>('admin-matches.php', payload).subscribe({
      next: (res) => {
        this.deleting = false;
        if (!res.error) {
          this.toast.success(res.message);
          this.closeModal();
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

  goToPage(page: number): void {
    if (page < 1 || page > this.pagination.total_pages) return;
    this.pagination.page = page;
    this.loadMatches();
  }
}
