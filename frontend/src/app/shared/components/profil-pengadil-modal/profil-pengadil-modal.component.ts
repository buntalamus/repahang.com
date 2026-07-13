import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileModalService } from '../../../core/services/profile-modal.service';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

interface ProfilPengadil {
  id: number;
  nama_penuh: string;
  url_gambar_profil: string | null;
  role: string;
  jenis_pengadil: string | null;
  jenis_penilai: string | null;
  tahun_mula_aktif: number | null;
  tahun_mohon_kelas3: number | null;
  tahun_lulus_kelas3: number | null;
  pengadil_kebangsaan: number;
  pengadil_negeri: number;
  pengadil_daerah: number;
  aktif: number;
  jantina: string | null;
  saiz_baju: string | null;
  telegram_linked: number;
  email?: string;
  no_telefon?: string;
  no_ic?: string;
  alamat1?: string;
  alamat2?: string;
  poskod?: string;
  daerah?: string;
  negeri?: string;
  status_kerja?: string;
  jawatan?: string;
  nama_majikan?: string;
  nama_waris?: string;
  hubungan_waris?: string;
  telefon_waris?: string;
  nama_persatuan: string | null;
  daerah_persatuan: string | null;
  persatuan_id?: number | null;
  boleh_kemaskini?: number;
  stats: {
    tugasan_total: number;
    tugasan_diterima: number;
    tugasan_ditolak: number;
    tugasan_belum: number;
    jumlah_perlawanan: number;
  };
  permohonan: any[];
  perlawanan: any[];
  ujian_kecergasan: any[];
}

interface EditForm {
  nama_penuh: string;
  no_ic: string;
  jantina: string;
  no_telefon: string;
  email: string;
  saiz_baju: string;
  alamat1: string;
  alamat2: string;
  poskod: string;
  daerah: string;
  negeri: string;
  status_kerja: string;
  jawatan: string;
  nama_majikan: string;
  nama_waris: string;
  hubungan_waris: string;
  telefon_waris: string;
  jenis_pengadil: string;
  tahun_mula_aktif: number | null;
  tahun_mohon_kelas3: number | null;
  tahun_lulus_kelas3: number | null;
  persatuan_id: number | null;
  aktif: number;
}

@Component({
  selector: 'app-profil-pengadil-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (modal.userId(); as uid) {
      <div class="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-2 sm:p-4" (click)="modal.close()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
          role="dialog" aria-modal="true" aria-label="Profil Pengadil"
          (click)="$event.stopPropagation()">

          @if (loading()) {
            <div class="p-16 text-center text-slate-400 text-sm">Memuatkan profil…</div>
          } @else if (profil(); as p) {
            <!-- Header -->
            <div class="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 pt-5 pb-4 relative shrink-0">
              <button (click)="modal.close()" aria-label="Tutup"
                class="absolute top-3 right-3 text-slate-400 hover:text-slate-700 text-xl leading-none px-2 py-1">✕</button>
              @if (p.boleh_kemaskini && !editMode()) {
                <button (click)="startEdit(p)"
                  class="absolute top-3.5 right-12 px-2.5 py-1 rounded-lg border border-slate-300 bg-white
                         text-[11px] font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition">
                  ✎ Kemaskini
                </button>
              }
              <div class="flex items-center gap-3 sm:gap-4">
                @if (p.url_gambar_profil) {
                  <img [src]="imgUrl(p.url_gambar_profil)" alt=""
                    class="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-amber-400 shrink-0">
                } @else {
                  <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-amber-500 text-xl font-bold shadow-sm
                              flex items-center justify-center border-2 border-amber-400 shrink-0">
                    {{ inisial(p.nama_penuh) }}
                  </div>
                }
                <div class="min-w-0">
                  <h2 class="text-slate-900 font-bold text-sm sm:text-base leading-snug pr-8">{{ p.nama_penuh }}</h2>
                  <p class="text-slate-500 text-xs mt-0.5 break-words">
                    {{ p.jenis_pengadil || p.role }}@if (p.daerah_persatuan) { · {{ p.daerah_persatuan }}}@if (p.email) { · {{ p.email }}}
                  </p>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    @if (p.pengadil_kebangsaan) {
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-900">PENGADIL KEBANGSAAN</span>
                    }
                    @if (p.pengadil_negeri) {
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">PENGADIL NEGERI</span>
                    }
                    @if (p.pengadil_daerah) {
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500 text-white">PENGADIL DAERAH</span>
                    }
                    @if (!(+p.aktif)) {
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white">TIDAK AKTIF</span>
                    }
                  </div>
                </div>
              </div>
              <!-- Toggle taraf (Admin sahaja) -->
              @if (isAdmin) {
                <div class="flex gap-1.5 mt-3">
                  <button (click)="toggleTaraf(p, 'kebangsaan')" [disabled]="savingTaraf()"
                    class="flex-1 py-1 rounded text-[10px] font-semibold border transition"
                    [class]="p.pengadil_kebangsaan
                      ? 'bg-amber-400 border-amber-400 text-slate-900'
                      : 'bg-white border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-600'">
                    Kebangsaan
                  </button>
                  <button (click)="toggleTaraf(p, 'negeri')" [disabled]="savingTaraf()"
                    class="flex-1 py-1 rounded text-[10px] font-semibold border transition"
                    [class]="p.pengadil_negeri
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600'">
                    Negeri
                  </button>
                  <button (click)="toggleTaraf(p, 'daerah')" [disabled]="savingTaraf()"
                    class="flex-1 py-1 rounded text-[10px] font-semibold border transition"
                    [class]="p.pengadil_daerah
                      ? 'bg-slate-500 border-slate-500 text-white'
                      : 'bg-white border-slate-300 text-slate-500 hover:border-slate-500 hover:text-slate-700'">
                    Daerah
                  </button>
                </div>
              }
            </div>

            @if (!editMode()) {
            <!-- Tab bar -->
            <div class="border-b border-slate-200 px-4 sm:px-6 shrink-0">
              <div class="flex gap-4 sm:gap-5 overflow-x-auto">
                <button (click)="tab.set('maklumat')"
                  class="py-2.5 text-xs font-semibold border-b-2 -mb-px transition"
                  [class]="tab() === 'maklumat' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'">
                  Maklumat
                </button>
                <button (click)="tab.set('permohonan')"
                  class="py-2.5 text-xs font-semibold border-b-2 -mb-px transition"
                  [class]="tab() === 'permohonan' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'">
                  Permohonan
                  @if (p.permohonan.length) { <span class="text-[9px] text-slate-400">({{ p.permohonan.length }})</span> }
                </button>
                <button (click)="tab.set('perlawanan')"
                  class="py-2.5 text-xs font-semibold border-b-2 -mb-px transition"
                  [class]="tab() === 'perlawanan' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'">
                  Perlawanan
                  @if (p.perlawanan.length) { <span class="text-[9px] text-slate-400">({{ p.perlawanan.length }})</span> }
                </button>
              </div>
            </div>

            <!-- Kandungan tab -->
            <div class="overflow-y-auto flex-1">

              <!-- TAB: MAKLUMAT -->
              @if (tab() === 'maklumat') {
                <div class="p-4 sm:p-5 space-y-5">
                  <!-- Statistik tugasan -->
                  <div class="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                    <div class="bg-slate-100 rounded-lg py-2">
                      <p class="font-bold text-slate-800 text-sm">{{ p.stats.tugasan_total }}</p>
                      <p class="text-[9px] text-slate-500">Tugasan</p>
                    </div>
                    <div class="bg-emerald-50 rounded-lg py-2">
                      <p class="font-bold text-emerald-700 text-sm">{{ p.stats.tugasan_diterima }}</p>
                      <p class="text-[9px] text-emerald-600">Diterima</p>
                    </div>
                    <div class="bg-rose-50 rounded-lg py-2">
                      <p class="font-bold text-rose-700 text-sm">{{ p.stats.tugasan_ditolak }}</p>
                      <p class="text-[9px] text-rose-600">Ditolak</p>
                    </div>
                    <div class="bg-amber-50 rounded-lg py-2">
                      <p class="font-bold text-amber-700 text-sm">{{ p.stats.tugasan_belum }}</p>
                      <p class="text-[9px] text-amber-600">Belum</p>
                    </div>
                    <div class="bg-blue-50 rounded-lg py-2">
                      <p class="font-bold text-blue-700 text-sm">{{ p.stats.jumlah_perlawanan }}</p>
                      <p class="text-[9px] text-blue-600">Perlawanan</p>
                    </div>
                  </div>

                  <!-- Kelayakan -->
                  <div>
                    <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Kelayakan</h4>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div class="bg-slate-50 rounded-lg p-2.5">
                        <p class="text-slate-400">Tahun Mohon Kelas 3</p>
                        <p class="font-semibold text-slate-800 text-sm">{{ p.tahun_mohon_kelas3 || '—' }}</p>
                      </div>
                      <div class="bg-slate-50 rounded-lg p-2.5">
                        <p class="text-slate-400">Tahun Lulus Kelas 3</p>
                        <p class="font-semibold text-slate-800 text-sm">{{ p.tahun_lulus_kelas3 || '—' }}</p>
                      </div>
                      <div class="bg-slate-50 rounded-lg p-2.5">
                        <p class="text-slate-400">Tahun Mula Aktif</p>
                        <p class="font-semibold text-slate-800 text-sm">{{ p.tahun_mula_aktif || '—' }}</p>
                      </div>
                      <div class="bg-slate-50 rounded-lg p-2.5">
                        <p class="text-slate-400">Saiz Baju</p>
                        <p class="font-semibold text-slate-800 text-sm">{{ p.saiz_baju || '—' }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Ujian kecergasan tahunan -->
                  <div>
                    <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Ujian Kecergasan Tahunan
                      <span class="normal-case font-normal text-slate-400">(lulus = layak patch Pengadil Negeri)</span>
                    </h4>
                    @if (p.ujian_kecergasan.length) {
                      <div class="flex flex-wrap gap-1.5">
                        @for (uk of p.ujian_kecergasan; track uk.id) {
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
                            [title]="'Dihantar: ' + tarikhHantar(uk)"
                            [class]="uk.status_ujian === 'Lulus'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : uk.status_ujian === 'Tidak Lulus' || uk.status_ujian === 'Tidak Hadir'
                                ? 'bg-rose-50 border-rose-200 text-rose-600'
                                : 'bg-amber-50 border-amber-200 text-amber-600'">
                            {{ tahunApp(uk) }}
                            <span class="font-bold">{{ uk.status_ujian || 'Belum Diproses' }}</span>
                          </span>
                        }
                      </div>
                    } @else {
                      <p class="text-xs text-slate-400">Tiada rekod ujian kecergasan.</p>
                    }
                  </div>

                  <!-- Maklumat peribadi -->
                  <div>
                    <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Maklumat Peribadi</h4>
                    <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                      @if (p.no_ic) {
                        <div>
                          <p class="text-slate-400">No. Kad Pengenalan</p>
                          <p class="font-medium text-slate-800 font-mono">{{ p.no_ic }}</p>
                        </div>
                        <div>
                          <p class="text-slate-400">Umur</p>
                          <p class="font-medium text-slate-800">{{ umurDariIC(p.no_ic) || '—' }}</p>
                        </div>
                      }
                      <div>
                        <p class="text-slate-400">Jantina</p>
                        <p class="font-medium text-slate-800">{{ jantinaLabel(p.jantina) }}</p>
                      </div>
                      <div>
                        <p class="text-slate-400">Persatuan (PBD)</p>
                        <p class="font-medium text-slate-800">{{ p.nama_persatuan || '—' }}</p>
                      </div>
                      @if (p.no_telefon) {
                        <div>
                          <p class="text-slate-400">No. Telefon</p>
                          <p class="font-medium text-slate-800">{{ p.no_telefon }}</p>
                        </div>
                      }
                      @if (p.email) {
                        <div>
                          <p class="text-slate-400">Emel</p>
                          <p class="font-medium text-slate-800 break-all">{{ p.email }}</p>
                        </div>
                      }
                      <div>
                        <p class="text-slate-400">Telegram</p>
                        <p class="font-medium" [class]="p.telegram_linked ? 'text-emerald-600' : 'text-slate-400'">
                          {{ p.telegram_linked ? 'Disambungkan' : 'Belum disambungkan' }}
                        </p>
                      </div>
                    </div>
                  </div>

                  @if (p.alamat1) {
                    <div>
                      <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Alamat</h4>
                      <p class="text-xs text-slate-800">{{ p.alamat1 }}{{ p.alamat2 ? ', ' + p.alamat2 : '' }}</p>
                      <p class="text-xs text-slate-500 mt-0.5">{{ p.poskod || '' }} <span class="uppercase">{{ p.daerah || '' }}</span>{{ p.negeri ? ', ' + p.negeri : '' }}</p>
                    </div>
                  }

                  @if (p.status_kerja || p.nama_majikan) {
                    <div>
                      <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pekerjaan</h4>
                      <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-xs">
                        <div>
                          <p class="text-slate-400">Status</p>
                          <p class="font-medium text-slate-800">{{ p.status_kerja || '—' }}</p>
                        </div>
                        <div>
                          <p class="text-slate-400">Jawatan</p>
                          <p class="font-medium text-slate-800">{{ p.jawatan || '—' }}</p>
                        </div>
                        <div>
                          <p class="text-slate-400">Majikan</p>
                          <p class="font-medium text-slate-800">{{ p.nama_majikan || '—' }}</p>
                        </div>
                      </div>
                    </div>
                  }

                  @if (p.nama_waris) {
                    <div>
                      <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Waris</h4>
                      <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-xs">
                        <div>
                          <p class="text-slate-400">Nama</p>
                          <p class="font-medium text-slate-800">{{ p.nama_waris }}</p>
                        </div>
                        <div>
                          <p class="text-slate-400">Hubungan</p>
                          <p class="font-medium text-slate-800">{{ p.hubungan_waris || '—' }}</p>
                        </div>
                        <div>
                          <p class="text-slate-400">No. Telefon</p>
                          <p class="font-medium text-slate-800">{{ p.telefon_waris || '—' }}</p>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- TAB: PERMOHONAN -->
              @if (tab() === 'permohonan') {
                <div class="p-4 sm:p-5">
                  @if (p.permohonan.length) {
                    <!-- Kad (mobile) -->
                    <div class="sm:hidden space-y-2">
                      @for (app of p.permohonan; track app.id) {
                        <div class="border border-slate-200 rounded-lg p-3">
                          <div class="flex items-start justify-between gap-2">
                            <p class="text-xs font-semibold text-slate-800 leading-snug">{{ jenisBorangLabel(app.jenis_borang) }}</p>
                            <span class="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">{{ tarikhHantar(app) }}</span>
                          </div>
                          <p class="text-xs font-semibold mt-1" [class]="keputusanClass(app)">{{ keputusan(app) }}</p>
                          @if (app.admin_notes) {
                            <p class="text-[11px] text-slate-400 mt-1">{{ app.admin_notes }}</p>
                          }
                        </div>
                      }
                    </div>
                    <!-- Jadual (desktop) -->
                    <div class="hidden sm:block overflow-x-auto">
                      <table class="w-full text-xs">
                        <thead>
                          <tr class="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                            <th class="text-left py-2 pr-3 font-semibold">Tarikh Hantar</th>
                            <th class="text-left py-2 pr-3 font-semibold">Permohonan</th>
                            <th class="text-left py-2 pr-3 font-semibold">Keputusan</th>
                            <th class="text-left py-2 font-semibold">Catatan</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                          @for (app of p.permohonan; track app.id) {
                            <tr>
                              <td class="py-2.5 pr-3 text-slate-500 whitespace-nowrap">{{ tarikhHantar(app) }}</td>
                              <td class="py-2.5 pr-3 font-medium text-slate-800">{{ jenisBorangLabel(app.jenis_borang) }}</td>
                              <td class="py-2.5 pr-3 font-semibold whitespace-nowrap" [class]="keputusanClass(app)">{{ keputusan(app) }}</td>
                              <td class="py-2.5 text-slate-400">{{ app.admin_notes || '—' }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="py-12 text-center text-sm text-slate-400">Tiada sejarah permohonan.</p>
                  }
                </div>
              }

              <!-- TAB: PERLAWANAN -->
              @if (tab() === 'perlawanan') {
                <div class="p-4 sm:p-5">
                  @if (p.perlawanan.length) {
                    <!-- Kad (mobile) -->
                    <div class="sm:hidden space-y-2">
                      @for (m of p.perlawanan; track m.id; let i = $index) {
                        <div class="border border-slate-200 rounded-lg p-3">
                          <div class="flex items-start justify-between gap-2">
                            <p class="text-xs font-semibold text-slate-800 leading-snug">{{ m.jenis || '—' }}</p>
                            <span class="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">{{ formatTarikh(m.tarikh) }}</span>
                          </div>
                          @if (m.home_team && m.away_team) {
                            <p class="text-[11px] text-slate-500 mt-0.5">{{ m.home_team }} vs {{ m.away_team }}</p>
                          }
                          <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-slate-400">
                            @if (m.jawatan) { <span>{{ m.jawatan }}</span> }
                            @if (m.tempat) { <span>{{ m.tempat }}</span> }
                          </div>
                        </div>
                      }
                    </div>
                    <!-- Jadual (desktop) -->
                    <div class="hidden sm:block overflow-x-auto">
                      <table class="w-full text-xs">
                        <thead>
                          <tr class="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                            <th class="text-center py-2 pr-2 font-semibold w-8">#</th>
                            <th class="text-left py-2 pr-3 font-semibold">Tarikh</th>
                            <th class="text-left py-2 pr-3 font-semibold">Jenis / Perlawanan</th>
                            <th class="text-left py-2 pr-3 font-semibold">Tempat</th>
                            <th class="text-left py-2 font-semibold">Jawatan</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                          @for (m of p.perlawanan; track m.id; let i = $index) {
                            <tr>
                              <td class="py-2 pr-2 text-center text-slate-400">{{ i + 1 }}</td>
                              <td class="py-2 pr-3 text-slate-500 whitespace-nowrap">{{ formatTarikh(m.tarikh) }}</td>
                              <td class="py-2 pr-3">
                                <p class="font-medium text-slate-800">{{ m.jenis || '—' }}</p>
                                @if (m.home_team && m.away_team) {
                                  <p class="text-slate-400 mt-0.5">{{ m.home_team }} vs {{ m.away_team }}</p>
                                }
                              </td>
                              <td class="py-2 pr-3 text-slate-500">{{ m.tempat || '—' }}</td>
                              <td class="py-2 text-slate-500">{{ m.jawatan || '—' }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="py-12 text-center text-sm text-slate-400">Tiada rekod perlawanan.</p>
                  }
                </div>
              }
            </div>
            } @else {
              <!-- ══ MOD KEMASKINI ══ -->
              <div class="border-b border-slate-200 px-4 sm:px-6 shrink-0 bg-blue-50/50">
                <div class="flex gap-4 overflow-x-auto">
                  @for (t of editTabs; track t.key) {
                    <button (click)="editTab.set(t.key)"
                      class="py-2.5 text-xs font-semibold border-b-2 -mb-px transition whitespace-nowrap"
                      [class]="editTab() === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'">
                      {{ t.label }}
                    </button>
                  }
                </div>
              </div>

              <div class="overflow-y-auto flex-1 p-4 sm:p-5">
                @if (editTab() === 'peribadi') {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="sm:col-span-2">
                      <label class="block text-xs text-slate-500 mb-1">Nama Penuh</label>
                      <input type="text" [(ngModel)]="editForm.nama_penuh" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">No. Kad Pengenalan</label>
                      <input type="text" [(ngModel)]="editForm.no_ic" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Jantina</label>
                      <select [(ngModel)]="editForm.jantina" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                        <option value="">—</option>
                        <option value="LELAKI">Lelaki</option>
                        <option value="PEREMPUAN">Perempuan</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">No. Telefon</label>
                      <input type="text" [(ngModel)]="editForm.no_telefon" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Emel</label>
                      <input type="email" [(ngModel)]="editForm.email" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Saiz Baju</label>
                      <select [(ngModel)]="editForm.saiz_baju" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                        <option value="">—</option>
                        @for (s of ['XS','S','M','L','XL','2XL','3XL','4XL','5XL']; track s) {
                          <option [value]="s">{{ s }}</option>
                        }
                      </select>
                    </div>
                  </div>
                }

                @if (editTab() === 'alamat') {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="sm:col-span-2">
                      <label class="block text-xs text-slate-500 mb-1">Alamat 1</label>
                      <input type="text" [(ngModel)]="editForm.alamat1" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div class="sm:col-span-2">
                      <label class="block text-xs text-slate-500 mb-1">Alamat 2</label>
                      <input type="text" [(ngModel)]="editForm.alamat2" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Poskod</label>
                      <input type="text" [(ngModel)]="editForm.poskod" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Daerah</label>
                      <input type="text" [(ngModel)]="editForm.daerah" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Negeri</label>
                      <input type="text" [(ngModel)]="editForm.negeri" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                }

                @if (editTab() === 'pekerjaan') {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Status Kerja</label>
                      <input type="text" [(ngModel)]="editForm.status_kerja" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Jawatan</label>
                      <input type="text" [(ngModel)]="editForm.jawatan" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div class="sm:col-span-2">
                      <label class="block text-xs text-slate-500 mb-1">Nama Majikan</label>
                      <input type="text" [(ngModel)]="editForm.nama_majikan" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                }

                @if (editTab() === 'waris') {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="sm:col-span-2">
                      <label class="block text-xs text-slate-500 mb-1">Nama Waris</label>
                      <input type="text" [(ngModel)]="editForm.nama_waris" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Hubungan</label>
                      <input type="text" [(ngModel)]="editForm.hubungan_waris" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">No. Telefon Waris</label>
                      <input type="text" [(ngModel)]="editForm.telefon_waris" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                }

                @if (editTab() === 'kelayakan') {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Jenis Pengadil</label>
                      <select [(ngModel)]="editForm.jenis_pengadil" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                        <option value="">—</option>
                        @for (j of jenisPengadilList; track j) {
                          <option [value]="j">{{ j }}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Tahun Mula Aktif</label>
                      <input type="number" min="1980" max="2100" [(ngModel)]="editForm.tahun_mula_aktif" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Tahun Mohon Kelas 3 FAM</label>
                      <input type="number" min="1980" max="2100" [(ngModel)]="editForm.tahun_mohon_kelas3" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs text-slate-500 mb-1">Tahun Lulus Kelas 3 FAM</label>
                      <input type="number" min="1980" max="2100" [(ngModel)]="editForm.tahun_lulus_kelas3" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    @if (isAdmin) {
                      <div>
                        <label class="block text-xs text-slate-500 mb-1">Persatuan (PBD)</label>
                        <select [(ngModel)]="editForm.persatuan_id" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                          <option [ngValue]="null">—</option>
                          @for (ps of persatuanList(); track ps.id) {
                            <option [ngValue]="ps.id">{{ ps.nama_persatuan }}</option>
                          }
                        </select>
                      </div>
                      <div>
                        <label class="block text-xs text-slate-500 mb-1">Status Akaun</label>
                        <select [(ngModel)]="editForm.aktif" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                          <option [ngValue]="1">Aktif</option>
                          <option [ngValue]="0">Tidak Aktif</option>
                        </select>
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="border-t border-slate-200 bg-white px-4 sm:px-5 py-3 flex gap-2 shrink-0 sm:justify-end">
                <button (click)="cancelEdit()" [disabled]="savingEdit()"
                  class="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                  Batal
                </button>
                <button (click)="saveEdit(p)" [disabled]="savingEdit()"
                  class="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                  {{ savingEdit() ? 'Menyimpan…' : 'Simpan' }}
                </button>
              </div>
            }
          } @else {
            <div class="p-16 text-center text-sm text-rose-500">
              Profil tidak dapat dimuatkan.
              <button (click)="modal.close()" class="block mx-auto mt-3 text-slate-500 underline text-xs">Tutup</button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class ProfilPengadilModalComponent {
  readonly modal = inject(ProfileModalService);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  readonly profil = signal<ProfilPengadil | null>(null);
  readonly loading = signal(false);
  readonly savingTaraf = signal(false);
  readonly tab = signal<'maklumat' | 'permohonan' | 'perlawanan'>('maklumat');

  // ── Mod kemaskini (Admin semua; PP Daerah untuk daerah sendiri) ──
  readonly editMode = signal(false);
  readonly editTab = signal<'peribadi' | 'alamat' | 'pekerjaan' | 'waris' | 'kelayakan'>('peribadi');
  readonly savingEdit = signal(false);
  readonly persatuanList = signal<{ id: number; nama_persatuan: string }[]>([]);
  editForm: EditForm = {
    nama_penuh: '', no_ic: '', jantina: '', no_telefon: '', email: '', saiz_baju: '',
    alamat1: '', alamat2: '', poskod: '', daerah: '', negeri: '',
    status_kerja: '', jawatan: '', nama_majikan: '',
    nama_waris: '', hubungan_waris: '', telefon_waris: '',
    jenis_pengadil: '', tahun_mula_aktif: null, tahun_mohon_kelas3: null,
    tahun_lulus_kelas3: null, persatuan_id: null, aktif: 1,
  };

  readonly editTabs: { key: 'peribadi' | 'alamat' | 'pekerjaan' | 'waris' | 'kelayakan'; label: string }[] = [
    { key: 'peribadi', label: 'Peribadi' },
    { key: 'alamat', label: 'Alamat' },
    { key: 'pekerjaan', label: 'Pekerjaan' },
    { key: 'waris', label: 'Waris' },
    { key: 'kelayakan', label: 'Kelayakan' },
  ];

  readonly jenisPengadilList = [
    'Kelas III FAM',
    'Pengadil Negeri',
    'Pengadil Kebangsaan',
    'Penilai Pengadil',
    'Pegawai Pembangunan',
  ];

  get isAdmin(): boolean {
    return this.auth.currentUser?.role === 'Admin';
  }

  constructor() {
    effect(() => {
      const uid = this.modal.userId();
      if (uid) {
        this.tab.set('maklumat');
        this.editMode.set(false);
        this.load(uid);
      } else {
        this.profil.set(null);
        this.editMode.set(false);
      }
    });
  }

  private load(uid: number): void {
    this.loading.set(true);
    this.api.get<{ profil: ProfilPengadil }>(`profil-pengadil.php?id=${uid}`).subscribe({
      next: (res: any) => {
        const p = res.profil ?? res.data ?? null;
        if (p) {
          p.permohonan = p.permohonan || [];
          p.perlawanan = p.perlawanan || [];
          p.ujian_kecergasan = p.ujian_kecergasan || [];
        }
        this.profil.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.profil.set(null);
        this.loading.set(false);
      },
    });
  }

  imgUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return environment.apiUrl.replace(/\/api\/?$/, '') + url;
  }

  inisial(nama: string): string {
    return (nama || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  jantinaLabel(j: string | null): string {
    const v = (j || '').toUpperCase();
    if (v === 'LELAKI' || v === 'L') return 'Lelaki';
    if (v === 'PEREMPUAN' || v === 'P') return 'Perempuan';
    return j || '—';
  }

  umurDariIC(ic: string | undefined): string {
    if (!ic || ic.length < 6) return '';
    const yy = parseInt(ic.substring(0, 2), 10);
    if (isNaN(yy)) return '';
    const nowYear = new Date().getFullYear();
    const year = yy + (yy > nowYear % 100 ? 1900 : 2000);
    return `${nowYear - year} tahun`;
  }

  jenisBorangLabel(jenis: string): string {
    const map: Record<string, string> = {
      pengadil_berdaftar: 'Pendaftaran Pengadil',
      penilai_berdaftar: 'Pendaftaran Penilai (RA)',
      pp_berdaftar: 'Pendaftaran PP Daerah',
      pengadil_futsal: 'Futsal',
      ujian_kecergasan: 'Ujian Kecergasan',
      ujian_bertulis: 'Ujian Kelas III FAM',
      kelas3_fam: 'Kelas 3 FAM',
      ujian_kelas1_fam: 'Ujian Kelas 1 FAM',
      pendaftaran_pengadil: 'Pendaftaran Pengadil',
    };
    return map[jenis] || jenis;
  }

  keputusan(app: any): string {
    const isUjian = ['ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam', 'kelas3_fam'].includes(app.jenis_borang);
    if (isUjian && app.status_ujian) return app.status_ujian;
    if (app.status === 'Approved') return 'Diluluskan';
    if (app.status === 'Rejected') return 'Ditolak';
    return 'Dalam Proses';
  }

  keputusanClass(app: any): string {
    const k = this.keputusan(app);
    if (['Diluluskan', 'Lulus'].includes(k)) return 'text-emerald-600';
    if (['Ditolak', 'Tidak Lulus', 'Tidak Hadir'].includes(k)) return 'text-rose-600';
    return 'text-amber-600';
  }

  /**
   * Tahun SEBENAR permohonan dihantar. Jangan guna tahun_permohonan sebagai
   * sumber utama — ia tahun kitaran dari tetapan 'application_year' dan boleh
   * menunjuk tahun hadapan.
   */
  tahunApp(app: any): string {
    if (app.tahun_sebenar) return String(app.tahun_sebenar);
    if (app.tarikh_hantar) return new Date(app.tarikh_hantar).getFullYear().toString();
    return app.tahun_permohonan ? String(app.tahun_permohonan) : '—';
  }

  /** Tarikh penuh permohonan dihantar (banyak permohonan boleh berlaku dalam tahun sama). */
  tarikhHantar(app: any): string {
    const d = app.tarikh_hantar || app.status_kemaskini;
    return d ? this.formatTarikh(d) : '—';
  }

  formatTarikh(date: string): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  startEdit(p: ProfilPengadil): void {
    this.editForm = {
      nama_penuh: p.nama_penuh || '',
      no_ic: p.no_ic || '',
      jantina: (p.jantina || '').toUpperCase(),
      no_telefon: p.no_telefon || '',
      email: p.email || '',
      saiz_baju: p.saiz_baju || '',
      alamat1: p.alamat1 || '',
      alamat2: p.alamat2 || '',
      poskod: p.poskod || '',
      daerah: p.daerah || '',
      negeri: p.negeri || '',
      status_kerja: p.status_kerja || '',
      jawatan: p.jawatan || '',
      nama_majikan: p.nama_majikan || '',
      nama_waris: p.nama_waris || '',
      hubungan_waris: p.hubungan_waris || '',
      telefon_waris: p.telefon_waris || '',
      jenis_pengadil: p.jenis_pengadil || '',
      tahun_mula_aktif: p.tahun_mula_aktif || null,
      tahun_mohon_kelas3: p.tahun_mohon_kelas3 || null,
      tahun_lulus_kelas3: p.tahun_lulus_kelas3 || null,
      persatuan_id: p.persatuan_id ?? null,
      aktif: +p.aktif ? 1 : 0,
    };
    this.editTab.set('peribadi');
    this.editMode.set(true);
    if (this.isAdmin && this.persatuanList().length === 0) {
      this.api.get<any>('public-persatuan.php').subscribe({
        next: (res: any) => this.persatuanList.set(res.data || []),
        error: () => this.persatuanList.set([]),
      });
    }
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

  saveEdit(p: ProfilPengadil): void {
    this.savingEdit.set(true);
    this.api.put<any>('profil-pengadil.php', { id: p.id, ...this.editForm }).subscribe({
      next: (res) => {
        this.toast.show(res.message || 'Profil dikemaskini.', 'success');
        this.savingEdit.set(false);
        this.editMode.set(false);
        this.load(p.id);
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Ralat mengemaskini profil.', 'error');
        this.savingEdit.set(false);
      },
    });
  }

  toggleTaraf(p: ProfilPengadil, taraf: 'kebangsaan' | 'negeri' | 'daerah'): void {
    const key = `pengadil_${taraf}` as 'pengadil_kebangsaan' | 'pengadil_negeri' | 'pengadil_daerah';
    const newValue = p[key] ? 0 : 1;
    this.savingTaraf.set(true);
    this.api.post<any>('pengadil-taraf.php', { user_ids: [p.id], taraf, value: newValue }).subscribe({
      next: (res) => {
        this.toast.show(res.message || 'Taraf dikemaskini.', 'success');
        this.profil.set({ ...p, [key]: newValue });
        this.savingTaraf.set(false);
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Ralat mengemaskini taraf.', 'error');
        this.savingTaraf.set(false);
      },
    });
  }
}
