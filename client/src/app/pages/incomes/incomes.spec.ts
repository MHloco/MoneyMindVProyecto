import { describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { Incomes } from './incomes';
import { Income, IncomeService } from '../../services/income.services';
import { CategoryService } from '../../services/category.services';

describe('Income form', () => {
  function setup() {
    const response = new Subject<any>();
    const service = {
      createIncome: vi.fn(() => response),
      getIncomes: vi.fn(() => of({ data: [], pagination: { total: 0, totalPages: 0 } })),
      getMetrics: vi.fn(() => of({ current_month: 0, previous_month: 0 }))
    };
    const component = new Incomes(service as unknown as IncomeService, {} as CategoryService);
    component.openCreate();
    component.form.amount = 10;
    return { component, response, service };
  }

  it('normalizes the API timestamp when editing the date input', () => {
    const { component } = setup();
    component.openEdit({ id: 'income', transaction_date: '2026-10-03T05:00:00.000Z', amount: 5, payment_method: 'CASH' } as Income);
    expect(component.form.transaction_date).toBe('2026-10-03');
  });

  it('prevents duplicate saves and refreshes after success', () => {
    const { component, response, service } = setup();
    component.save(); component.save();
    expect(service.createIncome).toHaveBeenCalledTimes(1);
    response.next({});
    expect(component.showForm).toBe(false);
    expect(service.getMetrics).toHaveBeenCalled();
  });

  it('keeps user input and exposes a failed save', () => {
    const { component, response } = setup();
    component.save();
    response.error({ error: { message: 'No se pudo guardar.' } });
    expect(component.formError).toBe('No se pudo guardar.');
    expect(component.saving).toBe(false);
    expect(component.form.amount).toBe(10);
    expect(component.showForm).toBe(true);
  });

  it.each([0, -1, NaN, 0.001])('rejects invalid amount %s', amount => {
    const { component, service } = setup();
    component.form.amount = amount;
    component.save();
    expect(service.createIncome).not.toHaveBeenCalled();
    expect(component.formError).not.toBe('');
  });
});
