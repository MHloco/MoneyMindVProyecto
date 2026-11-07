import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthComponent } from './auth';
import { AuthService } from '../../services/auth.services';

describe('Special administrator login', () => {
  it('uses administrator authentication, prevents registration and opens the admin dashboard', () => {
    const navigate = vi.fn();
    const login = vi.fn(() => of({ user: { role: 'SUPERUSER' } }));
    const register = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: { navigate } },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { admin: true } } } },
      { provide: AuthService, useValue: { login, register } },
    ] });
    const component = TestBed.runInInjectionContext(() => new AuthComponent(TestBed.inject(Router), TestBed.inject(AuthService), TestBed.inject(ActivatedRoute)));
    component.toggleMode();
    expect(component.isRegistering).toBe(false);
    component.email = 'admin@example.invalid'; component.password = 'test-password'; component.submit();
    expect(login).toHaveBeenCalledWith('admin@example.invalid', 'test-password', true);
    expect(register).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/admin']);
  });
});
