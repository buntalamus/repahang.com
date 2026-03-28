import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

declare const Chart: any;

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [FormsModule, LoadingComponent],
  templateUrl: './statistics.component.html',
})
export class AdminStatisticsComponent implements OnInit {
  loading = true;
  yearFilter = new Date().getFullYear().toString();
  stats: any = {};
  charts: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.api.get<any>('statistics.php', { year: this.yearFilter }).subscribe({
      next: (res) => {
        this.stats = res.data || res;
        this.loading = false;
        setTimeout(() => this.renderCharts(), 100);
      },
      error: () => (this.loading = false),
    });
  }

  onYearChange(): void {
    this.destroyCharts();
    this.loadStats();
  }

  private renderCharts(): void {
    this.destroyCharts();

    // Application types chart
    const typesCtx = document.getElementById('chartTypes') as HTMLCanvasElement;
    if (typesCtx && this.stats.application_types) {
      this.charts.push(
        new Chart(typesCtx, {
          type: 'bar',
          data: {
            labels: Object.keys(this.stats.application_types),
            datasets: [
              {
                label: 'Jumlah',
                data: Object.values(this.stats.application_types),
                backgroundColor: ['#FADA00', '#1e293b', '#f59e0b', '#10b981'],
              },
            ],
          },
          options: { responsive: true, plugins: { legend: { display: false } } },
        }),
      );
    }

    // Status chart
    const statusCtx = document.getElementById('chartStatus') as HTMLCanvasElement;
    if (statusCtx && this.stats.application_status) {
      this.charts.push(
        new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(this.stats.application_status),
            datasets: [
              {
                data: Object.values(this.stats.application_status),
                backgroundColor: ['#f59e0b', '#10b981', '#ef4444', '#6b7280'],
              },
            ],
          },
          options: { responsive: true },
        }),
      );
    }

    // Gender chart
    const genderCtx = document.getElementById('chartGender') as HTMLCanvasElement;
    if (genderCtx && this.stats.gender) {
      this.charts.push(
        new Chart(genderCtx, {
          type: 'pie',
          data: {
            labels: Object.keys(this.stats.gender),
            datasets: [
              {
                data: Object.values(this.stats.gender),
                backgroundColor: ['#3b82f6', '#ec4899'],
              },
            ],
          },
          options: { responsive: true },
        }),
      );
    }

    // District chart
    const districtCtx = document.getElementById('chartDistrict') as HTMLCanvasElement;
    if (districtCtx && this.stats.districts) {
      this.charts.push(
        new Chart(districtCtx, {
          type: 'bar',
          data: {
            labels: Object.keys(this.stats.districts),
            datasets: [
              {
                label: 'Pengadil',
                data: Object.values(this.stats.districts),
                backgroundColor: '#FADA00',
              },
            ],
          },
          options: { responsive: true, indexAxis: 'y' },
        }),
      );
    }
  }

  private destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }
}
