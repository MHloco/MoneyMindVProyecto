import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_period: string;
  max_budgets: number;
  max_obligations: number;
  max_ai_queries: number;
  features: any;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
  plan_code: string;
  plan_name: string;
  plan_description: string | null;
  price: number;
  currency: string;
  billing_period: string;
  max_budgets: number;
  max_obligations: number;
  max_ai_queries: number;
  features: any;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {

  private apiUrl = '/api/subscription';

  constructor(private http: HttpClient) {}

  getSubscription(): Observable<Subscription | null> {
    return this.http.get<Subscription | null>(this.apiUrl);
  }

  getPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(
      `${this.apiUrl}/plans`
    );
  }

  changePlan(planCode: string): Observable<Subscription> {
  return this.http.patch<Subscription>(
    `${this.apiUrl}/plan`,
    { planCode }
    );
  }

  cancelSubscription() {
    return this.http.patch(
      `${this.apiUrl}/cancel`,
      {}
    );
  }

  reactivateSubscription() {
    return this.http.patch(
      `${this.apiUrl}/reactivate`,
      {}
    );
  }
}