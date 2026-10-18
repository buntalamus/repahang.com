import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { BACKGROUND_REQUEST } from '../services/background-request';
import { HttpViewRefreshService } from '../services/http-view-refresh.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);
  const viewRefresh = inject(HttpViewRefreshService);
  const isLoginRequest = req.url.includes('/login.php');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (req.context.get(BACKGROUND_REQUEST) && (error.status === 0 || error.status >= 500)) {
        return throwError(() => error);
      }
      if ((error as any)?.name === 'TimeoutError') {
        toast.error('Permintaan mengambil masa terlalu lama. Sila cuba semula.');
        return throwError(() => error);
      }

      if (error.status === 401) {
        if (!isLoginRequest) {
          toast.warning('Sesi anda telah tamat. Sila log masuk semula.');
          router.navigate(['/login']);
        }
      } else if (error.status === 403) {
        toast.error('Anda tidak mempunyai akses ke sumber ini.');
      } else if (error.status === 0) {
        toast.error('Tidak dapat menyambung ke pelayan. Sila semak sambungan internet anda.');
      } else if (error.status >= 500) {
        toast.error('Ralat pelayan. Sila cuba lagi kemudian.');
      }
      return throwError(() => error);
    }),
    // Runs after subscribers have applied success/error state to their views.
    finalize(() => viewRefresh.notify()),
  );
};
