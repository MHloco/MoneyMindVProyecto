import { ObligationCardComponent } from '../../components/obligation-card/obligation-card';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
  ObligationService,
  Obligation,
  ObligationInstallment,
  ObligationSummary
} from '../../services/obligation.services';

@Component({
  selector: 'app-obligations',
  standalone: true,

  imports: [SidebarComponent, ObligationCardComponent,
    CommonModule,
    FormsModule,
    
    

    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],

  templateUrl: './obligations.html',
  styleUrl: './obligations.scss'
})
export class ObligationsComponent implements OnInit {

  obligations: Obligation[] = [];

  summary: ObligationSummary = {
    total_owed: 0,
    total_paid: 0,
    nearest_due_date: null
  };

  showForm = false;
  showDetail = false;
  showPayModal = false;
  saving = false;
  paying = false;
  formError = '';
  paymentError = '';
  errorMessage = '';
  successMessage = '';
  readonly yapeQr = '/payments/yape-qr.jpg';
  readonly yapeRecipient = 'Piero Alexander Mejia Rivera';
  yapeQrUnavailable = false;
  yapeConfirmed = false;
  yapeReference = '';
  simulationMessage = '';
  simulation = { holder: '', cardNumber: '', expiry: '', cvv: '', bank: '', account: '', reference: '', phone: '' };

  selectedObligation: Obligation | null = null;
  selectedInstallment: ObligationInstallment | null = null;

  form = {
    name: '',
    creditor: '',
    total_amount: 0,
    installments_count: 1,
    interest_rate: 0,
    start_date: '',
    due_day: 1,
    type: 'OTHER',
    notes: ''
  };

  payment = {
    amount: 0,
    payment_method: 'CASH',
    notes: ''
  };

  constructor(
    private obligationService: ObligationService
  ) {}

  ngOnInit(): void {
    this.loadSummary();
    this.loadObligations();
  }

  // =========================
  // CARGAR DATOS
  // =========================

  loadSummary(): void {
    this.obligationService.getSummary().subscribe({
      next: data => {
        this.summary = data;
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'No se pudo cargar el resumen.';
        console.error(
          'Error cargando resumen:',
          error
        );
      }
    });
  }

  loadObligations(): void {
    this.obligationService.getObligations().subscribe({
      next: data => {
        this.obligations = data;
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar las obligaciones.';
        console.error(
          'Error cargando obligaciones:',
          error
        );
      }
    });
  }

  // =========================
  // CREAR OBLIGACIÓN
  // =========================

  openCreate(): void {
    this.formError = '';
    this.resetForm();
    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.showForm = false;
  }

  save(): void {
    if (this.saving) return;
    this.formError = '';
    if (
      !this.form.name.trim() ||
      !Number.isFinite(Number(this.form.total_amount)) ||
      this.form.total_amount <= 0 ||
      !Number.isInteger(Number(this.form.installments_count)) ||
      this.form.installments_count < 1 ||
      !this.form.start_date
    ) {
      this.formError = 'Completa el nombre, un monto positivo, el número de cuotas y la fecha de inicio.';
      return;
    }

    const data = {
      name: this.form.name,
      creditor: this.form.creditor || null,
      total_amount: Number(
        this.form.total_amount
      ),
      installments_count: Number(
        this.form.installments_count
      ),
      interest_rate:
        this.form.interest_rate !== null
          ? Number(this.form.interest_rate)
          : null,
      start_date: this.form.start_date,
      due_day: Number(this.form.due_day),
      type: this.form.type,
      notes: this.form.notes || null
    };

    this.saving = true;
    this.obligationService
      .createObligation(data)
      .subscribe({

        next: () => {
          this.saving = false;
          this.closeForm();

          this.resetForm();

          this.loadSummary();

          this.loadObligations();
        },

        error: error => {
          this.saving = false;
          this.formError = error?.error?.message || 'No se pudo crear la obligación. Inténtalo de nuevo.';
          console.error(
            'Error creando obligación:',
            error
          );
        }

      });
  }

  resetForm(): void {

    this.form = {
      name: '',
      creditor: '',
      total_amount: 0,
      installments_count: 1,
      interest_rate: 0,
      start_date: '',
      due_day: 1,
      type: 'OTHER',
      notes: ''
    };
  }

  // =========================
  // DETALLE
  // =========================

  openDetail(
    obligation: Obligation
  ): void {

    this.obligationService
      .getObligation(obligation.id)
      .subscribe({

        next: data => {

          this.selectedObligation = data;

          this.showDetail = true;
        },

        error: error => {
          this.errorMessage = error?.error?.message || 'No se pudo cargar el detalle de la obligación.';
          console.error(
            'Error cargando detalle:',
            error
          );
        }

      });
  }

  closeDetail(): void {
    if (this.paying) return;
    this.showDetail = false;

    this.selectedObligation = null;
  }

  // =========================
  // PAGAR CUOTA
  // =========================

  openPay(
    installment: ObligationInstallment
  ): void {

    this.selectedInstallment = installment;
    this.paymentError = '';
    this.successMessage = '';
    this.yapeConfirmed = false;
    this.yapeReference = '';
    this.yapeQrUnavailable = false;
    this.resetSimulation();

    this.payment = {

      amount: Math.round((Number(installment.amount) - Number(installment.paid_amount)) * 100) / 100,

      payment_method: 'CASH',

      notes: ''
    };

    this.showPayModal = true;
  }

  closePay(): void {
    if (this.paying) return;
    this.resetSimulation();
    this.showPayModal = false;

    this.selectedInstallment = null;

    this.payment = {

      amount: 0,

      payment_method: 'CASH',

      notes: ''
    };
  }

  payInstallment(): void {
    if (this.paying) return;
    this.paymentError = '';
    if (!this.selectedInstallment) {
      return;
    }

    if (
      !Number.isFinite(Number(this.payment.amount)) ||
      this.payment.amount <= 0 ||
      this.payment.amount > this.remainingAmount ||
      Math.abs(this.payment.amount * 100 - Math.round(this.payment.amount * 100)) > 0.00001
    ) {
      this.paymentError = 'Ingresa un monto positivo, con hasta dos decimales, que no supere el saldo pendiente.';
      return;
    }
    if (this.payment.payment_method === 'YAPE' && !this.yapeConfirmed) {
      this.paymentError = 'Primero realiza el pago en Yape y marca la confirmación.';
      return;
    }
    if (this.isSimulatedMethod) {
      this.simulatePayment();
      return;
    }

    const notes = [
      this.payment.notes,
      this.payment.payment_method === 'YAPE'
        ? `Pago registrado manualmente por el usuario.${this.yapeReference.trim() ? ' Operación: ' + this.yapeReference.trim() : ''}`
        : ''
    ].filter(Boolean).join('\n');
    this.paying = true;

    this.obligationService
      .payInstallment(
        this.selectedInstallment.id,
        {
          amount: Number(
            this.payment.amount
          ),

          payment_method:
            this.payment.payment_method,

          notes:
            notes || undefined
        }
      )
      .subscribe({

        next: () => {
          this.paying = false;
          this.successMessage = 'Pago registrado correctamente.';
          this.closePay();

          this.loadSummary();

          this.loadObligations();

          if (this.selectedObligation) {

            this.openDetail(
              this.selectedObligation
            );
          }
        },

        error: error => {
          this.paying = false;
          this.paymentError = error?.error?.message || 'No se pudo registrar el pago. Inténtalo de nuevo.';
          console.error(
            'Error registrando pago:',
            error
          );
        }

      });
  }

  get remainingAmount(): number {
    return this.selectedInstallment
      ? Math.round((Number(this.selectedInstallment.amount) - Number(this.selectedInstallment.paid_amount)) * 100) / 100
      : 0;
  }

  paymentChanged(): void {
    this.yapeConfirmed = false;
    this.paymentError = '';
    this.simulationMessage = '';
  }

  get isCardMethod(): boolean {
    return ['CREDIT_CARD', 'DEBIT_CARD'].includes(this.payment.payment_method);
  }

  get isSimulatedMethod(): boolean {
    return this.isCardMethod || ['BANK_TRANSFER', 'PLIN'].includes(this.payment.payment_method);
  }

  private resetSimulation(): void {
    this.simulationMessage = '';
    this.simulation = { holder: '', cardNumber: '', expiry: '', cvv: '', bank: '', account: '', reference: '', phone: '' };
  }

  private simulatePayment(): void {
    this.simulationMessage = '';
    const data = this.simulation;
    if (this.isCardMethod) {
      const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(data.expiry);
      const now = new Date();
      const validExpiry = match && new Date(2000 + Number(match[2]), Number(match[1]), 1) > now;
      if (data.holder.trim().length < 3 || data.cardNumber.replace(/\s/g, '') !== '4242424242424242' || !validExpiry || !/^\d{3}$/.test(data.cvv)) {
        this.paymentError = 'Usa un titular ficticio, la tarjeta de prueba 4242 4242 4242 4242, un vencimiento futuro MM/AA y un CVV ficticio de 3 dígitos.';
        return;
      }
    } else if (this.payment.payment_method === 'BANK_TRANSFER') {
      if (!data.bank || data.holder.trim().length < 3 || !/^\d{10,20}$/.test(data.account) || data.reference.trim().length < 6) {
        this.paymentError = 'Completa el banco, titular ficticio, cuenta de prueba (10 a 20 dígitos) y referencia (mínimo 6 caracteres).';
        return;
      }
    } else if (!/^9\d{8}$/.test(data.phone) || data.reference.trim().length < 6) {
      this.paymentError = 'Ingresa un celular de prueba de 9 dígitos que empiece por 9 y una referencia de al menos 6 caracteres.';
      return;
    }
    this.resetSimulation();
    this.simulationMessage = 'Simulación aprobada. No se realizó ningún cobro ni se modificó el saldo de la cuota.';
  }

  onYapeQrError(): void {
    this.yapeQrUnavailable = true;
  }
}
