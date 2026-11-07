import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ObligationInstallment {
  id: string;
  number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: 'PENDING' | 'PARTIAL' | 'OVERDUE' | 'PAID';
  paid_at: string | null;
  transaction_id: string | null;
}

export interface Obligation {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  type: string;
  creditor: string | null;
  total_amount: number;
  paid_amount: number;
  currency: string;
  installments_count: number;
  interest_rate: number | null;
  start_date: string;
  due_day: number | null;
  status: 'ACTIVE' | 'PAID';
  notes: string | null;
  installments: ObligationInstallment[];
}

export interface ObligationSummary {
  total_owed: number;
  total_paid: number;
  nearest_due_date: string | null;
}

interface ObligationSummaryResponse {
  total_debt: number;
  total_paid: number;
  next_due: {
    obligation_id: string;
    obligation_name: string;
    installment_id: string;
    installment_number: number;
    due_date: string;
    amount: number;
    pending_amount: number;
    status: string;
    days_until_due: number;
  } | null;
}

@Injectable({
  providedIn: 'root'
})
export class ObligationService {

  private apiUrl = '/api/obligations';

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ObligationSummary> {
    return this.http
      .get<ObligationSummaryResponse>(
        `${this.apiUrl}/summary`
      )
      .pipe(
        map(response => ({
          total_owed: Number(response.total_debt || 0),
          total_paid: Number(response.total_paid || 0),
          nearest_due_date:
            response.next_due?.due_date ?? null
        }))
      );
  }

  getObligations(): Observable<Obligation[]> {
    return this.http.get<Obligation[]>(
      this.apiUrl
    );
  }

  getObligation(id: string): Observable<Obligation> {
    return this.http.get<Obligation>(
      `${this.apiUrl}/${id}`
    );
  }

  createObligation(data: any): Observable<any> {
    return this.http.post(
      this.apiUrl,
      data
    );
  }

  payInstallment(
    installmentId: string,
    data: {
      amount?: number;
      payment_method?: string;
      notes?: string;
    } = {}
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/installments/${installmentId}/pay`,
      data
    );
  }
}