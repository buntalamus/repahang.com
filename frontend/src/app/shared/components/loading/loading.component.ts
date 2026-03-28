import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center py-12">
      <div class="animate-spin rounded-full border-b-2 border-pahang-yellow"
           [class]="sizeClass"></div>
      @if (message) {
        <p class="mt-4 text-sm text-slate-500">{{ message }}</p>
      }
    </div>
  `,
})
export class LoadingComponent {
  @Input() message = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get sizeClass(): string {
    const sizes = { sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-16 w-16' };
    return `${sizes[this.size]} animate-spin rounded-full border-b-2 border-pahang-yellow`;
  }
}
