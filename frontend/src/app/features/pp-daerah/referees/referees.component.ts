import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ProfileModalService } from '../../../core/services/profile-modal.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-pp-referees',
  standalone: true,
  imports: [FormsModule, DatePipe, LoadingComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan senarai pengadil..." />
    } @else {
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 class="text-xl font-bold text-slate-900">Senarai Pengadil</h1>
          <p class="text-sm text-slate-500 mt-0.5">{{ filtered.length }} pengadil dalam daerah anda</p>
        </div>
      </div>

      <!-- Search -->
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()"
          placeholder="Cari nama, IC, no telefon..."
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-pahang-yellow/30 focus:border-pahang-yellow outline-none" />
      </div>

      <!-- Referee Table -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50">
                <th class="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">#</th>
                <th class="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nama</th>
                <th class="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">No. IC</th>
                <th class="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Jenis</th>
                <th class="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Telefon</th>
                <th class="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Permohonan</th>
                <th class="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (ref of filtered; track ref.id; let i = $index) {
                <tr (click)="openProfile(ref)"
                  class="hover:bg-pahang-yellow/5 cursor-pointer transition">
                  <td class="px-4 py-3 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-4 py-3">
                    <p class="text-xs font-semibold text-slate-900">{{ ref.nama_penuh }}</p>
                    <p class="text-[10px] text-slate-400 sm:hidden mt-0.5">{{ ref.no_ic || ref.no_kp }}</p>
                  </td>
                  <td class="px-4 py-3 text-xs text-slate-600 font-mono hidden sm:table-cell">{{ ref.no_ic || ref.no_kp }}</td>
                  <td class="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">{{ ref.jenis_pengadil || '-' }}</td>
                  <td class="px-4 py-3 text-xs text-slate-600 hidden lg:table-cell">{{ ref.no_telefon || '-' }}</td>
                  <td class="px-4 py-3 text-xs text-slate-600 hidden lg:table-cell">{{ ref.total_permohonan || 0 }} ({{ ref.permohonan_lulus || 0 }} lulus)</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                      [class]="ref.aktif !== 0 && ref.aktif !== '0' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                      {{ ref.aktif !== 0 && ref.aktif !== '0' ? 'Aktif' : 'Tidak Aktif' }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-12 text-center">
                    <span class="material-icons text-slate-300 text-4xl mb-2">people_outline</span>
                    <p class="text-sm text-slate-400">Tiada pengadil ditemui.</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- Profile Modal -->
    @if (selectedRef) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="closeProfile()">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden" (click)="$event.stopPropagation()">
          <!-- Close Button -->
          <button (click)="closeProfile()"
            class="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-slate-100 flex items-center justify-center transition">
            <span class="material-icons text-slate-500 text-lg">close</span>
          </button>

          <!-- Profile Header -->
          <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pt-6 pb-8 text-white relative overflow-hidden">
            <div class="absolute top-0 right-0 w-40 h-40 bg-pahang-yellow/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
            <div class="relative flex items-center gap-4">
              <div class="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center shrink-0">
                @if (profileDetail?.url_gambar_profil) {
                  <img [src]="profileDetail.url_gambar_profil" class="w-full h-full rounded-full object-cover" />
                } @else {
                  <span class="material-icons text-white/60 text-3xl">person</span>
                }
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-bold truncate">{{ selectedRef.nama_penuh }}</h3>
                <p class="text-white/60 text-xs mt-0.5">{{ selectedRef.no_ic || selectedRef.no_kp }}</p>
                <div class="flex items-center gap-2 mt-1.5">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/80">
                    {{ selectedRef.jenis_pengadil || 'Pengadil' }}
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                    [class]="selectedRef.aktif !== 0 && selectedRef.aktif !== '0' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'">
                    {{ selectedRef.aktif !== 0 && selectedRef.aktif !== '0' ? 'Aktif' : 'Tidak Aktif' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Scrollable Content -->
          <div class="overflow-y-auto max-h-[calc(90vh-180px)]">
            @if (profileLoading) {
              <div class="p-8 text-center">
                <div class="inline-block w-6 h-6 border-2 border-slate-300 border-t-pahang-yellow rounded-full animate-spin"></div>
                <p class="text-xs text-slate-400 mt-2">Memuatkan profil...</p>
              </div>
            } @else {
              <!-- Maklumat Peribadi -->
              <div class="px-6 py-4 border-b border-slate-100">
                <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Maklumat Peribadi</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Email</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.email || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">No. Telefon</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.no_telefon || selectedRef.no_telefon || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">No. Kad Pengenalan</p>
                    <p class="text-slate-800 font-medium font-mono">{{ profileDetail?.no_kp || selectedRef.no_ic || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Tarikh Daftar</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.created_at ? (profileDetail.created_at | date:'d MMM yyyy') : '-' }}</p>
                  </div>
                </div>
              </div>

              <!-- Alamat -->
              <div class="px-6 py-4 border-b border-slate-100">
                <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Alamat</h4>
                <div class="text-xs">
                  <p class="text-slate-800 font-medium">{{ profileDetail?.alamat1 || '-' }}{{ profileDetail?.alamat2 ? ', ' + profileDetail.alamat2 : '' }}</p>
                  <p class="text-slate-500 mt-0.5">{{ profileDetail?.poskod || '' }} <span class="uppercase">{{ profileDetail?.daerah || '' }}</span>{{ profileDetail?.negeri ? ', ' + profileDetail.negeri : '' }}</p>
                </div>
              </div>

              <!-- Maklumat Pengadil -->
              <div class="px-6 py-4 border-b border-slate-100">
                <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Maklumat Pengadil</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Jenis Pengadil</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.jenis_pengadil || selectedRef.jenis_pengadil || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Persatuan</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.persatuan_nama || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Tahun Mula Aktif</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.tahun_mula_aktif || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">No. Pendaftaran FAM</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.no_pendaftaran_fam || '-' }}</p>
                  </div>
                </div>
              </div>

              <!-- Pekerjaan -->
              <div class="px-6 py-4 border-b border-slate-100">
                <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Pekerjaan</h4>
                <div class="grid grid-cols-3 gap-3">
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Status</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.status_kerja || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Jawatan</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.jawatan || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Majikan</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.nama_majikan || '-' }}</p>
                  </div>
                </div>
                @if (profileDetail?.alamat_majikan1) {
                  <div class="text-xs mt-2">
                    <p class="text-slate-400 mb-0.5">Alamat Majikan</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail.alamat_majikan1 }}{{ profileDetail.alamat_majikan2 ? ', ' + profileDetail.alamat_majikan2 : '' }}</p>
                    <p class="text-slate-500 mt-0.5">{{ profileDetail.poskod_majikan || '' }} <span class="uppercase">{{ profileDetail.daerah_majikan || '' }}</span>{{ profileDetail.negeri_majikan ? ', ' + profileDetail.negeri_majikan : '' }}</p>
                  </div>
                }
              </div>

              <!-- Waris -->
              <div class="px-6 py-4 border-b border-slate-100">
                <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Waris</h4>
                <div class="grid grid-cols-3 gap-3">
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Nama</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.nama_waris || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">Hubungan</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.hubungan_waris || '-' }}</p>
                  </div>
                  <div class="text-xs">
                    <p class="text-slate-400 mb-0.5">No. Telefon</p>
                    <p class="text-slate-800 font-medium">{{ profileDetail?.telefon_waris || '-' }}</p>
                  </div>
                </div>
              </div>

              <!-- Stats Summary -->
              <div class="px-6 py-4 border-b border-slate-100">
                <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Statistik</h4>
                <div class="grid grid-cols-3 gap-3">
                  <div class="bg-slate-50 rounded-lg p-3 text-center">
                    <p class="text-lg font-bold text-slate-900">{{ profileDetail?.total_permohonan || selectedRef.total_permohonan || 0 }}</p>
                    <p class="text-[10px] text-slate-500">Permohonan</p>
                  </div>
                  <div class="bg-green-50 rounded-lg p-3 text-center">
                    <p class="text-lg font-bold text-green-700">{{ profileDetail?.permohonan_lulus || selectedRef.permohonan_lulus || 0 }}</p>
                    <p class="text-[10px] text-green-600">Lulus</p>
                  </div>
                  <div class="bg-blue-50 rounded-lg p-3 text-center">
                    <p class="text-lg font-bold text-blue-700">{{ profileMatches.length }}</p>
                    <p class="text-[10px] text-blue-600">Perlawanan</p>
                  </div>
                </div>
              </div>

              <!-- Match History -->
              <div class="px-6 py-4">
                <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Rekod Perlawanan Terkini</h4>
                @if (profileMatches.length) {
                  <div class="space-y-2">
                    @for (m of profileMatches.slice(0, 10); track m.id) {
                      <div class="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          [class]="m.status_pp === 'Disahkan' ? 'bg-green-100' : m.status_pp === 'Tidak Disahkan' ? 'bg-red-100' : 'bg-amber-100'">
                          <span class="material-icons text-sm"
                            [class]="m.status_pp === 'Disahkan' ? 'text-green-600' : m.status_pp === 'Tidak Disahkan' ? 'text-red-600' : 'text-amber-600'">
                            {{ m.status_pp === 'Disahkan' ? 'check_circle' : m.status_pp === 'Tidak Disahkan' ? 'cancel' : 'schedule' }}
                          </span>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-xs font-medium text-slate-800 truncate">{{ m.home_team || m.jenis }} {{ m.away_team ? 'vs ' + m.away_team : '' }}</p>
                          <p class="text-[10px] text-slate-500">{{ m.tarikh | date:'d MMM yyyy' }} · {{ m.jawatan }} · {{ m.tempat }}</p>
                        </div>
                      </div>
                    }
                    @if (profileMatches.length > 10) {
                      <p class="text-center text-xs text-slate-400 pt-2">+ {{ profileMatches.length - 10 }} lagi rekod</p>
                    }
                  </div>
                } @else {
                  <div class="text-center py-6">
                    <span class="material-icons text-slate-300 text-2xl">sports_soccer</span>
                    <p class="text-xs text-slate-400 mt-1">Tiada rekod perlawanan.</p>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class PpRefereesComponent implements OnInit {
  loading = true;
  referees: any[] = [];
  filtered: any[] = [];
  searchQuery = '';

  // Profile modal
  selectedRef: any = null;
  profileDetail: any = null;
  profileMatches: any[] = [];
  profileLoading = false;

  constructor(private api: ApiService, private profileModal: ProfileModalService) {}

  ngOnInit(): void {
    this.api.get<any>('pp-referees.php').subscribe({
      next: (res) => {
        this.referees = res.data || res.referees || [];
        this.filtered = [...this.referees];
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  applyFilter(): void {
    if (!this.searchQuery) {
      this.filtered = [...this.referees];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.referees.filter(
      (r) =>
        (r.nama_penuh || '').toLowerCase().includes(q) ||
        (r.no_ic || '').includes(q) ||
        (r.no_kp || '').includes(q) ||
        (r.no_telefon || '').includes(q),
    );
  }

  openProfile(ref: any): void {
    // Guna modal profil global (maklumat penuh + sejarah bertab)
    this.profileModal.open(ref.id);
  }

  closeProfile(): void {
    this.selectedRef = null;
    this.profileDetail = null;
    this.profileMatches = [];
  }
}
