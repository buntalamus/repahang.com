import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
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
}
