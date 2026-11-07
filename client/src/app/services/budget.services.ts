import { Injectable } from '@angular/core';
import {
  HttpClient
} from '@angular/common/http';

import {
  Observable
} from 'rxjs';


export interface Budget {

  id: string;

  categoryId: string;

  categoryName: string;

  categoryColor: string;

  categoryIcon: string;

  name: string;

  amount: number;

  spent: number;

  remaining: number;

  percentage: number;

  currency: string;

  periodType: string;

  periodStart: string;

  periodEnd: string;

  alertThreshold: number;

  rollover: boolean;

  isActive: boolean;

  status:
    | 'NORMAL'
    | 'WARNING'
    | 'EXCEEDED';

  createdAt: string;
}


export interface BudgetsResponse {
  budgets: Budget[];
}


export interface CreateBudgetRequest {

  categoryId: string;

  name: string;

  amount: number;

  currency?: string;

  periodType?: string;

  periodStart: string;

  periodEnd: string;

  alertThreshold?: number;

  rollover?: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class BudgetService {

  private readonly API_URL =
    '/api/budgets';


  constructor(
    private http: HttpClient
  ) {}


  getBudgets():
    Observable<BudgetsResponse> {

    return this.http.get<BudgetsResponse>(
      this.API_URL
    );
  }


  createBudget(
    data: CreateBudgetRequest
  ): Observable<any> {

    return this.http.post(
      this.API_URL,
      data
    );
  }


  deleteBudget(
    id: string
  ): Observable<any> {

    return this.http.delete(
      `${this.API_URL}/${id}`
    );
  }
}