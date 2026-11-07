import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DashboardService, DashboardData, DashboardCategoria } from '../../services/dashboard.services';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { DashboardChartsComponent } from '../../components/dashboard-charts/dashboard-charts';

@Component({
  selector: 'app-dashboard', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SidebarComponent, DashboardChartsComponent],
  templateUrl: './dashboard.html', styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  data: DashboardData | null = null;
  loading = true;
  errorMessage = '';
  selectedMonth = '';
  range = 6;
  movementType = '';
  selectedCategory = '';
  page = 1;
  private request?: Subscription;
  @ViewChild('movements') movements?: ElementRef<HTMLElement>;
  constructor(private dashboardService: DashboardService) {}
  ngOnInit(): void { this.cargarDashboard(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); }
  cargarDashboard(): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';
    this.request = this.dashboardService.getDashboard({
      month: this.selectedMonth, type: this.movementType, category: this.selectedCategory, page: this.page
    }).subscribe({
      next: data => {
        this.data = data;
        this.selectedMonth = data.period.month;
        this.page = data.financial.pagination.page;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'No se pudo cargar el dashboard.';
        this.loading = false;
      }
    });
  }
  selectMonth(month: string, type = '', explore = false): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < '1900-01' || month > this.maxMonth) return;
    this.selectedMonth = month;
    this.movementType = type;
    this.selectedCategory = '';
    this.page = 1;
    this.cargarDashboard();
    if (explore) this.focusMovements();
  }
  shiftMonth(offset: number): void {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    this.selectMonth(new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7));
  }
  get maxMonth(): string { return this.data?.period.today.slice(0, 7) || ''; }
  get selectedCategoryName(): string {
    return this.data?.financial.gastosCategorias.find(c => (c.id || 'uncategorized') === this.selectedCategory)?.nombre || '';
  }
  selectCategory(category: DashboardCategoria): void {
    const key = category.id || 'uncategorized';
    this.selectedCategory = this.selectedCategory === key ? '' : key;
    this.movementType = 'EXPENSE';
    this.page = 1;
    this.cargarDashboard();
    this.focusMovements();
  }
  filterType(type: string, explore = false): void {
    this.movementType = type;
    this.selectedCategory = '';
    this.page = 1;
    this.cargarDashboard();
    if (explore) this.focusMovements();
  }
  clearFilters(): void { this.filterType(''); }
  changePage(page: number): void {
    if (this.loading || page < 1 || page > (this.data?.financial.pagination.totalPages || 1)) return;
    this.page = page;
    this.cargarDashboard();
  }
  private focusMovements(): void {
    this.movements?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.movements?.nativeElement.focus({ preventScroll: true });
  }
  budgetProgress(spent: number, amount: number): number { return amount > 0 ? Math.min(100, spent / amount * 100) : 0; }
  periodLabel(date: string): string { return new Date(date.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }); }
}
