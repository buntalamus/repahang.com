import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  NavItem,
  ADMIN_NAV,
  PP_DAERAH_NAV,
  PENGADIL_NAV,
  PENILAI_NAV,
} from './nav-items';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside
      class="bg-pahang-black text-white flex flex-col fixed inset-y-0 left-0 w-64 z-50 transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
      [class.translate-x-0]="isOpen"
      [class.-translate-x-full]="!isOpen"
    >
      <!-- Header -->
      <div class="p-5 border-b border-white/10">
        <div class="flex items-center gap-3">
          <img src="assets/images/logo-pahang.png" alt="PBNP" class="h-10 w-10 rounded-full bg-white p-0.5" />
          <div>
            <p class="text-xs uppercase tracking-widest text-pahang-yellow/80">{{ roleLabel }}</p>
            <h1 class="text-sm font-bold text-white">Pengadil PBNP</h1>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
        @for (item of navItems; track item.label) {
          @if (item.children) {
            <div>
              <button
                (click)="toggleSubmenu(item.label)"
                class="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm transition-colors text-white/60 hover:text-white/90 hover:bg-white/5"
              >
                <span class="flex items-center">
                  <span class="material-icons text-lg mr-3">{{ item.icon }}</span>
                  {{ item.label }}
                </span>
                <span
                  class="material-icons text-sm transition-transform duration-200"
                  [class.rotate-180]="openSubmenus[item.label]"
                >expand_more</span>
              </button>
              @if (openSubmenus[item.label]) {
                <div class="ml-4 mt-1 space-y-1">
                  @for (child of item.children; track child.label) {
                    <a
                      [routerLink]="child.route"
                      routerLinkActive="bg-white/10 text-pahang-yellow font-semibold"
                      class="flex items-center px-4 py-2.5 rounded-xl text-sm transition-colors text-white/60 hover:text-white/90 hover:bg-white/5"
                      (click)="closeMobile()"
                    >
                      <span class="material-icons text-base mr-3">{{ child.icon }}</span>
                      {{ child.label }}
                    </a>
                  }
                </div>
              }
            </div>
          } @else {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-white/10 text-pahang-yellow font-semibold"
              [routerLinkActiveOptions]="{ exact: item.route === getBaseRoute() }"
              class="flex items-center px-4 py-3 rounded-xl text-sm transition-colors text-white/60 hover:text-white/90 hover:bg-white/5"
              (click)="closeMobile()"
            >
              <span class="material-icons text-lg mr-3">{{ item.icon }}</span>
              {{ item.label }}
            </a>
          }
        }
      </nav>

      <!-- Footer -->
      <div class="p-4 border-t border-white/10">
        <p class="text-xs text-white/40 text-center">Pertanyaan teknikal:</p>
        <p class="text-xs text-white/60 text-center">sokongan&#64;pbnppahang.my</p>
      </div>
    </aside>

    <!-- Mobile overlay -->
    @if (isOpen) {
      <div
        class="lg:hidden fixed inset-0 bg-black/50 z-40"
        (click)="closeMobile()"
      ></div>
    }
  `,
})
export class SidebarComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  openSubmenus: Record<string, boolean> = {};

  navItems: NavItem[] = [];
  roleLabel = '';

  constructor(private auth: AuthService) {
    this.updateNav();
    this.auth.currentUser$.subscribe(() => this.updateNav());
  }

  private updateNav(): void {
    switch (this.auth.currentUser?.role) {
      case 'Admin':
        this.navItems = ADMIN_NAV;
        this.roleLabel = 'Admin';
        break;
      case 'PP Daerah':
        this.navItems = PP_DAERAH_NAV;
        this.roleLabel = 'PP Daerah';
        break;
      case 'Pengadil':
        this.navItems = PENGADIL_NAV;
        this.roleLabel = 'Pengadil';
        break;
      case 'Penilai':
        this.navItems = PENILAI_NAV;
        this.roleLabel = 'Penilai';
        break;
    }
  }

  getBaseRoute(): string {
    return this.auth.getRoleRoute();
  }

  toggleSubmenu(label: string): void {
    this.openSubmenus[label] = !this.openSubmenus[label];
  }

  closeMobile(): void {
    this.isOpen = false;
    this.closed.emit();
  }
}
