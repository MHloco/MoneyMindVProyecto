import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import { ActiveElement, ArcElement, BarController, BarElement, CategoryScale, ChartData, ChartOptions, DoughnutController, LinearScale, Tooltip } from 'chart.js';
import { DashboardCategoria, DashboardData } from '../../services/dashboard.services';

@Component({
  selector: 'app-dashboard-charts', standalone: true,
  imports: [CommonModule, BaseChartDirective],
  providers: [provideCharts({ registerables: [BarController, BarElement, CategoryScale, LinearScale, DoughnutController, ArcElement, Tooltip] })],
  templateUrl: './dashboard-charts.html', styleUrl: './dashboard-charts.scss'
})
export class DashboardChartsComponent implements OnChanges {
  @Input({ required: true }) financial!: DashboardData['financial'];
  @Input() currency = 'PEN';
  @Input() range = 12;
  @Input() category = '';
  @Input() busy = false;
  @Output() monthSelected = new EventEmitter<{ month: string; type: string }>();
  @Output() categorySelected = new EventEmitter<DashboardCategoria>();
  showIncome = true;
  showExpenses = true;
  barData: ChartData<'bar'> = { labels: [], datasets: [] };
  donutData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  barOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#b5b0a6' } },
      y: { beginAtZero: true, grid: { color: '#ffffff0d' }, ticks: { color: '#b5b0a6' } }
    },
    plugins: { tooltip: { backgroundColor: '#24211a', titleColor: '#e3c77e', padding: 12,
      callbacks: { label: item => `${item.dataset.label}: ${this.money(Number(item.raw))}` } } }
  };
  donutOptions: ChartOptions<'doughnut'> = {
    responsive: true, maintainAspectRatio: false, animation: false, cutout: '72%',
    plugins: { tooltip: { backgroundColor: '#24211a', titleColor: '#e3c77e', padding: 12,
      callbacks: { label: item => `${this.money(Number(item.raw))} · ${this.total ? (Number(item.raw) / this.total * 100).toFixed(1) : 0}%` } } }
  };
  get months() { return this.financial.flujoMensual.slice(-this.range); }
  get total() { return this.financial.gastosCategorias.reduce((sum, category) => sum + category.total, 0); }
  ngOnChanges(): void { this.updateCharts(); }
  updateCharts(): void {
    this.barData = {
      labels: this.months.map(month => new Date(month.mes.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-PE', { month: 'short', year: '2-digit' })),
      datasets: [
        { label: 'Ingresos', data: this.months.map(m => m.ingresos), backgroundColor: '#9bcca4', hoverBackgroundColor: '#c7edcd', borderRadius: 5, hidden: !this.showIncome },
        { label: 'Gastos', data: this.months.map(m => m.gastos), backgroundColor: '#c9a24b', hoverBackgroundColor: '#f4d995', borderRadius: 5, hidden: !this.showExpenses }
      ]
    };
    this.donutData = {
      labels: this.financial.gastosCategorias.map(c => c.nombre),
      datasets: [{ data: this.financial.gastosCategorias.map(c => c.total),
        backgroundColor: this.financial.gastosCategorias.map(c => /^#[\da-f]{6}$/i.test(c.color) ? c.color : '#c9a24b'),
        borderColor: '#111113', borderWidth: 3, hoverOffset: 12,
        offset: this.financial.gastosCategorias.map(c => this.category === (c.id || 'uncategorized') ? 10 : 0) }]
    };
  }
  toggleSeries(type: 'INCOME' | 'EXPENSE'): void {
    if (type === 'INCOME') this.showIncome = !this.showIncome;
    else this.showExpenses = !this.showExpenses;
    this.updateCharts();
  }
  selectBar(event: { active?: object[] }): void {
    const hit = event.active?.[0] as ActiveElement | undefined;
    if (!this.busy && hit && this.months[hit.index]) {
      this.monthSelected.emit({ month: this.months[hit.index].mes.slice(0, 7), type: hit.datasetIndex === 0 ? 'INCOME' : 'EXPENSE' });
    }
  }
  selectSlice(event: { active?: object[] }): void {
    const hit = event.active?.[0] as ActiveElement | undefined;
    if (!this.busy && hit && this.financial.gastosCategorias[hit.index]) this.categorySelected.emit(this.financial.gastosCategorias[hit.index]);
  }
  money(value: number): string { return new Intl.NumberFormat('es-PE', { style: 'currency', currency: this.currency }).format(value); }
}
