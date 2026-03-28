import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-test-applications',
  standalone: true,
  imports: [FormsModule, LoadingComponent],
  template: `
    @if (loading) {
      <app-loading message="Memuatkan permohonan ujian..." />
    } @else {
      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button (click)="activeTab = 'kecergasan'; loadData()"
          class="px-4 py-2 text-sm font-medium rounded-lg transition"
          [class]="activeTab === 'kecergasan' ? 'bg-pahang-yellow text-black' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'">
          Ujian Kecergasan
        </button>
        <button (click)="activeTab = 'bertulis'; loadData()"
          class="px-4 py-2 text-sm font-medium rounded-lg transition"
          [class]="activeTab === 'bertulis' ? 'bg-pahang-yellow text-black' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'">
          Ujian Kelas III FAM
        </button>
        <button (click)="activeTab = 'kelas1'; loadData()"
          class="px-4 py-2 text-sm font-medium rounded-lg transition"
          [class]="activeTab === 'kelas1' ? 'bg-pahang-yellow text-black' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'">
          Ujian Kelas 1 FAM
        </button>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nama</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">No. KP</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tarikh</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Tindakan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (app of applications; track app.id; let i = $index) {
              <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 text-slate-500">{{ i + 1 }}</td>
                <td class="px-6 py-4 font-medium text-slate-900">{{ app.nama_penuh }}</td>
                <td class="px-6 py-4 text-slate-600">{{ app.no_kp }}</td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    [class]="app.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      app.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                    {{ app.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-slate-500">{{ app.created_at }}</td>
                <td class="px-6 py-4 text-right space-x-2">
                  @if (app.status === 'pending') {
                    <button (click)="approve(app.id)" class="text-green-600 hover:text-green-800 text-xs font-medium">Lulus</button>
                    <button (click)="reject(app.id)" class="text-red-600 hover:text-red-800 text-xs font-medium">Tolak</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="px-6 py-12 text-center text-slate-400">Tiada permohonan ujian.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class TestApplicationsComponent implements OnInit {
  loading = true;
  activeTab = 'kecergasan';
  applications: any[] = [];

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.api.get<any>('admin-test-applications.php', { type: this.activeTab }).subscribe({
      next: (res) => {
        this.applications = res.data || [];
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  approve(id: number): void {
    this.api.post<any>('admin-test-applications.php', { id, action: 'approve' }).subscribe({
      next: (res) => {
        if (!res.error) { this.toast.success('Diluluskan.'); this.loadData(); }
        else this.toast.error(res.message);
      },
    });
  }

  reject(id: number): void {
    const reason = prompt('Sebab penolakan:');
    if (!reason) return;
    this.api.post<any>('admin-test-applications.php', { id, action: 'reject', reason }).subscribe({
      next: (res) => {
        if (!res.error) { this.toast.success('Ditolak.'); this.loadData(); }
        else this.toast.error(res.message);
      },
    });
  }
}
