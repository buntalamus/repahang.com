import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

type MailSummary = {
  id: string; sender: string; recipient: string; subject: string; received_at: string;
  read_at: string | null; delivery_status: string;
};
type MailDetail = MailSummary & {
  mailbox: string; folder: string; reply_address: string; text: string;
  attachments: { filename: string; mimeType: string; size: number }[];
};
type MailContact = { id: string; name: string; email: string };
type ServerFolder = { name: string; label: string; kind: string };
type ApiResult<T> = {
  error: boolean; message?: string; data: T; total?: number; page?: number;
  folders?: ServerFolder[]; imap_enabled?: boolean; oversized?: number;
  sync?: { last_sync_at: string | null; pending: number; failed: number } | null;
};

@Component({
  selector: 'app-admin-mailbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <section class="max-w-6xl mx-auto space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Peti Emel RefPahang</h1>
          <p class="text-sm text-slate-600">Urus emel dan kenalan untuk lima alamat rasmi RefPahang.</p>
        </div>
        <div class="flex gap-2">
          <button type="button" (click)="showContacts.set(!showContacts())" [attr.aria-expanded]="showContacts()" aria-controls="mail-address-book" class="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">Buku alamat</button>
          <button type="button" (click)="newMessage()" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Tulis emel</button>
        </div>
      </div>
      <div class="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <label class="text-sm font-medium text-slate-700">Alamat
          <select class="mt-1 block rounded-lg border px-3 py-2" [(ngModel)]="mailbox" (ngModelChange)="selectMailbox()">
            @for (address of mailboxes; track address) { <option [value]="address">{{ address }}</option> }
          </select>
        </label>
        <label class="text-sm font-medium text-slate-700">Folder
          <select class="mt-1 block rounded-lg border px-3 py-2" [(ngModel)]="folder" (ngModelChange)="page = 1; refresh()">
            <option value="inbox">Peti Masuk</option><option value="sent">Dihantar</option>
            @for (item of extraFolders(); track item.name) { <option [value]="'imap:' + item.name">{{ folderName(item) }}</option> }
          </select>
        </label>
        <button type="button" (click)="refresh()" class="self-end rounded-lg border px-4 py-2 text-sm">Muat semula</button>
        @if (imapEnabled()) {
          <button type="button" (click)="syncMailbox()" [disabled]="syncing()" class="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{{ syncing() ? 'Menyegerak...' : 'Segerak Shinjiru' }}</button>
        }
      </div>
      @if (imapEnabled()) {
        <p role="status" class="text-xs text-slate-600">{{ syncStatus() }} Status dibaca dikira dalam portal; salinan asal kekal di Shinjiru.</p>
      }
      @if (showContacts()) {
        <section id="mail-address-book" aria-labelledby="address-book-title" class="rounded-xl border bg-white p-4 space-y-4">
          <h2 id="address-book-title" class="text-lg font-semibold">Buku alamat</h2>
          <form [formGroup]="contactForm" (ngSubmit)="saveContact()" class="flex flex-wrap items-end gap-3">
            <label class="text-sm font-medium">Nama <input formControlName="name" required maxlength="150" class="mt-1 block rounded-lg border px-3 py-2" /></label>
            <label class="text-sm font-medium">Alamat emel <input formControlName="email" type="email" required maxlength="254" class="mt-1 block rounded-lg border px-3 py-2" /></label>
            <button type="submit" [disabled]="contactForm.invalid || savingContact()" class="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{{ savingContact() ? 'Menyimpan...' : 'Simpan kenalan' }}</button>
            @if (contactForm.controls.id.value) { <button type="button" (click)="resetContact()" class="rounded-lg border px-4 py-2 text-sm">Batal sunting</button> }
          </form>
          @if (contactError()) { <p role="alert" class="text-sm text-red-700">{{ contactError() }}</p> }
          <label class="block text-sm">Cari kenalan <input type="search" [value]="contactSearch()" (input)="searchContacts($event)" class="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
          <ul class="max-h-72 overflow-y-auto divide-y">
            @for (contact of filteredContacts(); track contact.id) {
              <li class="flex flex-wrap items-center justify-between gap-2 py-3">
                <div><p class="text-sm font-semibold">{{ contact.name }}</p><p class="text-sm text-slate-600 break-all">{{ contact.email }}</p></div>
                <div class="flex flex-wrap gap-3 text-sm">
                  <button type="button" (click)="writeTo(contact)">Tulis emel<span class="sr-only"> kepada {{ contact.name }}</span></button>
                  <button type="button" (click)="editContact(contact)">Sunting<span class="sr-only"> {{ contact.name }}</span></button>
                  @if (deletingContact() === contact.id) {
                    <button type="button" (click)="deleteContact(contact)" class="font-semibold text-red-700">Sahkan padam {{ contact.name }}</button>
                    <button type="button" (click)="deletingContact.set('')">Batal</button>
                  } @else { <button type="button" (click)="deletingContact.set(contact.id)" class="text-red-700">Padam<span class="sr-only"> {{ contact.name }}</span></button> }
                </div>
              </li>
            } @empty { <li class="py-3 text-sm text-slate-600">Tiada kenalan ditemui.</li> }
          </ul>
        </section>
      }
      @if (error) { <p role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ error }}</p> }
      @if (notice) { <p role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-700">{{ notice }}</p> }
      <div class="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
        <div class="rounded-xl border bg-white overflow-hidden">
          <div class="border-b px-4 py-3 text-sm font-semibold">{{ currentFolderName() }} · {{ total }}</div>
          @if (loading) { <p class="p-5 text-sm text-slate-500">Memuatkan emel...</p> }
          @for (mail of messages; track mail.id) {
            <button type="button" (click)="open(mail.id)" class="block w-full border-b px-4 py-3 text-left hover:bg-slate-50" [class.bg-yellow-50]="selected?.id === mail.id">
              <span class="block truncate text-sm" [class.font-bold]="!mail.read_at">{{ folder === 'sent' ? mail.recipient : mail.sender }}</span>
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
              <label class="block text-sm">Kepada <input name="to" [(ngModel)]="draft.to" type="email" list="mail-contact-options" required class="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <datalist id="mail-contact-options">@for (contact of contacts(); track contact.id) { <option [value]="contact.email">{{ contact.name }}</option> }</datalist>
              <button type="button" (click)="saveRecipient()" class="text-sm underline">Tambah penerima ke buku alamat</button>
              <label class="block text-sm">Tajuk <input name="subject" [(ngModel)]="draft.subject" required maxlength="250" class="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label class="block text-sm">Mesej <textarea name="text" [(ngModel)]="draft.text" required maxlength="12000" rows="12" class="mt-1 w-full rounded-lg border px-3 py-2"></textarea></label>
              <p class="text-xs text-slate-600">Emel yang dihantar melalui portal disimpan dalam folder Dihantar portal.</p>
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
              @if (selected.reply_address) { <button type="button" (click)="saveSender()" class="rounded-lg border px-4 py-2 text-sm">Simpan penghantar sebagai kenalan</button> }
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
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly serverFolders = signal<ServerFolder[]>([]);
  readonly extraFolders = computed(() => this.serverFolders().filter((folder) => !['inbox', 'sent'].includes(folder.kind)));
  readonly imapEnabled = signal(false);
  readonly syncing = signal(false);
  readonly syncStatus = signal('Menunggu penyegerakan pertama.');
  readonly contacts = signal<MailContact[]>([]);
  readonly showContacts = signal(false);
  readonly savingContact = signal(false);
  readonly contactError = signal('');
  readonly contactSearch = signal('');
  readonly deletingContact = signal('');
  readonly filteredContacts = computed(() => {
    const search = this.contactSearch().trim().toLowerCase();
    return this.contacts().filter((contact) => `${contact.name} ${contact.email}`.toLowerCase().includes(search));
  });
  readonly contactForm = new FormGroup({
    id: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] }),
  });
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

  ngOnInit(): void { this.refresh(); this.loadContacts(); }
  folderName(folder: ServerFolder): string {
    const names: Record<string, string> = { drafts: 'Draf', spam: 'Spam', trash: 'Sampah', archive: 'Arkib' };
    return names[folder.kind] ? `${names[folder.kind]} (${folder.label})` : folder.label;
  }
  currentFolderName(): string {
    if (this.folder === 'inbox') return 'Peti Masuk';
    if (this.folder === 'sent') return 'Dihantar';
    const folder = this.serverFolders().find((item) => 'imap:' + item.name === this.folder);
    return folder ? this.folderName(folder) : 'Folder';
  }
  selectMailbox(): void { this.page = 1; this.folder = 'inbox'; this.serverFolders.set([]); this.refresh(); }
  formatDate(value: string): string { return value ? new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z')).toLocaleString('ms-MY') : ''; }
  downloadUrl(id: string): string { return `/api/admin-mailbox.php?id=${encodeURIComponent(id)}&download=1`; }
  refresh(): void {
    this.error = ''; this.selected = null; this.loading = true;
    const mailbox = this.mailbox, folder = this.folder, page = this.page;
    this.api.get<ApiResult<MailSummary[]>>('admin-mailbox.php', { mailbox, folder, page: String(page) }).subscribe({
      next: (result) => {
        if (mailbox !== this.mailbox || folder !== this.folder || page !== this.page) return;
        this.messages = result.data || []; this.total = result.total || 0; this.loading = false;
        this.serverFolders.set(result.folders || []); this.imapEnabled.set(!!result.imap_enabled);
        this.syncStatus.set((result.sync?.last_sync_at ? `Disemak: ${this.formatDate(result.sync.last_sync_at)}.` : 'Menunggu penyegerakan pertama.')
          + (result.sync?.pending ? ' Emel lama sedang dibawa masuk secara berperingkat.' : '')
          + (result.sync?.failed ? ' Sesetengah folder gagal disegerak; cuba Segerak Shinjiru.' : '')
          + (result.oversized ? ` ${result.oversized} emel melebihi 25 MiB; baca melalui webmail Shinjiru.` : ''));
      },
      error: () => {
        if (mailbox !== this.mailbox || folder !== this.folder || page !== this.page) return;
        this.error = 'Peti emel belum tersedia atau sesi telah tamat.'; this.loading = false; this.cdr.markForCheck();
      },
    });
  }
  syncMailbox(): void {
    if (this.syncing()) return;
    this.syncing.set(true); this.error = '';
    this.api.post<ApiResult<{ imported: number; pending: boolean; busy?: boolean }>>('admin-mailbox.php', { action: 'sync', mailbox: this.mailbox, folder: this.folder }, 70000).subscribe({
      next: (result) => { this.syncing.set(false); this.notice = result.data.busy ? 'Penyegerakan sedang berjalan atau baru selesai. Muat semula sebentar lagi.' : `${result.data.imported} emel ditambah dari Shinjiru.`; this.refresh(); },
      error: () => { this.syncing.set(false); this.error = 'Shinjiru belum dapat disegerak. Cuba lagi kemudian; emel sedia ada masih tersedia.'; },
    });
  }
  loadContacts(): void {
    this.api.get<ApiResult<MailContact[]>>('admin-mailbox.php', { view: 'contacts' }).subscribe({
      next: (result) => this.contacts.set(result.data || []),
      error: () => this.contactError.set('Buku alamat tidak dapat dimuatkan.'),
    });
  }
  searchContacts(event: Event): void { this.contactSearch.set((event.target as HTMLInputElement).value); }
  resetContact(): void { this.contactForm.reset(); this.contactError.set(''); }
  editContact(contact: MailContact): void { this.contactForm.setValue(contact); this.contactError.set(''); }
  writeTo(contact: MailContact): void { this.newMessage(); this.draft.to = contact.email; this.showContacts.set(false); }
  saveRecipient(): void { this.resetContact(); this.contactForm.controls.email.setValue(this.draft.to); this.showContacts.set(true); }
  saveSender(): void {
    if (!this.selected) return;
    this.resetContact(); this.contactForm.controls.email.setValue(this.selected.reply_address);
    this.contactForm.controls.name.setValue(this.selected.sender.replace(/\s*<[^>]*>\s*$/, ''));
    this.showContacts.set(true);
  }
  saveContact(): void {
    if (this.contactForm.invalid || this.savingContact()) return;
    this.savingContact.set(true); this.contactError.set('');
    this.api.post<ApiResult<MailContact>>('admin-mailbox.php', { action: 'save-contact', ...this.contactForm.getRawValue() }).subscribe({
      next: () => { this.savingContact.set(false); this.resetContact(); this.loadContacts(); },
      error: () => { this.savingContact.set(false); this.contactError.set('Kenalan tidak dapat disimpan. Semak nama dan alamat; alamat yang sama tidak boleh berulang.'); },
    });
  }
  deleteContact(contact: MailContact): void {
    this.api.post<ApiResult<{ deleted: boolean }>>('admin-mailbox.php', { action: 'delete-contact', id: contact.id }).subscribe({
      next: () => { this.deletingContact.set(''); this.contacts.update((contacts) => contacts.filter((item) => item.id !== contact.id)); if (this.contactForm.controls.id.value === contact.id) this.resetContact(); },
      error: () => this.contactError.set('Kenalan tidak dapat dipadam.'),
    });
  }
  changePage(delta: number): void { this.page += delta; this.refresh(); }
  open(id: string): void {
    this.error = ''; this.composing = false;
    this.api.get<ApiResult<MailDetail>>('admin-mailbox.php', { id }).subscribe({
      next: (result) => { this.selected = result.data; const row = this.messages.find((mail) => mail.id === id); if (row) row.read_at = new Date().toISOString(); this.cdr.markForCheck(); },
      error: () => { this.error = 'Emel tidak dapat dibuka.'; this.cdr.markForCheck(); },
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
        this.sending = false; this.cdr.markForCheck();
        if (result.data.delivery_status !== 'sent') { this.error = 'Status penghantaran belum pasti. Semak folder Dihantar sebelum mencuba lagi.'; return; }
        this.notice = 'Emel diterima oleh perkhidmatan penghantaran.';
        this.composing = false; this.folder = 'sent'; this.mailbox = this.draft.from; this.page = 1; this.refresh();
      },
      error: () => { this.sending = false; this.error = 'Penghantaran gagal atau status belum pasti. Semak folder Dihantar sebelum mencuba lagi.'; this.cdr.markForCheck(); },
    });
  }
}
