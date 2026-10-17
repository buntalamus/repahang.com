import { Component, Output, EventEmitter, Input, OnInit, OnDestroy, ElementRef, viewChild } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';

interface NotificationEntry {
  id: number; subject?: string; title?: string; message: string; is_read: number; created_at: string;
}
interface NotificationResponse {
  error: boolean; data?: NotificationEntry[]; notifications?: NotificationEntry[]; unread_count?: number;
}

@Component({
  selector: 'app-header',
  template: `
    <header class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-6 py-4 bg-white border-b border-slate-200">
      <div class="flex items-center gap-4">
        <button
          (click)="menuToggle.emit()"
          aria-label="Buka menu navigasi"
          class="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition"
        >
          <span class="material-icons">menu</span>
        </button>
        <div>
          <p class="text-sm uppercase tracking-[0.4rem] text-slate-600">{{ breadcrumb }}</p>
          @if (title) { <h2 class="text-2xl font-bold text-slate-900">{{ title }}</h2> }
          @if (subtitle) {
            <p class="text-sm text-slate-500 mt-1">{{ subtitle }}</p>
          }
        </div>
      </div>
      <div class="flex items-center space-x-4">
        <!-- Notification Bell -->
        <div class="relative" data-notification-panel>
          <button #notificationButton (click)="toggleNotifications()" aria-label="Buka notifikasi" [attr.aria-expanded]="showNotifications" [attr.aria-controls]="showNotifications ? 'header-notifications' : null" class="relative p-2 rounded-lg hover:bg-slate-100 transition">
            <span class="material-icons text-slate-600">notifications</span>
            @if (unreadCount > 0) {
              <span class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {{ unreadCount > 9 ? '9+' : unreadCount }}
              </span>
            }
          </button>
          @if (showNotifications) {
            <section id="header-notifications" aria-labelledby="header-notifications-title" class="fixed left-3 right-3 top-28 lg:absolute lg:left-auto lg:right-0 lg:top-12 w-auto lg:w-80 max-h-[calc(100dvh-8rem)] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col">
              <div class="flex items-center justify-between gap-2 px-4 py-3 border-b bg-slate-50 shrink-0">
                <h2 id="header-notifications-title" class="font-semibold text-sm">Notifikasi</h2>
                @if (unreadCount > 0) {
                  <button (click)="markAllRead()" class="text-xs text-slate-700 hover:underline font-medium">Tandai semua dibaca</button>
                }
                <button type="button" (click)="closeNotifications(true)" aria-label="Tutup notifikasi" class="p-1 rounded hover:bg-slate-200"><span class="material-icons text-base" aria-hidden="true">close</span></button>
              </div>
              <div tabindex="0" role="region" aria-label="Senarai notifikasi" class="min-h-0 max-h-[min(26rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:-outline-offset-2">
                @for (n of notifications; track n.id) {
                  <div class="px-4 py-3 border-b last:border-0 hover:bg-slate-50 transition"
                    [class.bg-blue-50]="!n.is_read">
                    <p class="text-sm font-medium text-slate-800 break-words">{{ n.subject || n.title || n.message }}</p>
                    <p class="text-xs text-slate-600 break-words mt-1">{{ n.message }}</p>
                    <p class="text-xs text-slate-600 mt-1">{{ n.created_at }}</p>
                  </div>
                } @empty {
                  <div class="px-4 py-8 text-center text-slate-600 text-sm">Tiada notifikasi.</div>
                }
              </div>
            </section>
          }
        </div>

        <div class="text-right hidden sm:block">
          <p class="text-xs text-slate-600">Log masuk sebagai</p>
          <p class="text-sm font-semibold text-slate-700">{{ auth.currentUser?.email }}</p>
        </div>
        <button
          (click)="onLogout()"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-pahang-yellow text-pahang-black text-sm font-semibold rounded-lg hover:brightness-95 transition"
        >
          <span class="material-icons text-sm">logout</span>
          Log Keluar
        </button>
      </div>
    </header>
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeNotifications(true)',
  },
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() breadcrumb = 'Panel Pengurusan';
  @Input() title = '';
  @Input() subtitle = '';
  @Output() menuToggle = new EventEmitter<void>();

  notifications: NotificationEntry[] = [];
  unreadCount = 0;
  showNotifications = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private notificationButton = viewChild<ElementRef<HTMLButtonElement>>('notificationButton');

  constructor(
    public auth: AuthService,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.pollInterval = setInterval(() => this.loadNotifications(), 30000);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  loadNotifications(): void {
    this.api.get<NotificationResponse>('notifications.php').subscribe({
      next: (res) => {
        if (!res.error) {
          this.notifications = (res.data || res.notifications || []).slice(0, 10);
          this.unreadCount = res.unread_count || 0;
        }
      },
    });
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
  }

  closeNotifications(restoreFocus = false): void {
    if (!this.showNotifications) return;
    this.showNotifications = false;
    if (restoreFocus) this.notificationButton()?.nativeElement.focus();
  }

  markAllRead(): void {
    this.api.post<NotificationResponse>('notifications.php', { action: 'mark_all_read' }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.unreadCount = 0;
          this.notifications = this.notifications.map(n => ({ ...n, is_read: 1 }));
        }
      },
    });
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-notification-panel]')) this.closeNotifications();
  }

  onLogout(): void {
    this.auth.logout().subscribe();
  }
}
