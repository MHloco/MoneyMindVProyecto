import { describe, expect, it, vi } from 'vitest';
import { DashboardChartsComponent } from './dashboard-charts';
import { DashboardData } from '../../services/dashboard.services';

function setup() {
  const chart = new DashboardChartsComponent();
  chart.financial = {
    flujoMensual: Array.from({ length: 12 }, (_, i) => ({ mes: `2026-${String(i + 1).padStart(2, '0')}-01`, ingresos: 200, gastos: 50, balance: 150, movimientos: 2 })),
    gastosCategorias: [{ id: null, nombre: 'Sin categoría', total: 50, porcentaje: 100, movimientos: 1, color: '#c9a24b' }]
  } as DashboardData['financial'];
  chart.ngOnChanges();
  return chart;
}
describe('Dashboard chart interactions', () => {
  it('switches the visible range and toggles a series without changing source totals', () => {
    const chart = setup();
    chart.range = 3;
    chart.ngOnChanges();
    expect(chart.barData.labels).toHaveLength(3);
    expect(chart.months[0].mes).toBe('2026-10-01');
    chart.toggleSeries('INCOME');
    expect(chart.barData.datasets[0].hidden).toBe(true);
    expect(chart.financial.flujoMensual[0].ingresos).toBe(200);
  });
  it('uses the displayed range to resolve bar clicks and the correct category for segments', () => {
    const chart = setup();
    chart.range = 3;
    const month = vi.fn();
    const category = vi.fn();
    chart.monthSelected.subscribe(month);
    chart.categorySelected.subscribe(category);
    chart.selectBar({ active: [{ index: 0, datasetIndex: 1 }] });
    expect(month).toHaveBeenCalledWith({ month: '2026-10', type: 'EXPENSE' });
    chart.selectSlice({ active: [{ index: 0 }] });
    expect(category).toHaveBeenCalledWith(chart.financial.gastosCategorias[0]);
    chart.busy = true;
    chart.selectBar({ active: [{ index: 1, datasetIndex: 0 }] });
    expect(month).toHaveBeenCalledTimes(1);
    chart.selectSlice({ active: [] });
    expect(category).toHaveBeenCalledTimes(1);
  });
});
