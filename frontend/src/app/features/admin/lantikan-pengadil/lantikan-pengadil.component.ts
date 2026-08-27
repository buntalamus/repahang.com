import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { DatePipe, SlicePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProfileModalService } from '../../../core/services/profile-modal.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { matchesJadualSearch } from './jadual-search';
import * as XLSX from 'xlsx';

type DirectLinkType = 'accept_url' | 'reject_url' | 'ra_form_url' | 'telegram_link_url';
type ManualDeliveryType = 'appointment' | 'ra_form' | 'telegram_link';

interface LantikanAuditEvent {
  id: number;
  event_type: string;
  channel: string;
  event_status: string;
  link_url: string | null;
  details: Record<string, unknown>;
  actor_type: string;
  actor_user_id: number | null;
  created_at: string;
}

interface LantikanAuditData {
  lantikan: {
    id: number;
    status: string;
    is_external: boolean;
    email_available: boolean;
    telegram_linked: boolean;
    notif_hantar: number;
    tg_notif_hantar: number;
    tarikh_notif: string | null;
  };
  links: Record<DirectLinkType, string | null>;
  events: LantikanAuditEvent[];
}

type TelegramOnboardingStatus =
  | 'linked'
  | 'no_email'
  | 'invalid_email'
  | 'ready'
  | 'failed'
  | 'emailed_waiting';

interface TelegramOnboardingCounts {
  total_external: number;
  linked: number;
  no_email: number;
  invalid_email: number;
  ready: number;
  failed: number;
  emailed_waiting: number;
  initial_sendable: number;
  resendable: number;
}

interface TelegramOnboardingRecipient {
  id: number;
  nama: string;
  daerah: string | null;
  negeri: string;
  no_tel: string | null;
  emel: string;
  jenis_pengadil: string;
  attempts: number;
  first_sent_at: string | null;
  last_sent_at: string | null;
  last_failed_at: string | null;
  last_error: string | null;
  linked_at: string | null;
  telegram_linked: boolean;
  email_valid: boolean;
  onboarding_status: TelegramOnboardingStatus;
  link_url: string | null;
}

interface TelegramOnboardingBatch {
  id: number;
  attempt_mode: 'initial' | 'resend';
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  status: 'processing' | 'completed' | 'partial' | 'failed';
  started_at: string;
  completed_at: string | null;
}

interface TelegramOnboardingPreview {
  kejohanan: { id: number; nama: string; status: string };
  counts: TelegramOnboardingCounts;
  recipients: TelegramOnboardingRecipient[];
  recent_batches: TelegramOnboardingBatch[];
}

interface TelegramOnboardingResponse {
  error: boolean;
  message?: string;
  sent?: number;
  failed?: number;
  skipped?: number;
  data: TelegramOnboardingPreview;
}

interface PengerusiCandidate {
  source: 'Berdaftar' | 'Luar';
  official_id: number;
  nama: string;
  daerah: string | null;
  negeri: string | null;
  no_telefon: string | null;
  email: string | null;
  dalam_pool: boolean;
  telegram_linked: boolean;
}

@Component({
  selector: 'app-lantikan-pengadil',
  standalone: true,
  imports: [FormsModule, DatePipe, SlicePipe, LoadingComponent, ConfirmModalComponent],
  templateUrl: './lantikan-pengadil.component.html',
})
export class LantikanPengadilComponent implements OnInit {

  tabs = [
    { id: 'kejohanan',       label: 'Kejohanan' },
    { id: 'jadual',          label: 'Jadual Perlawanan' },
    { id: 'lantikan',        label: 'Lantikan Pengadil' },
    { id: 'jadual-lantikan', label: 'Jadual Lantikan' },
    { id: 'penilaian',       label: 'Laporan Penilaian' },
  ];
  activeTab = 'kejohanan';

  jawatanList = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4', 'Penilai Pengadil'];
  readonly requiredJawatan = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2'];

  // Kejohanan
  loadingKejohanan = true;
  kejohananList: any[] = [];
  selectedKejohanan: any = null;
  selectedKejohananId: number | null = null;
  showKejohananModal = false;
  editingKejohanan: any = null;
  savingKejohanan = false;
  kejohananForm = { nama: '', jenis_kejohanan: 'Persahabatan', peringkat_kejohanan: 'Daerah', tarikh_mula: '', tarikh_akhir: '', tempat: '', anjuran: '', status: 'Draf' };
  kejohananSearch = '';
  kejohananStatusFilter = '';
  kejohananPage = 1;
  kejohananPerPage = 15;

  // Jadual Logo Upload
  uploadingJadualLogo: string | null = null;

  // Kejohanan Logo Upload
  uploadingKejohananLogo: string | null = null;

  // Pool Pengadil
  poolList: any[] = [];
  loadingPool = false;
  showPoolModal = false;
  poolTab: 'berdaftar' | 'luar' = 'berdaftar';
  availableBerdaftar: any[] = [];
  availableLuar: any[] = [];
  selectedBerdaftarIds = new Set<number>();
  selectedLuarIds = new Set<number>();
  poolSearchText = '';
  addingToPool = false;
  // Auto-tick dari Excel
  poolMatchSummary: { matched: number; berdaftar: number; luar: number; alreadyInPool: number; notFound: string[] } | null = null;
  showTelegramOnboardingModal = false;
  loadingTelegramOnboarding = false;
  sendingTelegramOnboarding = false;
  telegramOnboardingPreview: TelegramOnboardingPreview | null = null;
  telegramOnboardingResult: { message: string; sent: number; failed: number; skipped: number } | null = null;

  // Pengerusi Pengadil / pengesah laporan RA mengikut kejohanan
  loadingPengerusi = false;
  savingPengerusi = false;
  showPengerusiModal = false;
  pengerusiCurrent: any = null;
  pengerusiCandidates: PengerusiCandidate[] = [];
  pengerusiSearch = '';
  selectedPengerusiKey = '';
  pengerusiJawatan = 'Pengerusi Pengadil';

  // Jadual
  loadingJadual = false;
  jadualList: any[] = [];
  jadualSearch = '';
  selectedJadualIds = new Set<number>();
  showJadualModal = false;
  editingJadual: any = null;
  savingJadual = false;
  jadualForm = { no_perlawanan: '', tarikh: '', masa: '', kategori: '', peringkat: '', kumpulan: '', pasukan_home: '', pasukan_away: '', tempat: '' };
  kategoriList = ['B12', 'B15', 'B18'];
  peringkatList = ['Kumpulan', 'XY', 'Suku Akhir', 'Separuh Akhir', '3rd Playoff', 'Final'];

  getKategoriClass(kategori: string): string {
    switch (kategori?.toUpperCase()) {
      case 'B12': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'B15': return 'bg-sky-50 text-sky-700 border border-sky-200';
      case 'B18': return 'bg-purple-50 text-purple-700 border border-purple-200';
      default: return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  }

  // Jadual Upload
  showJadualUploadModal = false;
  jadualUploadPreview: any[] = [];
  jadualUploadErrors: string[] = [];
  jadualUploading = false;
  jadualUploadFileName = '';
  jadualUploadDone = false;
  jadualUploadInserted = 0;

  // Lantikan
  selectedJadual: any = null;
  loadingLantikan = false;
  lantikanList: any[] = [];
  refereeList: any[] = [];
  selectedReferee: Record<string, string> = {};
  sendingNotif = false;
  activeJawatan: string | null = null;
  refereeSearch = '';
  refereeJenisFilter = '';
  expandedAuditId: number | null = null;
  auditLoadingIds = new Set<number>();
  auditData = new Map<number, LantikanAuditData>();

  get filteredReferees(): any[] {
    let list = this.refereeList;
    if (this.refereeSearch) {
      const s = this.refereeSearch.toLowerCase();
      list = list.filter(r =>
        (r.nama_penuh || '').toLowerCase().includes(s) ||
        (r.daerah || '').toLowerCase().includes(s) ||
        (r.negeri || '').toLowerCase().includes(s) ||
        (r.no_telefon || '').includes(s)
      );
    }
    if (this.refereeJenisFilter) {
      list = list.filter(r => r.jenis_pengadil === this.refereeJenisFilter);
    }
    return list;
  }

  get uniqueJenisList(): string[] {
    return [...new Set(this.refereeList.map(r => r.jenis_pengadil).filter(Boolean))];
  }

  getRegionLabel(kejohanan: any = this.selectedKejohanan): string {
    return kejohanan?.peringkat_kejohanan === 'Negeri' ? 'Daerah' : 'Negeri';
  }

  getRegionValue(referee: any, kejohanan: any = this.selectedKejohanan): string {
    if (referee?.wilayah) return referee.wilayah;
    const value = this.getRegionLabel(kejohanan) === 'Daerah'
      ? referee?.daerah
      : referee?.negeri;
    return value || '-';
  }

  getJadualRegionLabel(): string {
    return this.jadualLantikanData?.region_label
      || this.getRegionLabel(this.jadualLantikanData?.kejohanan);
  }

  isAutoTolak(assignment: any): boolean {
    return assignment?.status_lantikan === 'Ditolak'
      && Number(assignment?.is_auto_tolak) === 1;
  }

  isAssignedToCurrentMatch(ref: any): boolean {
    return this.lantikanList.some(a =>
      (ref.pengadil_id && a.pengadil_id === ref.pengadil_id) ||
      (ref.pengadil_luar_id && a.pengadil_luar_id === ref.pengadil_luar_id)
    );
  }

  selectJawatan(jawatan: string): void {
    this.activeJawatan = this.activeJawatan === jawatan ? null : jawatan;
  }

  assignFromPool(ref: any): void {
    if (!this.activeJawatan || !this.selectedJadual) return;
    const jawatan = this.activeJawatan;
    this.confirmTitle = 'Sahkan Lantikan';
    this.confirmMessage = `Lantik ${ref.nama_penuh} sebagai ${jawatan}?`;
    this.confirmType = 'warning';
    this.confirmBtnText = 'Lantik';
    this.confirmFn = () => {
      const body: any = { jadual_id: this.selectedJadual.id, jawatan };
      if (ref.pengadil_id) {
        body.pengadil_id = ref.pengadil_id;
      } else {
        body.pengadil_luar_id = ref.pengadil_luar_id;
      }
      this.api.post<any>('lantikan.php', body).subscribe({
        next: (res) => {
          this.toast.show(res.message, 'success');
          this.activeJawatan = null;
          this.loadLantikan(this.selectedJadual.id);
        },
        error: (err) => this.toast.show(err?.error?.message || 'Ralat melantik.', 'error'),
      });
    };
    this.showConfirmModal = true;
  }

  getJenisBadgeClass(jenis: string): string {
    if (jenis === 'Pengadil Kebangsaan') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (jenis === 'Kelas 1') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (jenis === 'Kelas 2') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (jenis === 'Kelas 3') return 'bg-slate-100 text-slate-600 border-slate-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  // Jadual Lantikan (report + pengesahan)
  loadingJadualLantikan = false;
  jadualLantikanData: any = null;
  jadualLantikanSearch = '';
  selectedMatchIds = new Set<number>();
  showMatchStatusModal = false;
  matchStatusForm: { jadualIds: number[]; status: 'Dibatalkan' | 'Ditangguhkan'; sebab: '' } = {
    jadualIds: [], status: 'Dibatalkan', sebab: '',
  };
  updatingMatchStatus = false;
  showPengesahanForm = false;
  submittingPengesahan = false;
  batallingPengesahan = false;
  renumbering = false;
  pengesahanForm = { nama_penyahkan: '', jawatan_penyahkan: '', nota: '' };

  private sortJadualBySchedule(jadual: any[]): any[] {
    const natural = new Intl.Collator('ms', { numeric: true, sensitivity: 'base' });
    return [...jadual].sort((a: any, b: any) =>
      natural.compare(String(a.kategori ?? ''), String(b.kategori ?? ''))
      || String(a.tarikh ?? '').localeCompare(String(b.tarikh ?? ''))
      || String(a.masa ?? '').localeCompare(String(b.masa ?? ''))
      || natural.compare(String(a.no_perlawanan ?? ''), String(b.no_perlawanan ?? ''))
    );
  }

  /** Group the (backend-sorted) report jadual by kategori for sectioned display. */
  get jadualLantikanGrouped(): { kategori: string; matches: any[] }[] {
    const jadual = (this.jadualLantikanData?.jadual ?? []).filter((j: any) =>
      matchesJadualSearch(j, this.jadualLantikanSearch, true)
    );
    const groups: { kategori: string; matches: any[] }[] = [];
    for (const j of jadual) {
      const kat = (j.kategori || '').trim() || 'Lain-lain';
      let group = groups.length > 0 && groups[groups.length - 1].kategori === kat
        ? groups[groups.length - 1] : null;
      if (!group) {
        group = { kategori: kat, matches: [] };
        groups.push(group);
      }
      group.matches.push(j);
    }
    return groups;
  }

  get filteredJadualLantikanCount(): number {
    return this.jadualLantikanGrouped.reduce((total, group) => total + group.matches.length, 0);
  }

  loadJadualLantikan(): void {
    if (!this.selectedKejohananId) return;
    this.loadingJadualLantikan = true;
    this.jadualLantikanData = null;
    this.selectedMatchIds.clear();
    this.api.get<any>('jadual-lantikan-report.php', { kejohanan_id: this.selectedKejohananId.toString() }).subscribe({
      next: (res) => {
        this.loadingJadualLantikan = false;
        if (!res.error) {
          this.jadualLantikanData = {
            ...res,
            jadual: this.sortJadualBySchedule(res.jadual ?? []),
          };
          this.showPengesahanForm = false;
        } else {
          this.toast.error(res.message || 'Gagal memuatkan jadual lantikan.');
        }
      },
      error: (err: any) => { this.loadingJadualLantikan = false; this.toast.error(err?.error?.message || 'Ralat memuatkan jadual lantikan.'); },
    });
  }

  openPengesahanForm(): void {
    this.pengesahanForm = { nama_penyahkan: '', jawatan_penyahkan: '', nota: '' };
    this.showPengesahanForm = true;
  }

  sahkanJadualLantikan(): void {
    if (!this.selectedKejohananId) return;
    const f = this.pengesahanForm;
    if (!f.nama_penyahkan.trim() || !f.jawatan_penyahkan.trim()) {
      this.toast.error('Nama dan jawatan wajib diisi.');
      return;
    }
    this.submittingPengesahan = true;
    this.api.post<any>('jadual-lantikan-report.php', {
      action: 'sahkan',
      kejohanan_id: this.selectedKejohananId,
      nama_penyahkan: f.nama_penyahkan.trim(),
      jawatan_penyahkan: f.jawatan_penyahkan.trim(),
      nota: f.nota.trim(),
    }).subscribe({
      next: (res) => {
        this.submittingPengesahan = false;
        if (!res.error) {
          this.toast.success('Jadual lantikan berjaya disahkan.');
          this.loadJadualLantikan();
        } else {
          this.toast.error(res.message || 'Gagal mengesahkan.');
        }
      },
      error: (err: any) => { this.submittingPengesahan = false; this.toast.error(err?.error?.message || 'Ralat semasa mengesahkan.'); },
    });
  }

  batalPengesahan(): void {
    if (!this.selectedKejohananId) return;
    this.confirmTitle = 'Batal Pengesahan?';
    this.confirmMessage = 'Tindakan ini akan membuang rekod pengesahan. Adakah anda pasti?';
    this.confirmFn = () => {
      this.batallingPengesahan = true;
      this.api.post<any>('jadual-lantikan-report.php', {
        action: 'batal',
        kejohanan_id: this.selectedKejohananId,
      }).subscribe({
        next: (res) => {
          this.batallingPengesahan = false;
          if (!res.error) {
            this.toast.success('Pengesahan dibatalkan.');
            this.loadJadualLantikan();
          } else {
            this.toast.error(res.message || 'Gagal membatalkan.');
          }
        },
        error: (err: any) => { this.batallingPengesahan = false; this.toast.error(err?.error?.message || 'Ralat semasa membatalkan.'); },
      });
    };
    this.showConfirmModal = true;
  }

  downloadJadualLantikanPDF(): void {
    if (!this.selectedKejohananId) return;
    window.open(`${environment.apiUrl}/download-jadual-lantikan.php?kejohanan_id=${this.selectedKejohananId}`, '_blank');
  }

  renumberJadual(): void {
    if (!this.selectedKejohananId) return;
    this.confirmTitle = 'Nombor Semula Perlawanan?';
    this.confirmMessage = 'Semua perlawanan akan dinomborkan semula mengikut kategori & masa (cth B12-01, B12-02 ...). Tindakan ini menukar nombor perlawanan sedia ada. Teruskan?';
    this.confirmType = 'warning';
    this.confirmBtnText = 'Nombor Semula';
    this.confirmFn = () => {
      this.renumbering = true;
      this.api.post<any>('jadual-perlawanan.php?action=renumber', {
        kejohanan_id: this.selectedKejohananId,
      }).subscribe({
        next: (res) => {
          this.renumbering = false;
          if (!res.error) {
            this.toast.success(res.message || 'Perlawanan dinomborkan semula.');
            this.loadJadualLantikan();
          } else {
            this.toast.error(res.message || 'Gagal menomborkan semula.');
          }
        },
        error: (err: any) => { this.renumbering = false; this.toast.error(err?.error?.message || 'Ralat semasa menomborkan semula.'); },
      });
    };
    this.showConfirmModal = true;
  }

  getJawatanShort(jawatan: string): string {
    const map: Record<string, string> = {
      'Pengadil':             'R',
      'Penolong Pengadil 1':  'AR1',
      'Penolong Pengadil 2':  'AR2',
      'Pegawai ke4':          'P4',
      'Penilai Pengadil':     'RA',
    };
    return map[jawatan] ?? jawatan;
  }

  getJawatanCode(jawatan: string): string {
    const map: Record<string, string> = {
      'Pengadil':             'R',
      'Penolong Pengadil 1':  'AR1',
      'Penolong Pengadil 2':  'AR2',
      'Pegawai ke4':          'P4',
      'Penilai Pengadil':     'RA',
    };
    return map[jawatan] ?? jawatan;
  }

  // Laporan
  loadingLaporan = false;
  laporanList: any[] = [];
  laporanSearch = '';
  laporanKejohananFilter = '';
  showLaporanModal = false;
  laporanDetail: any = null;
  loadingLaporanDetail = false;
  catatanAdmin = '';
  alasanOverride = '';
  submittingSahkan = false;

  // Confirm
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' = 'danger';
  confirmBtnText = 'Ya';
  private confirmFn: (() => void) | null = null;

  constructor(private api: ApiService, private toast: ToastService, public profileModal: ProfileModalService) {}

  ngOnInit(): void {
    this.loadKejohanan();
    this.loadLaporan();
  }

  // ===================== KEJOHANAN =====================

  get filteredKejohanan(): any[] {
    let list = this.kejohananList;
    if (this.kejohananSearch) {
      const s = this.kejohananSearch.toLowerCase();
      list = list.filter(k =>
        k.nama.toLowerCase().includes(s) ||
        (k.anjuran || '').toLowerCase().includes(s) ||
        (k.tempat || '').toLowerCase().includes(s)
      );
    }
    if (this.kejohananStatusFilter) {
      list = list.filter(k => k.status === this.kejohananStatusFilter);
    }
    return list;
  }

  get paginatedKejohanan(): any[] {
    const start = (this.kejohananPage - 1) * this.kejohananPerPage;
    return this.filteredKejohanan.slice(start, start + this.kejohananPerPage);
  }

  get totalKejohananPages(): number {
    return Math.ceil(this.filteredKejohanan.length / this.kejohananPerPage) || 1;
  }

  get kejohananPages(): number[] {
    return Array.from({ length: this.totalKejohananPages }, (_, i) => i + 1);
  }

  loadKejohanan(): void {
    this.loadingKejohanan = true;
    this.api.get<any>('kejohanan.php').subscribe({
      next: (res) => { this.kejohananList = res.data || []; this.loadingKejohanan = false; },
      error: () => this.loadingKejohanan = false,
    });
  }

  openAddKejohanan(): void {
    this.editingKejohanan = null;
    this.kejohananForm = { nama: '', jenis_kejohanan: 'Persahabatan', peringkat_kejohanan: 'Daerah', tarikh_mula: '', tarikh_akhir: '', tempat: '', anjuran: '', status: 'Draf' };
    this.showKejohananModal = true;
  }

  openEditKejohanan(k: any): void {
    this.editingKejohanan = k;
    this.kejohananForm = {
      nama: k.nama, jenis_kejohanan: k.jenis_kejohanan || 'Persahabatan',
      peringkat_kejohanan: k.peringkat_kejohanan || 'Daerah',
      tarikh_mula: k.tarikh_mula, tarikh_akhir: k.tarikh_akhir,
      tempat: k.tempat || '', anjuran: k.anjuran || '', status: k.status,
    };
    this.showKejohananModal = true;
  }

  saveKejohanan(): void {
    if (!this.kejohananForm.nama || !this.kejohananForm.tarikh_mula || !this.kejohananForm.tarikh_akhir) {
      this.toast.show('Nama, tarikh mula dan tarikh akhir diperlukan.', 'error'); return;
    }
    this.savingKejohanan = true;
    const obs = this.editingKejohanan
      ? this.api.put<any>('kejohanan.php', { id: this.editingKejohanan.id, ...this.kejohananForm })
      : this.api.post<any>('kejohanan.php', this.kejohananForm);
    obs.subscribe({
      next: (res) => {
        this.toast.show(res.message || 'Berjaya.', 'success');
        this.showKejohananModal = false;
        this.savingKejohanan = false;
        this.loadKejohanan();
      },
      error: (err) => { this.toast.show(err?.error?.message || 'Ralat.', 'error'); this.savingKejohanan = false; },
    });
  }

  deleteKejohanan(id: number, nama: string): void {
    this.confirmTitle = 'Padam Kejohanan';
    this.confirmMessage = `Padam "${nama}"? Semua jadual dan lantikan berkaitan akan dipadam.`;
    this.confirmFn = () => {
      this.api.delete<any>(`kejohanan.php?id=${id}`).subscribe({
        next: (res) => { this.toast.show(res.message, 'success'); this.loadKejohanan(); },
        error: (err) => this.toast.show(err?.error?.message || 'Ralat.', 'error'),
      });
    };
    this.showConfirmModal = true;
  }

  selectKejohanan(k: any): void {
    if (this.selectedKejohanan?.id === k.id) {
      this.selectedKejohanan = null;
      this.selectedKejohananId = null;
      this.poolList = [];
      this.jadualList = [];
      this.jadualLantikanSearch = '';
      this.closeTelegramOnboardingModal();
      this.resetPengerusiState();
      return;
    }
    this.selectedKejohanan = k;
    this.selectedKejohananId = k.id;
    this.jadualLantikanSearch = '';
    this.closeTelegramOnboardingModal();
    this.loadJadual(k.id);
    this.loadPool(k.id);
    this.loadPengerusi(k.id);
    if (this.activeTab === 'jadual-lantikan') {
      this.loadJadualLantikan();
    }
  }

  get filteredPengerusiCandidates(): PengerusiCandidate[] {
    const search = this.pengerusiSearch.trim().toLowerCase();
    if (!search) return this.pengerusiCandidates;
    return this.pengerusiCandidates.filter((candidate) => [
      candidate.nama,
      candidate.daerah,
      candidate.negeri,
      candidate.email,
    ].filter(Boolean).join(' ').toLowerCase().includes(search));
  }

  loadPengerusi(kejohananId: number, openModal = false): void {
    this.loadingPengerusi = true;
    this.api.get<any>('kejohanan-pengesah-laporan.php', { kejohanan_id: String(kejohananId) }).subscribe({
      next: (res) => {
        this.loadingPengerusi = false;
        this.pengerusiCurrent = res.data?.current || null;
        this.pengerusiCandidates = res.data?.candidates || [];
        if (openModal) this.preparePengerusiModal();
      },
      error: (err) => {
        this.loadingPengerusi = false;
        this.toast.show(err?.error?.message || 'Gagal memuatkan tetapan Pengerusi Pengadil.', 'error');
      },
    });
  }

  openPengerusiModal(): void {
    if (!this.selectedKejohanan) return;
    if (this.pengerusiCandidates.length === 0) {
      this.loadPengerusi(this.selectedKejohanan.id, true);
      return;
    }
    this.preparePengerusiModal();
  }

  closePengerusiModal(): void {
    if (this.savingPengerusi) return;
    this.showPengerusiModal = false;
    this.pengerusiSearch = '';
    this.selectedPengerusiKey = '';
  }

  private preparePengerusiModal(): void {
    this.pengerusiSearch = '';
    this.pengerusiJawatan = this.pengerusiCurrent?.jawatan_snapshot || 'Pengerusi Pengadil';
    const source = this.pengerusiCurrent?.jenis_sumber;
    const officialId = source === 'Berdaftar'
      ? this.pengerusiCurrent?.pengesah_user_id
      : this.pengerusiCurrent?.pengesah_luar_id;
    this.selectedPengerusiKey = source && officialId ? `${source}:${officialId}` : '';
    this.showPengerusiModal = true;
  }

  requestSavePengerusi(): void {
    if (!this.selectedKejohanan || !this.selectedPengerusiKey) {
      this.toast.show('Pilih seorang Penilai Pengadil sebagai Pengerusi.', 'error');
      return;
    }
    const candidate = this.selectedPengerusiCandidate;
    if (!candidate) {
      this.toast.show('Pilihan Pengerusi tidak sah.', 'error');
      return;
    }
    if (this.pengerusiCurrent) {
      this.confirmTitle = 'Tukar Pengerusi Pengadil';
      this.confirmMessage = `Tetapkan ${candidate.nama} sebagai Pengerusi Pengadil untuk ${this.selectedKejohanan.nama}? Pautan laporan yang masih menunggu akan ditukar kepada Pengerusi baharu.`;
      this.confirmType = 'warning';
      this.confirmBtnText = 'Tetapkan';
      this.confirmFn = () => this.savePengerusi(candidate);
      this.showConfirmModal = true;
      return;
    }
    this.savePengerusi(candidate);
  }

  get selectedPengerusiCandidate(): PengerusiCandidate | null {
    const [source, id] = this.selectedPengerusiKey.split(':');
    return this.pengerusiCandidates.find((candidate) =>
      candidate.source === source && candidate.official_id === Number(id)
    ) || null;
  }

  private savePengerusi(candidate: PengerusiCandidate): void {
    if (!this.selectedKejohanan) return;
    this.savingPengerusi = true;
    this.api.post<any>('kejohanan-pengesah-laporan.php', {
      kejohanan_id: this.selectedKejohanan.id,
      source: candidate.source,
      official_id: candidate.official_id,
      jawatan: this.pengerusiJawatan.trim() || 'Pengerusi Pengadil',
    }).subscribe({
      next: (res) => {
        this.savingPengerusi = false;
        this.showPengerusiModal = false;
        this.toast.show(res.message || 'Pengerusi Pengadil berjaya ditetapkan.', 'success');
        this.loadPengerusi(this.selectedKejohanan!.id);
        this.loadLaporan();
      },
      error: (err) => {
        this.savingPengerusi = false;
        this.toast.show(err?.error?.message || 'Gagal menetapkan Pengerusi Pengadil.', 'error');
      },
    });
  }

  private resetPengerusiState(): void {
    this.loadingPengerusi = false;
    this.showPengerusiModal = false;
    this.pengerusiCurrent = null;
    this.pengerusiCandidates = [];
    this.pengerusiSearch = '';
    this.selectedPengerusiKey = '';
  }

  // ===================== JADUAL LOGO =====================

  triggerJadualLogoUpload(jadualId: number, side: 'home' | 'away'): void {
    const input = document.getElementById(`jadual-logo-${jadualId}-${side}`) as HTMLInputElement;
    input?.click();
  }

  triggerKejohananLogoUpload(kejohananId: number, side: 'kiri' | 'kanan'): void {
    const input = document.getElementById(`kejohanan-logo-${kejohananId}-${side}`) as HTMLInputElement;
    input?.click();
  }

  onJadualLogoChange(event: Event, jadualId: number, side: 'home' | 'away'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingJadualLogo = `${jadualId}-${side}`;
    const fd = new FormData();
    fd.append('logo', file);
    this.api.postFormData<any>(`jadual-perlawanan.php?action=logo&id=${jadualId}&side=${side}`, fd).subscribe({
      next: () => {
        this.toast.show('Logo berjaya dimuat naik.', 'success');
        this.uploadingJadualLogo = null;
        this.loadJadual(this.selectedKejohanan!.id);
      },
      error: (err) => { this.toast.show(err?.error?.message || 'Gagal muat naik logo.', 'error'); this.uploadingJadualLogo = null; },
    });
  }

  onKejohananLogoChange(event: Event, kejohananId: number, side: 'kiri' | 'kanan'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingKejohananLogo = `${kejohananId}-${side}`;
    const fd = new FormData();
    fd.append('logo', file);
    this.api.postFormData<any>(`kejohanan.php?action=logo&id=${kejohananId}&side=${side}`, fd).subscribe({
      next: () => {
        this.toast.show('Logo kejohanan berjaya dimuat naik.', 'success');
        this.uploadingKejohananLogo = null;
        this.loadKejohanan();
      },
      error: (err) => { this.toast.show(err?.error?.message || 'Gagal muat naik logo.', 'error'); this.uploadingKejohananLogo = null; },
    });
  }

  viewKejohananJadual(k: any): void {
    this.selectKejohanan(k);
    this.activeTab = 'jadual';
  }

  // ===================== POOL PENGADIL =====================

  loadPool(kejohananId: number): void {
    this.loadingPool = true;
    this.api.get<any>('pool-pengadil.php', { kejohanan_id: kejohananId.toString() }).subscribe({
      next: (res) => { this.poolList = res.data || []; this.loadingPool = false; },
      error: () => this.loadingPool = false,
    });
  }

  get externalPoolCount(): number {
    return this.poolList.filter((member) => member.jenis_sumber === 'Luar').length;
  }

  get linkedExternalPoolCount(): number {
    return this.poolList.filter(
      (member) => member.jenis_sumber === 'Luar' && member.telegram_linked
    ).length;
  }

  openTelegramOnboardingModal(): void {
    if (!this.selectedKejohanan) return;
    this.showTelegramOnboardingModal = true;
    this.telegramOnboardingResult = null;
    this.loadTelegramOnboardingPreview();
  }

  closeTelegramOnboardingModal(): void {
    if (this.sendingTelegramOnboarding) return;
    this.showTelegramOnboardingModal = false;
    this.loadingTelegramOnboarding = false;
    this.sendingTelegramOnboarding = false;
    this.telegramOnboardingPreview = null;
    this.telegramOnboardingResult = null;
  }

  loadTelegramOnboardingPreview(): void {
    if (!this.selectedKejohanan) return;
    this.loadingTelegramOnboarding = true;
    this.api.get<TelegramOnboardingResponse>('pengadil-luar-telegram-blast.php', {
      kejohanan_id: String(this.selectedKejohanan.id),
    }).subscribe({
      next: (res) => {
        this.telegramOnboardingPreview = res.data;
        this.loadingTelegramOnboarding = false;
        this.loadPool(this.selectedKejohanan.id);
      },
      error: (err) => {
        this.loadingTelegramOnboarding = false;
        this.toast.show(err?.error?.message || 'Gagal memuatkan status onboarding Telegram.', 'error');
      },
    });
  }

  requestTelegramOnboardingBlast(mode: 'initial' | 'resend'): void {
    const preview = this.telegramOnboardingPreview;
    if (!preview || !this.selectedKejohanan) return;
    const recipientCount = mode === 'initial'
      ? preview.counts.initial_sendable
      : preview.counts.resendable;
    if (recipientCount === 0) {
      this.toast.show('Tiada pengadil luar yang layak menerima emel ini.', 'info');
      return;
    }

    this.confirmTitle = mode === 'initial'
      ? 'Blast Pautan Telegram'
      : 'Hantar Semula Pautan Telegram';
    this.confirmMessage = mode === 'initial'
      ? `Hantar emel pautan Telegram kepada ${recipientCount} pengadil luar yang belum pernah menerima emel onboarding bagi ${this.selectedKejohanan.nama}? Ini bukan lantikan dan tidak memulakan tempoh jawapan.`
      : `Hantar semula emel kepada ${recipientCount} pengadil luar yang masih belum memautkan Telegram bagi ${this.selectedKejohanan.nama}? Penerima yang pernah menerima emel akan menerima emel sekali lagi.`;
    this.confirmType = 'warning';
    this.confirmBtnText = mode === 'initial' ? 'Hantar Blast' : 'Hantar Semula';
    this.confirmFn = () => this.sendTelegramOnboardingBlast(mode);
    this.showConfirmModal = true;
  }

  telegramOnboardingStatusLabel(status: TelegramOnboardingStatus): string {
    const labels: Record<TelegramOnboardingStatus, string> = {
      linked: 'Sudah dipaut',
      no_email: 'Tiada emel',
      invalid_email: 'Emel tidak sah',
      ready: 'Sedia dihantar',
      failed: 'Penghantaran gagal',
      emailed_waiting: 'Emel dihantar, belum paut',
    };
    return labels[status];
  }

  telegramOnboardingStatusClass(status: TelegramOnboardingStatus): string {
    if (status === 'linked') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'ready') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status === 'emailed_waiting') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  telegramOnboardingBatchStatusClass(status: TelegramOnboardingBatch['status']): string {
    if (status === 'completed') return 'text-emerald-700';
    if (status === 'partial') return 'text-amber-700';
    if (status === 'processing') return 'text-blue-700';
    return 'text-rose-700';
  }

  private sendTelegramOnboardingBlast(mode: 'initial' | 'resend'): void {
    if (!this.selectedKejohanan || this.sendingTelegramOnboarding) return;
    this.sendingTelegramOnboarding = true;
    this.telegramOnboardingResult = null;
    this.api.post<TelegramOnboardingResponse>('pengadil-luar-telegram-blast.php', {
      kejohanan_id: this.selectedKejohanan.id,
      mode,
    }, 600_000).subscribe({
      next: (res) => {
        this.sendingTelegramOnboarding = false;
        this.telegramOnboardingPreview = res.data;
        this.telegramOnboardingResult = {
          message: res.message || 'Blast onboarding selesai.',
          sent: res.sent || 0,
          failed: res.failed || 0,
          skipped: res.skipped || 0,
        };
        this.toast.show(
          this.telegramOnboardingResult.message,
          this.telegramOnboardingResult.failed > 0 ? 'error' : 'success'
        );
        this.loadPool(this.selectedKejohanan.id);
      },
      error: (err) => {
        this.sendingTelegramOnboarding = false;
        this.toast.show(err?.error?.message || 'Blast onboarding Telegram gagal.', 'error');
        this.loadTelegramOnboardingPreview();
      },
    });
  }

  openPoolModal(): void {
    this.poolTab = 'berdaftar';
    this.selectedBerdaftarIds = new Set();
    this.selectedLuarIds = new Set();
    this.poolSearchText = '';
    this.poolMatchSummary = null;
    this.showPoolModal = true;
    this.loadAvailableForPool();
  }

  loadAvailableForPool(): void {
    // Load pengadil luar not already in pool
    this.api.get<any>('pengadil-luar.php').subscribe({
      next: (res) => {
        const luarInPool = new Set(this.poolList.filter(p => p.pengadil_luar_id).map(p => +p.pengadil_luar_id));
        this.availableLuar = (res.data || []).filter((p: any) => !luarInPool.has(p.id));
      },
    });
    // Load registered referees not already in pool
    this.api.get<any>('get-active-referees.php').subscribe({
      next: (res) => {
        const regInPool = new Set(this.poolList.filter(p => p.pengadil_id).map(p => +p.pengadil_id));
        this.availableBerdaftar = (res.data || []).filter((p: any) => !regInPool.has(p.id));
      },
      error: () => { this.availableBerdaftar = []; },
    });
  }

  get filteredAvailable(): any[] {
    const s = this.poolSearchText.toLowerCase();
    const list = this.poolTab === 'berdaftar' ? this.availableBerdaftar : this.availableLuar;
    if (!s) return list;
    return list.filter(p => {
      const nama = (p.nama_penuh || p.nama || '').toLowerCase();
      const wilayah = `${p.daerah || ''} ${p.negeri || ''}`.toLowerCase();
      return nama.includes(s) || wilayah.includes(s);
    });
  }

  private currentPoolSet(): Set<number> {
    return this.poolTab === 'berdaftar' ? this.selectedBerdaftarIds : this.selectedLuarIds;
  }

  isPoolSelected(id: number): boolean {
    return this.currentPoolSet().has(id);
  }

  togglePoolSelect(id: number): void {
    const set = this.currentPoolSet();
    if (set.has(id)) set.delete(id);
    else set.add(id);
  }

  get totalPoolSelected(): number {
    return this.selectedBerdaftarIds.size + this.selectedLuarIds.size;
  }

  addToPool(): void {
    const items = [
      ...Array.from(this.selectedBerdaftarIds).map(id => ({ pengadil_id: id })),
      ...Array.from(this.selectedLuarIds).map(id => ({ pengadil_luar_id: id })),
    ];
    if (items.length === 0) return;
    this.addingToPool = true;
    this.api.post<any>('pool-pengadil.php', { kejohanan_id: this.selectedKejohanan!.id, items }).subscribe({
      next: (res) => {
        this.toast.show(res.message, 'success');
        this.addingToPool = false;
        this.selectedBerdaftarIds = new Set();
        this.selectedLuarIds = new Set();
        this.poolMatchSummary = null;
        this.loadPool(this.selectedKejohanan!.id);
        this.loadAvailableForPool();
      },
      error: (err) => { this.toast.show(err?.error?.message || 'Ralat.', 'error'); this.addingToPool = false; },
    });
  }

  downloadPoolMatchTemplate(): void {
    const header = ['Nama', 'No IC', 'No Tel', 'Emel'];
    const sample = [
      ['Ahmad bin Ali', '880101015523', '0123456789', 'ahmad@email.com'],
      ['Muthu a/l Raju', '', '0198765432', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...sample]);
    ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 15 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Senarai Pengadil');
    XLSX.writeFile(wb, 'template-pool-pengadil.xlsx');
  }

  /** Upload Excel → auto-tick padanan dalam senarai berdaftar & luar (client-side). */
  onPoolExcelSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) {
        this.toast.show('Fail kosong atau tiada data selepas header.', 'error');
        return;
      }

      const headerRow = rows[0].map((h: any) => String(h).toLowerCase().trim());
      const col: Record<string, number> = {};
      headerRow.forEach((h: string, idx: number) => {
        if (h.includes('nama')) col['nama'] = idx;
        else if (h.includes('ic') || h.includes('kp')) col['ic'] = idx;
        else if (h.includes('tel') || h.includes('phone') || h.includes('telefon')) col['tel'] = idx;
        else if (h.includes('emel') || h.includes('email')) col['emel'] = idx;
      });
      if (!('nama' in col) && !('ic' in col)) {
        this.toast.show('Header "Nama" atau "No IC" diperlukan dalam fail.', 'error');
        return;
      }

      const digits = (s: any) => String(s ?? '').replace(/[^0-9]/g, '');
      const norm = (s: any) => String(s ?? '').toLowerCase().trim();

      // Indeks senarai tersedia (yang belum dalam pool)
      const regByIc = new Map<string, any>(), regByPhone = new Map<string, any>(), regByEmail = new Map<string, any>(), regByName = new Map<string, any>();
      for (const r of this.availableBerdaftar) {
        const ic = digits(r.no_kp ?? r.no_ic); if (ic) regByIc.set(ic, r);
        const ph = digits(r.no_telefon); if (ph) regByPhone.set(ph, r);
        const em = norm(r.email); if (em) regByEmail.set(em, r);
        const nm = norm(r.nama_penuh); if (nm) regByName.set(nm, r);
      }
      const luarByPhone = new Map<string, any>(), luarByEmail = new Map<string, any>(), luarByName = new Map<string, any>();
      for (const l of this.availableLuar) {
        const ph = digits(l.no_tel); if (ph) luarByPhone.set(ph, l);
        const em = norm(l.emel); if (em) luarByEmail.set(em, l);
        const nm = norm(l.nama); if (nm) luarByName.set(nm, l);
      }
      // Untuk kesan "sudah dalam pool" (dikecualikan dari senarai tersedia)
      const poolNames = new Set(this.poolList.map(p => norm(p.nama)));
      const poolPhones = new Set(this.poolList.map(p => digits(p.no_tel)).filter(Boolean));

      let berdaftar = 0, luar = 0, alreadyInPool = 0;
      const notFound: string[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const nama = 'nama' in col ? String(row[col['nama']] ?? '').trim() : '';
        const ic = 'ic' in col ? digits(row[col['ic']]) : '';
        const tel = 'tel' in col ? digits(row[col['tel']]) : '';
        const em = 'emel' in col ? norm(row[col['emel']]) : '';
        if (!nama && !ic && !tel && !em) continue;
        const nm = norm(nama);

        // Padan berdaftar: IC → telefon → emel → nama
        const reg = (ic && regByIc.get(ic)) || (tel && regByPhone.get(tel)) || (em && regByEmail.get(em)) || (nm && regByName.get(nm));
        if (reg) { this.selectedBerdaftarIds.add(reg.id); berdaftar++; continue; }
        // Padan luar: telefon → emel → nama
        const lr = (tel && luarByPhone.get(tel)) || (em && luarByEmail.get(em)) || (nm && luarByName.get(nm));
        if (lr) { this.selectedLuarIds.add(lr.id); luar++; continue; }
        // Tiada dalam senarai tersedia — mungkin sudah dalam pool
        if ((nm && poolNames.has(nm)) || (tel && poolPhones.has(tel))) { alreadyInPool++; continue; }
        notFound.push(nama || ic || tel || em);
      }

      this.poolMatchSummary = { matched: berdaftar + luar, berdaftar, luar, alreadyInPool, notFound };
      const parts = [`${berdaftar + luar} dipadan & ditanda (${berdaftar} Pahang, ${luar} luar).`];
      if (alreadyInPool > 0) parts.push(`${alreadyInPool} sudah dalam pool.`);
      if (notFound.length > 0) parts.push(`${notFound.length} tidak dijumpai.`);
      this.toast.show(parts.join(' '), notFound.length ? 'info' : 'success');
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
  }

  removeFromPool(poolId: number): void {
    this.api.delete<any>(`pool-pengadil.php?id=${poolId}`).subscribe({
      next: (res) => {
        this.toast.show(res.message, 'success');
        this.loadPool(this.selectedKejohanan!.id);
      },
      error: (err) => this.toast.show(err?.error?.message || 'Ralat.', 'error'),
    });
  }

  switchPoolTab(tab: 'berdaftar' | 'luar'): void {
    // Kekalkan pilihan merentas tab (penting untuk auto-tick dari Excel)
    this.poolTab = tab;
  }

  // ===================== JADUAL =====================

  onKejohananSelect(id: number | null): void {
    this.closeTelegramOnboardingModal();
    if (!id) { this.selectedKejohanan = null; this.jadualList = []; this.jadualSearch = ''; this.poolList = []; this.resetPengerusiState(); return; }
    const k = this.kejohananList.find(x => x.id === id);
    this.selectedKejohanan = k || null;
    this.jadualSearch = '';
    this.loadJadual(id);
    this.loadPool(id);
    this.loadPengerusi(id);
  }

  get filteredJadualList(): any[] {
    if (!this.jadualSearch.trim()) return this.jadualList;
    return this.jadualList.filter((j: any) => matchesJadualSearch(j, this.jadualSearch));
  }

  loadJadual(kejohananId: number): void {
    this.loadingJadual = true;
    this.selectedJadualIds.clear();
    this.api.get<any>('jadual-perlawanan.php', { kejohanan_id: kejohananId.toString() }).subscribe({
      next: (res) => {
        this.jadualList = this.sortJadualBySchedule(res.data ?? []);
        this.loadingJadual = false;
      },
      error: () => this.loadingJadual = false,
    });
  }

  openAddJadual(): void {
    this.editingJadual = null;
    this.jadualForm = { no_perlawanan: '', tarikh: '', masa: '', kategori: '', peringkat: '', kumpulan: '', pasukan_home: '', pasukan_away: '', tempat: '' };
    this.showJadualModal = true;
  }

  openEditJadual(j: any): void {
    this.editingJadual = j;
    this.jadualForm = {
      no_perlawanan: j.no_perlawanan, tarikh: j.tarikh, masa: j.masa?.slice(0, 5) || '',
      kategori: j.kategori || '', peringkat: j.peringkat || '', kumpulan: j.kumpulan || '',
      pasukan_home: j.pasukan_home || '', pasukan_away: j.pasukan_away || '', tempat: j.tempat || '',
    };
    this.showJadualModal = true;
  }

  saveJadual(): void {
    if (!this.jadualForm.tarikh || !this.jadualForm.masa) {
      this.toast.show('Tarikh dan masa diperlukan.', 'error'); return;
    }
    this.savingJadual = true;
    const obs = this.editingJadual
      ? this.api.put<any>('jadual-perlawanan.php', { id: this.editingJadual.id, ...this.jadualForm })
      : this.api.post<any>('jadual-perlawanan.php', { kejohanan_id: this.selectedKejohanan!.id, ...this.jadualForm });
    obs.subscribe({
      next: (res) => {
        this.toast.show(res.message || 'Berjaya.', 'success');
        this.showJadualModal = false;
        this.savingJadual = false;
        this.loadJadual(this.selectedKejohanan!.id);
      },
      error: (err) => { this.toast.show(err?.error?.message || 'Ralat.', 'error'); this.savingJadual = false; },
    });
  }

  deleteJadual(id: number, no: string): void {
    this.confirmTitle = 'Padam Perlawanan';
    this.confirmMessage = `Padam perlawanan ${no}? Semua lantikan berkaitan akan dipadam.`;
    this.confirmFn = () => {
      this.api.delete<any>(`jadual-perlawanan.php?id=${id}`).subscribe({
        next: (res) => { this.toast.show(res.message, 'success'); this.loadJadual(this.selectedKejohanan!.id); },
        error: (err) => this.toast.show(err?.error?.message || 'Ralat.', 'error'),
      });
    };
    this.showConfirmModal = true;
  }

  toggleJadual(id: number): void {
    if (this.selectedJadualIds.has(id)) this.selectedJadualIds.delete(id);
    else this.selectedJadualIds.add(id);
  }

  toggleAllJadual(): void {
    if (this.isAllJadualSelected()) {
      this.filteredJadualList.forEach(j => this.selectedJadualIds.delete(j.id));
    } else {
      this.filteredJadualList.forEach(j => this.selectedJadualIds.add(j.id));
    }
  }

  isAllJadualSelected(): boolean {
    return this.filteredJadualList.length > 0
      && this.filteredJadualList.every(j => this.selectedJadualIds.has(j.id));
  }

  bulkDeleteJadual(): void {
    const ids = Array.from(this.selectedJadualIds);
    if (ids.length === 0) return;
    this.confirmTitle = 'Padam Pukal';
    this.confirmMessage = `Padam ${ids.length} perlawanan yang dipilih?`;
    this.confirmType = 'danger';
    this.confirmBtnText = 'Padam';
    this.confirmFn = () => {
      this.api.post<any>('jadual-perlawanan.php?action=bulk_delete', { ids }).subscribe({
        next: (res) => {
          this.toast.show(res.message, 'success');
          this.selectedJadualIds.clear();
          this.loadJadual(this.selectedKejohanan!.id);
        },
        error: (err) => this.toast.show(err?.error?.message || 'Ralat memadam.', 'error'),
      });
    };
    this.showConfirmModal = true;
  }

  // ===================== JADUAL UPLOAD =====================

  openJadualUploadModal(): void {
    this.showJadualUploadModal = true;
    this.jadualUploadPreview = [];
    this.jadualUploadErrors = [];
    this.jadualUploadFileName = '';
    this.jadualUploadDone = false;
    this.jadualUploadInserted = 0;
  }

  downloadJadualTemplate(): void {
    const header = ['No Perlawanan', 'Tarikh', 'Masa', 'Kategori', 'Peringkat', 'Kumpulan', 'Pasukan Home', 'Pasukan Away', 'Padang'];
    const sample = [
      ['1', '2024-09-04', '08:00', 'B15', 'Kumpulan', 'A', 'MSS Pahang', 'MSS Selangor', 'Padang 1'],
      ['2', '2024-09-04', '09:15', 'B15', 'Kumpulan', 'B', 'MSS Johor', 'MSS Perak', 'Padang 2'],
      ['3', '2024-09-05', '15:30', 'B15', 'Suku Akhir', '', 'MSS Kedah', 'MSS Sabah', 'Padang 1'],
      ['4', '2024-09-06', '10:00', 'B18', 'Final', '', 'MSS Pahang', 'MSS Johor', 'Padang 1'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...sample]);
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jadual Perlawanan');
    XLSX.writeFile(wb, 'template-jadual-perlawanan.xlsx');
  }

  onJadualFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.jadualUploadFileName = file.name;
    this.jadualUploadPreview = [];
    this.jadualUploadErrors = [];
    this.jadualUploadDone = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rows.length < 2) {
        this.jadualUploadErrors = ['Fail kosong atau tiada data selepas header.'];
        return;
      }

      const headerRow = rows[0].map((h: any) => String(h).toLowerCase().trim());
      const colMap: Record<string, number> = {};
      headerRow.forEach((h: string, idx: number) => {
        if (h.includes('no') && (h.includes('per') || h.includes('match'))) colMap['no_perlawanan'] = idx;
        else if (h.includes('tarikh') || h.includes('date')) colMap['tarikh'] = idx;
        else if (h.includes('masa') || h.includes('time')) colMap['masa'] = idx;
        else if (h.includes('kategori') || h.includes('category')) colMap['kategori'] = idx;
        else if (h.includes('peringkat') || h.includes('stage') || h.includes('round')) colMap['peringkat'] = idx;
        else if (h.includes('kump') && !h.includes('tahap')) colMap['kumpulan'] = idx;
        else if (h.includes('home') || h.includes('tuan')) colMap['pasukan_home'] = idx;
        else if (h.includes('away') || h.includes('tetamu') || h.includes('lawan')) colMap['pasukan_away'] = idx;
        else if (h.includes('padang') || h.includes('tempat') || h.includes('venue')) colMap['tempat'] = idx;
        else if (h.includes('perlawanan') || h.includes('match')) {
          if (!('pasukan_home' in colMap)) colMap['perlawanan'] = idx;
        }
      });

      if (!('tarikh' in colMap) || !('masa' in colMap)) {
        this.jadualUploadErrors = ['Header "Tarikh" dan "Masa" diperlukan dalam fail.'];
        return;
      }

      const parsed: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue;

        let tarikh = String(r[colMap['tarikh']] ?? '').trim();
        let masa = String(r[colMap['masa']] ?? '').trim();
        if (!tarikh && !masa) continue;

        // Handle Excel serial dates
        const rawTarikh = r[colMap['tarikh']];
        if (typeof rawTarikh === 'number') {
          const d = XLSX.SSF.parse_date_code(rawTarikh);
          tarikh = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }

        // Parse perlawanan column "Home LWN Away" if no separate home/away columns
        let home = 'pasukan_home' in colMap ? String(r[colMap['pasukan_home']] ?? '').trim() : '';
        let away = 'pasukan_away' in colMap ? String(r[colMap['pasukan_away']] ?? '').trim() : '';
        if (!home && !away && 'perlawanan' in colMap) {
          const pStr = String(r[colMap['perlawanan']] ?? '');
          const parts = pStr.split(/\s+(?:lwn|lawan|vs|v\.?s\.?)\s+/i);
          if (parts.length === 2) {
            home = parts[0].trim();
            away = parts[1].trim();
          }
        }

        parsed.push({
          no_perlawanan: 'no_perlawanan' in colMap ? String(r[colMap['no_perlawanan']] ?? '').trim() : '',
          tarikh,
          masa,
          kategori: 'kategori' in colMap ? String(r[colMap['kategori']] ?? '').trim() : '',
          peringkat: 'peringkat' in colMap ? String(r[colMap['peringkat']] ?? '').trim() : '',
          kumpulan: 'kumpulan' in colMap ? String(r[colMap['kumpulan']] ?? '').trim() : '',
          pasukan_home: home,
          pasukan_away: away,
          tempat: 'tempat' in colMap ? String(r[colMap['tempat']] ?? '').trim() : '',
        });
      }

      this.jadualUploadPreview = parsed;
      if (parsed.length === 0) {
        this.jadualUploadErrors = ['Tiada data sah dijumpai dalam fail.'];
      }
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
  }

  submitJadualUpload(): void {
    if (this.jadualUploadPreview.length === 0 || !this.selectedKejohanan) return;
    this.jadualUploading = true;
    this.api.post<any>('jadual-upload.php', {
      kejohanan_id: this.selectedKejohanan.id,
      data: this.jadualUploadPreview,
    }).subscribe({
      next: (res) => {
        this.jadualUploading = false;
        this.jadualUploadErrors = res.errors || [];
        this.jadualUploadDone = true;
        this.jadualUploadInserted = res.inserted || 0;
        this.jadualUploadPreview = [];
        if (res.inserted > 0) {
          this.toast.show(res.message, 'success');
          this.loadJadual(this.selectedKejohanan!.id);
        } else {
          this.toast.show(res.message || 'Tiada data ditambah.', 'error');
        }
      },
      error: (err) => {
        this.jadualUploading = false;
        this.toast.show(err?.error?.message || 'Ralat muat naik.', 'error');
      },
    });
  }

  // ===================== LANTIKAN =====================

  openLantikan(j: any): void {
    this.selectedJadual = j;
    if (!this.selectedKejohanan) {
      const k = this.kejohananList.find(x => x.id === j.kejohanan_id);
      this.selectedKejohanan = k;
    }
    this.activeTab = 'lantikan';
    this.loadLantikan(j.id);
  }

  loadLantikan(jadualId: number): void {
    this.loadingLantikan = true;
    this.selectedReferee = {};
    this.activeJawatan = null;
    this.refereeSearch = '';
    this.refereeJenisFilter = '';
    this.expandedAuditId = null;
    this.auditData.clear();
    this.api.get<any>('lantikan.php', { jadual_id: jadualId.toString() }).subscribe({
      next: (res) => {
        this.lantikanList = res.data || [];
        this.refereeList = res.referees || [];
        this.loadingLantikan = false;
      },
      error: () => this.loadingLantikan = false,
    });
  }

  getAssignment(jawatan: string): any {
    return this.lantikanList.find(a => a.jawatan === jawatan) || null;
  }

  toggleAppointmentAudit(lantikanId: number): void {
    if (this.expandedAuditId === lantikanId) {
      this.expandedAuditId = null;
      return;
    }
    this.expandedAuditId = lantikanId;
    this.loadAppointmentAudit(lantikanId);
  }

  loadAppointmentAudit(lantikanId: number): void {
    this.auditLoadingIds.add(lantikanId);
    this.api.get<{ data: LantikanAuditData }>('lantikan-audit.php', {
      lantikan_id: lantikanId.toString(),
    }).subscribe({
      next: (res) => {
        this.auditData.set(lantikanId, res.data);
        this.auditLoadingIds.delete(lantikanId);
      },
      error: (err) => {
        this.auditLoadingIds.delete(lantikanId);
        this.toast.show(err?.error?.message || 'Ralat memuatkan log lantikan.', 'error');
      },
    });
  }

  prepareDirectLinks(lantikanId: number): void {
    this.auditLoadingIds.add(lantikanId);
    this.api.post<{ message: string; data: LantikanAuditData }>('lantikan-audit.php', {
      action: 'prepare_links',
      lantikan_id: lantikanId,
    }).subscribe({
      next: (res) => {
        this.auditData.set(lantikanId, res.data);
        this.auditLoadingIds.delete(lantikanId);
        this.toast.show(res.message, 'success');
      },
      error: (err) => {
        this.auditLoadingIds.delete(lantikanId);
        this.toast.show(err?.error?.message || 'Ralat menyediakan pautan.', 'error');
      },
    });
  }

  async copyDirectLink(lantikanId: number, linkType: DirectLinkType, linkUrl: string): Promise<void> {
    try {
      await this.copyText(linkUrl);
    } catch {
      this.toast.show('Pautan tidak dapat disalin oleh pelayar.', 'error');
      return;
    }

    this.api.post<{ message: string }>('lantikan-audit.php', {
      action: 'record_copy',
      lantikan_id: lantikanId,
      link_type: linkType,
    }).subscribe({
      next: () => {
        this.toast.show('Pautan disalin dan direkodkan.', 'success');
        this.loadAppointmentAudit(lantikanId);
      },
      error: (err) => this.toast.show(
        err?.error?.message || 'Pautan disalin tetapi log salinan gagal direkodkan.',
        'error'
      ),
    });
  }

  confirmManualDelivery(lantikanId: number, deliveryType: ManualDeliveryType): void {
    const startsDeadline = deliveryType === 'appointment';
    this.confirmTitle = startsDeadline ? 'Sahkan Pautan Sudah Dihantar' : 'Rekod Penghantaran Manual';
    this.confirmMessage = startsDeadline
      ? 'Pastikan pautan Terima/Tolak benar-benar sudah dihantar kepada pegawai. Tempoh jawapan akan bermula sekarang.'
      : 'Tandakan bahawa pautan ini benar-benar sudah dihantar kepada pegawai?';
    this.confirmType = 'warning';
    this.confirmBtnText = 'Ya, Sudah Dihantar';
    this.confirmFn = () => this.markManualDelivery(lantikanId, deliveryType);
    this.showConfirmModal = true;
  }

  auditEventLabel(eventType: string): string {
    const labels: Record<string, string> = {
      appointment_backfilled: 'Rekod awal dibawa masuk',
      appointment_created: 'Lantikan diwujudkan',
      appointment_reassigned: 'Pegawai diganti',
      appointment_reviewed: 'Lantikan disemak',
      appointment_links_prepared: 'Pautan lantikan disediakan',
      direct_links_prepared: 'Pautan terus disediakan Admin',
      direct_link_copied: 'Pautan disalin Admin',
      appointment_notification: 'Notifikasi lantikan',
      appointment_dispatched: 'Penghantaran lantikan',
      manual_delivery_confirmed: 'Penghantaran manual disahkan',
      appointment_response: 'Jawapan pegawai',
      ra_form_notification: 'Notifikasi borang RA',
      ra_form_dispatched: 'Penghantaran borang RA',
      appointment_status_changed: 'Status lantikan diubah',
      appointment_deleted: 'Lantikan dibuang',
      cancellation_notification: 'Notifikasi pembatalan',
      telegram_account_linked: 'Telegram berjaya dipaut',
    };
    return labels[eventType] || eventType.replaceAll('_', ' ');
  }

  auditStatusClass(status: string): string {
    if (status === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (status === 'skipped') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  }

  private markManualDelivery(lantikanId: number, deliveryType: ManualDeliveryType): void {
    this.auditLoadingIds.add(lantikanId);
    this.api.post<{ message: string; data: LantikanAuditData }>('lantikan-audit.php', {
      action: 'mark_manual_delivery',
      lantikan_id: lantikanId,
      delivery_type: deliveryType,
    }).subscribe({
      next: (res) => {
        this.auditData.set(lantikanId, res.data);
        this.auditLoadingIds.delete(lantikanId);
        this.toast.show(res.message, 'success');
        if (this.selectedJadual) this.loadLantikan(this.selectedJadual.id);
      },
      error: (err) => {
        this.auditLoadingIds.delete(lantikanId);
        this.toast.show(err?.error?.message || 'Ralat merekodkan penghantaran manual.', 'error');
      },
    });
  }

  private async copyText(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) throw new Error('Clipboard unavailable');
  }

  hasRequiredSlotsInCurrentMatch(): boolean {
    return this.requiredJawatan.every((jawatan) => {
      const assignment = this.getAssignment(jawatan);
      return assignment && ['Belum Jawab', 'Diterima'].includes(assignment.status);
    });
  }

  missingRequiredSlots(): string[] {
    return this.requiredJawatan.filter((jawatan) => {
      const assignment = this.getAssignment(jawatan);
      return !assignment || !['Belum Jawab', 'Diterima'].includes(assignment.status);
    });
  }

  activeSlotCountCurrentMatch(): number {
    return this.lantikanList.filter((assignment) =>
      ['Belum Jawab', 'Diterima'].includes(assignment.status)
    ).length;
  }

  hasRequiredSlots(assignments: Record<string, { status_lantikan?: string } | null | undefined>): boolean {
    return this.requiredJawatan.every((jawatan) => {
      const assignment = assignments[jawatan];
      return assignment && ['Belum Jawab', 'Diterima'].includes(assignment.status_lantikan || '');
    });
  }

  assignReferee(jawatan: string): void {
    const val = this.selectedReferee[jawatan];
    if (!val || !this.selectedJadual) return;

    // Parse composite key: "reg_123" or "luar_456"
    const body: any = { jadual_id: this.selectedJadual.id, jawatan };
    if (val.startsWith('reg_')) {
      body.pengadil_id = +val.substring(4);
    } else if (val.startsWith('luar_')) {
      body.pengadil_luar_id = +val.substring(5);
    } else {
      body.pengadil_id = +val;
    }

    this.api.post<any>('lantikan.php', body).subscribe({
      next: (res) => {
        this.toast.show(res.message, 'success');
        this.loadLantikan(this.selectedJadual.id);
        this.selectedReferee[jawatan] = '';
      },
      error: (err) => this.toast.show(err?.error?.message || 'Ralat melantik.', 'error'),
    });
  }

  removeLantikan(id: number, jawatan: string): void {
    this.confirmTitle = 'Buang Lantikan';
    this.confirmMessage = `Buang lantikan untuk ${jawatan}?`;
    this.confirmType = 'danger';
    this.confirmBtnText = 'Buang';
    this.confirmFn = () => {
      this.api.delete<any>(`lantikan.php?id=${id}`).subscribe({
        next: (res) => { this.toast.show(res.message, 'success'); this.loadLantikan(this.selectedJadual!.id); },
        error: (err) => this.toast.show(err?.error?.message || 'Ralat.', 'error'),
      });
    };
    this.showConfirmModal = true;
  }

  sendNotification(): void {
    if (!this.selectedJadual) return;
    const pending = this.lantikanList.filter(a => a.status === 'Belum Jawab');
    if (!this.hasRequiredSlotsInCurrentMatch()) {
      this.toast.show(`Slot wajib belum lengkap: ${this.missingRequiredSlots().join(', ')}.`, 'error');
      return;
    }
    if (pending.length === 0) {
      this.toast.show('Tiada pengadil dengan status Belum Jawab untuk dihantar notifikasi.', 'error');
      return;
    }
    this.confirmTitle = 'Hantar Notifikasi';
    this.confirmMessage = `Hantar notifikasi kepada ${pending.length} pegawai perlawanan (status Belum Jawab)?`;
    this.confirmType = 'warning';
    this.confirmBtnText = 'Hantar';
    this.confirmFn = () => {
      this.sendingNotif = true;
      this.api.post<any>('lantikan.php', { action: 'notify', jadual_id: this.selectedJadual.id }).subscribe({
        next: (res) => { this.toast.show(res.message, 'success'); this.sendingNotif = false; this.loadLantikan(this.selectedJadual!.id); },
        error: (err) => { this.toast.show(err?.error?.message || 'Ralat.', 'error'); this.sendingNotif = false; },
      });
    };
    this.showConfirmModal = true;
  }

  toggleMatch(id: number): void {
    if (this.selectedMatchIds.has(id)) this.selectedMatchIds.delete(id);
    else this.selectedMatchIds.add(id);
  }

  toggleAllMatches(): void {
    const selectable = this.getSelectableMatches();
    if (selectable.length === this.selectedMatchIds.size && selectable.every(j => this.selectedMatchIds.has(j.id))) {
      this.selectedMatchIds.clear();
    } else {
      selectable.forEach(j => this.selectedMatchIds.add(j.id));
    }
  }

  getSelectableMatches(): any[] {
    if (!this.jadualLantikanData?.jadual) return [];
    return this.jadualLantikanGrouped.flatMap(group => group.matches).filter((j: any) => {
      if (j.is_started) return false;
      const assignments = j.assignments || {};
      return this.hasRequiredSlots(assignments)
        && Object.values(assignments).some((a: any) => a && a.status_lantikan === 'Belum Jawab');
    });
  }

  isAllSelected(): boolean {
    const selectable = this.getSelectableMatches();
    return selectable.length > 0 && selectable.every(j => this.selectedMatchIds.has(j.id));
  }

  sendBulkNotification(): void {
    if (!this.selectedKejohananId || !this.jadualLantikanData) return;
    const ids = Array.from(this.selectedMatchIds);
    if (ids.length === 0) {
      this.toast.show('Sila pilih perlawanan yang ingin dihantar notifikasi.', 'error');
      return;
    }
    const matchLabel = ids.length === 1 ? '1 perlawanan' : `${ids.length} perlawanan`;
    this.confirmTitle = 'Hantar Notifikasi';
    this.confirmMessage = `Hantar notifikasi lantikan kepada semua pegawai (Belum Jawab) bagi ${matchLabel} yang dipilih?`;
    this.confirmType = 'warning';
    this.confirmBtnText = 'Hantar';
    this.confirmFn = () => {
      this.sendingNotif = true;
      this.api.post<any>('lantikan.php', {
        action: 'notify_all',
        kejohanan_id: this.selectedKejohananId,
        jadual_ids: ids,
      }).subscribe({
        next: (res) => {
          this.toast.show(res.message, 'success');
          this.sendingNotif = false;
          this.selectedMatchIds.clear();
          this.loadJadualLantikan();
        },
        error: (err) => {
          this.toast.show(err?.error?.message || 'Ralat menghantar notifikasi.', 'error');
          this.sendingNotif = false;
        },
      });
    };
    this.showConfirmModal = true;
  }

  hasUnnotified(j: any): boolean {
    const assignments = j.assignments || {};
    return this.hasRequiredSlots(assignments)
      && Object.values(assignments).some((a: any) => a && a.status_lantikan === 'Belum Jawab' && !a.notif_hantar);
  }

  sendMatchNotification(jadualId: number): void {
    const match = this.jadualLantikanGrouped
      .flatMap((group) => group.matches)
      .find((item: any) => item.id === jadualId);
    if (!match || !this.hasRequiredSlots(match.assignments || {})) {
      this.toast.show('Slot wajib Pengadil, AR1 dan AR2 mesti lengkap sebelum lantikan dihantar.', 'error');
      return;
    }
    this.confirmTitle = 'Hantar Notifikasi';
    this.confirmMessage = 'Hantar notifikasi kepada semua pegawai (Belum Jawab) untuk perlawanan ini?';
    this.confirmType = 'warning';
    this.confirmBtnText = 'Hantar';
    this.confirmFn = () => {
      this.sendingNotif = true;
      this.api.post<any>('lantikan.php', { action: 'notify', jadual_id: jadualId }).subscribe({
        next: (res) => {
          this.toast.show(res.message, 'success');
          this.sendingNotif = false;
          this.loadJadualLantikan();
        },
        error: (err) => {
          this.toast.show(err?.error?.message || 'Ralat.', 'error');
          this.sendingNotif = false;
        },
      });
    };
    this.showConfirmModal = true;
  }

  editMatchLantikan(jadualId: number): void {
    this.activeTab = 'lantikan';
    const j = this.jadualList.find((m: any) => m.id === jadualId);
    if (j) {
      this.selectedJadual = j;
      this.loadLantikan(jadualId);
    } else {
      this.loadJadual(this.selectedKejohananId!);
      setTimeout(() => {
        const found = this.jadualList.find((m: any) => m.id === jadualId);
        if (found) {
          this.selectedJadual = found;
          this.loadLantikan(jadualId);
        }
      }, 500);
    }
  }

  batalMatchLantikan(jadualId: number, noPer: string): void {
    this.openMatchStatusModal([jadualId], `Perlawanan ${noPer}`);
  }

  batalBulkLantikan(): void {
    const ids = Array.from(this.selectedMatchIds);
    if (ids.length === 0) return;
    this.openMatchStatusModal(ids, ids.length === 1 ? '1 perlawanan' : `${ids.length} perlawanan`);
  }

  openMatchStatusModal(jadualIds: number[], label: string): void {
    this.matchStatusForm = { jadualIds, status: 'Dibatalkan', sebab: '' };
    this.confirmMessage = label;
    this.showMatchStatusModal = true;
  }

  submitMatchStatus(): void {
    const { jadualIds, status, sebab } = this.matchStatusForm;
    if (!sebab.trim()) {
      this.toast.show('Sila nyatakan sebab pembatalan atau penangguhan.', 'error');
      return;
    }
    this.updatingMatchStatus = true;
    const action = jadualIds.length === 1 ? 'batal_jadual' : 'batal_bulk';
    const payload: any = { action, status, sebab: sebab.trim() };
    if (jadualIds.length === 1) payload.jadual_id = jadualIds[0];
    else payload.jadual_ids = jadualIds;
    this.api.post<any>('lantikan.php', payload).subscribe({
      next: (res) => {
        this.toast.show(res.message, 'success');
        this.showMatchStatusModal = false;
        this.updatingMatchStatus = false;
        this.selectedMatchIds.clear();
        this.loadJadualLantikan();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Ralat mengemaskini status perlawanan.', 'error');
        this.updatingMatchStatus = false;
      },
    });
  }

  gantiPengadil(id: number, jawatan: string): void {
    this.confirmTitle = 'Ganti Pengadil';
    this.confirmMessage = `Buang lantikan ${jawatan} yang ditolak dan pilih pengadil baharu?`;
    this.confirmType = 'warning';
    this.confirmBtnText = 'Ganti';
    this.confirmFn = () => {
      this.api.delete<any>(`lantikan.php?id=${id}`).subscribe({
        next: () => {
          this.toast.show('Lantikan dibuang. Sila pilih pengadil baharu.', 'success');
          this.loadLantikan(this.selectedJadual!.id);
          this.activeJawatan = jawatan;
        },
        error: (err) => this.toast.show(err?.error?.message || 'Ralat.', 'error'),
      });
    };
    this.showConfirmModal = true;
  }

  // ===================== LAPORAN =====================

  get laporanKejohananOptions(): Array<{ id: number; nama: string }> {
    const options = new Map<number, string>();
    this.laporanList.forEach(laporan => {
      const id = Number(laporan.kejohanan_id);
      if (id && laporan.nama_kejohanan) {
        options.set(id, laporan.nama_kejohanan);
      }
    });
    return Array.from(options, ([id, nama]) => ({ id, nama }))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'ms'));
  }

  get filteredLaporan(): any[] {
    let list = this.laporanList;

    if (this.laporanKejohananFilter) {
      const kejohananId = Number(this.laporanKejohananFilter);
      list = list.filter(laporan => Number(laporan.kejohanan_id) === kejohananId);
    }

    const search = this.laporanSearch.trim().toLowerCase();
    if (search) {
      list = list.filter(laporan => {
        const pegawai = (laporan.pegawai || [])
          .map((item: any) => item.nama_pengadil || '')
          .join(' ');
        const searchable = [
          laporan.nama_kejohanan,
          laporan.no_perlawanan,
          laporan.pasukan_home,
          laporan.pasukan_away,
          laporan.nama_penilai,
          pegawai,
        ].join(' ').toLowerCase();
        return searchable.includes(search);
      });
    }

    return list;
  }

  clearLaporanFilters(): void {
    this.laporanSearch = '';
    this.laporanKejohananFilter = '';
  }

  loadLaporan(): void {
    this.loadingLaporan = true;
    this.api.get<any>('laporan-penilaian.php').subscribe({
      next: (res) => { this.laporanList = res.data || []; this.loadingLaporan = false; },
      error: () => this.loadingLaporan = false,
    });
  }

  viewLaporan(id: number): void {
    this.laporanDetail = null;
    this.catatanAdmin = '';
    this.alasanOverride = '';
    this.loadingLaporanDetail = true;
    this.showLaporanModal = true;
    this.api.get<any>(`laporan-penilaian.php?id=${id}`).subscribe({
      next: (res) => {
        this.loadingLaporanDetail = false;
        if (!res.error) {
          this.laporanDetail = res.laporan;
          this.catatanAdmin = '';
        } else {
          this.toast.error(res.message || 'Gagal memuatkan laporan.');
          this.showLaporanModal = false;
        }
      },
      error: (err: any) => { this.loadingLaporanDetail = false; this.showLaporanModal = false; this.toast.error(err?.error?.message || 'Gagal memuatkan laporan.'); },
    });
  }

  sahkanLaporan(): void {
    if (!this.laporanDetail) return;
    if (!this.alasanOverride.trim()) {
      this.toast.error('Sebab override Admin diperlukan.');
      return;
    }
    this.submittingSahkan = true;
    this.api.put<any>('laporan-penilaian.php', {
      action: 'sahkan',
      id: this.laporanDetail.id,
      override_reason: this.alasanOverride.trim(),
      catatan_admin: this.catatanAdmin.trim(),
    }).subscribe({
      next: (res) => {
        this.submittingSahkan = false;
        if (!res.error) {
          this.toast.success('Override Admin direkodkan dan laporan disahkan.');
          this.showLaporanModal = false;
          this.loadLaporan();
        } else {
          this.toast.error(res.message || 'Gagal mengesahkan laporan.');
        }
      },
      error: (err: any) => { this.submittingSahkan = false; this.toast.error(err?.error?.message || 'Ralat semasa mengesahkan.'); },
    });
  }

  async copyPengerusiApprovalLink(): Promise<void> {
    const url = this.laporanDetail?.pengesahan?.approval_url;
    if (!url || !this.laporanDetail?.id) return;
    try {
      await this.copyText(url);
    } catch {
      this.toast.error('Pautan tidak dapat disalin oleh pelayar.');
      return;
    }
    this.api.put<any>('laporan-penilaian.php', {
      action: 'log_pengerusi_link_copy',
      id: this.laporanDetail.id,
    }).subscribe({
      next: () => {
        this.toast.success('Pautan pengesahan Pengerusi disalin dan direkodkan.');
        this.viewLaporan(this.laporanDetail.id);
      },
      error: (err: any) => this.toast.error(err?.error?.message || 'Pautan disalin tetapi log salinan gagal direkodkan.'),
    });
  }

  retryPengerusiNotification(): void {
    if (!this.laporanDetail?.id || this.submittingSahkan) return;
    this.submittingSahkan = true;
    this.api.put<any>('laporan-penilaian.php', {
      action: 'retry_pengerusi_notification',
      id: this.laporanDetail.id,
    }).subscribe({
      next: (res) => {
        this.submittingSahkan = false;
        this.toast.show(res.message || 'Percubaan penghantaran selesai.',
          res.pengesahan?.email_sent || res.pengesahan?.telegram_sent ? 'success' : 'error');
        this.viewLaporan(this.laporanDetail.id);
      },
      error: (err: any) => {
        this.submittingSahkan = false;
        this.toast.error(err?.error?.message || 'Gagal mencuba semula penghantaran.');
      },
    });
  }

  downloadLaporanPdf(id: number): void {
    window.open(`${environment.apiUrl}/download-laporan-penilaian.php?id=${id}`, '_blank');
  }

  // ===================== HELPERS =====================

  getStatusClass(status: string): string {
    if (status === 'Aktif') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Selesai') return 'bg-slate-100 text-slate-600';
    return 'bg-amber-50 text-amber-700';
  }

  getJadualStatusClass(status: string): string {
    if (status === 'Selesai') return 'bg-slate-100 text-slate-600';
    if (status === 'Disahkan') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Menunggu Pengesahan') return 'bg-blue-50 text-blue-700';
    return 'bg-amber-50 text-amber-700';
  }

  getAssignmentStatusClass(status: string): string {
    if (status === 'Diterima') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Ditolak') return 'bg-rose-50 text-rose-700';
    return 'bg-slate-100 text-slate-600';
  }

  getLaporanStatusClass(status: string): string {
    if (status === 'Disahkan' || status === 'Disahkan Pengerusi') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Override Admin') return 'bg-rose-50 text-rose-700';
    if (status === 'Dihantar' || status === 'Menunggu Pengerusi') return 'bg-blue-50 text-blue-700';
    return 'bg-amber-50 text-amber-700';
  }

  getLaporanWorkflowLabel(laporan: any): string {
    const approvalStatus = laporan?.pengesahan?.pengesahan_status;
    if (approvalStatus === 'Override Admin') return 'Override Admin';
    if (approvalStatus === 'Disahkan') return 'Disahkan Pengerusi';
    if (laporan?.status === 'Dihantar') return 'Menunggu Pengerusi';
    return laporan?.status || '-';
  }

  getMarkahClass(markah: any): string {
    const m = parseFloat(markah);
    if (isNaN(m)) return 'text-slate-400';
    if (m >= 8.3) return 'text-emerald-600';
    if (m >= 7.5) return 'text-amber-600';
    return 'text-rose-600';
  }

  onConfirmed(): void {
    this.showConfirmModal = false;
    this.confirmFn?.();
    this.confirmFn = null;
  }
}
