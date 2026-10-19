import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './core/services/auth.service';
import { WebPushService } from './core/services/web-push.service';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ProfilPengadilModalComponent } from './shared/components/profil-pengadil-modal/profil-pengadil-modal.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastComponent, ProfilPengadilModalComponent],
  template: `
    <router-outlet />
    <app-toast />
    <app-profil-pengadil-modal />
  `,
})
export class App {
  private readonly webPush = inject(WebPushService);

  constructor() {
    // Register the service worker, then re-send this device's subscription
    // whenever someone signs in, so pushes follow the current account.
    const auth = inject(AuthService);
    const http = inject(HttpClient);
    const document = inject(DOCUMENT);
    let lastSent = 0;
    let lastUserId: number | undefined;
    const activity = () => {
      if (document.hidden || !auth.currentUser) return;
      if (lastUserId === auth.currentUser.id && Date.now() - lastSent < 300000) return;
      lastUserId = auth.currentUser.id;
      lastSent = Date.now();
      // Only real interaction extends inactivity, never notification polling.
      http.post('/api/account-activity.php', {}, { withCredentials: true }).subscribe({ error: () => { lastSent = 0; } });
    };
    document.addEventListener('pointerdown', activity, { passive: true });
    document.addEventListener('keydown', activity, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('pointerdown', activity);
      document.removeEventListener('keydown', activity);
    });
    const ready = this.webPush.init();
    inject(AuthService).currentUser$.pipe(takeUntilDestroyed()).subscribe((user) => {
      if (user) void ready.then(() => this.webPush.refresh(true));
    });
  }
}
