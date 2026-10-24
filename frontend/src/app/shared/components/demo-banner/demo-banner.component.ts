import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DemoService } from '../../../core/services/demo.service';

@Component({
  selector: 'app-demo-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.accounts()) {
      <div class="fixed bottom-3 left-3 z-[9999] pointer-events-none select-none rounded-full bg-orange-500/95 px-3 py-1.5
        text-xs font-bold uppercase tracking-wide text-white shadow-lg" role="status">
        🧪 Sistem Demo · data rekaan
      </div>
    }
  `,
})
export class DemoBannerComponent {
  protected readonly demo = inject(DemoService);
}
