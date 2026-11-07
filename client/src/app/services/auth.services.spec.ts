import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.services';

describe('Logout', () => {
  it('clears local session immediately even if the logout request fails', () => {
    localStorage.setItem('finanzas_ia_auth', JSON.stringify({ token: 'test', user: { id: 'test' } }));
    const navigate = vi.fn();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: { navigate } }] });
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    auth.logout();
    expect(auth.getToken()).toBeNull();
    expect(auth.currentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/auth'], { replaceUrl: true });
    http.expectOne('/api/auth/logout').flush({}, { status: 500, statusText: 'Error' });
    http.verify();
  });
});
