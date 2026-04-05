import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div class="text-center mb-6">
          <img src="assets/images/logo-pahang.png" alt="Logo" class="w-14 h-14 mx-auto mb-3" />
          <h1 class="text-xl font-bold text-slate-900">Lupa Kata Laluan</h1>
          <p class="text-sm text-slate-500 mt-1">Masukkan emel berdaftar untuk menerima pautan tetapan semula.</p>
        </div>

        @if (sent) {
          <div class="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <span class="material-symbols-outlined text-3xl text-green-600">mark_email_read</span>
            <p class="text-sm text-green-800 mt-2 font-medium">{{ message }}</p>
            <a routerLink="/login" class="inline-block mt-4 text-sm font-semibold text-pahang-black hover:underline">
              ← Kembali ke Log Masuk
            </a>
          </div>
        } @else {
          <form (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Emel</label>
              <input type="email" [(ngModel)]="email" name="email" required
                class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pahang-yellow text-sm"
                placeholder="contoh@email.com" />
            </div>

            @if (errorMessage) {
              <p class="text-sm text-red-600">{{ errorMessage }}</p>
            }

            <button type="submit" [disabled]="loading"
              class="w-full py-3 bg-pahang-black text-pahang-yellow font-bold rounded-lg shadow hover:bg-gray-800 transition disabled:opacity-60 flex items-center justify-center">
              {{ loading ? 'Menghantar...' : 'Hantar Pautan Reset' }}
              @if (loading) {
                <span class="ml-2 border-2 border-pahang-yellow border-t-transparent rounded-full w-4 h-4 animate-spin"></span>
              }
            </button>
          </form>

          <div class="text-center mt-5">
            <a routerLink="/login" class="text-sm text-slate-500 hover:text-slate-700">
              ← Kembali ke Log Masuk
            </a>
          </div>
        }
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  sent = false;
  message = '';
  errorMessage = '';

  constructor(private api: ApiService) {}

  onSubmit(): void {
    if (!this.email) return;
    this.loading = true;
    this.errorMessage = '';
    this.api.post<any>('forgot-password.php', { email: this.email.trim() }).subscribe({
      next: (res) => {
        this.loading = false;
        this.sent = true;
        this.message = res.message || 'Pautan telah dihantar ke emel anda.';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Ralat. Sila cuba lagi.';
      },
    });
  }
}
