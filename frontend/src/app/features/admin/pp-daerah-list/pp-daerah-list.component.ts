import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-pp-daerah-list',
  standalone: true,
  imports: [FormsModule, LoadingComponent, PaginationComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan senarai PP Daerah..." />
    } @else {
      <!-- Kad Statistik -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p class="text-sm text-gray-500 font-medium mb-1">Jumlah PP</p>
          <p class="text-2xl font-bold text-gray-900">{{ stats.total }}</p>
          <p class="text-[10px] text-gray-400 mt-1">Pegawai Pembangunan Daerah</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p class="text-sm text-gray-500 font-medium mb-1">Aktif</p>
          <p class="text-2xl font-bold text-green-600">{{ stats.aktif }}</p>
          <p class="text-[10px] text-gray-400 mt-1">Akaun aktif.</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p class="text-sm text-gray-500 font-medium mb-1">Tidak Aktif</p>
          <p class="text-2xl font-bold text-red-600">{{ stats.tidakAktif }}</p>
          <p class="text-[10px] text-gray-400 mt-1">Akaun tidak aktif.</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p class="text-sm text-gray-500 font-medium mb-1">Ada Persatuan</p>
          <p class="text-2xl font-bold text-blue-600">{{ stats.adaPersatuan }}</p>
          <p class="text-[10px] text-gray-400 mt-1">Dikaitkan dengan PBD.</p>
        </div>
      </div>

      <!-- Penapis -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div class="flex flex-col lg:flex-row gap-3">
          <div class="relative flex-1">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()"
              placeholder="Cari nama, No. KP, persatuan, emel..."
              class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <select [(ngModel)]="persatuanFilter" (ngModelChange)="applyFilter()"
            class="px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="all">Semua Persatuan</option>
            <option value="tiada">Tiada Persatuan</option>
            @for (p of persatuanList; track p.id) {
              <option [value]="p.id">{{ p.nama_persatuan }}</option>
            }
          </select>
          <select [(ngModel)]="statusFilter" (ngModelChange)="applyFilter()"
            class="px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="all">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="tidak_aktif">Tidak Aktif</option>
          </select>
        </div>
        @if (searchQuery || persatuanFilter !== 'all' || statusFilter !== 'all') {
          <div class="mt-3 text-xs text-slate-500">
            Menunjukkan {{ filtered.length }} daripada {{ users.length }} PP Daerah
          </div>
        }
      </div>

      <!-- Jadual Desktop -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 hidden md:block">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-12">#</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nama</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">No. KP</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Persatuan</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">No. Tel</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-24">Tindakan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (u of paged; track u.id; let i = $index) {
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="px-4 py-3 text-slate-400 text-xs">{{ getGlobalIndex(i) }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      @if (u.url_gambar_profil) {
                        <img [src]="getProfileImage(u.url_gambar_profil)" class="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
                        <div class="w-10 h-10 rounded-full bg-slate-200 items-center justify-center text-xs font-medium text-slate-600 hidden shrink-0">
                          {{ (u.nama_penuh || '?')[0] }}
                        </div>
                      } @else {
                        <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 shrink-0">
                          {{ (u.nama_penuh || '?')[0] }}
                        </div>
                      }
                      <div>
                        <span class="font-medium text-slate-900">{{ u.nama_penuh }}</span>
                        <p class="text-[10px] text-slate-400 mt-0.5">{{ u.email || '-' }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-slate-600 font-mono text-xs">{{ u.no_ic || '-' }}</td>
                  <td class="px-4 py-3 text-slate-600 text-xs">{{ u.persatuan_nama || '-' }}</td>
                  <td class="px-4 py-3 text-slate-600 text-xs">{{ u.no_telefon || '-' }}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                      [class]="isActive(u) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                      {{ isActive(u) ? 'Aktif' : 'Tidak Aktif' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <div class="inline-flex items-center gap-1.5">
                      <button (click)="viewUser(u)" class="px-2 py-1 bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 rounded text-xs font-medium transition-colors shadow-sm" title="Lihat Profil">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      </button>
                      <button (click)="editUser(u)" class="px-2 py-1 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded text-xs font-medium transition-colors shadow-sm" title="Edit">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-16 text-center">
                    <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">person_off</span>
                    <p class="text-slate-400 text-sm">Tiada PP Daerah ditemui.</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [totalItems]="filtered.length" [pageSize]="pageSize" [currentPage]="currentPage"
          (pageChange)="onPageChange($event)" (pageSizeChange)="onPageSizeChange($event)" />
      </div>

      <!-- Paparan Kad Mobil -->
      <div class="md:hidden space-y-3">
        @for (u of paged; track u.id; let i = $index) {
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                @if (u.url_gambar_profil) {
                  <img [src]="getProfileImage(u.url_gambar_profil)" class="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
                  <div class="w-10 h-10 rounded-full bg-slate-200 items-center justify-center text-sm font-medium text-slate-600 hidden shrink-0">
                    {{ (u.nama_penuh || '?')[0] }}
                  </div>
                } @else {
                  <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600 shrink-0">
                    {{ (u.nama_penuh || '?')[0] }}
                  </div>
                }
                <div>
                  <p class="font-medium text-slate-900 text-sm">{{ u.nama_penuh }}</p>
                  <p class="text-xs text-slate-500 font-mono">{{ u.no_ic || '-' }}</p>
                </div>
              </div>
              <span class="text-xs text-slate-400">#{{ getGlobalIndex(i) }}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs mb-3">
              <div><span class="text-slate-500">Persatuan:</span> <span class="font-medium">{{ u.persatuan_nama || '-' }}</span></div>
              <div><span class="text-slate-500">Status:</span>
                <span class="font-medium" [class]="isActive(u) ? 'text-green-600' : 'text-red-600'">{{ isActive(u) ? 'Aktif' : 'Tidak Aktif' }}</span>
              </div>
              <div><span class="text-slate-500">No. Tel:</span> <span class="font-medium">{{ u.no_telefon || '-' }}</span></div>
              <div><span class="text-slate-500">Emel:</span> <span class="font-medium">{{ u.email || '-' }}</span></div>
            </div>
            <div class="flex border-t border-gray-100 divide-x divide-gray-100">
              <button (click)="viewUser(u)" class="flex-1 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors text-center">Lihat</button>
              <button (click)="editUser(u)" class="flex-1 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors text-center">Edit</button>
            </div>
          </div>
        } @empty {
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">person_off</span>
            <p class="text-slate-400 text-sm">Tiada PP Daerah ditemui.</p>
          </div>
        }
        <app-pagination [totalItems]="filtered.length" [pageSize]="pageSize" [currentPage]="currentPage"
          (pageChange)="onPageChange($event)" (pageSizeChange)="onPageSizeChange($event)" />
      </div>
    }

    <!-- Modal Profil PP Daerah -->
    @if (showDetailModal && selectedUser) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="showDetailModal = false">
        <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="px-6 pt-6 pb-5 border-b border-gray-100">
            <div class="flex items-start gap-4">
              <div class="shrink-0">
                @if (selectedUser.url_gambar_profil) {
                  <img [src]="getProfileImage(selectedUser.url_gambar_profil)"
                    class="w-16 h-16 rounded-full object-cover border-2 border-gray-100" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
                  <div class="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-100 items-center justify-center text-xl font-semibold text-gray-500 hidden">
                    {{ (selectedUser.nama_penuh || '?')[0] }}
                  </div>
                } @else {
                  <div class="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-100 flex items-center justify-center text-xl font-semibold text-gray-500">
                    {{ (selectedUser.nama_penuh || '?')[0] }}
                  </div>
                }
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-bold text-gray-900 truncate">{{ selectedUser.nama_penuh }}</h3>
                <p class="text-sm text-gray-500 mt-0.5">{{ selectedUser.email || '-' }}</p>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                  <span>PP Daerah</span>
                  @if (selectedUser.persatuan_nama) {
                    <span>{{ selectedUser.persatuan_nama }}</span>
                  }
                  @if (selectedUser.jantina) {
                    <span>{{ selectedUser.jantina }}</span>
                  }
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                    [class]="isActive(selectedUser) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                    {{ isActive(selectedUser) ? 'Aktif' : 'Tidak Aktif' }}
                  </span>
                </div>
              </div>
              <div class="shrink-0">
                <button (click)="showDetailModal = false"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Detail Content -->
          <div class="overflow-y-auto" style="max-height: calc(90vh - 200px)">
            <div class="p-6 space-y-6">
              <!-- Maklumat Peribadi -->
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Maklumat Peribadi</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs text-gray-400 mb-0.5">No. Kad Pengenalan</p>
                    <p class="text-sm font-medium text-gray-900 font-mono">{{ selectedUser.no_ic || '-' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-400 mb-0.5">No. Telefon</p>
                    <p class="text-sm font-medium text-gray-900">{{ selectedUser.no_telefon || '-' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-400 mb-0.5">Emel</p>
                    <p class="text-sm font-medium text-gray-900">{{ selectedUser.email || '-' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-400 mb-0.5">Jantina</p>
                    <p class="text-sm font-medium text-gray-900">{{ selectedUser.jantina || '-' }}</p>
                  </div>
                </div>
              </div>

              <hr class="border-gray-100" />

              <!-- Persatuan -->
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Persatuan Bola Sepak Daerah</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs text-gray-400 mb-0.5">Nama Persatuan</p>
                    <p class="text-sm font-medium text-gray-900">{{ selectedUser.persatuan_nama || 'Belum dikaitkan' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-400 mb-0.5">Kod Persatuan</p>
                    <p class="text-sm font-medium text-gray-900">{{ selectedUser.kod_persatuan || '-' }}</p>
                  </div>
                </div>
              </div>

              <hr class="border-gray-100" />

              <!-- Alamat -->
              @if (selectedUser.alamat1) {
                <div>
                  <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Alamat</h4>
                  <p class="text-sm text-gray-900">{{ selectedUser.alamat1 || '-' }}{{ selectedUser.alamat2 ? ', ' + selectedUser.alamat2 : '' }}</p>
                  <p class="text-sm text-gray-500 mt-0.5">{{ selectedUser.poskod || '' }} {{ selectedUser.daerah || '' }}{{ selectedUser.negeri ? ', ' + selectedUser.negeri : '' }}</p>
                </div>
                <hr class="border-gray-100" />
              }

              <!-- Pekerjaan -->
              @if (selectedUser.jawatan || selectedUser.nama_majikan) {
                <div>
                  <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pekerjaan</h4>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p class="text-xs text-gray-400 mb-0.5">Status</p>
                      <p class="text-sm font-medium text-gray-900">{{ selectedUser.status_kerja || '-' }}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-400 mb-0.5">Jawatan</p>
                      <p class="text-sm font-medium text-gray-900">{{ selectedUser.jawatan || '-' }}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-400 mb-0.5">Majikan</p>
                      <p class="text-sm font-medium text-gray-900">{{ selectedUser.nama_majikan || '-' }}</p>
                    </div>
                  </div>
                </div>
                <hr class="border-gray-100" />
              }

              <!-- Waris -->
              @if (selectedUser.nama_waris) {
                <div>
                  <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Waris</h4>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p class="text-xs text-gray-400 mb-0.5">Nama</p>
                      <p class="text-sm font-medium text-gray-900">{{ selectedUser.nama_waris || '-' }}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-400 mb-0.5">Hubungan</p>
                      <p class="text-sm font-medium text-gray-900">{{ selectedUser.hubungan_waris || '-' }}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-400 mb-0.5">No. Telefon</p>
                      <p class="text-sm font-medium text-gray-900">{{ selectedUser.telefon_waris || '-' }}</p>
                    </div>
                  </div>
                </div>
                <hr class="border-gray-100" />
              }

              <!-- Notifikasi Telegram -->
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notifikasi Telegram</h4>
                <div class="flex items-center gap-3">
                  @if (selectedUser.telegram_chat_id) {
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-700">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      Telegram disambungkan
                    </span>
                  } @else {
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-500">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                      Telegram belum disambungkan
                    </span>
                  }
                </div>
              </div>

              <hr class="border-gray-100" />

              <!-- Maklumat Akaun -->
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Maklumat Akaun</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs text-gray-400 mb-0.5">Tarikh Daftar</p>
                    <p class="text-sm font-medium text-gray-900">{{ formatDate(selectedUser.created_at) }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-400 mb-0.5">Log Masuk Terakhir</p>
                    <p class="text-sm font-medium text-gray-900">{{ formatDate(selectedUser.last_login) || 'Belum log masuk' }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Modal Kemaskini PP Daerah -->
    @if (showEditModal && editData) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="showEditModal = false">
        <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
          <div class="p-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
            <h3 class="text-base font-semibold text-gray-900">Kemaskini Profil PP Daerah</h3>
            <button (click)="showEditModal = false" class="text-gray-400 hover:text-gray-600">&#x2715;</button>
          </div>
          <div class="p-5 space-y-5">
            <div>
              <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Maklumat Asas</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Nama Penuh</label>
                  <input type="text" [(ngModel)]="editData.nama_penuh" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">No. KP</label>
                  <input type="text" [(ngModel)]="editData.no_ic" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Emel</label>
                  <input type="email" [(ngModel)]="editData.email" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">No. Telefon</label>
                  <input type="text" [(ngModel)]="editData.no_telefon" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Jantina</label>
                  <select [(ngModel)]="editData.jantina" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">-</option>
                    <option value="Lelaki">Lelaki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Persatuan Bola Sepak Daerah</label>
                  <select [(ngModel)]="editData.persatuan_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option [ngValue]="null">- Pilih Persatuan -</option>
                    @for (p of persatuanList; track p.id) {
                      <option [ngValue]="p.id">{{ p.nama_persatuan }}</option>
                    }
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Alamat</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="sm:col-span-2">
                  <label class="block text-xs text-gray-500 mb-1">Alamat 1</label>
                  <input type="text" [(ngModel)]="editData.alamat1" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-xs text-gray-500 mb-1">Alamat 2</label>
                  <input type="text" [(ngModel)]="editData.alamat2" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Poskod</label>
                  <input type="text" [(ngModel)]="editData.poskod" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Daerah</label>
                  <input type="text" [(ngModel)]="editData.daerah" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-gray-200">
              <button (click)="showEditModal = false" class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Batal</button>
              <button (click)="saveEdit()" [disabled]="savingEdit"
                class="px-4 py-2 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                {{ savingEdit ? 'Menyimpan...' : 'Simpan Kemaskini' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class PpDaerahListComponent implements OnInit {
  loading = true;
  users: any[] = [];
  filtered: any[] = [];
  paged: any[] = [];
  searchQuery = '';
  persatuanFilter = 'all';
  statusFilter = 'all';
  currentPage = 1;
  pageSize = 10;
  persatuanList: any[] = [];

  stats = { total: 0, aktif: 0, tidakAktif: 0, adaPersatuan: 0 };

  showDetailModal = false;
  selectedUser: any = null;

  showEditModal = false;
  savingEdit = false;
  editData: any = null;

  apiUrl = environment.apiUrl;

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.api.get<any>('admin-users.php').subscribe({
      next: (res) => {
        this.users = (res.users || []).filter((u: any) => u.user_role === 'PP Daerah');
        this.persatuanList = res.persatuan || [];
        this.updateStats();
        this.applyFilter();
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  private updateStats(): void {
    this.stats.total = this.users.length;
    this.stats.aktif = this.users.filter((u) => this.isActive(u)).length;
    this.stats.tidakAktif = this.stats.total - this.stats.aktif;
    this.stats.adaPersatuan = this.users.filter((u) => u.persatuan_id).length;
  }

  isActive(u: any): boolean {
    return u.is_active !== 0 && u.is_active !== '0' && u.is_active !== false;
  }

  applyFilter(): void {
    let data = [...this.users];
    if (this.persatuanFilter === 'tiada') {
      data = data.filter((u) => !u.persatuan_id);
    } else if (this.persatuanFilter !== 'all') {
      data = data.filter((u) => String(u.persatuan_id) === this.persatuanFilter);
    }
    if (this.statusFilter === 'aktif') {
      data = data.filter((u) => this.isActive(u));
    } else if (this.statusFilter === 'tidak_aktif') {
      data = data.filter((u) => !this.isActive(u));
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(
        (u) =>
          (u.nama_penuh || '').toLowerCase().includes(q) ||
          (u.no_ic || '').includes(q) ||
          (u.persatuan_nama || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q),
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

  getGlobalIndex(i: number): number {
    return (this.currentPage - 1) * this.pageSize + i + 1;
  }

  getProfileImage(url: string | null): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return url.startsWith('/') ? url : '/' + url;
  }

  viewUser(u: any): void {
    this.api.get<any>('admin-users.php', { id: u.id.toString() }).subscribe({
      next: (res) => {
        this.selectedUser = res.user || u;
        this.showDetailModal = true;
      },
      error: () => {
        this.selectedUser = u;
        this.showDetailModal = true;
      },
    });
  }

  editUser(u: any): void {
    this.api.get<any>('admin-users.php', { id: u.id.toString() }).subscribe({
      next: (res) => {
        const user = res.user || {};
        this.editData = {
          ...user,
          userId: user.id,
          user_role: 'PP Daerah',
        };
        this.showEditModal = true;
      },
      error: () => {
        this.editData = {
          userId: u.id,
          user_role: 'PP Daerah',
          nama_penuh: u.nama_penuh || '',
          no_ic: u.no_ic || '',
          email: u.email || '',
          no_telefon: u.no_telefon || '',
          jantina: u.jantina || '',
          persatuan_id: u.persatuan_id || null,
          alamat1: '',
          alamat2: '',
          poskod: '',
          daerah: '',
        };
        this.showEditModal = true;
      },
    });
  }

  saveEdit(): void {
    if (!this.editData?.nama_penuh || !this.editData?.email) {
      this.toast.error('Nama penuh dan emel diperlukan.');
      return;
    }
    this.savingEdit = true;
    this.api.put<any>('admin-users.php', this.editData).subscribe({
      next: (res) => {
        this.savingEdit = false;
        if (!res.error) {
          this.toast.success('Profil PP Daerah berjaya dikemaskini.');
          this.showEditModal = false;
          this.loading = true;
          this.ngOnInit();
        } else {
          this.toast.error(res.message || 'Gagal mengemaskini profil.');
        }
      },
      error: () => {
        this.savingEdit = false;
        this.toast.error('Gagal mengemaskini profil.');
      },
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
