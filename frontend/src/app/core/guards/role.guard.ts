import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const check = () => {
      if (auth.currentUser && allowedRoles.includes(auth.currentUser.role)) {
        return true;
      }
      return router.createUrlTree(['/login']);
    };

    if (auth.isAuthenticated) {
      return check();
    }

    return auth.checkSession().pipe(
      take(1),
      map((authenticated) => {
        if (!authenticated) return router.createUrlTree(['/login']);
        return check();
      }),
    );
  };
}
