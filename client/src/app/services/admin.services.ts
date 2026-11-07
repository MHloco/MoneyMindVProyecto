import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface AdminSummary {
  total: number; active: number; inactive: number; deleted: number;
  superusers: number; verified: number; new_users: number; recent_logins: number;
}
export interface AdminUser {
  id: string; email: string; full_name: string; currency: string; timezone: string;
  locale: string; role: 'USER' | 'SUPERUSER'; is_active: boolean;
  email_verified_at: string | null; last_login_at: string | null; created_at: string; deleted_at: string | null;
}
export interface AdminUsers { users: AdminUser[]; total: number; page: number; pageSize: number; }
const URL = '/api/admin';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  session() { return this.http.get<{ user: { role: 'SUPERUSER' } }>(`${URL}/session`); }
  summary() { return this.http.get<AdminSummary>(`${URL}/summary`); }
  createSuperuser(body: { fullName: string; email: string; password: string }) {
    return this.http.post<{ user: Pick<AdminUser, 'id' | 'email' | 'full_name' | 'role'> }>(`${URL}/superusers`, body);
  }
  users(page: number, search: string, status: string, role: string) {
    return this.http.get<AdminUsers>(`${URL}/users`, { params: { page, search, status, role } });
  }
}
