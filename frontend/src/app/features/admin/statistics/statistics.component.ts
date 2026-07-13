import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProfileModalService } from '../../../core/services/profile-modal.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

declare const Chart: any;

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [FormsModule, LoadingComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan statistik..." />
    } @else {
      <div class="space-y-6">

        <!-- Header + Year Filter -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Statistik &amp; Analitik</h1>
            <p class="text-sm text-slate-500 mt-0.5">Ringkasan data sistem pengurusan pengadil</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="material-icons text-sm text-slate-400">calendar_today</span>
            <select [(ngModel)]="yearFilter" (ngModelChange)="onYearChange()"
              class="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white shadow-sm">
              @for (y of availableYears; track y) {
                <option [value]="y">{{ y }}</option>
              }
            </select>
            <button (click)="loadStats()" class="p-2 rounded-lg hover:bg-slate-100 transition" title="Muat semula">
              <span class="material-icons text-sm text-slate-500">refresh</span>
            </button>
          </div>
        </div>

        <!-- ═══ TOP SUMMARY CARDS ═══ -->
        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          @for (card of summaryCards; track card.label) {
            <div (click)="onCardClick(card)" class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" [style.background]="card.color">
                  <span class="material-icons text-base">{{ card.icon }}</span>
                </div>
                <span class="text-xs font-medium text-slate-500 leading-tight group-hover:text-slate-700 transition-colors">{{ card.label }}</span>
              </div>
              <p class="text-xl font-bold text-slate-900 group-hover:text-slate-700 transition">{{ card.value }}</p>
              @if (card.sub) {
                <p class="text-[10px] text-slate-400 mt-0.5">{{ card.sub }}</p>
              }
            </div>
          }
        </div>

        <!-- ═══ TAB NAVIGATION ═══ -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200">
          <div class="flex border-b border-slate-200 overflow-x-auto">
            @for (tab of tabs; track tab.key) {
              <button (click)="activeTab = tab.key; renderActiveCharts()"
                class="flex items-center gap-1.5 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition"
                [class]="activeTab === tab.key
                  ? 'border-pahang-yellow text-slate-900 bg-amber-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'">
                <span class="material-icons text-base">{{ tab.icon }}</span>
                {{ tab.label }}
              </button>
            }
          </div>

          <div class="p-5">

            <!-- ── TAB: PERMOHONAN ── -->
            @if (activeTab === 'permohonan') {
              <div class="space-y-6">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div (click)="router.navigate(['/admin/permohonan'])" class="rounded-lg bg-amber-50 border border-amber-200 p-3 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all">
                    <p class="text-xs text-amber-600 font-medium">Menunggu</p>
                    <p class="text-lg font-bold text-amber-700">{{ s.applications?.statusBreakdown?.['Menunggu'] || 0 }}</p>
                  </div>
                  <div (click)="router.navigate(['/admin/permohonan'])" class="rounded-lg bg-green-50 border border-green-200 p-3 cursor-pointer hover:shadow-md hover:border-green-300 transition-all">
                    <p class="text-xs text-green-600 font-medium">Lengkap</p>
                    <p class="text-lg font-bold text-green-700">{{ s.applications?.statusBreakdown?.['Lengkap'] || 0 }}</p>
                  </div>
                  <div (click)="router.navigate(['/admin/permohonan'])" class="rounded-lg bg-red-50 border border-red-200 p-3 cursor-pointer hover:shadow-md hover:border-red-300 transition-all">
                    <p class="text-xs text-red-600 font-medium">Ditolak</p>
                    <p class="text-lg font-bold text-red-700">{{ s.applications?.statusBreakdown?.['Ditolak'] || 0 }}</p>
                  </div>
                  <div (click)="router.navigate(['/admin/permohonan'])" class="rounded-lg bg-slate-50 border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all">
                    <p class="text-xs text-slate-600 font-medium">Jumlah</p>
                    <p class="text-lg font-bold text-slate-800">{{ s.applications?.total || 0 }}</p>
                  </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 mb-3">Mengikut Jenis Borang</h4>
                    <div class="h-64"><canvas id="chartAppTypes"></canvas></div>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 mb-3">Status Permohonan</h4>
                    <div class="h-64 flex items-center justify-center"><canvas id="chartAppStatus"></canvas></div>
                  </div>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-slate-700 mb-3">Trend Permohonan Bulanan</h4>
                  <div class="h-56"><canvas id="chartAppMonthly"></canvas></div>
                </div>
              </div>
            }

            <!-- ── TAB: PENGADIL ── -->
            @if (activeTab === 'pengadil') {
              <div class="space-y-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 mb-3">Jantina</h4>
                    <div class="flex items-center gap-6">
                      <div class="w-40 h-40"><canvas id="chartGender"></canvas></div>
                      <div class="space-y-2">
                        <div class="flex items-center gap-2">
                          <span class="w-3 h-3 rounded-full bg-blue-500"></span>
                          <span class="text-sm text-slate-600">Lelaki: <strong>{{ s.genderBreakdown?.['Lelaki'] || 0 }}</strong></span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-3 h-3 rounded-full bg-pink-500"></span>
                          <span class="text-sm text-slate-600">Perempuan: <strong>{{ s.genderBreakdown?.['Perempuan'] || 0 }}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 mb-3">Status Pekerjaan</h4>
                    <div class="space-y-2 max-h-52 overflow-y-auto">
                      @for (item of employmentItems; track item.label) {
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-xs text-slate-600 truncate">{{ item.label }}</span>
                          <div class="flex items-center gap-2 shrink-0">
                            <div class="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div class="h-full bg-pahang-yellow rounded-full" [style.width.%]="item.pct"></div>
                            </div>
                            <span class="text-xs font-bold text-slate-700 w-6 text-right">{{ item.value }}</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-slate-700 mb-3">Pengagihan Daerah</h4>
                  <div class="h-72"><canvas id="chartDistrict"></canvas></div>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-slate-700 mb-3">Trend Pendaftaran Bulanan</h4>
                  <div class="h-56"><canvas id="chartRegMonthly"></canvas></div>
                </div>
              </div>
            }

            <!-- ── TAB: LANTIKAN ── -->
            @if (activeTab === 'lantikan') {
              <div class="space-y-6">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div (click)="router.navigate(['/admin/lantikan'])" class="rounded-lg bg-slate-50 border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all">
                    <p class="text-xs text-slate-500 font-medium">Jumlah Lantikan</p>
                    <p class="text-lg font-bold text-slate-800">{{ s.lantikan?.total || 0 }}</p>
                  </div>
                  <div (click)="router.navigate(['/admin/lantikan'])" class="rounded-lg bg-green-50 border border-green-200 p-3 cursor-pointer hover:shadow-md hover:border-green-300 transition-all">
                    <p class="text-xs text-green-600 font-medium">Selesai</p>
                    <p class="text-lg font-bold text-green-700">{{ s.lantikan?.selesai || 0 }}</p>
                  </div>
                  <div (click)="router.navigate(['/admin/lantikan'])" class="rounded-lg bg-blue-50 border border-blue-200 p-3 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all">
                    <p class="text-xs text-blue-600 font-medium">Disahkan</p>
                    <p class="text-lg font-bold text-blue-700">{{ s.lantikan?.disahkan || 0 }}</p>
                  </div>
                  <div (click)="router.navigate(['/admin/lantikan'])" class="rounded-lg bg-amber-50 border border-amber-200 p-3 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all">
                    <p class="text-xs text-amber-600 font-medium">Belum Selesai</p>
                    <p class="text-lg font-bold text-amber-700">{{ s.lantikan?.belum || 0 }}</p>
                  </div>
                </div>

                @if (s.kejohanan?.length) {
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 mb-3">Senarai Kejohanan</h4>
                    <div class="overflow-x-auto rounded-lg border border-slate-200">
                      <table class="w-full text-sm">
                        <thead class="bg-slate-50">
                          <tr>
                            <th class="text-left px-4 py-2.5 font-semibold text-slate-600">Kejohanan</th>
                            <th class="text-left px-4 py-2.5 font-semibold text-slate-600">Anjuran</th>
                            <th class="text-center px-4 py-2.5 font-semibold text-slate-600">Perlawanan</th>
                            <th class="text-center px-4 py-2.5 font-semibold text-slate-600">Status</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                          @for (k of s.kejohanan; track k.nama) {
                            <tr class="hover:bg-slate-50/50">
                              <td class="px-4 py-2.5 font-medium text-slate-800">{{ k.nama }}</td>
                              <td class="px-4 py-2.5 text-slate-500">{{ k.anjuran || '-' }}</td>
                              <td class="px-4 py-2.5 text-center font-bold">{{ k.jum_perlawanan }}</td>
                              <td class="px-4 py-2.5 text-center">
                                <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                  [class]="k.status === 'Aktif' ? 'bg-green-100 text-green-700' : k.status === 'Selesai' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'">
                                  {{ k.status }}
                                </span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                }

                @if (s.lantikanDaerah?.length) {
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 mb-3">Pecahan Tugasan Mengikut Daerah</h4>
                    <div class="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                      @for (d of s.lantikanDaerah; track d.daerah) {
                        <div>
                          <!-- Baris daerah (klik untuk kembang) -->
                          <button (click)="toggleDaerah(d.daerah)"
                            class="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
                            <span class="text-slate-400 text-xs w-3 shrink-0">{{ expandedDaerah === d.daerah ? '▾' : '▸' }}</span>
                            <span class="font-semibold text-slate-800 text-xs sm:text-sm flex-1 min-w-0 truncate">{{ d.daerah }}</span>
                            <span class="text-[10px] text-slate-400 hidden sm:inline shrink-0">{{ d.pengadil.length }} pengadil</span>
                            <span class="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-xs font-bold shrink-0">{{ d.total }}</span>
                            <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold hidden md:inline">✓ {{ d.diterima }}</span>
                            <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs font-semibold hidden md:inline">✗ {{ d.ditolak }}</span>
                            <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold hidden md:inline">? {{ d.belum }}</span>
                          </button>
                          <!-- Senarai pengadil dalam daerah -->
                          @if (expandedDaerah === d.daerah) {
                            <!-- Kad (mobile) -->
                            <div class="sm:hidden divide-y divide-slate-50">
                              @for (pg of d.pengadil; track $index) {
                                <div class="px-3 py-2.5 pl-8">
                                  <div class="flex items-center justify-between gap-2">
                                    <span class="text-xs min-w-0 truncate"
                                          [class]="pg.id ? 'cursor-pointer text-slate-800 hover:text-blue-600 underline decoration-dotted font-medium' : 'text-slate-600'"
                                          (click)="pg.id && profileModal.open(pg.id)">{{ pg.nama }}</span>
                                    <span class="text-xs font-bold text-slate-700 shrink-0">{{ pg.total }}</span>
                                  </div>
                                  <div class="flex gap-2 mt-1 text-[10px]">
                                    <span class="text-emerald-600">✓ {{ pg.diterima }}</span>
                                    <span class="text-rose-500">✗ {{ pg.ditolak }}</span>
                                    <span class="text-amber-600">? {{ pg.belum }}</span>
                                  </div>
                                </div>
                              }
                            </div>
                            <!-- Jadual (desktop) -->
                            <div class="hidden sm:block overflow-x-auto">
                              <table class="w-full text-xs">
                                <thead>
                                  <tr class="text-slate-400 border-b border-slate-100">
                                    <th class="text-left px-4 py-1.5 font-medium pl-11">Pengadil</th>
                                    <th class="text-center px-2 py-1.5 font-medium">Jumlah</th>
                                    <th class="text-center px-2 py-1.5 font-medium">Diterima</th>
                                    <th class="text-center px-2 py-1.5 font-medium">Ditolak</th>
                                    <th class="text-center px-2 py-1.5 font-medium">Belum</th>
                                  </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                  @for (pg of d.pengadil; track $index) {
                                    <tr class="hover:bg-slate-50/50">
                                      <td class="px-4 py-2 pl-11">
                                        <span [class]="pg.id ? 'cursor-pointer text-slate-800 hover:text-blue-600 hover:underline font-medium' : 'text-slate-600'"
                                              (click)="pg.id && profileModal.open(pg.id)">{{ pg.nama }}</span>
                                      </td>
                                      <td class="px-2 py-2 text-center font-bold text-slate-700">{{ pg.total }}</td>
                                      <td class="px-2 py-2 text-center text-emerald-600">{{ pg.diterima }}</td>
                                      <td class="px-2 py-2 text-center text-rose-500">{{ pg.ditolak }}</td>
                                      <td class="px-2 py-2 text-center text-amber-600">{{ pg.belum }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }

                <div>
                  <h4 class="text-sm font-semibold text-slate-700 mb-3">Pecahan Lantikan</h4>
                  <div class="h-64 max-w-sm mx-auto"><canvas id="chartLantikan"></canvas></div>
                </div>
              </div>
            }

            <!-- ── TAB: PERLAWANAN (rekod sendiri pengadil) ── -->
            @if (activeTab === 'perlawanan') {
              <div class="space-y-6">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div class="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p class="text-xs text-slate-500 font-medium">Jumlah Perlawanan</p>
                    <p class="text-lg font-bold text-slate-800">{{ s.matches?.uniqueMatches || 0 }}</p>
                  </div>
                  <div class="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p class="text-xs text-blue-600 font-medium">Jumlah Rekod</p>
                    <p class="text-lg font-bold text-blue-700">{{ s.matches?.total || 0 }}</p>
                  </div>
                  <div class="rounded-lg bg-green-50 border border-green-200 p-3">
                    <p class="text-xs text-green-600 font-medium">Rekod Pengadil</p>
                    <p class="text-lg font-bold text-green-700">{{ s.matches?.pengadilTotal || 0 }}</p>
                  </div>
                  <div class="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p class="text-xs text-amber-600 font-medium">Pengadil Aktif</p>
                    <p class="text-lg font-bold text-amber-700">{{ s.matches?.pengadilUniqueCount || 0 }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 mb-3">
                      <span class="material-icons text-sm text-amber-500 align-middle mr-1">emoji_events</span>
                      Top 10 Pengadil Paling Aktif
                    </h4>
                    <div class="space-y-1.5">
                      @for (ref of s.matches?.topPengadil || []; track ref.name; let i = $index) {
                        <div class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 transition"
                          [class]="i < 3 ? 'bg-amber-50/60' : ''">
                          <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            [class]="i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'">
                            {{ i + 1 }}
                          </span>
                          <span class="text-sm text-slate-800 font-medium truncate flex-1">{{ ref.name }}</span>
                          <span class="text-sm font-bold text-slate-900 tabular-nums">{{ ref.count }}</span>
                          <span class="text-[10px] text-slate-400">perlawanan</span>
                        </div>
                      }
                      @if (!s.matches?.topPengadil?.length) {
                        <p class="text-sm text-slate-400 italic py-4 text-center">Tiada data perlawanan</p>
                      }
                    </div>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 mb-3">Pecahan Perlawanan</h4>
                    <div class="h-64"><canvas id="chartMatchBreakdown"></canvas></div>
                  </div>
                </div>

                @if (s.perlawananDaerah?.length) {
                  <div>
                    <h4 class="text-sm font-semibold text-slate-700 mb-3">Pecahan Perlawanan Didaftarkan Mengikut Daerah</h4>
                    <div class="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                      @for (d of s.perlawananDaerah; track d.daerah) {
                        <div>
                          <button (click)="togglePerlawananDaerah(d.daerah)"
                            class="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
                            <span class="text-slate-400 text-xs w-3 shrink-0">{{ expandedPerlawananDaerah === d.daerah ? '▾' : '▸' }}</span>
                            <span class="font-semibold text-slate-800 text-xs sm:text-sm flex-1 min-w-0 truncate">{{ d.daerah }}</span>
                            <span class="text-[10px] text-slate-400 hidden sm:inline shrink-0">{{ d.pengadil.length }} pengadil</span>
                            <span class="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-xs font-bold shrink-0 whitespace-nowrap">
                              {{ d.total }}<span class="hidden sm:inline"> perlawanan</span>
                            </span>
                            <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold hidden md:inline">✓ {{ d.disahkan }} disahkan</span>
                          </button>
                          @if (expandedPerlawananDaerah === d.daerah) {
                            <!-- Kad (mobile) -->
                            <div class="sm:hidden divide-y divide-slate-50">
                              @for (pg of d.pengadil; track pg.id) {
                                <div class="px-3 py-2.5 pl-8 flex items-center justify-between gap-2">
                                  <span class="text-xs min-w-0 truncate cursor-pointer text-slate-800 hover:text-blue-600 underline decoration-dotted font-medium"
                                        (click)="profileModal.open(pg.id)">{{ pg.nama }}</span>
                                  <span class="text-[10px] shrink-0 flex gap-2">
                                    <span class="font-bold text-slate-700">{{ pg.total }}</span>
                                    <span class="text-emerald-600">✓ {{ pg.disahkan }}</span>
                                  </span>
                                </div>
                              }
                            </div>
                            <!-- Jadual (desktop) -->
                            <div class="hidden sm:block overflow-x-auto">
                              <table class="w-full text-xs">
                                <thead>
                                  <tr class="text-slate-400 border-b border-slate-100">
                                    <th class="text-left px-4 py-1.5 font-medium pl-11">Pengadil</th>
                                    <th class="text-center px-2 py-1.5 font-medium">Perlawanan</th>
                                    <th class="text-center px-2 py-1.5 font-medium">Disahkan</th>
                                  </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                  @for (pg of d.pengadil; track pg.id) {
                                    <tr class="hover:bg-slate-50/50">
                                      <td class="px-4 py-2 pl-11">
                                        <span class="cursor-pointer text-slate-800 hover:text-blue-600 hover:underline font-medium"
                                              (click)="profileModal.open(pg.id)">{{ pg.nama }}</span>
                                      </td>
                                      <td class="px-2 py-2 text-center font-bold text-slate-700">{{ pg.total }}</td>
                                      <td class="px-2 py-2 text-center text-emerald-600">{{ pg.disahkan }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }

            <!-- ── TAB: PENILAIAN / RANKINGS ── -->
            @if (activeTab === 'penilaian') {
              <div class="space-y-6">
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div class="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center">
                    <p class="text-3xl font-bold text-blue-700">{{ s.ratings?.average || '0.0' }}</p>
                    <p class="text-xs text-blue-500 font-medium mt-1">Purata Markah Keseluruhan</p>
                  </div>
                  <div class="rounded-lg bg-slate-50 border border-slate-200 p-4 text-center">
                    <p class="text-3xl font-bold text-slate-700">{{ s.ratings?.total || 0 }}</p>
                    <p class="text-xs text-slate-500 font-medium mt-1">Jumlah Penilaian</p>
                  </div>
                  <div class="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center col-span-2 md:col-span-1">
                    <p class="text-3xl font-bold text-amber-700">{{ s.ratings?.rankings?.length || 0 }}</p>
                    <p class="text-xs text-amber-500 font-medium mt-1">Pengadil Dinilai</p>
                  </div>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-slate-700 mb-3">Taburan Markah</h4>
                  <div class="h-48"><canvas id="chartRatingDist"></canvas></div>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-slate-700 mb-3">
                    <span class="material-icons text-sm text-amber-500 align-middle mr-1">military_tech</span>
                    Kedudukan Merit Pengadil
                  </h4>
                  @if (s.ratings?.rankings?.length) {
                    <div class="overflow-x-auto rounded-lg border border-slate-200">
                      <table class="w-full text-sm">
                        <thead class="bg-slate-50">
                          <tr>
                            <th class="text-center px-3 py-2.5 font-semibold text-slate-600 w-12">#</th>
                            <th class="text-left px-4 py-2.5 font-semibold text-slate-600">Nama Pengadil</th>
                            <th class="text-center px-4 py-2.5 font-semibold text-slate-600">Purata</th>
                            <th class="text-center px-4 py-2.5 font-semibold text-slate-600">Tertinggi</th>
                            <th class="text-center px-4 py-2.5 font-semibold text-slate-600">Bilangan</th>
                            <th class="text-left px-4 py-2.5 font-semibold text-slate-600 w-40">Tahap</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                          @for (r of s.ratings.rankings; track r.nama; let i = $index) {
                            <tr class="hover:bg-slate-50/50 transition" [class]="i < 3 ? 'bg-amber-50/40' : ''">
                              <td class="text-center px-3 py-2.5">
                                @if (i < 3) {
                                  <span class="inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold text-white"
                                    [class]="i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : 'bg-amber-700'">
                                    {{ i + 1 }}
                                  </span>
                                } @else {
                                  <span class="text-slate-500 font-medium">{{ i + 1 }}</span>
                                }
                              </td>
                              <td class="px-4 py-2.5 font-medium text-slate-800">{{ r.nama }}</td>
                              <td class="text-center px-4 py-2.5">
                                <span class="font-bold text-lg tabular-nums"
                                  [class]="r.avg >= 8 ? 'text-green-600' : r.avg >= 6 ? 'text-blue-600' : r.avg >= 4 ? 'text-amber-600' : 'text-red-600'">
                                  {{ r.avg }}
                                </span>
                              </td>
                              <td class="text-center px-4 py-2.5 text-slate-600 tabular-nums">{{ r.best }}</td>
                              <td class="text-center px-4 py-2.5">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                                  <span class="material-icons text-[10px]">assessment</span>
                                  {{ r.count }}x
                                </span>
                              </td>
                              <td class="px-4 py-2.5">
                                <div class="flex items-center gap-2">
                                  <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full transition-all"
                                      [class]="r.avg >= 8 ? 'bg-green-500' : r.avg >= 6 ? 'bg-blue-500' : r.avg >= 4 ? 'bg-amber-500' : 'bg-red-500'"
                                      [style.width.%]="r.avg * 10"></div>
                                  </div>
                                  <span class="text-[10px] font-medium whitespace-nowrap"
                                    [class]="r.avg >= 8 ? 'text-green-600' : r.avg >= 6 ? 'text-blue-600' : r.avg >= 4 ? 'text-amber-600' : 'text-red-600'">
                                    {{ r.avg >= 8 ? 'Cemerlang' : r.avg >= 6 ? 'Baik' : r.avg >= 4 ? 'Sederhana' : 'Lemah' }}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <div class="text-center py-10 text-slate-400">
                      <span class="material-icons text-4xl mb-2 block">assessment</span>
                      <p class="text-sm">Tiada data penilaian untuk tahun {{ yearFilter }}</p>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- ── TAB: PEPERIKSAAN ── -->
            @if (activeTab === 'peperiksaan') {
              <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  @for (exam of examCards; track exam.key) {
                    <div class="rounded-xl border-2 p-5 space-y-3" [style.border-color]="exam.color + '60'" [style.background]="exam.color + '08'">
                      <div class="flex items-center gap-2">
                        <span class="material-icons text-lg" [style.color]="exam.color">{{ exam.icon }}</span>
                        <h4 class="font-bold text-slate-800 text-sm">{{ exam.label }}</h4>
                      </div>
                      <p class="text-3xl font-bold text-slate-900">{{ exam.total }}</p>
                      <div class="space-y-2">
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-green-600 font-medium">Lulus</span>
                          <span class="font-bold text-green-700">{{ exam.lulus }}</span>
                        </div>
                        <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div class="h-full bg-green-500 rounded-full" [style.width.%]="exam.total ? (exam.lulus / exam.total * 100) : 0"></div>
                        </div>
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-red-600 font-medium">Tidak Lulus</span>
                          <span class="font-bold text-red-700">{{ exam.tidakLulus }}</span>
                        </div>
                        <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div class="h-full bg-red-500 rounded-full" [style.width.%]="exam.total ? (exam.tidakLulus / exam.total * 100) : 0"></div>
                        </div>
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-slate-500 font-medium">Belum Diproses</span>
                          <span class="font-bold text-slate-600">{{ exam.belum }}</span>
                        </div>
                        <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div class="h-full bg-slate-400 rounded-full" [style.width.%]="exam.total ? (exam.belum / exam.total * 100) : 0"></div>
                        </div>
                      </div>
                      @if (exam.passRate !== null) {
                        <div class="pt-2 border-t border-slate-200 text-center">
                          <span class="text-lg font-bold" [class]="exam.passRate >= 70 ? 'text-green-600' : exam.passRate >= 50 ? 'text-amber-600' : 'text-red-600'">
                            {{ exam.passRate }}%
                          </span>
                          <span class="text-[10px] text-slate-400 block">Kadar Lulus</span>
                        </div>
                      }
                    </div>
                  }
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-slate-700 mb-3">Trend Bulanan Peperiksaan</h4>
                  <div class="h-56"><canvas id="chartExamMonthly"></canvas></div>
                </div>
              </div>
            }
          </div>
        </div>

      </div>
    }
  `,
})
export class AdminStatisticsComponent implements OnInit, OnDestroy {
  loading = true;
  yearFilter = new Date().getFullYear().toString();
  s: any = {};
  charts: any[] = [];
  activeTab = 'permohonan';
  availableYears: number[] = [];

  tabs = [
    { key: 'permohonan', label: 'Permohonan', icon: 'assignment' },
    { key: 'pengadil', label: 'Pengadil', icon: 'groups' },
    { key: 'lantikan', label: 'Lantikan', icon: 'assignment_ind' },
    { key: 'perlawanan', label: 'Perlawanan', icon: 'sports_soccer' },
    { key: 'penilaian', label: 'Penilaian & Merit', icon: 'military_tech' },
    { key: 'peperiksaan', label: 'Peperiksaan', icon: 'school' },
  ];

  summaryCards: { label: string; value: string | number; icon: string; color: string; sub?: string; tab?: string; route?: string }[] = [];
  employmentItems: { label: string; value: number; pct: number }[] = [];
  examCards: { key: string; label: string; icon: string; color: string; total: number; lulus: number; tidakLulus: number; belum: number; passRate: number | null }[] = [];

  constructor(private api: ApiService, private toast: ToastService, public router: Router, public profileModal: ProfileModalService) {}

  expandedDaerah: string | null = null;
  expandedPerlawananDaerah: string | null = null;

  toggleDaerah(daerah: string): void {
    this.expandedDaerah = this.expandedDaerah === daerah ? null : daerah;
  }

  togglePerlawananDaerah(daerah: string): void {
    this.expandedPerlawananDaerah = this.expandedPerlawananDaerah === daerah ? null : daerah;
  }

  ngOnInit(): void {
    const yr = new Date().getFullYear();
    this.availableYears = Array.from({ length: 5 }, (_, i) => yr - 2 + i);
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.api.get<any>('statistics.php', { year: this.yearFilter }).subscribe({
      next: (res) => {
        this.s = res.data || res;
        this.buildDerivedData();
        this.loading = false;
        setTimeout(() => this.renderActiveCharts(), 100);
      },
      error: () => {
        this.loading = false;
        this.toast.error('Gagal memuatkan statistik.');
      },
    });
  }

  onYearChange(): void {
    this.destroyCharts();
    this.loadStats();
  }

  private buildDerivedData(): void {
    const s = this.s;
    const tgPct = s.telegram?.total ? Math.round((s.telegram.linked / s.telegram.total) * 100) : 0;
    this.summaryCards = [
      { label: 'Pengadil Berdaftar', value: s.total || 0, icon: 'badge', color: '#1e293b', tab: 'pengadil', route: '/admin/pengadil-berdaftar' },
      { label: 'Jumlah Permohonan', value: s.applications?.total || 0, icon: 'assignment', color: '#f59e0b', tab: 'permohonan', route: '/admin/permohonan' },
      { label: 'Lantikan', value: s.lantikan?.total || 0, icon: 'assignment_ind', color: '#10b981', tab: 'lantikan', route: '/admin/lantikan' },
      { label: 'Perlawanan', value: s.matches?.uniqueMatches || 0, icon: 'sports_soccer', color: '#f97316', sub: (s.matches?.total || 0) + ' rekod', tab: 'perlawanan' },
      { label: 'Penilaian', value: s.ratings?.total || 0, icon: 'assessment', color: '#3b82f6', sub: s.ratings?.average ? 'Purata: ' + s.ratings.average : undefined, tab: 'penilaian' },
      { label: 'Telegram', value: `${s.telegram?.linked || 0}/${s.telegram?.total || 0}`, icon: 'send', color: '#0088cc', sub: `${tgPct}% aktif` },
    ];

    const emp = s.employmentBreakdown || {};
    const empTotal = Object.values(emp).reduce((a: number, b: any) => a + (b as number), 0) as number;
    this.employmentItems = Object.entries(emp).map(([label, value]) => ({
      label, value: value as number,
      pct: empTotal > 0 ? ((value as number) / empTotal * 100) : 0,
    }));

    const exams = s.exams || {};
    this.examCards = [
      { key: 'ujian_kecergasan', label: 'Ujian Kecergasan', icon: 'fitness_center', color: '#10b981',
        total: exams.ujian_kecergasan?.total || 0, lulus: exams.ujian_kecergasan?.lulus || 0,
        tidakLulus: exams.ujian_kecergasan?.tidak_lulus || 0, belum: exams.ujian_kecergasan?.belum_diproses || 0,
        passRate: this.calcPassRate(exams.ujian_kecergasan) },
      { key: 'ujian_bertulis', label: 'Ujian Kelas III FAM', icon: 'history_edu', color: '#3b82f6',
        total: exams.ujian_bertulis?.total || 0, lulus: exams.ujian_bertulis?.lulus || 0,
        tidakLulus: exams.ujian_bertulis?.tidak_lulus || 0, belum: exams.ujian_bertulis?.belum_diproses || 0,
        passRate: this.calcPassRate(exams.ujian_bertulis) },
      { key: 'ujian_kelas1_fam', label: 'Ujian Kelas I FAM', icon: 'workspace_premium', color: '#8b5cf6',
        total: exams.ujian_kelas1_fam?.total || 0, lulus: exams.ujian_kelas1_fam?.lulus || 0,
        tidakLulus: exams.ujian_kelas1_fam?.tidak_lulus || 0, belum: exams.ujian_kelas1_fam?.belum_diproses || 0,
        passRate: this.calcPassRate(exams.ujian_kelas1_fam) },
    ];
  }

  private calcPassRate(exam: any): number | null {
    if (!exam) return null;
    const tested = (exam.lulus || 0) + (exam.tidak_lulus || 0);
    return tested > 0 ? Math.round((exam.lulus / tested) * 100) : null;
  }

  renderActiveCharts(): void {
    this.destroyCharts();
    setTimeout(() => {
      switch (this.activeTab) {
        case 'permohonan': this.renderAppCharts(); break;
        case 'pengadil': this.renderPengadilCharts(); break;
        case 'lantikan': this.renderLantikanCharts(); break;
        case 'perlawanan': this.renderMatchCharts(); break;
        case 'penilaian': this.renderRatingCharts(); break;
        case 'peperiksaan': this.renderExamCharts(); break;
      }
    }, 50);
  }

  private renderAppCharts(): void {
    const types = this.s.applications?.types || {};
    const typeLabels: Record<string, string> = {
      'pengadil_berdaftar': 'Pengadil Berdaftar', 'penilai_berdaftar': 'RA Berdaftar',
      'ujian_bertulis': 'Ujian Kelas III', 'ujian_kelas1_fam': 'Ujian Kelas I',
    };
    this.makeChart('chartAppTypes', 'bar', {
      labels: Object.keys(types).map(k => typeLabels[k] || k),
      datasets: [{ label: 'Permohonan', data: Object.values(types), backgroundColor: ['#FADA00', '#1e293b', '#3b82f6', '#8b5cf6'], borderRadius: 6 }],
    }, { indexAxis: 'y', plugins: { legend: { display: false } } });

    const status = this.s.applications?.statusBreakdown || {};
    this.makeChart('chartAppStatus', 'doughnut', {
      labels: Object.keys(status),
      datasets: [{ data: Object.values(status), backgroundColor: ['#f59e0b', '#10b981', '#ef4444'], borderWidth: 0 }],
    }, { cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } } });

    const monthly = this.s.applications?.monthlyTrend || {};
    const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    this.makeChart('chartAppMonthly', 'line', {
      labels: months,
      datasets: [{ label: 'Permohonan', data: Object.values(monthly), borderColor: '#FADA00', backgroundColor: '#FADA0020', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#FADA00' }],
    }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } });
  }

  private renderPengadilCharts(): void {
    const gender = this.s.genderBreakdown || {};
    this.makeChart('chartGender', 'doughnut', {
      labels: Object.keys(gender),
      datasets: [{ data: Object.values(gender), backgroundColor: ['#3b82f6', '#ec4899'], borderWidth: 0 }],
    }, { cutout: '60%', plugins: { legend: { display: false } } });

    const district = this.s.districtAddressBreakdown || this.s.districtBreakdown || {};
    this.makeChart('chartDistrict', 'bar', {
      labels: Object.keys(district),
      datasets: [{ label: 'Pengadil', data: Object.values(district), backgroundColor: '#FADA00', borderRadius: 4 }],
    }, { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } });

    const monthly = this.s.monthlyTrend || {};
    const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    this.makeChart('chartRegMonthly', 'bar', {
      labels: months,
      datasets: [{ label: 'Pendaftaran', data: Object.values(monthly), backgroundColor: '#1e293b', borderRadius: 4 }],
    }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } });
  }

  private renderLantikanCharts(): void {
    const l = this.s.lantikan || {};
    this.makeChart('chartLantikan', 'doughnut', {
      labels: ['Selesai', 'Disahkan', 'Belum Selesai'],
      datasets: [{ data: [l.selesai || 0, l.disahkan || 0, l.belum || 0], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'], borderWidth: 0 }],
    }, { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } } });
  }

  private renderMatchCharts(): void {
    const top = this.s.matches?.topPengadil || [];
    if (top.length) {
      this.makeChart('chartMatchBreakdown', 'bar', {
        labels: top.map((r: any) => r.name),
        datasets: [{ label: 'Perlawanan', data: top.map((r: any) => r.count), backgroundColor: '#FADA00', borderRadius: 4 }],
      }, { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } });
    }
  }

  private renderRatingCharts(): void {
    const dist = this.s.ratings?.distribution || {};
    this.makeChart('chartRatingDist', 'bar', {
      labels: Object.keys(dist),
      datasets: [{ label: 'Bilangan', data: Object.values(dist), backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#059669'], borderRadius: 6 }],
    }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } });
  }

  private renderExamCharts(): void {
    const exams = this.s.exams || {};
    const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    const datasets: any[] = [];
    if (exams.ujian_kecergasan?.monthly) datasets.push({ label: 'Kecergasan', data: Object.values(exams.ujian_kecergasan.monthly), borderColor: '#10b981', fill: false, tension: 0.3, pointRadius: 3 });
    if (exams.ujian_bertulis?.monthly) datasets.push({ label: 'Kelas III', data: Object.values(exams.ujian_bertulis.monthly), borderColor: '#3b82f6', fill: false, tension: 0.3, pointRadius: 3 });
    if (exams.ujian_kelas1_fam?.monthly) datasets.push({ label: 'Kelas I', data: Object.values(exams.ujian_kelas1_fam.monthly), borderColor: '#8b5cf6', fill: false, tension: 0.3, pointRadius: 3 });
    if (datasets.length) {
      this.makeChart('chartExamMonthly', 'line', { labels: months, datasets }, { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } });
    }
  }

  private makeChart(id: string, type: string, data: any, opts: any = {}): void {
    const el = document.getElementById(id) as HTMLCanvasElement;
    if (!el) return;
    this.charts.push(new Chart(el, { type, data, options: { responsive: true, maintainAspectRatio: false, ...opts } }));
  }

  private destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  onCardClick(card: any): void {
    if (card.route) {
      this.router.navigate([card.route]);
    } else if (card.tab) {
      this.activeTab = card.tab;
      this.renderActiveCharts();
      // Scroll to tabs
      setTimeout(() => {
        const tabEl = document.querySelector('.border-b.border-slate-200.overflow-x-auto');
        tabEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  ngOnDestroy(): void { this.destroyCharts(); }
}
