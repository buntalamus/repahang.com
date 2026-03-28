import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-pp-referees',
  standalone: true,
  imports: [FormsModule, LoadingComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan senarai pengadil..." />
    } @else {
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()"
          placeholder="Cari nama, IC, persatuan..."
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm flex-1" />
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nama</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">No. KP</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Jenis</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">No. Tel</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (ref of filtered; track ref.id; let i = $index) {
              <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 text-slate-500">{{ i + 1 }}</td>
                <td class="px-6 py-4 font-medium text-slate-900">{{ ref.nama_penuh }}</td>
                <td class="px-6 py-4 text-slate-600">{{ ref.no_kp }}</td>
                <td class="px-6 py-4 text-slate-600">{{ ref.jenis_pengadil }}</td>
                <td class="px-6 py-4 text-slate-600">{{ ref.no_telefon }}</td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Aktif
                  </span>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="px-6 py-12 text-center text-slate-400">Tiada pengadil ditemui.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class PpRefereesComponent implements OnInit {
  loading = true;
  referees: any[] = [];
  filtered: any[] = [];
  searchQuery = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.get<any>('pp-referees.php').subscribe({
      next: (res) => {
        this.referees = res.data || res.referees || [];
        this.filtered = [...this.referees];
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  applyFilter(): void {
    if (!this.searchQuery) {
      this.filtered = [...this.referees];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.referees.filter(
      (r) =>
        (r.nama_penuh || '').toLowerCase().includes(q) ||
        (r.no_kp || '').includes(q),
    );
  }
}
