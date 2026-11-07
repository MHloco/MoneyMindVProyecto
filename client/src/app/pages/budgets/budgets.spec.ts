import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetsComponent } from './budgets';
import { Budget, BudgetService } from '../../services/budget.services';

describe('Budget categories', () => {
  let fixture: ComponentFixture<BudgetsComponent>;
  let http: HttpTestingController;
  const url = '/api/categories/user?type=EXPENSE';
  const category = {
    id: 'personal-1', user_id: 'user-1', parent_id: 'system-parent',
    name: 'Comidas', type: 'EXPENSE', is_system: false, is_active: true
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetsComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: BudgetService, useValue: { getBudgets: () => of({ budgets: [] }), createBudget: vi.fn(() => of({})) } }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BudgetsComponent);
    fixture.componentInstance.showForm = true;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('renders personal expense subcategories as selectable options', async () => {
    const request = http.expectOne(url);
    expect(request.request.method).toBe('GET');
    request.flush({ categories: [category] });
    fixture.detectChanges();
    await fixture.whenStable();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(select.disabled).toBe(false);
    expect(select.options[1].textContent?.trim()).toBe('Comidas');
    select.value = category.id;
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.form.categoryId).toBe(category.id);
  });

  it('shows a retryable loading error instead of claiming the user has no categories', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    http.expectOne(url).flush({ message: 'Error de conexión' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('No tienes categorías');
    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('Error de conexión');
    alert.querySelector('button')!.click();
    http.expectOne(url).flush({ categories: [category] });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.categoriesError).toBe('');
    expect(fixture.componentInstance.categories[0].id).toBe(category.id);
  });

  it('reloads when reopening the form and clears a category that is no longer available', () => {
    http.expectOne(url).flush({ categories: [category] });
    fixture.componentInstance.form.categoryId = category.id;
    fixture.componentInstance.toggleForm();
    http.expectNone(url);
    fixture.componentInstance.toggleForm();
    http.expectOne(url).flush({ categories: [] });
    expect(fixture.componentInstance.form.categoryId).toBe('');
    expect(fixture.componentInstance.categories).toEqual([]);
  });

  function fillOverlappingBudget() {
    http.expectOne(url).flush({ categories: [category] });
    const component = fixture.componentInstance;
    component.budgets = [{
      id: 'budget-1', categoryId: category.id, categoryName: 'Comidas', name: 'Ahorro existente',
      isActive: true, periodStart: '2026-10-01T05:00:00.000Z', periodEnd: '2026-12-12T05:00:00.000Z',
      amount: 800, spent: 0, remaining: 800, percentage: 0, currency: 'PEN', status: 'NORMAL'
    } as Budget];
    Object.assign(component.form, { categoryId: category.id, name: 'Otro objetivo', amount: 100,
      periodStart: '2026-10-11', periodEnd: '2026-10-31' });
    return component;
  }

  it('explains the conflicting budget and prevents submitting overlapping dates', () => {
    const component = fillOverlappingBudget();
    fixture.detectChanges();
    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('Ahorro existente');
    expect(alert.textContent).toContain('01/10/2026');
    expect(alert.textContent).toContain('12/12/2026');
    component.createBudget();
    expect(TestBed.inject(BudgetService).createBudget).not.toHaveBeenCalled();
  });

  it('includes the final day but allows the next day, another category and inactive budgets', () => {
    const component = fillOverlappingBudget();
    component.form.periodStart = '2026-12-12';
    component.form.periodEnd = '2026-12-31';
    expect(component.conflictingBudget?.id).toBe('budget-1');
    component.form.periodStart = '2026-12-13';
    expect(component.conflictingBudget).toBeUndefined();
    component.createBudget();
    expect(TestBed.inject(BudgetService).createBudget).toHaveBeenCalledOnce();
    Object.assign(component.form, { categoryId: 'another-category', periodStart: '2026-10-11', periodEnd: '2026-10-31' });
    expect(component.conflictingBudget).toBeUndefined();
    component.form.categoryId = category.id;
    component.budgets = [{ id: 'inactive', categoryId: category.id, isActive: false,
      periodStart: '2026-10-01', periodEnd: '2026-12-12' } as Budget];
    expect(component.conflictingBudget).toBeUndefined();
  });

  it('rejects reversed dates before sending a budget', () => {
    const component = fillOverlappingBudget();
    component.form.periodEnd = '2026-10-01';
    component.createBudget();
    expect(component.errorMessage).toContain('fecha de fin');
    expect(TestBed.inject(BudgetService).createBudget).not.toHaveBeenCalled();
  });
});
