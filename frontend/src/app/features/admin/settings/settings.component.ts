import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [FormsModule, LoadingComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan tetapan..." />
    } @else {
      <div class="max-w-2xl">
        <!-- Maintenance Mode -->
        <div class="bg-linear-to-r from-orange-500 to-red-500 rounded-xl p-6 mb-6 text-white">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-bold">Mod Penyelenggaraan</h3>
              <p class="text-sm text-white/80 mt-1">Apabila diaktifkan, hanya Admin boleh akses sistem.</p>
            </div>
            <div class="flex items-center gap-3">
              @if (settings.maintenance_mode) {
                <span class="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full animate-pulse">AKTIF</span>
              }
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" [(ngModel)]="settings.maintenance_mode" class="sr-only peer" />
                <div class="w-11 h-6 bg-white/30 peer-checked:bg-white rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white peer-checked:after:bg-orange-500 after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
          </div>
        </div>

        <!-- Settings Card -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Applications Open -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Status Permohonan</label>
              <label class="flex items-center gap-3">
                <input type="checkbox" [(ngModel)]="settings.applications_open"
                  class="h-4 w-4 text-pahang-black border-gray-300 rounded" />
                <span class="text-sm text-gray-700">Permohonan Dibuka</span>
              </label>
              <p class="text-xs text-slate-500 mt-1">Aktifkan untuk membenarkan permohonan baru</p>
            </div>

            <!-- Application Year -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tahun Permohonan</label>
              <input type="number" [(ngModel)]="settings.application_year" min="2020" max="2030"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              <p class="text-xs text-slate-500 mt-1">Tahun semasa untuk permohonan</p>
            </div>

            <!-- Min Verified Matches -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Minimum Perlawanan Disahkan</label>
              <input type="number" [(ngModel)]="settings.min_verified_matches" min="1" max="100"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              <p class="text-xs text-slate-500 mt-1">Bilangan minimum perlawanan yang perlu disahkan</p>
            </div>

            <!-- Payment Amount -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Amaun Bayaran (RM)</label>
              <input type="number" [(ngModel)]="settings.payment_amount" min="0" step="0.01"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              <p class="text-xs text-slate-500 mt-1">Yuran permohonan dalam Ringgit Malaysia</p>
            </div>

            <!-- Max Applications Per Year -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Maksimum Permohonan Setahun</label>
              <input type="number" [(ngModel)]="settings.max_applications_per_year" min="1" max="10"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              <p class="text-xs text-slate-500 mt-1">Bilangan maksimum permohonan yang dibenarkan setahun</p>
            </div>

            <!-- Require Profile Complete -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Syarat Profil Lengkap</label>
              <label class="flex items-center gap-3">
                <input type="checkbox" [(ngModel)]="settings.require_profile_complete"
                  class="h-4 w-4 text-pahang-black border-gray-300 rounded" />
                <span class="text-sm text-gray-700">Wajib lengkapkan profil</span>
              </label>
              <p class="text-xs text-slate-500 mt-1">Pengguna mesti lengkapkan profil sebelum memohon</p>
            </div>

            <!-- Auto Link Matches -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Auto Link Perlawanan</label>
              <label class="flex items-center gap-3">
                <input type="checkbox" [(ngModel)]="settings.auto_link_matches"
                  class="h-4 w-4 text-pahang-black border-gray-300 rounded" />
                <span class="text-sm text-gray-700">Aktifkan auto-link</span>
              </label>
              <p class="text-xs text-slate-500 mt-1">Secara automatik link perlawanan yang disahkan kepada permohonan baru</p>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <button (click)="resetSettings()" [disabled]="resetting"
              class="px-4 py-2 text-slate-600 hover:text-slate-800 transition">
              {{ resetting ? 'Mereset...' : 'Reset' }}
            </button>
            <button (click)="save()" [disabled]="saving"
              class="px-6 py-2.5 bg-pahang-black text-pahang-yellow font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-60">
              {{ saving ? 'Menyimpan...' : 'Simpan Tetapan' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminSettingsComponent implements OnInit {
  loading = true;
  saving = false;
  resetting = false;
  settings: any = {
    maintenance_mode: false,
    applications_open: true,
    application_year: new Date().getFullYear(),
    min_verified_matches: 0,
    payment_amount: 0,
    max_applications_per_year: 1,
    require_profile_complete: true,
    auto_link_matches: true,
  };

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  private loadSettings(): void {
    this.loading = true;
    this.api.get<any>('admin-settings.php').subscribe({
      next: (res) => {
        if (!res.error && res.settings) {
          const s = res.settings;
          this.settings = {
            maintenance_mode: s.maintenance_mode === '1' || s.maintenance_mode === true,
            applications_open: s.applications_open === '1' || s.applications_open === true,
            application_year: s.application_year || new Date().getFullYear(),
            min_verified_matches: s.min_verified_matches || 0,
            payment_amount: s.payment_amount || 0,
            max_applications_per_year: s.max_applications_per_year || 1,
            require_profile_complete: s.require_profile_complete === '1' || s.require_profile_complete === true,
            auto_link_matches: s.auto_link_matches === '1' || s.auto_link_matches === true,
          };
        }
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  save(): void {
    this.saving = true;
    const payload: any = {};
    for (const key of Object.keys(this.settings)) {
      const val = this.settings[key];
      payload[key] = typeof val === 'boolean' ? (val ? '1' : '0') : String(val);
    }
    this.api.post<any>('admin-settings.php', payload).subscribe({
      next: (res) => {
        this.saving = false;
        if (!res.error) this.toast.success('Tetapan disimpan.');
        else this.toast.error(res.message);
      },
      error: () => {
        this.saving = false;
        this.toast.error('Gagal menyimpan tetapan.');
      },
    });
  }

  resetSettings(): void {
    if (!confirm('Adakah anda pasti mahu reset semua tetapan kepada nilai lalai?')) return;
    this.resetting = true;
    this.api.delete<any>('admin-settings.php').subscribe({
      next: (res) => {
        this.resetting = false;
        if (!res.error) {
          this.toast.success('Tetapan telah direset kepada nilai lalai.');
          this.loadSettings();
        } else {
          this.toast.error(res.message);
        }
      },
      error: () => {
        this.resetting = false;
        this.toast.error('Gagal reset tetapan.');
      },
    });
  }
}
