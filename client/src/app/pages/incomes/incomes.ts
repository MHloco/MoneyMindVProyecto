import { SidebarComponent } from '../../components/sidebar/sidebar';
import { Component, OnInit } from '@angular/core';
import { IncomeService, Income, IncomeMetrics } from '../../services/income.services';
import { CategoryService, Category } from '../../services/category.services';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-incomes',
  standalone: true,
  imports: [SidebarComponent,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    
    ],
  templateUrl: './incomes.html',
  styleUrl: './incomes.scss'
})
export class Incomes implements OnInit {

  incomes: Income[] = [];
  categories: Category[] = [];

  metrics: IncomeMetrics = {
    current_month: 0,
    previous_month: 0
  };

  filters = {
    startDate: '',
    endDate: '',
    source: ''
  };

  page = 1;
  limit = 10;
  total = 0;
  totalPages = 0;

  showForm = false;
  saving = false;
  formError = '';
  errorMessage = '';
  editingId: string | null = null;

  // Corrección Error 2: Tipado explícito de form para permitir number | null en amount
  form: {
    amount: number | null;
    transaction_date: string;
    category_id: string;
    source: string;
    payment_method: string;
    notes: string;
  } = {
    amount: null,
    transaction_date: this.today(),
    category_id: '',
    source: '',
    payment_method: 'CASH',
    notes: ''
  };

  paymentMethods = [
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'TRANSFER',
    'WALLET',
    'YAPE',
    'PLIN',
    'OTHER'
  ];

  constructor(
    private incomeService: IncomeService,
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadMetrics();
    this.loadIncomes();
  }

  loadCategories(): void {
    this.categoryService.getCategories('INCOME').subscribe({
      // Corrección Error 1: Asignar response.categories en lugar de response
      next: response => this.categories = response.categories,
      error: error => this.errorMessage = error?.error?.message || 'No se pudieron cargar las categorías.'
    });
  }

  loadMetrics(): void {
    this.incomeService.getMetrics().subscribe({
      next: data => this.metrics = data,
      error: error => this.errorMessage = error?.error?.message || 'No se pudo cargar el resumen de ingresos.'
    });
  }

  loadIncomes(): void {
    this.incomeService.getIncomes({
      ...this.filters,
      page: this.page,
      limit: this.limit
    }).subscribe({
      next: response => {
        this.incomes = response.data;
        this.total = response.pagination.total;
        this.totalPages = response.pagination.totalPages;
      },
      error: error => this.errorMessage = error?.error?.message || 'No se pudieron cargar los ingresos.'
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadIncomes();
  }

  clearFilters(): void {
    this.filters = {
      startDate: '',
      endDate: '',
      source: ''
    };

    this.page = 1;
    this.loadIncomes();
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadIncomes();
    }
  }

  previousPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadIncomes();
    }
  }

  openCreate(): void {
    this.formError = '';
    this.editingId = null;

    this.form = {
      amount: null,
      transaction_date: this.today(),
      category_id: '',
      source: '',
      payment_method: 'CASH',
      notes: ''
    };

    this.showForm = true;
  }

  openEdit(income: Income): void {
    this.formError = '';
    this.editingId = income.id;

    this.form = {
      amount: Number(income.amount),
      transaction_date: income.transaction_date.slice(0, 10),
      category_id: income.category_id || '',
      source: income.source || '',
      payment_method: income.payment_method === 'BANK_TRANSFER' ? 'TRANSFER' : income.payment_method,
      notes: income.notes || ''
    };

    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.showForm = false;
  }

  save(): void {
    if (this.saving) return;
    this.formError = '';
    if (
      !Number.isFinite(Number(this.form.amount)) ||
      Number(this.form.amount) <= 0 ||
      Math.abs(Number(this.form.amount) * 100 - Math.round(Number(this.form.amount) * 100)) > 0.00001 ||
      !this.form.transaction_date ||
      !this.form.payment_method
    ) {
      this.formError = 'Ingresa un monto positivo con hasta dos decimales, una fecha y un método de cobro.';
      return;
    }

    const request = this.editingId
      ? this.incomeService.updateIncome(this.editingId, this.form)
      : this.incomeService.createIncome(this.form);

    this.saving = true;
    request.subscribe({
      next: () => {
        this.saving = false;
        this.closeForm();
        this.loadIncomes();
        this.loadMetrics();
      },
      error: error => {
        this.saving = false;
        this.formError = error?.error?.message || 'No se pudo guardar el ingreso. Inténtalo de nuevo.';
      }
    });
  }

  deleteIncome(id: string): void {
    if (!confirm('¿Eliminar este ingreso?')) {
      return;
    }

    this.incomeService.deleteIncome(id).subscribe({
      next: () => {
        if (this.incomes.length === 1 && this.page > 1) this.page--;
        this.loadIncomes();
        this.loadMetrics();
      },
      error: error => this.errorMessage = error?.error?.message || 'No se pudo eliminar el ingreso.'
    });
  }

  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  paymentLabel(method: string): string {
    const labels: Record<string, string> = {
      CASH: 'Efectivo', CREDIT_CARD: 'Tarjeta de crédito', DEBIT_CARD: 'Tarjeta de débito',
      BANK_TRANSFER: 'Transferencia', TRANSFER: 'Transferencia', WALLET: 'Billetera digital',
      YAPE: 'Yape', PLIN: 'Plin', OTHER: 'Otro'
    };
    return labels[method] || method;
  }
}
