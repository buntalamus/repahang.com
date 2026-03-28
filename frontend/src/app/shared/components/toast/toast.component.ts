import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ToastService, Toast } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div class="fixed top-4 right-4 z-9999 flex flex-col gap-3 pointer-events-none">
      @for (toast of (toastService.toasts$ | async); track toast.id) {
        <div
          class="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium min-w-75 max-w-105 animate-slide-in"
          [class]="getClass(toast)"
          (click)="toastService.dismiss(toast.id)"
        >
          <span [innerHTML]="getIcon(toast.type)"></span>
          <span class="flex-1">{{ toast.message }}</span>
          <button class="ml-2 opacity-60 hover:opacity-100 text-lg leading-none">&times;</button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in { animation: slideIn 0.3s ease-out; }
  `],
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}

  getClass(toast: Toast): string {
    const base = 'pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium min-w-75 max-w-105 animate-slide-in';
    const colors: Record<string, string> = {
      success: 'bg-linear-to-r from-emerald-600 to-emerald-500',
      error: 'bg-linear-to-r from-rose-600 to-rose-500',
      warning: 'bg-linear-to-r from-amber-600 to-amber-500',
      info: 'bg-linear-to-r from-sky-600 to-sky-500',
    };
    return `${base} ${colors[toast.type] || colors['info']}`;
  }

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      success: '&#10003;',
      error: '&#10007;',
      warning: '&#9888;',
      info: '&#8505;',
    };
    return icons[type] || icons['info'];
  }
}
