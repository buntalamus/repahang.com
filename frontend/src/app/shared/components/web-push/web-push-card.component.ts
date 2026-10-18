import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { WebPushService } from '../../../core/services/web-push.service';

/** Profile card: turn phone notifications on or off for this device. */
@Component({
  selector: 'app-web-push-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section
    aria-labelledby="web-push-title"
    class="bg-white border border-slate-200 rounded-xl p-6"
  >
    <h3 id="web-push-title" class="text-sm font-semibold text-slate-900 border-l-4 border-pahang-yellow pl-3 mb-4">
      Notifikasi Telefon
    </h3>
    <div role="status">
      @switch (push.state()) {
        @case ('on') {
          <p class="font-semibold text-emerald-800">Notifikasi aktif pada peranti ini.</p>
          <p class="text-sm text-slate-700 mt-1">Lantikan dan makluman baharu akan dihantar terus ke peranti ini.</p>
        }
        @case ('off') {
          <p class="font-semibold text-slate-900">Notifikasi belum diaktifkan pada peranti ini.</p>
          <p class="text-sm text-slate-700 mt-1">Aktifkan untuk menerima lantikan terus walaupun portal ditutup.</p>
        }
        @case ('needs-install') {
          <p class="font-semibold text-slate-900">Pasang portal ke skrin utama iPhone dahulu.</p>
          <ol class="text-sm text-slate-700 mt-2 list-decimal list-inside space-y-1">
            <li>Buka refpahang.com dalam <strong>Safari</strong>.</li>
            <li>Tekan butang <strong>Kongsi</strong> (kotak dengan anak panah ke atas).</li>
            <li>Pilih <strong>Add to Home Screen</strong> / <strong>Tambah ke Skrin Utama</strong>.</li>
            <li>Buka RefPahang dari skrin utama, kemudian aktifkan notifikasi di sini.</li>
          </ol>
          <p class="text-xs text-slate-600 mt-2">Memerlukan iOS 16.4 atau lebih baharu.</p>
        }
        @case ('denied') {
          <p class="font-semibold text-slate-900">Notifikasi disekat untuk portal ini.</p>
          <p class="text-sm text-slate-700 mt-1">
            Benarkan semula dalam Tetapan peranti (iPhone: Tetapan → Pemberitahuan → RefPahang).
          </p>
        }
        @case ('disabled') {
          <p class="text-sm text-slate-700">Notifikasi telefon belum tersedia. Sila cuba lagi kemudian.</p>
        }
        @default {
          <p class="text-sm text-slate-700">Pelayar ini tidak menyokong notifikasi. Gunakan app Android atau iPhone (iOS 16.4+).</p>
        }
      }
      @if (message()) {
        <p class="text-sm text-amber-900 mt-2">{{ message() }}</p>
      }
    </div>
    @if (push.state() === 'off' || push.state() === 'on') {
      <div class="flex flex-wrap gap-3 mt-4">
        @if (push.state() === 'off') {
          <button type="button" (click)="enable()" [disabled]="push.busy()"
            class="px-4 py-2.5 bg-pahang-yellow text-pahang-black font-semibold text-sm rounded-lg disabled:opacity-50">
            {{ push.busy() ? 'Mengaktifkan...' : 'Aktifkan Notifikasi' }}
          </button>
        } @else {
          <button type="button" (click)="disable()" [disabled]="push.busy()"
            class="px-4 py-2.5 border border-slate-300 text-slate-800 font-semibold text-sm rounded-lg disabled:opacity-50">
            Matikan pada peranti ini
          </button>
        }
      </div>
    }
  </section>`,
})
export class WebPushCardComponent {
  readonly push = inject(WebPushService);
  readonly message = signal('');

  async enable(): Promise<void> {
    this.message.set((await this.push.enable()) ?? '');
  }

  async disable(): Promise<void> {
    this.message.set('');
    await this.push.disable();
  }
}
