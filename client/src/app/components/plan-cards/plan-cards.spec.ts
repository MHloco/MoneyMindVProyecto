import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PlanCardsComponent } from './plan-cards';
import { Plan } from '../../services/subscription.services';

describe('Plan cards', () => {
  it('renders real prices and unlimited plan limits', async () => {
    await TestBed.configureTestingModule({ imports: [PlanCardsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PlanCardsComponent);
    fixture.componentRef.setInput('plans', [{ code: 'PRO', name: 'Pro', price: 19.9, currency: 'PEN', billing_period: 'MONTHLY', max_budgets: -1, max_obligations: -1, max_ai_queries: -1 } as Plan]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('19.90');
    expect(fixture.nativeElement.textContent).toContain('Sin límite');
    expect(fixture.nativeElement.textContent).not.toContain('-1');
  });
});
