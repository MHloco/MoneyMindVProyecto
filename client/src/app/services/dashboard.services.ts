import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.services';

export interface DashboardUser {
  id: string;
  email: string;
  fullName: string;
  currency: string;
  timezone: string;
  locale: string;
  periodStartDay: number;
}

export interface DashboardMovimiento {
  id: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  tipo: 'INCOME' | 'EXPENSE';
  monto: number;
  moneda: string;
  metodoPago: string;
}

export interface DashboardCategoria {
  id: string | null;
  nombre: string;
  color: string;
  total: number;
  porcentaje: number;
  movimientos: number;
}

export interface DashboardMeta {
  id: string;
  nombre: string;
  actual: number;
  objetivo: number;
  porcentaje: number;
}

export interface DashboardData {
  user: DashboardUser;
  period: { today: string; month: string; start: string; end: string };

  financial: {
    balanceTotal: number;
    ingresos: number;
    gastos: number;
    ahorro: number;

    movimientos: DashboardMovimiento[];
    pagination: { page: number; total: number; totalPages: number };
    metas: DashboardMeta[];
    gastosCategorias: DashboardCategoria[];

    flujoMensual: { mes: string; ingresos: number; gastos: number; balance: number; movimientos: number }[];
    obligaciones: { id: string; name: string; number: number; due_date: string; pending_amount: number; currency: string }[];
    presupuestos: { id: string; name: string; amount: number; spent: number; currency: string }[];
    alertas: { id: string; title: string; message: string; severity: string; status: string; read_at: string | null }[];
    eventos: { id: string; title: string; event_date: string }[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  private readonly API_URL = '/api/dashboard';

  constructor(
    private http: HttpClient,
    private authServices: AuthService
  ) {}

  getDashboard(filters: { month?: string; type?: string; category?: string; page?: number } = {}): Observable<DashboardData> {
    const token = this.authServices.getToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<DashboardData>(
      this.API_URL,
      { headers, params: { ...filters } }
    );
  }
}
