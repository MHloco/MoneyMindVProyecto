import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminComponent } from './admin';
import { AdminService } from '../../services/admin.services';
import { AuthService } from '../../services/auth.services';

describe('Admin session synchronization', () => {
  it('keeps unchanged sessions and clears private data when another tab changes account', () => {
    let token = 'original';
    const navigate = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: { navigate } },
      { provide: AuthService, useValue: { getToken: () => token } },
      { provide: AdminService, useValue: {
        summary: () => of({ total: 1 }),
        users: () => of({ users: [{ id: 'private-user' }], total: 1, page: 1 }),
      } },
    ] });
    const component = TestBed.runInInjectionContext(() => new AdminComponent());
    component.onStorage(new StorageEvent('storage', { key: 'finanzas_ia_auth' }));
    expect(navigate).not.toHaveBeenCalled();
    expect(component.users().length).toBe(1);
    token = 'changed';
    component.onStorage(new StorageEvent('storage', { key: 'finanzas_ia_auth' }));
    expect(component.users()).toEqual([]);
    expect(component.summary()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/admin/login']);
  });
});

describe('Create superuser from the dashboard', () => {
  function setup() {
    const pending = new Subject<any>();
    const createSuperuser = vi.fn(() => pending);
    const users = vi.fn(() => of({ users: [], total: 0, page: 1 }));
    const navigate = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: { navigate } },
      { provide: AuthService, useValue: { getToken: () => 'unchanged-admin-session' } },
      { provide: AdminService, useValue: { summary: () => of({ total: 1 }), users, createSuperuser } },
    ] });
    const component = TestBed.runInInjectionContext(() => new AdminComponent());
    component.toggleCreate();
    component.newFullName = ' Other Admin '; component.newEmail = 'OTHER@example.invalid';
    component.newPassword = 'long-test-password'; component.confirmPassword = 'long-test-password';
    return { component, pending, createSuperuser, users, navigate };
  }

  it('validates confirmation, prevents duplicate submits and clears passwords on success', () => {
    const { component, pending, createSuperuser, users, navigate } = setup();
    component.confirmPassword = 'different-password'; component.createSuperuser();
    expect(createSuperuser).not.toHaveBeenCalled();
    expect(component.createError()).toContain('no coinciden');
    component.confirmPassword = component.newPassword;
    component.createSuperuser(); component.createSuperuser();
    expect(createSuperuser).toHaveBeenCalledExactlyOnceWith({ fullName: 'Other Admin', email: 'other@example.invalid', password: 'long-test-password' });
    expect(component.creating()).toBe(true);
    pending.next({ user: { email: 'other@example.invalid', role: 'SUPERUSER' } }); pending.complete();
    expect(component.creating()).toBe(false);
    expect(component.newPassword).toBe(''); expect(component.confirmPassword).toBe('');
    expect(component.showCreate()).toBe(false);
    expect(component.createSuccess()).toContain('other@example.invalid');
    expect(users).toHaveBeenLastCalledWith(1, 'other@example.invalid', 'all', 'SUPERUSER');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows duplicate email errors and permits retry without retaining passwords', () => {
    const { component, pending } = setup();
    component.createSuperuser();
    pending.error({ status: 409, error: { message: 'Ya existe una cuenta con ese correo.' } });
    expect(component.createError()).toContain('Ya existe');
    expect(component.creating()).toBe(false); expect(component.showCreate()).toBe(true);
    expect(component.newPassword).toBe(''); expect(component.confirmPassword).toBe('');
    expect(component.newEmail).toBe('OTHER@example.invalid');
  });
});
