import { SidebarComponent } from '../../components/sidebar/sidebar';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Budget, BudgetService } from '../../services/budget.services';
import { RouterLink } from '@angular/router';
import { Category, CategoryService } from '../../services/category.services';


@Component({
  selector: 'app-budgets',
  standalone: true,

  imports: [SidebarComponent,
    CommonModule,
    FormsModule,
    RouterLink
  ],

  templateUrl: './budgets.html',
  styleUrl: './budgets.scss'
})
export class BudgetsComponent
  implements OnInit {

  budgets: Budget[] = [];

  categories: Category[] = [];

  categoriesLoading = true;
  categoriesError = '';

  loading = true;

  errorMessage = '';

  showForm = false;


  form = {

    categoryId: '',

    name: '',

    amount: 0,

    periodType: 'MONTHLY',

    periodStart: '',

    periodEnd: '',

    alertThreshold: 0.80,

    rollover: false

  };


  constructor(
    private budgetService: BudgetService,
    private categoryService: CategoryService
  ) {}


  ngOnInit(): void {

    this.loadBudgets();
    this.loadCategories();

  }

  loadBudgets(): void {

    this.loading = true;


    this.budgetService
      .getBudgets()
      .subscribe({

        next: (response) => {

          this.budgets =
            response.budgets;

          this.loading = false;

        },

        error: (error) => {

          console.error(error);

          this.errorMessage =
            error?.error?.message ||
            'No se pudieron cargar los presupuestos.';

          this.loading = false;

        }

      });
  }

  loadCategories(): void {
    this.categoriesLoading = true;
    this.categoriesError = '';

    this.categoryService.getUserCategories('EXPENSE').subscribe({
      next: (response) => {
        this.categories = response.categories;
        if (!this.categories.some(category => category.id === this.form.categoryId)) {
          this.form.categoryId = '';
        }
        this.categoriesLoading = false;
      },
      error: (error) => {
        console.error('Error cargando categorías:', error);
        this.categories = [];
        this.form.categoryId = '';
        this.categoriesLoading = false;
        this.categoriesError =
          error?.error?.message ||
          'No se pudieron cargar las categorías.';
      }
    });
  }

  toggleForm(): void {
    this.errorMessage = '';
    this.showForm = !this.showForm;
    if (this.showForm && !this.categoriesLoading) {
      this.loadCategories();
    }
  }

  get conflictingBudget(): Budget | undefined {
    const { categoryId, periodStart, periodEnd } = this.form;
    if (!categoryId || !periodStart || !periodEnd || periodEnd < periodStart) return undefined;
    return this.budgets.find(budget => budget.isActive && budget.categoryId === categoryId
      && budget.periodStart.slice(0, 10) <= periodEnd
      && budget.periodEnd.slice(0, 10) >= periodStart);
  }

  formatDate(value: string): string {
    return value.slice(0, 10).split('-').reverse().join('/');
  }


  createBudget(): void {

    this.errorMessage = '';


    if (
      !this.form.categoryId ||
      !this.form.name ||
      !this.form.amount ||
      !this.form.periodStart ||
      !this.form.periodEnd
    ) {

      this.errorMessage =
        'Completa todos los campos obligatorios.';

      return;
    }


    if (this.form.periodEnd < this.form.periodStart) {
      this.errorMessage = 'La fecha de fin debe ser igual o posterior a la fecha de inicio.';
      return;
    }

    if (this.conflictingBudget) return;

    this.budgetService
      .createBudget(this.form)
      .subscribe({

        next: () => {

          this.showForm = false;

          this.resetForm();

          this.loadBudgets();

        },

        error: (error) => {

          console.error(error);

          this.errorMessage =
            error?.error?.message ||
            'No se pudo crear el presupuesto.';

        }

      });
  }


  deleteBudget(
    budget: Budget
  ): void {

    if (
      !confirm(
        '¿Deseas eliminar este presupuesto?'
      )
    ) {
      return;
    }


    this.budgetService
      .deleteBudget(budget.id)
      .subscribe({

        next: () => {

          this.loadBudgets();

        },

        error: (error) => {

          console.error(error);

        }

      });
  }


  resetForm(): void {

    this.form = {

      categoryId: '',

      name: '',

      amount: 0,

      periodType: 'MONTHLY',

      periodStart: '',

      periodEnd: '',

      alertThreshold: 0.80,

      rollover: false

    };
  }


  getStatusClass(
    status: string
  ): string {

    return status.toLowerCase();

  }
}
