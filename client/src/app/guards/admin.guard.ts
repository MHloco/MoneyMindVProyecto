import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.services';
import { AdminService } from '../services/admin.services';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const login = router.createUrlTree(['/admin/login']);
  if (!inject(AuthService).isAuthenticated()) return login;
  // A role changed in localStorage never grants access.
  return inject(AdminService).session().pipe(
    map(() => true), catchError(() => of(login)));
};
