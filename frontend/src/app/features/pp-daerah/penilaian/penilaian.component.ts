import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pp-penilaian',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Laporan Penilaian</h1>
          <p class="text-sm text-slate-500 mt-0.5">Senarai laporan penilaian pengadil dalam daerah anda</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-xs text-slate-500 font-medium">Jumlah Laporan</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">{{ reports.length }}</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-xs text-green-600 font-medium">Purata Markah</p>
          <p class="text-2xl font-bold mt-1" [style.color]="markahColor(avgMarkah)">{{ avgMarkah ? avgMarkah.toFixed(1) : '-' }}</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-xs text-blue-600 font-medium">Markah Tertinggi</p>
          <p class="text-2xl font-bold text-blue-700 mt-1">{{ maxMarkah ? maxMarkah.toFixed(1) : '-' }}</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-xs text-amber-600 font-medium">Markah Terendah</p>
          <p class="text-2xl font-bold text-amber-700 mt-1">{{ minMarkah ? minMarkah.toFixed(1) : '-' }}</p>
        </div>
      </div>

      <!-- Search -->
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <input type="text" [(ngModel)]="searchQuery" placeholder="Cari perlawanan, kejohanan, pengadil..."
          class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none" />
      </div>

      <!-- Loading -->
      @if (loading) {
        <div class="flex justify-center py-12">
          <div class="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }

      <!-- Empty -->
      @if (!loading && reports.length === 0) {
        <div class="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <span class="material-icons text-5xl text-slate-300">assessment</span>
          <p class="text-slate-500 mt-3">Tiada laporan penilaian dijumpai</p>
        </div>
      }

      <!-- Report List -->
      @if (!loading && filteredReports.length > 0) {
        <!-- Desktop Table -->
        <div class="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 border-b">
                <tr>
                  <th class="text-left px-4 py-3 font-semibold text-slate-600">Perlawanan</th>
                  <th class="text-left px-4 py-3 font-semibold text-slate-600">Kejohanan</th>
                  <th class="text-center px-4 py-3 font-semibold text-slate-600">Tarikh</th>
                  <th class="text-center px-4 py-3 font-semibold text-slate-600">Keputusan</th>
                  <th class="text-left px-4 py-3 font-semibold text-slate-600">Penilai</th>
                  <th class="text-center px-4 py-3 font-semibold text-slate-600">Pegawai & Markah</th>
                  <th class="text-center px-4 py-3 font-semibold text-slate-600">Tindakan</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (r of filteredReports; track r.id) {
                  <tr class="hover:bg-slate-50/50 transition">
                    <td class="px-4 py-3">
                      <p class="font-semibold text-slate-800">{{ r.pasukan_home }} vs {{ r.pasukan_away }}</p>
                      <p class="text-xs text-slate-400">#{{ r.no_perlawanan }}</p>
                    </td>
                    <td class="px-4 py-3 text-slate-600">{{ r.nama_kejohanan }}</td>
                    <td class="px-4 py-3 text-center text-slate-600 whitespace-nowrap">{{ formatDate(r.tarikh) }}</td>
                    <td class="px-4 py-3 text-center font-bold">{{ getScore(r) }}</td>
                    <td class="px-4 py-3 text-slate-600">{{ r.nama_penilai || '-' }}</td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-1 justify-center">
                        @for (pg of r.pegawai || []; track pg.jawatan) {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
                            [class]="markahBg(pg.markah)">
                            <span class="font-bold">{{ jawatanShort(pg.jawatan) }}</span>
                            <span class="font-bold" [style.color]="markahColor(pg.markah)">{{ pg.markah ? (+pg.markah).toFixed(1) : '-' }}</span>
                          </span>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <button (click)="viewReport(r.id)" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Lihat">
                          <span class="material-icons text-sm">visibility</span>
                        </button>
                        <button (click)="downloadReport(r.id)" class="p-1.5 rounded-lg hover:bg-slate-100 text-blue-600" title="Muat Turun PDF">
                          <span class="material-icons text-sm">download</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Mobile Cards -->
        <div class="md:hidden space-y-3">
          @for (r of filteredReports; track r.id) {
            <div class="bg-white rounded-xl border border-slate-200 p-4">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <p class="font-semibold text-slate-800">{{ r.pasukan_home }} vs {{ r.pasukan_away }}</p>
                  <p class="text-xs text-slate-400">{{ r.nama_kejohanan }} · #{{ r.no_perlawanan }}</p>
                </div>
                <span class="text-sm font-bold">{{ getScore(r) }}</span>
              </div>
              <div class="flex items-center gap-2 text-xs text-slate-500 mb-3">
                <span class="material-icons text-xs">calendar_today</span>
                {{ formatDate(r.tarikh) }}
                <span class="material-icons text-xs ml-2">person</span>
                {{ r.nama_penilai || '-' }}
              </div>
              <div class="flex flex-wrap gap-1 mb-3">
                @for (pg of r.pegawai || []; track pg.jawatan) {
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
                    [class]="markahBg(pg.markah)">
                    <span class="font-bold">{{ jawatanShort(pg.jawatan) }}</span>
                    <span class="font-bold" [style.color]="markahColor(pg.markah)">{{ pg.markah ? (+pg.markah).toFixed(1) : '-' }}</span>
                  </span>
                }
              </div>
              <div class="flex gap-2">
                <button (click)="viewReport(r.id)" class="flex-1 text-center py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50">
                  <span class="material-icons text-xs align-middle mr-1">visibility</span>Lihat
                </button>
                <button (click)="downloadReport(r.id)" class="flex-1 text-center py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">
                  <span class="material-icons text-xs align-middle mr-1">download</span>PDF
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Detail Modal -->
      @if (selectedReport) {
        <div class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" (click)="selectedReport = null">
          <div class="bg-white rounded-2xl w-full max-w-3xl my-8 shadow-2xl" (click)="$event.stopPropagation()">
            <!-- Modal Header -->
            <div class="bg-slate-900 text-white rounded-t-2xl p-5">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-bold">{{ selectedReport.pasukan_home }} vs {{ selectedReport.pasukan_away }}</h3>
                  <p class="text-sm text-slate-300 mt-0.5">{{ selectedReport.nama_kejohanan }} · {{ formatDate(selectedReport.tarikh) }}</p>
                </div>
                <button (click)="selectedReport = null" class="p-1 rounded-lg hover:bg-white/10">
                  <span class="material-icons">close</span>
                </button>
              </div>
            </div>

            <div class="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              <!-- Match Info -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p class="text-xs text-slate-500">No. Perlawanan</p><p class="font-semibold">{{ selectedReport.no_perlawanan }}</p></div>
                <div><p class="text-xs text-slate-500">Tempat</p><p class="font-semibold">{{ selectedReport.tempat || '-' }}</p></div>
                <div><p class="text-xs text-slate-500">Penilai</p><p class="font-semibold">{{ selectedReport.nama_penilai || '-' }}</p></div>
                <div><p class="text-xs text-slate-500">Tahap Kesukaran</p><p class="font-semibold">{{ selectedReport.tahap_kesukaran }}</p></div>
              </div>

              <!-- Keputusan Perlawanan -->
              @if (selectedReport.skor_ht_home != null) {
                <div>
                  <h4 class="text-sm font-semibold text-slate-700 mb-2">Keputusan Perlawanan</h4>
                  <div class="overflow-x-auto">
                    <table class="w-full max-w-md mx-auto text-sm border-collapse">
                      <thead><tr class="bg-slate-100"><th class="border px-3 py-1.5 font-semibold">{{ selectedReport.pasukan_home }}</th><th class="border px-3 py-1.5 font-semibold text-slate-400">-</th><th class="border px-3 py-1.5 font-semibold">{{ selectedReport.pasukan_away }}</th></tr></thead>
                      <tbody>
                        <tr><td class="border px-3 py-1 text-center font-bold">{{ selectedReport.skor_ht_home }}</td><td class="border px-3 py-1 text-center text-xs text-slate-500">Separuh Masa 1</td><td class="border px-3 py-1 text-center font-bold">{{ selectedReport.skor_ht_away }}</td></tr>
                        <tr><td class="border px-3 py-1 text-center font-bold">{{ selectedReport.skor_ft_home ?? '-' }}</td><td class="border px-3 py-1 text-center text-xs text-slate-500">Separuh Masa 2</td><td class="border px-3 py-1 text-center font-bold">{{ selectedReport.skor_ft_away ?? '-' }}</td></tr>
                        @if (selectedReport.skor_et_home != null) {
                          <tr><td class="border px-3 py-1 text-center font-bold">{{ selectedReport.skor_et_home }}</td><td class="border px-3 py-1 text-center text-xs text-slate-500">Extra Time</td><td class="border px-3 py-1 text-center font-bold">{{ selectedReport.skor_et_away }}</td></tr>
                        }
                        @if (selectedReport.skor_ps_home != null) {
                          <tr><td class="border px-3 py-1 text-center font-bold">{{ selectedReport.skor_ps_home }}</td><td class="border px-3 py-1 text-center text-xs text-slate-500">Penalti</td><td class="border px-3 py-1 text-center font-bold">{{ selectedReport.skor_ps_away }}</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }

              <!-- Officials Table -->
              <div>
                <h4 class="text-sm font-semibold text-slate-700 mb-2">Pegawai Perlawanan</h4>
                <div class="overflow-x-auto rounded-lg border border-slate-200">
                  <table class="w-full text-sm">
                    <thead class="bg-slate-50">
                      <tr>
                        <th class="text-left px-3 py-2 font-semibold text-slate-600">Jawatan</th>
                        <th class="text-left px-3 py-2 font-semibold text-slate-600">Nama</th>
                        <th class="text-center px-3 py-2 font-semibold text-slate-600">Markah</th>
                        <th class="text-center px-3 py-2 font-semibold text-slate-600">Prestasi</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      @for (pg of selectedReport.pegawai || []; track pg.jawatan) {
                        <tr class="hover:bg-slate-50/50">
                          <td class="px-3 py-2 font-medium text-slate-700">{{ pg.jawatan }}</td>
                          <td class="px-3 py-2 text-slate-800">{{ pg.nama_pengadil || '-' }}</td>
                          <td class="px-3 py-2 text-center font-bold" [style.color]="markahColor(pg.markah)">
                            {{ pg.markah ? (+pg.markah).toFixed(1) : '-' }}
                          </td>
                          <td class="px-3 py-2 text-center">
                            <span class="px-2 py-0.5 rounded-full text-xs font-bold" [class]="prestasiBg(pg.prestasi)">
                              {{ pg.prestasi || '-' }}
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Per-official evaluation details -->
              @for (pg of selectedReport.pegawai || []; track pg.jawatan) {
                <div class="border rounded-xl overflow-hidden">
                  <div class="bg-slate-900 text-white px-4 py-2 text-sm font-semibold flex items-center justify-between">
                    <span>{{ pg.jawatan }} : {{ pg.nama_pengadil }}</span>
                    <span class="font-bold" [style.color]="markahColor(pg.markah)">{{ pg.markah ? (+pg.markah).toFixed(1) : '-' }}</span>
                  </div>
                  <div class="p-4 space-y-3 text-sm">
                    @for (section of getSections(pg); track section.key) {
                      <div>
                        <p class="font-semibold text-slate-700 text-xs uppercase tracking-wider mb-1">{{ section.label }}</p>
                        @if (section.kekuatan?.length) {
                          <div class="mb-1">
                            <span class="text-xs font-medium text-green-700">Kekuatan:</span>
                            <div class="flex flex-wrap gap-1 mt-0.5">
                              @for (item of section.kekuatan; track item) {
                                <span class="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">{{ item }}</span>
                              }
                            </div>
                          </div>
                        }
                        @if (section.kelemahan?.length) {
                          <div class="mb-1">
                            <span class="text-xs font-medium text-red-600">Kelemahan:</span>
                            <div class="flex flex-wrap gap-1 mt-0.5">
                              @for (item of section.kelemahan; track item) {
                                <span class="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 border border-red-200">{{ item }}</span>
                              }
                            </div>
                          </div>
                        }
                        @if (section.nasihat) {
                          <div class="bg-blue-50 rounded-lg px-3 py-1.5 text-xs text-blue-700 mt-1">
                            <span class="font-semibold">Nasihat:</span> {{ section.nasihat }}
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Overall Remarks -->
              @if (selectedReport.ulasan_keseluruhan) {
                <div class="bg-slate-50 rounded-xl p-4">
                  <p class="text-xs font-semibold text-slate-600 mb-1">Ulasan Keseluruhan</p>
                  <p class="text-sm text-slate-700">{{ selectedReport.ulasan_keseluruhan }}</p>
                </div>
              }

              <!-- Download -->
              <div class="flex justify-end">
                <button (click)="downloadReport(selectedReport.id)" class="bg-amber-400 text-black font-semibold px-5 py-2 rounded-lg text-sm hover:bg-amber-500 flex items-center gap-2">
                  <span class="material-icons text-sm">download</span>
                  Muat Turun PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PpPenilaianComponent implements OnInit {
  reports: any[] = [];
  loading = true;
  searchQuery = '';
  selectedReport: any = null;
  avgMarkah: number | null = null;
  maxMarkah: number | null = null;
  minMarkah: number | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.loading = true;
    this.http.get<any>('/api/pp-penilaian.php').subscribe({
      next: (res) => {
        this.reports = res.data || [];
        this.computeStats();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  computeStats(): void {
    const allMarkah: number[] = [];
    this.reports.forEach((r: any) => {
      (r.pegawai || []).forEach((pg: any) => {
        if (pg.markah) allMarkah.push(+pg.markah);
      });
    });
    if (allMarkah.length) {
      this.avgMarkah = allMarkah.reduce((a, b) => a + b, 0) / allMarkah.length;
      this.maxMarkah = Math.max(...allMarkah);
      this.minMarkah = Math.min(...allMarkah);
    }
  }

  get filteredReports(): any[] {
    if (!this.searchQuery.trim()) return this.reports;
    const q = this.searchQuery.toLowerCase();
    return this.reports.filter(
      (r: any) =>
        (r.pasukan_home || '').toLowerCase().includes(q) ||
        (r.pasukan_away || '').toLowerCase().includes(q) ||
        (r.nama_kejohanan || '').toLowerCase().includes(q) ||
        (r.nama_penilai || '').toLowerCase().includes(q) ||
        (r.pegawai || []).some((pg: any) => (pg.nama_pengadil || '').toLowerCase().includes(q))
    );
  }

  viewReport(id: number): void {
    this.http.get<any>(`/api/pp-penilaian.php?id=${id}`).subscribe({
      next: (res) => {
        this.selectedReport = res.laporan;
      },
      error: () => {
        alert('Gagal memuatkan laporan.');
      },
    });
  }

  downloadReport(id: number): void {
    window.open(`/api/download-laporan-penilaian.php?id=${id}`, '_blank');
  }

  getScore(r: any): string {
    if (r.skor_ht_home != null && r.skor_ft_home != null) {
      const h = +r.skor_ht_home + +r.skor_ft_home;
      const a = +r.skor_ht_away + +r.skor_ft_away;
      return `${h} - ${a}`;
    }
    return '-';
  }

  getSections(pg: any): any[] {
    const sections: any[] = [];
    if (pg.jawatan === 'Pengadil') {
      sections.push(
        { key: 'kawalan', label: 'Kawalan Perlawanan', kekuatan: pg.kawalan_kekuatan, kelemahan: pg.kawalan_kelemahan, nasihat: pg.kawalan_nasihat },
        { key: 'fizikal', label: 'Kecergasan Fizikal', kekuatan: pg.fizikal_kekuatan, kelemahan: pg.fizikal_kelemahan, nasihat: pg.fizikal_nasihat },
        { key: 'kerjasama', label: 'Kerjasama Berpasukan', kekuatan: pg.kerjasama_kekuatan, kelemahan: pg.kerjasama_kelemahan, nasihat: pg.kerjasama_nasihat }
      );
    } else {
      sections.push({
        key: 'kawalan',
        label: pg.jawatan.includes('Penolong') ? 'Penolong Pengadil' : 'Pegawai ke-4',
        kekuatan: pg.kawalan_kekuatan,
        kelemahan: pg.kawalan_kelemahan,
        nasihat: pg.kawalan_nasihat,
      });
    }
    return sections;
  }

  formatDate(d: string): string {
    if (!d) return '-';
    const dt = new Date(d);
    const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  }

  jawatanShort(j: string): string {
    if (j === 'Pengadil') return 'R';
    if (j === 'Penolong Pengadil 1') return 'AR1';
    if (j === 'Penolong Pengadil 2') return 'AR2';
    if (j.includes('ke4') || j.includes('Keempat')) return 'P4';
    return j;
  }

  markahColor(m: any): string {
    if (!m) return '#6B7280';
    const v = +m;
    if (v >= 8.3) return '#059669';
    if (v >= 8.0) return '#2563EB';
    if (v >= 7.5) return '#D97706';
    return '#DC2626';
  }

  markahBg(m: any): string {
    if (!m) return 'bg-slate-50 border-slate-200';
    const v = +m;
    if (v >= 8.3) return 'bg-green-50 border-green-200';
    if (v >= 8.0) return 'bg-blue-50 border-blue-200';
    if (v >= 7.5) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  }

  prestasiBg(p: string): string {
    switch (p) {
      case 'Sangat Baik': return 'bg-green-100 text-green-700';
      case 'Baik': return 'bg-blue-100 text-blue-700';
      case 'Memuaskan': return 'bg-amber-100 text-amber-700';
      case 'Tidak Memuaskan': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  }
}
