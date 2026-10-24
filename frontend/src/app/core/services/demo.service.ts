import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

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

  constructor() {
    inject(HttpClient).get<{ demo?: boolean; accounts?: DemoAccount[] }>('/api/demo-info.php').subscribe({
      next: (res) => { if (res?.demo) this.accounts.set(res.accounts ?? []); },
      error: () => { /* not the demo */ },
    });
  }
}
