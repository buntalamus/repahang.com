import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiResponse } from '../../../core/models/user.model';

@Component({
  selector: 'app-force-change-password',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div class="text-center mb-6">
          <span class="material-icons text-pahang-yellow text-5xl">lock_reset</span>
          <h2 class="text-xl font-bold mt-3">Tukar Kata Laluan</h2>
          <p class="text-sm text-gray-500 mt-1">
            Anda perlu menukar kata laluan akaun sebelum meneruskan.
          </p>
        </div>
        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kata Laluan Semasa</label>
            <input type="password" [(ngModel)]="current" name="current" required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pahang-yellow" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kata Laluan Baharu</label>
            <input type="password" [(ngModel)]="newPass" name="newPass" required minlength="8"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pahang-yellow" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Sahkan Kata Laluan Baharu</label>
            <input type="password" [(ngModel)]="confirm" name="confirm" required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pahang-yellow" />
          </div>
          @if (error) {
            <p class="text-sm text-red-600">{{ error }}</p>
          }
          <button type="submit" [disabled]="loading"
            class="w-full py-2.5 bg-pahang-black text-pahang-yellow font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-60">
            {{ loading ? 'Menyimpan...' : 'Tukar Kata Laluan' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class ForceChangePasswordComponent {
  current = '';
  newPass = '';
  confirm = '';
  error = '';
  loading = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
  ) {}

  onSubmit(): void {
    this.error = '';
    if (this.newPass.length < 8) {
      this.error = 'Kata laluan baharu mestilah sekurang-kurangnya 8 aksara.';
      return;
    }
    if (this.newPass !== this.confirm) {
      this.error = 'Kata laluan baharu tidak sepadan.';
      return;
    }

    this.loading = true;
    this.api
      .post<ApiResponse>('change-password.php', {
        current_password: this.current,
        new_password: this.newPass,
        confirm_password: this.confirm,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.error) {
            this.error = res.message;
          } else {
            this.toast.success('Kata laluan berjaya ditukar. Sila log masuk semula.');
            this.auth.logout().subscribe();
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.error = err?.error?.message || 'Ralat pelayan.';
        },
      });
  }
}
