import { SidebarComponent } from '../../components/sidebar/sidebar';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Category,
  CategoryService
} from '../../services/category.services';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [SidebarComponent,
    CommonModule,
    FormsModule,
    ],
  templateUrl: './categories.html',
  styleUrl: './categories.scss'
})
export class CategoriesComponent implements OnInit {

  activeTab: 'INCOME' | 'EXPENSE' = 'INCOME';

  categories: Category[] = [];

  loading = true;
  errorMessage = '';

  showForm = false;
  editingCategory: Category | null = null;

  name = '';
  color = '#607D8B';
  icon = 'category';
  parentId: string | null = null;

  constructor(
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  changeTab(
    type: 'INCOME' | 'EXPENSE'
  ): void {

    this.activeTab = type;

    this.closeForm();

    this.loadCategories();
  }

  loadCategories(): void {

  this.loading = true;
  this.errorMessage = '';

  this.categoryService
    .getCategories(this.activeTab)
    .subscribe({

      next: (response) => {

        this.categories = response.categories ?? [];

        this.loading = false;
      },

      error: (error) => {

        console.error('Error cargando categorías:', error);

        this.categories = [];

        this.errorMessage =
          error?.error?.message ||
          'No se pudieron cargar las categorías.';

        this.loading = false;
      }

    });
  }

  get systemCategories(): Category[] {
    return this.categories.filter(
      category => category.is_system
    );
  }

  get userCategories(): Category[] {
    return this.categories.filter(
      category => !category.is_system
    );
  }

  get rootUserCategories(): Category[] {
    return this.userCategories.filter(
      category => !category.parent_id
    );
  }

  getChildren(parentId: string): Category[] {
    return this.userCategories.filter(
      category => category.parent_id === parentId
    );
  }

  openCreateForm(parentId: string | null = null): void {

    this.editingCategory = null;

    this.name = '';
    this.color = '#607D8B';
    this.icon = 'category';
    this.parentId = parentId;

    this.showForm = true;
  }

  openEditForm(category: Category): void {

    if (category.is_system) {
      return;
    }

    this.editingCategory = category;

    this.name = category.name;
    this.color = category.color;
    this.icon = category.icon;
    this.parentId = category.parent_id;

    this.showForm = true;
  }

  closeForm(): void {

    this.showForm = false;
    this.editingCategory = null;

    this.name = '';
    this.color = '#607D8B';
    this.icon = 'category';
    this.parentId = null;
  }

  saveCategory(): void {

    if (!this.name.trim()) {
      return;
    }

    if (this.editingCategory) {

      this.categoryService
        .updateCategory(
          this.editingCategory.id,
          {
            name: this.name.trim(),
            color: this.color,
            icon: this.icon,
            parent_id: this.parentId
          }
        )
        .subscribe({
          next: () => {
            this.closeForm();
            this.loadCategories();
          },

          error: (error) => {
            console.error(error);

            this.errorMessage =
              error?.error?.message ||
              'No se pudo actualizar la categoría.';
          }
        });

      return;
    }

    this.categoryService
      .createCategory({
        name: this.name.trim(),
        type: this.activeTab,
        color: this.color,
        icon: this.icon,
        parent_id: this.parentId
      })
      .subscribe({
        next: () => {
          this.closeForm();
          this.loadCategories();
        },

        error: (error) => {
          console.error(error);

          this.errorMessage =
            error?.error?.message ||
            'No se pudo crear la categoría.';
        }
      });
  }

  deleteCategory(category: Category): void {

    if (category.is_system) {
      return;
    }

    const confirmed = confirm(
      `¿Eliminar la categoría "${category.name}"?`
    );

    if (!confirmed) {
      return;
    }

    this.categoryService
      .deleteCategory(category.id)
      .subscribe({
        next: () => {
          this.loadCategories();
        },

        error: (error) => {
          console.error(error);

          this.errorMessage =
            error?.error?.message ||
            'No se pudo eliminar la categoría.';
        }
      });
  }
}