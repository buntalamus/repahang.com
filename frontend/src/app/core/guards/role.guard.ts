import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const check = () => {
      const user = auth.currentUser;
      if (user && (allowedRoles.includes(user.role)
        || (user.role === 'PP Daerah' && allowedRoles.includes('Pengadil') && user.can_referee === 1)
        || (user.role === 'PP Daerah' && allowedRoles.includes('Penilai') && user.can_ra === 1))) {
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
