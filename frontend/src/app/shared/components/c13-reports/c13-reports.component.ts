import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
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
  private readonly sanitizer = inject(DomSanitizer);
  private readonly injector = inject(Injector);
  private readonly previewDialog = viewChild.required<ElementRef<HTMLDialogElement>>('previewDialog');
  readonly preview = signal<{ report: Report; title: string; url: SafeResourceUrl } | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly reports = signal<Report[]>([]);
  readonly filtered = computed(() => groupMatchReports(this.reports(), this.query()));

  constructor() { this.load(); }

  openPreview(report: Report): void {
    const form = report.form_type === 'MATCH_SUMMARY_C12' ? 'C12' : 'C13';
    this.preview.set({
      report,
      title: `Preview ${form} · ${report.home_name} lwn ${report.away_name}`,
      // Only this component's same-origin, authenticated PDF route is trusted.
      url: this.sanitizer.bypassSecurityTrustResourceUrl(this.pdf(report, 'preview')),
    });
    afterNextRender(() => {
      if (this.preview()) this.previewDialog().nativeElement.showModal();
    }, { injector: this.injector });
  }

  closePreview(): void {
    this.previewDialog().nativeElement.close();
    this.preview.set(null);
  }

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
