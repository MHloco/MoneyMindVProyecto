import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminService, AdminSummary, AdminUser } from '../../services/admin.services';
import { AuthService } from '../../services/auth.services';

@Component({
  selector: 'app-admin', imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './admin.html', styleUrl: './admin.scss',
})
export class AdminComponent {
  readonly auth = inject(AuthService);
  private readonly sessionToken = this.auth.getToken();
  private api = inject(AdminService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  readonly summary = signal<AdminSummary | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly total = signal(0);
  readonly page = signal(1);
  readonly selected = signal<AdminUser | null>(null);
  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly createError = signal('');
  readonly createSuccess = signal('');
  newFullName = ''; newEmail = ''; newPassword = ''; confirmPassword = '';
  search = ''; status = 'all'; role = 'all';
  get pages() { return Math.max(1, Math.ceil(this.total() / 20)); }

  constructor() { this.load(); }

  @HostListener('window:storage', ['$event'])
  onStorage(event: StorageEvent) {
    if ((event.key === 'finanzas_ia_auth' || event.key === null)
      && this.auth.getToken() !== this.sessionToken) {
      this.users.set([]); this.summary.set(null); this.selected.set(null);
      this.clearCreateFields();
      this.router.navigate(['/admin/login']);
    }
  }

  load(page = 1) {
    if (this.loading() || this.creating()) return;
    const token = this.auth.getToken();
    this.loading.set(true); this.error.set(''); this.selected.set(null);
    forkJoin({ summary: this.api.summary(), list: this.api.users(page, this.search.trim(), this.status, this.role) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ summary, list }) => {
          if (token !== this.auth.getToken()) return;
          this.summary.set(summary); this.users.set(list.users); this.total.set(list.total);
          this.page.set(list.page); this.loading.set(false);
        },
        error: error => {
          this.loading.set(false); this.users.set([]); this.summary.set(null); this.total.set(0);
          if (error.status === 401 || error.status === 403) {
            this.router.navigate(['/admin/login']);
            return;
          }
          this.error.set('No se pudo cargar el panel. Comprueba la conexión y vuelve a intentarlo.');
        },
      });
  }

  state(user: AdminUser) { return user.deleted_at ? 'Eliminada' : user.is_active ? 'Activa' : 'Inactiva'; }

  private clearCreateFields() {
    this.newFullName = ''; this.newEmail = ''; this.newPassword = ''; this.confirmPassword = '';
  }

  toggleCreate() {
    if (this.creating()) return;
    this.showCreate.update(open => !open);
    this.clearCreateFields(); this.createError.set(''); this.createSuccess.set('');
  }

  createSuperuser() {
    if (this.creating() || this.loading()) return;
    this.createError.set(''); this.createSuccess.set('');
    const fullName = this.newFullName.trim();
    const email = this.newEmail.trim().toLowerCase();
    if (!fullName || fullName.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.createError.set('Completa un nombre y un correo válidos.'); return;
    }
    if (this.newPassword.length < 12 || new TextEncoder().encode(this.newPassword).length > 72 || !this.newPassword.trim()) {
      this.createError.set('La contraseña debe tener al menos 12 caracteres y no superar 72 bytes.'); return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.createError.set('Las contraseñas no coinciden.'); return;
    }
    const token = this.auth.getToken();
    this.creating.set(true);
    this.api.createSuperuser({ fullName, email, password: this.newPassword })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ user }) => {
          this.creating.set(false); this.clearCreateFields();
          if (token !== this.auth.getToken()) return;
          this.showCreate.set(false);
          this.createSuccess.set(`Superusuario ${user.email} creado. Puede ingresar por el acceso de administrador.`);
          this.search = user.email; this.status = 'all'; this.role = 'SUPERUSER'; this.load();
        },
        error: error => {
          this.creating.set(false); this.newPassword = ''; this.confirmPassword = '';
          if (token !== this.auth.getToken()) return;
          if (error.status === 401 || error.status === 403) {
            this.users.set([]); this.summary.set(null); this.selected.set(null); this.clearCreateFields();
            this.router.navigate(['/admin/login']); return;
          }
          this.createError.set(error.error?.message || 'No se pudo crear el superusuario. Inténtalo de nuevo.');
        },
      });
  }
}
