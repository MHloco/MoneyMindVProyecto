from collections import defaultdict
from decimal import Decimal

from ..schemas import AgentResult
from ..tools import FinancialTools
from .common import money, percent


def run(tools: FinancialTools) -> AgentResult:
    rows = tools.get_spending_distribution()
    totals = defaultdict(Decimal)
    for row in rows:
        totals[row.currency] += row.current_amount
    categories = [{
        'category': row.category, 'currency': row.currency,
        'spent': money(row.current_amount), 'share_percent': percent(row.current_amount, totals[row.currency]),
        'previous_comparable_period': money(row.previous_amount),
        'change_percent': percent(row.current_amount - row.previous_amount, row.previous_amount),
        'movements': row.movements,
    } for row in rows]
    leaders = [max((r for r in rows if r.currency == currency), key=lambda r: r.current_amount)
               for currency in sorted(totals) if totals[currency] > 0]
    summary = ' '.join(f'Tu mayor gasto en {r.currency} es {r.category}: {money(r.current_amount)}.' for r in leaders)
    return AgentResult(agent='habits', summary=summary or 'No hay gastos registrados en el período para identificar hábitos.',
        tools=['get_spending_distribution', 'get_month_income', 'get_month_expenses'],
        metrics={'categories': categories, 'income': tools.get_month_income(), 'expenses': tools.get_month_expenses()},
        limitations=['Se compara lo transcurrido del mes con los mismos días del mes anterior (hasta su último día). Un mes parcial no equivale a un mes completo.'])
