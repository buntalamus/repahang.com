import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, OnDestroy, afterNextRender, inject, output } from '@angular/core';
@Directive({ selector: '[appModalFocus]', host: { '(keydown)': 'onKey($event)' } })
export class ModalFocusDirective implements OnDestroy {
  readonly modalDismiss = output<void>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly previous =
    this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
  constructor() {
    afterNextRender(() => this.focusable()[0]?.focus());
  }
  private focusable(): HTMLElement[] {
    return [
      ...this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
      ),
    ].filter((e) => e.getClientRects().length > 0);
  }
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.modalDismiss.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    const elements = this.focusable(),
      first = elements[0],
      last = elements.at(-1);
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  ngOnDestroy(): void {
    if (this.previous?.isConnected) this.previous.focus();
  }
}
