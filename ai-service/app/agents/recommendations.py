from ..schemas import AgentResult


def run(results: list[AgentResult]) -> AgentResult:
    actions = []
    for result in results:
        for finding in result.findings:
            if finding.type == 'OBLIGATION_DUE' and finding.evidence.get('days_until_due', 0) <= 3:
                actions.append(f'Revisa el pago pendiente: {finding.message}')
            elif finding.type in ('BUDGET_THRESHOLD', 'BUDGET_EXCEEDED'):
                actions.append(f'Revisa los gastos opcionales del presupuesto. {finding.message}')
            elif finding.type == 'UNUSUAL_SPENDING':
                actions.append(f'Comprueba el movimiento antes de ajustar tu plan. {finding.message}')
            elif finding.type == 'LOW_PROJECTED_BALANCE':
                actions.append(f'Prioriza pagos pendientes y revisa gastos opcionales. {finding.message}')
    if not actions:
        actions.append('Mantén actualizados tus ingresos, gastos y fechas de pago; no se detectaron avisos con los datos disponibles.')
    return AgentResult(agent='recommendations', summary=' '.join(actions[:5]),
        tools=['get_financial_projection', 'get_active_budgets', 'get_spending_distribution'],
        metrics={'actions': list(dict.fromkeys(actions))[:10]},
        limitations=['Recomendaciones de organización basadas en los agentes; no ejecutan pagos ni modifican movimientos.'])
