import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (show) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="onCancel()">
        <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl" (click)="$event.stopPropagation()">
          <div class="p-6 text-center">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4"
              [class]="type === 'danger' ? 'bg-red-100' : 'bg-amber-100'">
              <svg class="h-6 w-6" [class]="type === 'danger' ? 'text-red-600' : 'text-amber-600'"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{{ title }}</h3>
            <p class="text-sm text-slate-600 mb-4">{{ message }}</p>
            @if (showInput) {
              <textarea [(ngModel)]="inputValue" [placeholder]="inputPlaceholder"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 resize-none" rows="3"></textarea>
            }
          </div>
          <div class="px-6 pb-6 flex justify-center gap-3">
            <button (click)="onCancel()"
              class="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Batal</button>
            <button (click)="onConfirm()"
              class="px-4 py-2 text-sm text-white font-semibold rounded-lg"
              [class]="type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-pahang-black hover:bg-gray-800'">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmModalComponent {
  @Input() show = false;
  @Input() title = 'Pengesahan';
  @Input() message = 'Adakah anda pasti?';
  @Input() confirmText = 'Ya';
  @Input() type: 'danger' | 'warning' = 'danger';
  @Input() showInput = false;
  @Input() inputPlaceholder = '';
  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  inputValue = '';

  onConfirm(): void {
    this.confirmed.emit(this.inputValue);
    this.inputValue = '';
  }

  onCancel(): void {
    this.cancelled.emit();
    this.inputValue = '';
  }
}
