import { Injectable, signal } from '@angular/core';

/**
 * Servis modal profil pengadil/RA global.
 * Panggil open(userId) dari mana-mana komponen — modal dipaparkan oleh
 * <app-profil-pengadil-modal/> yang dipasang sekali di root app.
 */
@Injectable({ providedIn: 'root' })
export class ProfileModalService {
  readonly userId = signal<number | null>(null);

  open(userId: number | null | undefined): void {
    if (!userId) return;
    this.userId.set(Number(userId));
  }

  close(): void {
    this.userId.set(null);
  }
}
