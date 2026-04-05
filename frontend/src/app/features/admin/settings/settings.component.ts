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
      <div class="max-w-4xl space-y-6">

        <!-- Maintenance Mode Banner -->
        <div class="rounded-xl p-5 flex items-center justify-between"
          [class]="settings.maintenance_mode ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-800'">
          <div class="flex items-center gap-3">
            <span class="material-icons text-2xl" [class]="settings.maintenance_mode ? 'text-white' : 'text-orange-500'">construction</span>
            <div>
              <p class="font-bold text-base">Mod Penyelenggaraan</p>
              <p class="text-sm opacity-75">Apabila aktif, hanya Admin boleh akses sistem.</p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" [(ngModel)]="settings.maintenance_mode" (ngModelChange)="quickSave('maintenance_mode', $event ? '1':'0')" class="sr-only peer" />
            <div class="w-14 h-7 bg-white/30 peer-checked:bg-white rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-gray-400 peer-checked:after:bg-red-600 after:rounded-full after:h-6 after:w-6 after:transition-all border border-white/40"></div>
          </label>
        </div>

        <!-- Per-Type Application Status -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <span class="material-icons text-pahang-yellow">assignment</span>
            <h2 class="font-bold text-slate-800">Status Penerimaan Permohonan</h2>
          </div>
          <div class="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

            <!-- Pendaftaran Akaun Baru -->
            <div class="rounded-xl border-2 p-5 space-y-4 transition"
              [class]="settings.registration_open ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-slate-50'">
              <div class="flex items-start justify-between">
                <div>
                  <p class="font-bold text-slate-800 text-sm">Daftar Akaun Baru</p>
                  <p class="text-xs text-slate-500 mt-0.5">Halaman /daftar — pengadil baru cipta akaun</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer mt-0.5">
                  <input type="checkbox" [(ngModel)]="settings.registration_open" class="sr-only peer" />
                  <div class="w-12 h-6 bg-slate-300 peer-checked:bg-teal-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
              <div class="text-center py-1">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  [class]="settings.registration_open ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'">
                  <span class="w-1.5 h-1.5 rounded-full inline-block" [class]="settings.registration_open ? 'bg-teal-500 animate-pulse' : 'bg-red-500'"></span>
                  {{ settings.registration_open ? 'DIBUKA' : 'DITUTUP' }}
                </span>
              </div>
              <div class="space-y-2">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Buka</label>
                  <input type="date" [(ngModel)]="settings.registration_open_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Tutup</label>
                  <input type="date" [(ngModel)]="settings.registration_close_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
              </div>
            </div>

            <!-- Permohonan Berdaftar -->
            <div class="rounded-xl border-2 p-5 space-y-4 transition"
              [class]="settings.berdaftar_open ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-slate-50'">
              <div class="flex items-start justify-between">
                <div>
                  <p class="font-bold text-slate-800 text-sm">Permohonan Pendaftaran Tahunan</p>
                  <p class="text-xs text-slate-500 mt-0.5">Menu Permohonan — R1 + R2 + Ujian Kecergasan (R4)</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer mt-0.5">
                  <input type="checkbox" [(ngModel)]="settings.berdaftar_open" class="sr-only peer" />
                  <div class="w-12 h-6 bg-slate-300 peer-checked:bg-green-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
              <div class="text-center py-1">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  [class]="settings.berdaftar_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                  <span class="w-1.5 h-1.5 rounded-full inline-block" [class]="settings.berdaftar_open ? 'bg-green-500 animate-pulse' : 'bg-red-500'"></span>
                  {{ settings.berdaftar_open ? 'DIBUKA' : 'DITUTUP' }}
                </span>
              </div>
              <div class="space-y-2">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Buka</label>
                  <input type="date" [(ngModel)]="settings.berdaftar_open_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Tutup</label>
                  <input type="date" [(ngModel)]="settings.berdaftar_close_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
              </div>
            </div>

            <!-- Bertulis -->
            <div class="rounded-xl border-2 p-5 space-y-4 transition"
              [class]="settings.bertulis_open ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'">
              <div class="flex items-start justify-between">
                <div>
                  <p class="font-bold text-slate-800 text-sm">Ujian Kelas III FAM</p>
                  <p class="text-xs text-slate-500 mt-0.5">Borang R11 — Ujian Bertulis</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer mt-0.5">
                  <input type="checkbox" [(ngModel)]="settings.bertulis_open" class="sr-only peer" />
                  <div class="w-12 h-6 bg-slate-300 peer-checked:bg-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
              <div class="text-center py-1">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  [class]="settings.bertulis_open ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'">
                  <span class="w-1.5 h-1.5 rounded-full inline-block" [class]="settings.bertulis_open ? 'bg-blue-500 animate-pulse' : 'bg-red-500'"></span>
                  {{ settings.bertulis_open ? 'DIBUKA' : 'DITUTUP' }}
                </span>
              </div>
              <div class="space-y-2">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Buka</label>
                  <input type="date" [(ngModel)]="settings.bertulis_open_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Tutup</label>
                  <input type="date" [(ngModel)]="settings.bertulis_close_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
              </div>
            </div>

            <!-- Kelas 1 -->
            <div class="rounded-xl border-2 p-5 space-y-4 transition"
              [class]="settings.kelas1_open ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-slate-50'">
              <div class="flex items-start justify-between">
                <div>
                  <p class="font-bold text-slate-800 text-sm">Ujian Kelas I FAM</p>
                  <p class="text-xs text-slate-500 mt-0.5">Borang R11 — Kelas I</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer mt-0.5">
                  <input type="checkbox" [(ngModel)]="settings.kelas1_open" class="sr-only peer" />
                  <div class="w-12 h-6 bg-slate-300 peer-checked:bg-purple-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
              <div class="text-center py-1">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  [class]="settings.kelas1_open ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'">
                  <span class="w-1.5 h-1.5 rounded-full inline-block" [class]="settings.kelas1_open ? 'bg-purple-500 animate-pulse' : 'bg-red-500'"></span>
                  {{ settings.kelas1_open ? 'DIBUKA' : 'DITUTUP' }}
                </span>
              </div>
              <div class="space-y-2">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Buka</label>
                  <input type="date" [(ngModel)]="settings.kelas1_open_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Tutup</label>
                  <input type="date" [(ngModel)]="settings.kelas1_close_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
              </div>
            </div>

            <!-- Penilai -->
            <div class="rounded-xl border-2 p-5 space-y-4 transition"
              [class]="settings.penilai_open ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'">
              <div class="flex items-start justify-between">
                <div>
                  <p class="font-bold text-slate-800 text-sm">Pendaftaran Penilai</p>
                  <p class="text-xs text-slate-500 mt-0.5">Borang R4 — Penilai Pengadil Negeri</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer mt-0.5">
                  <input type="checkbox" [(ngModel)]="settings.penilai_open" class="sr-only peer" />
                  <div class="w-12 h-6 bg-slate-300 peer-checked:bg-amber-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
              <div class="text-center py-1">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  [class]="settings.penilai_open ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'">
                  <span class="w-1.5 h-1.5 rounded-full inline-block" [class]="settings.penilai_open ? 'bg-amber-500 animate-pulse' : 'bg-red-500'"></span>
                  {{ settings.penilai_open ? 'DIBUKA' : 'DITUTUP' }}
                </span>
              </div>
              <div class="space-y-2">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Buka</label>
                  <input type="date" [(ngModel)]="settings.penilai_open_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Tarikh Tutup</label>
                  <input type="date" [(ngModel)]="settings.penilai_close_date"
                    class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs" />
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Payment Info + Year -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <span class="material-icons text-pahang-yellow">account_balance</span>
            <h2 class="font-bold text-slate-800">Maklumat Bayaran & Sesi</h2>
          </div>
          <div class="p-6 space-y-5">
            <!-- Sesi -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Tahun Sesi Permohonan</label>
                <input type="number" [(ngModel)]="settings.application_year" min="2020" max="2035"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <p class="text-xs text-slate-400 mt-1">Semua permohonan baru akan menggunakan tahun ini</p>
              </div>
            </div>

            <!-- Bayaran Pendaftaran Akaun Baru (RA) -->
            <div class="border-t pt-5">
              <p class="text-xs font-bold text-teal-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span class="material-icons text-sm">person_add</span> Bayaran Pendaftaran Akaun Baru (RA)
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Yuran Pendaftaran Akaun (RM)</label>
                  <input type="number" [(ngModel)]="settings.registration_fee" min="0" step="0.01"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <p class="text-xs text-slate-400 mt-1">Yuran untuk daftar akaun baru (RA)</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Nama Bank</label>
                  <input type="text" [(ngModel)]="settings.registration_bank_name"
                    placeholder="Cth: Bank Kerjasama Rakyat Malaysia"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Nama Akaun</label>
                  <input type="text" [(ngModel)]="settings.registration_account_name"
                    placeholder="Cth: Persatuan Bolasepak Negeri Pahang"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Nombor Akaun Bank</label>
                  <input type="text" [(ngModel)]="settings.registration_account_no"
                    placeholder="Cth: 1102051936"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                </div>
              </div>
            </div>

            <!-- Bayaran Permohonan Tahunan -->
            <div class="border-t pt-5">
              <p class="text-xs font-bold text-green-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span class="material-icons text-sm">assignment</span> Bayaran Permohonan Tahunan (R1)
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Yuran Permohonan (RM)</label>
                  <input type="number" [(ngModel)]="settings.payment_amount" min="0" step="0.01"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <p class="text-xs text-slate-400 mt-1">Jumlah yang perlu dibayar oleh pemohon</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Nama Bank</label>
                  <input type="text" [(ngModel)]="settings.payment_bank_name"
                    placeholder="Cth: Bank Kerjasama Rakyat Malaysia"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Nama Akaun</label>
                  <input type="text" [(ngModel)]="settings.payment_account_name"
                    placeholder="Cth: Persatuan Bolasepak Negeri Pahang"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Nombor Akaun Bank</label>
                  <input type="text" [(ngModel)]="settings.payment_account_no"
                    placeholder="Cth: 1102051936"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Syarat Permohonan -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <span class="material-icons text-pahang-yellow">rule</span>
            <h2 class="font-bold text-slate-800">Syarat & Kelayakan</h2>
          </div>
          <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Minimum Perlawanan Disahkan</label>
              <input type="number" [(ngModel)]="settings.min_verified_matches" min="0" max="200"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <p class="text-xs text-slate-400 mt-1">Untuk permohonan Pendaftaran Tahunan (R1)</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Maks. Permohonan Setahun</label>
              <input type="number" [(ngModel)]="settings.max_applications_per_year" min="1" max="10"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <p class="text-xs text-slate-400 mt-1">Per jenis borang, per pengguna</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Syarat Profil Lengkap</label>
              <label class="flex items-center gap-3 cursor-pointer">
                <div class="relative inline-flex items-center">
                  <input type="checkbox" [(ngModel)]="settings.require_profile_complete" class="sr-only peer" />
                  <div class="w-10 h-5 bg-slate-300 peer-checked:bg-pahang-black rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </div>
                <span class="text-sm text-slate-700">Wajib lengkapkan profil sebelum memohon</span>
              </label>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Auto-Link Perlawanan</label>
              <label class="flex items-center gap-3 cursor-pointer">
                <div class="relative inline-flex items-center">
                  <input type="checkbox" [(ngModel)]="settings.auto_link_matches" class="sr-only peer" />
                  <div class="w-10 h-5 bg-slate-300 peer-checked:bg-pahang-black rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </div>
                <span class="text-sm text-slate-700">Auto link perlawanan disahkan ke permohonan baru</span>
              </label>
            </div>
          </div>
        </div>

        <!-- FAM Examination Settings -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <span class="material-icons text-pahang-yellow">school</span>
            <h2 class="font-bold text-slate-800">Tetapan Peperiksaan FAM</h2>
            <span class="ml-2 text-xs text-slate-400">Ujian Kelas III &amp; Kelas I</span>
          </div>
          <div class="p-6 space-y-5">
            <!-- FAM Bank Info -->
            <div>
              <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Maklumat Bank FAM (Dikongsi Kelas III &amp; Kelas I)</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Nama Bank FAM</label>
                  <input type="text" [(ngModel)]="settings.fam_bank_name"
                    placeholder="Bank Islam Persatuan Bolasepak Malaysia"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Nombor Akaun FAM</label>
                  <input type="text" [(ngModel)]="settings.fam_account_no"
                    placeholder="1213 1010 0061 21"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                </div>
              </div>
            </div>
            <!-- Kelas III -->
            <div class="border-t pt-5">
              <p class="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span class="material-icons text-sm">history_edu</span> Ujian Kelas III (Bertulis)
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Yuran (RM)</label>
                  <input type="number" [(ngModel)]="settings.bertulis_fee" min="0" step="0.01"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <p class="text-xs text-slate-400 mt-1">Lalai: RM50</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Had Umur Minimum (tahun)</label>
                  <input type="number" [(ngModel)]="settings.bertulis_min_age" min="10" max="50"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <p class="text-xs text-slate-400 mt-1">Lalai: 15 tahun</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Had Umur Maksimum (tahun)</label>
                  <input type="number" [(ngModel)]="settings.bertulis_max_age" min="10" max="60"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <p class="text-xs text-slate-400 mt-1">Lalai: 40 tahun</p>
                </div>
              </div>
            </div>
            <!-- Kelas I -->
            <div class="border-t pt-5">
              <p class="text-xs font-bold text-purple-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span class="material-icons text-sm">workspace_premium</span> Ujian Kelas I FAM
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Yuran (RM)</label>
                  <input type="number" [(ngModel)]="settings.kelas1_fee" min="0" step="0.01"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <p class="text-xs text-slate-400 mt-1">Lalai: RM300</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Had Umur Maksimum (tahun)</label>
                  <input type="number" [(ngModel)]="settings.kelas1_max_age" min="20" max="60"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <p class="text-xs text-slate-400 mt-1">Lalai: 32 tahun</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Min. Pusingan Kecergasan</label>
                  <input type="number" [(ngModel)]="settings.kelas1_min_fitness_rounds" min="1" max="20"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <p class="text-xs text-slate-400 mt-1">Lalai: 7 pusingan (Ujian Kecergasan Negeri)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Telegram Blast -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <span class="material-icons text-[#0088CC]">send</span>
            <h2 class="font-bold text-slate-800">Blast Telegram Activation</h2>
          </div>
          <div class="p-6">
            <p class="text-sm text-slate-600 mb-4">Hantar emel pengaktifan Telegram kepada semua pengadil aktif yang <strong>belum</strong> menghubungkan akaun Telegram mereka.</p>

            @if (tgStats) {
              <div class="grid grid-cols-3 gap-3 mb-5">
                <div class="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
                  <p class="text-2xl font-bold text-slate-800">{{ tgStats.total }}</p>
                  <p class="text-xs text-slate-500">Jumlah Pengguna</p>
                </div>
                <div class="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                  <p class="text-2xl font-bold text-green-600">{{ tgStats.linked }}</p>
                  <p class="text-xs text-green-600">Sudah Aktif</p>
                </div>
                <div class="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                  <p class="text-2xl font-bold text-amber-600">{{ tgStats.not_linked }}</p>
                  <p class="text-xs text-amber-600">Belum Aktif</p>
                </div>
              </div>
            }

            @if (tgBlastResult) {
              <div class="mb-4 rounded-lg p-3 text-sm font-medium"
                [class]="tgBlastResult.failed > 0 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-green-50 border border-green-200 text-green-800'">
                <span class="material-icons text-sm align-middle mr-1">{{ tgBlastResult.failed > 0 ? 'warning' : 'check_circle' }}</span>
                {{ tgBlastResult.message }}
              </div>
            }

            <div class="flex items-center gap-3">
              <button (click)="loadTelegramStats()" [disabled]="tgLoading"
                class="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-60">
                <span class="material-icons text-sm">refresh</span>
                {{ tgLoading ? 'Memuatkan...' : 'Semak Status' }}
              </button>
              <button (click)="sendTelegramBlast()" [disabled]="tgBlasting || !tgStats || tgStats.not_linked === 0"
                class="flex items-center gap-2 px-5 py-2 bg-[#0088CC] text-white font-bold rounded-lg hover:bg-[#006FA3] transition disabled:opacity-60 text-sm">
                <span class="material-icons text-sm">{{ tgBlasting ? 'hourglass_top' : 'send' }}</span>
                {{ tgBlasting ? 'Menghantar emel...' : 'Hantar Blast Emel' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between">
          <button (click)="resetSettings()" [disabled]="resetting"
            class="px-4 py-2 text-sm text-slate-500 hover:text-red-600 transition flex items-center gap-1.5">
            <span class="material-icons text-sm">restart_alt</span>
            {{ resetting ? 'Mereset...' : 'Reset ke Nilai Lalai' }}
          </button>
          <button (click)="save()" [disabled]="saving"
            class="flex items-center gap-2 px-6 py-2.5 bg-pahang-black text-pahang-yellow font-bold rounded-lg hover:bg-gray-800 transition disabled:opacity-60 text-sm">
            <span class="material-icons text-sm">save</span>
            {{ saving ? 'Menyimpan...' : 'Simpan Semua Tetapan' }}
          </button>
        </div>

      </div>
    }
  `,
})
export class AdminSettingsComponent implements OnInit {
  loading = true;
  saving = false;
  resetting = false;
  tgStats: { total: number; linked: number; not_linked: number } | null = null;
  tgLoading = false;
  tgBlasting = false;
  tgBlastResult: { message: string; sent: number; failed: number } | null = null;
  settings: any = {
    maintenance_mode: false,
    registration_open: true,
    registration_open_date: '',
    registration_close_date: '',
    registration_fee: 0,
    registration_bank_name: '',
    registration_account_name: '',
    registration_account_no: '',
    berdaftar_open: false,
    bertulis_open: false,
    kelas1_open: false,
    penilai_open: false,
    berdaftar_open_date: '',
    berdaftar_close_date: '',
    bertulis_open_date: '',
    bertulis_close_date: '',
    kelas1_open_date: '',
    kelas1_close_date: '',
    penilai_open_date: '',
    penilai_close_date: '',
    application_year: new Date().getFullYear(),
    payment_amount: 80,
    payment_bank_name: '',
    payment_account_name: '',
    payment_account_no: '',
    min_verified_matches: 20,
    max_applications_per_year: 1,
    require_profile_complete: true,
    auto_link_matches: false,
    fam_bank_name: 'Bank Islam Persatuan Bolasepak Malaysia',
    fam_account_no: '1213 1010 0061 21',
    bertulis_fee: 50,
    bertulis_min_age: 15,
    bertulis_max_age: 40,
    kelas1_fee: 300,
    kelas1_max_age: 32,
    kelas1_min_fitness_rounds: 7,
  };

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void { this.loadSettings(); }

  private bool(v: any): boolean { return v === '1' || v === true; }

  private loadSettings(): void {
    this.loading = true;
    this.api.get<any>('admin-settings.php').subscribe({
      next: (res) => {
        if (!res.error && res.settings) {
          const s = res.settings;
          this.settings = {
            maintenance_mode:         this.bool(s.maintenance_mode),
            registration_open:        this.bool(s.registration_open ?? '1'),
            registration_open_date:   s.registration_open_date  || '',
            registration_close_date:  s.registration_close_date || '',
            registration_fee:         s.registration_fee         || 0,
            registration_bank_name:   s.registration_bank_name   || '',
            registration_account_name:s.registration_account_name|| '',
            registration_account_no:  s.registration_account_no  || '',
            berdaftar_open:           this.bool(s.berdaftar_open),
            bertulis_open:            this.bool(s.bertulis_open),
            kelas1_open:              this.bool(s.kelas1_open),
            penilai_open:             this.bool(s.penilai_open),
            berdaftar_open_date:      s.berdaftar_open_date    || '',
            berdaftar_close_date:     s.berdaftar_close_date   || '',
            bertulis_open_date:       s.bertulis_open_date     || '',
            bertulis_close_date:      s.bertulis_close_date    || '',
            kelas1_open_date:         s.kelas1_open_date       || '',
            kelas1_close_date:        s.kelas1_close_date      || '',
            penilai_open_date:        s.penilai_open_date      || '',
            penilai_close_date:       s.penilai_close_date     || '',
            application_year:         s.application_year       || new Date().getFullYear(),
            payment_amount:           s.payment_amount         || 80,
            payment_bank_name:        s.payment_bank_name      || '',
            payment_account_name:     s.payment_account_name   || '',
            payment_account_no:       s.payment_account_no     || '',
            min_verified_matches:     s.min_verified_matches   || 20,
            max_applications_per_year:s.max_applications_per_year || 1,
            require_profile_complete: this.bool(s.require_profile_complete),
            auto_link_matches:        this.bool(s.auto_link_matches),
            fam_bank_name:            s.fam_bank_name            || 'Bank Islam Persatuan Bolasepak Malaysia',
            fam_account_no:           s.fam_account_no           || '1213 1010 0061 21',
            bertulis_fee:             s.bertulis_fee             || 50,
            bertulis_min_age:         s.bertulis_min_age         || 15,
            bertulis_max_age:         s.bertulis_max_age         || 40,
            kelas1_fee:               s.kelas1_fee               || 300,
            kelas1_max_age:           s.kelas1_max_age           || 32,
            kelas1_min_fitness_rounds:s.kelas1_min_fitness_rounds|| 7,
          };
        }
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  quickSave(key: string, value: string): void {
    this.api.post<any>('admin-settings.php', { [key]: value }).subscribe({
      next: (res) => { if (!res.error) this.toast.success('Tetapan disimpan.'); },
    });
  }

  save(): void {
    this.saving = true;
    const payload: any = {};
    for (const key of Object.keys(this.settings)) {
      const val = this.settings[key];
      payload[key] = typeof val === 'boolean' ? (val ? '1' : '0') : String(val ?? '');
    }
    this.api.post<any>('admin-settings.php', payload).subscribe({
      next: (res) => {
        this.saving = false;
        if (!res.error) this.toast.success('Semua tetapan berjaya disimpan.');
        else this.toast.error(res.message);
      },
      error: (err: any) => { this.saving = false; this.toast.error(err?.error?.message || 'Gagal menyimpan tetapan.'); },
    });
  }

  resetSettings(): void {
    if (!confirm('Reset semua tetapan kepada nilai lalai?')) return;
    this.resetting = true;
    this.api.delete<any>('admin-settings.php').subscribe({
      next: (res) => {
        this.resetting = false;
        if (!res.error) { this.toast.success('Tetapan direset.'); this.loadSettings(); }
        else this.toast.error(res.message);
      },
      error: (err: any) => { this.resetting = false; this.toast.error(err?.error?.message || 'Gagal reset.'); },
    });
  }

  loadTelegramStats(): void {
    this.tgLoading = true;
    this.api.get<any>('admin-telegram-blast.php').subscribe({
      next: (res) => {
        this.tgLoading = false;
        if (!res.error) {
          this.tgStats = { total: res.total, linked: res.linked, not_linked: res.not_linked };
        }
      },
      error: () => { this.tgLoading = false; this.toast.error('Gagal memuatkan statistik Telegram.'); },
    });
  }

  sendTelegramBlast(): void {
    if (!confirm(`Hantar emel pengaktifan Telegram kepada ${this.tgStats?.not_linked} pengguna?`)) return;
    this.tgBlasting = true;
    this.tgBlastResult = null;
    this.api.post<any>('admin-telegram-blast.php', {}).subscribe({
      next: (res) => {
        this.tgBlasting = false;
        if (!res.error) {
          this.tgBlastResult = { message: res.message, sent: res.sent, failed: res.failed };
          this.toast.success(res.message);
          this.loadTelegramStats();
        } else {
          this.toast.error(res.message);
        }
      },
      error: (err: any) => {
        this.tgBlasting = false;
        this.toast.error(err?.error?.message || 'Gagal menghantar blast.');
      },
    });
  }
}
