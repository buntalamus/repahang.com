import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DemoService } from '../../../core/services/demo.service';

@Component({
  selector: 'app-demo-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.accounts()) {
      @if (demo.open()) {
        <div class="fixed bottom-3 left-3 z-[9999] pointer-events-none select-none rounded-full bg-orange-500/95 px-3 py-1.5
          text-xs font-bold uppercase tracking-wide text-white shadow-lg" role="status">
          🧪 Sistem Demo · data rekaan
        </div>
      } @else {
        <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4" role="alertdialog"
          aria-labelledby="demo-closed-title" aria-describedby="demo-closed-text">
          <div class="max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <p class="text-4xl" aria-hidden="true">🧪</p>
            <h2 id="demo-closed-title" class="mt-2 text-lg font-bold text-slate-900">Sistem Demo Ditutup</h2>
            <p id="demo-closed-text" class="mt-2 text-sm text-slate-600">{{ demo.closedMessage() }}</p>
            <a href="https://refpahang.com" class="mt-5 inline-flex min-h-11 items-center rounded-lg bg-pahang-black px-5 font-semibold text-pahang-yellow">
              Ke sistem sebenar (refpahang.com)
            </a>
          </div>
        </div>
      }
    }
  `,
})
export class DemoBannerComponent {
  protected readonly demo = inject(DemoService);
}
