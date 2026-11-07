from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from ..schemas import AgentResult, Finding, Recurring
from ..tools import FinancialTools
from .common import money

MONTHS = {'MONTHLY': 1, 'BIMONTHLY': 2, 'QUARTERLY': 3, 'SEMIANNUAL': 6, 'ANNUAL': 12}


def occurrences(row: Recurring, today: date, end: date):
    first = max(row.next_occurrence_date, row.start_date)
    anchor = row.day_of_month or row.start_date.day
    for n in range(4000):
        if row.frequency in MONTHS:
            index = first.year * 12 + first.month - 1 + n * MONTHS[row.frequency] * row.interval_count
            year, month = divmod(index, 12)
            month += 1
            if (year, month) > (end.year, end.month):
                return
            occurrence = first if n == 0 else date(year, month, min(anchor, monthrange(year, month)[1]))
        else:
            days = {'DAILY': 1, 'WEEKLY': 7, 'BIWEEKLY': 14}[row.frequency]
            offset = n * days * row.interval_count
            if offset > (end - first).days:
                return
            occurrence = first + timedelta(days=offset)
        if occurrence > end or (row.end_date and occurrence > row.end_date):
            return
        if occurrence >= today and occurrence not in row.recorded_dates:
            yield occurrence
    raise ValueError('La recurrencia tiene una fecha pendiente demasiado antigua; actualiza su calendario.')


def run(tools: FinancialTools) -> AgentResult:
    today = tools.snapshot.today
    end = today.replace(day=monthrange(today.year, today.month)[1])
    totals = {row.currency: row for row in tools.get_current_balance()}
    incoming, outgoing, due = defaultdict(Decimal), defaultdict(Decimal), defaultdict(Decimal)
    findings, limitations = [], []
    for row in tools.get_recurring_expenses():
        if row.next_occurrence_date < today:
            limitations.append('Hay recurrencias atrasadas: se proyectan solo ocurrencias desde hoy, no sus períodos anteriores.')
        count = len(list(occurrences(row, today, end)))
        (incoming if row.type == 'INCOME' else outgoing)[row.currency] += row.amount * count
    for row in tools.get_upcoming_obligations():
        if row.due_date <= end:
            due[row.currency] += row.pending_amount
        days = (row.due_date - today).days
        # Node applies the user's configurable days_before before persisting this candidate.
        findings.append(Finding(key=f'due:{row.id}', type='OBLIGATION_DUE',
            severity='CRITICAL' if days < 0 else 'WARNING', origin='rule',
            title=f'Cuota {"vencida" if days < 0 else "por vencer"}: {row.name}',
            message=f'Pendiente: {money(row.pending_amount)} {row.currency}. Vencimiento: {row.due_date}.',
            currency=row.currency, entity_id=row.id, evidence={'days_until_due': days}))
    projections = []
    for currency in sorted(set(totals) | set(incoming) | set(outgoing) | set(due)):
        total = totals.get(currency)
        balance = total.recorded_balance if total else Decimal(0)
        expected_income = incoming[currency] + (total.scheduled_income if total else Decimal(0))
        expected_expense = outgoing[currency] + (total.scheduled_expense if total else Decimal(0))
        scheduled = balance + expected_income - expected_expense - due[currency]
        variable = (total.variable_expense if total else Decimal(0)) / today.day * (end.day - today.day)
        estimated = scheduled - variable
        projections.append({'currency': currency, 'recorded_balance': money(balance),
            'scheduled_income': money(expected_income), 'scheduled_expense': money(expected_expense),
            'pending_obligations': money(due[currency]), 'scheduled_balance': money(scheduled),
            'estimated_variable_expense': money(variable), 'estimated_end_balance': money(estimated)})
        if estimated < 0:
            findings.append(Finding(key=f'projection:{today:%Y-%m}:{currency}', type='LOW_PROJECTED_BALANCE',
                severity='WARNING', origin='analysis', title=f'Posible saldo negativo en {currency}',
                message=f'La estimación al {end} es {money(estimated)} {currency}; no es tu saldo real.',
                currency=currency, evidence={'estimated_end_balance': money(estimated)}))
    limitations += ['Saldo registrado = ingresos menos gastos hasta hoy; no verifica saldos bancarios ni efectivo inicial.',
        'Proyección = saldo registrado + ingresos programados - gastos programados - cuotas pendientes - gasto variable estimado.',
        'Los gastos ya registrados no se descuentan dos veces. No se convierten monedas.',
        'Las recurrencias y cuotas se consideran compromisos distintos; si registraste el mismo pago en ambos, corrígelo para evitar duplicarlo.',
        'El gasto variable estimado extrapola el ritmo del mes y excluye transacciones vinculadas a recurrencias o cuotas.']
    return AgentResult(agent='projection', summary=' '.join(
        f"Estimación al {end}: {p['estimated_end_balance']} {p['currency']}." for p in projections) or 'No hay datos para calcular una proyección.',
        tools=['get_current_balance', 'get_upcoming_obligations', 'get_recurring_expenses', 'get_financial_projection'],
        metrics={'period_end': end.isoformat(), 'currencies': projections, 'complete': not tools.snapshot.truncated},
        findings=findings, limitations=list(dict.fromkeys(limitations)))
