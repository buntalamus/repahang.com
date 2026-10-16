import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { UserMasterData } from './master-data-workbook';

@Component({
  selector: 'app-user-master-data-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      aria-labelledby="master-data-title"
      class="mb-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
    >
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 id="master-data-title" class="font-semibold text-pahang-black">
            Master Data Pengguna
          </h2>
          <p class="mt-1 text-sm text-slate-600">
            Profil lengkap, pendaftaran, ujian, perlawanan, lantikan dan penilaian dalam satu fail
            Excel.
          </p>
          <p class="mt-1 text-xs text-slate-600">
            Semua pengguna termasuk akaun tidak aktif. Tahun rujukan status: {{ year() }}. Eksport
            merangkumi semua tahun sejarah.
          </p>
        </div>
        <button
          type="button"
          (click)="download()"
          [disabled]="exporting()"
          [attr.aria-busy]="exporting()"
          class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-pahang-black px-4 py-3 text-sm font-semibold text-pahang-yellow hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pahang-black disabled:opacity-60"
        >
          <span class="material-symbols-outlined text-lg" aria-hidden="true">download</span>
          {{ exporting() ? 'Menjana Excel...' : 'Muat Turun Master Data' }}
        </button>
      </div>
      @if (status()) {
        <p role="status" class="mt-3 text-sm text-slate-700">{{ status() }}</p>
      }
      @if (error()) {
        <p role="alert" class="mt-3 text-sm text-red-700">{{ error() }}</p>
      }
    </section>
  `,
})
export class UserMasterDataExportComponent {
  readonly year = input.required<number>();
  readonly exporting = signal(false);
  readonly status = signal('');
  readonly error = signal('');
  private readonly http = inject(HttpClient);

  async download(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.error.set('');
    this.status.set('Mendapatkan semua rekod pengguna...');
    try {
      const year = this.year();
      const [{ buildUserMasterWorkbook }, response] = await Promise.all([
        import('./master-data-workbook'),
        firstValueFrom(
          this.http
            .get<{
              error: boolean;
              message?: string;
              data: UserMasterData;
            }>(`${environment.apiUrl}/admin-users-master-data.php`, { params: { year: String(year) }, withCredentials: true })
            .pipe(timeout(90_000)),
        ),
      ]);
      if (response.error || !response.data)
        throw new Error(response.message || 'Master data tidak dapat dimuatkan.');
      this.status.set('Menyusun jadual Excel dan semua rekod sejarah...');
      const workbook = buildUserMasterWorkbook(response.data);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([Uint8Array.from(new Uint8Array(buffer))], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(response.data.exported_at));
      link.href = url;
      link.download = `Master_Data_Pengguna_RefPahang_${date}_Status_${year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      const count = response.data.sheets[0].rows.length;
      this.status.set(
        `Fail Excel dijana untuk ${count.toLocaleString('ms-MY')} pengguna. Semak folder muat turun anda.`,
      );
    } catch (error: unknown) {
      this.status.set('');
      const payload: unknown = error instanceof HttpErrorResponse ? error.error : null;
      const serverMessage =
        payload &&
        typeof payload === 'object' &&
        'message' in payload &&
        typeof payload.message === 'string'
          ? payload.message
          : null;
      this.error.set(
        serverMessage ||
          (error instanceof Error
            ? error.message
            : 'Fail Excel tidak dapat dijana. Sila cuba semula.'),
      );
    } finally {
      this.exporting.set(false);
    }
  }
}
