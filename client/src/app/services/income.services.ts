import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';


export interface Income {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  description: string;
  notes: string | null;
  transaction_date: string;
  payment_method: string;
  source: string | null;
  tags: string[];
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
}

export interface IncomeResponse {
  data: Income[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IncomeMetrics {
  current_month: number;
  previous_month: number;
}

@Injectable({
  providedIn: 'root'
})
export class IncomeService {
  private apiUrl = '/api/incomes';

  constructor(private http: HttpClient) {}

  getIncomes(filters: any = {}): Observable<IncomeResponse> {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<IncomeResponse>(this.apiUrl, { params });
  }

  getMetrics(): Observable<IncomeMetrics> {
    return this.http.get<IncomeMetrics>(
      `${this.apiUrl}/metrics`
    );
  }

  createIncome(data: any) {
    return this.http.post(this.apiUrl, data);
  }

  updateIncome(id: string, data: any) {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  deleteIncome(id: string) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}