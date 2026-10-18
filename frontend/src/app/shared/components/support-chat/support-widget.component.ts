import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { SupportChatService } from './support-chat.service';
import { SupportConversationComponent } from './support-conversation.component';

@Component({
  selector: 'app-support-widget',
  imports: [RouterLink, SupportConversationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)' },
  template: `
    @if (eligible() && !inboxOpen()) {
      @if (user()?.role === 'Admin') {
        <a routerLink="/admin/chat" class="launcher" aria-label="Buka chat pengguna">
          <span class="material-icons" aria-hidden="true">forum</span> Chat Pengguna
          @if (unread()) { <span class="badge" aria-label="mesej belum dibaca">{{ unread() > 99 ? '99+' : unread() }}</span> }
        </a>
      } @else {
        <button #launcher type="button" class="launcher" (click)="toggle()" [attr.aria-expanded]="open()" [attr.aria-controls]="open() ? 'support-panel' : null">
          <span class="material-icons" aria-hidden="true">chat_bubble_outline</span> Hubungi Admin
          @if (unread()) { <span class="badge" aria-label="balasan belum dibaca">{{ unread() > 99 ? '99+' : unread() }}</span> }
        </button>
        @if (open()) {
          <section id="support-panel" class="chat-panel" aria-labelledby="support-title" (keydown.escape)="close()">
            <header>
              <div><h2 id="support-title">Hubungi Admin</h2><p>Balasan Admin akan dipaparkan di sini.</p></div>
              <button #closeButton type="button" (click)="close()" aria-label="Tutup chat"><span class="material-icons" aria-hidden="true">close</span></button>
            </header>
            @defer (when open()) {
              <app-support-conversation [userId]="user()!.id" (changed)="refresh()" />
            }
          </section>
        }
      }
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    :host:empty { display: none; }
    .launcher { display: flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: .55rem .75rem; background: var(--color-pahang-black); color: var(--color-pahang-yellow); border-radius: .65rem; border: 1px solid var(--color-pahang-yellow); font-size: .8125rem; font-weight: 600; cursor: pointer; }
    .badge { border-radius: 1rem; background: var(--color-pahang-yellow); color: var(--color-pahang-black); padding: .1rem .4rem; font-size: .75rem; }
    .chat-panel { position: fixed; z-index: 40; right: max(1rem, env(safe-area-inset-right)); bottom: max(1rem, env(safe-area-inset-bottom)); width: min(25rem, calc(100vw - 2rem)); height: min(38rem, calc(100dvh - 2rem - env(safe-area-inset-bottom))); display: flex; flex-direction: column; background: white; border: 1px solid #cbd5e1; border-radius: 1rem; overflow: hidden; box-shadow: 0 8px 32px #0003; }
    header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .85rem 1rem; background: var(--color-pahang-black); color: var(--color-pahang-yellow); border-top: 4px solid var(--color-pahang-yellow); }
    h2 { font-weight: 700; font-size: 1rem; } header p { color: #e5e7eb; font-size: .75rem; margin-top: .2rem; } header button { padding: .35rem; border-radius: .4rem; cursor: pointer; }
    header button:focus-visible { outline: 3px solid var(--color-pahang-yellow); outline-offset: 2px; }
    :is(button,a):focus-visible { outline: 3px solid #8b7900; outline-offset: 3px; }
  `,
})
export class SupportWidgetComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly service = inject(SupportChatService);
  private readonly destroy = inject(DestroyRef);
  readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });
  readonly inboxOpen = toSignal(this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map(event => event.urlAfterRedirects.split('?')[0] === '/admin/chat'),
  ), { initialValue: this.router.url.split('?')[0] === '/admin/chat' });
  readonly eligible = computed(() => {
    const user = this.user();
    return !!user && (['Admin', 'Pengadil', 'Penilai'].includes(user.role) ||
      (user.role === 'PP Daerah' && (user.can_referee === 1 || user.can_ra === 1)));
  });
  readonly open = signal(false);
  readonly unread = signal(0);
  private checking = false;
  private readonly launcher = viewChild<ElementRef<HTMLButtonElement>>('launcher');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroy))
      .subscribe(() => { if (this.open()) this.close(false); });
    effect(onCleanup => {
      if (!this.eligible() || this.inboxOpen()) return;
      untracked(() => this.refresh());
      const refresh = () => { if (!document.hidden) this.refresh(); };
      const interval = setInterval(refresh, 45000);
      document.addEventListener('visibilitychange', refresh);
      onCleanup(() => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); });
    });
  }
  refresh(): void {
    if (this.checking || document.hidden) return;
    this.checking = true;
    this.service.summary().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => { this.checking = false; if (!result.error) this.unread.set(result.unread_count); },
      error: () => { this.checking = false; },
    });
  }
  toggle(): void {
    if (this.open()) { this.close(); return; }
    this.open.set(true);
    afterNextRender(() => this.closeButton()?.nativeElement.focus(), { injector: this.injector });
  }
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && event.target instanceof Node && !this.element.nativeElement.contains(event.target)) this.close(false);
  }
  close(restoreFocus = true): void { this.open.set(false); if (restoreFocus) this.launcher()?.nativeElement.focus(); this.refresh(); }
}
