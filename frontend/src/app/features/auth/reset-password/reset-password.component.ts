import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div class="text-center mb-6">
          <img src="assets/images/logo-pahang.png" alt="Logo" class="w-14 h-14 mx-auto mb-3" />
          <h1 class="text-xl font-bold text-slate-900">Tetapan Semula Kata Laluan</h1>
          <p class="text-sm text-slate-500 mt-1">Masukkan kata laluan baharu anda.</p>
        </div>

        @if (success) {
          <div class="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <span class="material-symbols-outlined text-3xl text-green-600">check_circle</span>
            <p class="text-sm text-green-800 mt-2 font-medium">{{ successMessage }}</p>
            <a routerLink="/login"
              class="inline-block mt-4 px-6 py-2.5 bg-pahang-black text-pahang-yellow font-semibold rounded-lg hover:bg-gray-800 text-sm">
              Log Masuk
            </a>
          </div>
        } @else if (!token) {
          <div class="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
            <span class="material-symbols-outlined text-3xl text-red-500">error</span>
            <p class="text-sm text-red-800 mt-2">Pautan tidak sah. Sila buat permintaan baharu.</p>
            <a routerLink="/lupa-kata-laluan" class="inline-block mt-4 text-sm font-semibold text-pahang-black hover:underline">
              Lupa Kata Laluan
            </a>
          </div>
        } @else {
          <form (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Kata Laluan Baharu</label>
              <input type="password" [(ngModel)]="password" name="password" required minlength="8"
                class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pahang-yellow text-sm"
                placeholder="Minimum 8 aksara" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Sahkan Kata Laluan</label>
              <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" required
                class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pahang-yellow text-sm"
                placeholder="Masukkan semula kata laluan" />
            </div>

            @if (errorMessage) {
              <p class="text-sm text-red-600">{{ errorMessage }}</p>
            }

            <button type="submit" [disabled]="loading"
              class="w-full py-3 bg-pahang-black text-pahang-yellow font-bold rounded-lg shadow hover:bg-gray-800 transition disabled:opacity-60 flex items-center justify-center">
              {{ loading ? 'Menyimpan...' : 'Tetapkan Kata Laluan' }}
              @if (loading) {
                <span class="ml-2 border-2 border-pahang-yellow border-t-transparent rounded-full w-4 h-4 animate-spin"></span>
              }
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  loading = false;
  success = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  onSubmit(): void {
    if (this.password.length < 8) {
      this.errorMessage = 'Kata laluan mestilah sekurang-kurangnya 8 aksara.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Kata laluan tidak sepadan.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.api.post<any>('reset-password.php', {
      token: this.token,
      password: this.password,
      confirm_password: this.confirmPassword,
    }).subscribe({
      next: (res) => {
        this.loading = false;
        if (!res.error) {
          this.success = true;
          this.successMessage = res.message;
        } else {
          this.errorMessage = res.message;
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Ralat. Sila cuba lagi.';
      },
    });
  }
}
