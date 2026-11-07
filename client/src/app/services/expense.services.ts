import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Expense {
  id: string;
  category_id: string | null;

  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;

  amount: number;
  currency: string;

  description: string;
  notes: string | null;

  transaction_date: string;

  payment_method: string;

  tags: string[];

  created_at: string;
  updated_at: string;
}

export interface ExpenseResponse {
  expenses: Expense[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ExpenseDistribution {
  category_id: string | null;
  category_name: string;
  category_color: string;
  total: number;
  movements: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {

  private readonly API_URL =
    '/api/expenses';

  constructor(
    private http: HttpClient
  ) {}


  getExpenses(filters: {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    paymentMethod?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Observable<ExpenseResponse> {

    let params = new HttpParams();

    if (filters.startDate) {
      params = params.set(
        'startDate',
        filters.startDate
      );
    }

    if (filters.endDate) {
      params = params.set(
        'endDate',
        filters.endDate
      );
    }

    if (filters.categoryId) {
      params = params.set(
        'categoryId',
        filters.categoryId
      );
    }

    if (filters.paymentMethod) {
      params = params.set(
        'paymentMethod',
        filters.paymentMethod
      );
    }

    if (filters.search) {
      params = params.set(
        'search',
        filters.search
      );
    }

    params = params.set(
      'page',
      filters.page || 1
    );

    params = params.set(
      'limit',
      filters.limit || 10
    );

    return this.http.get<ExpenseResponse>(
      this.API_URL,
      { params }
    );
  }

  getDistribution(month: string) {
  return this.http.get<ExpenseDistribution[]>(
    `${this.API_URL}/distribution`,
    {
      params: { month }
    }
  );
  }

  createExpense(data: {
    amount: number;
    transaction_date: string;
    category_id: string;
    payment_method: string;
    description: string;
    notes?: string;
    tags?: string[];
  }): Observable<{ expense: Expense }> {

    return this.http.post<{ expense: Expense }>(
      this.API_URL,
      data
    );
  }


  updateExpense(
    id: string,
    data: Partial<Expense>
  ): Observable<{ expense: Expense }> {

    return this.http.put<{ expense: Expense }>(
      `${this.API_URL}/${id}`,
      data
    );
  }


  deleteExpense(
    id: string
  ): Observable<any> {

    return this.http.delete(
      `${this.API_URL}/${id}`
    );
  }
}