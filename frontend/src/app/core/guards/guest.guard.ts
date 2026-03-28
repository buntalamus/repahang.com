import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated) {
    return router.createUrlTree([auth.getRoleRoute()]);
  }

  return auth.checkSession().pipe(
    take(1),
    map((authenticated) => {
      if (authenticated) {
        return router.createUrlTree([auth.getRoleRoute()]);
      }
      return true;
    }),
  );
};
