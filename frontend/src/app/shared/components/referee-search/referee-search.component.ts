import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';

export interface RefereeOption {
  id: number;
  nama_penuh: string;
  no_kp: string;
  role: string;
  jenis_pengadil: string;
  persatuan_nama: string;
}

@Component({
  selector: 'app-referee-search',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="relative" #wrapper>
      <!-- Selected display -->
      @if (selected) {
        <div class="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <div>
            <span class="text-sm font-medium text-green-800">{{ selected.nama_penuh }}</span>
            <span class="text-xs text-green-600 ml-2">({{ selected.jenis_pengadil || selected.role }})</span>
          </div>
          <button (click)="clearSelection()" type="button"
            class="text-green-600 hover:text-red-500 transition">
            <span class="material-icons text-sm">close</span>
          </button>
        </div>
      } @else {
        <!-- Search input -->
        <div class="relative">
          <span class="material-icons absolute left-2.5 top-2 text-gray-400 text-lg">search</span>
          <input #inputEl type="text" [(ngModel)]="query" (ngModelChange)="onQueryChange($event)"
            (focus)="onFocus()" (blur)="onBlur()"
            [placeholder]="placeholder"
            [disabled]="disabled"
            class="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pahang-yellow focus:border-transparent disabled:bg-gray-100" />
          @if (searching) {
            <span class="material-icons absolute right-2.5 top-2 text-gray-400 text-sm animate-spin">sync</span>
          }
        </div>

        <!-- Dropdown results — fixed positioning to escape overflow containers -->
        @if (showDropdown && results.length > 0) {
          <div class="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
               [style.width.px]="dropdownWidth"
               [style.top.px]="dropdownTop"
               [style.left.px]="dropdownLeft">
            @for (ref of results; track ref.id) {
              <button (mousedown)="selectReferee(ref)" type="button"
                class="w-full text-left px-3 py-2 hover:bg-pahang-yellow/10 transition border-b border-gray-50 last:border-0"
                [class.opacity-50]="isExcluded(ref.id)"
                [disabled]="isExcluded(ref.id)">
                <div class="text-sm font-medium text-gray-900">{{ ref.nama_penuh }}</div>
                <div class="text-xs text-gray-500">
                  {{ ref.jenis_pengadil || ref.role }}
                  @if (ref.persatuan_nama) {
                    <span> · {{ ref.persatuan_nama }}</span>
                  }
                </div>
              </button>
            }
          </div>
        }
        @if (showDropdown && query.length >= 2 && results.length === 0 && !searching) {
          <div class="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-400"
               [style.width.px]="dropdownWidth"
               [style.top.px]="dropdownTop"
               [style.left.px]="dropdownLeft">
            Tiada padanan ditemui
          </div>
        }
      }
    </div>
  `,
})
export class RefereeSearchComponent implements OnInit, OnDestroy {
  @Input() placeholder = 'Cari pengadil (nama/IC)...';
  @Input() disabled = false;
  @Input() excludeIds: number[] = [];
  @Input() set value(ref: RefereeOption | null) {
    this.selected = ref;
  }

  @Output() refereeSelected = new EventEmitter<RefereeOption>();
  @Output() refereeCleared = new EventEmitter<void>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  query = '';
  results: RefereeOption[] = [];
  allReferees: RefereeOption[] = [];
  selected: RefereeOption | null = null;
  showDropdown = false;
  searching = false;
  loaded = false;

  dropdownTop = 0;
  dropdownLeft = 0;
  dropdownWidth = 200;

  private search$ = new Subject<string>();
  private sub?: Subscription;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.sub = this.search$
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => this.filterLocal(q));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onFocus(): void {
    this.updateDropdownPosition();
    this.showDropdown = true;
  }

  onQueryChange(q: string): void {
    if (q.length >= 2) {
      this.showDropdown = true;
      this.updateDropdownPosition();
      if (!this.loaded) {
        this.loadAll(q);
      } else {
        this.search$.next(q);
      }
    } else {
      this.results = [];
    }
  }

  private updateDropdownPosition(): void {
    const el = this.inputEl?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.dropdownWidth = rect.width;
    this.dropdownLeft = rect.left;
    this.dropdownTop = rect.bottom + 4;
  }

  private loadAll(initialQuery: string): void {
    this.searching = true;
    this.api.get<any>('get-active-referees.php').subscribe({
      next: (res) => {
        this.allReferees = res.data || [];
        this.loaded = true;
        this.searching = false;
        this.filterLocal(initialQuery);
      },
      error: () => {
        this.searching = false;
      },
    });
  }

  private filterLocal(q: string): void {
    const lower = q.toLowerCase();
    this.results = this.allReferees
      .filter(
        (r) =>
          r.nama_penuh?.toLowerCase().includes(lower) ||
          (r.no_kp && r.no_kp.includes(q)),
      )
      .slice(0, 8);
    if (this.results.length > 0) {
      this.showDropdown = true;
    }
  }

  selectReferee(ref: RefereeOption): void {
    if (this.isExcluded(ref.id)) return;
    this.selected = ref;
    this.query = '';
    this.results = [];
    this.showDropdown = false;
    this.refereeSelected.emit(ref);
  }

  clearSelection(): void {
    this.selected = null;
    this.query = '';
    this.refereeCleared.emit();
  }

  isExcluded(id: number): boolean {
    return this.excludeIds.includes(id);
  }

  onBlur(): void {
    setTimeout(() => (this.showDropdown = false), 200);
  }
}
