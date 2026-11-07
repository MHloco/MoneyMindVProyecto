import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


export interface Alert {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, any>;
  scheduled_for: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}


export interface AlertsResponse {
  alerts: Alert[];
}


@Injectable({
  providedIn: 'root'
})
export class AlertServices {

  private readonly API_URL =
    '/api/alerts';


  constructor(
    private http: HttpClient
  ) {}



  getAlerts(): Observable<AlertsResponse> {

    return this.http.get<AlertsResponse>(
      this.API_URL
    );
  }


  markAsRead(
    id: string
  ): Observable<any> {

    return this.http.patch(
      `${this.API_URL}/${id}/read`,
      {}
    );
  }
}