import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { apiErrorMessage } from './api-error';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();
  private nextId = 0;
  private readonly reportedErrors = new WeakSet<object>();

  show(message: string, type: Toast['type'] = 'info', duration = 4000): void {
    if (this.toastsSubject.value.some(toast => toast.type === type && toast.message === message)) return;
    const id = this.nextId++;
    const toast: Toast = { id, message, type };
    this.toastsSubject.next([...this.toastsSubject.value, toast]);
    if (duration > 0) setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 6000);
  }

  /** One full explanation per failed request, kept visible until dismissed. */
  apiError(error: unknown, operation?: string): void {
    if (error !== null && typeof error === 'object') {
      if (this.reportedErrors.has(error)) return;
      this.reportedErrors.add(error);
    }
    this.show(apiErrorMessage(error, operation), 'error', 0);
  }

  warning(message: string): void {
    this.show(message, 'warning');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((t) => t.id !== id));
  }
}
