import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent {
  readonly authService = inject(AuthService);
  readonly links = [
    { path: '/assistant', label: 'Asistente IA', icon: '✦' },
    { path: '/dashboard', label: 'Dashboard', icon: '⌂' },
    { path: '/alerts', label: 'Alertas', icon: '♟' },
    { path: '/budgets', label: 'Presupuestos', icon: '◎' },
    { path: '/calendar', label: 'Calendario', icon: '▣' },
    { path: '/categories', label: 'Categorías', icon: '◇' },
    { path: '/expenses', label: 'Gastos', icon: '−' },
    { path: '/incomes', label: 'Ingresos', icon: '+' },
    { path: '/obligations', label: 'Obligaciones', icon: '▤' },
    { path: '/subscriptions', label: 'Suscripción', icon: '♕' }
  ];
  logout(): void { this.authService.logout(); }
}
