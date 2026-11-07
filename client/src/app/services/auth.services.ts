import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  currency: string;
  timezone: string;
  locale: string;
  role?: 'USER' | 'SUPERUSER';
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

const STORAGE_KEY = 'finanzas_ia_auth';
const API_URL = '/api/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  currentUser = signal<AuthUser | null>(
    this.loadUser()
  );

  constructor(private http: HttpClient,
              private router: Router
  ) {}

  // ==========================================================
  // LOGIN
  // ==========================================================

  login(
    email: string,
    password: string,
    admin = false
  ): Observable<AuthResponse> {

    return this.http
      .post<AuthResponse>(
        `${API_URL}/${admin ? 'admin/login' : 'login'}`,
        {
          email,
          password,
        }
      )
      .pipe(
        tap((response) => {
          this.saveSession(response);
        })
      );
  }

  // ==========================================================
  // REGISTER
  // ==========================================================

  register(
    email: string,
    password: string
  ): Observable<AuthResponse> {

    return this.http
      .post<AuthResponse>(
        `${API_URL}/register`,
        {
          email,
          password,
        }
      )
      .pipe(
        tap((response) => {
          this.saveSession(response);
        })
      );
  }

  // ==========================================================
  // LOGOUT
  // ==========================================================

  logout(): void {
    // Notifica al backend y limpia la sesión en el cliente
    this.http.post(`${API_URL}/logout`, {}).subscribe({
      error: () => {} // El cierre local no depende de la red.
    });
    this.clearSessionAndRedirect();
  }

  private clearSessionAndRedirect(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/auth'], { replaceUrl: true });
  }

  // ==========================================================
  // TOKEN
  // ==========================================================

  getToken(): string | null {
    const session = this.getSession();

    return session?.token ?? null;
  }

  // ==========================================================
  // AUTH CHECK
  // ==========================================================

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // ==========================================================
  // SESSION
  // ==========================================================

  private saveSession(
    response: AuthResponse
  ): void {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(response)
    );

    this.currentUser.set(response.user);
  }

  private getSession(): AuthResponse | null {

    const raw = localStorage.getItem(
      STORAGE_KEY
    );

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthResponse;

    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private loadUser(): AuthUser | null {

    const session = this.getSession();

    return session?.user ?? null;
  }
}
