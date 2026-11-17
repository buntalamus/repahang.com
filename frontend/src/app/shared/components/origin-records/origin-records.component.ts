import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

interface OriginRequest {
  id: number; referee_name: string; origin_state: string; transfer_date: string;
  date_from: string; date_to: string; status: string; expires_on: string | null;
  revision: number; record_count?: number; verifier_name?: string; notes?: string;
  review_notes?: string; proof_name?: string; access_active?: boolean;
  granted_by_name?: string; reviewed_by_name?: string; reviewed_at?: string;
}
interface OriginRecord {
  id: number; tarikh: string; masa: string | null; jenis: string; nama_kejohanan: string;
  home_team: string; away_team: string; tempat: string; jawatan: string;
}
interface ListResponse {
  requests: OriginRequest[]; states: string[]; positions: string[]; today: string;
  pagination: { page: number; total_pages: number };
}
interface DetailResponse { request: OriginRequest; records: OriginRecord[] }
const STATUS: Record<string,string> = { requested: 'Menunggu akses Admin', open: 'Akses dibuka',
  submitted: 'Menunggu semakan Admin', accepted: 'Diterima Admin', rejected: 'Ditolak Admin', revoked: 'Akses ditutup' };

@Component({
  selector: 'app-origin-records',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './origin-records.component.html',
  styleUrl: './origin-records.component.scss',
})
export class OriginRecordsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly admin = inject(ActivatedRoute).snapshot.data['originAdmin'] === true;
  readonly items = signal<OriginRequest[]>([]);
  readonly detail = signal<OriginRequest | null>(null);
  readonly records = signal<OriginRecord[]>([]);
  readonly states = signal<string[]>([]);
  readonly positions = signal<string[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly creating = signal(false);
  readonly today = signal('');
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly statusLabels = Object.entries(STATUS);
  readonly filter = this.fb.nonNullable.control('');
  readonly proof = signal<File | null>(null);
  readonly requestForm = this.fb.nonNullable.group({
    origin_state: ['', Validators.required], transfer_date: ['', Validators.required],
    date_from: ['', Validators.required], date_to: ['', Validators.required],
    verifier_name: ['', [Validators.required, Validators.maxLength(255)]], notes: ['', Validators.maxLength(1000)],
  });
  readonly reviewForm = this.fb.nonNullable.group({ date_from: [''], date_to: [''], expires_on: [''], notes: ['', Validators.maxLength(1000)] });
  readonly recordForm = this.fb.nonNullable.group({
    tarikh: ['', Validators.required], masa: [''], jenis: ['', [Validators.required, Validators.maxLength(60)]],
    nama_kejohanan: ['', [Validators.required, Validators.maxLength(255)]],
    home_team: ['', [Validators.required, Validators.maxLength(255)]], away_team: ['', [Validators.required, Validators.maxLength(255)]],
    tempat: ['', [Validators.required, Validators.maxLength(255)]], jawatan: ['', Validators.required],
  });

  constructor() { void this.load(); }
  status(row: OriginRequest): string {
    return row.status === 'open' && row.expires_on && row.expires_on < this.today() ? 'Akses tamat' : STATUS[row.status] || row.status;
  }
  date(value: string | null | undefined): string { return value ? value.slice(0,10).split('-').reverse().join('/') : '—'; }
  proofUrl(row: OriginRequest): string { return `${environment.apiUrl}/rekod-negeri-asal.php?id=${row.id}&action=proof`; }
  private report(error: unknown): void {
    const e = error as { error?: { message?: string }; message?: string };
    this.error.set(e.error?.message || 'Tindakan tidak berjaya. Sila cuba semula.');
  }
  async load(page = this.page()): Promise<void> {
    this.loading.set(true); this.error.set('');
    try {
      const result = await firstValueFrom(this.api.get<ListResponse>('rekod-negeri-asal.php', {
        page: String(page), ...(this.filter.value ? { status: this.filter.value } : {}),
      }));
      this.items.set(result.requests); this.states.set(result.states); this.positions.set(result.positions);
      this.today.set(result.today); this.page.set(result.pagination.page); this.pages.set(result.pagination.total_pages);
    } catch (e) { this.report(e); } finally { this.loading.set(false); }
  }
  async open(id: number): Promise<void> {
    this.busy.set(true); this.error.set(''); this.creating.set(false); this.proof.set(null);
    try {
      const result = await firstValueFrom(this.api.get<DetailResponse>('rekod-negeri-asal.php', { id: String(id) }));
      this.detail.set(result.request); this.records.set(result.records);
      const expiry = new Date(`${this.today()}T00:00:00Z`); expiry.setUTCDate(expiry.getUTCDate()+30);
      this.reviewForm.reset({ date_from: result.request.date_from, date_to: result.request.date_to,
        expires_on: expiry.toISOString().slice(0,10), notes: '' });
    } catch (e) { this.report(e); } finally { this.busy.set(false); }
  }
  start(): void { this.detail.set(null); this.creating.set(true); this.proof.set(null); this.error.set(''); }
  back(): void { this.detail.set(null); this.creating.set(false); this.error.set(''); this.proof.set(null); }
  pick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.size > 5*1024*1024) { this.error.set('Saiz dokumen melebihi 5 MB.'); this.proof.set(null); return; }
    this.proof.set(file);
  }
  async create(): Promise<void> {
    if (this.requestForm.invalid || !this.proof()) { this.requestForm.markAllAsTouched(); this.error.set('Lengkapkan semua medan wajib dan lampirkan dokumen pengesahan.'); return; }
    const form = new FormData(); form.set('action','request');
    for (const [key,value] of Object.entries(this.requestForm.getRawValue())) form.set(key,value);
    form.set('proof',this.proof()!);
    this.busy.set(true); this.error.set('');
    try {
      const res = await firstValueFrom(this.api.postFormData<{message:string}>('rekod-negeri-asal.php',form));
      this.toast.success(res.message); this.creating.set(false); this.proof.set(null); this.requestForm.reset(); await this.load(1);
    } catch(e) { this.report(e); } finally { this.busy.set(false); }
  }
  async replaceProof(): Promise<void> {
    const row = this.detail(); if (!row || !this.proof()) return;
    const form = new FormData(); form.set('action','replace_proof'); form.set('id',String(row.id));
    form.set('revision',String(row.revision)); form.set('proof',this.proof()!);
    this.busy.set(true); this.error.set('');
    try {
      const res = await firstValueFrom(this.api.postFormData<{message:string}>('rekod-negeri-asal.php',form));
      this.toast.success(res.message); await this.open(row.id);
    } catch(e) { this.report(e); } finally { this.busy.set(false); }
  }
  async act(action: string, extra: Record<string,unknown> = {}): Promise<void> {
    const row = this.detail(); if (!row) return;
    if (action === 'add_record' && this.recordForm.invalid) {
      this.recordForm.markAllAsTouched(); this.error.set('Lengkapkan semua medan perlawanan wajib.'); return;
    }
    this.busy.set(true); this.error.set('');
    try {
      const res = await firstValueFrom(this.api.post<{message:string}>('rekod-negeri-asal.php', {
        id: row.id, revision: row.revision, action,
        ...(this.admin ? this.reviewForm.getRawValue() : {}),
        ...(action === 'add_record' ? this.recordForm.getRawValue() : {}), ...extra,
      }));
      this.toast.success(res.message);
      if (action === 'add_record') this.recordForm.reset({ jenis: this.recordForm.controls.jenis.value,
        nama_kejohanan: this.recordForm.controls.nama_kejohanan.value, jawatan: this.recordForm.controls.jawatan.value });
      await this.load(); await this.open(row.id);
    } catch(e) { this.report(e); } finally { this.busy.set(false); }
  }
}
