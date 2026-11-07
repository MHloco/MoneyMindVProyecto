import { SidebarComponent } from '../../components/sidebar/sidebar';
import { Component,OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Alert, AlertServices } from '../../services/alert.services';


@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [SidebarComponent,
    CommonModule,
    ],

  templateUrl: './alerts.html',
  styleUrl: './alerts.scss'
})
export class AlertsComponent
  implements OnInit {

  alerts: Alert[] = [];

  loading = true;

  errorMessage = '';


  constructor(
    private alertServices: AlertServices
  ) {}


  ngOnInit(): void {

    this.loadAlerts();

  }


  loadAlerts(): void {

    this.loading = true;

    this.alertServices
      .getAlerts()
      .subscribe({

        next: (response) => {

          this.alerts =
            response.alerts;

          this.loading = false;

        },

        error: (error) => {

          console.error(
            error
          );

          this.errorMessage =
            error?.error?.message ||
            'No se pudieron cargar las alertas.';

          this.loading = false;

        }

      });
  }


  markAsRead(
    alert: Alert
  ): void {

    if (alert.read_at) {
      return;
    }


    this.alertServices
      .markAsRead(alert.id)
      .subscribe({

        next: () => {

          alert.read_at =
            new Date().toISOString();

          alert.status = 'READ';

        },

        error: (error) => {

          console.error(
            error
          );

        }

      });
  }


  getSeverityClass(
    severity: string
  ): string {

    return severity.toLowerCase();

  }
}