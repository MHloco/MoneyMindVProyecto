import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, Observable } from 'rxjs';
import { SubscriptionService, Subscription, Plan } from '../../services/subscription.services';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { PlanCardsComponent } from '../../components/plan-cards/plan-cards';

@Component({
  selector: 'app-subscriptions', standalone: true,
  imports: [CommonModule, SidebarComponent, PlanCardsComponent],
  templateUrl: './subscription.html', styleUrl: './subscription.scss'
})
export class Subscriptions implements OnInit {
  subscription: Subscription | null = null;
  plans: Plan[] = [];
  loading = true;
  busy = false;
  errorMessage = '';
  successMessage = '';
  constructor(private subscriptionService: SubscriptionService) {}
  ngOnInit(): void { this.loadData(); }
  loadData(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({ subscription: this.subscriptionService.getSubscription(), plans: this.subscriptionService.getPlans() }).subscribe({
      next: data => { this.subscription = data.subscription; this.plans = data.plans; this.loading = false; },
      error: error => { this.errorMessage = error?.error?.message || 'No se pudo cargar la suscripción.'; this.loading = false; }
    });
  }
  changePlan(plan: Plan): void {
    if (this.busy || this.subscription?.plan_code === plan.code) return;
    if (!confirm(`¿Activar el plan ${plan.name}? En esta versión el cambio es de demostración: no se realizará ningún cobro.`)) return;
    this.perform(this.subscriptionService.changePlan(plan.code), 'Plan actualizado. No se realizó ningún cobro.');
  }
  cancel(): void {
    if (this.busy || !confirm('¿Desactivar la renovación de tu suscripción?')) return;
    this.perform(this.subscriptionService.cancelSubscription(), 'Renovación desactivada.');
  }
  reactivate(): void {
    if (this.busy) return;
    this.perform(this.subscriptionService.reactivateSubscription(), 'Suscripción reactivada.');
  }
  private perform(request: Observable<unknown>, message: string): void {
    this.busy = true;
    this.errorMessage = '';
    this.successMessage = '';
    request.subscribe({
      next: () => { this.busy = false; this.successMessage = message; this.loadData(); },
      error: error => { this.busy = false; this.errorMessage = error?.error?.message || 'No se pudo actualizar la suscripción.'; }
    });
  }
  statusLabel(status: string): string {
    return ({ ACTIVE: 'Activa', TRIALING: 'En prueba', CANCELLED: 'Cancelada', EXPIRED: 'Vencida', PAST_DUE: 'Pago pendiente' } as Record<string, string>)[status] || status;
  }
}
