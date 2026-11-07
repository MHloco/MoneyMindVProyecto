import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './services/auth.services';
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { AuthComponent } from './pages/auth/auth';
import { AlertsComponent } from './pages/alerts/alerts';
import { BudgetsComponent } from './pages/budgets/budgets';
import { CalendarComponent } from './pages/calendar/calendar';
import { CategoriesComponent } from './pages/categories/categories';
import { ExpensesComponent } from './pages/expenses/expenses';
import { Incomes } from './pages/incomes/incomes';
import { ObligationsComponent } from './pages/obligations/obligations';
import { Subscriptions } from './pages/subscription/subscription';
import { adminGuard } from './guards/admin.guard';

const signedIn: CanActivateFn = () => inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/auth']);

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'admin/login', component: AuthComponent, data: { admin: true } },
  { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent) },
  { path: 'dashboard', canActivate: [signedIn], loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent) },
  { path: 'alerts', canActivate: [signedIn], loadComponent: () => import('./pages/alerts/alerts').then(m => m.AlertsComponent)},
  { path: 'budgets', canActivate: [signedIn], loadComponent: () => import('./pages/budgets/budgets').then(m => m.BudgetsComponent)},
  { path: 'calendar', canActivate: [signedIn], loadComponent: () => import('./pages/calendar/calendar').then(m => m.CalendarComponent)},
  { path: 'categories', canActivate: [signedIn], loadComponent: () => import('./pages/categories/categories').then(m => m.CategoriesComponent)},
  { path: 'expenses', canActivate: [signedIn], loadComponent: () => import('./pages/expenses/expenses').then(m => m.ExpensesComponent)},
  { path: 'incomes', canActivate: [signedIn], loadComponent: () => import('./pages/incomes/incomes').then(m => m.Incomes)},
  { path: 'obligations', canActivate: [signedIn], loadComponent: () => import('./pages/obligations/obligations').then(m => m.ObligationsComponent)},
  { path: 'subscriptions', canActivate: [signedIn],loadComponent: () => import('./pages/subscription/subscription').then(m => m.Subscriptions)},
  { path: 'assistant', canActivate: [signedIn], loadComponent: () => import('./pages/assistant/assistant').then(m => m.Assistant) },
  { path: 'subscription', redirectTo: 'subscriptions', pathMatch: 'full' },
  { path: 'login', redirectTo: 'auth', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
