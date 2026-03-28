import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { DatePipe, SlicePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import * as XLSX from 'xlsx';

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

  jawatanList = ['Pengadil Utama', 'Pembantu Pengadil 1', 'Pembantu Pengadil 2', 'Pengadil Keempat', 'Penilai Pengadil'];

  // Kejohanan
  loadingKejohanan = true;
  kejohananList: any[] = [];
  selectedKejohanan: any = null;
  selectedKejohananId: number | null = null;
  showKejohananModal = false;
  editingKejohanan: any = null;
  savingKejohanan = false;
  kejohananForm = { nama: '', tarikh_mula: '', tarikh_akhir: '', tempat: '', anjuran: '', status: 'Draf' };
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
  selectedPoolIds: Set<number> = new Set();
  poolSearchText = '';
  addingToPool = false;

  // Jadual
  loadingJadual = false;
  jadualList: any[] = [];
  showJadualModal = false;
  editingJadual: any = null;
  savingJadual = false;
  jadualForm = { no_perlawanan: '', tarikh: '', masa: '', kategori: '', peringkat: '', kumpulan: '', pasukan_home: '', pasukan_away: '', tempat: '' };
  kategoriList = ['B12', 'B15', 'B18'];
  peringkatList = ['Kumpulan', 'XY', 'Suku Akhir', 'Separuh Akhir', '3rd Playoff', 'Final'];

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

  get filteredReferees(): any[] {
    let list = this.refereeList;
    if (this.refereeSearch) {
      const s = this.refereeSearch.toLowerCase();
      list = list.filter(r =>
        (r.nama_penuh || '').toLowerCase().includes(s) ||
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
  selectedMatchIds = new Set<number>();
  showPengesahanForm = false;
  submittingPengesahan = false;
  batallingPengesahan = false;
  pengesahanForm = { nama_penyahkan: '', jawatan_penyahkan: '', nota: '' };

  loadJadualLantikan(): void {
    if (!this.selectedKejohananId) return;
    this.loadingJadualLantikan = true;
    this.jadualLantikanData = null;
    this.selectedMatchIds.clear();
    this.api.get<any>('jadual-lantikan-report.php', { kejohanan_id: this.selectedKejohananId.toString() }).subscribe({
      next: (res) => {
        this.loadingJadualLantikan = false;
        if (!res.error) {
          this.jadualLantikanData = res;
          this.showPengesahanForm = false;
        } else {
          this.toast.error(res.message || 'Gagal memuatkan jadual lantikan.');
        }
      },
      error: () => { this.loadingJadualLantikan = false; this.toast.error('Ralat memuatkan jadual lantikan.'); },
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
      error: () => { this.submittingPengesahan = false; this.toast.error('Ralat semasa mengesahkan.'); },
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
        error: () => { this.batallingPengesahan = false; this.toast.error('Ralat semasa membatalkan.'); },
      });
    };
    this.showConfirmModal = true;
  }

  downloadJadualLantikanPDF(): void {
    if (!this.selectedKejohananId) return;
    window.open(`${environment.apiUrl}/download-jadual-lantikan.php?kejohanan_id=${this.selectedKejohananId}`, '_blank');
  }

  getJawatanShort(jawatan: string): string {
    const map: Record<string, string> = {
      'Pengadil Utama':      'P.U.',
      'Pembantu Pengadil 1': 'PP 1',
      'Pembantu Pengadil 2': 'PP 2',
      'Pengadil Keempat':    'P.4',
      'Penilai Pengadil':    'Penilai',
    };
    return map[jawatan] ?? jawatan;
  }

  getJawatanCode(jawatan: string): string {
    const map: Record<string, string> = {
      'Pengadil Utama':      'R',
      'Pembantu Pengadil 1': 'AR1',
      'Pembantu Pengadil 2': 'AR2',
      'Pengadil Keempat':    'P4',
      'Penilai Pengadil':    'RA',
    };
    return map[jawatan] ?? jawatan;
  }

  // Laporan
  loadingLaporan = false;
  laporanList: any[] = [];
  showLaporanModal = false;
  laporanDetail: any = null;
  loadingLaporanDetail = false;
  catatanAdmin = '';
  submittingSahkan = false;

  // Confirm
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' = 'danger';
  confirmBtnText = 'Ya';
  private confirmFn: (() => void) | null = null;

  constructor(private api: ApiService, private toast: ToastService) {}

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
    this.kejohananForm = { nama: '', tarikh_mula: '', tarikh_akhir: '', tempat: '', anjuran: '', status: 'Draf' };
    this.showKejohananModal = true;
  }

  openEditKejohanan(k: any): void {
    this.editingKejohanan = k;
    this.kejohananForm = {
      nama: k.nama, tarikh_mula: k.tarikh_mula, tarikh_akhir: k.tarikh_akhir,
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
      return;
    }
    this.selectedKejohanan = k;
    this.selectedKejohananId = k.id;
    this.loadJadual(k.id);
    this.loadPool(k.id);
    if (this.activeTab === 'jadual-lantikan') {
      this.loadJadualLantikan();
    }
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

  openPoolModal(): void {
    this.poolTab = 'berdaftar';
    this.selectedPoolIds = new Set();
    this.poolSearchText = '';
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
      const negeri = (p.negeri || '').toLowerCase();
      return nama.includes(s) || negeri.includes(s);
    });
  }

  togglePoolSelect(id: number): void {
    if (this.selectedPoolIds.has(id)) {
      this.selectedPoolIds.delete(id);
    } else {
      this.selectedPoolIds.add(id);
    }
  }

  addToPool(): void {
    if (this.selectedPoolIds.size === 0) return;
    this.addingToPool = true;
    const items = Array.from(this.selectedPoolIds).map(id => {
      return this.poolTab === 'berdaftar'
        ? { pengadil_id: id }
        : { pengadil_luar_id: id };
    });
    this.api.post<any>('pool-pengadil.php', { kejohanan_id: this.selectedKejohanan!.id, items }).subscribe({
      next: (res) => {
        this.toast.show(res.message, 'success');
        this.addingToPool = false;
        this.selectedPoolIds = new Set();
        this.loadPool(this.selectedKejohanan!.id);
        this.loadAvailableForPool();
      },
      error: (err) => { this.toast.show(err?.error?.message || 'Ralat.', 'error'); this.addingToPool = false; },
    });
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
    this.poolTab = tab;
    this.selectedPoolIds = new Set();
  }

  // ===================== JADUAL =====================

  onKejohananSelect(id: number | null): void {
    if (!id) { this.selectedKejohanan = null; this.jadualList = []; this.poolList = []; return; }
    const k = this.kejohananList.find(x => x.id === id);
    this.selectedKejohanan = k || null;
    this.loadJadual(id);
    this.loadPool(id);
  }

  loadJadual(kejohananId: number): void {
    this.loadingJadual = true;
    this.api.get<any>('jadual-perlawanan.php', { kejohanan_id: kejohananId.toString() }).subscribe({
      next: (res) => { this.jadualList = res.data || []; this.loadingJadual = false; },
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
    return this.jadualLantikanData.jadual.filter((j: any) => {
      const assignments = j.assignments || {};
      return Object.values(assignments).some((a: any) => a && a.status_lantikan === 'Belum Jawab');
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
    return Object.values(assignments).some((a: any) => a && a.status_lantikan === 'Belum Jawab' && !a.notif_hantar);
  }

  sendMatchNotification(jadualId: number): void {
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
    this.confirmTitle = 'Batal Semua Lantikan';
    this.confirmMessage = `Batalkan semua lantikan untuk perlawanan ${noPer}? Notifikasi pembatalan akan dihantar kepada pengadil yang telah dimaklumkan.`;
    this.confirmType = 'danger';
    this.confirmBtnText = 'Batal Lantikan';
    this.confirmFn = () => {
      this.api.post<any>('lantikan.php', { action: 'batal_jadual', jadual_id: jadualId }).subscribe({
        next: (res) => {
          this.toast.show(res.message, 'success');
          this.loadJadualLantikan();
        },
        error: (err) => this.toast.show(err?.error?.message || 'Ralat.', 'error'),
      });
    };
    this.showConfirmModal = true;
  }

  batalBulkLantikan(): void {
    const ids = Array.from(this.selectedMatchIds);
    if (ids.length === 0) return;
    const matchLabel = ids.length === 1 ? '1 perlawanan' : `${ids.length} perlawanan`;
    this.confirmTitle = 'Batal Lantikan (Pukal)';
    this.confirmMessage = `Batalkan semua lantikan untuk ${matchLabel} yang dipilih? Notifikasi pembatalan akan dihantar kepada pengadil yang telah dimaklumkan.`;
    this.confirmType = 'danger';
    this.confirmBtnText = 'Batal Semua';
    this.confirmFn = () => {
      this.api.post<any>('lantikan.php', {
        action: 'batal_bulk',
        kejohanan_id: this.selectedKejohananId,
        jadual_ids: ids,
      }).subscribe({
        next: (res) => {
          this.toast.show(res.message, 'success');
          this.selectedMatchIds.clear();
          this.loadJadualLantikan();
        },
        error: (err) => this.toast.show(err?.error?.message || 'Ralat.', 'error'),
      });
    };
    this.showConfirmModal = true;
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
    this.loadingLaporanDetail = true;
    this.showLaporanModal = true;
    this.api.get<any>(`laporan-penilaian.php?id=${id}`).subscribe({
      next: (res) => {
        this.loadingLaporanDetail = false;
        if (!res.error) {
          this.laporanDetail = res.laporan;
          this.catatanAdmin = res.laporan?.catatan_admin ?? '';
        } else {
          this.toast.error(res.message || 'Gagal memuatkan laporan.');
          this.showLaporanModal = false;
        }
      },
      error: () => { this.loadingLaporanDetail = false; this.showLaporanModal = false; this.toast.error('Gagal memuatkan laporan.'); },
    });
  }

  sahkanLaporan(): void {
    if (!this.laporanDetail) return;
    this.submittingSahkan = true;
    this.api.put<any>('laporan-penilaian.php', { action: 'sahkan', id: this.laporanDetail.id, catatan_admin: this.catatanAdmin }).subscribe({
      next: (res) => {
        this.submittingSahkan = false;
        if (!res.error) {
          this.toast.success('Laporan berjaya disahkan.');
          this.showLaporanModal = false;
          this.loadLaporan();
        } else {
          this.toast.error(res.message || 'Gagal mengesahkan laporan.');
        }
      },
      error: () => { this.submittingSahkan = false; this.toast.error('Ralat semasa mengesahkan.'); },
    });
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
    if (status === 'Disahkan') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Dihantar') return 'bg-blue-50 text-blue-700';
    return 'bg-amber-50 text-amber-700';
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
