import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface Item { id: number; title: string; subtitle?: string; date: string; time?: string;
  status?: string; tournament?: string; officials?: string; jawatan?: string; }
interface Registration { id: number; jenis_borang: string; tahun_permohonan: number;
  status: string; status_workflow: string; status_seminar?: string; status_ujian?: string; }
interface Application { total: number; pending: number; approved: number; rejected: number; }
interface Dashboard {
  view: string; year: number; name: string; district: string; updated_at: string;
  totals: Record<string, number>; monthly: { month: number; total: number; verified: number }[];
  upcoming: Item[]; responses?: Item[]; recent: Item[]; registrations: Registration[];
  announcements: { id: number; title: string; content: string; created_at: string }[];
  ranking: { name: string; total: number; verified: number }[];
  applications: Record<string, Application>; positions?: { label: string; total: number }[];
  minimum_matches?: number; application_year?: number; can_ra: boolean; can_referee: boolean; unit_note: string;
}
interface Reply { error: boolean; message?: string; data: Dashboard; }
interface Metric { label: string; value: number; icon: string; hint: string; }
interface Action { title: string; detail: string; count: number; route: string; params?: Record<string, string>; }

import { MobileUsageComponent } from '../mobile-usage/mobile-usage.component';

@Component({
  selector: 'app-portal-dashboard',
  imports: [RouterLink, DatePipe, MobileUsageComponent],
  templateUrl: './portal-dashboard.component.html',
  styleUrl: './portal-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalDashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly isPp = this.auth.currentUser?.role === 'PP Daerah';
  readonly view = this.route.snapshot.data['dashboardView'] as string ||
    (this.isPp ? 'pp' : this.auth.currentUser?.role === 'Penilai' ? 'ra' : 'pengadil');
  readonly statistical = this.route.snapshot.data['section'] === 'statistik';
  readonly base = this.view === 'pp' ? '/pp-daerah' : this.view === 'ra'
    ? this.isPp ? '/pp-daerah/penilai' : '/penilai' : '/pengadil';
  readonly title = this.view === 'pp' ? 'Pengurusan daerah' : this.view === 'ra' ? 'Penilaian pengadil' : 'Tugasan pengadil';
  readonly description = this.view === 'pp' ? 'Pantau semakan, pendaftaran dan lantikan pegawai daerah anda.'
    : this.view === 'ra' ? 'Urus tugasan penilaian, siapkan laporan dan ikuti pengesahannya.'
    : 'Semak lantikan, rekod perlawanan dan persediaan pendaftaran anda.';
  readonly year = signal(Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric' }).format(new Date())));
  readonly years = Array.from({ length: 9 }, (_, i) => this.year() + 1 - i);
  readonly months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  readonly loading = signal(true);
  readonly error = signal('');
  readonly data = signal<Dashboard | null>(null);
  private request?: Subscription;
  readonly metricCards = computed<Metric[]>(() => {
    const t = this.data()?.totals ?? {};
    const card = (label: string, key: string, icon: string, hint: string): Metric => ({ label, value: t[key] ?? 0, icon, hint });
    if (this.view === 'pp') return [card('Pengadil berdaftar', 'registered', 'badge', 'Pendaftaran tahunan diluluskan'),
      card('Layak patch / lesen', 'licensed', 'verified', 'Keputusan ujian kecergasan lulus'),
      card('Rekod pegawai', 'records', 'sports_soccer', 'Termasuk rekod lama yang belum dipadankan'),
      card('Rekod disahkan', 'verified', 'check_circle', 'Semakan perlawanan telah selesai')];
    if (this.view === 'ra') return [card('Tugasan diterima', 'accepted', 'assignment_turned_in', 'Lantikan RA dalam tahun dipilih'),
      card('Belum ada laporan', 'no_report', 'edit_note', 'Tugasan diterima tanpa laporan'),
      card('Menunggu pengerusi', 'submitted', 'pending_actions', 'Dihantar, belum disahkan'),
      card('Laporan disahkan', 'confirmed', 'verified', 'Pengesahan laporan selesai')];
    return [card('Rekod perlawanan', 'records', 'sports_soccer', 'Rekod peribadi dalam tahun dipilih'),
      card('Disahkan', 'verified', 'check_circle', 'Rekod disahkan oleh PP / Admin'),
      card('Menunggu semakan', 'pending', 'hourglass_top', 'Belum mendapat keputusan'),
      card('Tidak disahkan', 'rejected', 'info', 'Semak catatan sebelum pembetulan')];
  });
  readonly actions = computed<Action[]>(() => {
    const t = this.data()?.totals ?? {};
    if (this.view === 'pp') return [
      { title: 'Permohonan perlu semakan PP', count: t['review_applications'] ?? 0,
        detail: 'Semua sesi. Keputusan seterusnya menunggu tindakan anda.', route: '/pp-daerah/pengesahan' },
      { title: 'Rekod perlawanan menunggu', count: t['pending_units'] ?? 0, detail: `Kumpulan / rekod tahun ${this.year()} untuk disemak.`,
        route: '/pp-daerah/pengesahan-perlawanan', params: { status: 'pending', year: String(this.year()) } },
    ];
    const result: Action[] = [{ title: 'Lantikan perlu dijawab', count: t['response'] ?? 0,
      detail: 'Lantikan yang sudah dimaklumkan. Semak tarikh akhir dalam senarai tugas.',
      route: this.base + '/tugasan', params: { status: 'Belum Jawab' } }];
    if (this.view === 'ra') result.push({ title: 'Penilaian perlu disiapkan', count: t['needs_report'] ?? 0,
      detail: 'Tugasan diterima tanpa laporan atau masih draf dalam tahun dipilih.', route: this.base + '/penilaian',
      params: { year: String(this.year()), needs_report: '1' } });
    else result.push({ title: 'Rekod perlu perhatian', count: t['rejected'] ?? 0,
      detail: 'Lihat sebab rekod tidak disahkan. Hubungi PP jika rekod berkumpulan perlu dibetulkan.',
      route: '/pengadil/perlawanan', params: { status: 'Tidak Disahkan', year: String(this.year()) } });
    return result;
  });
  readonly chartMax = computed(() => Math.max(1, ...(this.data()?.monthly.map(m => m.total) ?? [])));
  readonly progress = computed(() => Math.min(100, Math.round((this.data()?.totals['verified'] ?? 0) / (this.data()?.minimum_matches || 20) * 100)));
  readonly applicationTypes = [
    { key: 'pengadil_berdaftar', label: 'Tahunan Pengadil', route: '/pp-daerah/permohonan/pengadil' },
    { key: 'penilai_berdaftar', label: 'Tahunan Penilai', route: '/pp-daerah/permohonan/berdaftar' },
    { key: 'kelas3_fam', label: 'Kelas III FAM', route: '/pp-daerah/permohonan/kelas3' },
    { key: 'ujian_kelas1_fam', label: 'Kelas I FAM', route: '/pp-daerah/permohonan/kelas1' },
  ];
  ngOnInit(): void {
    const year = Number(this.route.snapshot.queryParamMap.get('year'));
    if (Number.isInteger(year) && this.years.includes(year)) this.year.set(year);
    this.load();
  }
  ngOnDestroy(): void { this.request?.unsubscribe(); }
  selectYear(event: Event): void { this.year.set(Number((event.target as HTMLSelectElement).value)); this.load(); }
  load(): void {
    this.request?.unsubscribe(); this.loading.set(true); this.error.set(''); this.data.set(null);
    this.request = this.api.get<Reply>('portal-dashboard.php', { view: this.view, year: String(this.year()) }).subscribe({
      next: reply => { if (reply.error || !reply.data) this.error.set(reply.message || 'Data tidak dapat dimuatkan.');
        else this.data.set(reply.data); this.loading.set(false); },
      error: () => { this.error.set('Data tidak dapat dimuatkan. Semak sambungan dan cuba semula.'); this.loading.set(false); },
    });
  }
  formLabel(value: string): string {
    return ({ pengadil_berdaftar: 'Pendaftaran tahunan pengadil', penilai_berdaftar: 'Pendaftaran tahunan penilai',
      kelas3_fam: 'Kelas III FAM', ujian_kelas1_fam: 'Kelas I FAM', ujian_kecergasan: 'Ujian kecergasan' } as Record<string, string>)[value] || value.replaceAll('_', ' ');
  }
}
