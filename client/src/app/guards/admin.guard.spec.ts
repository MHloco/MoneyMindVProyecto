import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminGuard } from './admin.guard';

describe('Admin route authorization', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); localStorage.clear(); });
  const run = () => TestBed.runInInjectionContext(() => adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  it('redirects unauthenticated visitors to the special login', () => {
    expect(String(run())).toBe('/admin/login');
  });
  it('rejects a forged superuser role in localStorage when the API denies access', () => {
    localStorage.setItem('finanzas_ia_auth', JSON.stringify({ token: 'test', user: { role: 'SUPERUSER' } }));
    let result: unknown;
    (run() as Observable<unknown>).subscribe(value => result = value);
    TestBed.inject(HttpTestingController).expectOne('/api/admin/session')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(String(result)).toBe('/admin/login');
  });
  it('accepts an account only after the server validates permission', () => {
    localStorage.setItem('finanzas_ia_auth', JSON.stringify({ token: 'test', user: { role: 'USER' } }));
    let result: unknown;
    (run() as Observable<unknown>).subscribe(value => result = value);
    TestBed.inject(HttpTestingController).expectOne('/api/admin/session').flush({ user: { role: 'SUPERUSER' } });
    expect(result).toBe(true);
  });
});
