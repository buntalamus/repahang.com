import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpViewRefreshService } from '../../core/services/http-view-refresh.service';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { PwaPromptComponent } from '../../shared/components/web-push/pwa-prompt.component';

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, PwaPromptComponent],
  template: `
    <div class="min-h-screen flex">
      <app-sidebar [isOpen]="sidebarOpen" (closed)="sidebarOpen = false" />
      <main class="bg-slate-100 flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
        <app-header
          [title]="pageTitle"
          [subtitle]="pageSubtitle"
          (menuToggle)="sidebarOpen = !sidebarOpen"
        />
        <section class="flex-1 px-6 py-6">
          <app-pwa-prompt />
          <router-outlet />
        </section>
      </main>
    </div>
  `,
})
export class AdminLayoutComponent {
  sidebarOpen = false;
  pageTitle = '';
  pageSubtitle = '';

  constructor() {
    const cdr = inject(ChangeDetectorRef);
    // All roles share this OnPush shell. Routed pages that still use ordinary
    // fields need its branch marked after HTTP; otherwise a click is what
    // finally exposes data that has already arrived.
    inject(HttpViewRefreshService).settled$.pipe(takeUntilDestroyed()).subscribe(() => cdr.markForCheck());
  }
}
