from ..schemas import AgentResult, Finding
from ..tools import FinancialTools
from .common import money


def run(tools: FinancialTools) -> AgentResult:
    findings = []
    rows = tools.get_expense_anomalies()
    insufficient = 0
    for row in rows:
        if row.baseline_count < 5:
            insufficient += 1
            continue
        threshold = max(row.baseline_mean * 2, row.baseline_mean + row.baseline_stddev * 3)
        if row.amount <= threshold:
            continue
        findings.append(Finding(key=f'anomaly:{row.id}', type='UNUSUAL_SPENDING', severity='WARNING', origin='analysis',
            title=f'Gasto inusual en {row.category}',
            message=f'El gasto de {money(row.amount)} {row.currency} del {row.transaction_date} supera el patrón de su categoría. Revisa si fue previsto.',
            currency=row.currency, entity_id=row.id,
            evidence={'amount': money(row.amount), 'baseline_mean': money(row.baseline_mean),
                      'threshold': money(threshold), 'sample_size': row.baseline_count}))
    return AgentResult(agent='anomalies', summary=f'Se detectaron {len(findings)} gastos que conviene revisar.',
        tools=['get_expense_anomalies'], findings=findings,
        metrics={'reviewed': len(rows), 'insufficient_history': insufficient},
        limitations=['Detección estadística, no prueba de fraude. Requiere al menos cinco gastos previos de la misma categoría y moneda; usa los 90 días anteriores a cada gasto.'])
