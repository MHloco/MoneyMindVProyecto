import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarResponse {
  events: CalendarEvent[];
}

@Injectable({
  providedIn: 'root'
})
export class CalendarService {

  private readonly API_URL = '/api/calendar';

  constructor(private http: HttpClient) {}

  getEvents(month: number, year: number): Observable<CalendarResponse> {
    return this.http.get<CalendarResponse>(
      `${this.API_URL}?month=${month}&year=${year}`
    );
  }

  createEvent(data: {
    title: string;
    description?: string;
    event_date: string;
    color?: string;
  }): Observable<{ event: CalendarEvent }> {
    return this.http.post<{ event: CalendarEvent }>(
      this.API_URL,
      data
    );
  }

  deleteEvent(id: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/${id}`);
  }
}