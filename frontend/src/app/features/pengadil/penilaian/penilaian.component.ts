import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-pengadil-penilaian',
  standalone: true,
  imports: [LoadingComponent],
  templateUrl: './penilaian.component.html',
})
export class PengadilPenilaianComponent implements OnInit {
  loading = true;
  reports: any[] = [];
  selectedReport: any = null;
  detailLoading = false;
  stats = { total: 0, avgMarkah: 0 };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.api.get<any>('pengadil-penilaian.php').subscribe({
      next: (res) => {
        if (!res.error) {
          this.reports = res.data || [];
          this.stats.total = this.reports.length;
          const marks = this.reports.filter((r: any) => r.my_markah).map((r: any) => +r.my_markah);
          this.stats.avgMarkah = marks.length ? +(marks.reduce((a: number, b: number) => a + b, 0) / marks.length).toFixed(1) : 0;
        }
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  viewReport(report: any): void {
    this.detailLoading = true;
    this.selectedReport = null;
    this.api.get<any>(`pengadil-penilaian.php?id=${report.id}`).subscribe({
      next: (res) => {
        if (!res.error) {
          this.selectedReport = res.data;
        }
        this.detailLoading = false;
      },
      error: () => (this.detailLoading = false),
    });
  }

  closeDetail(): void {
    this.selectedReport = null;
  }

  downloadReport(id: number): void {
    window.open(`${environment.apiUrl}/download-laporan-penilaian.php?id=${id}`, '_blank');
  }

  markahColor(m: number | null): string {
    if (!m) return 'text-gray-500';
    if (m >= 8.3) return 'text-green-600';
    if (m >= 8.0) return 'text-blue-600';
    if (m >= 7.5) return 'text-yellow-600';
    return 'text-red-600';
  }

  markahBg(m: number | null): string {
    if (!m) return 'bg-gray-100';
    if (m >= 8.3) return 'bg-green-50';
    if (m >= 8.0) return 'bg-blue-50';
    if (m >= 7.5) return 'bg-yellow-50';
    return 'bg-red-50';
  }

  prestasiColor(p: string | null): string {
    if (!p) return 'text-gray-400';
    if (p === 'Sangat Baik') return 'text-green-600';
    if (p === 'Baik') return 'text-blue-600';
    if (p === 'Memuaskan') return 'text-yellow-600';
    return 'text-red-600';
  }

  jawatanIcon(j: string): string {
    if (j === 'Pengadil') return 'sports';
    if (j?.includes('Penolong')) return 'flag';
    return 'person';
  }
}
