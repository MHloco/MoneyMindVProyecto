import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard';
import { DashboardService, DashboardData } from '../../services/dashboard.services';

function data(month = '2026-10'): DashboardData {
  return { period: { month, today: '2026-10-04', start: `${month}-01`, end: `${month}-04` },
    financial: { pagination: { page: 1, totalPages: 3, total: 25 },
      gastosCategorias: [{ id: null, nombre: 'Sin categoría', total: 25, color: '#c9a24b', porcentaje: 100, movimientos: 1 }] }
  } as DashboardData;
}
function setup() {
  const getDashboard = vi.fn((filters: { month?: string } = {}) => of(data(filters.month || '2026-10')));
  const component = new DashboardComponent({ getDashboard } as unknown as DashboardService);
  component.ngOnInit();
  return { component, getDashboard };
}
describe('Interactive dashboard', () => {
  it('loads the server month and requests a selected historical month', () => {
    const { component, getDashboard } = setup();
    expect(component.selectedMonth).toBe('2026-10');
    component.selectMonth('2026-09');
    expect(getDashboard).toHaveBeenLastCalledWith({ month: '2026-09', type: '', category: '', page: 1 });
    expect(component.data?.period.month).toBe('2026-09');
    expect(component.loading).toBe(false);
  });
  it('filters categories on the server and clears them when changing type or month', () => {
    const { component, getDashboard } = setup();
    component.selectCategory(data().financial.gastosCategorias[0]);
    expect(getDashboard).toHaveBeenLastCalledWith({ month: '2026-10', type: 'EXPENSE', category: 'uncategorized', page: 1 });
    component.filterType('INCOME');
    expect(component.selectedCategory).toBe('');
    component.selectMonth('2026-09');
    expect(component.movementType).toBe('');
  });
  it('prevents future/invalid months and supports year boundaries', () => {
    const { component, getDashboard } = setup();
    component.selectMonth('2026-11');
    component.selectMonth('');
    expect(getDashboard).toHaveBeenCalledTimes(1);
    component.selectMonth('2026-01');
    component.shiftMonth(-1);
    expect(component.selectedMonth).toBe('2025-12');
  });
  it('paginates and resets the page when filters change', () => {
    const { component, getDashboard } = setup();
    component.changePage(2);
    expect(getDashboard).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    component.filterType('EXPENSE');
    expect(getDashboard).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });
  it('ignores an older response after changing the selected month', () => {
    const first = new Subject<DashboardData>();
    const second = new Subject<DashboardData>();
    const getDashboard = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const component = new DashboardComponent({ getDashboard } as unknown as DashboardService);
    component.data = data();
    component.cargarDashboard();
    component.selectMonth('2026-09');
    second.next(data('2026-09'));
    first.next(data('2026-10'));
    expect(component.data?.period.month).toBe('2026-09');
    component.ngOnDestroy();
  });
  it('shows a failure without replacing financial values with demo data', () => {
    const component = new DashboardComponent({ getDashboard: () => throwError(() => ({})) } as unknown as DashboardService);
    component.ngOnInit();
    expect(component.errorMessage).toContain('No se pudo');
    expect(component.data).toBeNull();
    expect(component.loading).toBe(false);
  });
});
