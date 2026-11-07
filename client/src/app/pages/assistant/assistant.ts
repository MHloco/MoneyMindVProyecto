import { afterEveryRender, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, signal, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { AuthService } from '../../services/auth.services';
import { AiUsage, AssistantService, ChatMessage, Conversation, FinancialAgent } from '../../services/assistant.services';

@Component({
  selector: 'app-assistant',
  imports: [SidebarComponent, DatePipe, FormsModule, RouterLink],
  templateUrl: './assistant.html',
  styleUrl: './assistant.scss',
})
export class Assistant {
  private api = inject(AssistantService);
  private auth = inject(AuthService);
  private requests = new Subscription();
  private generation = 0;
  private log = viewChild<ElementRef<HTMLElement>>('messageLog');
  private lastScrollKey = '';
  readonly conversations = signal<Conversation[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly selectedId = signal<string | undefined>(undefined);
  readonly usage = signal<AiUsage | null>(null);
  readonly available = signal(false);
  readonly agentsAvailable = signal(false);
  readonly analysisNotice = signal('');
  selectedAgent: FinancialAgent = 'all';
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly sessionExpired = signal(false);
  readonly hasEarlierMessages = signal(false);
  readonly pendingMessage = signal('');
  draft = '';
  readonly suggestions = ['¿Cómo van mis finanzas este mes?', '¿En qué estoy gastando más?', '¿Qué cuotas tengo pendientes?', '¿Cómo puedo mejorar mi ahorro?'];
  readonly limitReached = computed(() => {
    const usage = this.usage();
    return !!usage && usage.limit >= 0 && usage.used >= usage.limit;
  });

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      untracked(() => {
        this.reset();
        if (user) this.loadConversations();
      });
    });
    inject(DestroyRef).onDestroy(() => { this.generation++; this.requests.unsubscribe(); });
    afterEveryRender(() => {
      const key = `${this.selectedId()}:${this.messages().at(-1)?.id}:${this.pendingMessage()}`;
      if (key !== this.lastScrollKey) {
        this.lastScrollKey = key;
        const log = this.log()?.nativeElement;
        if (log) log.scrollTop = log.scrollHeight;
      }
    });
  }

  // A logout/account change in another tab must immediately remove the previous chat.
  @HostListener('window:storage', ['$event'])
  onStorage(event: StorageEvent) {
    if (event.key === 'finanzas_ia_auth' || event.key === null) {
      this.reset();
      if (this.auth.getToken()) this.loadConversations();
    }
  }

  private reset() {
    this.generation++;
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.conversations.set([]);
    this.messages.set([]);
    this.selectedId.set(undefined);
    this.usage.set(null);
    this.available.set(false);
    this.agentsAvailable.set(false);
    this.analysisNotice.set('');
    this.loading.set(false);
    this.sending.set(false);
    this.pendingMessage.set('');
    this.hasEarlierMessages.set(false);
    this.error.set('');
    this.sessionExpired.set(false);
    this.draft = '';
  }

  private handleError(error: { status?: number; error?: { message?: string } }) {
    if (error.status === 401) {
      this.reset();
      this.sessionExpired.set(true);
      this.error.set('Tu sesión expiró. Inicia sesión para continuar.');
    } else {
      this.error.set(error.error?.message || 'No se pudo conectar con el asistente. Inténtalo de nuevo.');
    }
  }

  loadConversations() {
    if (this.loading() || this.sending()) return;
    this.loading.set(true);
    this.error.set('');
    const generation = this.generation;
    const token = this.auth.getToken();
    this.requests.add(this.api.list().subscribe({
      next: result => {
        if (generation !== this.generation || token !== this.auth.getToken()) return;
        this.conversations.set(result.conversations);
        this.usage.set(result.usage);
        this.available.set(result.available);
        this.agentsAvailable.set(result.agentsAvailable ?? false);
        this.loading.set(false);
      },
      error: error => {
        if (generation !== this.generation || token !== this.auth.getToken()) return;
        this.loading.set(false);
        this.handleError(error);
      },
    }));
  }

  newConversation() {
    if (this.sending() || this.loading()) return;
    this.selectedId.set(undefined);
    this.messages.set([]);
    this.hasEarlierMessages.set(false);
    this.error.set('');
    this.draft = '';
    this.analysisNotice.set('');
  }

  openConversation(conversation: Conversation) {
    if (this.sending() || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.messages.set([]);
    this.selectedId.set(undefined);
    this.hasEarlierMessages.set(false);
    this.draft = '';
    const generation = this.generation;
    const token = this.auth.getToken();
    this.requests.add(this.api.detail(conversation.id).subscribe({
      next: result => {
        if (generation !== this.generation || token !== this.auth.getToken()) return;
        this.selectedId.set(result.conversation.id);
        this.messages.set(result.messages);
        this.hasEarlierMessages.set(result.hasEarlierMessages);
        this.loading.set(false);
      },
      error: error => {
        if (generation !== this.generation || token !== this.auth.getToken()) return;
        this.loading.set(false);
        this.handleError(error);
      },
    }));
  }

  send(suggestion?: string) {
    const message = (suggestion ?? this.draft).trim();
    if (!message || message.length > 4000 || this.sending() || this.loading()
      || !this.available() || this.limitReached() || this.sessionExpired()) return;
    const generation = this.generation;
    const token = this.auth.getToken();
    this.sending.set(true);
    this.error.set('');
    this.pendingMessage.set(message);
    this.draft = '';
    this.requests.add(this.api.send(message, this.selectedId()).subscribe({
      next: result => {
        if (generation !== this.generation || token !== this.auth.getToken()) return;
        this.selectedId.set(result.conversation.id);
        this.messages.update(messages => [...messages, ...result.messages]);
        this.conversations.update(items => [result.conversation, ...items.filter(item => item.id !== result.conversation.id)].slice(0, 50));
        this.usage.set(result.usage);
        this.sending.set(false);
        this.pendingMessage.set('');
      },
      error: error => {
        if (generation !== this.generation || token !== this.auth.getToken()) return;
        this.sending.set(false);
        this.pendingMessage.set('');
        this.draft = message;
        this.handleError(error);
      },
    }));
  }

  analyze() {
    if (this.loading() || this.sending() || !this.agentsAvailable() || this.limitReached() || this.sessionExpired()) return;
    const generation = this.generation;
    const token = this.auth.getToken();
    this.sending.set(true);
    this.error.set('');
    this.analysisNotice.set('');
    this.requests.add(this.api.analyze(this.selectedAgent).subscribe({
      next: result => {
        if (generation !== this.generation || token !== this.auth.getToken()) return;
        this.selectedId.set(result.conversation.id);
        this.messages.set(result.messages);
        this.hasEarlierMessages.set(false);
        this.conversations.update(items => [result.conversation, ...items].slice(0, 50));
        this.usage.set(result.usage);
        this.sending.set(false);
        this.analysisNotice.set(`Análisis guardado. Alertas nuevas: ${result.alertsCreated ?? 0}.`);
      },
      error: error => {
        if (generation !== this.generation || token !== this.auth.getToken()) return;
        this.sending.set(false);
        this.handleError(error);
      },
    }));
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
  }
}
