import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

/** Where this browser stands for phone notifications. */
export type WebPushState =
  | 'unsupported' // no Push API at all
  | 'needs-install' // iPhone/iPad Safari: must be added to the Home Screen first
  | 'disabled' // the server has no VAPID keys yet
  | 'denied' // the user blocked notifications in settings
  | 'off' // supported, not subscribed
  | 'on'; // subscribed on this device

interface KeyResponse { public_key: string | null }

/**
 * Web Push for the portal installed as an app (iPhone 16.4+ Home Screen app,
 * Android/desktop browsers). The service worker (/sw.js) shows the
 * notifications; this service keeps the subscription in step with the
 * signed-in user.
 */
@Injectable({ providedIn: 'root' })
export class WebPushService {
  private readonly api = inject(ApiService);
  private registration: ServiceWorkerRegistration | null = null;
  private publicKey: string | null | undefined;

  readonly state = signal<WebPushState>('unsupported');
  readonly busy = signal(false);
  readonly enabled = computed(() => this.state() === 'on');

  readonly isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  readonly isAndroid = /Android/i.test(navigator.userAgent);
  readonly isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;

  private get pushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** Registers the service worker; call once at startup. */
  async init(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      this.state.set('unsupported');
      return;
    }
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch {
      this.registration = null;
    }
    await this.refresh();
  }

  /** Re-reads the state and re-sends an existing subscription for the signed-in user. */
  async refresh(syncWithServer = false): Promise<void> {
    if (!this.pushSupported || !this.registration) {
      this.state.set(this.isIos && !this.isStandalone ? 'needs-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      this.state.set('denied');
      return;
    }
    const key = await this.key();
    if (!key) {
      this.state.set('disabled');
      return;
    }
    const subscription = await this.registration.pushManager.getSubscription();
    if (subscription && syncWithServer) {
      try {
        await firstValueFrom(this.api.post('webpush-subscribe.php', subscription.toJSON()));
      } catch {
        // Kept locally; the next refresh retries.
      }
    }
    this.state.set(subscription ? 'on' : 'off');
  }

  /** Must run from a tap: iOS only shows the permission prompt for a user gesture. */
  async enable(): Promise<string | null> {
    if (!this.registration) return 'Pelayar ini tidak menyokong notifikasi.';
    this.busy.set(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.state.set(permission === 'denied' ? 'denied' : 'off');
        return 'Kebenaran notifikasi tidak diberikan.';
      }
      const key = await this.key();
      if (!key) {
        this.state.set('disabled');
        return 'Notifikasi belum diaktifkan oleh pentadbir.';
      }
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToBytes(key),
      });
      await firstValueFrom(this.api.post('webpush-subscribe.php', subscription.toJSON()));
      this.state.set('on');
      return null;
    } catch {
      return 'Notifikasi tidak dapat diaktifkan. Sila cuba lagi.';
    } finally {
      this.busy.set(false);
    }
  }

  /** Stops notifications on this device (also used before logout). */
  async disable(): Promise<void> {
    const subscription = await this.registration?.pushManager.getSubscription();
    if (!subscription) {
      if (this.state() === 'on') this.state.set('off');
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.delete('webpush-subscribe.php', { endpoint: subscription.endpoint }));
    } catch {
      // The browser subscription is dropped below either way.
    }
    try {
      await subscription.unsubscribe();
    } finally {
      this.state.set('off');
      this.busy.set(false);
    }
  }

  private async key(): Promise<string | null> {
    if (this.publicKey !== undefined) return this.publicKey;
    try {
      const res = await firstValueFrom(this.api.get<KeyResponse>('webpush-key.php', undefined, { background: true }));
      this.publicKey = res.public_key ?? null;
    } catch {
      return null;
    }
    return this.publicKey;
  }

  private urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  }
}
