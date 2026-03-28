import { Component, Output, EventEmitter, Input, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 bg-white border-b border-slate-200">
      <div class="flex items-center gap-4">
        <button
          (click)="menuToggle.emit()"
          class="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition"
        >
          <span class="material-icons">menu</span>
        </button>
        <div>
          <p class="text-sm uppercase tracking-[0.4rem] text-slate-400">{{ breadcrumb }}</p>
          <h2 class="text-2xl font-bold text-slate-900">{{ title }}</h2>
          @if (subtitle) {
            <p class="text-sm text-slate-500 mt-1">{{ subtitle }}</p>
          }
        </div>
      </div>
      <div class="flex items-center space-x-4">
        <!-- Notification Bell -->
        <div class="relative">
          <button (click)="toggleNotifications()" class="relative p-2 rounded-lg hover:bg-slate-100 transition">
            <span class="material-icons text-slate-600">notifications</span>
            @if (unreadCount > 0) {
              <span class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {{ unreadCount > 9 ? '9+' : unreadCount }}
              </span>
            }
          </button>
          @if (showNotifications) {
            <div class="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
              <div class="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
                <h4 class="font-semibold text-sm">Notifikasi</h4>
                @if (unreadCount > 0) {
                  <button (click)="markAllRead()" class="text-xs text-pahang-yellow hover:underline font-medium">Tandai semua dibaca</button>
                }
              </div>
              <div class="max-h-72 overflow-y-auto">
                @for (n of notifications; track n.id) {
                  <div class="px-4 py-3 border-b last:border-0 hover:bg-slate-50 transition"
                    [class.bg-blue-50]="!n.is_read">
                    <p class="text-sm font-medium text-slate-800">{{ n.title || n.message }}</p>
                    <p class="text-xs text-slate-400 mt-1">{{ n.created_at }}</p>
                  </div>
                } @empty {
                  <div class="px-4 py-8 text-center text-slate-400 text-sm">Tiada notifikasi.</div>
                }
              </div>
            </div>
          }
        </div>

        <div class="text-right hidden sm:block">
          <p class="text-xs text-slate-400">Log masuk sebagai</p>
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
  },
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() breadcrumb = 'Panel Pengurusan';
  @Input() title = '';
  @Input() subtitle = '';
  @Output() menuToggle = new EventEmitter<void>();

  notifications: any[] = [];
  unreadCount = 0;
  showNotifications = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

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
    this.api.get<any>('notifications.php').subscribe({
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

  markAllRead(): void {
    this.api.post<any>('notifications.php', { action: 'mark_all_read' }).subscribe({
      next: (res) => {
        if (!res.error) {
          this.unreadCount = 0;
          this.notifications = this.notifications.map((n: any) => ({ ...n, is_read: 1 }));
        }
      },
    });
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.showNotifications = false;
    }
  }

  onLogout(): void {
    this.auth.logout().subscribe();
  }
}
