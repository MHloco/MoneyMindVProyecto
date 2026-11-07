import { SidebarComponent } from '../../components/sidebar/sidebar';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Expense,
  ExpenseDistribution,
  ExpenseService
} from '../../services/expense.services';

import {
  Category,
  CategoryService
} from '../../services/category.services';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [SidebarComponent,
    CommonModule,
    FormsModule,
    
    ],
  templateUrl: './expenses.html',
  styleUrl: './expenses.scss'
})
export class ExpensesComponent implements OnInit {

  expenses: Expense[] = [];
  categories: Category[] = [];
  distribution: ExpenseDistribution[] = [];

  loading = true;
  errorMessage = '';

  page = 1;
  limit = 10;
  totalPages = 1;
  total = 0;

  startDate = '';
  endDate = '';
  categoryId = '';
  paymentMethod = '';
  search = '';

  selectedMonth = new Date().toISOString().slice(0, 7) + '-01';

  showForm = false;
  editingExpense: Expense | null = null;

  amount: number | null = null;
  transactionDate = '';
  selectedCategory = '';
  selectedPaymentMethod = 'CASH';
  description = '';
  notes = '';
  tagsInput = '';

  paymentMethods = [
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'BANK_TRANSFER',
    'YAPE',
    'PLIN',
    'OTHER'
  ];

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadExpenses();
    this.loadDistribution();
  }

  loadCategories(): void {
    this.categoryService
      .getCategories('EXPENSE')
      .subscribe({
        next: (response) => {
          this.categories = response.categories;
        },
        error: (error) => {
          console.error(error);
        }
      });
  }

  loadExpenses(): void {
    this.loading = true;
    this.errorMessage = '';

    this.expenseService
      .getExpenses({
        startDate: this.startDate,
        endDate: this.endDate,
        categoryId: this.categoryId,
        paymentMethod: this.paymentMethod,
        search: this.search,
        page: this.page,
        limit: this.limit
      })
      .subscribe({
        next: (response) => {
          this.expenses = response.expenses;
          this.total = response.pagination.total;
          this.totalPages = response.pagination.totalPages;
          this.loading = false;
        },
        error: (error) => {
          console.error(error);
          this.errorMessage =
            error?.error?.message ||
            'No se pudieron cargar los gastos.';
          this.loading = false;
        }
      });
  }

  loadDistribution(): void {
    this.expenseService
      .getDistribution(this.selectedMonth)
      .subscribe({
        next: (data) => {
          this.distribution = data;
        },
        error: (error) => {
          console.error(error);
          this.distribution = [];
        }
      });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadExpenses();
  }

  clearFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.categoryId = '';
    this.paymentMethod = '';
    this.search = '';

    this.page = 1;

    this.loadExpenses();
  }

  previousPage(): void {
    if (this.page <= 1) {
      return;
    }

    this.page--;
    this.loadExpenses();
  }

  nextPage(): void {
    if (this.page >= this.totalPages) {
      return;
    }

    this.page++;
    this.loadExpenses();
  }

  openCreateForm(): void {
    this.editingExpense = null;
    this.amount = null;
    this.transactionDate = new Date().toISOString().substring(0, 10);
    this.selectedCategory = '';
    this.selectedPaymentMethod = 'CASH';
    this.description = '';
    this.notes = '';
    this.tagsInput = '';

    this.showForm = true;
  }

  openEditForm(expense: Expense): void {
    this.editingExpense = expense;
    this.amount = expense.amount;
    this.transactionDate = expense.transaction_date.substring(0, 10);
    this.selectedCategory = expense.category_id || '';
    this.selectedPaymentMethod = expense.payment_method;
    this.description = expense.description;
    this.notes = expense.notes || '';
    this.tagsInput = expense.tags.join(', ');

    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingExpense = null;
  }

  saveExpense(): void {
    if (
      !this.amount ||
      !this.transactionDate ||
      !this.selectedCategory ||
      !this.description.trim()
    ) {
      return;
    }

    const tags = this.tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const data = {
      amount: this.amount,
      transaction_date: this.transactionDate,
      category_id: this.selectedCategory,
      payment_method: this.selectedPaymentMethod,
      description: this.description.trim(),
      notes: this.notes.trim(),
      tags
    };

    if (this.editingExpense) {
      this.expenseService
        .updateExpense(
          this.editingExpense.id,
          data
        )
        .subscribe({
          next: () => {
            this.closeForm();
            this.loadExpenses();
            this.loadDistribution();
          },
          error: (error) => {
            console.error(error);
            this.errorMessage =
              error?.error?.message ||
              'No se pudo actualizar el gasto.';
          }
        });

      return;
    }

    this.expenseService
      .createExpense(data)
      .subscribe({
        next: () => {
          this.closeForm();
          this.loadExpenses();
          this.loadDistribution();
        },
        error: (error) => {
          console.error(error);
          this.errorMessage =
            error?.error?.message ||
            'No se pudo registrar el gasto.';
        }
      });
  }

  deleteExpense(expense: Expense): void {
    const confirmed = confirm(
      `¿Eliminar el gasto "${expense.description}"?`
    );

    if (!confirmed) {
      return;
    }

    this.expenseService
      .deleteExpense(expense.id)
      .subscribe({
        next: () => {
          this.loadExpenses();
          this.loadDistribution();
        },
        error: (error) => {
          console.error(error);
          this.errorMessage =
            error?.error?.message ||
            'No se pudo eliminar el gasto.';
        }
      });
  }

  getCategoryOptions(): Category[] {
    return this.categories.filter(
      category => category.type === 'EXPENSE'
    );
  }
}
