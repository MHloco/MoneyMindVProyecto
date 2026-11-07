import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { HomeHeroComponent } from '../../components/home-hero/home-hero';
import { PlanCardsComponent } from '../../components/plan-cards/plan-cards';
import { SubscriptionService, Plan } from '../../services/subscription.services';
import { NewsletterService } from '../../services/newsletter.service';

interface FeatureCard {
  icon: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, PlanCardsComponent, HomeHeroComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnInit {
  email: string = '';
  plans: Plan[] = [];
  plansLoading = true;
  plansError = '';
  message = '';
  loading = false;
  scrolled = false;

  readonly cards: FeatureCard[] = [
    {
      icon: '◈',
      title: 'Presupuestos claros',
      desc: 'Organiza tus ingresos y gastos con categorías inteligentes y alertas personalizadas.',
    },
    {
      icon: '✦',
      title: 'Ahorro con propósito',
      desc: 'Define metas de ahorro realistas y observa tu progreso mes a mes con reportes visuales.',
    },
    {
      icon: '◇',
      title: 'Educación financiera',
      desc: 'Contenido guiado sobre inversión, deuda y hábitos saludables para tu crecimiento personal.',
    },
    {
      icon: '✧',
      title: 'Comunidad V',
      desc: 'Únete a una comunidad que comparte estrategias, experiencias y motivación constante.',
    },
  ];

  constructor(
    private router: Router,
    private subscriptionService: SubscriptionService,
    private newsletterService: NewsletterService
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.plansLoading = true;
    this.plansError = '';

    this.subscriptionService.getPlans().subscribe({
      next: (plans) => {
        this.plans = plans;
        this.plansLoading = false;
      },
      error: () => {
        this.plansError = 'No se pudieron cargar los planes. Inténtalo de nuevo.';
        this.plansLoading = false;
      },
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled = window.scrollY > 60;
  }

  onJoin(): void {
    const cleanEmail = this.email.trim();
    if (!cleanEmail || this.loading) return;

    this.loading = true;
    this.message = 'Procesando...';

    this.newsletterService.subscribe(cleanEmail).subscribe({
      next: (res) => {
        this.message = res.message;
        this.email = '';
        this.loading = false;
      },
      error: (err) => {
        this.message = err.error?.message || 'Error al procesar la solicitud.';
        this.loading = false;
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/auth']);
  }
}
