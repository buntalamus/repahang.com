import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HttpViewRefreshService {
  private readonly settled = new Subject<void>();
  readonly settled$ = this.settled.asObservable();

  notify(): void {
    this.settled.next();
  }
}
