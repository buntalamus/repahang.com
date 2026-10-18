import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './core/services/auth.service';
import { WebPushService } from './core/services/web-push.service';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ProfilPengadilModalComponent } from './shared/components/profil-pengadil-modal/profil-pengadil-modal.component';

@Component({
  selector: 'app-root',
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
    const ready = this.webPush.init();
    inject(AuthService).currentUser$.pipe(takeUntilDestroyed()).subscribe((user) => {
      if (user) void ready.then(() => this.webPush.refresh(true));
    });
  }
}
