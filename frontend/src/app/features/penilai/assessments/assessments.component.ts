import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, SlicePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { getSectionsForJawatan, KriteriaSection, SKALA_PEMARKAHAN, TAHAP_KESUKARAN } from '../../../shared/data/kriteria-penilaian';
import { environment } from '../../../../environments/environment';

interface PegawaiForm {
  lantikan_pengadil_id: number | null;
  jawatan: string;
  nama_pengadil: string;
  markah: number | null;
  prestasi: string;
  sections: KriteriaSection[];
  // Per-section selected items (JSON arrays) + nasihat text
  kawalan_kekuatan: string[];
  kawalan_kelemahan: string[];
  kawalan_nasihat: string;
  fizikal_kekuatan: string[];
  fizikal_kelemahan: string[];
  fizikal_nasihat: string;
  kerjasama_kekuatan: string[];
  kerjasama_kelemahan: string[];
  kerjasama_nasihat: string;
}

@Component({
  selector: 'app-penilai-assessments',
  standalone: true,
  imports: [FormsModule, DatePipe, SlicePipe, LoadingComponent],
  templateUrl: './assessments.component.html',
})
export class PenilaiAssessmentsComponent implements OnInit {
  loading = true;
  loadingOfficials = false;
  submitting = false;
  showForm = false;
  showView = false;

  tabs = [
    { key: 'nilai', label: 'Perlu Dinilai' },
    { key: 'laporan', label: 'Laporan Saya' },
  ];
  activeTab = 'nilai';

  assignments: any[] = [];
  myReports: any[] = [];
  pendingAssignments: any[] = [];
  pendingCount = 0;

  activeAssignment: any = null;
  activeLaporanId: number | null = null;
  viewingReport: any = null;

  // Form state
  tahapKesukaran = 'Normal';
  cuaca = '';
  ulasanKeseluruhan = '';

  cuacaOptions = ['Cerah', 'Mendung', 'Hujan Renyai', 'Hujan Lebat', 'Panas Terik', 'Berangin'];
  pegawaiList: PegawaiForm[] = [];
  activePegawaiIdx = 0;

  skala = SKALA_PEMARKAHAN;
  tahapOptions = TAHAP_KESUKARAN;

  // Dropdown state per pegawai per section
  openDropdown: string | null = null;

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    let done = 0;
    const checkDone = () => {
      done++;
      if (done === 2) {
        this.buildPendingList();
        this.loading = false;
      }
    };

    this.api.get<any>('tugasan.php').subscribe({
      next: (res) => {
        if (!res.error) {
          this.assignments = (res.data || []).filter(
            (a: any) => a.status === 'Diterima' && a.jawatan === 'Penilai Pengadil',
          );
        }
        checkDone();
      },
      error: () => checkDone(),
    });

    this.api.get<any>('laporan-penilaian.php?penilai=1').subscribe({
      next: (res) => {
        if (!res.error) this.myReports = res.data || [];
        checkDone();
      },
      error: () => checkDone(),
    });
  }

  buildPendingList(): void {
    this.pendingAssignments = this.assignments;
    this.pendingCount = this.assignments.filter(
      (a: any) => !this.getLaporanForAssignment(a.id),
    ).length;
  }

  getLaporanForAssignment(lantikanId: number): any {
    return this.myReports.find((r: any) => +r.lantikan_id === +lantikanId) ?? null;
  }

  openForm(assignment: any): void {
    this.activeAssignment = assignment;
    const existing = this.getLaporanForAssignment(assignment.id);
    this.activeLaporanId = existing?.id ?? null;
    this.activePegawaiIdx = 0;
    this.openDropdown = null;

    // Set parent-level fields
    this.tahapKesukaran = existing?.tahap_kesukaran ?? 'Normal';
    this.cuaca = existing?.cuaca ?? '';
    this.ulasanKeseluruhan = existing?.ulasan_keseluruhan ?? '';

    // Load officials for this match
    this.loadingOfficials = true;
    this.showForm = true;

    this.api.get<any>(`laporan-penilaian.php?officials=${assignment.jadual_id}`).subscribe({
      next: (res) => {
        if (!res.error) {
          const officials = res.data || [];
          this.pegawaiList = officials.map((o: any) => {
            // Check if existing report has data for this official
            const existingP = existing?.pegawai?.find(
              (p: any) => +p.lantikan_pengadil_id === +o.lantikan_id
            );
            return this.buildPegawaiForm(o, existingP);
          });
        }
        this.loadingOfficials = false;
      },
      error: () => {
        this.loadingOfficials = false;
        this.toast.error('Gagal memuatkan senarai pegawai.');
      },
    });
  }

  private buildPegawaiForm(official: any, existing?: any): PegawaiForm {
    const sections = getSectionsForJawatan(official.jawatan);
    return {
      lantikan_pengadil_id: official.lantikan_id,
      jawatan: official.jawatan,
      nama_pengadil: official.nama_pengadil || '-',
      markah: existing?.markah != null ? +existing.markah : null,
      prestasi: existing?.prestasi ?? '',
      sections,
      kawalan_kekuatan: existing?.kawalan_kekuatan ?? [],
      kawalan_kelemahan: existing?.kawalan_kelemahan ?? [],
      kawalan_nasihat: existing?.kawalan_nasihat ?? '',
      fizikal_kekuatan: existing?.fizikal_kekuatan ?? [],
      fizikal_kelemahan: existing?.fizikal_kelemahan ?? [],
      fizikal_nasihat: existing?.fizikal_nasihat ?? '',
      kerjasama_kekuatan: existing?.kerjasama_kekuatan ?? [],
      kerjasama_kelemahan: existing?.kerjasama_kelemahan ?? [],
      kerjasama_nasihat: existing?.kerjasama_nasihat ?? '',
    };
  }

  get activePegawai(): PegawaiForm | null {
    return this.pegawaiList[this.activePegawaiIdx] ?? null;
  }

  // Dropdown multi-select helpers
  toggleDropdown(key: string): void {
    this.openDropdown = this.openDropdown === key ? null : key;
  }

  isDropdownOpen(key: string): boolean {
    return this.openDropdown === key;
  }

  toggleItem(arr: string[], item: string): void {
    const idx = arr.indexOf(item);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(item);
  }

  isSelected(arr: string[], item: string): boolean {
    return arr.includes(item);
  }

  closeDropdown(): void {
    this.openDropdown = null;
  }

  getJawatanIcon(jawatan: string): string {
    if (jawatan.includes('Utama')) return 'sports';
    if (jawatan.includes('Pembantu') || jawatan.includes('Penolong')) return 'flag';
    if (jawatan.includes('Keempat') || jawatan.includes('Ke-4')) return 'person';
    return 'sports';
  }

  getJawatanShort(jawatan: string): string {
    if (jawatan === 'Pengadil') return 'R';
    if (jawatan === 'Penolong Pengadil 1') return 'AR1';
    if (jawatan === 'Penolong Pengadil 2') return 'AR2';
    if (jawatan.includes('ke4') || jawatan.includes('Keempat') || jawatan.includes('Ke-4')) return 'P4';
    return jawatan;
  }

  saveDraft(): void {
    this.submitting = true;
    this.saveToApi(false);
  }

  submitReport(): void {
    // Validate all officials have markah
    for (const p of this.pegawaiList) {
      if (p.markah == null || p.markah === ('' as any)) {
        this.toast.warning(`Sila masukkan markah untuk ${p.nama_pengadil} (${p.jawatan}).`);
        return;
      }
    }
    this.submitting = true;
    this.saveToApi(true);
  }

  private saveToApi(hantar: boolean): void {
    const a = this.activeAssignment!;
    const body = {
      jadual_id: a.jadual_id,
      lantikan_id: a.id,
      tahap_kesukaran: this.tahapKesukaran,
      cuaca: this.cuaca,
      ulasan_keseluruhan: this.ulasanKeseluruhan,
      pegawai: this.pegawaiList.map(p => ({
        lantikan_pengadil_id: p.lantikan_pengadil_id,
        jawatan: p.jawatan,
        nama_pengadil: p.nama_pengadil,
        markah: p.markah,
        prestasi: p.prestasi,
        kawalan_kekuatan: p.kawalan_kekuatan,
        kawalan_kelemahan: p.kawalan_kelemahan,
        kawalan_nasihat: p.kawalan_nasihat,
        fizikal_kekuatan: p.fizikal_kekuatan,
        fizikal_kelemahan: p.fizikal_kelemahan,
        fizikal_nasihat: p.fizikal_nasihat,
        kerjasama_kekuatan: p.kerjasama_kekuatan,
        kerjasama_kelemahan: p.kerjasama_kelemahan,
        kerjasama_nasihat: p.kerjasama_nasihat,
      })),
    };

    this.api.post<any>('laporan-penilaian.php', body).subscribe({
      next: (res) => {
        if (res.error) {
          this.toast.error(res.message || 'Gagal menyimpan.');
          this.submitting = false;
          return;
        }
        this.activeLaporanId = res.id || this.activeLaporanId;
        if (hantar) {
          this.api.put<any>('laporan-penilaian.php', { action: 'hantar', id: this.activeLaporanId }).subscribe({
            next: (r2) => {
              this.submitting = false;
              if (!r2.error) {
                this.toast.success('Laporan berjaya dihantar kepada admin.');
                this.showForm = false;
                this.loadData();
              } else {
                this.toast.error(r2.message);
              }
            },
            error: (err: any) => { this.submitting = false; this.toast.error(err?.error?.message || 'Gagal menghantar laporan.'); },
          });
        } else {
          this.submitting = false;
          this.toast.success('Draf laporan disimpan.');
          this.loadData();
        }
      },
      error: (err: any) => { this.submitting = false; this.toast.error(err?.error?.message || 'Gagal menyimpan laporan.'); },
    });
  }

  viewReport(report: any): void {
    // If report doesn't have pegawai yet, fetch full detail
    if (!report.pegawai || report.pegawai.length === 0) {
      this.api.get<any>(`laporan-penilaian.php?id=${report.id}`).subscribe({
        next: (res) => {
          if (!res.error) {
            this.viewingReport = res.laporan;
            this.showView = true;
          }
        },
      });
    } else {
      this.viewingReport = report;
      this.showView = true;
    }
  }

  downloadLaporanPdf(id: number): void {
    window.open(`${environment.apiUrl}/download-laporan-penilaian.php?id=${id}`, '_blank');
  }

  getLaporanStatusClass(status: string): string {
    switch (status) {
      case 'Draf': return 'bg-gray-100 text-gray-600';
      case 'Dihantar': return 'bg-blue-100 text-blue-700';
      case 'Disahkan': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  }

  getMarkahClass(m: number): string {
    if (m >= 8.3) return 'text-green-600';
    if (m >= 8.0) return 'text-blue-600';
    if (m >= 7.5) return 'text-yellow-600';
    return 'text-red-600';
  }

  getPrestasiClass(p: string): string {
    switch (p) {
      case 'Sangat Baik': return 'bg-green-100 text-green-700';
      case 'Baik': return 'bg-blue-100 text-blue-700';
      case 'Memuaskan': return 'bg-yellow-100 text-yellow-700';
      case 'Tidak Memuaskan': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  }

  getSectionLabel(section: KriteriaSection): string {
    return section.label;
  }

  getSectionIcon(key: string): string {
    switch (key) {
      case 'kawalan': return 'sports';
      case 'fizikal': return 'directions_run';
      case 'kerjasama': return 'handshake';
      case 'penolong': return 'flag';
      case 'keempat': return 'person';
      default: return 'sports';
    }
  }

  /** Map section key to the field prefix used in PegawaiForm */
  private getFieldKey(sectionKey: string): 'kawalan' | 'fizikal' | 'kerjasama' {
    if (sectionKey === 'penolong' || sectionKey === 'keempat') return 'kawalan';
    return sectionKey as 'kawalan' | 'fizikal' | 'kerjasama';
  }

  /** Template helpers for dynamic field access */
  getKekuatanArr(pg: PegawaiForm, sectionKey: string): string[] {
    const fk = this.getFieldKey(sectionKey);
    return pg[`${fk}_kekuatan`];
  }

  getKelemahanArr(pg: PegawaiForm, sectionKey: string): string[] {
    const fk = this.getFieldKey(sectionKey);
    return pg[`${fk}_kelemahan`];
  }

  getNasihat(pg: PegawaiForm, sectionKey: string): string {
    const fk = this.getFieldKey(sectionKey);
    return pg[`${fk}_nasihat`];
  }

  setNasihat(pg: PegawaiForm, sectionKey: string, value: string): void {
    const fk = this.getFieldKey(sectionKey);
    pg[`${fk}_nasihat`] = value;
  }
}

