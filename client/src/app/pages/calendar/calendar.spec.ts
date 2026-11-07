import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { CalendarComponent } from './calendar';
import { CalendarEvent, CalendarService } from '../../services/calendar.services';

describe('Calendar reminder deletion', () => {
  let component: CalendarComponent;
  let deletion: Subject<unknown>;
  let deleteEvent: ReturnType<typeof vi.fn>;
  const reminder: CalendarEvent = {
    id: 'reminder-1', title: 'Pagar tarjeta', description: null,
    event_date: '2026-10-03', color: '#3b82f6', created_at: '', updated_at: ''
  };

  beforeEach(() => {
    deletion = new Subject();
    deleteEvent = vi.fn(() => deletion.asObservable());
    component = new CalendarComponent({ deleteEvent } as unknown as CalendarService);
    component.events = [reminder];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps the reminder and makes no request when confirmation is cancelled', () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    component.deleteReminder(reminder);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining(reminder.title));
    expect(deleteEvent).not.toHaveBeenCalled();
    expect(component.events).toEqual([reminder]);
  });

  it('waits for success, prevents duplicate requests and removes only the selected reminder', () => {
    const other = { ...reminder, id: 'reminder-2' };
    component.events.push(other);
    component.errorMessage = 'Error anterior';
    component.deleteReminder(reminder);
    component.deleteReminder(reminder);
    expect(deleteEvent).toHaveBeenCalledExactlyOnceWith(reminder.id);
    expect(component.events).toEqual([reminder, other]);
    expect(component.deletingEventId).toBe(reminder.id);
    expect(component.errorMessage).toBe('');
    deletion.next({});
    expect(component.events).toEqual([other]);
    expect(component.deletingEventId).toBeNull();
  });

  it.each([
    [{ error: { message: 'No se pudo eliminar.' } }, 'No se pudo eliminar.'],
    [{}, 'No se pudo eliminar el recordatorio. Inténtalo de nuevo.']
  ])('keeps the reminder and displays the error after a failed request', (error, message) => {
    component.deleteReminder(reminder);
    deletion.error(error);
    expect(component.events).toEqual([reminder]);
    expect(component.errorMessage).toBe(message);
    expect(component.deletingEventId).toBeNull();
  });
});
