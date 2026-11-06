import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';

type Status = 'notifikasi' | 'log_masuk' | 'belum';

interface UsageUser {
  id: number;
  nama_penuh: string | null;
  email: string | null;
  role: string;
  jenis_pengadil: string | null;
  persatuan: string | null;
  status: Status;
  android_version: string | null;
  versi_lama: boolean;
  web_push: boolean;
  last_seen: string | null;
}

interface UsageSummary {
  role: string;
  aktif: number;
  notifikasi: number;
  log_masuk: number;
  belum: number;
  versi_lama: number;
}

interface UsageResponse {
  error: boolean;
  latest_version: string;
  summary: UsageSummary[];
  users: UsageUser[];
}

type Filter = 'all' | Status | 'versi_lama';

const STATUS_LABEL: Record<Status, string> = {
  notifikasi: 'Notifikasi aktif',
  log_masuk: 'Log masuk sahaja',
  belum: 'Belum guna',
};

/** Statistik: who uses the mobile app, from /api/mobile-usage.php (Admin: all, PP Daerah: own district). */
@Component({
  selector: 'app-mobile-usage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="mobile-usage-title" class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 id="mobile-usage-title" class="text-lg font-bold text-slate-900">Penggunaan App Mobile</h2>
          <p class="text-sm text-slate-600">
            Pengguna aktif yang log masuk app Android atau iPhone dan yang menerima notifikasi telefon.
            @if (latest()) { Versi Android terkini: {{ latest() }}. }
          </p>
        </div>
        <div class="flex gap-2">
          <button type="button" (click)="load()" class="inline-flex items-center gap-1 px-3 py-2 text-sm whitespace-nowrap border border-slate-300 rounded-lg hover:bg-slate-50">
            <span class="material-icons text-base" aria-hidden="true">refresh</span>Muat semula
          </button>
          <button type="button" (click)="exportCsv()" [disabled]="!filtered().length"
            class="inline-flex items-center gap-1 px-3 py-2 text-sm whitespace-nowrap font-semibold bg-pahang-yellow text-pahang-black rounded-lg disabled:opacity-50">
            <span class="material-icons text-base" aria-hidden="true">download</span>Eksport CSV
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">{{ error() }}</p>
      } @else if (loading()) {
        <p class="text-sm text-slate-600" role="status">Memuatkan penggunaan app...</p>
      } @else {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          @for (card of cards(); track card.key) {
            <button type="button" (click)="filter.set(card.key)"
              class="text-left bg-white rounded-xl p-4 border shadow-sm transition"
              [class]="filter() === card.key ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'">
              <span class="block text-xs font-medium text-slate-600">{{ card.label }}</span>
              <span class="block text-2xl font-bold" [style.color]="card.color">{{ card.value }}</span>
              <span class="block text-[11px] text-slate-500">{{ card.note }}</span>
            </button>
          }
        </div>

        <div class="overflow-x-auto bg-white rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <caption class="sr-only">Penggunaan app mengikut peranan</caption>
            <thead class="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" class="px-4 py-2">Peranan</th>
                <th scope="col" class="px-4 py-2 text-right">Aktif</th>
                <th scope="col" class="px-4 py-2 text-right">Notifikasi aktif</th>
                <th scope="col" class="px-4 py-2 text-right">Log masuk sahaja</th>
                <th scope="col" class="px-4 py-2 text-right">Belum guna</th>
                <th scope="col" class="px-4 py-2 text-right">Android versi lama</th>
                <th scope="col" class="px-4 py-2 w-40">Guna app</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (s of summary(); track s.role) {
                <tr>
                  <th scope="row" class="px-4 py-2 text-left font-semibold text-slate-800">{{ s.role }}</th>
                  <td class="px-4 py-2 text-right">{{ s.aktif }}</td>
                  <td class="px-4 py-2 text-right text-emerald-700 font-semibold">{{ s.notifikasi }}</td>
                  <td class="px-4 py-2 text-right text-amber-700">{{ s.log_masuk }}</td>
                  <td class="px-4 py-2 text-right text-rose-700">{{ s.belum }}</td>
                  <td class="px-4 py-2 text-right">{{ s.versi_lama }}</td>
                  <td class="px-4 py-2">
                    <div class="flex items-center gap-2">
                      <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
                        <div class="h-full bg-emerald-500" [style.width.%]="percent(s.notifikasi + s.log_masuk, s.aktif)"></div>
                      </div>
                      <span class="text-xs text-slate-600 w-10 text-right">{{ percent(s.notifikasi + s.log_masuk, s.aktif) }}%</span>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="flex flex-col md:flex-row gap-3">
          <label class="flex-1">
            <span class="sr-only">Cari pengguna</span>
            <input type="search" [value]="search()" (input)="search.set($any($event.target).value)"
              placeholder="Cari nama, emel atau persatuan..."
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pahang-yellow" />
          </label>
          @if (roles().length > 1) {
            <label>
              <span class="sr-only">Peranan</span>
              <select [value]="role()" (change)="role.set($any($event.target).value)"
                class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="">Semua peranan</option>
                @for (r of roles(); track r) { <option [value]="r">{{ r }}</option> }
              </select>
            </label>
          }
        </div>

        <div class="overflow-x-auto bg-white rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <caption class="sr-only">Senarai pengguna dan status app</caption>
            <thead class="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" class="px-4 py-2">Nama</th>
                <th scope="col" class="px-4 py-2">Peranan</th>
                <th scope="col" class="px-4 py-2">Persatuan</th>
                <th scope="col" class="px-4 py-2">Status</th>
                <th scope="col" class="px-4 py-2">Peranti</th>
                <th scope="col" class="px-4 py-2">Terakhir</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (u of visible(); track u.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-2">
                    <span class="font-medium text-slate-800">{{ u.nama_penuh || '-' }}</span>
                    <span class="block text-xs text-slate-500">{{ u.email }}</span>
                  </td>
                  <td class="px-4 py-2 text-slate-700">{{ u.jenis_pengadil || u.role }}</td>
                  <td class="px-4 py-2 text-slate-700">{{ u.persatuan || '-' }}</td>
                  <td class="px-4 py-2">
                    <span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" [class]="statusClass(u.status)">{{ statusLabel(u.status) }}</span>
                  </td>
                  <td class="px-4 py-2 text-xs text-slate-700 whitespace-nowrap">
                    @if (u.android_version) {
                      <span [class.text-rose-700]="u.versi_lama" [class.font-semibold]="u.versi_lama">Android {{ u.android_version }}{{ u.versi_lama ? ' (lama)' : '' }}</span>
                    }
                    @if (u.android_version && u.web_push) { · }
                    @if (u.web_push) { <span>iPhone / web</span> }
                    @if (!u.android_version && !u.web_push) { <span class="text-slate-400">-</span> }
                  </td>
                  <td class="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{{ u.last_seen || '-' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Tiada pengguna untuk penapis ini.</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (filtered().length > visible().length) {
          <div class="text-center">
            <button type="button" (click)="limit.set(limit() + 100)" class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
              Papar lagi ({{ filtered().length - visible().length }} lagi)
            </button>
          </div>
        }
        <p class="text-xs text-slate-500">
          "Log masuk sahaja": app dibuka dan log masuk (90 hari terakhir) tetapi notifikasi belum dibenarkan. "Belum guna": tiada log masuk app aktif.
          Pengguna yang log keluar dari app dikira belum guna.
        </p>
      }
    </section>
  `,
})
export class MobileUsageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly users = signal<UsageUser[]>([]);
  readonly summary = signal<UsageSummary[]>([]);
  readonly latest = signal('');
  readonly filter = signal<Filter>('all');
  readonly search = signal('');
  readonly role = signal('');
  readonly limit = signal(100);

  readonly roles = computed(() => [...new Set(this.users().map((u) => u.role))]);

  readonly cards = computed(() => {
    const all = this.users();
    const count = (f: (u: UsageUser) => boolean) => all.filter(f).length;
    const total = all.length;
    const used = count((u) => u.status !== 'belum');
    return [
      { key: 'all' as Filter, label: 'Guna app', value: `${used} / ${total}`, note: `${this.percent(used, total)}% pengguna aktif`, color: '#0f172a' },
      { key: 'notifikasi' as Filter, label: 'Notifikasi aktif', value: count((u) => u.status === 'notifikasi'), note: 'Terima lantikan terus ke telefon', color: '#047857' },
      { key: 'log_masuk' as Filter, label: 'Log masuk sahaja', value: count((u) => u.status === 'log_masuk'), note: 'Perlu aktifkan notifikasi', color: '#b45309' },
      { key: 'belum' as Filter, label: 'Belum guna', value: count((u) => u.status === 'belum'), note: 'Belum log masuk app', color: '#be123c' },
    ];
  });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const filter = this.filter();
    const role = this.role();
    return this.users().filter((u) =>
      (filter === 'all' || (filter === 'versi_lama' ? u.versi_lama : u.status === filter))
      && (!role || u.role === role)
      && (!q || [u.nama_penuh, u.email, u.persatuan].some((v) => (v ?? '').toLowerCase().includes(q))));
  });

  readonly visible = computed(() => this.filtered().slice(0, this.limit()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.get<UsageResponse>('mobile-usage.php', undefined, { background: true }).subscribe({
      next: (res) => {
        this.users.set(res.users ?? []);
        this.summary.set(res.summary ?? []);
        this.latest.set(res.latest_version ?? '');
        this.limit.set(100);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Statistik penggunaan app tidak dapat dimuatkan.');
        this.loading.set(false);
      },
    });
  }

  percent(part: number, total: number): number {
    return total ? Math.round((part / total) * 100) : 0;
  }

  statusLabel(status: Status): string {
    return STATUS_LABEL[status];
  }

  statusClass(status: Status): string {
    return status === 'notifikasi' ? 'bg-emerald-50 text-emerald-800'
      : status === 'log_masuk' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800';
  }

  exportCsv(): void {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Nama', 'Emel', 'Peranan', 'Jenis', 'Persatuan', 'Status', 'Android', 'iPhone/web', 'Terakhir'].map(cell).join(','),
      ...this.filtered().map((u) => [u.nama_penuh, u.email, u.role, u.jenis_pengadil, u.persatuan, this.statusLabel(u.status),
        u.android_version ?? '', u.web_push ? 'Ya' : '', u.last_seen ?? ''].map(cell).join(',')),
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Penggunaan_App_RefPahang_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
