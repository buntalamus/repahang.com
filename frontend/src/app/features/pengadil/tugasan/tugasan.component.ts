import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { responseDeadline } from '../../../../../../shared/appointment-deadline';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, SlicePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-pengadil-tugasan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, SlicePipe, LoadingComponent],
  templateUrl: './tugasan.component.html',
})
export class PengadilTugasanComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  loading = true;
  assignments: any[] = [];
  filtered: any[] = [];
  stats = { total: 0, belum_jawab: 0, diterima: 0, ditolak: 0, dibatalkan: 0, ditangguhkan: 0 };
  filterStatus = 'all';

  showModal = false;
  selectedAssignment: any = null;
  action: 'accept' | 'reject' | '' = '';
  komen = '';
  saving = false;

  constructor(private api: ApiService, private toast: ToastService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status && ['Belum Jawab','Diterima','Ditolak','Dibatalkan','Ditangguhkan'].includes(status)) this.filterStatus = status;
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
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
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
        this.cdr.markForCheck();
        this.load();
      },
      error: (err) => {
        this.toast.show(err?.error?.message || 'Ralat.', 'error');
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }

  getStatusClass(status: string): string {
    if (status === 'Diterima') return 'bg-emerald-50 text-emerald-700';
    if (status === 'Ditolak') return 'bg-rose-50 text-rose-700';
    if (status === 'Dibatalkan') return 'bg-red-50 text-red-700';
    if (status === 'Ditangguhkan') return 'bg-orange-50 text-orange-700';
    return 'bg-amber-50 text-amber-700';
  }

  getDeadlineHours(jenis: string): number {
    return jenis === 'Liga' ? 48 : 3;
  }

  getDeadlineText(a: any): string {
    if (!a.tarikh_notif) return '';
    const notified = Date.parse(String(a.tarikh_notif).replace(' ', 'T') + '+08:00');
    const kickoff = Date.parse(`${String(a.tarikh).slice(0, 10)}T${a.masa || '00:00:00'}+08:00`);
    const deadline = responseDeadline(a.jenis_kejohanan || '', kickoff, notified);
    if (!deadline) return '';
    return new Intl.DateTimeFormat('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit',
      month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(deadline.at);
  }

  getAutoRejectRule(jenis: string): string {
    const hours = this.getDeadlineHours(jenis || 'Persahabatan');
    return `Jawab selewat-lewatnya ${hours} jam sebelum perlawanan bermula. Lantikan lewat/pengganti boleh dijawab sehingga perlawanan bermula.`;
  }
}
