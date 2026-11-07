import { describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { ObligationsComponent } from './obligations';
import { Obligation, ObligationInstallment, ObligationService } from '../../services/obligation.services';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.services';

function setup() {
  const result = new Subject<unknown>();
  const service = {
    payInstallment: vi.fn(() => result),
    getSummary: vi.fn(() => of({ total_owed: 100, total_paid: 25, nearest_due_date: null })),
    getObligations: vi.fn(() => of([])),
    getObligation: vi.fn(() => of({ id: 'test-obligation', installments: [] }))
  };
  const component = new ObligationsComponent(service as unknown as ObligationService);
  component.selectedObligation = { id: 'test-obligation', name: 'Préstamo' } as Obligation;
  component.openPay({ id: 'installment', amount: 33.34, paid_amount: 0.01, status: 'PARTIAL' } as ObligationInstallment);
  return { component, service, result };
}

describe('Installment payment', () => {
  it('rounds the remaining amount and submits only once while pending', () => {
    const { component, service, result } = setup();
    expect(component.payment.amount).toBe(33.33);
    component.payInstallment();
    component.payInstallment();
    component.closePay();
    expect(service.payInstallment).toHaveBeenCalledTimes(1);
    expect(component.showPayModal).toBe(true);
    result.next({});
    expect(component.showPayModal).toBe(false);
    expect(component.successMessage).toContain('correctamente');
    expect(service.getObligation).toHaveBeenCalledWith('test-obligation');
    expect(service.getSummary).toHaveBeenCalled();
  });

  it.each([0, -1, 33.34, NaN, 1.001])('rejects invalid amount %s before submitting', amount => {
    const { component, service } = setup();
    component.payment.amount = amount;
    component.payInstallment();
    expect(service.payInstallment).not.toHaveBeenCalled();
    expect(component.paymentError).not.toBe('');
  });

  it('shows API errors and retains the form for retry', () => {
    const { component, result } = setup();
    component.payInstallment();
    result.error({ error: { message: 'No se pudo registrar.' } });
    expect(component.paying).toBe(false);
    expect(component.showPayModal).toBe(true);
    expect(component.payment.amount).toBe(33.33);
    expect(component.paymentError).toBe('No se pudo registrar.');
  });

  it('requires manual Yape confirmation and resets it when the amount changes', () => {
    const { component, service } = setup();
    component.payment.payment_method = 'YAPE';
    component.payInstallment();
    expect(service.payInstallment).not.toHaveBeenCalled();
    component.yapeConfirmed = true;
    component.paymentChanged();
    expect(component.yapeConfirmed).toBe(false);
    component.yapeConfirmed = true;
    component.yapeReference = '12345';
    component.payInstallment();
    expect(service.payInstallment).toHaveBeenCalledWith('installment', expect.objectContaining({
      payment_method: 'YAPE', notes: expect.stringContaining('12345')
    }));
  });

  it('always uses the configured recipient QR instead of an old browser upload', () => {
    localStorage.setItem('moneymind:yape-qr:test-obligation', 'data:image/png;base64,old');
    try {
      const { component } = setup();
      expect(component.yapeQr).toBe('/payments/yape-qr.jpg');
      expect(component.yapeRecipient).toBe('Piero Alexander Mejia Rivera');
    } finally {
      localStorage.removeItem('moneymind:yape-qr:test-obligation');
    }
  });

  it('validates and simulates a card payment without contacting the API', () => {
    const { component, service } = setup();
    component.payment.payment_method = 'CREDIT_CARD';
    component.payInstallment();
    expect(component.paymentError).toContain('tarjeta de prueba');
    component.simulation = { holder: 'Persona de prueba', cardNumber: '4242 4242 4242 4242', expiry: '12/99', cvv: '123', bank: '', account: '', reference: '', phone: '' };
    component.payInstallment();
    expect(component.simulationMessage).toContain('Simulación aprobada');
    expect(service.payInstallment).not.toHaveBeenCalled();
    expect(component.remainingAmount).toBe(33.33);
    expect(component.simulation.cvv).toBe('');
  });

  it.each(['BANK_TRANSFER', 'PLIN'])('simulates %s without sending financial details', method => {
    const { component, service } = setup();
    component.payment.payment_method = method;
    component.simulation = { holder: 'Persona de prueba', cardNumber: '', expiry: '', cvv: '', bank: 'BCP', account: '00000000000000000000', reference: 'DEMO001', phone: '900000000' };
    component.payInstallment();
    expect(component.simulationMessage).toContain('Simulación aprobada');
    expect(service.payInstallment).not.toHaveBeenCalled();
  });

  it('wires the visible confirmation button to the payment request and renders errors', async () => {
    const { service, result } = setup();
    await TestBed.configureTestingModule({
      imports: [ObligationsComponent],
      providers: [provideRouter([]), { provide: ObligationService, useValue: service }, { provide: AuthService, useValue: { logout: vi.fn(), currentUser: () => null } }]
    }).compileComponents();
    const fixture = TestBed.createComponent(ObligationsComponent);
    try {
      fixture.detectChanges();
      fixture.componentInstance.openPay({ id: 'installment', amount: 10, paid_amount: 0 } as ObligationInstallment);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.pay-modal .gold-button') as HTMLButtonElement;
      expect(button.textContent).toContain('Confirmar pago');
      fixture.componentInstance.payment.payment_method = 'YAPE';
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const qr = fixture.nativeElement.querySelector('.yape-qr') as HTMLImageElement;
      expect(qr.getAttribute('src')).toBe('/payments/yape-qr.jpg');
      expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
      expect(service.payInstallment).not.toHaveBeenCalled();
      qr.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.yape-payment [role="alert"]').textContent).toContain('No se pudo cargar');
      expect(service.payInstallment).not.toHaveBeenCalled();
      fixture.componentInstance.payment.payment_method = 'CASH';
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      button.click();
      fixture.detectChanges();
      expect(service.payInstallment).toHaveBeenCalledOnce();
      expect(button.disabled).toBe(true);
      result.error({ error: { message: 'Error de pago visible' } });
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.pay-modal [role="alert"]').textContent).toContain('Error de pago visible');
      expect(button.disabled).toBe(false);
    } finally {
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });
});
