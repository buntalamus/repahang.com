import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { RefereeSearchComponent, RefereeOption } from '../../../shared/components/referee-search/referee-search.component';

interface OfficialSlot {
  jawatan: string;
  referee: RefereeOption | null;
}

@Component({
  selector: 'app-pengadil-matches',
  standalone: true,
  imports: [LoadingComponent, FormsModule, RefereeSearchComponent],
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

  // Form fields
  form: any = {};
  districts: any[] = [];
  officials: OfficialSlot[] = [];

  readonly jawatanOptions = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pengadil Ke-4', 'Pengadil Ke-5'];
  readonly jenisOptions = ['Liga', 'Piala', 'Persahabatan', 'Lain-lain'];
  readonly cuacaOptions = ['Cerah', 'Mendung', 'Hujan Renyai', 'Hujan Lebat', 'Panas Terik', 'Berangin'];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadMatches();
    this.loadDistricts();
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

  loadDistricts(): void {
    this.api.get<any>('districts.php').subscribe({
      next: (res) => {
        if (!res.error) this.districts = res.data || [];
      },
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

  // IDs of already-selected officials (to exclude from other slots)
  get selectedOfficialIds(): number[] {
    return this.officials.filter((o) => o.referee).map((o) => o.referee!.id);
  }

  getExcludeIds(index: number): number[] {
    return this.officials
      .filter((o, i) => i !== index && o.referee)
      .map((o) => o.referee!.id);
  }

  openForm(): void {
    this.form = {
      tarikh: '', masa: '', jenis: '', nama_kejohanan: '', tempat: '',
      home_team: '', away_team: '', daerah_perlawanan_id: '', cuaca: '',
      skor_ht_home: null, skor_ht_away: null,
      skor_ft_home: null, skor_ft_away: null,
      skor_et_home: null, skor_et_away: null,
      skor_ps_home: null, skor_ps_away: null,
    };
    this.officials = [
      { jawatan: 'Pengadil', referee: null },
      { jawatan: 'Penolong Pengadil 1', referee: null },
      { jawatan: 'Penolong Pengadil 2', referee: null },
      { jawatan: 'Pengadil Ke-4', referee: null },
    ];
    this.showForm = true;
  }

  addOfficialSlot(): void {
    if (this.officials.length < 5) {
      this.officials.push({ jawatan: '', referee: null });
    }
  }

  removeOfficialSlot(index: number): void {
    if (this.officials.length > 1) {
      this.officials.splice(index, 1);
    }
  }

  onOfficialSelected(index: number, ref: RefereeOption): void {
    this.officials[index].referee = ref;
  }

  onOfficialCleared(index: number): void {
    this.officials[index].referee = null;
  }

  cancelForm(): void {
    this.showForm = false;
    this.form = {};
    this.officials = [];
  }

  submitMatch(): void {
    if (!this.form.tarikh || !this.form.home_team || !this.form.away_team) {
      this.toast.warning('Sila isi maklumat perlawanan yang diperlukan.');
      return;
    }

    const filledOfficials = this.officials.filter((o) => o.referee && o.jawatan);
    if (filledOfficials.length === 0) {
      this.toast.warning('Sila pilih sekurang-kurangnya seorang pegawai.');
      return;
    }
    if (!this.form.daerah_perlawanan_id) {
      this.toast.warning('Sila pilih daerah perlawanan.');
      return;
    }

    this.submitting = true;

    const payload: any = {
      action: 'add',
      tarikh: this.form.tarikh,
      masa: this.form.masa || null,
      jenis: this.form.jenis || null,
      nama_kejohanan: this.form.nama_kejohanan || null,
      tempat: this.form.tempat,
      home_team: this.form.home_team,
      away_team: this.form.away_team,
      daerah_perlawanan_id: +this.form.daerah_perlawanan_id,
      cuaca: this.form.cuaca || null,
      skor_ht_home: this.form.skor_ht_home,
      skor_ht_away: this.form.skor_ht_away,
      skor_ft_home: this.form.skor_ft_home,
      skor_ft_away: this.form.skor_ft_away,
      skor_et_home: this.form.skor_et_home,
      skor_et_away: this.form.skor_et_away,
      skor_ps_home: this.form.skor_ps_home,
      skor_ps_away: this.form.skor_ps_away,
      officials: filledOfficials.map((o) => ({
        user_id: o.referee!.id,
        jawatan: o.jawatan,
      })),
    };

    this.api.post<any>('pengadil-match-manage.php', payload).subscribe({
      next: (res) => {
        this.submitting = false;
        if (!res.error) {
          this.toast.success(res.message || 'Perlawanan berjaya ditambah.');
          this.showForm = false;
          this.form = {};
          this.officials = [];
          this.loadMatches();
        } else {
          this.toast.error(res.message || 'Gagal menambah perlawanan.');
        }
      },
      error: (err: any) => {
        this.submitting = false;
        this.toast.error(err?.error?.message || 'Ralat pelayan.');
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
