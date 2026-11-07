from decimal import Decimal

from ..schemas import AgentResult, Finding
from ..tools import FinancialTools
from .common import money, percent


def run(tools: FinancialTools) -> AgentResult:
    rows, findings = [], []
    today = tools.snapshot.today
    for budget in tools.get_active_budgets():
        elapsed = max(1, (today - budget.period_start).days + 1)
        duration = max(1, (budget.period_end - budget.period_start).days + 1)
        projected = budget.spent / Decimal(elapsed) * duration
        ratio = budget.spent / budget.amount if budget.amount else (Decimal(1) if budget.spent else Decimal(0))
        exceeded = budget.spent > budget.amount
        rows.append({'name': budget.name, 'currency': budget.currency, 'amount': money(budget.amount),
            'spent': money(budget.spent), 'used_percent': percent(budget.spent, budget.amount),
            'remaining': money(budget.amount - budget.spent), 'estimated_period_spend': money(projected),
            'risk': 'exceeded' if exceeded else 'at_risk' if projected > budget.amount else 'within_budget'})
        if exceeded or ratio * 100 >= tools.snapshot.budget_threshold:
            kind = 'BUDGET_EXCEEDED' if exceeded else 'BUDGET_THRESHOLD'
            findings.append(Finding(key=f'{kind}:{budget.id}:{budget.period_start}', type=kind,
                severity='CRITICAL' if exceeded else 'WARNING', origin='rule',
                title=f'Presupuesto {"excedido" if exceeded else "cerca del límite"}: {budget.name}',
                message=f'Has gastado {money(budget.spent)} de {money(budget.amount)} {budget.currency}.',
                currency=budget.currency, entity_id=budget.id,
                evidence={'used_percent': percent(budget.spent, budget.amount)}))
    return AgentResult(agent='budgets', summary=f'Se revisaron {len(rows)} presupuestos vigentes; {len(findings)} requieren atención.',
        tools=['get_active_budgets'], metrics={'budgets': rows}, findings=findings,
        limitations=['La estimación supone un ritmo diario constante. Los presupuestos pueden superponerse y no se suman como gastos pendientes.'])
