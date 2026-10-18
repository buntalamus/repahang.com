import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { WebPushService } from '../../../core/services/web-push.service';

const DISMISS_KEY = 'refpahang.pwaPrompt.dismissedAt';
const DISMISS_DAYS = 7;

/**
 * Banner above each portal page that gets phones onto notifications:
 * iPhone Safari → add to Home Screen; Android → the native app;
 * installed app with notifications off → turn them on.
 */
@Component({
  selector: 'app-pwa-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (kind(); as kind) {
      <aside aria-label="Notifikasi telefon"
        class="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <span class="material-icons text-amber-800" aria-hidden="true">notifications_active</span>
        <div class="flex-1 min-w-0">
          @switch (kind) {
            @case ('ios') {
              <p class="font-semibold">Terima notifikasi lantikan terus di iPhone</p>
              <p class="mt-1">Tekan <strong>Kongsi</strong> di Safari, kemudian pilih <strong>Add to Home Screen</strong>.
                Buka RefPahang dari skrin utama untuk mengaktifkan notifikasi.</p>
            }
            @case ('android') {
              <p class="font-semibold">Guna app RefPahang untuk Android</p>
              <p class="mt-1">Notifikasi lantikan terus ke telefon.
                <a href="/app/refpahang.apk" class="font-semibold underline">Muat turun app</a></p>
            }
            @case ('enable') {
              <p class="font-semibold">Aktifkan notifikasi pada peranti ini</p>
              <p class="mt-1">Lantikan dan makluman baharu akan sampai walaupun portal ditutup.</p>
              @if (message()) { <p class="mt-1 text-amber-900" role="status">{{ message() }}</p> }
              <button type="button" (click)="enable()" [disabled]="push.busy()"
                class="mt-3 px-4 py-2 bg-pahang-black text-pahang-yellow font-semibold rounded-lg disabled:opacity-60">
                {{ push.busy() ? 'Mengaktifkan...' : 'Aktifkan Notifikasi' }}
              </button>
            }
          }
        </div>
        <button type="button" (click)="dismiss()" aria-label="Tutup makluman notifikasi"
          class="p-1 rounded hover:bg-amber-100">
          <span class="material-icons text-base" aria-hidden="true">close</span>
        </button>
      </aside>
    }
  `,
})
export class PwaPromptComponent {
  readonly push = inject(WebPushService);
  readonly message = signal('');
  private readonly dismissed = signal(this.wasDismissed());

  readonly kind = computed<'ios' | 'android' | 'enable' | null>(() => {
    if (this.dismissed()) return null;
    const state = this.push.state();
    if (state === 'needs-install') return 'ios';
    if (this.push.isAndroid && !this.push.isStandalone) return 'android';
    if (state === 'off' && (this.push.isStandalone || this.push.isIos)) return 'enable';
    return null;
  });

  async enable(): Promise<void> {
    this.message.set((await this.push.enable()) ?? '');
  }

  dismiss(): void {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private mode: hidden for this visit only.
    }
    this.dismissed.set(true);
  }

  private wasDismissed(): boolean {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
    } catch {
      return false;
    }
  }
}
