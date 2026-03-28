import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (totalItems > 0) {
      <div class="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="text-sm text-slate-600">
          Menunjukkan {{ startIndex }} hingga {{ endIndex }} dari {{ totalItems }} hasil
        </div>
        <div class="flex items-center space-x-2">
          <select [value]="pageSize" (change)="onPageSizeChange($event)"
            class="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400">
            <option value="10">10 per halaman</option>
            <option value="20">20 per halaman</option>
            <option value="50">50 per halaman</option>
            <option value="100">100 per halaman</option>
          </select>
          <button (click)="prev()" [disabled]="currentPage === 1"
            class="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="px-3 py-2 text-sm text-slate-600">{{ currentPage }} dari {{ totalPages }}</span>
          <button (click)="next()" [disabled]="currentPage === totalPages"
            class="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    }
  `,
})
export class PaginationComponent implements OnChanges {
  @Input() totalItems = 0;
  @Input() pageSize = 10;
  @Input() currentPage = 1;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  totalPages = 1;
  startIndex = 0;
  endIndex = 0;

  ngOnChanges(): void {
    this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    this.startIndex = (this.currentPage - 1) * this.pageSize + 1;
    this.endIndex = Math.min(this.currentPage * this.pageSize, this.totalItems);
    if (this.totalItems === 0) this.startIndex = 0;
  }

  prev(): void {
    if (this.currentPage > 1) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  next(): void {
    if (this.currentPage < this.totalPages) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }

  onPageSizeChange(event: Event): void {
    const val = +(event.target as HTMLSelectElement).value;
    this.pageSizeChange.emit(val);
  }
}
