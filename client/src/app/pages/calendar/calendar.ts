import { SidebarComponent } from '../../components/sidebar/sidebar';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarEvent, CalendarService } from '../../services/calendar.services';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [SidebarComponent,CommonModule, FormsModule, ],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss'
})
export class CalendarComponent implements OnInit {

  currentDate = new Date();

  selectedDate: Date | null = null;

  events: CalendarEvent[] = [];

  loading = true;
  errorMessage = '';
  deletingEventId: string | null = null;

  showForm = false;

  title = '';
  description = '';
  color = '#3b82f6';

  constructor(
    private calendarServices: CalendarService
  ) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  get currentMonth(): number {
    return this.currentDate.getMonth();
  }

  get currentYear(): number {
    return this.currentDate.getFullYear();
  }

  get monthName(): string {
    return this.currentDate.toLocaleDateString('es-PE', {
      month: 'long',
      year: 'numeric'
    });
  }

  loadEvents(): void {
    this.loading = true;
    this.errorMessage = '';

    this.calendarServices
      .getEvents(this.currentMonth + 1, this.currentYear)
      .subscribe({
        next: (response) => {
          this.events = response.events;
          this.loading = false;
        },
        error: (error) => {
          console.error(error);

          this.errorMessage =
            error?.error?.message ||
            'No se pudo cargar el calendario.';

          this.loading = false;
        }
      });
  }

  previousMonth(): void {
    this.currentDate = new Date(
      this.currentYear,
      this.currentMonth - 1,
      1
    );

    this.selectedDate = null;
    this.loadEvents();
  }

  nextMonth(): void {
    this.currentDate = new Date(
      this.currentYear,
      this.currentMonth + 1,
      1
    );

    this.selectedDate = null;
    this.loadEvents();
  }

  selectDate(day: number): void {
    this.selectedDate = new Date(
      this.currentYear,
      this.currentMonth,
      day
    );

    this.showForm = false;
  }

  openReminderForm(): void {
    if (!this.selectedDate) {
      return;
    }

    this.title = '';
    this.description = '';
    this.color = '#3b82f6';

    this.showForm = true;
  }

  saveReminder(): void {
    if (!this.selectedDate || !this.title.trim()) {
      return;
    }

    const date = this.formatDate(this.selectedDate);

    this.calendarServices.createEvent({
      title: this.title.trim(),
      description: this.description.trim(),
      event_date: date,
      color: this.color
    }).subscribe({
      next: () => {
        this.showForm = false;
        this.loadEvents();
      },
      error: (error) => {
        console.error(error);
        this.errorMessage =
          error?.error?.message ||
          'No se pudo crear el recordatorio.';
      }
    });
  }

  deleteReminder(event: CalendarEvent): void {
    if (this.deletingEventId !== null) {
      return;
    }

    if (!window.confirm(`¿Deseas eliminar el recordatorio "${event.title}"?`)) {
      return;
    }

    this.errorMessage = '';
    this.deletingEventId = event.id;

    this.calendarServices.deleteEvent(event.id).subscribe({
      next: () => {
        this.events = this.events.filter(item => item.id !== event.id);
        this.deletingEventId = null;
      },
      error: (error) => {
        console.error(error);
        this.deletingEventId = null;
        this.errorMessage =
          error?.error?.message ||
          'No se pudo eliminar el recordatorio. Inténtalo de nuevo.';
      }
    });
  }

  isSelected(day: number): boolean {
    if (!this.selectedDate) {
      return false;
    }

    return (
      this.selectedDate.getDate() === day &&
      this.selectedDate.getMonth() === this.currentMonth &&
      this.selectedDate.getFullYear() === this.currentYear
    );
  }

  hasEvent(day: number): boolean {
    const date = this.formatDate(
      new Date(this.currentYear, this.currentMonth, day)
    );

    return this.events.some(
      event => event.event_date.toString().substring(0, 10) === date
    );
  }

  getEventsForDay(day: number): CalendarEvent[] {
    const date = this.formatDate(
      new Date(this.currentYear, this.currentMonth, day)
    );

    return this.events.filter(
      event => event.event_date.toString().substring(0, 10) === date
    );
  }

  get calendarDays(): (number | null)[] {
    const firstDay = new Date(
      this.currentYear,
      this.currentMonth,
      1
    ).getDay();

    const daysInMonth = new Date(
      this.currentYear,
      this.currentMonth + 1,
      0
    ).getDate();

    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    const days: (number | null)[] = [];

    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  formatSelectedDate(): string {
    if (!this.selectedDate) {
      return '';
    }

    return this.selectedDate.toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}
