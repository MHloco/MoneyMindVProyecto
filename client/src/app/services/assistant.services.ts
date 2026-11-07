import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  created_at: string;
}
export interface AiUsage { used: number; limit: number; month: string; }
export interface ConversationIndex { conversations: Conversation[]; usage: AiUsage; available: boolean; agentsAvailable?: boolean; }
export interface ConversationDetail { conversation: Conversation; messages: ChatMessage[]; hasEarlierMessages: boolean; }
export type FinancialAgent = 'all' | 'habits' | 'anomalies' | 'budgets' | 'projection' | 'recommendations';
export interface ChatReply { conversation: Conversation; messages: ChatMessage[]; usage: AiUsage; alertsCreated?: number; }

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private http = inject(HttpClient);
  private url = '/api/assistant';

  list() { return this.http.get<ConversationIndex>(`${this.url}/conversations`); }
  detail(id: string) { return this.http.get<ConversationDetail>(`${this.url}/conversations/${encodeURIComponent(id)}`); }
  send(message: string, conversationId?: string) {
    return this.http.post<ChatReply>(`${this.url}/messages`, { message, ...(conversationId ? { conversationId } : {}) });
  }
  analyze(agent: FinancialAgent) {
    return this.http.post<ChatReply>(`${this.url}/analysis`, { agent });
  }
}
