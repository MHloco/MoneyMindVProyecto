import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface NewsletterResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class NewsletterService {
  private apiUrl = '/api/newsletter';

  constructor(private http: HttpClient) {}

  subscribe(email: string): Observable<NewsletterResponse> {
    return this.http.post<NewsletterResponse>(`${this.apiUrl}/subscribe`, { email });
  }
}