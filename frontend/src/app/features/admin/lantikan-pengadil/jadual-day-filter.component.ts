import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface JadualDayOption {
  date: string;
  label: string;
  count: number;
}

@Component({
  selector: 'app-jadual-day-filter',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end gap-2">
      <label class="min-w-0 flex-1 sm:flex-none text-xs font-semibold text-slate-700">
        Hari / tarikh perlawanan
        <select [ngModel]="selectedDate()" (ngModelChange)="dateChange.emit($event)"
          class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
          <option value="">Semua hari</option>
          @for (day of days(); track day.date) {
            <option [value]="day.date">{{ day.label }} · {{ day.count }} perlawanan</option>
          }
        </select>
      </label>
      <div class="flex gap-1" role="group" aria-label="Navigasi hari perlawanan">
        <button type="button" (click)="move(-1)" [disabled]="selectedIndex() <= 0"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
          ‹ Sebelum
        </button>
        <button type="button" (click)="move(1)" [disabled]="!days().length || selectedIndex() >= days().length - 1"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
          Seterusnya ›
        </button>
      </div>
    </div>
  `,
})
export class JadualDayFilterComponent {
  readonly days = input.required<JadualDayOption[]>();
  readonly selectedDate = input('');
  readonly dateChange = output<string>();
  readonly selectedIndex = computed(() => this.days().findIndex(day => day.date === this.selectedDate()));

  move(direction: -1 | 1): void {
    const day = this.days()[this.selectedIndex() + direction];
    if (day) this.dateChange.emit(day.date);
  }
}
