import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

type MailSummary = {
  id: string; sender: string; recipient: string; subject: string; received_at: string;
  read_at: string | null; delivery_status: string;
};
type MailDetail = MailSummary & {
  mailbox: string; folder: string; reply_address: string; text: string;
  attachments: { filename: string; mimeType: string; size: number }[];
};
type ApiResult<T> = { error: boolean; message?: string; data: T; total?: number; page?: number };

@Component({
  selector: 'app-admin-mailbox',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="max-w-6xl mx-auto space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Peti Emel RefPahang</h1>
          <p class="text-sm text-slate-500">Emel masuk dan dihantar disimpan dalam Cloudflare.</p>
        </div>
        <button type="button" (click)="newMessage()" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Tulis emel</button>
      </div>
      <div class="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <label class="text-sm font-medium text-slate-700">Alamat
          <select class="mt-1 block rounded-lg border px-3 py-2" [(ngModel)]="mailbox" (ngModelChange)="refresh()">
            @for (address of mailboxes; track address) { <option [value]="address">{{ address }}</option> }
          </select>
        </label>
        <label class="text-sm font-medium text-slate-700">Folder
          <select class="mt-1 block rounded-lg border px-3 py-2" [(ngModel)]="folder" (ngModelChange)="refresh()">
            <option value="inbox">Peti Masuk</option><option value="sent">Dihantar</option>
          </select>
        </label>
        <button type="button" (click)="refresh()" class="self-end rounded-lg border px-4 py-2 text-sm">Muat semula</button>
      </div>
      @if (error) { <p role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ error }}</p> }
      @if (notice) { <p role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-700">{{ notice }}</p> }
      <div class="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
        <div class="rounded-xl border bg-white overflow-hidden">
          <div class="border-b px-4 py-3 text-sm font-semibold">{{ folder === 'inbox' ? 'Peti Masuk' : 'Dihantar' }} · {{ total }}</div>
          @if (loading) { <p class="p-5 text-sm text-slate-500">Memuatkan emel...</p> }
          @for (mail of messages; track mail.id) {
            <button type="button" (click)="open(mail.id)" class="block w-full border-b px-4 py-3 text-left hover:bg-slate-50" [class.bg-yellow-50]="selected?.id === mail.id">
              <span class="block truncate text-sm" [class.font-bold]="!mail.read_at">{{ folder === 'inbox' ? mail.sender : mail.recipient }}</span>
              <span class="block truncate text-sm text-slate-700">{{ mail.subject }}</span>
              <span class="text-xs text-slate-500">{{ formatDate(mail.received_at) }} @if (mail.delivery_status === 'failed') { · Gagal dihantar } @if (mail.delivery_status === 'processing') { · Status belum pasti }</span>
            </button>
          } @empty {
            @if (!loading) { <p class="p-5 text-sm text-slate-500">Belum ada emel dalam folder ini.</p> }
          }
          <div class="flex items-center justify-between px-4 py-3 text-xs">
            <button type="button" (click)="changePage(-1)" [disabled]="page <= 1" class="disabled:opacity-40">Sebelumnya</button>
            <span>Halaman {{ page }}</span>
            <button type="button" (click)="changePage(1)" [disabled]="page * 50 >= total" class="disabled:opacity-40">Seterusnya</button>
          </div>
        </div>
        <div class="rounded-xl border bg-white p-5 min-h-80">
          @if (composing) {
            <h2 class="mb-4 text-lg font-semibold">Tulis emel</h2>
            <form (ngSubmit)="send()" class="space-y-3">
              <label class="block text-sm">Daripada
                <select name="from" [(ngModel)]="draft.from" class="mt-1 w-full rounded-lg border px-3 py-2">
                  @for (address of mailboxes; track address) { <option [value]="address">{{ address }}</option> }
                </select>
              </label>
              <label class="block text-sm">Kepada <input name="to" [(ngModel)]="draft.to" type="email" required class="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label class="block text-sm">Tajuk <input name="subject" [(ngModel)]="draft.subject" required maxlength="250" class="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label class="block text-sm">Mesej <textarea name="text" [(ngModel)]="draft.text" required maxlength="12000" rows="12" class="mt-1 w-full rounded-lg border px-3 py-2"></textarea></label>
              <p class="text-xs text-slate-500">Penghantaran memerlukan suis emel diaktifkan. Balasan disimpan dalam folder Dihantar.</p>
              <div class="flex gap-2">
                <button type="submit" [disabled]="sending" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{{ sending ? 'Menghantar...' : 'Hantar' }}</button>
                <button type="button" (click)="composing = false" class="rounded-lg border px-4 py-2 text-sm">Batal</button>
              </div>
            </form>
          } @else if (selected) {
            <h2 class="break-words text-lg font-semibold">{{ selected.subject }}</h2>
            <dl class="mt-3 space-y-1 border-b pb-4 text-sm text-slate-600">
              <div><dt class="inline font-semibold">Daripada: </dt><dd class="inline break-all">{{ selected.sender }}</dd></div>
              <div><dt class="inline font-semibold">Kepada: </dt><dd class="inline break-all">{{ selected.recipient }}</dd></div>
              <div><dt class="inline font-semibold">Tarikh: </dt><dd class="inline">{{ formatDate(selected.received_at) }}</dd></div>
            </dl>
            <pre class="my-5 whitespace-pre-wrap break-words font-sans text-sm text-slate-800">{{ selected.text || '(Tiada teks biasa; muat turun fail EML untuk kandungan penuh.)' }}</pre>
            @if (selected.attachments.length) {
              <p class="text-sm font-semibold">Lampiran</p>
              <ul class="list-disc pl-5 text-sm text-slate-600">
                @for (attachment of selected.attachments; track $index) { <li>{{ attachment.filename }} ({{ attachment.size }} bait)</li> }
              </ul>
            }
            <div class="mt-5 flex flex-wrap gap-2">
              <a [href]="downloadUrl(selected.id)" class="rounded-lg border px-4 py-2 text-sm">Muat turun EML termasuk lampiran</a>
              @if (selected.folder === 'inbox' && selected.reply_address) { <button type="button" (click)="reply()" class="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Balas</button> }
            </div>
          } @else {
            <p class="text-sm text-slate-500">Pilih emel untuk membaca kandungannya.</p>
          }
        </div>
      </div>
    </section>
  `,
})
export class AdminMailboxComponent implements OnInit {
  readonly mailboxes = ['admin', 'daftar', 'lantikan', 'support', 'pengesahan'].map((name) => `${name}@refpahang.com`);
  mailbox = 'daftar@refpahang.com';
  folder = 'inbox';
  messages: MailSummary[] = [];
  selected: MailDetail | null = null;
  total = 0;
  page = 1;
  loading = false;
  sending = false;
  composing = false;
  error = '';
  notice = '';
  draft = { from: this.mailbox, to: '', subject: '', text: '', request_id: '' };

  constructor(private readonly api: ApiService) {}
  ngOnInit(): void { this.refresh(); }
  formatDate(value: string): string { return value ? new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z')).toLocaleString('ms-MY') : ''; }
  downloadUrl(id: string): string { return `/api/admin-mailbox.php?id=${encodeURIComponent(id)}&download=1`; }
  refresh(): void {
    this.error = ''; this.selected = null; this.loading = true;
    this.api.get<ApiResult<MailSummary[]>>('admin-mailbox.php', { mailbox: this.mailbox, folder: this.folder, page: String(this.page) }).subscribe({
      next: (result) => { this.messages = result.data || []; this.total = result.total || 0; this.loading = false; },
      error: () => { this.error = 'Peti emel belum tersedia atau sesi telah tamat.'; this.loading = false; },
    });
  }
  changePage(delta: number): void { this.page += delta; this.refresh(); }
  open(id: string): void {
    this.error = ''; this.composing = false;
    this.api.get<ApiResult<MailDetail>>('admin-mailbox.php', { id }).subscribe({
      next: (result) => { this.selected = result.data; const row = this.messages.find((mail) => mail.id === id); if (row) row.read_at = new Date().toISOString(); },
      error: () => { this.error = 'Emel tidak dapat dibuka.'; },
    });
  }
  newMessage(): void {
    this.error = ''; this.notice = ''; this.composing = true;
    this.draft = { from: this.mailbox, to: '', subject: '', text: '', request_id: crypto.randomUUID() };
  }
  reply(): void {
    const mail = this.selected;
    if (!mail) return;
    this.newMessage();
    this.draft.from = mail.mailbox;
    this.draft.to = mail.reply_address;
    this.draft.subject = mail.subject.toLowerCase().startsWith('re:') ? mail.subject : `Re: ${mail.subject}`;
  }
  send(): void {
    if (this.sending) return;
    this.error = ''; this.notice = ''; this.sending = true;
    this.api.post<ApiResult<{ id: string; delivery_status: string }>>('admin-mailbox.php', this.draft).subscribe({
      next: (result) => {
        this.sending = false;
        if (result.data.delivery_status !== 'sent') { this.error = 'Status penghantaran belum pasti. Semak folder Dihantar sebelum mencuba lagi.'; return; }
        this.notice = 'Emel diterima oleh perkhidmatan penghantaran.';
        this.composing = false; this.folder = 'sent'; this.mailbox = this.draft.from; this.page = 1; this.refresh();
      },
      error: () => { this.sending = false; this.error = 'Penghantaran gagal atau status belum pasti. Semak folder Dihantar sebelum mencuba lagi.'; },
    });
  }
}
