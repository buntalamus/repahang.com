import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, of, map, shareReplay, finalize } from 'rxjs';
import { ApiService } from './api.service';
import { User, LoginResponse, SessionResponse } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();
  private sessionChecked = false;
  private sessionCheck$?: Observable<boolean>;

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('login.php', { email, password }).pipe(
      tap((res) => {
        if (!res.error && res.data) {
          this.currentUserSubject.next({
            id: res.data.id,
            email: res.data.email,
            role: res.data.role,
            nama_penuh: res.data.nama_penuh,
            persatuan_id: res.data.persatuan_id,
            persatuan_nama: res.data.persatuan_nama,
            password_changed: res.data.password_changed,
          });
        }
      }),
    );
  }

  logout(): Observable<unknown> {
    return this.api.post('logout.php', {}).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
        this.sessionChecked = false;
        this.router.navigate(['/login']);
      }),
    );
  }

  checkSession(): Observable<boolean> {
    if (this.sessionChecked) {
      return of(this.isAuthenticated);
    }

    if (this.sessionCheck$) {
      return this.sessionCheck$;
    }

    this.sessionCheck$ = this.api.get<SessionResponse>('session.php').pipe(
      map((res) => {
        if (res.authenticated) {
          this.currentUserSubject.next({
            id: res.user_id!,
            email: res.user_email!,
            role: res.user_role as User['role'],
            nama_penuh: res.nama_penuh!,
            persatuan_id: res.user_persatuan_id ?? null,
            persatuan_nama: res.user_persatuan_name ?? null,
            password_changed: res.password_changed ?? 1,
          });
          this.sessionChecked = true;
          return true;
        }
        this.currentUserSubject.next(null);
        this.sessionChecked = true;
        return false;
      }),
      catchError(() => {
        this.currentUserSubject.next(null);
        this.sessionChecked = true;
        return of(false);
      }),
      finalize(() => {
        this.sessionCheck$ = undefined;
      }),
      shareReplay(1),
    );

    return this.sessionCheck$;
  }

  hasRole(role: string): boolean {
    return this.currentUser?.role === role;
  }

  getRoleRoute(): string {
    switch (this.currentUser?.role) {
      case 'Admin':
        return '/admin';
      case 'PP Daerah':
        return '/pp-daerah';
      case 'Pengadil':
        return '/pengadil';
      case 'Penilai':
        return '/penilai';
      default:
        return '/login';
    }
  }
}
