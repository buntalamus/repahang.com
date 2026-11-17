import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { FamClassOneCandidate } from './fam-class-one-workbook';

@Component({
  selector: 'app-fam-class-one-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-label="Eksport calon Kelas I FAM" class="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 class="font-semibold text-gray-900">Borang Calon Kelas I FAM</h3>
          <p class="mt-1 text-sm text-gray-600">
            {{ candidates().length }} permohonan bagi tahun {{ year() }}, mengikut carian dan penapis semasa, termasuk semua halaman senarai.
          </p>
          <p class="mt-1 text-xs text-gray-600">Format Excel FAM. Angka giliran, tandatangan dan pengesahan PB Negeri diisi kemudian.</p>
        </div>
        <button type="button" (click)="download()"
          [disabled]="exporting() || !candidates().length" [attr.aria-busy]="exporting()"
          class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60">
          <span class="material-symbols-outlined text-lg" aria-hidden="true">download</span>
          {{ exporting() ? 'Menjana borang...' : 'Eksport Borang FAM (.xlsx)' }}
        </button>
      </div>
      @if (status()) { <p role="status" class="mt-3 text-sm text-gray-700">{{ status() }}</p> }
      @if (error()) { <p role="alert" class="mt-3 text-sm text-red-700">{{ error() }}</p> }
    </section>
  `,
})
export class FamClassOneExportComponent {
  readonly candidates = input.required<readonly FamClassOneCandidate[]>();
  readonly year = input.required<string>();
  readonly exporting = signal(false);
  readonly status = signal('');
  readonly error = signal('');

  async download(): Promise<void> {
    if (this.exporting() || !this.candidates().length) return;
    const candidates = this.candidates().map(candidate => ({
      nama_penuh: candidate.nama_penuh, no_kp: candidate.no_kp,
    }));
    const year = Number(this.year());
    this.exporting.set(true);
    this.status.set('');
    this.error.set('');
    try {
      const [{ buildFamClassOneWorkbook }, response] = await Promise.all([
        import('./fam-class-one-workbook'),
        fetch('templates/fam-calon-kelas1.xlsx'),
      ]);
      if (!response.ok) throw new Error('Templat borang FAM tidak dapat dimuatkan. Sila cuba semula.');
      const workbook = await buildFamClassOneWorkbook(await response.arrayBuffer(), candidates, year);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([Uint8Array.from(new Uint8Array(buffer))], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `Calon_Exam_Bolasepak_Kelas_1_FAM_Pahang_${year}.xlsx`;
        link.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      this.status.set(`Borang FAM untuk ${candidates.length} calon tahun ${year} telah dimuat turun.`);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Borang FAM tidak dapat dijana. Sila cuba semula.');
    } finally {
      this.exporting.set(false);
    }
  }
}
