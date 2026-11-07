import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router,RouterLink } from '@angular/router';

import {
  AuthService
} from '../../services/auth.services';


@Component({
  selector: 'app-auth',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],

  templateUrl: './auth.html',
  styleUrl: './auth.scss'
})
export class AuthComponent {

  email = '';
  password = '';

  errorMessage = '';
  loading = false;

  isRegistering = false;
  readonly adminMode: boolean;


  constructor(
    private router: Router,
    private authService: AuthService,
    route: ActivatedRoute
  ) { this.adminMode = route.snapshot.data['admin'] === true; }


  submit(): void {
    if (this.loading) return;

    this.errorMessage = '';

    const email =
      this.email.trim().toLowerCase();

    const password =
      this.password;


    if (!email || !password) {

      this.errorMessage =
        'Completa todos los campos.';

      return;
    }


    if (!this.isValidEmail(email)) {

      this.errorMessage =
        'Ingresa un correo válido.';

      return;
    }


    if (
      this.isRegistering &&
      password.length < 8
    ) {

      this.errorMessage =
        'La contraseña debe tener mínimo 8 caracteres.';

      return;
    }


    this.loading = true;


    const request = this.isRegistering
      ? this.authService.register(
          email,
          password
        )
      : this.authService.login(
          email,
          password,
          this.adminMode
        );


    request.subscribe({

      next: (response) => {

        this.loading = false;

        this.router.navigate([
          response.user.role === 'SUPERUSER' ? '/admin' : '/dashboard'
        ]);

      },

      error: (error) => {

        this.loading = false;

        this.errorMessage =
          error?.error?.message ||
          'Ocurrió un error.';

      }

    });
  }


  toggleMode(): void {
    if (this.adminMode || this.loading) return;

    this.isRegistering =
      !this.isRegistering;

    this.email = '';
    this.password = '';
    this.errorMessage = '';
  }


  private isValidEmail(
    email: string
  ): boolean {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email);
  }
}
