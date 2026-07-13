import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ProfilPengadilModalComponent } from './shared/components/profil-pengadil-modal/profil-pengadil-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, ProfilPengadilModalComponent],
  template: `
    <router-outlet />
    <app-toast />
    <app-profil-pengadil-modal />
  `,
})
export class App {}
