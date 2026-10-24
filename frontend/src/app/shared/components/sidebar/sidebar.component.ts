import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, effect, inject, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DemoService } from '../../../core/services/demo.service';
import {
  NavItem,
  ADMIN_NAV,
  PP_DAERAH_NAV,
  PENGADIL_NAV,
  PENILAI_NAV,
} from './nav-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, NgTemplateOutlet],
  styles: `
    /* Slide-in that ends untransformed: iOS Home Screen apps mis-hit-test fixed
       layers left with a transform, which froze the whole app. */
    @keyframes drawer-in { from { transform: translateX(-100%); } to { transform: none; } }
    @keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    .drawer-panel { animation: drawer-in 200ms ease-out; }
    .drawer-backdrop { animation: backdrop-in 200ms ease-out; }
    @media (prefers-reduced-motion: reduce) { .drawer-panel, .drawer-backdrop { animation: none; } }
  `,
  template: `
    <ng-template #panel>
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
      <nav class="flex-1 p-4 space-y-1 overflow-y-auto overscroll-contain">
        @for (item of navItems; track item.label) {
          @if (item.section) { <p class="px-4 pt-5 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/70">{{ item.section }}</p> }
          @if (item.children) {
            <div>
              <button
                type="button"
                (click)="toggleSubmenu(item.label)"
                [attr.aria-expanded]="!!openSubmenus[item.label]"
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
        <p class="text-xs text-white/70 text-center">Pertanyaan teknikal:</p>
        <p class="text-xs text-white/60 text-center">sokongan&#64;pbnppahang.my</p>
      </div>
    </ng-template>

    <!-- Desktop: always visible, no fixed layer. -->
    <aside class="hidden lg:flex flex-col bg-pahang-black text-white w-64 shrink-0 sticky top-0 h-screen">
      <ng-container [ngTemplateOutlet]="panel" />
    </aside>

    <!-- Mobile: exists only while open, so nothing invisible can cover the app. -->
    @if (isOpen) {
      <div class="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu navigasi">
        <button
          type="button"
          aria-label="Tutup menu"
          class="drawer-backdrop absolute inset-0 w-full h-full bg-black/50 cursor-pointer"
          (click)="closeMobile()"
        ></button>
        <aside
          #drawer
          class="drawer-panel relative flex flex-col bg-pahang-black text-white w-64 max-w-[85vw] h-full"
          style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)"
        >
          <ng-container [ngTemplateOutlet]="panel" />
        </aside>
      </div>
    }
  `,
  host: {
    '(document:keydown.escape)': 'isOpen && closeMobile()',
  },
})
export class SidebarComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  openSubmenus: Record<string, boolean> = {};

  navItems: NavItem[] = [];
  roleLabel = '';
  private sub: Subscription;
  private navigationSub: Subscription;
  private readonly drawer = viewChild<ElementRef<HTMLElement>>('drawer');
  private returnFocus: HTMLElement | null = null;
  private readonly demo = inject(DemoService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(private auth: AuthService, private router: Router) {
    // demo.refpahang.com adds the Admin's demo outbox once demo-info answers.
    effect(() => {
      this.demo.accounts();
      this.updateNav();
      this.cdr.markForCheck();
    });
    this.updateNav();
    this.sub = this.auth.currentUser$.subscribe(() => this.updateNav());
    this.navigationSub = this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) return;
      this.openActiveGroup(event.urlAfterRedirects);
      if (this.isOpen) this.closeMobile();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['isOpen'] || changes['isOpen'].firstChange) return;
    if (this.isOpen) {
      // Move focus into the drawer; remember the menu button to return to.
      this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTimeout(() => this.drawer()?.nativeElement.querySelector<HTMLElement>('a, button')?.focus());
    } else {
      this.restoreFocus();
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.navigationSub.unsubscribe();
  }

  private updateNav(): void {
    switch (this.auth.currentUser?.role) {
      case 'Admin':
        this.navItems = this.auth.currentUser?.jenis_pengadil === 'Penilai Pengadil'
          ? [...ADMIN_NAV, { label: 'Pendaftaran Penilai Pengadil Saya (R1)', icon: 'how_to_reg', route: '/admin/daftar/ra' }]
          : ADMIN_NAV;
        if (this.demo.accounts()) {
          this.navItems = [...this.navItems, { label: 'Peti Keluar Demo', icon: 'outbox', route: '/admin/peti-keluar-demo' }];
        }
        this.roleLabel = 'Admin';
        break;
      case 'PP Daerah':
        this.navItems = PP_DAERAH_NAV.filter(item => !['Permohonan Saya','Tugasan Lantikan','Profil'].includes(item.label));
        this.navItems = this.navItems.map((item, index) => index === 0 ? { ...item, section: 'Pengurusan daerah' } : item);
        this.navItems.push({ label: 'Tugasan Lantikan Saya', icon: 'assignment_ind', route: '/pp-daerah/tugasan', section: 'Tugasan saya' });
        if (this.auth.currentUser.can_referee === 1) {
          this.navItems.push(
            { label: 'Rekod Perlawanan Saya', icon: 'sports', route: '/pengadil/perlawanan' },
            { label: 'Pendaftaran Pengadil Saya', icon: 'badge', route: '/pengadil/permohonan/berdaftar' },
          );
        }
        if (this.auth.currentUser.can_ra === 1) {
          this.navItems.push({ label: 'Panel Penilai Pengadil Saya', icon: 'rate_review', route: '/pp-daerah/penilai' },
            { label: 'Pendaftaran Penilai Saya (R1)', icon: 'how_to_reg', route: '/pp-daerah/daftar/tahunan' });
        }
        if (this.auth.currentUser.can_referee === 1) this.navItems.push({ label: 'Permohonan Saya', icon: 'description', children: [
          { label: 'Kelas III FAM', icon: 'quiz', route: '/pp-daerah/daftar/kelas3' },
          { label: 'Kelas I FAM', icon: 'military_tech', route: '/pp-daerah/daftar/kelas1' },
        ] });
        this.navItems.push({ label: 'Profil Saya', icon: 'person', route: '/pp-daerah/profil' });
        this.roleLabel = 'Pegawai Pembangunan Daerah';
        break;
      case 'Pengadil':
        this.navItems = PENGADIL_NAV;
        this.roleLabel = 'Pengadil';
        break;
      case 'Penilai':
        this.navItems = PENILAI_NAV;
        this.roleLabel = 'Penilai Pengadil';
        break;
    }
    this.openActiveGroup(this.router.url);
  }

  private openActiveGroup(url: string): void {
    const group = this.navItems.find(item => item.children?.some(child =>
      child.route && (url.split('?')[0] === child.route || url.startsWith(child.route + '/'))));
    if (group && this.auth.currentUser?.role === 'Admin') this.openSubmenus = { [group.label]: true };
  }

  getBaseRoute(): string {
    return this.auth.getRoleRoute();
  }

  toggleSubmenu(label: string): void {
    const open = !this.openSubmenus[label];
    if (this.auth.currentUser?.role === 'Admin') this.openSubmenus = { [label]: open };
    else this.openSubmenus[label] = open;
  }

  closeMobile(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.closed.emit();
    this.restoreFocus();
  }

  private restoreFocus(): void {
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected) setTimeout(() => target.focus({ preventScroll: true }));
  }
}
