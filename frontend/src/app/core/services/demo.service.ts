import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { EXPECTED_ERROR_STATUSES } from './background-request';

export interface DemoAccount {
  peranan: string;
  emel: string;
  kata_laluan: string;
  keterangan: string;
}

/** demo.refpahang.com only: /api/demo-info.php answers 404 everywhere else. */
@Injectable({ providedIn: 'root' })
export class DemoService {
  readonly accounts = signal<DemoAccount[] | null>(null);
  /** False while production's Admin has the demo switched off. */
  readonly open = signal(true);
  readonly closedMessage = signal('');

  constructor() {
    inject(HttpClient).get<{ demo?: boolean; open?: boolean; message?: string; accounts?: DemoAccount[] }>('/api/demo-info.php', {
      context: new HttpContext().set(EXPECTED_ERROR_STATUSES, [404]),
    }).subscribe({
      next: (res) => {
        if (!res?.demo) return;
        this.open.set(res.open !== false);
        this.closedMessage.set(res.message ?? '');
        this.accounts.set(res.accounts ?? []);
      },
      error: () => { /* not the demo */ },
    });
  }
}
