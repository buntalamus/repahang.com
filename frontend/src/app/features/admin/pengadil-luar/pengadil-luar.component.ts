import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-pengadil-luar',
  standalone: true,
  imports: [FormsModule, LoadingComponent, ConfirmModalComponent],
  templateUrl: './pengadil-luar.component.html',
})
export class PengadilLuarComponent implements OnInit {

  loading = true;
  pengadilList: any[] = [];
  filteredList: any[] = [];
  searchText = '';
  filterNegeri = '';
  selectedIds: Set<number> = new Set();
  deletingBulk = false;

  negeriList = [
    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
    'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
    'Sarawak', 'Selangor', 'Terengganu',
    'WP Kuala Lumpur', 'WP Putrajaya', 'WP Labuan',
  ];

  showModal = false;
  editing: any = null;
  saving = false;
  form = { nama: '', negeri: '', no_tel: '', emel: '', jenis_pengadil: 'Pengadil Negeri' as string };

  // Upload Excel
  showUploadModal = false;
  uploadPreview: any[] = [];
  uploadErrors: string[] = [];
  uploadMatched: any[] = [];
  uploading = false;
  uploadFileName = '';
  uploadDone = false;

  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  private confirmFn: (() => void) | null = null;

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.get<any>('pengadil-luar.php').subscribe({
      next: (res) => {
        this.pengadilList = res.data || [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  applyFilter(): void {
    let list = this.pengadilList;
    if (this.searchText) {
      const s = this.searchText.toLowerCase();
      list = list.filter(p =>
        p.nama.toLowerCase().includes(s) ||
        (p.emel || '').toLowerCase().includes(s) ||
        (p.no_tel || '').includes(s)
      );
    }
    if (this.filterNegeri) {
      list = list.filter(p => p.negeri === this.filterNegeri);
    }
    this.filteredList = list;
    this.selectedIds = new Set();
  }

  toggleSelect(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  toggleSelectAll(): void {
    if (this.selectedIds.size === this.filteredList.length) {
      this.selectedIds = new Set();
    } else {
      this.selectedIds = new Set(this.filteredList.map(p => p.id));
    }
  }

  bulkDelete(): void {
    if (this.selectedIds.size === 0) return;
    this.confirmTitle = 'Padam Pukal';
    this.confirmMessage = `Padam ${this.selectedIds.size} pengadil luar yang dipilih? Mereka juga akan dibuang dari semua pool kejohanan.`;
    this.confirmFn = () => {
      this.deletingBulk = true;
      const ids = Array.from(this.selectedIds).join(',');
      this.api.delete<any>(`pengadil-luar.php?ids=${ids}`).subscribe({
        next: (res) => {
          this.toast.show(res.message, 'success');
          this.deletingBulk = false;
          this.selectedIds = new Set();
          this.load();
        },
        error: (err) => {
          this.toast.show(err?.error?.message || 'Ralat.', 'error');
          this.deletingBulk = false;
        },
      });
    };
    this.showConfirmModal = true;
  }

  openAdd(): void {
    this.editing = null;
    this.form = { nama: '', negeri: '', no_tel: '', emel: '', jenis_pengadil: 'Pengadil Negeri' };
    this.showModal = true;
  }

  openEdit(p: any): void {
    this.editing = p;
    this.form = {
      nama: p.nama,
      negeri: p.negeri,
      no_tel: p.no_tel || '',
      emel: p.emel || '',
      jenis_pengadil: p.jenis_pengadil || 'Pengadil Negeri',
    };
    this.showModal = true;
  }

  save(): void {
    if (!this.form.nama.trim() || !this.form.negeri) {
      this.toast.show('Nama dan negeri diperlukan.', 'error');
      return;
    }
    this.saving = true;
    const obs = this.editing
      ? this.api.put<any>('pengadil-luar.php', { id: this.editing.id, ...this.form })
      : this.api.post<any>('pengadil-luar.php', this.form);
    obs.subscribe({
      next: (res) => {
        this.toast.show(res.message || 'Berjaya.', 'success');
        this.showModal = false;
        this.saving = false;
        this.load();
      },
      error: (err) => { this.toast.show(err?.error?.message || 'Ralat.', 'error'); this.saving = false; },
    });
  }

  deletePengadil(id: number, nama: string): void {
    this.confirmTitle = 'Padam Pengadil Luar';
    this.confirmMessage = `Padam "${nama}"? Pengadil ini juga akan dibuang dari semua pool kejohanan.`;
    this.confirmFn = () => {
      this.api.delete<any>(`pengadil-luar.php?id=${id}`).subscribe({
        next: (res) => { this.toast.show(res.message, 'success'); this.load(); },
        error: (err) => this.toast.show(err?.error?.message || 'Ralat.', 'error'),
      });
    };
    this.showConfirmModal = true;
  }

  onConfirmed(): void {
    this.showConfirmModal = false;
    this.confirmFn?.();
    this.confirmFn = null;
  }

  getJenisClass(jenis: string): string {
    if (jenis === 'Pengadil Kebangsaan') return 'bg-amber-50 text-amber-700';
    if (jenis === 'Kelas 1') return 'bg-emerald-50 text-emerald-700';
    if (jenis === 'Kelas 2') return 'bg-sky-50 text-sky-700';
    if (jenis === 'Kelas 3') return 'bg-slate-100 text-slate-600';
    return 'bg-blue-50 text-blue-700';
  }

  // ===================== UPLOAD EXCEL =====================

  downloadTemplate(): void {
    const header = ['Nama', 'Negeri', 'No Tel', 'Emel', 'Jenis Pengadil'];
    const sample = [
      ['Ahmad bin Ali', 'Selangor', '0123456789', 'ahmad@email.com', 'Pengadil Negeri'],
      ['Muthu a/l Raju', 'Perak', '0198765432', '', 'Pengadil Kebangsaan'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...sample]);
    ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pengadil Luar');
    XLSX.writeFile(wb, 'template-pengadil-luar.xlsx');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadFileName = file.name;
    this.uploadPreview = [];
    this.uploadErrors = [];

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rows.length < 2) {
        this.uploadErrors = ['Fail kosong atau tiada data selepas header.'];
        return;
      }

      // Map header columns (case-insensitive, flexible)
      const headerRow = rows[0].map((h: any) => String(h).toLowerCase().trim());
      const colMap: Record<string, string> = {};
      headerRow.forEach((h: string, idx: number) => {
        if (h.includes('nama')) colMap['nama'] = String(idx);
        else if (h.includes('negeri')) colMap['negeri'] = String(idx);
        else if (h.includes('tel') || h.includes('phone') || h.includes('telefon')) colMap['no_tel'] = String(idx);
        else if (h.includes('emel') || h.includes('email')) colMap['emel'] = String(idx);
        else if (h.includes('jenis')) colMap['jenis_pengadil'] = String(idx);
      });

      if (!colMap['nama'] || !colMap['negeri']) {
        this.uploadErrors = ['Header "Nama" dan "Negeri" diperlukan dalam fail.'];
        return;
      }

      const parsed: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue;
        const nama = String(r[+colMap['nama']] ?? '').trim();
        const negeri = String(r[+colMap['negeri']] ?? '').trim();
        if (!nama && !negeri) continue; // skip empty rows
        parsed.push({
          nama,
          negeri,
          no_tel: colMap['no_tel'] ? String(r[+colMap['no_tel']] ?? '').trim() : '',
          emel: colMap['emel'] ? String(r[+colMap['emel']] ?? '').trim() : '',
          jenis_pengadil: colMap['jenis_pengadil'] ? String(r[+colMap['jenis_pengadil']] ?? '').trim() || 'Pengadil Negeri' : 'Pengadil Negeri',
        });
      }

      this.uploadPreview = parsed;
      if (parsed.length === 0) {
        this.uploadErrors = ['Tiada data sah dijumpai dalam fail.'];
      }
    };
    reader.readAsArrayBuffer(file);
    input.value = ''; // reset so same file can be re-selected
  }

  submitUpload(): void {
    if (this.uploadPreview.length === 0) return;
    this.uploading = true;
    this.api.post<any>('pengadil-luar-upload.php', { data: this.uploadPreview }).subscribe({
      next: (res) => {
        this.uploading = false;
        this.uploadErrors = res.errors || [];
        this.uploadMatched = res.matched || [];
        this.uploadDone = true;
        this.uploadPreview = [];
        const msg = res.message || `${res.inserted} berjaya, ${res.skipped} dilangkau.`;
        if (res.inserted > 0) {
          this.toast.show(msg, 'success');
          this.load();
        } else if (this.uploadMatched.length > 0) {
          this.toast.show(msg, 'info');
        } else {
          this.toast.show(msg, 'error');
        }
      },
      error: (err) => {
        this.uploading = false;
        this.toast.show(err?.error?.message || 'Ralat muat naik.', 'error');
      },
    });
  }

  openUploadModal(): void {
    this.showUploadModal = true;
    this.uploadPreview = [];
    this.uploadErrors = [];
    this.uploadMatched = [];
    this.uploadFileName = '';
    this.uploadDone = false;
  }
}
