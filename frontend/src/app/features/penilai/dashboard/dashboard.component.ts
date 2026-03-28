import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { catchError, finalize, of, timeout } from 'rxjs';

@Component({
  selector: 'app-penilai-dashboard',
  standalone: true,
  imports: [RouterLink, LoadingComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan dashboard..." />
    } @else {
      <div class="space-y-6">
        <!-- Welcome -->
        <div class="bg-linear-to-r from-black to-gray-800 rounded-xl p-6 text-white">
          <h2 class="text-xl font-bold">Selamat Datang, {{ userName }}</h2>
          <p class="text-gray-300 text-sm mt-1">Panel Penilai — Sistem Pengurusan Pengadil PBNP</p>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <span class="material-icons text-blue-600">assignment</span>
            </div>
            <div>
              <p class="text-2xl font-bold">{{ stats.total_tugasan }}</p>
              <p class="text-xs text-gray-500">Jumlah Tugasan</p>
            </div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <span class="material-icons text-green-600">check_circle</span>
            </div>
            <div>
              <p class="text-2xl font-bold">{{ stats.selesai }}</p>
              <p class="text-xs text-gray-500">Selesai</p>
            </div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <span class="material-icons text-yellow-600">pending</span>
            </div>
            <div>
              <p class="text-2xl font-bold">{{ stats.belum_selesai }}</p>
              <p class="text-xs text-gray-500">Belum Selesai</p>
            </div>
          </div>
          <div class="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <span class="material-icons text-purple-600">groups</span>
            </div>
            <div>
              <p class="text-2xl font-bold">{{ stats.pengadil_dinilai }}</p>
              <p class="text-xs text-gray-500">Pengadil Dinilai</p>
            </div>
          </div>
        </div>

        <!-- Quick Links + Recent -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Quick Links -->
          <div class="bg-white rounded-xl shadow-sm p-6">
            <h3 class="font-semibold text-lg mb-4">Pautan Pantas</h3>
            <div class="grid grid-cols-2 gap-3">
              <a routerLink="/penilai/penilaian" class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-pahang-yellow/10 transition">
                <span class="material-icons text-gray-600">rate_review</span>
                <span class="text-sm font-medium">Penilaian</span>
              </a>
              <a routerLink="/penilai/tugasan" class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-pahang-yellow/10 transition">
                <span class="material-icons text-gray-600">assignment</span>
                <span class="text-sm font-medium">Tugasan</span>
              </a>
              <a routerLink="/penilai/statistik" class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-pahang-yellow/10 transition">
                <span class="material-icons text-gray-600">bar_chart</span>
                <span class="text-sm font-medium">Statistik</span>
              </a>
              <a routerLink="/penilai/profil" class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-pahang-yellow/10 transition">
                <span class="material-icons text-gray-600">person</span>
                <span class="text-sm font-medium">Profil</span>
              </a>
            </div>
          </div>

          <!-- Recent Assessments -->
          <div class="bg-white rounded-xl shadow-sm p-6">
            <h3 class="font-semibold text-lg mb-4">Penilaian Terkini</h3>
            @if (recentAssessments.length) {
              <div class="space-y-3">
                @for (a of recentAssessments; track a.id) {
                  <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p class="font-medium text-sm">{{ a.kejohanan }}</p>
                      <p class="text-xs text-gray-500">{{ a.tarikh }} — {{ a.pertandingan }}</p>
                    </div>
                    <span class="px-2 py-0.5 text-xs font-semibold rounded-full"
                      [class]="a.status === 'Disahkan' ? 'bg-green-100 text-green-700' : a.status === 'Dihantar' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'">
                      {{ a.status }}
                    </span>
                  </div>
                }
              </div>
            } @else {
              <p class="text-gray-400 text-sm text-center py-4">Tiada penilaian terkini.</p>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class PenilaiDashboardComponent implements OnInit {
  loading = true;
  userName = '';
  stats = { total_tugasan: 0, selesai: 0, belum_selesai: 0, pengadil_dinilai: 0 };
  recentAssessments: any[] = [];

  constructor(
    private api: ApiService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.userName = this.auth.currentUser?.nama_penuh || 'Penilai';
    this.api.get<any>('penilai-dashboard.php').pipe(
      timeout(15000),
      catchError(() => of({ error: true, data: { stats: this.stats, recent: [] } })),
      finalize(() => {
        this.loading = false;
      }),
    ).subscribe((res) => {
      if (!res.error) {
        const data = res.data || {};
        this.stats = data.stats || this.stats;
        this.recentAssessments = data.recent || [];
      }
    });
  }
}
