import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-feature-placeholder',
  standalone: true,
  template: `
    <div class="max-w-4xl space-y-6">
      <div class="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div class="flex items-start gap-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <span class="material-icons">construction</span>
          </div>
          <div class="space-y-2">
            <h2 class="text-xl font-semibold text-slate-900">{{ title }}</h2>
            <p class="text-sm text-slate-700">{{ message }}</p>
            <p class="text-sm text-slate-600">{{ detail }}</p>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Status Migrasi</h3>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-medium text-slate-900">Status semasa</p>
            <p class="mt-1 text-sm text-slate-600">Placeholder aktif</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-medium text-slate-900">Sebab</p>
            <p class="mt-1 text-sm text-slate-600">Modul ini belum siap dimigrasikan ke Angular</p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class FeaturePlaceholderComponent {
  title = 'Modul Akan Dibangunkan';
  message = 'Halaman ini belum siap dimigrasikan ke Angular.';
  detail = 'Buat masa ini, placeholder dipaparkan untuk mengelakkan ralat API atau paparan yang mengelirukan.';

  constructor(private route: ActivatedRoute) {
    const data = this.route.snapshot.data;
    this.title = data['title'] || this.title;
    this.message = data['message'] || this.message;
    this.detail = data['detail'] || this.detail;
  }
}
