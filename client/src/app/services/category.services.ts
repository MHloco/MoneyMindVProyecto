import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Category {
  id: string;
  user_id: string | null;
  parent_id: string | null;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string;
  icon: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoriesResponse {
  categories: Category[];
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  private readonly API_URL =
    '/api/categories';

  constructor(private http: HttpClient) {}

  getCategories(
    type: 'INCOME' | 'EXPENSE'
  ): Observable<CategoriesResponse> {

    return this.http.get<CategoriesResponse>(
      `${this.API_URL}?type=${type}`
    );
  }

  getUserCategories(
  type: 'INCOME' | 'EXPENSE'
): Observable<CategoriesResponse> {

  return this.http.get<CategoriesResponse>(
    `${this.API_URL}/user?type=${type}`
  );
}

  createCategory(data: {
    name: string;
    type: 'INCOME' | 'EXPENSE';
    color: string;
    icon: string;
    parent_id?: string | null;
  }): Observable<{ category: Category }> {

    return this.http.post<{ category: Category }>(
      this.API_URL,
      data
    );
  }

  updateCategory(
    id: string,
    data: {
      name?: string;
      color?: string;
      icon?: string;
      parent_id?: string | null;
    }
  ): Observable<{ category: Category }> {

    return this.http.put<{ category: Category }>(
      `${this.API_URL}/${id}`,
      data
    );
  }

  deleteCategory(
    id: string
  ): Observable<any> {

    return this.http.delete(
      `${this.API_URL}/${id}`
    );
  }
}