import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Assistant } from './assistant';
import { AssistantService, ChatReply } from '../../services/assistant.services';
import { AuthService } from '../../services/auth.services';

describe('Private assistant', () => {
  let reply: Subject<ChatReply>;
  let api: { list: ReturnType<typeof vi.fn>; detail: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; analyze: ReturnType<typeof vi.fn> };
  let user = signal({ id: 'account-a' });
  let token: string;
  const conversation = { id: 'chat-a', title: 'Mi chat', created_at: '', updated_at: '' };
  const result: ChatReply = { conversation, usage: { used: 1, limit: 20, month: '2026-10' }, messages: [
    { id: 'm1', role: 'USER', content: 'Hola', created_at: '2026-10-04T10:00:00Z' },
    { id: 'm2', role: 'ASSISTANT', content: '<script>alert(1)</script>', created_at: '2026-10-04T10:00:01Z' },
  ] };

  beforeEach(() => {
    reply = new Subject(); token = 'token-a'; user = signal({ id: 'account-a' });
    api = {
      list: vi.fn(() => of({ conversations: [], usage: { used: 0, limit: 20, month: '2026-10' }, available: true, agentsAvailable: true })),
      detail: vi.fn(), send: vi.fn(() => reply.asObservable()), analyze: vi.fn(() => reply.asObservable()),
    };
    TestBed.configureTestingModule({ imports: [Assistant], providers: [provideRouter([]),
      { provide: AssistantService, useValue: api },
      { provide: AuthService, useValue: { currentUser: user, getToken: () => token, logout: vi.fn() } },
    ] });
  });

  function setup() {
    const fixture = TestBed.createComponent(Assistant);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('prevents duplicate submissions, saves the returned history, and renders model text safely', () => {
    const { fixture, component } = setup();
    component.draft = 'Hola'; component.send(); component.send('Again');
    expect(api.send).toHaveBeenCalledExactlyOnceWith('Hola', undefined);
    expect(component.sending()).toBe(true);
    reply.next(result); fixture.detectChanges();
    expect(component.messages()).toEqual(result.messages);
    expect(component.selectedId()).toBe('chat-a');
    expect(component.sending()).toBe(false);
    expect(fixture.nativeElement.querySelector('.messages script')).toBeNull();
    expect(fixture.nativeElement.querySelector('.messages').textContent).toContain('<script>alert(1)</script>');
  });

  it('restores the draft after a failure without inventing a saved message', () => {
    const { component } = setup();
    component.draft = 'Mi pregunta'; component.send();
    reply.error({ status: 503, error: { message: 'Servicio no disponible' } });
    expect(component.draft).toBe('Mi pregunta');
    expect(component.messages()).toEqual([]);
    expect(component.error()).toBe('Servicio no disponible');
    expect(component.sending()).toBe(false);
  });

  it('clears account data and discards an in-flight reply on account changes', () => {
    const { fixture, component } = setup();
    component.messages.set(result.messages); component.draft = 'Hola'; component.send();
    token = 'token-b'; user.set({ id: 'account-b' }); fixture.detectChanges();
    reply.next(result);
    expect(component.messages()).toEqual([]);
    expect(component.selectedId()).toBeUndefined();
    expect(component.draft).toBe('');
    expect(component.sending()).toBe(false);
  });

  it('clears visible data after logout in another tab', () => {
    const { component } = setup();
    component.messages.set(result.messages); token = '';
    component.onStorage(new StorageEvent('storage', { key: 'finanzas_ia_auth' }));
    expect(component.messages()).toEqual([]);
    expect(component.available()).toBe(false);
  });

  it('clears private data on an expired session and disables more sends', () => {
    const { component } = setup();
    component.messages.set(result.messages); component.send('Hola');
    reply.error({ status: 401 });
    expect(component.messages()).toEqual([]);
    expect(component.sessionExpired()).toBe(true);
    expect(component.error()).toContain('sesión expiró');
    component.send('Otra'); expect(api.send).toHaveBeenCalledTimes(1);
  });

  it('blocks sends when the plan quota is exhausted or Gemini is unavailable', () => {
    const { component } = setup();
    component.usage.set({ used: 20, limit: 20, month: '2026-10' }); component.send('Hola');
    expect(api.send).not.toHaveBeenCalled();
    component.usage.set({ used: 20, limit: -1, month: '2026-10' });
    component.available.set(false); component.send('Hola');
    expect(api.send).not.toHaveBeenCalled();
  });

  it('does not retain the previous conversation if opening another conversation fails', () => {
    const { component } = setup();
    component.messages.set(result.messages); component.selectedId.set('chat-a');
    api.detail.mockReturnValue(throwError(() => ({ status: 404, error: { message: 'Conversación no encontrada' } })));
    component.openConversation({ ...conversation, id: 'foreign-chat' });
    expect(component.messages()).toEqual([]);
    expect(component.selectedId()).toBeUndefined();
    expect(component.error()).toBe('Conversación no encontrada');
  });

  it('runs a selected agent without Gemini and prevents duplicate submissions', () => {
    const { component } = setup();
    component.available.set(false);
    component.selectedAgent = 'projection';
    component.analyze(); component.analyze();
    expect(api.analyze).toHaveBeenCalledExactlyOnceWith('projection');
    reply.next({ ...result, alertsCreated: 2 });
    expect(component.messages()).toEqual(result.messages);
    expect(component.analysisNotice()).toContain('2');
    expect(component.sending()).toBe(false);
  });

  it('discards agent reports after changing accounts and enforces the quota', () => {
    const { component, fixture } = setup();
    component.usage.set({ used: 20, limit: 20, month: '2026-10' });
    component.analyze(); expect(api.analyze).not.toHaveBeenCalled();
    component.usage.set({ used: 0, limit: 20, month: '2026-10' });
    component.analyze();
    token = 'token-b'; user.set({ id: 'account-b' }); fixture.detectChanges();
    reply.next(result);
    expect(component.messages()).toEqual([]);
    expect(component.analysisNotice()).toBe('');
  });
});
