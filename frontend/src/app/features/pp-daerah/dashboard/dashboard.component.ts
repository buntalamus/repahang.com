import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-pp-dashboard',
  standalone: true,
  imports: [RouterLink, LoadingComponent, DatePipe],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan dashboard..." />
    } @else {
      <!-- Welcome Header -->
      <div class="bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 lg:p-8 mb-6 text-white relative overflow-hidden">
        <div class="absolute top-0 right-0 w-64 h-64 bg-pahang-yellow/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
        <div class="relative">
          <p class="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">Panel PP Daerah</p>
          <h2 class="text-xl lg:text-2xl font-bold">{{ auth.currentUser?.nama_penuh }}</h2>
          <p class="text-white/60 text-sm mt-1">{{ auth.currentUser?.persatuan_nama }}</p>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <!-- Pengadil -->
        <a routerLink="/pp-daerah/pengadil" class="bg-white rounded-xl p-5 border border-slate-200 hover:shadow-md transition group">
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition">
              <span class="material-icons text-slate-600 text-xl">people</span>
            </div>
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Pengadil</span>
          </div>
          <p class="text-2xl font-bold text-slate-900">{{ overview.total_referees || 0 }}</p>
          <p class="text-xs text-slate-500 mt-1">Pengadil Berdaftar</p>
        </a>

        <!-- Menunggu Pengesahan Permohonan -->
        <a routerLink="/pp-daerah/pengesahan" class="bg-white rounded-xl p-5 border border-amber-200 hover:shadow-md transition group relative">
          @if (overview.pending_applications > 0) {
            <div class="absolute top-3 right-3 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></div>
          }
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition">
              <span class="material-icons text-amber-600 text-xl">pending_actions</span>
            </div>
            <span class="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">Permohonan</span>
          </div>
          <p class="text-2xl font-bold text-amber-700">{{ overview.pending_applications || 0 }}</p>
          <p class="text-xs text-amber-600 mt-1">Permohonan Belum Disahkan</p>
        </a>

        <!-- Diluluskan Permohonan -->
        <div class="bg-white rounded-xl p-5 border border-green-200">
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <span class="material-icons text-green-600 text-xl">check_circle</span>
            </div>
            <span class="text-[10px] font-semibold text-green-400 uppercase tracking-wide">Permohonan</span>
          </div>
          <p class="text-2xl font-bold text-green-700">{{ overview.approved_applications || 0 }}</p>
          <p class="text-xs text-green-600 mt-1">Permohonan Diluluskan</p>
        </div>

        <!-- Rekod Perlawanan Belum Disahkan -->
        <a routerLink="/pp-daerah/pengesahan-perlawanan"
          class="rounded-xl p-5 border transition group relative"
          [class]="overview.pending_matches > 0
            ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
            : 'bg-white border-blue-200 hover:shadow-md'">
          @if (overview.pending_matches > 0) {
            <div class="absolute top-3 right-3 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></div>
          }
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center transition"
              [class]="overview.pending_matches > 0 ? 'bg-blue-100 group-hover:bg-blue-200' : 'bg-blue-50 group-hover:bg-blue-100'">
              <span class="material-icons text-blue-600 text-xl">sports_soccer</span>
            </div>
            <span class="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">Perlawanan</span>
          </div>
          <p class="text-2xl font-bold text-blue-700">{{ overview.pending_matches || 0 }}</p>
          <p class="text-xs text-blue-600 mt-1">Rekod Belum Disahkan</p>
        </a>

        <!-- Perlawanan Bulan Ini -->
        <div class="bg-white rounded-xl p-5 border border-slate-200">
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <span class="material-icons text-slate-600 text-xl">calendar_month</span>
            </div>
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Perlawanan</span>
          </div>
          <p class="text-2xl font-bold text-slate-700">{{ overview.matches_this_month || 0 }}</p>
          <p class="text-xs text-slate-500 mt-1">Perlawanan Bulan Ini</p>
        </div>
      </div>

      <!-- Pengesahan CTA (only if pending > 0) -->
      @if (overview.pending_applications > 0) {
        <a routerLink="/pp-daerah/pengesahan"
          class="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 hover:bg-amber-100 transition group">
          <div class="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition">
            <span class="material-icons text-amber-600 text-2xl">verified</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-amber-900">{{ overview.pending_applications }} permohonan menunggu pengesahan anda</p>
            <p class="text-xs text-amber-700/70 mt-0.5">Klik untuk semak dan sahkan permohonan pengadil</p>
          </div>
          <span class="material-icons text-amber-400 group-hover:text-amber-600 transition">arrow_forward</span>
        </a>
      }

      @if (overview.pending_matches > 0) {
        <a routerLink="/pp-daerah/pengesahan-perlawanan"
          class="flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 hover:bg-blue-100 transition group">
          <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition">
            <span class="material-icons text-blue-600 text-2xl">sports_soccer</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-blue-900">{{ overview.pending_matches }} perlawanan menunggu pengesahan anda</p>
            <p class="text-xs text-blue-700/70 mt-0.5">Sahkan rekod perlawanan yang dihantar oleh pengadil</p>
          </div>
          <span class="material-icons text-blue-400 group-hover:text-blue-600 transition">arrow_forward</span>
        </a>
      }

      <!-- Two Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Top Pengadil -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-900">Pengadil Teratas</h3>
            <a routerLink="/pp-daerah/pengadil" class="text-xs text-pahang-yellow hover:underline font-medium">Lihat Semua</a>
          </div>
          @if (topReferees.length) {
            <div class="divide-y divide-slate-50">
              @for (ref of topReferees; track ref.id; let i = $index) {
                <div class="flex items-center gap-3 px-5 py-3">
                  <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                    {{ i + 1 }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-900 truncate">{{ ref.nama_penuh }}</p>
                    <p class="text-xs text-slate-500">{{ ref.jenis_pengadil || 'Pengadil' }}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-sm font-semibold text-slate-900">{{ ref.total_matches || 0 }}</p>
                    <p class="text-xs text-slate-400">perlawanan</p>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="px-5 py-8 text-center">
              <span class="material-icons text-slate-300 text-3xl">emoji_events</span>
              <p class="text-sm text-slate-400 mt-2">Tiada data pengadil.</p>
            </div>
          }
        </div>

        <!-- Perlawanan Akan Datang -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100">
            <h3 class="text-sm font-semibold text-slate-900">Perlawanan Akan Datang</h3>
          </div>
          @if (currentAssignments.length) {
            <div class="divide-y divide-slate-50">
              @for (match of currentAssignments; track $index) {
                <div class="px-5 py-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-slate-900">{{ match.jenis }}</p>
                      <p class="text-xs text-slate-500 mt-0.5">{{ match.tempat || 'Lokasi belum ditetapkan' }}</p>
                    </div>
                    <span class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {{ match.tarikh | date:'d MMM' }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 mt-1.5">
                    <span class="material-icons text-slate-400 text-xs">person</span>
                    <span class="text-xs text-slate-500">{{ match.nama_penuh }} — {{ match.jawatan }}</span>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="px-5 py-8 text-center">
              <span class="material-icons text-slate-300 text-3xl">event_busy</span>
              <p class="text-sm text-slate-400 mt-2">Tiada perlawanan akan datang.</p>
            </div>
          }
        </div>
      </div>

      <!-- Quick Links -->
      <div class="mb-6">
        <h3 class="text-sm font-semibold text-slate-900 mb-3">Pintasan</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <a routerLink="/pp-daerah/permohonan/berdaftar"
            class="flex flex-col items-center gap-2 bg-white rounded-xl p-4 border border-slate-200 hover:border-pahang-yellow hover:shadow-sm transition text-center">
            <span class="material-icons text-pahang-yellow text-xl">badge</span>
            <span class="text-xs font-medium text-slate-700">Pendaftaran Tahunan</span>
          </a>
          <a routerLink="/pp-daerah/permohonan/kecergasan"
            class="flex flex-col items-center gap-2 bg-white rounded-xl p-4 border border-slate-200 hover:border-pahang-yellow hover:shadow-sm transition text-center">
            <span class="material-icons text-pahang-yellow text-xl">fitness_center</span>
            <span class="text-xs font-medium text-slate-700">Ujian Kecergasan</span>
          </a>
          <a routerLink="/pp-daerah/permohonan/bertulis"
            class="flex flex-col items-center gap-2 bg-white rounded-xl p-4 border border-slate-200 hover:border-pahang-yellow hover:shadow-sm transition text-center">
            <span class="material-icons text-pahang-yellow text-xl">quiz</span>
            <span class="text-xs font-medium text-slate-700">Kelas III FAM</span>
          </a>
          <a routerLink="/pp-daerah/permohonan/kelas1"
            class="flex flex-col items-center gap-2 bg-white rounded-xl p-4 border border-slate-200 hover:border-pahang-yellow hover:shadow-sm transition text-center">
            <span class="material-icons text-pahang-yellow text-xl">military_tech</span>
            <span class="text-xs font-medium text-slate-700">Kelas I FAM</span>
          </a>
          <a routerLink="/pp-daerah/pengadil"
            class="flex flex-col items-center gap-2 bg-white rounded-xl p-4 border border-slate-200 hover:border-pahang-yellow hover:shadow-sm transition text-center">
            <span class="material-icons text-pahang-yellow text-xl">people</span>
            <span class="text-xs font-medium text-slate-700">Senarai Pengadil</span>
          </a>
        </div>
      </div>

      <!-- Announcements -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h3 class="text-sm font-semibold text-slate-900">Pengumuman</h3>
        </div>
        @if (announcements.length) {
          <div class="divide-y divide-slate-50">
            @for (ann of announcements; track ann.id) {
              <div class="px-5 py-3">
                <p class="text-sm font-medium text-slate-900">{{ ann.title }}</p>
                <p class="text-xs text-slate-400 mt-0.5">{{ ann.created_at }}</p>
              </div>
            }
          </div>
        } @else {
          <div class="px-5 py-8 text-center">
            <span class="material-icons text-slate-300 text-3xl">campaign</span>
            <p class="text-sm text-slate-400 mt-2">Tiada pengumuman.</p>
          </div>
        }
      </div>
    }
  `,
})
export class PpDashboardComponent implements OnInit {
  loading = true;
  overview: any = {};
  topReferees: any[] = [];
  currentAssignments: any[] = [];
  announcements: any[] = [];

  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    forkJoin({
      dashboard: this.api.get<any>('pp-dashboard-overview.php').pipe(
        catchError(() => of({ error: true })),
      ),
      announcements: this.api.get<any>('pp-announcements.php').pipe(
        catchError(() => of({ error: true, data: [] })),
      ),
    }).pipe(
      finalize(() => {
        this.loading = false;
      }),
    ).subscribe(({ dashboard, announcements }) => {
      if (!dashboard.error) {
        this.overview = dashboard.overview || dashboard.data?.overview || {};
        this.topReferees = dashboard.top_referees || dashboard.data?.top_referees || [];
        this.currentAssignments = dashboard.current_assignments || dashboard.data?.current_assignments || [];
      }
      if (!announcements.error) this.announcements = announcements.data || announcements.announcements || [];
    });
  }
}
