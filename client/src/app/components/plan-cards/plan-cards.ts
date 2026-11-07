import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Plan } from '../../services/subscription.services';

@Component({
  selector: 'app-plan-cards', standalone: true, imports: [CommonModule],
  templateUrl: './plan-cards.html', styleUrl: './plan-cards.scss'
})
export class PlanCardsComponent {
  @Input() plans: Plan[] = [];
  @Input() currentPlan = '';
  @Input() busy = false;
  @Input() publicView = false;
  @Output() choose = new EventEmitter<Plan>();
  limit(value: number): string { return value === -1 ? 'Sin límite' : String(value); }
  period(value: string): string { return value === 'YEARLY' ? 'año' : value === 'MONTHLY' ? 'mes' : value; }
}
