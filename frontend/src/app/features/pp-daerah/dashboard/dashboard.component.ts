import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-pp-dashboard',
  standalone: true,
  imports: [RouterLink, LoadingComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan dashboard..." />
    } @else {
      <!-- Welcome -->
      <div class="bg-linear-to-r from-slate-900 to-slate-800 rounded-2xl p-6 mb-6 text-white">
        <h2 class="text-2xl font-bold">Selamat Datang, {{ auth.currentUser?.nama_penuh }}</h2>
        <p class="text-white/60 text-sm mt-1">PP Daerah — {{ auth.currentUser?.persatuan_nama }}</p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <p class="text-sm text-slate-500">Pengadil</p>
          <p class="text-2xl font-bold text-slate-900">{{ overview.total_referees || 0 }}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-amber-200">
          <p class="text-sm text-amber-600">Permohonan Menunggu</p>
          <p class="text-2xl font-bold text-amber-700">{{ overview.pending_applications || 0 }}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-green-200">
          <p class="text-sm text-green-600">Diluluskan</p>
          <p class="text-2xl font-bold text-green-700">{{ overview.approved_applications || 0 }}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <p class="text-sm text-slate-500">Perlawanan</p>
          <p class="text-2xl font-bold text-slate-900">{{ overview.total_matches || 0 }}</p>
        </div>
      </div>

      <!-- Quick Links -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <a routerLink="/pp-daerah/permohonan/berdaftar"
          class="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-pahang-yellow transition group">
          <span class="material-icons text-pahang-yellow text-2xl mb-2">people</span>
          <p class="font-semibold text-slate-900">Pengadil Berdaftar</p>
          <p class="text-xs text-slate-500 mt-1">Urus permohonan pengadil</p>
        </a>
        <a routerLink="/pp-daerah/permohonan/futsal"
          class="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-pahang-yellow transition group">
          <span class="material-icons text-pahang-yellow text-2xl mb-2">sports_soccer</span>
          <p class="font-semibold text-slate-900">Pengadil Futsal</p>
          <p class="text-xs text-slate-500 mt-1">Permohonan futsal</p>
        </a>
        <a routerLink="/pp-daerah/permohonan/kecergasan"
          class="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-pahang-yellow transition group">
          <span class="material-icons text-pahang-yellow text-2xl mb-2">fitness_center</span>
          <p class="font-semibold text-slate-900">Ujian Kecergasan</p>
          <p class="text-xs text-slate-500 mt-1">Keputusan kecergasan</p>
        </a>
        <a routerLink="/pp-daerah/permohonan/bertulis"
          class="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-pahang-yellow transition group">
          <span class="material-icons text-pahang-yellow text-2xl mb-2">quiz</span>
          <p class="font-semibold text-slate-900">Ujian Kelas III FAM</p>
          <p class="text-xs text-slate-500 mt-1">Keputusan Kelas III</p>
        </a>
        <a routerLink="/pp-daerah/permohonan/kelas1"
          class="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-pahang-yellow transition group">
          <span class="material-icons text-pahang-yellow text-2xl mb-2">military_tech</span>
          <p class="font-semibold text-slate-900">Ujian Kelas 1 FAM</p>
          <p class="text-xs text-slate-500 mt-1">Keputusan Kelas 1</p>
        </a>
      </div>

      <!-- Announcements -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">Pengumuman</h3>
        @for (ann of announcements; track ann.id) {
          <div class="py-3 border-b border-slate-100 last:border-0">
            <p class="text-sm font-medium text-slate-900">{{ ann.title }}</p>
            <p class="text-xs text-slate-500 mt-1">{{ ann.created_at }}</p>
          </div>
        } @empty {
          <p class="text-sm text-slate-400">Tiada pengumuman.</p>
        }
      </div>
    }
  `,
})
export class PpDashboardComponent implements OnInit {
  loading = true;
  overview: any = {};
  announcements: any[] = [];

  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    forkJoin({
      overview: this.api.get<any>('pp-dashboard-overview.php').pipe(
        catchError(() => of({ error: true })),
      ),
      announcements: this.api.get<any>('pp-announcements.php').pipe(
        catchError(() => of({ error: true, data: [] })),
      ),
    }).pipe(
      finalize(() => {
        this.loading = false;
      }),
    ).subscribe(({ overview, announcements }) => {
      if (!overview.error) this.overview = overview.data?.overview || overview.data || overview.overview || overview;
      if (!announcements.error) this.announcements = announcements.data || announcements.announcements || [];
    });
  }
}
