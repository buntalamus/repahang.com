import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, SlicePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-pengadil-tugasan',
  standalone: true,
  imports: [FormsModule, DatePipe, SlicePipe, LoadingComponent],
  templateUrl: './tugasan.component.html',
})
export class PengadilTugasanComponent implements OnInit {
  loading = true;
  assignments: any[] = [];
  filtered: any[] = [];
  stats = { total: 0, belum_jawab: 0, diterima: 0, ditolak: 0 };
  filterStatus = 'all';

  showModal = false;
  selectedAssignment: any = null;
  action: 'accept' | 'reject' | '' = '';
  komen = '';
  saving = false;

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.get<any>('tugasan.php').subscribe({
      next: (res) => {
        this.assignments = res.data || [];
        this.stats = res.stats || this.stats;
        this.applyFilter();
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  applyFilter(): void {
    if (this.filterStatus === 'all') {
      this.filtered = [...this.assignments];
    } else {
      this.filtered = this.assignments.filter(a => a.status === this.filterStatus);
    }
  }

  openAction(a: any, action: 'accept' | 'reject'): void {
    this.selectedAssignment = a;
    this.action = action;
    this.komen = '';
    this.showModal = true;
  }

  submitAction(): void {
    if (!this.selectedAssignment || !this.action) return;
    if (this.action === 'reject' && !this.komen.trim()) {
      this.toast.show('Sila berikan sebab penolakan.', 'error'); return;
    }
    this.saving = true;
    this.api.post<any>('lantikan-jawab.php', {
      lantikan_id: this.selectedAssignment.id,
      action: this.action,
      komen: this.komen,
    }).subscribe({
      next: (res) => {
        this.toast.show(res.message, 'success');
        this.showModal = false;
        this.saving = false;
        this.load();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Ralat.', 'error');
        this.saving = false;
      },
    });
  }

  getStatusClass(status: string): string {
    if (status === 'Diterima') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Ditolak') return 'bg-rose-50 text-rose-700';
    return 'bg-amber-50 text-amber-700';
  }

  getDeadlineHours(jenis: string): number {
    return jenis === 'Liga' ? 48 : 3;
  }

  getDeadlineText(a: any): string {
    if (!a.tarikh_notif) return '';
    const hours = this.getDeadlineHours(a.jenis_kejohanan || 'Persahabatan');
    const notifDt = new Date(String(a.tarikh_notif).replace(' ', 'T'));
    const deadline = new Date(notifDt.getTime() + hours * 3600000);
    return deadline.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })
      + ', ' + deadline.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  getAutoRejectRule(jenis: string): string {
    const hours = this.getDeadlineHours(jenis || 'Persahabatan');
    return `Jika tidak dijawab dalam masa ${hours} jam selepas notifikasi dihantar, lantikan akan ditolak secara automatik.`;
  }
}
