import { ModalFocusDirective } from '../../../shared/directives/modal-focus.directive';
import type { ProfileRecord } from '../../../../../../shared/profile-fields';
import { ProfileFieldsComponent } from '../../../shared/components/profile-fields/profile-fields.component';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ProfileModalService } from '../../../core/services/profile-modal.service';
import { environment } from '../../../../environments/environment';
import { examKinds, examResults, filterReferees, refereeExamResult, refereeQualificationLabel, type ExamKind, type RefereeFilters } from '../../../../../../shared/referee-filters';
import { jenisPengadilOptions } from '../../../shared/data/jenis-pengadil';

@Component({
  selector: 'app-pengadil-berdaftar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalFocusDirective, ProfileFieldsComponent, FormsModule, LoadingComponent, PaginationComponent, ConfirmModalComponent],
  templateUrl: './pengadil-berdaftar.component.html',
})
export class PengadilBerdaftarComponent implements OnInit {
  readonly jenisPengadilOptions = jenisPengadilOptions;
  loading = true;
  referees: any[] = [];
  filtered: any[] = [];
  paged: any[] = [];
  searchQuery = '';
  yearFilter = new Date().getFullYear().toString();
  genderFilter = 'all';
  readonly qualificationFilter = signal('all');
  readonly resultFilters = signal({ annual: 'all', class3: 'all', class1: 'all' });
  readonly examKinds = examKinds;
  readonly examResults = examResults;
  readonly examSummary = signal<{ key: ExamKind; label: string; results: { label: string; count: number }[] }[]>([]);
  private readonly cdr = inject(ChangeDetectorRef);
  currentPage = 1;
  pageSize = 10;

  years: number[] = [];
  stats = { total: 0, lelaki: 0, perempuan: 0 };

  showDetailModal = false;
  selectedReferee: any = null;
  readonly detailProfile = signal<ProfileRecord | null>(null);
  readonly detailTelegram = signal<'loading' | 'linked' | 'unlinked' | 'error'>('loading');
  private detailTelegramRequest = 0;
  detailTab: 'maklumat' | 'sejarah' | 'perlawanan' = 'maklumat';
  matchYearFilter = 'all';

  get matchYears(): string[] {
    return [...new Set<string>((this.selectedReferee?.perlawanan || [])
      .map((match: any) => String(match.tarikh || '').slice(0, 4))
      .filter((year: string) => /^\d{4}$/.test(year)))].sort().reverse();
  }

  get visibleMatches(): any[] {
    const matches = this.selectedReferee?.perlawanan || [];
    return this.matchYearFilter === 'all' ? matches
      : matches.filter((match: any) => String(match.tarikh || '').startsWith(this.matchYearFilter));
  }

  showEditModal = false;
  savingEdit = false;
  editUser: any = null;
  persatuanList: any[] = [];

  showDeleteModal = false;
  deleteTargetId = 0;
  deleteTargetName = '';

  // Batch toggle taraf pengadil
  selectedIds = new Set<number>();
  batchTaraf: 'kebangsaan' | 'negeri' | 'daerah' = 'kebangsaan';
  batchSaving = false;

  apiUrl = environment.apiUrl;

  // Type support: 'pengadil_berdaftar' or 'penilai_berdaftar'
  listType = 'pengadil_berdaftar';
  typeLabel = 'Pengadil';
  typeLabelFull = 'Pengadil Berdaftar';

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
    public profileModal: ProfileModalService,
  ) {}

  ngOnInit(): void {
    this.listType = this.route.snapshot.data['type'] || 'pengadil_berdaftar';
    if (this.listType === 'penilai_berdaftar') {
      this.typeLabel = 'Penilai Pengadil';
      this.typeLabelFull = 'Penilai Pengadil Berdaftar';
    }
    this.generateYears();
    this.loadPersatuanList();
    this.loadReferees();
  }

  private loadPersatuanList(): void {
    this.api.get<any>('admin-users.php').subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.persatuanList = res.persatuan || [];
      },
      error: () => {
        this.cdr.markForCheck();
        this.persatuanList = [];
      },
    });
  }

  private generateYears(): void {
    const current = new Date().getFullYear();
    for (let y = current; y >= current - 3; y--) {
      this.years.push(y);
    }
  }

  loadReferees(): void {
    this.loading = true;
    this.api.get<any>('referees.php', { year: this.yearFilter, type: this.listType }).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.referees = res.data || [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.cdr.markForCheck();
        this.loading = false;
        this.toast.error('Gagal memuatkan senarai pengadil.');
      },
    });
  }

  get activeFilters(): RefereeFilters {
    return { q: this.searchQuery, gender: this.genderFilter, qualification: this.qualificationFilter(), ...this.resultFilters() };
  }

  get hasFilters(): boolean {
    return Object.entries(this.activeFilters).some(([key, value]) => key === 'q' ? Boolean(value.trim()) : value !== 'all');
  }

  applyFilter(): void {
    this.filtered = filterReferees(this.referees, this.activeFilters, Number(this.yearFilter));
    this.stats = { total: this.filtered.length,
      lelaki: this.filtered.filter(r => (r.jantina || '').toUpperCase() === 'LELAKI').length,
      perempuan: this.filtered.filter(r => (r.jantina || '').toUpperCase() === 'PEREMPUAN').length };
    this.examSummary.set(examKinds.map(exam => ({ ...exam, results: examResults.map(label => ({ label,
      count: this.filtered.filter(r => refereeExamResult(r, exam.key, Number(this.yearFilter)) === label).length })) })));
    // Hidden rows must not remain selected for batch updates after a filter changes.
    this.selectedIds.clear();
    this.currentPage = 1;
    this.updatePaged();
  }

  setResultFilter(kind: ExamKind, value: string): void {
    this.resultFilters.update(filters => ({ ...filters, [kind]: value }));
    this.applyFilter();
  }

  resetFilters(): void {
    this.searchQuery = ''; this.genderFilter = 'all'; this.qualificationFilter.set('all');
    this.resultFilters.set({ annual: 'all', class3: 'all', class1: 'all' });
    this.applyFilter();
  }

  qualificationLabel(ref: Parameters<typeof refereeQualificationLabel>[0]): string {
    return refereeQualificationLabel(ref, Number(this.yearFilter));
  }

  examResult(ref: Parameters<typeof refereeExamResult>[0], kind: ExamKind): string {
    return refereeExamResult(ref, kind, Number(this.yearFilter));
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

  // ── Batch toggle taraf ──────────────────────────────────────────────
  isSelected(userId: number): boolean {
    return this.selectedIds.has(+userId);
  }

  toggleSelect(userId: number): void {
    const id = +userId;
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  allPagedSelected(): boolean {
    return this.paged.length > 0 && this.paged.every((r) => this.selectedIds.has(+r.user_id));
  }

  toggleSelectAll(): void {
    if (this.allPagedSelected()) {
      this.paged.forEach((r) => this.selectedIds.delete(+r.user_id));
    } else {
      this.paged.forEach((r) => this.selectedIds.add(+r.user_id));
    }
  }

  applyBatchTaraf(value: 0 | 1): void {
    if (this.selectedIds.size === 0) return;
    this.batchSaving = true;
    this.api.post<any>('pengadil-taraf.php', {
      user_ids: Array.from(this.selectedIds),
      taraf: this.batchTaraf,
      value,
    }).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.toast.show(res.message || 'Taraf dikemaskini.', 'success');
        this.selectedIds.clear();
        this.batchSaving = false;
        this.loadReferees();
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.toast.show(err?.error?.message || 'Ralat mengemaskini taraf.', 'error');
        this.batchSaving = false;
      },
    });
  }

  getProfileImage(url: string | null): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return url.startsWith('/') ? url : '/' + url;
  }

  getUmurFromIC(noKP: string): number | null {
    if (!noKP) return null;
    const ic = noKP.replace(/-/g, '');
    if (ic.length < 6) return null;
    const yy = parseInt(ic.substring(0, 2), 10);
    const mm = parseInt(ic.substring(2, 4), 10) - 1;
    const dd = parseInt(ic.substring(4, 6), 10);
    if (isNaN(yy) || isNaN(mm) || isNaN(dd)) return null;
    const currentYear2d = new Date().getFullYear() % 100;
    const fullYear = yy > currentYear2d ? 1900 + yy : 2000 + yy;
    const dob = new Date(fullYear, mm, dd);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const mDiff = today.getMonth() - dob.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 && age < 150 ? age : null;
  }

  getTarikhLahirFromIC(noKP: string): string {
    if (!noKP) return '-';
    const ic = noKP.replace(/-/g, '');
    if (ic.length < 6) return '-';
    const yy = parseInt(ic.substring(0, 2), 10);
    const mm = parseInt(ic.substring(2, 4), 10);
    const dd = parseInt(ic.substring(4, 6), 10);
    if (isNaN(yy) || isNaN(mm) || isNaN(dd)) return '-';
    const currentYear2d = new Date().getFullYear() % 100;
    const fullYear = yy > currentYear2d ? 1900 + yy : 2000 + yy;
    const dob = new Date(fullYear, mm - 1, dd);
    return dob.toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  viewReferee(ref: any): void {
    this.selectedReferee = ref;
    this.detailTab = 'maklumat';
    this.matchYearFilter = 'all';
    this.showDetailModal = true;
    this.detailProfile.set(null);
    this.refreshDetailTelegram();
  }

  refreshDetailTelegram(): void {
    const id = Number(this.selectedReferee?.user_id);
    if (!id || !this.showDetailModal) return;
    const request = ++this.detailTelegramRequest;
    this.detailTelegram.set('loading');
    this.api.get<{ error: boolean; profil?: ProfileRecord & { id: number; telegram_linked: number } }>('profil-pengadil.php', { id: String(id) })
      .subscribe({
        next: (res) => {
          if (request !== this.detailTelegramRequest || !this.showDetailModal || Number(this.selectedReferee?.user_id) !== id) return;
          const linked = res.profil?.telegram_linked;
          if (res.error || Number(res.profil?.id) !== id || (linked !== 0 && linked !== 1)) {
            this.detailTelegram.set('error'); return;
          }
          const profile=res.profil!;
          this.detailProfile.set(profile);
          this.selectedReferee={...this.selectedReferee,nama_penuh:profile['nama_penuh'],emel:profile['email'],
            no_kp:profile['no_ic'],jenis_pengadil:profile['jenis_pengadil'],saiz_baju:profile['saiz_baju'],
            url_gambar_profil:profile['url_gambar_profil'],approved_applications:profile['permohonan'],perlawanan:profile['perlawanan']};
          this.detailTelegram.set(linked === 1 ? 'linked' : 'unlinked');
        },
        error: () => {
          if (request === this.detailTelegramRequest && this.showDetailModal && Number(this.selectedReferee?.user_id) === id) this.detailTelegram.set('error');
        },
      });
  }

  editReferee(ref: any): void {
    this.api.get<any>('admin-users.php', { id: ref.user_id.toString() }).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        const user = res.user || {};
        this.editUser = {
          ...user,
          userId: user.id,
          user_role: user.role || 'Pengadil',
        };
        this.showEditModal = true;
      },
      error: () => {
        this.toast.error('Gagal membaca profil penuh. Sila cuba semula.');
      },
    });
  }

  saveEditReferee(): void {
    if (!this.editUser?.nama_penuh || !this.editUser?.email) {
      this.toast.error('Nama penuh dan emel diperlukan.');
      return;
    }
    if (!this.editUser?.persatuan_id) {
      this.toast.error('Sila pilih Persatuan Bola Sepak Daerah.');
      return;
    }

    this.savingEdit = true;
    this.api.put<any>('admin-users.php', this.editUser).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.savingEdit = false;
        if (!res.error) {
          this.toast.success('Profil pengadil berjaya dikemaskini.');
          this.showEditModal = false;
          this.loadReferees();
        } else {
          this.toast.error(res.message || 'Gagal mengemaskini profil pengadil.');
        }
      },
      error: () => {
        this.cdr.markForCheck();
        this.savingEdit = false;
        this.toast.error('Gagal mengemaskini profil pengadil.');
      },
    });
  }

  private findPersatuanIdByName(name: string): number | null {
    if (!name) return null;
    const found = this.persatuanList.find((p) => (p.nama_persatuan || '').toLowerCase() === name.toLowerCase());
    return found?.id || null;
  }

  confirmDelete(ref: any): void {
    this.deleteTargetId = ref.user_id;
    this.deleteTargetName = ref.nama_penuh;
    this.showDeleteModal = true;
  }

  onDeleteConfirmed(): void {
    const id = this.deleteTargetId;
    this.showDeleteModal = false;
    this.api.delete<any>(`admin-delete-referee.php?id=${id}`).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        if (!res.error) {
          this.toast.success(res.message || 'Akaun pengadil dinyahaktifkan.');
          this.referees = this.referees.filter((r) => r.user_id !== id);
          this.applyFilter();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  getJantinaLabel(jantina: string): string {
    const val = (jantina || '').toUpperCase();
    if (val === 'LELAKI') return 'Lelaki';
    if (val === 'PEREMPUAN') return 'Perempuan';
    return '-';
  }

  downloadExcel(): void {
    const params = new URLSearchParams({ year: this.yearFilter, type: this.listType, ...this.activeFilters });
    window.open(`${environment.apiUrl}/download-referees-excel.php?${params}`, '_blank');
  }

  private escHtml(str: string): string {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  printList(): void {
    const now = new Date().toLocaleDateString('ms-MY', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    } as Intl.DateTimeFormatOptions);
    const filterLabel =
      this.genderFilter === 'LELAKI' ? 'Lelaki' :
      this.genderFilter === 'PEREMPUAN' ? 'Perempuan' : 'Semua Jantina';
    const extraFilters = this.listType === 'pengadil_berdaftar' ? ` | Kelas: ${this.escHtml({ all: 'Semua', class3: 'Kelas III FAM', class1: 'Kelas I FAM', unrecorded: 'Belum ada rekod' }[this.qualificationFilter()] || '')}${examKinds.map(exam => ` | ${exam.label}: ${this.escHtml(this.resultFilters()[exam.key])}`).join('')}` : '';
    const searchLabel = this.searchQuery ? ` | Carian: "${this.escHtml(this.searchQuery)}"` : '';

    const rows = this.filtered.map((ref, i) => {
      const jantina = this.getJantinaLabel(ref.jantina);
      const umur = this.getUmurFromIC(ref.no_kp);
      return `<tr>
        <td>${i + 1}</td>
        <td>${this.escHtml(ref.nama_penuh || '-')}</td>
        <td style="font-family:monospace">${this.escHtml(ref.no_kp || '-')}</td>
        <td>${this.escHtml(jantina)}</td>
        <td>${umur ? umur + ' thn' : '-'}</td>
        <td>${this.escHtml(ref.jenis_pengadil || '-')}${this.listType === 'pengadil_berdaftar' ? `<br>${this.escHtml(this.qualificationLabel(ref))}<br>${examKinds.map(exam => `${exam.label}: ${this.examResult(ref, exam.key)}`).map(text => this.escHtml(text)).join('<br>')}` : ''}</td>
        <td>${this.escHtml(ref.persatuan || '-')}</td>
        <td>${this.escHtml(ref.no_telefon || '-')}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <title>Senarai ${this.typeLabelFull} ${this.yearFilter}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 16mm 14mm; }
    .header { text-align: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #1e3a5f; }
    .header h1 { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .header h2 { font-size: 11px; color: #1e3a5f; margin-top: 3px; }
    .header p { font-size: 9px; color: #666; margin-top: 3px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 9px; color: #555; }
    .stats { display: flex; gap: 12px; margin-bottom: 12px; }
    .stat-box { border: 1px solid #ccc; padding: 5px 12px; border-radius: 4px; text-align: center; }
    .stat-box strong { display: block; font-size: 18px; font-weight: bold; }
    .stat-box span { font-size: 9px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    thead tr { background: #1e3a5f; color: white; }
    th { padding: 6px 7px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
    td { padding: 5px 7px; font-size: 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 14px; font-size: 8px; color: #999; text-align: right; border-top: 1px solid #e5e7eb; padding-top: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Persatuan Bola Sepak Pahang</h1>
    <h2>Senarai ${this.typeLabelFull} Tahun ${this.yearFilter}</h2>
    <p>Jantina: ${filterLabel}${searchLabel}${extraFilters}</p>
  </div>
  <div class="meta">
    <span>Jumlah ditunjukkan: <strong>${this.filtered.length} orang</strong></span>
    <span>Dicetak: ${now}</span>
  </div>
  <div class="stats">
    <div class="stat-box"><strong>${this.stats.total}</strong><span>Jumlah ${this.typeLabel}</span></div>
    <div class="stat-box"><strong>${this.stats.lelaki}</strong><span>Lelaki</span></div>
    <div class="stat-box"><strong>${this.stats.perempuan}</strong><span>Perempuan</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Nama Penuh</th>
        <th>No. KP</th>
        <th>Jantina</th>
        <th>Umur</th>
        <th>Jenis Pengadil</th>
        <th>Persatuan</th>
        <th>No. Telefon</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Dokumen ini dijana secara automatik oleh Sistem Pengurusan Pengadil Pahang.</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body></html>`;

    const win = window.open('', '_blank', 'width=960,height=720');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  getJenisLabel(jenis: string): string {
    const map: Record<string, string> = {
      pengadil_berdaftar: 'Pendaftaran Pengadil',
      penilai_berdaftar: 'Pendaftaran Penilai Pengadil',
      pengadil_futsal: 'Futsal',
      ujian_kecergasan: 'Ujian Kecergasan',
      ujian_bertulis: 'Ujian Kelas III FAM',
      ujian_kelas1_fam: 'Ujian Kelas 1 FAM',
    };
    return map[jenis] || jenis;
  }

  getKeputusan(app: any): string {
    const isUjian = ['ujian_kecergasan', 'kelas3_fam', 'ujian_bertulis', 'ujian_kelas1_fam'].includes(app.jenis_borang);
    if (isUjian && app.status_ujian) {
      return app.status_ujian === 'Lulus' ? 'Lulus' : app.status_ujian === 'Tidak Lulus' ? 'Tidak Lulus' : 'Tidak Hadir';
    }
    if (isUjian) return 'Belum direkodkan';
    if (app.status === 'Approved') return 'Diluluskan';
    if (app.status === 'Rejected') return 'Ditolak';
    return 'Dalam Proses';
  }

  getKeputusanClass(app: any): string {
    const keputusan = this.getKeputusan(app);
    if (['Diluluskan', 'Lulus'].includes(keputusan)) return 'text-emerald-600';
    if (['Ditolak', 'Tidak Lulus', 'Tidak Hadir'].includes(keputusan)) return 'text-rose-600';
    return 'text-amber-600';
  }

  getTahun(app: any): string {
    if (app.tahun_permohonan) return app.tahun_permohonan;
    const d = app.status_kemaskini || app.tarikh_hantar;
    return d ? new Date(d).getFullYear().toString() : '-';
  }

  formatDate(date: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
