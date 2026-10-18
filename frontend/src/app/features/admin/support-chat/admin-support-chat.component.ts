import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatThread, SupportChatService } from '../../../shared/components/support-chat/support-chat.service';
import { SupportConversationComponent } from '../../../shared/components/support-chat/support-conversation.component';

@Component({
  selector: 'app-admin-support-chat',
  imports: [ReactiveFormsModule, SupportConversationComponent],
  templateUrl: './admin-support-chat.component.html',
  styleUrl: './admin-support-chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSupportChatComponent {
  private readonly service = inject(SupportChatService);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('conversationHeading');
  private readonly list = viewChild<ElementRef<HTMLElement>>('threadList');
  readonly threads = signal<ChatThread[]>([]);
  readonly selected = signal<ChatThread | null>(null);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = new FormControl('', { nonNullable: true });
  private activeSearch = '';
  private generation = 0;
  private fetching = false;
  constructor() {
    this.load();
    const refresh = () => { if (!document.hidden) this.load(); };
    const interval = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    this.destroy.onDestroy(() => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); });
  }
  find(): void { this.activeSearch = this.search.value.trim(); this.page.set(1); this.generation++; this.fetching = false; this.load(); }
  turnPage(delta: number): void { this.page.update(page => page + delta); this.generation++; this.fetching = false; this.load(); }
  load(): void {
    if (this.fetching) return;
    this.fetching = true; this.loading.set(true);
    const generation = this.generation;
    this.service.threads(this.page(), this.activeSearch).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => {
        if (generation !== this.generation) return;
        this.fetching = false; this.loading.set(false);
        if (result.error) { this.error.set('Perbualan tidak dapat dimuatkan.'); return; }
        this.error.set(''); this.threads.set(result.data); this.total.set(result.total);
      },
      error: () => { if (generation === this.generation) { this.fetching = false; this.loading.set(false); this.error.set('Perbualan tidak dapat dimuatkan. Cuba muat semula.'); } },
    });
  }
  roleLabel(role: string): string { return role === 'Penilai' ? 'Penilai Pengadil' : role; }
  select(thread: ChatThread): void {
    this.selected.set(thread);
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }
  back(): void {
    this.selected.set(null);
    afterNextRender(() => this.list()?.nativeElement.focus(), { injector: this.injector });
  }
}
