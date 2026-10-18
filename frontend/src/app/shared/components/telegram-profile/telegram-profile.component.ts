import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../core/services/api.service';
@Component({
  selector: 'app-telegram-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section
    id="telegram"
    aria-labelledby="telegram-profile-title"
    class="bg-white border border-slate-200 rounded-xl p-6"
  >
    <h3
      id="telegram-profile-title"
      class="text-sm font-semibold text-slate-900 border-l-4 border-pahang-yellow pl-3 mb-4"
    >
      Pemautan Telegram
    </h3>
    <div role="status">
      @if (status() === 1) {
        <p class="font-semibold text-emerald-800">Telegram berjaya dipaut.</p>
      } @else if (status() === 0) {
        <p class="font-semibold text-slate-900">Telegram belum dipaut.</p>
        <p class="text-sm text-slate-700 mt-1">
          Buka pautan Telegram dan tekan Mula / Start dalam bot. Status akan disemak semula apabila
          anda kembali ke portal.
        </p>
      } @else {
        <p class="text-sm text-slate-700">Status Telegram belum dapat disahkan.</p>
      }
      @if (error()) {
        <p class="text-sm text-amber-900 mt-2">{{ error() }}</p>
      }
    </div>
    <div class="flex flex-wrap gap-3 mt-4">
      @if (status() === 0) {
        <button
          type="button"
          (click)="connect()"
          [disabled]="connecting()"
          class="px-4 py-2.5 bg-pahang-yellow text-pahang-black font-semibold text-sm rounded-lg disabled:opacity-50"
        >
          {{ connecting() ? 'Mendapatkan pautan...' : 'Hubungkan Telegram' }}
        </button>
      }
      <button
        type="button"
        (click)="refresh()"
        [disabled]="checking()"
        class="px-4 py-2.5 border border-slate-300 text-slate-800 font-semibold text-sm rounded-lg disabled:opacity-50"
      >
        {{ checking() ? 'Menyemak...' : 'Semak Status Pemautan' }}
      </button>
    </div>
  </section>`,
})
export class TelegramProfileComponent {
  readonly linked = input<number | null>(null);
  private readonly checked = signal<number | null>(null);
  readonly status = computed(() => this.checked() ?? this.linked());
  readonly checking = signal(false);
  readonly connecting = signal(false);
  readonly error = signal('');
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    const refresh = () => {
      if (!document.hidden) this.refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    });
  }
  refresh(): void {
    if (this.checking()) return;
    this.checking.set(true);
    this.api
      .get<{ error: boolean; user?: { telegram_linked: number } }>(
        'get-user-profile.php',
        undefined,
        { background: true },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.checking.set(false);
          if (res.error || (res.user?.telegram_linked !== 0 && res.user?.telegram_linked !== 1)) {
            this.error.set('Status tidak dapat disemak. Sila cuba semula.');
            return;
          }
          this.checked.set(res.user.telegram_linked);
          this.error.set('');
        },
        error: () => {
          this.checking.set(false);
          this.error.set('Status tidak dapat disemak. Sila cuba semula.');
        },
      });
  }
  connect(): void {
    this.connecting.set(true);
    this.error.set('');
    this.api
      .post<{ error: boolean; linked?: boolean; link_url?: string; message?: string }>(
        'telegram-link-self.php',
        {},
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.connecting.set(false);
          if (!res.error && res.linked) {
            this.refresh();
            return;
          }
          if (!res.error && res.link_url) {
            window.location.href = res.link_url;
            return;
          }
          this.error.set(res.message || 'Pautan Telegram tidak tersedia. Sila cuba semula.');
        },
        error: () => {
          this.connecting.set(false);
          this.error.set('Pautan Telegram tidak tersedia. Sila cuba semula.');
        },
      });
  }
}
