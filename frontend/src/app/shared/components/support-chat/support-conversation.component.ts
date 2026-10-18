import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ChatMessage, SupportChatService } from './support-chat.service';

@Component({
  selector: 'app-support-conversation',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './support-conversation.component.html',
  styleUrl: './support-conversation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportConversationComponent {
  readonly userId = input.required<number>();
  readonly admin = input(false);
  readonly changed = output<void>();
  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly hasOlder = signal(false);
  readonly loadingOlder = signal(false);
  readonly newMessages = signal(false);
  readonly draft = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] });
  private readonly service = inject(SupportChatService);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly log = viewChild<ElementRef<HTMLElement>>('messageLog');
  private readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composerInput');
  private epoch = 0;
  private reading = 0;
  private refreshing = false;
  private pending: { id: string; body: string } | null = null;

  constructor() {
    effect(onCleanup => {
      const owner = this.userId();
      this.epoch++;
      this.messages.set([]); this.hasOlder.set(false); this.error.set('');
      this.draft.reset(); this.draft.enable(); this.sending.set(false);
      this.reading = 0; this.pending = null; this.refreshing = false;
      this.loadingOlder.set(false);
      this.newMessages.set(false);
      untracked(() => this.load(owner, true));
      const refresh = () => { if (!document.hidden) this.load(owner); };
      const interval = setInterval(refresh, 8000);
      document.addEventListener('visibilitychange', refresh);
      onCleanup(() => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); });
    });
  }
  refresh(): void { this.load(this.userId(), this.messages().length === 0); }
  private load(owner: number, initial = false): void {
    if (this.refreshing || this.loadingOlder()) return;
    this.refreshing = true;
    const epoch = this.epoch;
    const latest = this.messages().at(-1)?.id;
    if (initial) this.loading.set(true);
    this.service.messages(owner, latest && !initial ? { after: String(latest) } : {})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => {
          if (epoch !== this.epoch) return;
          this.refreshing = false; this.loading.set(false);
          if (result.error) { this.error.set(result.message || 'Mesej tidak dapat dimuatkan.'); return; }
          const rows = result.data ?? [];
          const element = this.log()?.nativeElement;
          const nearBottom = !element || element.scrollHeight - element.scrollTop - element.clientHeight < 100;
          if (initial || !latest) this.hasOlder.set(!!result.has_more);
          this.merge(rows);
          if (rows.length && (initial || nearBottom)) this.scrollToBottom();
          if (initial || nearBottom) this.markRead(owner, this.messages().at(-1)?.id);
          else if (rows.length) this.newMessages.set(true);
          if (latest && result.has_more) this.load(owner);
        },
        error: () => {
          if (epoch !== this.epoch) return;
          this.refreshing = false; this.loading.set(false);
          this.error.set('Sambungan chat terganggu. Cuba muat semula.');
        },
      });
  }
  older(): void {
    const first = this.messages()[0]?.id;
    if (!first || this.loadingOlder() || this.refreshing) return;
    const epoch = this.epoch;
    this.loadingOlder.set(true);
    const element = this.log()?.nativeElement;
    const oldHeight = element?.scrollHeight ?? 0;
    this.service.messages(this.userId(), { before: String(first) }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => {
        if (epoch !== this.epoch) return;
        this.loadingOlder.set(false);
        if (result.error) { this.error.set(result.message || 'Mesej lama tidak dapat dimuatkan.'); return; }
        this.merge(result.data ?? []); this.hasOlder.set(!!result.has_more);
        afterNextRender(() => { if (element) element.scrollTop += element.scrollHeight - oldHeight; }, { injector: this.injector });
      },
      error: () => { if (epoch === this.epoch) { this.loadingOlder.set(false); this.error.set('Mesej lama tidak dapat dimuatkan.'); } },
    });
  }
  send(): void {
    const text = this.draft.value.trim();
    if (!text || text.length > 2000 || this.sending()) return;
    if (this.pending?.body !== text) this.pending = { id: crypto.randomUUID(), body: text };
    const owner = this.userId(); const epoch = this.epoch;
    this.sending.set(true); this.draft.disable(); this.error.set('');
    this.service.send(owner, text, this.pending.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => {
        if (epoch !== this.epoch) return;
        this.sending.set(false); this.draft.enable();
        this.focusComposer();
        if (result.error) { this.error.set(result.message || 'Mesej gagal dihantar.'); return; }
        this.draft.reset(); this.pending = null; this.changed.emit(); this.load(owner);
        this.scrollToBottom();
      },
      error: (error: HttpErrorResponse) => {
        if (epoch !== this.epoch) return;
        this.sending.set(false); this.draft.enable();
        this.focusComposer();
        this.error.set(error.error?.message || 'Mesej belum disahkan dihantar. Cuba hantar semula.');
      },
    });
  }
  private merge(rows: ChatMessage[]): void {
    this.messages.update(current => [...new Map([...current, ...rows].map(row => [row.id, row])).values()].sort((a, b) => a.id - b.id));
  }
  private markRead(owner: number, through?: number): void {
    if (!through || through <= this.reading || document.hidden) return;
    const epoch = this.epoch;
    this.reading = through;
    this.service.read(owner, through).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => { if (epoch === this.epoch && !result.error) this.changed.emit(); },
      error: () => { if (epoch === this.epoch) this.reading = 0; },
    });
  }
  private scrollToBottom(): void {
    afterNextRender(() => { const element = this.log()?.nativeElement; if (element) element.scrollTop = element.scrollHeight; }, { injector: this.injector });
  }
  jumpToLatest(): void { this.newMessages.set(false); this.scrollToBottom(); this.markRead(this.userId(), this.messages().at(-1)?.id); }
  onScroll(): void {
    const element = this.log()?.nativeElement;
    if (element && element.scrollHeight - element.scrollTop - element.clientHeight < 60) {
      this.newMessages.set(false); this.markRead(this.userId(), this.messages().at(-1)?.id);
    }
  }
  private focusComposer(): void { afterNextRender(() => this.composer()?.nativeElement.focus(), { injector: this.injector }); }
}
