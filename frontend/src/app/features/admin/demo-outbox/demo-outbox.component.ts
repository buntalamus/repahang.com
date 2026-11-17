import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../../../core/services/api.service';

interface OutboxRow {
  id: number;
  channel: 'email' | 'telegram';
  recipient: string;
  subject: string;
  body: string;
  created_at: string;
}

/** demo.refpahang.com: email and Telegram the demo kept from fictional people (demo_outbox). */
@Component({
  selector: 'app-demo-outbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
      Mesej yang sepatutnya dihantar kepada orang rekaan dalam demo disimpan di sini dan tidak dihantar.
      Pautan dalam emel (contohnya pengesahan laporan oleh Pengerusi) boleh diklik untuk mencuba aliran penuh.
    </div>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      @for (option of channels; track option.value) {
        <button type="button" (click)="setChannel(option.value)"
          class="min-h-10 rounded-lg px-3 text-sm font-medium"
          [class]="channel() === option.value ? 'bg-pahang-black text-pahang-yellow' : 'bg-white text-slate-700 ring-1 ring-slate-200'">
          {{ option.label }}
        </button>
      }
      <input type="search" [(ngModel)]="query" (keyup.enter)="load(1)" placeholder="Cari penerima atau subjek"
        aria-label="Cari mesej" class="min-h-10 flex-1 min-w-48 rounded-lg border border-slate-300 px-3 text-sm" />
      <button type="button" (click)="load(1)" class="min-h-10 rounded-lg bg-white px-3 text-sm ring-1 ring-slate-200">Muat semula</button>
    </div>
    <p class="mb-2 text-xs text-slate-500">{{ total() }} mesej</p>
    <div class="space-y-2">
      @for (row of rows(); track row.id) {
        <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <button type="button" (click)="toggle(row.id)" class="flex w-full items-start gap-3 p-4 text-left" [attr.aria-expanded]="open() === row.id">
            <span class="mt-0.5 rounded px-2 py-0.5 text-[11px] font-bold uppercase"
              [class]="row.channel === 'email' ? 'bg-blue-100 text-blue-800' : 'bg-sky-100 text-sky-800'">{{ row.channel }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-slate-900">{{ row.subject || '(tiada subjek)' }}</span>
              <span class="block truncate text-xs text-slate-500">{{ row.recipient }} · {{ row.created_at }}</span>
            </span>
          </button>
          @if (open() === row.id) {
            <iframe [srcdoc]="preview(row)" title="Kandungan mesej" sandbox="allow-popups allow-popups-to-escape-sandbox"
              class="h-[480px] w-full rounded-b-xl border-t border-slate-200 bg-white"></iframe>
          }
        </div>
      } @empty {
        <div class="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">Tiada mesej.</div>
      }
    </div>
    @if (total() > perPage) {
      <div class="mt-4 flex items-center justify-center gap-3 text-sm">
        <button type="button" (click)="load(page() - 1)" [disabled]="page() <= 1" class="min-h-10 rounded-lg px-3 ring-1 ring-slate-200 disabled:opacity-40">Sebelum</button>
        <span>Halaman {{ page() }}</span>
        <button type="button" (click)="load(page() + 1)" [disabled]="page() * perPage >= total()" class="min-h-10 rounded-lg px-3 ring-1 ring-slate-200 disabled:opacity-40">Seterusnya</button>
      </div>
    }
  `,
})
export class DemoOutboxComponent {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly channels = [{ value: '', label: 'Semua' }, { value: 'email', label: 'Emel' }, { value: 'telegram', label: 'Telegram' }];
  readonly rows = signal<OutboxRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly channel = signal('');
  readonly open = signal<number | null>(null);
  readonly perPage = 50;
  query = '';
  private readonly previews = new Map<number, SafeHtml>();

  constructor() {
    this.load(1);
  }

  setChannel(value: string): void {
    this.channel.set(value);
    this.load(1);
  }

  load(page: number): void {
    const params: Record<string, string> = { page: String(page) };
    if (this.channel()) params['channel'] = this.channel();
    if (this.query.trim()) params['q'] = this.query.trim();
    this.api.get<{ data: OutboxRow[]; total: number; page: number }>('admin-demo-outbox.php', params).subscribe({
      next: (res) => {
        this.rows.set(res.data ?? []);
        this.total.set(Number(res.total ?? 0));
        this.page.set(Number(res.page ?? page));
      },
    });
  }

  toggle(id: number): void {
    this.open.set(this.open() === id ? null : id);
  }

  /** Scripts never run in the sandboxed frame; links open in a new tab. */
  preview(row: OutboxRow): SafeHtml {
    let html = this.previews.get(row.id);
    if (!html) {
      const body = row.channel === 'telegram'
        ? `<pre style="white-space:pre-wrap;font:14px/1.5 system-ui,sans-serif;margin:16px">${row.body.replace(/\n/g, '<br>')}</pre>`
        : row.body;
      html = this.sanitizer.bypassSecurityTrustHtml(`<base target="_blank">${body}`);
      this.previews.set(row.id, html);
    }
    return html;
  }
}
