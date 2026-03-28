import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-pengadil-matches',
  standalone: true,
  imports: [LoadingComponent, FormsModule],
  templateUrl: './matches.component.html',
})
export class PengadilMatchesComponent implements OnInit {
  loading = true;
  matches: any[] = [];
  filtered: any[] = [];
  search = '';
  stats = { total: 0, disahkan: 0, belum_disahkan: 0 };
  showForm = false;
  submitting = false;
  form: any = {};

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadMatches();
  }

  loadMatches(): void {
    this.api.get<any>('pengadil-matches.php').subscribe({
      next: (res) => {
        if (!res.error) {
          this.matches = res.data || res.matches || [];
          this.filtered = [...this.matches];
          this.stats.total = res.statistics?.total || this.matches.length;
          this.stats.disahkan = res.statistics?.verified_year || this.matches.filter((m: any) => m.status_pp === 'Disahkan').length;
          this.stats.belum_disahkan = Math.max(0, this.stats.total - this.stats.disahkan);
        }
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  onSearch(event: Event): void {
    this.search = (event.target as HTMLInputElement).value.toLowerCase();
    this.filtered = this.matches.filter(
      (m: any) =>
        m.home_team?.toLowerCase().includes(this.search) ||
        m.away_team?.toLowerCase().includes(this.search) ||
        m.tempat?.toLowerCase().includes(this.search) ||
        m.jenis?.toLowerCase().includes(this.search) ||
        m.tarikh?.includes(this.search),
    );
  }

  openForm(): void {
    this.form = { tarikh: '', jenis: '', tempat: '', jawatan: '', home_team: '', away_team: '' };
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.form = {};
  }

  submitMatch(): void {
    if (!this.form.tarikh || !this.form.home_team || !this.form.away_team) {
      this.toast.warning('Sila isi maklumat perlawanan yang diperlukan.');
      return;
    }
    this.submitting = true;
    this.api.post<any>('pengadil-match-manage.php', { action: 'add', ...this.form }).subscribe({
      next: (res) => {
        this.submitting = false;
        if (!res.error) {
          this.toast.success('Perlawanan berjaya ditambah.');
          this.showForm = false;
          this.form = {};
          this.loadMatches();
        } else {
          this.toast.error(res.message || 'Gagal menambah perlawanan.');
        }
      },
      error: () => {
        this.submitting = false;
        this.toast.error('Ralat pelayan.');
      },
    });
  }

  deleteMatch(id: number): void {
    if (!confirm('Padam perlawanan ini?')) return;
    this.api.post<any>('pengadil-match-manage.php', { action: 'delete', id }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Perlawanan dipadam.');
          this.loadMatches();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Disahkan':
        return 'bg-green-100 text-green-700';
      case 'Tidak Disahkan':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  }
}
