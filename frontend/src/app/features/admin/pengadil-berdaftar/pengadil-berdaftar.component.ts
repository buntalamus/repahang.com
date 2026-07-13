import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ProfileModalService } from '../../../core/services/profile-modal.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-pengadil-berdaftar',
  standalone: true,
  imports: [FormsModule, LoadingComponent, PaginationComponent, ConfirmModalComponent],
  templateUrl: './pengadil-berdaftar.component.html',
})
export class PengadilBerdaftarComponent implements OnInit {
  loading = true;
  referees: any[] = [];
  filtered: any[] = [];
  paged: any[] = [];
  searchQuery = '';
  yearFilter = new Date().getFullYear().toString();
  genderFilter = 'all';
  currentPage = 1;
  pageSize = 10;

  years: number[] = [];
  stats = { total: 0, lelaki: 0, perempuan: 0 };

  showDetailModal = false;
  selectedReferee: any = null;
  detailTab: 'maklumat' | 'sejarah' | 'perlawanan' = 'maklumat';

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
      this.typeLabel = 'RA';
      this.typeLabelFull = 'RA Berdaftar';
    }
    this.generateYears();
    this.loadPersatuanList();
    this.loadReferees();
  }

  private loadPersatuanList(): void {
    this.api.get<any>('admin-users.php').subscribe({
      next: (res) => {
        this.persatuanList = res.persatuan || [];
      },
      error: () => {
        this.persatuanList = [];
      },
    });
  }

  private generateYears(): void {
    const current = new Date().getFullYear();
    for (let y = current; y >= current - 5; y--) {
      this.years.push(y);
    }
  }

  loadReferees(): void {
    this.loading = true;
    this.api.get<any>('referees.php', { year: this.yearFilter, type: this.listType }).subscribe({
      next: (res) => {
        this.referees = res.data || [];
        this.updateStats();
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Gagal memuatkan senarai pengadil.');
      },
    });
  }

  private updateStats(): void {
    this.stats.total = this.referees.length;
    this.stats.lelaki = this.referees.filter((r) => (r.jantina || '').toUpperCase() === 'LELAKI').length;
    this.stats.perempuan = this.referees.filter((r) => (r.jantina || '').toUpperCase() === 'PEREMPUAN').length;
  }

  applyFilter(): void {
    let data = [...this.referees];
    if (this.genderFilter !== 'all') {
      data = data.filter((r) => (r.jantina || '').toUpperCase() === this.genderFilter.toUpperCase());
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(
        (r) =>
          (r.nama_penuh || '').toLowerCase().includes(q) ||
          (r.no_kp || '').includes(q) ||
          (r.persatuan || '').toLowerCase().includes(q) ||
          (r.jenis_pengadil || '').toLowerCase().includes(q),
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
        this.toast.show(res.message || 'Taraf dikemaskini.', 'success');
        this.selectedIds.clear();
        this.batchSaving = false;
        this.loadReferees();
      },
      error: (err) => {
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
    this.showDetailModal = true;
  }

  editReferee(ref: any): void {
    this.api.get<any>('admin-users.php', { id: ref.user_id.toString() }).subscribe({
      next: (res) => {
        const user = res.user || {};
        this.editUser = {
          ...user,
          userId: user.id,
          user_role: user.role || 'Pengadil',
        };
        this.showEditModal = true;
      },
      error: () => {
        const persatuanId = this.findPersatuanIdByName(ref.persatuan);
        this.editUser = {
          userId: ref.user_id,
          user_role: ref.user_role || 'Pengadil',
          nama_penuh: ref.nama_penuh || '',
          no_ic: ref.no_kp || '',
          email: ref.emel || '',
          no_telefon: ref.no_telefon || '',
          jantina: ref.jantina || '',
          jenis_pengadil: ref.jenis_pengadil || '',
          persatuan_id: ref.persatuan_id || persatuanId,
          alamat1: ref.alamat1 || '',
          alamat2: ref.alamat2 || '',
          poskod: ref.poskod || '',
          daerah: ref.daerah || '',
          negeri: ref.negeri || 'Pahang',
          status_kerja: ref.status_kerja || '',
          jawatan: ref.jawatan || '',
          nama_majikan: ref.nama_majikan || '',
          alamat_majikan1: ref.alamat_majikan1 || '',
          alamat_majikan2: ref.alamat_majikan2 || '',
          poskod_majikan: ref.poskod_majikan || '',
          daerah_majikan: ref.daerah_majikan || '',
          negeri_majikan: ref.negeri_majikan || '',
          nama_waris: ref.nama_waris || '',
          hubungan_waris: ref.hubungan_waris || '',
          telefon_waris: ref.telefon_waris || '',
          url_gambar_profil: ref.url_gambar_profil || '',
          umur: this.getUmurFromIC(ref.no_kp),
        };
        this.showEditModal = true;
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
        if (!res.error) {
          this.toast.success('Pengadil berjaya dipadam.');
          this.referees = this.referees.filter((r) => r.user_id !== id);
          this.updateStats();
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
    window.open(`${environment.apiUrl}/download-referees-excel.php?year=${this.yearFilter}&type=${this.listType}`, '_blank');
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
        <td>${this.escHtml(ref.jenis_pengadil || '-')}</td>
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
    <p>Jantina: ${filterLabel}${searchLabel}</p>
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
      penilai_berdaftar: 'Pendaftaran Penilai (RA)',
      pengadil_futsal: 'Futsal',
      ujian_kecergasan: 'Ujian Kecergasan',
      ujian_bertulis: 'Ujian Kelas III FAM',
      ujian_kelas1_fam: 'Ujian Kelas 1 FAM',
    };
    return map[jenis] || jenis;
  }

  getKeputusan(app: any): string {
    const isUjian = ['ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam'].includes(app.jenis_borang);
    if (isUjian && app.status_ujian) {
      return app.status_ujian === 'Lulus' ? 'Lulus' : app.status_ujian === 'Tidak Lulus' ? 'Tidak Lulus' : 'Tidak Hadir';
    }
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
