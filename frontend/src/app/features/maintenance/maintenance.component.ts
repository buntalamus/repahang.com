import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <span class="material-icons text-6xl text-pahang-yellow mb-4">engineering</span>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Sistem Dalam Penyelenggaraan</h1>
        <p class="text-gray-500 mb-6">
          Sistem sedang dikemaskini. Sila cuba sebentar lagi.
        </p>
        <a routerLink="/login"
          class="inline-block px-6 py-3 bg-pahang-black text-pahang-yellow font-semibold rounded-lg hover:bg-gray-800 transition">
          Kembali ke Log Masuk
        </a>
      </div>
    </div>
  `,
})
export class MaintenanceComponent {}
