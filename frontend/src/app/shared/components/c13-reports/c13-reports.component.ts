import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { groupMatchReports, type Report } from './match-reports';

@Component({
  selector: 'app-c13-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './c13-reports.component.html',
})
export class C13ReportsComponent {
  private readonly api = inject(ApiService);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly reports = signal<Report[]>([]);
  readonly filtered = computed(() => groupMatchReports(this.reports(), this.query()));

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.get<{ data: { records: Report[]; c12Records?: Report[] } }>('jfa-c13.php', { view: 'admin' }).subscribe({
      next: body => {
        this.reports.set([...body.data.records, ...(body.data.c12Records ?? [])]);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Laporan perlawanan tidak dapat dimuatkan. Tekan Muat semula untuk mencuba lagi.');
        this.loading.set(false);
      },
    });
  }

  pdf(report: Report, mode: 'preview' | 'download'): string {
    const params = new URLSearchParams({ view: 'admin', match: report.match_id, mode });
    if (report.form_type === 'MATCH_SUMMARY_C12') {
      params.set('form', 'C12');
      params.set('document', report.id);
    } else params.set('record', report.id);
    return '/api/jfa-c13.php?' + params.toString();
  }
}
